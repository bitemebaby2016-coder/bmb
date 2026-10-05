-- ============================================================
-- Migration 114 — FINAL CONFIGURATION CLOSURE (Owner APPROVED 2026-10-05)
-- สร้างโดย e2e/fcBuildMigration114.cjs จาก live defs ณ HEAD 619e805 (anchor-guarded)
-- FC-1 branch-scoped delivery_policy (business_settings.branch_id มีอยู่แล้ว — ไม่สร้าง key ใหม่)
-- FC-2 config load หลัง branch resolution
-- FC-3 branch radius canonical = branches.service_radius_km (มีอยู่แล้ว — ไม่ duplicate source)
-- FC-4 cutoff_hours จาก order_policy (default 2 = พฤติกรรมเดิม — ย้ายที่เก็บค่า ไม่ย้าย rule)
-- FC-5 Bite Drive enable/disable = delivery_policy.bite_drive_enabled (default true)
-- SEEDS: guarded merge เฉพาะ key ที่ยังไม่มี (ไม่ทับค่า Admin) + brands.theme_tokens.glass
-- RETIRE: delivery_policy.radius_km (precondition: 0 function consumers — e2e/fcAudit2.cjs)
-- NEW: admin_sync_legacy_pre_order (controlled admin path สำหรับ legacy archive row — ไม่ bypass canonical)
-- ============================================================
BEGIN;

