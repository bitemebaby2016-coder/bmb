-- ============================================
-- Bite Me Baby — Migration 025: Canonical Order RPC + Capacity Release + Cancellation (PHASE 2)
-- Date: 2026-09-22 · Design: ORDER_SPINE_DESIGN.md @ 6cffbe5 (APPROVED)
--
-- 1) create_order_with_items v3 — THE single order-creation authority for BOTH modes:
--      p_order_mode ('SAME_DAY'|'PRE_ORDER') + p_scheduled_date (nullable, appended to v2)
--      mode gate (available_same_day/available_preorder) · cutoff authority (Asia/Bangkok)
--      scheduled_date invariant · 1 order = 1 slot · qty cap 20 (D-1) · advisory stock guard
--      order number: PRE_ORDER → PO-, SAME_DAY → BMB-
-- 2) release_round_capacity_on_terminal() trigger — non-terminal → cancelled/failed
--      releases exactly 1 slot; refuses to hide corruption (no GREATEST).
--      Payment failure does NOT touch order status → slot retained (business rule).
-- 3) cancel_order(p_order_number, p_reason) — atomic canonical cancellation.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS orders_release_round_capacity ON public.orders;
--   DROP FUNCTION IF EXISTS public.release_round_capacity_on_terminal();
--   (คืน trigger 006: CREATE TRIGGER orders_decrement_round AFTER UPDATE OF status ON orders
--    FOR EACH ROW EXECUTE FUNCTION public.decrement_delivery_round_count();)
--   DROP FUNCTION IF EXISTS public.cancel_order(text, text);
--   (create_order_with_items / shims: recreate จากไฟล์ 020/017 — schema additive จึงเข้ากันได้)
-- ============================================

BEGIN;

-- Defensive: remove the legacy 12-arg overload so the canonical 14-arg signature
-- (with defaults) is the ONLY overload — old 12-arg named-arg calls resolve here
-- via defaults and CANNOT bypass mode gate / cutoff rules. (PostgREST overload safety.)
DROP FUNCTION IF EXISTS public.create_order_with_items(jsonb, text, text, text, numeric, numeric, text, text, text, text, text, numeric);

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
  p_distance_km numeric DEFAULT 0,
  p_order_mode text DEFAULT 'SAME_DAY',
  p_scheduled_date date DEFAULT NULL
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
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
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

  -- ===== 3. DELIVERY ROUND — atomic capacity lock =====
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

  -- ===== 5. PRODUCTS — authoritative prices + MODE GATE (both directions) =====
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

  -- ===== 7. PROMOTION (authoritative — from promotions table) =====
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

  -- ===== 8. DELIVERY FEE — server-derived (client distance = advisory only) =====
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

  -- ===== 9. ORDER NUMBER (prefix by mode: BMB- same-day / PO- pre-order) =====
  LOOP
    v_attempt := v_attempt + 1;
    IF v_mode = 'PRE_ORDER' THEN
      v_order_number := 'PO-' || to_char(v_round_date, 'YYYYMMDD') || '-'
                        || lpad((floor(random() * 900) + 100)::text, 3, '0');
    ELSE
      v_order_number := 'BMB-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-'
                        || lpad((floor(random() * 900) + 100)::text, 3, '0');
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_order_number) INTO v_order_exists;
    EXIT WHEN NOT v_order_exists OR v_attempt >= 5;
  END LOOP;
  IF v_order_exists THEN
    RAISE EXCEPTION 'ERR_ORDER_NUMBER_EXHAUSTED';
  END IF;
  v_order_id := 'ord-' || to_char(extract(epoch from clock_timestamp()) * 1000, '99999999999')
                || '-' || substr(md5(random()::text), 1, 6);

  -- ===== 10. INSERT canonical order (scheduled_date invariant = round date) =====
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

REVOKE EXECUTE ON FUNCTION public.create_order_with_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;

-- ============================================
-- 2. CAPACITY RELEASE — non-terminal → cancelled/failed releases exactly 1 slot
--    Idempotent by transition condition; refuses to hide corruption (no GREATEST).
--    Payment failure (mark_payment_failed) never touches order status → slot retained.
--
--    IMPORTANT (live finding during PHASE 2 local verification):
--    migration 006 ALREADY shipped `orders_decrement_round` → decrement_delivery_round_count()
--    (with GREATEST(0, ...)). Keeping both = DOUBLE decrement. The 006 trigger is
--    superseded here: this trigger replaces it and adds (a) invariant detection when
--    releasing against a zero count and (b) audit evidence for every release.
-- ============================================
DROP TRIGGER IF EXISTS orders_decrement_round ON public.orders;

