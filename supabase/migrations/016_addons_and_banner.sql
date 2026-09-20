-- ============================================
-- Bite Me Baby — Migration 016: Add-ons / toppings + Home banner promo fields
-- Date: 2026-09-20
--
-- 1) products.addons        JSONB — per-product add-on/topping menu, shape of
--                            ProductAddon[] (id,name,price,type,options,max_selections).
-- 2) promotions.is_banner   BOOLEAN + promotions.banner_image TEXT — flag a promo
--                            as the dismissible home banner (admin toggles it).
-- 3) compute_addons_price() + create_order_with_items extension — add-on prices are
--    re-derived SERVER-SIDE from products.addons (client only sends addon ids + choices),
--    so the charged amount stays server-authoritative (007 principle).
--
-- Seed examples are English-labelled so the owner replaces them with Thai copies via
-- the admin editor (products card -> "Add-ons" JSON) without any risk of broken text.
-- Idempotent: safe to re-run. Applied via: supabase db push
-- ============================================

BEGIN;

-- ============================================
-- 1. products.addons
-- ============================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '[]';

-- Seed add-on demos for the seeded products (only when none exist yet).
UPDATE public.products SET addons = $json$[
  {"id":"ad-cheese","name":"Extra cheese","price":15,"type":"checkbox","options":["Normal","Extra cheese","Extra cheese x2"],"max_selections":2},
  {"id":"ad-egg","name":"Extra egg","price":10,"type":"checkbox","options":["None","Soft egg","Fried egg"],"max_selections":1},
  {"id":"ad-spicy","name":"Spicy level","price":0,"type":"radio","options":["No","Mild","Extra hot"],"max_selections":1}
]$json$::jsonb
 WHERE id = 'prod-1' AND (addons IS NULL OR jsonb_array_length(addons) = 0);

UPDATE public.products SET addons = $json$[
  {"id":"ad-garlic","name":"Extra garlic butter","price":12,"type":"checkbox","options":["Normal","Extra butter","Extra garlic"],"max_selections":1},
  {"id":"ad-sauce","name":"Dipping sauce","price":8,"type":"checkbox","options":["None","Sweet chili","BBQ"],"max_selections":1}
]$json$::jsonb
 WHERE id = 'prod-2' AND (addons IS NULL OR jsonb_array_length(addons) = 0);

UPDATE public.products SET addons = $json$[
  {"id":"ad-creamy","name":"Cream level","price":0,"type":"radio","options":["Light","Normal","Extra creamy"],"max_selections":1},
  {"id":"ad-herb","name":"Herb topping","price":9,"type":"checkbox","options":["None","Basil","Green onion"],"max_selections":1}
]$json$::jsonb
 WHERE id = 'prod-3' AND (addons IS NULL OR jsonb_array_length(addons) = 0);

UPDATE public.products SET addons = $json$[
  {"id":"ad-milk","name":"Milk","price":10,"type":"radio","options":["Dairy","Oat","Soy"],"max_selections":1},
  {"id":"ad-sweet","name":"Sweetness","price":0,"type":"radio","options":["Low","Normal","Sweet"],"max_selections":1}
]$json$::jsonb
 WHERE id = 'prod-4' AND (addons IS NULL OR jsonb_array_length(addons) = 0);

-- ============================================
-- 2. Promotions banner fields + banner seed promo
-- ============================================
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS is_banner BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS banner_image TEXT;

INSERT INTO public.promotions (id, name, description, code, discount_type, discount_value, min_order_amount, is_active, is_banner)
VALUES ('promo-welcome-banner', 'Welcome special - 10% off', 'New customer? Use code WELCOME10', 'WELCOME10', 'percentage', 10, 0, true, true)
ON CONFLICT (id) DO NOTHING;
-- ============================================
-- 3. Server-authoritative add-on pricing
-- ============================================
CREATE OR REPLACE FUNCTION public.compute_addons_price(p_product_id text, p_options jsonb)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_addons  jsonb;
  v_addon   jsonb;
  v_entry   jsonb;
  v_total   numeric := 0;
  v_cnt     integer := 0;
  v_note    text;
BEGIN
  IF p_product_id IS NULL OR p_options IS NULL OR p_options->'addOns' IS NULL THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(addons, '[]'::jsonb) INTO v_addons FROM public.products WHERE id = p_product_id;
  IF v_addons IS NULL OR jsonb_array_length(v_addons) = 0 THEN
    RETURN 0;
  END IF;
  FOR v_addon IN SELECT * FROM jsonb_array_elements(v_addons)
  LOOP
    v_entry := NULL;
    SELECT value::jsonb INTO v_entry
      FROM jsonb_array_elements(COALESCE(p_options->'addOns', '[]'::jsonb)) AS e
     WHERE e.value->>'addonId' = v_addon->>'id'
     LIMIT 1;
    IF v_entry IS NOT NULL THEN
      v_cnt := (SELECT count(*)::int FROM jsonb_array_elements(COALESCE(v_entry->'selections', '[]'::jsonb)));
      v_note := COALESCE(v_entry->>'note', '');
      IF v_addon->>'type' = 'text' THEN
        IF v_cnt > 0 OR v_note <> '' THEN
          v_total := v_total + COALESCE((v_addon->>'price')::numeric, 0);
        END IF;
      ELSE
        v_total := v_total + COALESCE((v_addon->>'price')::numeric, 0) * v_cnt;
      END IF;
    END IF;
  END LOOP;
  RETURN v_total;
