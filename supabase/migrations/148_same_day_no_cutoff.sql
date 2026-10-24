-- ============================================================
-- Migration 148 — SAME_DAY = เปิด–ปิดไม่มีคัทออฟ (ถอด same_day_cutoff)
-- Owner directive 2026-10-24 (ปิดเซสชันรอบ 13 — กฎใหม่ มีผลเหนืองานรอบ 13):
--   1) "รอบจัดส่งเซมเดย์ต้องวิ่งปกติตั้งแต่ร้านเปิด–ปิด ไม่มี cutoff ใด ๆ"
--      (ไม่ใช่ "คัทออฟเลยร้านปิด" — คือไม่มีคัทออฟเลย)
--   2) "คัทออฟมีเฉพาะ PRE_ORDER เท่านั้น" — same_day_cutoff (145) = ไม่จำเป็น สั่งถอด
--   ยังอยู่: pre_order_cutoff + กฎ cutoff_hours (ของจริง เฉพาะพรีออเดอร์)
--   ถูกรื้อตามคำสั่ง: contract 145, roundsTwoCutoffs.test, คอลัมน์ same_day_cutoff,
--   ช่องคัทออฟเซมเดย์ใน AdminRounds, fixture pairing 12 คอนแทรคต์, ขั้น #6 ใน acceptance
--
-- ผลต่อพฤติกรรม (ตั้งใจ — requirement ใหม่ของ Owner ไม่ใช่การอ่อนกฎ):
--   · create_order_with_items SAME_DAY = ไม่มี ERR_CUTOFF_PASSED (ด่านเดิม 145 ถูกถอด)
--   · auto_close_expired_rounds = ไม่ปิดรอบวันนี้เมื่อเลย cutoff_time (ปิดเฉพาะวันที่ผ่านไปแล้ว)
--   · PRE_ORDER ทุกด่านคงเดิม: pre_order_cutoff ตั้งตรง / fallback delivery_start − cutoff_hours
--     + gate 142 เมนูปฏิทิน + enforce_pre_order_window (เช็คเฉพาะ PRE_ORDER เหมือนเดิม)
--
-- สร้างโดย e2e/m148Build.cjs (anchor-guarded จาก body 145 + auto-close เขียนใหม่)
-- สัญญาทดสอบ: e2e/contracts_148_same_day_no_cutoff.sql (แทน contracts_145 ที่ถูกรื้อ)
-- Regression: contracts_143/144 (pre-order cutoff + pattern) · contracts_140 (ปรับ G2 ตามกติกาใหม่)
-- Rollback: apply ใหม่ 145_two_cutoffs.sql (คืนคอลัมน์ + gate เดิม) — ไม่มี data loss
-- ============================================================

BEGIN;

-- ---- 148a: order gate — SAME_DAY ไม่มีเวลาปิดรับ ----
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
  v_pre_order_cutoff time;
  v_prod_is_avail boolean; v_prod_same_day boolean; v_prod_preorder boolean;
  v_prod_name text; v_delivery_method text; v_distance numeric;
  v_promo public.promotions%ROWTYPE; v_ing_name text;
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
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
         pre_order_cutoff
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff, v_round_start,
         v_pre_order_cutoff
    FROM public.delivery_rounds WHERE id = p_delivery_round_id FOR UPDATE;
  IF v_round_status IS NULL THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;
  IF v_round_status <> 'active' THEN RAISE EXCEPTION 'ERR_ROUND_CLOSED'; END IF;

  IF v_mode = 'SAME_DAY' THEN
    IF v_round_date IS NULL OR v_round_date <> v_today THEN RAISE EXCEPTION 'ERR_ROUND_DATE'; END IF;
    -- 148 (Owner 2026-10-24): SAME_DAY = ไม่มีคัทออฟใด ๆ — วิ่งปกติตั้งแต่ร้านเปิดถึงปิดร้าน
    --   (ยกเลิก 145: IF v_now > COALESCE(same_day_cutoff, cutoff_time) -> ERR_CUTOFF_PASSED)
    --   ด่านของเซมเดย์เหลือแค่: รอบเปิดอยู่ (status) + วันเดียวกัน (date) + ความจุ (capacity)
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