-- ---- 1: create_order_with_items ----
CREATE OR REPLACE FUNCTION public.create_order_with_items(p_items jsonb, p_delivery_round_id text, p_delivery_method text DEFAULT 'self_delivery'::text, p_delivery_address text DEFAULT ''::text, p_dropoff_latitude numeric DEFAULT NULL::numeric, p_dropoff_longitude numeric DEFAULT NULL::numeric, p_customer_name text DEFAULT ''::text, p_customer_phone text DEFAULT ''::text, p_payment_method text DEFAULT 'promptpay_qr'::text, p_special_instructions text DEFAULT ''::text, p_promotion_code text DEFAULT NULL::text, p_distance_km numeric DEFAULT 0, p_order_mode text DEFAULT 'SAME_DAY'::text, p_scheduled_date date DEFAULT NULL::date, p_branch_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_dp_setting jsonb; v_radius numeric; v_radius_override numeric;
  v_promo public.promotions%ROWTYPE; v_ing_name text;
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now time := (now() AT TIME ZONE 'Asia/Bangkok')::time;
  v_resolved_branch_id text; v_resolved_tenant_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  v_mode := COALESCE(p_order_mode, 'SAME_DAY');
  IF v_mode NOT IN ('SAME_DAY', 'PRE_ORDER') THEN RAISE EXCEPTION 'ERR_INVALID_ORDER_MODE'; END IF;
  -- FC-1: config load MOVED below — รอ branch resolution เพื่อ branch-scoped policy
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'ERR_EMPTY_ORDER'; END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN RAISE EXCEPTION 'ERR_MISSING_ROUND'; END IF;
  IF p_payment_method NOT IN ('promptpay_qr', 'cash_on_delivery', 'credit_card') THEN RAISE EXCEPTION 'ERR_INVALID_PAYMENT_METHOD'; END IF;
  IF p_delivery_method NOT IN ('self_delivery', 'grab_rider', 'linemen_rider', 'foodpanda_rider') THEN RAISE EXCEPTION 'ERR_INVALID_DELIVERY_METHOD'; END IF;

  -- ===== TEN-07 BRANCH RESOLUTION (after auth, before round lock) =====
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

  -- ===== FC-1: branch-scoped delivery policy (tenant global default + branch override ผ่าน business_settings.branch_id) =====
  SELECT value INTO v_dp_setting FROM public.business_settings
   WHERE key = 'delivery_policy'
     AND (branch_id IS NULL OR branch_id = v_resolved_branch_id)
   ORDER BY (branch_id IS NULL) ASC
   LIMIT 1;
  IF v_dp_setting IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: business_settings.delivery_policy'; END IF;
  IF v_dp_setting->>'bite_drive_radius_km' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.bite_drive_radius_km'; END IF;
  IF v_dp_setting->>'allow_external_within_radius' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.allow_external_within_radius'; END IF;
  IF v_dp_setting->'external_methods_enabled' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.external_methods_enabled'; END IF;
  v_radius := (v_dp_setting->>'bite_drive_radius_km')::numeric;
  -- ===== FC-3: branch radius canonical = branches.service_radius_km (override เมื่อ > 0) =====
  IF v_resolved_branch_id IS NOT NULL THEN
    SELECT b.service_radius_km INTO v_radius_override FROM public.branches b WHERE b.id = v_resolved_branch_id;
    IF v_radius_override IS NOT NULL AND v_radius_override > 0 THEN v_radius := v_radius_override; END IF;
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
    CASE WHEN p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN v_distance ELSE NULL END,
    v_resolved_branch_id
  );

  IF p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_DELIVERY_COORDS'; END IF;
  DECLARE v_kitchen_loc jsonb; v_dist numeric; BEGIN
    IF v_resolved_branch_id IS NOT NULL THEN
      SELECT jsonb_build_object('latitude', b.kitchen_latitude, 'longitude', b.kitchen_longitude) INTO v_kitchen_loc FROM public.branches b WHERE b.id = v_resolved_branch_id LIMIT 1;
      IF v_kitchen_loc IS NULL OR v_kitchen_loc->>'latitude' IS NULL THEN v_kitchen_loc := public.kitchen_location(); END IF;
    ELSE v_kitchen_loc := public.kitchen_location(); END IF;
    v_dist := public.haversine_km((v_kitchen_loc->>'latitude')::numeric, (v_kitchen_loc->>'longitude')::numeric, p_dropoff_latitude, p_dropoff_longitude);
    IF v_delivery_method = 'self_delivery' AND NOT COALESCE((v_dp_setting->>'bite_drive_enabled')::boolean, true) THEN
      RAISE EXCEPTION 'ERR_BITE_DRIVE_DISABLED';
    END IF;
    IF v_dist > v_radius AND v_delivery_method = 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;

    IF v_dist <= v_radius AND v_delivery_method <> 'self_delivery' AND NOT (v_dp_setting->>'allow_external_within_radius')::boolean THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;

    IF v_delivery_method <> 'self_delivery' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_dp_setting->'external_methods_enabled') em WHERE em = v_delivery_method) THEN RAISE EXCEPTION 'ERR_EXTERNAL_METHOD_DISABLED: %', v_delivery_method; END IF;
    
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

  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, customer_ref, delivery_round_id, status, delivery_method, dropoff_detail, dropoff_latitude, dropoff_longitude, subtotal, delivery_fee, service_fee, discount_amount, tax_amount, total_amount, payment_status, payment_method, special_instructions, order_mode, scheduled_date)
  VALUES (v_order_id, v_order_number, v_uid::text, p_customer_name, p_customer_phone, v_uid, p_delivery_round_id, 'pending', v_delivery_method::delivery_method, COALESCE(p_delivery_address, ''), p_dropoff_latitude, p_dropoff_longitude, v_subtotal, v_delivery_fee, v_service_fee, v_discount, v_tax, v_total, 'pending', p_payment_method::payment_method, COALESCE(p_special_instructions, ''), v_mode::order_mode, v_round_date);


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

  PERFORM public.append_audit_log(p_action := 'order_created', p_entity_type := 'order', p_entity_id := v_order_number,
    p_description := 'canonical order created (' || v_mode || ')' || CASE WHEN v_resolved_branch_id IS NOT NULL THEN ' [branch: ' || v_resolved_branch_id || ']' ELSE '' END,
    p_metadata := jsonb_build_object('order_mode', v_mode, 'scheduled_date', v_round_date, 'total', v_total, 'branch_id', v_resolved_branch_id));

  RETURN jsonb_build_object(
    'id', v_order_id, 'order_number', v_order_number, 'status', 'pending', 'order_mode', v_mode,
    'scheduled_date', v_round_date, 'subtotal', v_subtotal, 'discount_amount', v_discount,
    'delivery_fee', v_delivery_fee, 'service_fee', v_service_fee, 'tax_amount', v_tax,
    'total_amount', v_total, 'payment_status', 'pending', 'payment_method', p_payment_method,
    'delivery_round_id', p_delivery_round_id, 'customer_ref', v_uid::text, 'branch_id', v_resolved_branch_id
  );