END;
$$;
-- ============================================
-- 4. create_order_with_items — include server-side add-on price in subtotal
-- ============================================
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_items jsonb,
  p_delivery_round_id text,
  p_delivery_method text DEFAULT 'self_delivery',
  p_delivery_address text DEFAULT '',
  p_dropoff_latitude numeric DEFAULT NULL,
  p_dropoff_longitude numeric DEFAULT NULL,
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT '',
  p_payment_method text DEFAULT 'promptpay_qr',
  p_special_instructions text DEFAULT '',
  p_promotion_code text DEFAULT NULL,
  p_distance_km numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid            uuid;
  v_order_id       text;
  v_order_number   text;
  v_item_row       record;
  v_pid            text;
  v_qty            integer;
  v_unit_price     numeric;
  v_item_sub       numeric;
  v_addon_price    numeric;
  v_subtotal       numeric := 0;
  v_discount       numeric := 0;
  v_delivery_fee   numeric := 0;
  v_service_fee    numeric := 0;
  v_tax            numeric := 0;
  v_total          numeric := 0;
  v_round_status   text;
  v_max_cap        integer;
  v_cur_count      integer;
  v_prod_is_avail  boolean;
  v_prod_name      text;
  v_order_exists   boolean;
  v_attempt        integer := 0;
  v_delivery_method text;
  v_distance        numeric;
  v_items_total_qty integer := 0;
  v_promo           public.promotions%ROWTYPE;
BEGIN
  -- ===== 1. AUTHENTICATION =====
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;

  -- ===== 2. INPUT VALIDATION =====
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ERR_EMPTY_ORDER';
  END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ROUND';
  END IF;
  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_CUSTOMER_NAME';
  END IF;

  IF p_delivery_method NOT IN ('self_delivery','grab_rider','linemen_rider','foodpanda_rider') THEN
    RAISE EXCEPTION 'ERR_INVALID_DELIVERY_METHOD';
  END IF;
  IF p_payment_method NOT IN ('promptpay_qr','cash_on_delivery','credit_card') THEN
    RAISE EXCEPTION 'ERR_INVALID_PAYMENT_METHOD';
  END IF;

  v_delivery_method := p_delivery_method;
  v_distance := COALESCE(p_distance_km, 0);

  -- ===== 3. DELIVERY ROUND — atomic capacity lock =====
  SELECT status, max_capacity, current_count
    INTO v_round_status, v_max_cap, v_cur_count
    FROM public.delivery_rounds
   WHERE id = p_delivery_round_id
   FOR UPDATE;

  IF v_round_status IS NULL THEN
    RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND';
  END IF;
  IF v_round_status <> 'active' THEN
    RAISE EXCEPTION 'ERR_ROUND_CLOSED';
  END IF;
  IF (v_cur_count + 1) > v_max_cap THEN
    RAISE EXCEPTION 'ERR_CAPACITY_FULL';
  END IF;

  -- ===== 4. PRODUCTS / AUTHORITATIVE PRICES (base + add-ons) =====
  FOR v_item_row IN SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id text, quantity integer, options jsonb, special_request text)
  LOOP
    v_pid := v_item_row.product_id;
    v_qty := COALESCE(v_item_row.quantity, 0);

    IF v_pid IS NULL OR trim(v_pid) = '' THEN
      RAISE EXCEPTION 'ERR_MISSING_PRODUCT_ID';
    END IF;
    IF v_qty <= 0 OR v_qty > 1000 THEN
      RAISE EXCEPTION 'ERR_INVALID_QUANTITY';
    END IF;

    SELECT price, is_available, name
      INTO v_unit_price, v_prod_is_avail, v_prod_name
      FROM public.products
     WHERE id = v_pid
     FOR UPDATE;

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND';
    END IF;
    IF NOT COALESCE(v_prod_is_avail, false) THEN
      RAISE EXCEPTION 'ERR_PRODUCT_UNAVAILABLE';
    END IF;

    -- add-on surcharge re-derived from products.addons (client sends no prices)
    v_addon_price := public.compute_addons_price(v_pid, v_item_row.options);

    v_item_sub := v_qty * (v_unit_price + COALESCE(v_addon_price, 0));
    v_subtotal := v_subtotal + v_item_sub;
    v_items_total_qty := v_items_total_qty + v_qty;
  END LOOP;
