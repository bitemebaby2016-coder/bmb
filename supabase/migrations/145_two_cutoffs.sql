-- ============================================================
-- Migration 145 — คัทออฟ 2 ช่องทางบนรอบเดียว (same-day / pre-order)
-- Owner approval 2026-10-24 (handoff task 4: "อนุมัติทั้ง schema 2-คัทออฟ + บังคับกฎ >=2"):
--   "1 รอบ = ความจุก้อนเดียว แยก 2 คอลัมน์คัทออฟ ไม่สร้างตารางใหม่"
--   · same_day_cutoff   = คัทออฟเซมเดย์ของรอบนั้น (backfill = cutoff_time เดิม)
--   · pre_order_cutoff  = คัทออฟพรีออเดอร์ตั้งตรง (NULL = กฎเดิม
--                         delivery_start - order_policy.cutoff_hours)
--   · capacity/shared-slot ไม่เปลี่ยน — ทั้งสองโหมดใช้แถวรอบเดียวกันเหมือนเดิม
-- Contract changes (ตั้งใจ — ไม่ใช่ refactor):
--   145a) delivery_rounds +2 columns + backfill
--   145b) create_order_with_items: SAME_DAY = COALESCE(same_day_cutoff, cutoff_time)
--         · PRE_ORDER = pre_order_cutoff ถ้าตั้ง ไม่งั้นกฎเดิม 143 (gate 142 คงเดิม)
--   145c) enforce_pre_order_window (trigger): pre_order_cutoff ถ้าตั้ง ไม่งั้นกฎเดิม
--   145d) ensure_rounds_for_date: รอบใหม่รับค่าทั้งสองจาก order_pattern
--   145e) order_pattern เดิม +คีย์ same_day_cutoff/pre_order_cutoff (idempotent)
-- สร้างโดย e2e/m145Build.cjs (anchor-guarded จาก body 143 + 144)
-- สัญญาทดสอบ: e2e/contracts_145.sql (+ regression contracts_143/144)
-- Rollback: apply ใหม่ 143_pre_order_cutoff_settings.sql + 144_round_pattern.sql
--           (คอลัมน์เพิ่มเองไม่ยุ่งกับ key ใด ๆ — DROP COLUMN ถ้าต้องการ rollback จริง)
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_order_with_items(p_items jsonb, p_delivery_round_id text, p_delivery_method text DEFAULT 'self_delivery'::text, p_delivery_address text DEFAULT ''::text, p_dropoff_latitude numeric DEFAULT NULL::numeric, p_dropoff_longitude numeric DEFAULT NULL::numeric, p_customer_name text DEFAULT ''::text, p_customer_phone text DEFAULT ''::text, p_payment_method text DEFAULT 'promptpay_qr'::text, p_special_instructions text DEFAULT ''::text, p_promotion_code text DEFAULT NULL::text, p_distance_km numeric DEFAULT 0, p_order_mode text DEFAULT 'SAME_DAY'::text, p_scheduled_date date DEFAULT NULL::date, p_branch_id text DEFAULT NULL::text, p_source_channel text DEFAULT NULL::text, p_external_ref_id text DEFAULT NULL::text, p_customer_ref uuid DEFAULT NULL::uuid)
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
  v_cur_count integer; v_round_date date; v_round_cutoff time; v_round_start time;
  v_same_day_cutoff time; v_pre_order_cutoff time;
  v_prod_is_avail boolean; v_prod_same_day boolean; v_prod_preorder boolean;
  v_prod_name text; v_delivery_method text; v_distance numeric;
  v_promo public.promotions%ROWTYPE; v_ing_name text;
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now time := (now() AT TIME ZONE 'Asia/Bangkok')::time;
  v_resolved_branch_id text; v_resolved_tenant_id text;
  v_dp_setting jsonb; v_radius numeric; v_radius_override numeric;
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

  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time, delivery_start,
         same_day_cutoff, pre_order_cutoff
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff, v_round_start,
         v_same_day_cutoff, v_pre_order_cutoff
    FROM public.delivery_rounds WHERE id = p_delivery_round_id FOR UPDATE;
  IF v_round_status IS NULL THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;
  IF v_round_status <> 'active' THEN RAISE EXCEPTION 'ERR_ROUND_CLOSED'; END IF;

  IF v_mode = 'SAME_DAY' THEN
    IF v_round_date IS NULL OR v_round_date <> v_today THEN RAISE EXCEPTION 'ERR_ROUND_DATE'; END IF;
    -- 145: เซมเดย์ใช้ same_day_cutoff ของรอบ (แยกจากพรีออเดอร์) — ไม่มีค่า = cutoff_time เดิม
    IF v_now > COALESCE(v_same_day_cutoff, v_round_cutoff) THEN RAISE EXCEPTION 'ERR_CUTOFF_PASSED'; END IF;
    IF p_scheduled_date IS NOT NULL AND p_scheduled_date <> v_round_date THEN RAISE EXCEPTION 'ERR_ROUND_DATE'; END IF;
  ELSE
    IF p_scheduled_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_SCHEDULED_DATE'; END IF;
    IF p_scheduled_date < v_today THEN RAISE EXCEPTION 'ERR_SCHEDULED_DATE_INVALID'; END IF;
    IF p_scheduled_date <> v_round_date THEN RAISE EXCEPTION 'ERR_ROUND_DATE_MISMATCH'; END IF;
    -- 143 (Owner Q1 + 2026-10-24): พรีออเดอร์วันนี้ได้จนถึงคัทออฟ — คัทออฟ = cutoff_hours ชม.
    --   ก่อน delivery_start (mirror ของ enforce_pre_order_window / FC-4 availability)
    --   · ยกเลิก ERR_LEAD_TIME (pre_order_lead_days เดิม) — คัทออฟคุมแทน ตั้งค่าได้จากแอดมิน
    --   · เมนู/ตะกร้า gate 142 ด้านล่างคงเดิมทุกประการ
    -- 145: แอดมินตั้ง pre_order_cutoff ของรอบได้เอง (แยกจากเซมเดย์) — ไม่มีค่า = กฎเดิม
    IF v_pre_order_cutoff IS NOT NULL THEN
      IF (now() at time zone 'Asia/Bangkok') > (p_scheduled_date + v_pre_order_cutoff) THEN
        RAISE EXCEPTION 'ERR_CUTOFF_PASSED';
      END IF;
    ELSE
      IF v_round_start IS NULL AND v_round_cutoff IS NULL THEN
        RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
      END IF;
      IF (now() at time zone 'Asia/Bangkok')
         > ((p_scheduled_date + COALESCE(v_round_start, v_round_cutoff))
            - (COALESCE(public.order_setting('cutoff_hours', 2), 2) * interval '1 hour')) THEN
        RAISE EXCEPTION 'ERR_CUTOFF_PASSED';
      END IF;
    END IF;
    -- R5c/142: PRE_ORDER ต้องมี >=1 เมนูจากปฏิทินของวันนั้น (published, ยังไม่ผ่านรอบจัดส่ง)
    --   · ตะกร้าไม่มีเมนูปฏิทินเลย = ERR_PRE_ORDER_REQUIRES_MENU (ปิดช่องยิง API เลือกวันอิสระ)
    --   · มีเมนูผูกวันแต่คนละวัน = ERR_PRODUCT_NOT_ON_MENU (§5-C เดิม — enforce_menu_gate สำทับรายสินค้า)
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_items) AS x(product_id text, quantity integer, options jsonb, special_request text)
      JOIN public.menu_schedule ms ON ms.product_id = x.product_id
       AND ms.is_published = true
       AND ms.scheduled_date = p_scheduled_date
       AND ms.scheduled_date >= v_today
    ) THEN
      IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_items) AS x(product_id text, quantity integer, options jsonb, special_request text)
        JOIN public.menu_schedule ms ON ms.product_id = x.product_id
         AND ms.is_published = true
         AND ms.scheduled_date >= v_today
      ) THEN
        RAISE EXCEPTION 'ERR_PRODUCT_NOT_ON_MENU: no cart item matches menu date %', p_scheduled_date::text;
      END IF;
      RAISE EXCEPTION 'ERR_PRE_ORDER_REQUIRES_MENU';
    END IF;
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
    -- R5/141 C1: ยกเลิก gate PRE_ORDER x available_preorder — สินค้าทั่วไปสั่งพรีออเดอร์/ส่งร่วมรอบเดียวกับเมนูพรีออเดอร์ได้
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
$function$
;
REVOKE EXECUTE ON FUNCTION public.create_order_with_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;


