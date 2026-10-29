-- ============================================
-- 173 — R21e (Owner 2026-10-29): แก้ id จาก to_char overflow/padding = bigint::text
-- ============================================
-- หลักฐาน production (e2e/r21eProdIdProbe.json · ก่อนแก้):
--   orders.id = 'ord- ###########-a04759' (11 nines ล้น → '#' + space นำ) · n_hash=8/8
--   order_status_history.id = 'osh-  1793254847583-e150d20e' (14 nines → 2 space นำ)
--   notifications ล่าสุด = 'evt-ord-…' (client path) — แต่ trigger hook 161 ยัง live อยู่
--   (ทีมเห็นอาการเดียวกันที่ batch id = R14/167 แก้ด้วย bigint::text แล้วพิสูจน์ผ่าน contract 163)
-- body = VERBATIM จากไฟล์ต้นทาง ( extract โดย e2e/r21eGen173.cjs ) — เปลี่ยนเฉพาะ
--   บรรทัดสร้าง id 3 จุด · เรียงตามลำดับเลข migration ต้นทาง · re-run ปลอดภัย (CREATE OR REPLACE)
-- ผล: id ใหม่ = <prefix>-<epoch_ms จริง 13 หลัก>-<md5> ไม่มี "#" ไม่มี space
-- contract: e2e/contracts_153 G8 ตรวจ id ใหม่ห้ามมี [# ] (CI รันหลัง apply migrations ครบ)
-- ============================================

-- ---- A) create_order_with_items (body VERBATIM จาก 153 · เปลี่ยนเฉพาะ v_order_id) ----

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
  v_ing_name text;
  -- [G&R 153] scope โปรโมชั่น — แทน v_promo %ROWTYPE เดิม (lookup ย้ายขึ้นก่อนลูปสินค้า
  -- เพราะต้องรู้ scope ก่อนจะรู้ว่ายอดบรรทัดไหนเข้าฐานส่วนลด)
  v_promo_id text; v_promo_applies text; v_promo_scope text[];
  v_eligible_subtotal numeric := 0;
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

  -- [G&R 153 edit (b)] ดึงโค้ดโปรโมชั่นก่อนวนลูปสินค้า — กติกา lookup เดิม 114 เป๊ะ
  --   (upper(code) + is_active + date window) + โหลด scope เมื่อแคมเปญจำกัดสินค้า
  v_eligible_subtotal := 0;
  IF p_promotion_code IS NOT NULL AND trim(p_promotion_code) <> '' THEN
    SELECT id, COALESCE(applies_to, 'all_products') INTO v_promo_id, v_promo_applies
      FROM public.promotions
     WHERE upper(code) = upper(trim(p_promotion_code))
       AND is_active = true
       AND (start_date IS NULL OR start_date <= CURRENT_DATE)
       AND (end_date   IS NULL OR end_date >= CURRENT_DATE)
     LIMIT 1;
    IF v_promo_id IS NOT NULL AND v_promo_applies = 'specific_products' THEN
      SELECT array_agg(pp.product_id) INTO v_promo_scope
        FROM public.promotion_products pp
       WHERE pp.promotion_id = v_promo_id;
    END IF;
  END IF;
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
    -- [G&R 153 edit (c)] สะสมฐานส่วนลดเฉพาะสินค้าที่อยู่ใน scope ของแคมเปญ
    IF v_promo_applies = 'specific_products' AND v_promo_scope IS NOT NULL AND v_pid = ANY(v_promo_scope) THEN
      v_eligible_subtotal := v_eligible_subtotal + v_item_sub;
    END IF;
  END LOOP;

  IF v_items_total_qty > public.order_setting('max_items_per_order', 20) THEN RAISE EXCEPTION 'ERR_QTY_LIMIT'; END IF;

  IF v_mode = 'SAME_DAY' THEN
    SELECT i.name INTO v_ing_name FROM (SELECT r.ingredient_id, SUM(v.qty * r.quantity_per_unit) AS req FROM (SELECT j.product_id, COALESCE(j.quantity, 1) AS qty FROM jsonb_to_recordset(p_items) AS j(product_id text, quantity integer) WHERE j.product_id IS NOT NULL) v JOIN public.recipes r ON r.product_id = v.product_id GROUP BY r.ingredient_id) need JOIN public.inventory i ON i.id = need.ingredient_id WHERE i.current_stock < need.req LIMIT 1;
    IF v_ing_name IS NOT NULL THEN RAISE EXCEPTION 'ERR_INSUFFICIENT_INGREDIENT: %', v_ing_name; END IF;
  END IF;

  -- [G&R 153 edit (d)] แทนบล็อกส่วนลด 114 เดิม — ตัดสินที่ promotion_apply_rules ที่เดียว
  --   (kill switch · min order · scope · max cap · budget 15% · usage cap — ดูหัวไฟล์)
  IF v_promo_id IS NOT NULL AND COALESCE(v_promo_applies, 'all_products') <> 'specific_products' THEN
    v_eligible_subtotal := v_subtotal;
  END IF;
  IF v_promo_id IS NOT NULL THEN
    v_discount := public.promotion_apply_rules(v_promo_id, v_subtotal, v_eligible_subtotal);
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
  v_order_id := 'ord-' || ((extract(epoch from clock_timestamp()) * 1000)::bigint)::text || '-' || substr(md5(random()::text), 1, 6);  -- 173: bigint::text (pattern R14/167) — to_char 11 หลักล้นเป็น '#' + space นำ

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