END;
$function$
;
-- ---- 4: enforce_pre_order_window ----
CREATE OR REPLACE FUNCTION public.enforce_pre_order_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today     date;
  v_now_ts    timestamp;
  v_max_days  integer;
  v_start     time;
  v_cutoff_ts timestamp;
  v_cutoff_hours numeric;
BEGIN
  IF NEW.order_mode::text <> 'PRE_ORDER' THEN
    RETURN NEW;
  END IF;

  v_today  := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now_ts := (now() AT TIME ZONE 'Asia/Bangkok')::timestamp;

  -- scheduled_date must be strictly future (today/past pre-orders rejected)
  IF NEW.scheduled_date IS NULL OR NEW.scheduled_date <= v_today THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_DATE_INVALID';
  END IF;

  -- owner decision Q1: max window (business_settings, default 40)
  v_max_days := COALESCE(public.order_setting('preorder_max_days', 40), 40);
  IF (NEW.scheduled_date - v_today) > v_max_days THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_DATE_TOO_FAR: max % days ahead', v_max_days;
  END IF;

  -- owner decision Q1 cutoff: closes 2h before the round's delivery_start
  SELECT COALESCE(delivery_start, cutoff_time) INTO v_start
    FROM public.delivery_rounds
   WHERE id = NEW.delivery_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;
  IF v_start IS NULL THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
  END IF;

  -- FC-4: cutoff ชม. จาก order_policy.cutoff_hours (default 2 = พฤติกรรมเดิม)
  v_cutoff_hours := COALESCE(public.order_setting('cutoff_hours', 2), 2);
  v_cutoff_ts := NEW.scheduled_date::timestamp + v_start - (v_cutoff_hours * interval '1 hour');
  IF v_now_ts > v_cutoff_ts THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_PASSED: closes %', v_cutoff_ts;
  END IF;

  RETURN NEW;
END;
$function$
;
-- ---- 5: enforce_pre_order_cancel_window ----
CREATE OR REPLACE FUNCTION public.enforce_pre_order_cancel_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start     time;
  v_cutoff_ts timestamp;
  v_cutoff_hours numeric;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
     AND OLD.order_mode::text = 'PRE_ORDER' THEN

    SELECT COALESCE(delivery_start, cutoff_time) INTO v_start
      FROM public.delivery_rounds
     WHERE id = OLD.delivery_round_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;

    IF v_start IS NULL THEN
      RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
    END IF;

    -- FC-4: cutoff ชม. จาก order_policy.cutoff_hours (default 2 = พฤติกรรมเดิม)
  v_cutoff_hours := COALESCE(public.order_setting('cutoff_hours', 2), 2);
  v_cutoff_ts := OLD.scheduled_date::timestamp + v_start - (v_cutoff_hours * interval '1 hour');
    IF (now() AT TIME ZONE 'Asia/Bangkok')::timestamp > v_cutoff_ts THEN
      RAISE EXCEPTION 'ERR_CANCEL_AFTER_CUTOFF: closed at %', v_cutoff_ts;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;
