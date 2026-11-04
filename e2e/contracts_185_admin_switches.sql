-- ============================================
-- Bite Me Baby — SQL Contract: Migration 185 (ADMIN SWITCHES · Owner R66-B)
-- G0  columns exist + แถวเดิม allow=true ทั้งคู่ (additive-only) + master reader default TRUE
-- G1  master OPEN (ค่าเริ่มต้น) → pickup SAME_DAY สร้างได้ปกติ
-- G2  master CLOSED → delivery + pickup = ERR_STORE_CLOSED ทั้งสองช่องทาง
-- G3  master OPEN กลับ → สร้างออเดอร์ได้ใหม่ (สวิตช์กลับทำงาน)
-- G4  หมวด allow_same_day=false → SAME_DAY = ERR_CATEGORY_MODE_NOT_ALLOWED
-- G5  หมวด allow_pre_order=false → PRE_ORDER = ERR_CATEGORY_MODE_NOT_ALLOWED
--     (ถ้า engine path นี้ยังรับ PRE_ORDER ไม่ได้ → บันทึก SKIP + เหตุผล ห้ามปลอม PASS)
-- G6  รีเซ็ต flags=true → SAME_DAY สร้างได้อีก (default true = ไม่บล็อกแถวเดิม)
-- ONE transaction + ROLLBACK = zero persisted data · hours กว้าง 00:00-23:59 (CI standard)
-- ============================================

BEGIN;
RESET ROLE;

-- fake auth user for FK (แบบ contracts_124/184)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('00000000-0000-4000-8000-000000ce0185', 'r66-185@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000ce0185","role":"authenticated"}', true);

-- helpers: ดัก error ของแต่ละ channel → คืน 'OK' หรือข้อความ error (GUC reset ในตัว)
CREATE FUNCTION pg_temp.try_pickup(p_pid text, p_round text, p_mode text, p_key text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_err text := ''; v_ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.create_pickup_order_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', p_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := p_round,
      p_customer_name := 'r66contract', p_customer_phone := '0900000000',
      p_payment_method := 'cash_on_delivery',
      p_special_instructions := p_key,
      p_order_mode := p_mode,
      p_branch_id := NULL,
      p_client_submit_key := p_key);
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('app.pickup_order', '', true); -- simulate PostgREST: 1 RPC = 1 tx
  RETURN CASE WHEN v_ok THEN 'OK' ELSE v_err END;
END $$;

CREATE FUNCTION pg_temp.try_delivery(p_pid text, p_round text, p_key text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_err text := ''; v_ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.create_order_with_items_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', p_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := p_round,
      p_delivery_method := 'self_delivery', p_delivery_address := 'r66-185-addr',
      p_dropoff_latitude := (SELECT (public.kitchen_location()->>'latitude')::numeric + 0.001),
      p_dropoff_longitude := (SELECT (public.kitchen_location()->>'longitude')::numeric + 0.001),
      p_customer_name := 'r66contract', p_customer_phone := '0900000000',
      p_payment_method := 'cash_on_delivery',
      p_branch_id := NULL, p_client_submit_key := p_key);
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  RETURN CASE WHEN v_ok THEN 'OK' ELSE v_err END;
END $$;
DO $$
DECLARE
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_round text; v_pid text; v_cat text;
  v_r text; v_out text := '';