-- ---- B) orders_notify_hook (body VERBATIM จาก 161 · เปลี่ยนเฉพาะ v_id) ----

CREATE OR REPLACE FUNCTION public.orders_notify_hook() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_cust text;
  v_user uuid;
  v_title text;
  v_type text;
  v_msg text;
  v_enabled boolean;
  v_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_cust := NEW.customer_id;
    v_user := NEW.customer_ref;
    v_type := 'ORDER_CREATED';
    v_title := 'รับออเดอร์แล้ว';
    v_msg := 'มีออเดอร์เข้ามา — เลขที่ #' || NEW.order_number || ' · ขอบคุณที่สั่ง Bite Me Baby';
  ELSE
    IF TG_ARGV[0] = 'payment' THEN
      -- enum payment_status: ห้ามเทียบกับ '' ตรง ๆ (จะโดน cast '' -> enum = ERROR) —
      -- cast เป็น text ก่อน (CI #602: invalid input value for enum payment_status: "")
      IF COALESCE(NEW.payment_status::text, '') IS NOT DISTINCT FROM COALESCE(OLD.payment_status::text, '')
         OR COALESCE(NEW.payment_status::text, '') <> 'paid' THEN
        RETURN NULL;
      END IF;
      v_type := 'PAYMENT_CONFIRMED';
      v_title := 'ยืนยันการชำระเงินแล้ว';
      v_msg := 'ได้รับการชำระเงินของ #' || NEW.order_number || ' แล้ว';
    ELSE
      IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
      v_type := CASE NEW.status::text
        WHEN 'pending'            THEN 'ORDER_CREATED'
        WHEN 'confirmed'          THEN 'ORDER_CONFIRMED'
        WHEN 'preparing'          THEN 'ORDER_PREPARING'
        WHEN 'ready_for_dispatch' THEN 'ORDER_READY'
        WHEN 'dispatched'         THEN 'ORDER_DISPATCHED'
        WHEN 'in_transit'         THEN 'ORDER_IN_TRANSIT'
        WHEN 'arrived'            THEN 'ORDER_ARRIVED'
        WHEN 'delivered'          THEN 'ORDER_DELIVERED'
        WHEN 'cancelled'          THEN 'ORDER_CANCELLED'
        WHEN 'failed'             THEN 'ORDER_FAILED'
        ELSE 'ORDER_UPDATED'
      END;
      v_title := CASE v_type
        WHEN 'ORDER_CONFIRMED'  THEN 'ยืนยันออเดอร์แล้ว'
        WHEN 'ORDER_PREPARING'  THEN 'กำลังเตรียมอาหาร'
        WHEN 'ORDER_READY'      THEN 'อาหารพร้อมแล้ว'
        WHEN 'ORDER_DISPATCHED' THEN 'ออกส่งแล้ว'
        WHEN 'ORDER_IN_TRANSIT' THEN 'กำลังเดินทาง'
        WHEN 'ORDER_ARRIVED'    THEN 'ถึงปลายทางแล้ว'
        WHEN 'ORDER_DELIVERED'  THEN 'จัดส่งสำเร็จ'
        WHEN 'ORDER_CANCELLED'  THEN 'ออเดอร์ถูกยกเลิก'
        WHEN 'ORDER_FAILED'     THEN 'ออเดอร์ไม่สำเร็จ'
        ELSE 'อัปเดตสถานะออเดอร์'
      END;
      v_msg := '#' || NEW.order_number || ' — ' || v_title;
    END IF;
    v_cust := NEW.customer_id;
    v_user := NEW.customer_ref;
  END IF;

  IF v_cust IS NULL OR v_cust = '' THEN RETURN NULL; END IF;

  SELECT COALESCE((channels->>'Transactional')::boolean, true) INTO v_enabled
    FROM public.notification_prefs WHERE customer_id = v_cust;
  IF NOT COALESCE(v_enabled, true) THEN RETURN NULL; END IF;

  v_id := 'notif-' || ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)::text  -- 173: bigint::text — to_char 11 หลักล้นเป็น '#'
          || '-' || substr(md5(random()::text), 1, 5);
  -- BEST-EFFORT insert (Contract #177 · 019/020): notifications.customer_id FK ->
  -- customers(id) / user_id FK -> auth.users(id) — fixture/test orders ที่ไม่มีแถว
  -- จริงต้อง "ข้ามเงียบ" ไม่ใช่ทำให้ INSERT ออเดอร์ทั้งแถวพัง
  -- (การแจ้งเตือน = derived data ห้ามบล็อกการเขียนออเดอร์เด็ดขาด)
  BEGIN
    INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)
    VALUES (v_id, v_cust, v_user, v_title, v_msg, false, v_type, 'Transactional', NOW());
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  RETURN NULL;
END;
$$;

