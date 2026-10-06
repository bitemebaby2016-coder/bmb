-- ============================================
-- Bite Me Baby — Migration 117: channel-intake repair (single 18-param signature)
-- Owner approval: PENDING (migration ต้องได้ Owner approve ก่อน apply)
--
-- Defect (intakeDriftProbe 2026-10-06, READ-ONLY on production):
--   Production public.create_order_with_items = 15-param signature ending
--   p_branch_id (from 089, which re-created the entry AFTER 048/049 and
--   clobbered the 048 trusted-channel wrapper). Consequences:
--     · channel-webhook EF calls it with p_source_channel / p_external_ref_id /
--       p_customer_ref → params no longer accepted by the entry RPC
--     · no RPC-level channel tagging (trigger stamps only PWA/MANUAL)
--     · no RPC-level external-event duplicate guard
--     · service-role trusted intake path (p_customer_ref) is dead
--   Verified intact: create_order_with_items_core (048/104 shape),
--   trg_orders_stamp_source_channel, uq_orders_channel_extref, columns.
--
-- Fix (single-signature policy — no overload → no PGRST203):
--   ONE public signature = 089's 15 params (branch) + p_source_channel +
--   p_external_ref_id + p_customer_ref (defaults NULL — legacy callers
--   unaffected). Body = 089 verbatim + 048 channel semantics:
--     · auth: auth.uid() OR (service_role AND p_customer_ref)
--     · authenticated callers may not impersonate another customer_ref
--     · channel regex ^[A-Z][A-Z0-9_]{2,31}$ · external_ref ≤ 128 chars
--     · early duplicate return (one external event = one canonical order)
--     · post-insert tag + unique_violation recovery + duplicate cleanup
--     · audit metadata extended with channel fields
--
-- Reversible: re-create the 089 15-param entry (body in migrations/089).
-- ============================================

BEGIN;

-- Defensive: drop the existing 15-param entry (single-signature replace)
DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT proname, proargtypes FROM pg_proc WHERE proname = 'create_order_with_items' AND pronamespace = 'public'::regnamespace)
  LOOP
    IF r.proargtypes IS NOT NULL AND array_length(r.proargtypes, 1) > 0 THEN
      EXECUTE format(
        'DROP FUNCTION IF EXISTS public.%I(%s)',
        r.proname,
        (SELECT string_agg(oid::regtype::text, ', ') FROM unnest(r.proargtypes) AS t(oid))
      );
    ELSE
      EXECUTE format('DROP FUNCTION IF EXISTS public.%I()', r.proname);
    END IF;
  END LOOP;
END $drop$;

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
  p_scheduled_date date DEFAULT NULL,
  p_branch_id text DEFAULT NULL,
  p_source_channel text DEFAULT NULL,
  p_external_ref_id text DEFAULT NULL,
  p_customer_ref uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid; v_order_id text; v_order_number text; v_order_exists boolean;
  v_attempt integer := 0; v_mode text; v_item_row record; v_pid text;
  v_qty integer; v_unit_price numeric; v_addon_price numeric; v_item_sub numeric;
  v_subtotal numeric := 0; v_discount numeric := 0; v_delivery_fee numeric := 0;
  v_service_fee numeric := 0; v_tax numeric := 0; v_total numeric := 0;
  v_items_total_qty integer := 0; v_round_status text; v_max_cap integer;
  v_cur_count integer; v_round_date date; v_round_cutoff time;
  v_prod_is_avail boolean; v_prod_same_day boolean; v_prod_preorder boolean;
  v_prod_name text; v_delivery_method text; v_distance numeric;
  v_promo public.promotions%ROWTYPE; v_ing_name text;
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now time := (now() AT TIME ZONE 'Asia/Bangkok')::time;
  v_resolved_branch_id text; v_resolved_tenant_id text;
  -- channel intake (048 semantics)
  v_channel text; v_ext_ref text; v_existing record;