-- ============================================
-- 4A v141 (C2/C3): enforce_menu_gate — เมนูรอบพิเศษผูก "วัน/รอบ" เฉพาะสินค้าในเมนู
--   · สินค้าทั่วไป (ไม่มีเมนูผูกวัน) → ผ่านเสมอ (ส่งร่วมรอบเดียวกับเมนูพรีออเดอร์ได้)
--   · สินค้าที่มีเมนูผูกวัน (published, ยังไม่ผ่านรอบจัดส่ง) → ต้องตรงวันที่
--     และรอบที่เมนูกำหนด (delivery_round_key NULL/'' = ทุกรอบ)
--   · แถวเมนูที่ผ่านรอบจัดส่งแล้ว (scheduled_date < วันนี้) = archived — ไม่ผูกมัด
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_menu_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode      text;
  v_scheduled date;
  v_round_id  text;
  v_today     date;
BEGIN
  SELECT o.order_mode::text, o.scheduled_date, o.delivery_round_id
    INTO v_mode, v_scheduled, v_round_id
    FROM public.orders o WHERE o.id = NEW.order_id;

  IF v_mode <> 'PRE_ORDER' OR v_scheduled IS NULL THEN RETURN NEW; END IF;

  v_today := (now() at time zone 'Asia/Bangkok')::date;

  -- binding เฉพาะแถว published ที่ยังไม่ผ่านรอบจัดส่ง (archived = ไม่ผูกมัด)
  IF EXISTS (SELECT 1 FROM public.menu_schedule ms
              WHERE ms.product_id = NEW.product_id
                AND ms.is_published = true
                AND ms.scheduled_date >= v_today) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.menu_schedule ms
       WHERE ms.product_id = NEW.product_id
         AND ms.is_published = true
         AND ms.scheduled_date = v_scheduled
         AND (ms.delivery_round_key IS NULL OR ms.delivery_round_key = ''
              OR ms.delivery_round_key = (SELECT COALESCE(round_key, name)
                    FROM public.delivery_rounds WHERE id = v_round_id))
    ) THEN
      RAISE EXCEPTION 'ERR_PRODUCT_NOT_ON_MENU: % not on menu for %', NEW.product_id, v_scheduled::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_menu_gate() FROM PUBLIC, anon, authenticated;