-- ---- C) write_order_status_history (body VERBATIM จาก 040 · เปลี่ยนเฉพาะ osh- id) ----

CREATE OR REPLACE FUNCTION public.write_order_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid;
  v_sync       text;
  v_actor_type text;
  v_actor_id   text;
BEGIN
  -- UPDATE without a status change → no history row
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;

  v_uid  := auth.uid();
  v_sync := NULLIF(current_setting('app.delivery_sync_order', true), '');

  IF v_sync IS NOT NULL AND v_sync = NEW.order_number::text THEN
    -- Trusted delivery sync (migr 036) — actor is the JWT-bound driver
    v_actor_type := 'DRIVER';
    SELECT id INTO v_actor_id FROM public.drivers WHERE user_id = v_uid LIMIT 1;
    v_actor_id := COALESCE(v_actor_id, v_uid::text);
  ELSIF v_uid IS NULL THEN
    v_actor_type := 'SYSTEM';
    v_actor_id   := NULL;
  ELSIF public.is_admin() THEN
    v_actor_type := 'ADMIN';
    v_actor_id   := v_uid::text;
  ELSIF NEW.customer_ref IS NOT NULL AND NEW.customer_ref = v_uid THEN
    v_actor_type := 'CUSTOMER';
    v_actor_id   := v_uid::text;
  ELSE
    v_actor_type := 'RPC';
    v_actor_id   := v_uid::text;
  END IF;

  INSERT INTO public.order_status_history (
    id, order_number, from_status, to_status, changed_at,
    actor_type, actor_id, reason, metadata
  ) VALUES (
    'osh-' || ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)::text  -- 173: bigint::text (14 nines คือ space นำ)
             || '-' || substr(md5(random()::text), 1, 8),
    NEW.order_number,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status,
    NOW(),
    v_actor_type,
    v_actor_id,
    NULLIF(current_setting('app.order_transition_reason', true), ''),
    jsonb_build_object('source', 'order_status_trigger', 'operation', TG_OP, 'order_id', NEW.id)
  );

  RETURN NULL;
END;
$$;