-- ---- 148b: ensure_rounds_for_date — สร้างรอบโดยไม่แตะคอลัมน์ที่ถูกถอด ----
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
        id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
        delivery_start, delivery_end,
        max_capacity, current_count, date, scheduled_date, status, branch_id
      ) VALUES (
        v_id, v_key, v_key, v_p->>'display_name',
        (v_p->>'cutoff_time')::time,
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
      id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
      delivery_start, delivery_end,
      max_capacity, current_count, date, scheduled_date, status, branch_id
    ) VALUES (
      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time,
      v_tpl.pre_order_cutoff,
      v_tpl.delivery_start, v_tpl.delivery_end,
      v_tpl.max_capacity, 0, p_date, p_date, 'active', v_tpl.branch_id
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'round_key', r.round_key, 'display_name', r.display_name,
           'scheduled_date', r.scheduled_date, 'cutoff_time', r.cutoff_time,
           'pre_order_cutoff', r.pre_order_cutoff,
           'delivery_start', r.delivery_start, 'delivery_end', r.delivery_end,
           'max_capacity', r.max_capacity, 'current_count', r.current_count, 'status', r.status
         ) ORDER BY r.delivery_start), '[]'::jsonb)
    INTO v_rounds
    FROM public.delivery_rounds r
   WHERE r.scheduled_date = p_date AND r.status = 'active';

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'rounds', v_rounds);
END $$;

-- ---- 148c: auto-close — เฉพาะวันที่ผ่านไปแล้ว ----
create or replace function public.auto_close_expired_rounds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_closed integer := 0;
  r record;
begin
  for r in
    select id, display_name, scheduled_date, cutoff_time
      from public.delivery_rounds
     where status = 'active'
       -- 148 (Owner 2026-10-24): SAME_DAY = ไม่มีคัทออฟ -> ห้ามปิดรอบวันนี้ด้วยเวลา cutoff
       --   อีกต่อไป (เดิม 140: ปิดเมื่อเลย cutoff_time ของวัน) — ปิดเฉพาะวันที่ผ่านไปแล้ว
       and scheduled_date < v_today
  loop
    update public.delivery_rounds
       set status = 'closed', updated_at = now()
     where id = r.id and status = 'active';
    begin
      perform public.append_audit_log(
        p_action := 'settings_change',
        p_entity_type := 'delivery_round',
        p_entity_id := r.id,
        p_description := format('auto-close ปิดรอบ "%s" (%s) : active -> closed (วันจัดส่งผ่านไปแล้ว)', r.display_name, r.scheduled_date),
        p_metadata := jsonb_build_object('from', 'active', 'to', 'closed', 'reason', 'auto-close-day-ended', 'scheduled_date', r.scheduled_date),
        p_user_email := null
      );
    exception when others then
      raise notice 'auto_close_expired_rounds: audit write failed for % (%)', r.id, sqlerrm;
    end;
    v_closed := v_closed + 1;
  end loop;
  return v_closed;
end;
$$;
revoke all on function public.auto_close_expired_rounds() from public, anon;
grant execute on function public.auto_close_expired_rounds() to authenticated, service_role;

-- ---- 148d: order_pattern ลบคีย์ same_day_cutoff ทุกแถว (pre_order_cutoff คงเดิม) ----
UPDATE public.business_settings bs
   SET value = jsonb_set(bs.value, '{rounds}', (
         SELECT COALESCE(jsonb_agg(elem - 'same_day_cutoff' ORDER BY ord), '[]'::jsonb)
           FROM jsonb_array_elements(bs.value->'rounds') WITH ORDINALITY AS r(elem, ord)
       ), true),
       updated_at = now()
 WHERE bs.key = 'order_pattern'
   AND jsonb_typeof(bs.value->'rounds') = 'array';

-- ---- 148e: ถอดคอลัมน์ออกจาก schema จริง (ท้ายสุด — หลัง replace function ทุกตัวแล้ว) ----
ALTER TABLE public.delivery_rounds DROP COLUMN IF EXISTS same_day_cutoff;

COMMIT;