-- ============================================
-- 143 extra: harden order_setting (ค่าใน order_policy พัง = ใช้ default ไม่ crash)
--   (เดิม LANGUAGE sql cast ตรง ๆ — ค่า "มี7" ทำให้ทุกพรีออเดอร์พัง 22P02)
-- ============================================
DROP FUNCTION IF EXISTS public.order_setting(text, numeric);
CREATE OR REPLACE FUNCTION public.order_setting(p_field text, p_default numeric DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v numeric;
BEGIN
  BEGIN
    SELECT (bs.value ->> p_field)::numeric INTO v
      FROM public.business_settings bs
     WHERE bs.key = 'order_policy';
  EXCEPTION WHEN invalid_text_representation THEN
    v := NULL;
  END;
  RETURN COALESCE(v, p_default);
END $$;
REVOKE EXECUTE ON FUNCTION public.order_setting(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_setting(text, numeric) TO authenticated, service_role;

-- ============================================
-- 143 extra: enforce_pre_order_window — อนุญาตพรีออเดอร์ "วันนี้" (คัทออฟ cutoff_hours คุม)
--   เดิม: scheduled_date ต้อง strictly future (ERR_PRE_ORDER_DATE_INVALID) — ทำให้เมนู
--   ปฏิทินของวันนี้สั่งไม่ได้แม้ยังไม่ถึงคัทออฟ (Owner ทดสอบ 2026-10-24)
--   ใหม่: scheduled_date >= วันนี้ และ <= วันนี้ + preorder_max_days และก่อนคัทออฟ
--   (cutoff = COALESCE(delivery_start, cutoff_time) - cutoff_hours — Q1/FC-4 เดิมทุกตัวอักษร)
-- ============================================
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
  v_pre_cutoff    time;
BEGIN
  IF NEW.order_mode::text <> 'PRE_ORDER' THEN
    RETURN NEW;
  END IF;

  v_today  := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now_ts := (now() AT TIME ZONE 'Asia/Bangkok')::timestamp;

  -- 143: พรีออเดอร์วันนี้ได้จนถึงคัทออฟ (เดิม strictly future — ปิดช่องเมนูวันนี้โดยไม่ตั้งใจ)
  IF NEW.scheduled_date IS NULL OR NEW.scheduled_date < v_today THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_DATE_INVALID';
  END IF;

  -- owner decision Q1: max window (business_settings, default 40)
  v_max_days := COALESCE(public.order_setting('preorder_max_days', 40), 40);
  IF (NEW.scheduled_date - v_today) > v_max_days THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_DATE_TOO_FAR: max % days ahead', v_max_days;
  END IF;

  -- owner decision Q1 cutoff: closes cutoff_hours before the round's delivery_start
  SELECT COALESCE(delivery_start, cutoff_time), pre_order_cutoff INTO v_start, v_pre_cutoff
    FROM public.delivery_rounds
   WHERE id = NEW.delivery_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;
  IF v_start IS NULL THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
  END IF;

  v_cutoff_hours := COALESCE(public.order_setting('cutoff_hours', 2), 2);
  IF v_pre_cutoff IS NOT NULL THEN
    -- 145: pre_order_cutoff ตั้งตรง ๆ ของรอบ (แยกจากเซมเดย์)
    v_cutoff_ts := NEW.scheduled_date::timestamp + v_pre_cutoff;
  ELSE
    v_cutoff_ts := NEW.scheduled_date::timestamp + v_start - (v_cutoff_hours * interval '1 hour');
  END IF;
  IF v_now_ts > v_cutoff_ts THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_PASSED: closes %', v_cutoff_ts;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================
-- 143 data repair: order_policy ค่าไม่ใช่ตัวเลข (พิมพ์ผ่าน JSON ดิบ เช่น "มี7") -> default
-- ============================================
UPDATE public.business_settings
   SET value = jsonb_set(value, '{pre_order_lead_days}', '7'::jsonb, true),
       updated_at = now()
 WHERE key = 'order_policy'
   AND (value->>'pre_order_lead_days') IS NOT NULL
   AND NOT (value->>'pre_order_lead_days') ~ '^[0-9]+$';
UPDATE public.business_settings
   SET value = jsonb_set(value, '{cutoff_hours}', '2'::jsonb, true),
       updated_at = now()
 WHERE key = 'order_policy'
   AND (value->>'cutoff_hours') IS NOT NULL
   AND NOT (value->>'cutoff_hours') ~ '^[0-9]+(\.[0-9]+)?$';
UPDATE public.business_settings
   SET value = jsonb_set(value, '{preorder_max_days}', '50'::jsonb, true),
       updated_at = now()
 WHERE key = 'order_policy'
   AND (value->>'preorder_max_days') IS NOT NULL
   AND NOT (value->>'preorder_max_days') ~ '^[0-9]+$';


-- ---- 144a: seed order_pattern จากแถวเทมเพลตปัจจุบัน (ครั้งแรกครั้งเดียว) ----
INSERT INTO public.business_settings (key, value)
SELECT 'order_pattern', jsonb_build_object('rounds', (
  SELECT jsonb_agg(jsonb_build_object(
           'round_key', k,
           'display_name', COALESCE(t.display_name, k),
           'cutoff_time', to_char(t.cutoff_time, 'HH24:MI'),
           'delivery_start', to_char(t.delivery_start, 'HH24:MI'),
           'delivery_end', to_char(t.delivery_end, 'HH24:MI'),
           'max_capacity', COALESCE(t.max_capacity, 100)
         ) ORDER BY CASE k WHEN 'morning' THEN 1 WHEN 'midday' THEN 2 ELSE 3 END)
  FROM (VALUES ('morning'),('midday'),('evening')) AS keys(k)
  LEFT JOIN LATERAL (
    SELECT * FROM public.delivery_rounds
     WHERE COALESCE(round_key, name) = k
     ORDER BY scheduled_date DESC NULLS LAST, created_at DESC
     LIMIT 1
  ) t ON true))
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'order_pattern');

-- ---- 144b: ensure_rounds_for_date — template หลัก = order_pattern (fallback เดิม 024/113) ----
CREATE OR REPLACE FUNCTION public.ensure_rounds_for_date(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_key text;
  v_tpl public.delivery_rounds%ROWTYPE;
  v_pat jsonb;
  v_p jsonb;
  v_id text;
  v_branch text;
  v_rounds jsonb;
BEGIN
  IF p_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_DATE'; END IF;
  IF p_date < v_today THEN RAISE EXCEPTION 'ERR_DATE_IN_PAST'; END IF;
  IF p_date > v_today + 30 THEN RAISE EXCEPTION 'ERR_DATE_TOO_FAR'; END IF;

  SELECT bs.value INTO v_pat FROM public.business_settings bs WHERE bs.key = 'order_pattern';

  FOREACH v_key IN ARRAY ARRAY['morning','midday','evening'] LOOP
    v_id := 'round-' || to_char(p_date, 'YYYYMMDD') || '-' || v_key;
    v_p := NULL;
    IF v_pat IS NOT NULL AND jsonb_typeof(v_pat->'rounds') = 'array' THEN
      SELECT t.val INTO v_p
        FROM jsonb_array_elements(v_pat->'rounds') AS t(val)
       WHERE t.val->>'round_key' = v_key
       LIMIT 1;
    END IF;

    IF v_p IS NOT NULL
       AND COALESCE(v_p->>'display_name','') <> ''
       AND COALESCE(v_p->>'cutoff_time','') ~ '^[0-9]{2}:[0-9]{2}'
       AND COALESCE(v_p->>'delivery_start','') ~ '^[0-9]{2}:[0-9]{2}'
       AND COALESCE(v_p->>'delivery_end','') ~ '^[0-9]{2}:[0-9]{2}'
       AND COALESCE(v_p->>'max_capacity','0') ~ '^[0-9]+$'
       AND (v_p->>'max_capacity')::integer > 0 THEN
      -- 144: template จากแพทเทิร์นที่แอดมินตั้ง (order_pattern)
      SELECT r.branch_id INTO v_branch FROM public.delivery_rounds r
       WHERE COALESCE(r.round_key, r.name) = v_key
       ORDER BY r.scheduled_date DESC NULLS LAST, r.created_at DESC LIMIT 1;
      IF v_branch IS NULL THEN
        SELECT b.id INTO v_branch FROM public.branches b WHERE b.is_default = true LIMIT 1;
      END IF;
      IF v_branch IS NULL THEN
        SELECT b.id INTO v_branch FROM public.branches b ORDER BY b.created_at LIMIT 1;
      END IF;
      INSERT INTO public.delivery_rounds (
        id, round_key, name, display_name, cutoff_time, same_day_cutoff, pre_order_cutoff,
        delivery_start, delivery_end,
        max_capacity, current_count, date, scheduled_date, status, branch_id
      ) VALUES (
        v_id, v_key, v_key, v_p->>'display_name',
        (v_p->>'cutoff_time')::time,
        COALESCE(NULLIF(v_p->>'same_day_cutoff', '')::time, (v_p->>'cutoff_time')::time),
        NULLIF(v_p->>'pre_order_cutoff', '')::time,
        (v_p->>'delivery_start')::time, (v_p->>'delivery_end')::time,
        (v_p->>'max_capacity')::integer, 0, p_date, p_date, 'active', v_branch
      )
      ON CONFLICT (id) DO NOTHING;
      CONTINUE;
    END IF;

    -- fallback: legacy template = latest row per round_key (024/113 — เดิมทุกตัวอักษร)
    SELECT * INTO v_tpl
      FROM public.delivery_rounds
     WHERE COALESCE(round_key, name) = v_key
     ORDER BY scheduled_date DESC NULLS LAST, created_at DESC
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ERR_ROUND_TEMPLATE_MISSING: %', v_key;
    END IF;
    IF v_tpl.cutoff_time IS NULL OR v_tpl.max_capacity IS NULL OR v_tpl.max_capacity <= 0 THEN
      RAISE EXCEPTION 'ERR_ROUND_TEMPLATE_INVALID: %', v_key;
    END IF;
    INSERT INTO public.delivery_rounds (
      id, round_key, name, display_name, cutoff_time, same_day_cutoff, pre_order_cutoff,
      delivery_start, delivery_end,
      max_capacity, current_count, date, scheduled_date, status, branch_id
    ) VALUES (
      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time,
      COALESCE(v_tpl.same_day_cutoff, v_tpl.cutoff_time), v_tpl.pre_order_cutoff,
      v_tpl.delivery_start, v_tpl.delivery_end,
      v_tpl.max_capacity, 0, p_date, p_date, 'active', v_tpl.branch_id
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'round_key', r.round_key, 'display_name', r.display_name,
           'scheduled_date', r.scheduled_date, 'cutoff_time', r.cutoff_time,
           'same_day_cutoff', r.same_day_cutoff, 'pre_order_cutoff', r.pre_order_cutoff,
           'delivery_start', r.delivery_start, 'delivery_end', r.delivery_end,
           'max_capacity', r.max_capacity, 'current_count', r.current_count, 'status', r.status
         ) ORDER BY r.delivery_start), '[]'::jsonb)
    INTO v_rounds
    FROM public.delivery_rounds r
   WHERE r.scheduled_date = p_date AND r.status = 'active';

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'rounds', v_rounds);
END $$;