-- ---- 6: fee ใหม่ (branch-aware) ----
CREATE OR REPLACE FUNCTION public.compute_delivery_fee(p_dropoff_latitude numeric, p_dropoff_longitude numeric, p_delivery_method text DEFAULT 'self_delivery'::text, p_items_count integer DEFAULT 1, p_distance_km numeric DEFAULT NULL::numeric, p_branch_id text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dist    numeric;
  v_fee     numeric;
  v_kitchen jsonb;
  v_dp jsonb;
  v_method  text := COALESCE(p_delivery_method, 'self_delivery');
  v_radius  numeric;
  v_br      numeric;
BEGIN
  -- W-1.4: config from DB (no hardcode)
  SELECT value INTO v_dp FROM public.business_settings WHERE key = 'delivery_policy';
  IF v_dp IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: business_settings.delivery_policy'; END IF;
  IF v_dp->>'bite_drive_radius_km' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.bite_drive_radius_km'; END IF;
  v_radius := (v_dp->>'bite_drive_radius_km')::numeric;
  -- FC-3: branch-specific radius canonical (branches.service_radius_km) เมื่อมี branch context
  IF p_branch_id IS NOT NULL THEN
    SELECT b.service_radius_km INTO v_br FROM public.branches b WHERE b.id = p_branch_id;
    IF v_br IS NOT NULL AND v_br > 0 THEN v_radius := v_br; END IF;
  END IF;

  IF p_distance_km IS NOT NULL AND p_distance_km > 0 THEN
    v_dist := p_distance_km;
  ELSIF p_dropoff_latitude IS NOT NULL AND p_dropoff_longitude IS NOT NULL THEN
    v_kitchen := public.kitchen_location();
    v_dist := public.haversine_km(
      (v_kitchen->>'latitude')::numeric, (v_kitchen->>'longitude')::numeric,
      p_dropoff_latitude, p_dropoff_longitude
    );
  ELSE
    v_dist := 0;
  END IF;

  -- server-side self-delivery radius gate (canonical = branch override > delivery_policy)
  IF v_method = 'self_delivery' AND v_dist > v_radius THEN
    RAISE EXCEPTION 'SELF_DELIVERY_EXCEEDS_5KM_LIMIT: % km > configured radius % km', v_dist, v_radius;
  END IF;

  SELECT fee INTO v_fee
    FROM public.delivery_zones
   WHERE is_active = true
     AND (p_branch_id IS NULL OR branch_id = p_branch_id OR branch_id IS NULL)
     AND v_dist >= min_distance_km
     AND v_dist <= max_distance_km
   ORDER BY (branch_id IS NULL) ASC, max_distance_km ASC
   LIMIT 1;

  IF v_fee IS NOT NULL THEN
    RETURN v_fee;
  END IF;

  -- W-1.4: no silent hardcode fallback — admin must cover distance with an active zone
  RAISE EXCEPTION 'ERR_NO_DELIVERY_ZONE: no active delivery_zone covers % km (admin: adjust delivery_zones)', v_dist;
  END;
$function$;
-- ---- 7: wrapper passthrough ----
CREATE OR REPLACE FUNCTION public.compute_delivery_fee_rpc(p_dropoff_latitude numeric DEFAULT NULL::numeric, p_dropoff_longitude numeric DEFAULT NULL::numeric, p_delivery_method text DEFAULT 'self_delivery'::text, p_items_count integer DEFAULT 1, p_distance_km numeric DEFAULT NULL::numeric, p_branch_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  RETURN jsonb_build_object(
    'delivery_fee', public.compute_delivery_fee(p_dropoff_latitude, p_dropoff_longitude, p_delivery_method, p_items_count, p_distance_km, p_branch_id),
    'method', COALESCE(p_delivery_method, 'self_delivery')
  );
END;
$function$;
-- ---- 8: drop signature เก่า (หลังสร้างใหม่ — callers rebind ด้วย default p_branch_id) ----
DROP FUNCTION IF EXISTS public.compute_delivery_fee(numeric, numeric, text, integer, numeric);
DROP FUNCTION IF EXISTS public.compute_delivery_fee_rpc(numeric, numeric, text, integer, numeric);
-- ---- 9: controlled legacy sync path ----
CREATE OR REPLACE FUNCTION public.admin_sync_legacy_pre_order(p_order_number text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role    text;
  v_legacy  public.pre_orders%ROWTYPE;
  v_status  text;
BEGIN
  -- controlled admin path (PART5): sync legacy archive row FROM canonical authority
  -- gate: platform/tenant admin (authenticated JWT) หรือ trusted role (service/postgres)
  v_role := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', current_user);
  IF v_role NOT IN ('service_role', 'postgres') THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_NOT_ADMIN'; END IF;
  END IF;

  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN RAISE EXCEPTION 'ERR_MISSING_ORDER'; END IF;

  SELECT * INTO v_legacy FROM public.pre_orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND: %', p_order_number; END IF;
  IF v_legacy.migrated_order_id IS NULL THEN
    RAISE EXCEPTION 'ERR_NOT_MIGRATED: legacy-only rows go through cancel_pre_order';
  END IF;
  IF v_legacy.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'order_number', p_order_number,
      'legacy_status', v_legacy.status, 'synced', false, 'note', 'already terminal');
  END IF;

  SELECT o.status INTO v_status
    FROM public.orders o WHERE o.id = v_legacy.migrated_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'ERR_CANONICAL_MISSING: %', v_legacy.migrated_order_id; END IF;
  IF v_status NOT IN ('cancelled', 'delivered', 'refunded') THEN
    RAISE EXCEPTION 'ERR_CANONICAL_NOT_TERMINAL: canonical=% (use cancel_order first)', v_status;
  END IF;

  UPDATE public.pre_orders
     SET status = v_status,
         cancelled_at = CASE WHEN v_status = 'cancelled'
                             THEN COALESCE(v_legacy.cancelled_at, now()) END,
         updated_at = now()
   WHERE id = v_legacy.id;

  PERFORM public.append_audit_log(p_action := 'legacy_pre_order_synced', p_entity_type := 'pre_order',
    p_entity_id := p_order_number,
    p_description := 'legacy archive row synced from canonical authority (controlled admin path)',
    p_metadata := jsonb_build_object('canonical_status', v_status, 'from', 'pending'));

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number,
    'legacy_status', v_status, 'synced', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_sync_legacy_pre_order(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sync_legacy_pre_order(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.compute_delivery_fee(numeric, numeric, text, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_delivery_fee(numeric, numeric, text, integer, numeric, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.compute_delivery_fee_rpc(numeric, numeric, text, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_delivery_fee_rpc(numeric, numeric, text, integer, numeric, text) TO authenticated, service_role;
-- ---- 10: guarded seeds (merge เฉพาะ key ที่ขาด — ไม่ทับค่า Admin) ----
UPDATE public.business_settings
   SET value = value || CASE WHEN NOT (value ? 'bite_drive_enabled') THEN '{"bite_drive_enabled":true}'::jsonb ELSE '{}'::jsonb END
                            || CASE WHEN NOT (value ? 'tier2_markup_pct') THEN '{"tier2_markup_pct":12}'::jsonb ELSE '{}'::jsonb END
                            || CASE WHEN NOT (value ? 'free_shipping_threshold') THEN '{"free_shipping_threshold":300}'::jsonb ELSE '{}'::jsonb END,
       updated_at = now()
 WHERE key = 'delivery_policy';
UPDATE public.business_settings
   SET value = value || CASE WHEN NOT (value ? 'cutoff_hours') THEN '{"cutoff_hours":2}'::jsonb ELSE '{}'::jsonb END
                            || CASE WHEN NOT (value ? 'daily_quota') THEN '{"daily_quota":120}'::jsonb ELSE '{}'::jsonb END,
       updated_at = now()
 WHERE key = 'order_policy';
UPDATE public.brands
   SET theme_tokens = theme_tokens || CASE WHEN NOT (theme_tokens ? 'glass')
     THEN '{"glass":{"bg":"rgba(255,255,255,0.7)","blur":"12px","border":"rgba(255,255,255,0.2)","text":"#1f2937","shadow":"drop-shadow(0 15px 12px rgba(0,0,0,0.18))"}}'::jsonb
     ELSE '{}'::jsonb END,
       updated_at = now()
 WHERE id = (SELECT id FROM public.brands WHERE is_default ORDER BY created_at LIMIT 1);
-- ---- 11: retire legacy dead key (precondition = 0 function consumers ยืนยันโดย e2e/fcAudit2.cjs) ----
UPDATE public.business_settings
   SET value = value - 'radius_km', updated_at = now()
 WHERE key = 'delivery_policy' AND value ? 'radius_km';

COMMIT;