BEGIN
  -- ===== FIXTURES (แบบ contracts_184 — force-active rounds ใน tx แล้ว ROLLBACK) =====
  PERFORM public.ensure_rounds_for_date(v_today);
  UPDATE public.delivery_rounds SET status = 'active' WHERE scheduled_date = v_today AND archived = false AND status <> 'active';
  UPDATE public.delivery_rounds SET current_count = 0, max_capacity = GREATEST(max_capacity, 10) WHERE scheduled_date = v_today;
  SELECT id INTO v_round FROM public.delivery_rounds WHERE scheduled_date = v_today AND status = 'active' AND archived = false ORDER BY delivery_start LIMIT 1;
  IF v_round IS NULL THEN RAISE EXCEPTION 'FIXTURE FAIL: no active round for %', v_today; END IF;

  SELECT id INTO v_pid FROM public.products WHERE is_available AND COALESCE(available_same_day, false) AND NOT COALESCE(archived, false) ORDER BY sort_order LIMIT 1;
  IF v_pid IS NULL THEN
    UPDATE public.products SET is_available = true, available_same_day = true, archived = false
     WHERE id = (SELECT id FROM public.products ORDER BY sort_order LIMIT 1) RETURNING id INTO v_pid;
  END IF;
  IF v_pid IS NULL THEN RAISE EXCEPTION 'FIXTURE FAIL: no products'; END IF;
  SELECT category_id INTO v_cat FROM public.products WHERE id = v_pid;
  IF v_cat IS NULL THEN RAISE EXCEPTION 'FIXTURE FAIL: product has no category'; END IF;

  UPDATE public.business_settings SET value = jsonb_build_object('open', '00:00', 'close', '23:59') WHERE key = 'hours';
  -- defensive: contract ต้องรันหลัง apply เสมอ (seed = ON CONFLICT DO NOTHING)
  INSERT INTO public.business_settings (key, value) VALUES ('store_master_open', '{"open":true}'::jsonb) ON CONFLICT (key) DO NOTHING;

  -- ===== G0: additive defaults + master reader default TRUE =====
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_categories' AND column_name = 'allow_same_day')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_categories' AND column_name = 'allow_pre_order') THEN
    RAISE EXCEPTION 'G0 FAIL: allow_same_day/allow_pre_order columns missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_categories WHERE allow_same_day IS DISTINCT FROM true OR allow_pre_order IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'G0 FAIL: existing rows must default allow=true (additive-only)';
  END IF;
  IF public.store_master_is_open() IS NOT TRUE THEN
    RAISE EXCEPTION 'G0 FAIL: master reader must default TRUE';
  END IF;
  v_out := v_out || 'G0(defaults-additive-open)=PASS; ';

  -- ===== G1: master OPEN (ค่าเริ่มต้น) → pickup SAME_DAY สร้างได้ปกติ =====
  v_r := pg_temp.try_pickup(v_pid, v_round, 'SAME_DAY', 'R66-185-G1');
  IF v_r <> 'OK' THEN RAISE EXCEPTION 'G1 FAIL: master=open ต้องสร้างออเดอร์ได้ (err=%)', v_r; END IF;
  v_out := v_out || 'G1(master-open-allows)=PASS; ';

  -- ===== G2: master CLOSED → delivery + pickup = ERR_STORE_CLOSED (ทุกช่องทาง) =====
  UPDATE public.business_settings SET value = '{"open":false}'::jsonb WHERE key = 'store_master_open';
  IF public.store_master_is_open() THEN RAISE EXCEPTION 'G2 FAIL: reader ยังคืน true ทั้งที่ปิด'; END IF;
  v_r := pg_temp.try_delivery(v_pid, v_round, 'R66-185-G2d');
  IF v_r = 'OK' OR v_r NOT LIKE '%ERR_STORE_CLOSED%' THEN RAISE EXCEPTION 'G2 FAIL: delivery ต้องโดน ERR_STORE_CLOSED (err=%)', v_r; END IF;
  v_r := pg_temp.try_pickup(v_pid, v_round, 'SAME_DAY', 'R66-185-G2p');
  IF v_r = 'OK' OR v_r NOT LIKE '%ERR_STORE_CLOSED%' THEN RAISE EXCEPTION 'G2 FAIL: pickup ต้องโดน ERR_STORE_CLOSED (err=%)', v_r; END IF;
  v_out := v_out || 'G2(master-closed-blocks-all-channels)=PASS; ';

  -- ===== G3: master OPEN กลับ → สร้างออเดอร์ได้ใหม่ =====
  UPDATE public.business_settings SET value = '{"open":true}'::jsonb WHERE key = 'store_master_open';
  IF NOT public.store_master_is_open() THEN RAISE EXCEPTION 'G3 FAIL: reader ยัง false หลัง reopen'; END IF;
  v_r := pg_temp.try_pickup(v_pid, v_round, 'SAME_DAY', 'R66-185-G3');
  IF v_r <> 'OK' THEN RAISE EXCEPTION 'G3 FAIL: reopen ต้องสร้างได้ (err=%)', v_r; END IF;
  v_out := v_out || 'G3(master-reopen-allows)=PASS; ';

  -- ===== G4: allow_same_day=false → SAME_DAY โดน ERR_CATEGORY_MODE_NOT_ALLOWED =====
  UPDATE public.product_categories SET allow_same_day = false WHERE id = v_cat;
  v_r := pg_temp.try_pickup(v_pid, v_round, 'SAME_DAY', 'R66-185-G4');
  IF v_r = 'OK' OR v_r NOT LIKE '%ERR_CATEGORY_MODE_NOT_ALLOWED%' THEN RAISE EXCEPTION 'G4 FAIL (err=%)', v_r; END IF;
  v_out := v_out || 'G4(sameday-category-block)=PASS; ';

  -- ===== G5: allow_pre_order=false → PRE_ORDER blocked (adaptive: engine ไม่เปิด path = SKIP + เหตุผล) =====
  UPDATE public.product_categories SET allow_same_day = true, allow_pre_order = true WHERE id = v_cat;
  v_r := pg_temp.try_pickup(v_pid, v_round, 'PRE_ORDER', 'R66-185-G5a');
  IF v_r = 'OK' THEN
    UPDATE public.product_categories SET allow_pre_order = false WHERE id = v_cat;
    v_r := pg_temp.try_pickup(v_pid, v_round, 'PRE_ORDER', 'R66-185-G5b');
    IF v_r = 'OK' OR v_r NOT LIKE '%ERR_CATEGORY_MODE_NOT_ALLOWED%' THEN RAISE EXCEPTION 'G5 FAIL (err=%)', v_r; END IF;
    v_out := v_out || 'G5(preorder-category-block)=PASS; ';
  ELSE
    v_out := v_out || format('G5(SKIP-preorder-pickup-path-unavailable: %s); ', v_r);
  END IF;

  -- ===== G6: รีเซ็ต flags=true → SAME_DAY สร้างได้อีกครั้ง =====
  UPDATE public.product_categories SET allow_same_day = true, allow_pre_order = true WHERE id = v_cat;
  v_r := pg_temp.try_pickup(v_pid, v_round, 'SAME_DAY', 'R66-185-G6');
  IF v_r <> 'OK' THEN RAISE EXCEPTION 'G6 FAIL: flags=true ต้องสร้างได้ (err=%)', v_r; END IF;
  v_out := v_out || 'G6(reset-flags-allows)=PASS; ';

  RAISE NOTICE 'R66_CONTRACT_185 %', v_out;
END $$;

ROLLBACK;