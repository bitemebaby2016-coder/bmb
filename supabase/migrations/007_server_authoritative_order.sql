-- ============================================
-- Bite Me Baby — Migration 007: Server-Authoritative Order Creation
-- Date: 2026-09-18
-- Phase: P0-4 (Price/Order authority — client = input layer only)
--
-- Goal:
--   create_order_with_items(payload)
--     → authenticated check
--     → validate input
--     → read products + authoritative prices from DB (FOR UPDATE)
--     → validate round + capacity atomically (row lock)
--     → calculate subtotal / discount / delivery / total from DB rules
--     → INSERT order + order_items in ONE transaction
--     → return authoritative order result (ignores any client-side totals)
--
-- Security:
--   SECURITY DEFINER + SET search_path = public (shadow-safe)
--   EXECUTE granted ONLY to `authenticated` (NOT anon)
--   No service-role usage anywhere.
-- Idempotent: safe to re-run.
-- ============================================

BEGIN;

-- ============================================
-- 1. RPC: create_order_with_items
--    payload (input only):
--      p_items[]            {product_id, quantity, options, special_request}
--      p_delivery_round_id  text
--      p_delivery_method    text  (self_delivery|grab_rider|linemen_rider|foodpanda_rider)
--      p_delivery_address   text  (dropoff_detail)
--      p_dropoff_latitude   numeric(10,7)
--      p_dropoff_longitude  numeric(10,7)
--      p_customer_name      text  (recipient name — user input)
--      p_customer_phone     text  (recipient phone — user input)
--      p_payment_method     text  (promptpay_qr|cash_on_delivery|credit_card)
--      p_special_instructions text
--      p_promotion_code     text NULLABLE
--      p_distance_km        numeric NULLABLE (delivery distance — UI input, NOT financial)
--    NOT ACCEPTED (ignored if provided): price, subtotal, discount_amount,
--      delivery_fee, service_fee, tax_amount, total_amount, payment_status
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
   FOR UPDATE; -- row lock: concurrent checkout waits here

  IF v_round_status IS NULL THEN
    RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND';
  END IF;
  IF v_round_status <> 'active' THEN
    RAISE EXCEPTION 'ERR_ROUND_CLOSED';
  END IF;
  IF (v_cur_count + 1) > v_max_cap THEN
    RAISE EXCEPTION 'ERR_CAPACITY_FULL';
  END IF;

  -- ===== 4. PRODUCTS / AUTHORITATIVE PRICES =====
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
     FOR UPDATE; -- authoritative price snapshot (no client price used)

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND';
    END IF;
    IF NOT COALESCE(v_prod_is_avail, false) THEN
      RAISE EXCEPTION 'ERR_PRODUCT_UNAVAILABLE';
    END IF;

    v_item_sub := v_qty * v_unit_price;
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

  -- ===== 6. DELIVERY FEE (authoritative server rules; mirrors
  --     DEFAULT_PROVIDERS in src/lib/externalProviders.ts) =====
  IF v_delivery_method = 'self_delivery' THEN
    v_delivery_fee := LEAST(30 + v_distance * 4 + v_items_total_qty * 2, 9999);
  ELSIF v_delivery_method = 'grab_rider' THEN
    v_delivery_fee := LEAST(40 + v_distance * 8 + v_items_total_qty * 2, 9999);
  ELSIF v_delivery_method = 'linemen_rider' THEN
    v_delivery_fee := LEAST(35 + v_distance * 7 + v_items_total_qty * 2, 9999);
  ELSIF v_delivery_method = 'foodpanda_rider' THEN
    v_delivery_fee := LEAST(38 + v_distance * 7.5 + v_items_total_qty * 2, 9999);
  END IF;

  v_service_fee := 0;  -- included in price (TH market policy)
  v_tax := 0;
  v_total := GREATEST(0, v_subtotal - v_discount + v_delivery_fee + v_service_fee + v_tax);

  -- ===== 7. INSERT order (authoritative amounts) =====
  v_order_id := 'ord-' || to_char(extract_epoch(clock_timestamp()) * 1000, '99999999999')
                    || '-' || substr(md5(random()::text), 1, 6);

  -- order_number: BMB-YYYYMMDD-### (collision retry up to 5)
  LOOP
    v_attempt := v_attempt + 1;
    v_order_number := 'BMB-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-'
                      || lpad((floor(random() * 900) + 100)::text, 3, '0');
    SELECT EXISTS(
      SELECT 1 FROM public.orders WHERE order_number = v_order_number
    ) INTO v_order_exists;
    EXIT WHEN NOT v_order_exists OR v_attempt >= 5;
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

  -- ===== 8. INSERT order_items (unit_price = authoritative price) =====
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ============================================
-- 2. EXECUTE permission — authenticated only
-- ============================================
REVOKE EXECUTE ON FUNCTION public.create_order_with_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;

-- ============================================
-- 3. DONE
-- ============================================
COMMIT;

-- ============================================
-- END OF MIGRATION 007
-- ============================================