BEGIN
  -- ===== 1. AUTHENTICATION (048 trusted-channel semantics) =====
  -- service-role trusted intake (channel adapters): explicit customer required;
  -- auth.uid() callers unaffected (p_customer_ref must be NULL or self).
  v_uid := COALESCE(auth.uid(), p_customer_ref);
  IF v_uid IS NULL OR (auth.uid() IS NULL AND NOT COALESCE(public.has_service_role(), false)) THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF auth.uid() IS NOT NULL AND p_customer_ref IS NOT NULL AND p_customer_ref <> auth.uid() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_CUSTOMER_REF';
  END IF;

  -- ===== 2. CHANNEL INPUT VALIDATION (048) =====
  v_channel := NULLIF(trim(COALESCE(p_source_channel, '')), '');
  IF v_channel IS NOT NULL THEN
    v_channel := upper(v_channel);
    IF v_channel !~ '^[A-Z][A-Z0-9_]{2,31}$' THEN
      RAISE EXCEPTION 'ERR_INVALID_SOURCE_CHANNEL';
    END IF;
  END IF;
  v_ext_ref := NULLIF(trim(COALESCE(p_external_ref_id, '')), '');
  IF v_ext_ref IS NOT NULL AND length(v_ext_ref) > 128 THEN
    RAISE EXCEPTION 'ERR_INVALID_EXTERNAL_REF';
  END IF;

  -- ===== 2.5 DURABLE DUPLICATE GUARD — one external event = one canonical order =====
  IF v_ext_ref IS NOT NULL THEN
    SELECT order_number, id INTO v_existing
      FROM public.orders
     WHERE source_channel = v_channel
       AND external_ref_id = v_ext_ref
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'order_number', v_existing.order_number,
        'duplicate', true,
        'source_channel', v_channel,
        'external_ref_id', v_ext_ref
      );
    END IF;
  END IF;

  -- ===== 3. ORDER MODE + INPUT (089 verbatim) =====
  v_mode := COALESCE(p_order_mode, 'SAME_DAY');
  IF v_mode NOT IN ('SAME_DAY', 'PRE_ORDER') THEN RAISE EXCEPTION 'ERR_INVALID_ORDER_MODE'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'ERR_EMPTY_ORDER'; END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN RAISE EXCEPTION 'ERR_MISSING_ROUND'; END IF;
  IF p_payment_method NOT IN ('promptpay_qr', 'cash_on_delivery', 'credit_card') THEN RAISE EXCEPTION 'ERR_INVALID_PAYMENT_METHOD'; END IF;
  IF p_delivery_method NOT IN ('self_delivery', 'grab_rider', 'linemen_rider', 'foodpanda_rider') THEN RAISE EXCEPTION 'ERR_INVALID_DELIVERY_METHOD'; END IF;

  -- ===== TEN-07 BRANCH RESOLUTION (089 verbatim) =====
  IF p_branch_id IS NOT NULL AND trim(p_branch_id) <> '' THEN
    SELECT b.id, b.tenant_id INTO v_resolved_branch_id, v_resolved_tenant_id
      FROM public.branches b WHERE b.id = p_branch_id AND b.status = 'active' LIMIT 1;
    IF v_resolved_branch_id IS NULL THEN RAISE EXCEPTION 'ERR_BRANCH_NOT_FOUND: %', p_branch_id; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds r WHERE r.id = p_delivery_round_id AND r.branch_id = v_resolved_branch_id) THEN
      RAISE EXCEPTION 'ERR_ROUND_BRANCH_MISMATCH: Round % not in branch %', p_delivery_round_id, v_resolved_branch_id;
    END IF;
  ELSE
    SELECT r.branch_id, r.tenant_id INTO v_resolved_branch_id, v_resolved_tenant_id
      FROM public.delivery_rounds r WHERE r.id = p_delivery_round_id LIMIT 1;
  END IF;

  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff
    FROM public.delivery_rounds WHERE id = p_delivery_round_id FOR UPDATE;
  IF v_round_status IS NULL THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;
  IF v_round_status <> 'active' THEN RAISE EXCEPTION 'ERR_ROUND_CLOSED'; END IF;

  IF v_mode = 'SAME_DAY' THEN
    IF v_round_date IS NULL OR v_round_date <> v_today THEN RAISE EXCEPTION 'ERR_ROUND_DATE'; END IF;
    IF v_now > v_round_cutoff THEN RAISE EXCEPTION 'ERR_CUTOFF_PASSED'; END IF;
    IF p_scheduled_date IS NOT NULL AND p_scheduled_date <> v_round_date THEN RAISE EXCEPTION 'ERR_ROUND_DATE'; END IF;
  ELSE
    IF p_scheduled_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_SCHEDULED_DATE'; END IF;
    IF p_scheduled_date <= v_today THEN RAISE EXCEPTION 'ERR_SCHEDULED_DATE_INVALID'; END IF;
    IF p_scheduled_date <> v_round_date THEN RAISE EXCEPTION 'ERR_ROUND_DATE_MISMATCH'; END IF;
    IF (p_scheduled_date - v_today) < public.order_setting('pre_order_lead_days', 1) THEN RAISE EXCEPTION 'ERR_LEAD_TIME'; END IF;
  END IF;

  IF (COALESCE(v_cur_count, 0) + 1) > v_max_cap THEN RAISE EXCEPTION 'ERR_CAPACITY_FULL'; END IF;

  FOR v_item_row IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id text, quantity integer, options jsonb, special_request text)
  LOOP
    v_pid := v_item_row.product_id; v_qty := COALESCE(v_item_row.quantity, 0);
    IF v_pid IS NULL OR trim(v_pid) = '' THEN RAISE EXCEPTION 'ERR_MISSING_PRODUCT_ID'; END IF;
    IF v_qty <= 0 OR v_qty > 1000 THEN RAISE EXCEPTION 'ERR_INVALID_QUANTITY'; END IF;
    SELECT price, is_available, available_same_day, available_preorder, name INTO v_unit_price, v_prod_is_avail, v_prod_same_day, v_prod_preorder, v_prod_name FROM public.products WHERE id = v_pid FOR UPDATE;
    IF v_unit_price IS NULL THEN RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND'; END IF;
    IF NOT COALESCE(v_prod_is_avail, false) THEN RAISE EXCEPTION 'ERR_PRODUCT_UNAVAILABLE'; END IF;
    IF v_mode = 'SAME_DAY' AND NOT COALESCE(v_prod_same_day, false) THEN RAISE EXCEPTION 'ERR_PRODUCT_MODE_NOT_ALLOWED'; END IF;
    IF v_mode = 'PRE_ORDER' AND NOT COALESCE(v_prod_preorder, false) THEN RAISE EXCEPTION 'ERR_PRODUCT_MODE_NOT_ALLOWED'; END IF;
    v_addon_price := public.compute_addons_price(v_pid, v_item_row.options);
    v_item_sub := v_qty * (v_unit_price + COALESCE(v_addon_price, 0));
    v_subtotal := v_subtotal + v_item_sub; v_items_total_qty := v_items_total_qty + v_qty;
  END LOOP;

  IF v_items_total_qty > public.order_setting('max_items_per_order', 20) THEN RAISE EXCEPTION 'ERR_QTY_LIMIT'; END IF;

  IF v_mode = 'SAME_DAY' THEN
    SELECT i.name INTO v_ing_name FROM (SELECT r.ingredient_id, SUM(v.qty * r.quantity_per_unit) AS req FROM (SELECT j.product_id, COALESCE(j.quantity, 1) AS qty FROM jsonb_to_recordset(p_items) AS j(product_id text, quantity integer) WHERE j.product_id IS NOT NULL) v JOIN public.recipes r ON r.product_id = v.product_id GROUP BY r.ingredient_id) need JOIN public.inventory i ON i.id = need.ingredient_id WHERE i.current_stock < need.req LIMIT 1;
    IF v_ing_name IS NOT NULL THEN RAISE EXCEPTION 'ERR_INSUFFICIENT_INGREDIENT: %', v_ing_name; END IF;
  END IF;

  IF p_promotion_code IS NOT NULL AND trim(p_promotion_code) <> '' THEN
    SELECT * INTO v_promo FROM public.promotions WHERE upper(code) = upper(trim(p_promotion_code)) AND is_active = true AND (start_date IS NULL OR start_date <= CURRENT_DATE) AND (end_date IS NULL OR end_date >= CURRENT_DATE) LIMIT 1;
    IF FOUND THEN
      IF v_subtotal >= COALESCE(v_promo.min_order_amount, 0) THEN
        IF v_promo.discount_type = 'percentage' THEN v_discount := LEAST(v_subtotal * COALESCE(v_promo.discount_value, 0) / 100, v_subtotal);
        ELSIF v_promo.discount_type = 'fixed_amount' THEN v_discount := LEAST(COALESCE(v_promo.discount_value, 0), v_subtotal); END IF;
      END IF;
    END IF;
  END IF;

  v_delivery_method := p_delivery_method;
  v_distance := COALESCE(p_distance_km, 0);
  v_delivery_fee := public.compute_delivery_fee(
    p_dropoff_latitude, p_dropoff_longitude,
    v_delivery_method, v_items_total_qty,
    CASE WHEN p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN v_distance ELSE NULL END
  );

  IF p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_DELIVERY_COORDS'; END IF;
  DECLARE v_kitchen_loc jsonb; v_dist numeric; BEGIN
    IF v_resolved_branch_id IS NOT NULL THEN
      SELECT jsonb_build_object('latitude', b.kitchen_latitude, 'longitude', b.kitchen_longitude) INTO v_kitchen_loc FROM public.branches b WHERE b.id = v_resolved_branch_id LIMIT 1;
      IF v_kitchen_loc IS NULL OR v_kitchen_loc->>'latitude' IS NULL THEN v_kitchen_loc := public.kitchen_location(); END IF;
    ELSE v_kitchen_loc := public.kitchen_location(); END IF;
    v_dist := public.haversine_km((v_kitchen_loc->>'latitude')::numeric, (v_kitchen_loc->>'longitude')::numeric, p_dropoff_latitude, p_dropoff_longitude);
    IF v_dist <= 5.00 AND v_delivery_method <> 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;
    IF v_dist > 5.00 AND v_delivery_method = 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;
  END;

  v_service_fee := 0; v_tax := 0;
  v_total := GREATEST(0, v_subtotal - v_discount + v_delivery_fee + v_service_fee + v_tax);

  LOOP
    v_attempt := v_attempt + 1;
    IF v_mode = 'PRE_ORDER' THEN
      v_order_number := 'PO-' || to_char(v_round_date, 'YYYYMMDD') || '-' || lpad((floor(random() * 900) + 100)::text, 3, '0');
    ELSE
      v_order_number := 'BMB-' || to_char(v_round_date, 'YYYYMMDD') || '-' || lpad((floor(random() * 900) + 100)::text, 3, '0');
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_order_number) INTO v_order_exists;
    EXIT WHEN NOT v_order_exists OR v_attempt >= 5;
  END LOOP;
  IF v_order_exists THEN RAISE EXCEPTION 'ERR_ORDER_NUMBER_EXHAUSTED'; END IF;
  v_order_id := 'ord-' || to_char(extract(epoch from clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, customer_ref, delivery_round_id, status, delivery_method, dropoff_detail, dropoff_latitude, dropoff_longitude, subtotal, delivery_fee, service_fee, discount_amount, tax_amount, total_amount, payment_status, payment_method, special_instructions, order_mode, scheduled_date, branch_id)
  VALUES (v_order_id, v_order_number, v_uid::text, p_customer_name, p_customer_phone, v_uid, p_delivery_round_id, 'pending', v_delivery_method::delivery_method, COALESCE(p_delivery_address, ''), p_dropoff_latitude, p_dropoff_longitude, v_subtotal, v_delivery_fee, v_service_fee, v_discount, v_tax, v_total, 'pending', p_payment_method::payment_method, COALESCE(p_special_instructions, ''), v_mode::order_mode, v_round_date, v_resolved_branch_id);

  DECLARE v_item_qty integer; v_item_pid text; v_item_options jsonb; v_item_special text; v_i integer := 0; BEGIN
    FOR v_item_row IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id text, quantity integer, options jsonb, special_request text)
    LOOP
      v_i := v_i + 1; v_item_qty := COALESCE(v_item_row.quantity, 1); v_item_pid := v_item_row.product_id;
      v_item_options := COALESCE(v_item_row.options, '{}'); v_item_special := COALESCE(v_item_row.special_request, '');
      SELECT price, name INTO v_unit_price, v_prod_name FROM public.products WHERE id = v_item_pid FOR UPDATE;
      v_item_options := jsonb_set(v_item_options, '{addOnTotal}', to_jsonb(public.compute_addons_price(v_item_pid, v_item_options)));
      INSERT INTO public.order_items (id, order_id, product_id, product_name, quantity, unit_price, customizations, special_request) VALUES ('oi-' || v_order_id || '-' || v_i, v_order_id, v_item_pid, v_prod_name, v_item_qty, v_unit_price, v_item_options, v_item_special);
    END LOOP;
  END;

  -- ===== 4. CHANNEL TAG (048/045 semantics — never overwrite trigger stamp on legacy calls) =====
  IF v_channel IS NOT NULL OR v_ext_ref IS NOT NULL THEN
    BEGIN
      UPDATE public.orders
         SET source_channel = v_channel,
             external_ref_id = v_ext_ref
       WHERE order_number = v_order_number;
    EXCEPTION
      WHEN unique_violation THEN
        -- concurrent duplicate external event: recover the existing canonical order
        SELECT order_number, id INTO v_existing
          FROM public.orders
         WHERE source_channel = v_channel
           AND external_ref_id = v_ext_ref
         LIMIT 1;
        -- the duplicate row created by this call must not remain (one event = one order)
        DELETE FROM public.orders
         WHERE order_number = v_order_number
           AND customer_ref = v_uid
           AND (v_ext_ref IS NULL OR external_ref_id = v_ext_ref);
        RETURN jsonb_build_object(
          'id', v_existing.id,
          'order_number', v_existing.order_number,
          'duplicate', true,
          'source_channel', v_channel,
          'external_ref_id', v_ext_ref
        );
    END;
  END IF;

  PERFORM public.append_audit_log(p_action := 'order_created', p_entity_type := 'order', p_entity_id := v_order_number,
    p_description := 'canonical order created (' || v_mode || ')' || CASE WHEN v_resolved_branch_id IS NOT NULL THEN ' [branch: ' || v_resolved_branch_id || ']'
      || CASE WHEN v_channel IS NOT NULL THEN ' [channel: ' || v_channel || ']' ELSE '' END ELSE '' END,
    p_metadata := jsonb_build_object('order_mode', v_mode, 'scheduled_date', v_round_date, 'total', v_total, 'branch_id', v_resolved_branch_id,
      'source_channel', v_channel, 'external_ref_id', v_ext_ref));

  RETURN jsonb_build_object(
    'id', v_order_id, 'order_number', v_order_number, 'status', 'pending', 'order_mode', v_mode,
    'scheduled_date', v_round_date, 'subtotal', v_subtotal, 'discount_amount', v_discount,
    'delivery_fee', v_delivery_fee, 'service_fee', v_service_fee, 'tax_amount', v_tax,
    'total_amount', v_total, 'payment_status', 'pending', 'payment_method', p_payment_method,
    'delivery_round_id', p_delivery_round_id, 'customer_ref', v_uid::text, 'branch_id', v_resolved_branch_id,
    'source_channel', v_channel, 'external_ref_id', v_ext_ref, 'duplicate', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_with_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;

COMMIT;