-- ===== 5. PROMOTION (authoritative — from promotions table) =====
  IF p_promotion_code IS NOT NULL AND trim(p_promotion_code) <> '' THEN
    SELECT * INTO v_promo
      FROM public.promotions
     WHERE upper(code) = upper(trim(p_promotion_code))
       AND is_active = true
       AND (start_date IS NULL OR start_date <= CURRENT_DATE)
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
     LIMIT 1;

    IF FOUND THEN
      IF v_subtotal >= COALESCE(v_promo.min_order_amount, 0) THEN
        IF v_promo.discount_type = 'percentage' THEN
          v_discount := LEAST(v_subtotal * COALESCE(v_promo.discount_value,0) / 100, v_subtotal);
        ELSIF v_promo.discount_type = 'fixed_amount' THEN
          v_discount := LEAST(COALESCE(v_promo.discount_value,0), v_subtotal);
        END IF;
      END IF;
    END IF;
  END IF;

  -- ===== 6. DELIVERY FEE (authoritative server rules) =====
  IF v_delivery_method = 'self_delivery' THEN
    v_delivery_fee := LEAST(30 + v_distance * 4 + v_items_total_qty * 2, 9999);
  ELSIF v_delivery_method = 'grab_rider' THEN
    v_delivery_fee := LEAST(40 + v_distance * 8 + v_items_total_qty * 2, 9999);
  ELSIF v_delivery_method = 'linemen_rider' THEN
    v_delivery_fee := LEAST(35 + v_distance * 7 + v_items_total_qty * 2, 9999);
  ELSIF v_delivery_method = 'foodpanda_rider' THEN
    v_delivery_fee := LEAST(38 + v_distance * 7.5 + v_items_total_qty * 2, 9999);
  END IF;

  v_service_fee := 0;
  v_tax := 0;
  v_total := GREATEST(0, v_subtotal - v_discount + v_delivery_fee + v_service_fee + v_tax);

  -- ===== 7. INSERT order (authoritative amounts) =====
  v_order_id := 'ord-' || to_char(extract_epoch(clock_timestamp()) * 1000, '99999999999')
                    || '-' || substr(md5(random()::text), 1, 6);
  v_order_number := 'BMB-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-'
                    || lpad((floor(random() * 900) + 100)::text, 3, '0');
  LOOP
    v_attempt := v_attempt + 1;
    SELECT EXISTS(
      SELECT 1 FROM public.orders WHERE order_number = v_order_number
    ) INTO v_order_exists;
    EXIT WHEN NOT v_order_exists OR v_attempt >= 5;
    v_order_number := 'BMB-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-'
                      || lpad((floor(random() * 900) + 100)::text, 3, '0');
  END LOOP;
  IF v_order_exists THEN
    RAISE EXCEPTION 'ERR_ORDER_NUMBER_EXHAUSTED';
  END IF;

  INSERT INTO public.orders (
    id, order_number, customer_id, customer_name, customer_phone,
    customer_ref, delivery_round_id, status, delivery_method,
    dropoff_detail, dropoff_latitude, dropoff_longitude,
    subtotal, delivery_fee, service_fee, discount_amount, tax_amount, total_amount,
    payment_status, payment_method, special_instructions
  ) VALUES (
    v_order_id, v_order_number, v_uid::text, p_customer_name, p_customer_phone,
    v_uid, p_delivery_round_id, 'pending', v_delivery_method::delivery_method,
    COALESCE(p_delivery_address, ''), p_dropoff_latitude, p_dropoff_longitude,
    v_subtotal, v_delivery_fee, v_service_fee, v_discount, v_tax, v_total,
    'pending', p_payment_method::payment_method, COALESCE(p_special_instructions, '')
  );

  -- ===== 8. INSERT order_items (unit_price = base; add-on snapshot in customizations) =====
  DECLARE
    v_item_qty integer;
    v_item_pid text;
    v_item_options jsonb;
    v_item_special text;
    v_i integer := 0;
  BEGIN
    FOR v_item_row IN SELECT * FROM jsonb_to_recordset(p_items)
        AS x(product_id text, quantity integer, options jsonb, special_request text)
    LOOP
      v_i := v_i + 1;
      v_item_qty     := COALESCE(v_item_row.quantity, 1);
      v_item_options := COALESCE(v_item_row.options, '{}');
      v_item_special := COALESCE(v_item_row.special_request, '');

      SELECT price, name INTO v_unit_price, v_prod_name
        FROM public.products WHERE id = v_item_row.product_id FOR UPDATE;

      v_item_options := jsonb_set(
        v_item_options,
        '{addOnTotal}',
        to_jsonb(public.compute_addons_price(v_item_row.product_id, v_item_options))
      );

      INSERT INTO public.order_items (
        id, order_id, product_id, product_name, quantity, unit_price,
        customizations, special_request
      ) VALUES (
        'oi-' || v_order_id || '-' || v_i,
        v_order_id,
        v_item_row.product_id,
        v_prod_name,
        v_item_qty,
        v_unit_price,
        v_item_options,
        v_item_special
      );
    END LOOP;
  END;

  -- ===== 9. Return authoritative result =====
  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending',
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'delivery_fee', v_delivery_fee,
    'service_fee', v_service_fee,
    'tax_amount', v_tax,
    'total_amount', v_total,
    'payment_status', 'pending',
    'payment_method', p_payment_method,
    'delivery_round_id', p_delivery_round_id,
    'customer_ref', v_uid::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_with_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;

COMMIT;

-- ============================================
-- END OF MIGRATION 016
-- ============================================