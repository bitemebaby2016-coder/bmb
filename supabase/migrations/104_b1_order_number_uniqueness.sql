-- ============================================
-- Bite Me Baby — Migration 104: B-1 order_number uniqueness fix
-- Owner authorization: NEXT EXECUTION GATE (2026-10-02), Gate 1
--
-- Defect (S0.1 finding B-1):
--   create_order_with_items_core generated order_number via
--   check-then-insert (SELECT EXISTS ... random 100-999) with NO unique
--   constraint on orders.order_number. Two concurrent transactions could
--   pass the EXISTS check and both INSERT → duplicate order_number rows.
--   Verified by grep across all 103 prior migrations: zero UNIQUE on order_number.
--
-- Fix (minimal, additive to the number contract only):
--   1) HARD-STOP pre-check: this migration ABORTS if duplicate order_number
--      rows already exist (no delete, no auto-repair, no renumbering —
--      Owner decision required first, per gate instructions).
--   2) CREATE UNIQUE INDEX uq_orders_order_number — database becomes the
--      uniqueness authority (check-then-insert is no longer a guarantee).
--   3) create_order_with_items_core: section 9 replaced — the INSERT now
--      catches unique_violation and regenerates a fresh number (retry ≤ 6),
--      then raises ERR_ORDER_NUMBER_EXHAUSTED. The number FORMAT is unchanged
--      (BMB-YYYYMMDD-### / PO-YYYYMMDD-###).
--
-- NOT changed (per implementation boundary):
--   payment rules/status, pricing, delivery fee, capacity, inventory,
--   KDS, order state machine, checkout UX, wrapper RPC signature.
--
-- Reversible: DROP INDEX uq_orders_order_number;
--             CREATE OR REPLACE ... core back to migration 048 body.
-- ============================================

BEGIN;

-- ===== 1. Duplicate pre-check — HARD STOP if production data violates uniqueness =====
DO $precheck$
DECLARE
  v_dup_groups integer;
BEGIN
  SELECT COUNT(*) INTO v_dup_groups
    FROM (
      SELECT order_number
        FROM public.orders
       WHERE order_number IS NOT NULL
       GROUP BY order_number
      HAVING COUNT(*) > 1
    ) d;
  IF v_dup_groups > 0 THEN
    RAISE EXCEPTION
      'HARD_STOP_DUPLICATE_ORDER_NUMBERS: % duplicate order_number group(s) exist. Owner decision required before creating uq_orders_order_number. No rows were modified.',
      v_dup_groups;
  END IF;
END
$precheck$;

-- ===== 2. Database-level uniqueness authority =====
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_order_number
  ON public.orders (order_number);
-- ===== 3. create_order_with_items_core — section 9 replaced with unique_violation retry =====
-- Body is byte-identical to migration 048 except: order-number generation + INSERT
-- (section 9) which now retries on unique_violation instead of trusting EXISTS.
CREATE OR REPLACE FUNCTION public.create_order_with_items_core(
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
  p_distance_km numeric DEFAULT 0,
  p_order_mode text DEFAULT 'SAME_DAY',
  p_scheduled_date date DEFAULT NULL,
  p_customer_ref uuid DEFAULT NULL
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
  v_order_exists   boolean;
  v_attempt        integer := 0;
  v_mode           text;
  v_item_row       record;
  v_pid            text;
  v_qty            integer;
  v_unit_price     numeric;
  v_addon_price    numeric;
  v_item_sub       numeric;
  v_subtotal       numeric := 0;
  v_discount       numeric := 0;
  v_delivery_fee   numeric := 0;
  v_service_fee    numeric := 0;
  v_tax            numeric := 0;
  v_total          numeric := 0;
  v_items_total_qty integer := 0;
  v_round_status   text;
  v_max_cap        integer;
  v_cur_count      integer;
  v_round_date     date;
  v_round_cutoff   time;
  v_prod_is_avail  boolean;
  v_prod_same_day  boolean;
  v_prod_preorder  boolean;
  v_prod_name      text;
  v_delivery_method text;
  v_distance       numeric;
  v_promo          public.promotions%ROWTYPE;
  v_ing_name       text;
  v_today          date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now            time := (now() AT TIME ZONE 'Asia/Bangkok')::time;
BEGIN
  -- ===== 1. AUTHENTICATION =====
  v_uid := COALESCE(auth.uid(), p_customer_ref);
  IF v_uid IS NULL OR (auth.uid() IS NULL AND NOT COALESCE(public.has_service_role(), false)) THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;

  -- ===== 2. ORDER MODE + INPUT =====
  v_mode := COALESCE(p_order_mode, 'SAME_DAY');
  IF v_mode NOT IN ('SAME_DAY', 'PRE_ORDER') THEN
    RAISE EXCEPTION 'ERR_INVALID_ORDER_MODE';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ERR_EMPTY_ORDER';
  END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ROUND';
  END IF;
  IF p_payment_method NOT IN ('promptpay_qr', 'cash_on_delivery', 'credit_card') THEN
    RAISE EXCEPTION 'ERR_INVALID_PAYMENT_METHOD';
  END IF;
  IF p_delivery_method NOT IN ('self_delivery', 'grab_rider', 'linemen_rider', 'foodpanda_rider') THEN
    RAISE EXCEPTION 'ERR_INVALID_DELIVERY_METHOD';
  END IF;

  -- ===== 3. DELIVERY ROUND - atomic capacity lock =====
  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff
    FROM public.delivery_rounds
   WHERE id = p_delivery_round_id
   FOR UPDATE;

  IF v_round_status IS NULL THEN
    RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND';
  END IF;
  IF v_round_status <> 'active' THEN
    RAISE EXCEPTION 'ERR_ROUND_CLOSED';
  END IF;

  -- ===== 4. MODE-SPECIFIC ROUND / CUTOFF / DATE RULES (server authority, Bangkok time) =====
  IF v_mode = 'SAME_DAY' THEN
    IF v_round_date IS NULL OR v_round_date <> v_today THEN
      RAISE EXCEPTION 'ERR_ROUND_DATE';
    END IF;
    IF v_now > v_round_cutoff THEN
      RAISE EXCEPTION 'ERR_CUTOFF_PASSED';
    END IF;
    IF p_scheduled_date IS NOT NULL AND p_scheduled_date <> v_round_date THEN
      RAISE EXCEPTION 'ERR_ROUND_DATE';
    END IF;
  ELSE
    IF p_scheduled_date IS NULL THEN
      RAISE EXCEPTION 'ERR_MISSING_SCHEDULED_DATE';
    END IF;
    IF p_scheduled_date <= v_today THEN
      RAISE EXCEPTION 'ERR_SCHEDULED_DATE_INVALID';
    END IF;
    IF p_scheduled_date <> v_round_date THEN
      RAISE EXCEPTION 'ERR_ROUND_DATE_MISMATCH';
    END IF;
    IF (p_scheduled_date - v_today) < public.order_setting('pre_order_lead_days', 1) THEN
      RAISE EXCEPTION 'ERR_LEAD_TIME';
    END IF;
  END IF;

  -- capacity check (1 order = 1 slot; +1 handled by trigger orders_increment_round)
  IF (COALESCE(v_cur_count, 0) + 1) > v_max_cap THEN
    RAISE EXCEPTION 'ERR_CAPACITY_FULL';
  END IF;

  -- ===== 5. PRODUCTS - authoritative prices + MODE GATE (both directions) =====
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

    SELECT price, is_available, available_same_day, available_preorder, name
      INTO v_unit_price, v_prod_is_avail, v_prod_same_day, v_prod_preorder, v_prod_name
      FROM public.products
     WHERE id = v_pid
     FOR UPDATE;

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND';
    END IF;
    IF NOT COALESCE(v_prod_is_avail, false) THEN
      RAISE EXCEPTION 'ERR_PRODUCT_UNAVAILABLE';
    END IF;

    -- INVARIANT 1: mode gate, server-authoritative (client UI is NOT authority)
    IF v_mode = 'SAME_DAY' AND NOT COALESCE(v_prod_same_day, false) THEN
      RAISE EXCEPTION 'ERR_PRODUCT_MODE_NOT_ALLOWED';
    END IF;
    IF v_mode = 'PRE_ORDER' AND NOT COALESCE(v_prod_preorder, false) THEN
      RAISE EXCEPTION 'ERR_PRODUCT_MODE_NOT_ALLOWED';
    END IF;

    -- add-on surcharge re-derived from products.addons (client sends no prices)
    v_addon_price := public.compute_addons_price(v_pid, v_item_row.options);

    v_item_sub := v_qty * (v_unit_price + COALESCE(v_addon_price, 0));
    v_subtotal := v_subtotal + v_item_sub;
    v_items_total_qty := v_items_total_qty + v_qty;
  END LOOP;

  -- D-1: total item quantity cap per order (server enforced)
  IF v_items_total_qty > public.order_setting('max_items_per_order', 20) THEN
    RAISE EXCEPTION 'ERR_QTY_LIMIT';
  END IF;

  -- ===== 6. ADVISORY INVENTORY GUARD at CREATE (SAME_DAY; authoritative at CONFIRM = 026) =====
  IF v_mode = 'SAME_DAY' THEN
    SELECT i.name INTO v_ing_name
      FROM (
        SELECT r.ingredient_id, SUM(v.qty * r.quantity_per_unit) AS req
          FROM (
            SELECT j.product_id, COALESCE(j.quantity, 1) AS qty
              FROM jsonb_to_recordset(p_items) AS j(product_id text, quantity integer)
             WHERE j.product_id IS NOT NULL
          ) v
          JOIN public.recipes r ON r.product_id = v.product_id
         GROUP BY r.ingredient_id
      ) need
      JOIN public.inventory i ON i.id = need.ingredient_id
     WHERE i.current_stock < need.req
     LIMIT 1;
    IF v_ing_name IS NOT NULL THEN
      RAISE EXCEPTION 'ERR_INSUFFICIENT_INGREDIENT: %', v_ing_name;
    END IF;
  END IF;

  -- ===== 7. PROMOTION (authoritative - from promotions table) =====
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
          v_discount := LEAST(v_subtotal * COALESCE(v_promo.discount_value, 0) / 100, v_subtotal);
        ELSIF v_promo.discount_type = 'fixed_amount' THEN
          v_discount := LEAST(COALESCE(v_promo.discount_value, 0), v_subtotal);
        END IF;
      END IF;
    END IF;
  END IF;

  -- ===== 8. DELIVERY FEE - server-derived (client distance = advisory only) =====
  v_delivery_method := p_delivery_method;
  v_distance := COALESCE(p_distance_km, 0);

  v_delivery_fee := public.compute_delivery_fee(
    p_dropoff_latitude, p_dropoff_longitude,
    v_delivery_method, v_items_total_qty,
    CASE WHEN p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN v_distance ELSE NULL END
  );

  -- ===== 8.5 DELIVERY COORDS + 5 KM TIER (server authority; client distance = advisory) =====
  IF p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN
    RAISE EXCEPTION 'ERR_MISSING_DELIVERY_COORDS';
  END IF;
  DECLARE
    v_kitchen jsonb := public.kitchen_location();
    v_dist numeric := public.haversine_km(
      (v_kitchen->>'latitude')::numeric, (v_kitchen->>'longitude')::numeric,
      p_dropoff_latitude, p_dropoff_longitude);
  BEGIN
    -- business rule: <= 5.00 km = Bite Drive (self); > 5.00 km = external rider
    IF v_dist <= 5.00 AND v_delivery_method <> 'self_delivery' THEN
      RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE';
    END IF;
    IF v_dist > 5.00 AND v_delivery_method = 'self_delivery' THEN
      RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE';
    END IF;
  END;

  v_service_fee := 0;
  v_tax := 0;
  v_total := GREATEST(0, v_subtotal - v_discount + v_delivery_fee + v_service_fee + v_tax);

  -- ===== 9. ORDER NUMBER + INSERT (B-1 fix, migration 104) =====
  -- orders.order_number is now DB-unique (uq_orders_order_number).
  -- The former check-then-insert loop (SELECT EXISTS + random 100-999) raced
  -- under concurrency. Uniqueness is now enforced BY THE DATABASE; a
  -- unique_violation at INSERT regenerates a fresh number and retries (<= 6).
  -- Number FORMAT unchanged: BMB-YYYYMMDD-### / PO-YYYYMMDD-###.
  v_order_exists := false;
  <<gen_number>>
  FOR v_attempt IN 1..6 LOOP
    IF v_mode = 'PRE_ORDER' THEN
      v_order_number := 'PO-' || to_char(v_round_date, 'YYYYMMDD') || '-'
                        || lpad((floor(random() * 900) + 100)::text, 3, '0');
    ELSE
      v_order_number := 'BMB-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-'
                        || lpad((floor(random() * 900) + 100)::text, 3, '0');
    END IF;
    v_order_id := 'ord-' || to_char(extract(epoch from clock_timestamp()) * 1000, '99999999999')
                  || '-' || substr(md5(random()::text), 1, 6);
    BEGIN
      INSERT INTO public.orders (
        id, order_number, customer_id, customer_name, customer_phone, customer_ref,
        delivery_round_id, status, delivery_method,
        dropoff_detail, dropoff_latitude, dropoff_longitude,
        subtotal, delivery_fee, service_fee, discount_amount, tax_amount, total_amount,
        payment_status, payment_method, special_instructions, order_mode, scheduled_date
      ) VALUES (
        v_order_id, v_order_number, v_uid::text, p_customer_name, p_customer_phone, v_uid,
        p_delivery_round_id, 'pending', v_delivery_method::delivery_method,
        COALESCE(p_delivery_address, ''), p_dropoff_latitude, p_dropoff_longitude,
        v_subtotal, v_delivery_fee, v_service_fee, v_discount, v_tax, v_total,
        'pending', p_payment_method::payment_method, COALESCE(p_special_instructions, ''),
        v_mode::order_mode, v_round_date
      );
      v_order_exists := false;
      EXIT gen_number;
    EXCEPTION
      WHEN unique_violation THEN
        -- duplicate order_number (or any other unique target on orders):
        -- regenerate candidate + retry. Database remains the sole authority.
        v_order_exists := true;
        NULL;
    END;
  END LOOP gen_number;
  IF v_order_exists THEN
    RAISE EXCEPTION 'ERR_ORDER_NUMBER_EXHAUSTED';
  END IF;
  -- capacity +1 happens via trigger orders_increment_round (both modes)

  -- ===== 11. INSERT order_items (unit_price = authoritative; add-on snapshot) =====
  DECLARE
    v_item_qty     integer;
    v_item_pid     text;
    v_item_options jsonb;
    v_item_special text;
    v_i            integer := 0;
  BEGIN
    FOR v_item_row IN SELECT * FROM jsonb_to_recordset(p_items)
        AS x(product_id text, quantity integer, options jsonb, special_request text)
    LOOP
      v_i := v_i + 1;
      v_item_qty     := COALESCE(v_item_row.quantity, 1);
      v_item_pid     := v_item_row.product_id;
      v_item_options := COALESCE(v_item_row.options, '{}');
      v_item_special := COALESCE(v_item_row.special_request, '');

      SELECT price, name INTO v_unit_price, v_prod_name
        FROM public.products WHERE id = v_item_pid FOR UPDATE;

      v_item_options := jsonb_set(
        v_item_options,
        '{addOnTotal}',
        to_jsonb(public.compute_addons_price(v_item_pid, v_item_options))
      );

      INSERT INTO public.order_items (
        id, order_id, product_id, product_name, quantity, unit_price,
        customizations, special_request
      ) VALUES (
        'oi-' || v_order_id || '-' || v_i,
        v_order_id, v_item_pid, v_prod_name, v_item_qty, v_unit_price,
        v_item_options, v_item_special
      );
    END LOOP;
  END;

  PERFORM public.append_audit_log(
    p_action := 'order_created',
    p_entity_type := 'order',
    p_entity_id := v_order_number,
    p_description := 'canonical order created (' || v_mode || ')',
    p_metadata := jsonb_build_object('order_mode', v_mode, 'scheduled_date', v_round_date, 'total', v_total)
  );

  -- ===== 12. Return authoritative result =====
  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending',
    'order_mode', v_mode,
    'scheduled_date', v_round_date,
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

GRANT EXECUTE ON FUNCTION public.create_order_with_items_core(
  jsonb, text, text, text, numeric, numeric, text, text, text, text, text, numeric, text, date, uuid
) TO authenticated;

COMMIT;


-- ===== 4. Drop the obsolete 14-param core overload (single-signature policy) =====
-- Migration 044 granted EXECUTE on the old 14-param core, which still contains
-- the check-then-insert generation. Leaving it reachable would preserve the
-- B-1 race via direct RPC. Nothing in src/ or supabase/functions/ calls the
-- core directly (grep-verified); the 15-param overload above is the only
-- canonical path. Mirrors 048s DROP of the old wrapper overloads.
DROP FUNCTION IF EXISTS public.create_order_with_items_core(
  jsonb, text, text, text, numeric, numeric, text, text, text, text, text, numeric, text, date
);

COMMIT;