CREATE OR REPLACE FUNCTION public.release_round_capacity_on_terminal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_round_id IS NOT NULL
     AND OLD.status NOT IN ('cancelled', 'failed')
     AND NEW.status IN ('cancelled', 'failed') THEN
    UPDATE public.delivery_rounds
       SET current_count = current_count - 1, updated_at = NOW()
     WHERE id = NEW.delivery_round_id
       AND current_count > 0;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ERR_CAPACITY_INVARIANT: releasing a slot on round % but current_count is already 0', NEW.delivery_round_id;
    END IF;
    PERFORM public.append_audit_log(
      p_action := 'capacity_released',
      p_entity_type := 'order',
      p_entity_id := NEW.order_number,
      p_description := 'capacity slot released (' || OLD.status::text || ' -> ' || NEW.status::text || ')',
      p_metadata := jsonb_build_object('round_id', NEW.delivery_round_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_release_round_capacity ON public.orders;
CREATE TRIGGER orders_release_round_capacity
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.release_round_capacity_on_terminal();

-- ============================================
-- 3. cancel_order — canonical atomic cancellation (both modes)
--    authz → state → cancelled → capacity(trigger) → inventory restore →
--    assignment cancel → audit. Single transaction; any failure rolls back all.
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_number text,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid;
  v_order      public.orders%ROWTYPE;
  v_is_admin   boolean;
  v_is_owner   boolean;
  v_window_min numeric;
  v_today      date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  v_is_admin := public.is_admin();
  v_is_owner := (v_order.customer_ref IS NOT NULL AND v_order.customer_ref = v_uid);
  IF NOT v_is_admin AND NOT v_is_owner THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', 'cancelled', 'idempotent', true);
  END IF;

  -- authorization rules (canonical policy, both modes)
  v_window_min := public.order_setting('cancel_window_minutes', 5);
  IF v_is_admin THEN
    IF v_order.status = 'delivered' THEN
      RAISE EXCEPTION 'ERR_ORDER_TERMINAL';
    END IF;
  ELSE
    -- owner: pending only, inside cancel window (D-5, default 5 min)
    IF v_order.status <> 'pending' THEN
      RAISE EXCEPTION 'ERR_CANCEL_WINDOW_PASSED';
    END IF;
    v_window_min := public.order_setting('cancel_window_minutes', 5);
    IF EXTRACT(EPOCH FROM (NOW() - v_order.created_at)) / 60.0 > v_window_min THEN
      RAISE EXCEPTION 'ERR_CANCEL_WINDOW_PASSED';
    END IF;
    IF v_order.order_mode = 'PRE_ORDER' AND v_order.scheduled_date IS NOT NULL
       AND v_order.scheduled_date <= v_today THEN
      RAISE EXCEPTION 'ERR_CANCEL_WINDOW_PASSED';
    END IF;
  END IF;

  -- state transition (allow-list re-checked by guard trigger) → capacity release via trigger
  UPDATE public.orders
     SET status = 'cancelled', updated_at = NOW()
   WHERE order_number = p_order_number;

  -- inventory restore (only if the order ever reached confirmed/preparing = deducted)
  IF v_order.status IN ('confirmed', 'preparing') THEN
    PERFORM public.restore_inventory_for_order(p_order_number);
  END IF;

  -- delivery assignment cancel (if any, not yet delivered)
  UPDATE public.delivery_assignments
     SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
   WHERE order_number = p_order_number
     AND status NOT IN ('delivered', 'cancelled');

  PERFORM public.append_audit_log(
    p_action := 'order_cancelled',
    p_entity_type := 'order',
    p_entity_id := p_order_number,
    p_description := 'order cancelled by ' || CASE WHEN v_is_admin THEN 'admin' ELSE 'owner' END,
    p_metadata := jsonb_build_object(
      'from_status', v_order.status,
      'order_mode', v_order.order_mode::text,
      'reason', COALESCE(NULLIF(trim(p_reason), ''), 'not specified')
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_number', p_order_number,
    'status', 'cancelled',
    'order_mode', v_order.order_mode::text,
    'previous_status', v_order.status::text,
    'capacity_released', v_order.delivery_round_id IS NOT NULL,
    'inventory_restored', v_order.status IN ('confirmed', 'preparing'),
    'note', CASE WHEN v_order.payment_status = 'paid'
                 THEN 'order was paid — refund via stripe-refund EF is an admin follow-up'
                 ELSE 'no payment captured' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order TO authenticated;

-- ============================================
-- 4. COMPAT SHIMS — old pre-order RPCs now delegate to the canonical domain
--    (signatures preserved; consumers keep working during Phase 2-5 migration)
-- ============================================

-- 4a. create_pre_order_with_items → canonical create_order_with_items(mode=PRE_ORDER)
CREATE OR REPLACE FUNCTION public.create_pre_order_with_items(
  p_product_id text,
  p_quantity integer DEFAULT 1,
  p_delivery_round_id text DEFAULT NULL,
  p_scheduled_date date DEFAULT NULL,
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT '',
  p_delivery_latitude numeric DEFAULT NULL,
  p_delivery_longitude numeric DEFAULT NULL,
  p_delivery_address text DEFAULT '',
  p_special_instructions text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid;
  v_items     jsonb;
  v_round_id  text;
  v_result    jsonb;
  v_today     date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_product_id IS NULL OR trim(p_product_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_PRODUCT';
  END IF;
  IF COALESCE(p_quantity, 0) < 1 THEN
    RAISE EXCEPTION 'ERR_QUANTITY_INVALID';
  END IF;
  IF p_scheduled_date IS NULL THEN
    RAISE EXCEPTION 'ERR_MISSING_SCHEDULED_DATE';
  END IF;
  IF p_scheduled_date <= v_today THEN
    RAISE EXCEPTION 'ERR_SCHEDULED_DATE_INVALID';
  END IF;

  -- guarantee the target date has active rounds (idempotent, bounded: max 3 rows/date)
  PERFORM public.ensure_rounds_for_date(p_scheduled_date);

  v_round_id := p_delivery_round_id;
  IF v_round_id IS NULL OR trim(v_round_id) = '' THEN
    SELECT r.id INTO v_round_id
      FROM public.delivery_rounds r
     WHERE r.scheduled_date = p_scheduled_date AND r.status = 'active'
     ORDER BY r.delivery_start LIMIT 1;
    IF v_round_id IS NULL THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;
  END IF;

  v_items := jsonb_build_array(jsonb_build_object(
    'product_id', p_product_id,
    'quantity', GREATEST(COALESCE(p_quantity, 1), 1)
  ));

  -- canonical authority (mode gate / cutoff / capacity / pricing / audit inside)
  v_result := public.create_order_with_items(
    p_items              => v_items,
    p_delivery_round_id  => v_round_id,
    p_delivery_method    => 'self_delivery',
    p_delivery_address   => COALESCE(p_delivery_address, ''),
    p_dropoff_latitude   => p_delivery_latitude,
    p_dropoff_longitude  => p_delivery_longitude,
    p_customer_name      => COALESCE(p_customer_name, ''),
    p_customer_phone     => COALESCE(p_customer_phone, ''),
    p_payment_method     => 'promptpay_qr',
    p_special_instructions => COALESCE(p_special_instructions, ''),
    p_promotion_code     => NULL,
    p_distance_km        => 0,
    p_order_mode         => 'PRE_ORDER',
    p_scheduled_date     => p_scheduled_date
  );

  -- legacy response shape compatibility (preOrderService expectations)
  RETURN jsonb_build_object(
    'id',               v_result->>'id',
    'order_number',     v_result->>'order_number',
    'status',           'pending',
    'customer_name',    COALESCE(p_customer_name, 'Guest'),
    'customer_phone',   COALESCE(p_customer_phone, ''),
    'product_id',       p_product_id,
    'quantity',         GREATEST(COALESCE(p_quantity, 1), 1),
    'unit_price',       (v_result->>'subtotal')::numeric / GREATEST(COALESCE(p_quantity, 1), 1),
    'total_amount',     (v_result->>'total_amount')::numeric,
    'delivery_round_id', v_round_id,
    'scheduled_date',   p_scheduled_date,
    'delivery_latitude',  p_delivery_latitude,
    'delivery_longitude', p_delivery_longitude,
    'delivery_address', COALESCE(p_delivery_address, ''),
    'special_instructions', COALESCE(p_special_instructions, ''),
    'customer_ref',     v_result->>'customer_ref',
    'created_at',       to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'canonical',        true
  );
END;
$$;

-- 4b. cancel_pre_order → canonical cancel_order (migrated rows) / legacy guard otherwise
CREATE OR REPLACE FUNCTION public.cancel_pre_order(p_order_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid;
  v_migrated text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT migrated_order_id INTO v_migrated
    FROM public.pre_orders WHERE order_number = p_order_number;
  IF v_migrated IS NOT NULL THEN
    -- canonical path (capacity + inventory + assignment + audit in one transaction)
    RETURN jsonb_build_object(
      'ok', true,
      'order_number', p_order_number,
      'status', 'cancelled',
      'canonical', true,
      'result', (SELECT public.cancel_order(p_order_number, 'pre-order cancel (migrated)'))
    );
  END IF;

  -- legacy compatibility path (archive table is frozen; only pre-migration rows could reach here)
  RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_pre_order_with_items FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_pre_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pre_order_with_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pre_order TO authenticated;

COMMIT;
-- ============================================
-- END OF MIGRATION 025
-- ============================================