-- ---- 144c: data repair — รอบอนาคตที่ยังไม่มีออเดอร์และถูกปิดทิ้ง -> active ----
UPDATE public.delivery_rounds
   SET status = 'active', updated_at = now()
 WHERE scheduled_date > (now() AT TIME ZONE 'Asia/Bangkok')::date
   AND id ~ '^round-[0-9]{8}-(morning|midday|evening)$'
   AND current_count = 0
   AND status = 'closed';


-- ============================================
-- 145a: สองคอลัมน์คัทออฟอิสระบนรอบเดิม (1 รอบ + ความจุก้อนเดียว — ไม่สร้างตารางใหม่)
-- ============================================
ALTER TABLE public.delivery_rounds
  ADD COLUMN IF NOT EXISTS same_day_cutoff time,
  ADD COLUMN IF NOT EXISTS pre_order_cutoff time;

-- backfill: เซมเดย์ค่าเดิมเท่ากับ cutoff_time (พฤติกรรมเหมือนเดิมจนกว่าแอดมินจะแก้)
--           พรีออเดอร์ NULL = ใช้กฎเดิม delivery_start - cutoff_hours
UPDATE public.delivery_rounds
   SET same_day_cutoff = cutoff_time, updated_at = now()
 WHERE same_day_cutoff IS NULL;

-- ============================================
-- 145b: order_pattern เดิมรับคีย์ใหม่ (same_day_cutoff คัดจาก cutoff_time,
--       pre_order_cutoff ยังไม่ตั้ง = ใช้กฎ) — preserve ค่าที่แอดมินตั้งไปแล้ว
-- ============================================
UPDATE public.business_settings bs
   SET value = jsonb_set(bs.value, '{rounds}', (
         SELECT COALESCE(jsonb_agg(
                  rr.elem || jsonb_strip_nulls(jsonb_build_object(
                    'same_day_cutoff', COALESCE(rr.elem->>'same_day_cutoff', rr.elem->>'cutoff_time'),
                    'pre_order_cutoff', rr.elem->>'pre_order_cutoff'
                  )) ORDER BY rr.ord), '[]'::jsonb)
         FROM jsonb_array_elements(bs.value->'rounds') WITH ORDINALITY AS rr(elem, ord)
       ), true),
       updated_at = now()
 WHERE bs.key = 'order_pattern'
   AND jsonb_typeof(bs.value->'rounds') = 'array';

COMMIT;
