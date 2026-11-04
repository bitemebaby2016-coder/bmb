-- ============================================
-- Bite Me Baby — SQL Contract: Migration 184
-- (pickup ไม่ผูกกับรอบ · นอกเวลาเปิดร้าน = notice ของลูกค้า · mode/engine gates คงเดิม)
-- Date: 2026-11-03 · Owner directive R65
-- Run on ephemeral PG17 (apply_all_migrations.sh) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- G0  narrow hours = [now+2h, now+3h) BKK → "now" guaranteed OUTSIDE the window
-- G1  delivery SAME_DAY นอกเวลา → ERR_STORE_CLOSED (default path ไม่เปลี่ยน)
-- G2  pickup SAME_DAY นอกเวลา → SUCCESS + notice ลง special_instructions
--     (พิมพ์ช่อง Notice สติกเกอร์) + pickup_code 6 หลัก + fee=0
-- G3a delivery + round-key toggle ปิด → ERR_ROUND_CLOSED (round-key ยังบังคับ)
-- G3b pickup  + round-key toggle ปิด → SUCCESS (184 ข้ามเฉพาะ pickup)
-- G4  pickup + same_day_open=false → ERR_ORDER_MODE_CLOSED (mode-level ไม่ยกเว้น)
-- G5  pickup + รอบ status='closed' → ERR_ROUND_CLOSED (engine gates คงเดิม)
--
-- NOTE: contract รันใน transaction เดียว — GUC 'app.pickup_order' (is_local=true)
--   จะอยู่จนจบ tx → หลังทุกครั้งที่เรียก pickup ต้อง reset กว้าง ๆ เพื่อจำลอง
--   "RPC call ละ transaction" ของ PostgREST (production = GUC ล้างทุกครั้งที่จบ call)
-- ============================================

BEGIN;
RESET ROLE;

-- fake auth user for FK (CI prelude auth.users — full column form แบบ contracts_124)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('00000000-0000-4000-8000-000000ce0184', 'r65-184@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000ce0184","role":"authenticated"}', true);

DO $$
DECLARE
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_round text;
  v_round_morning text;
  v_pid text;
  v_lat numeric; v_lng numeric;
  v_ok boolean; v_err text;
  v_res jsonb;
  v_out text := '';
BEGIN
  -- ===== FIXTURES =====
  PERFORM public.ensure_rounds_for_date(v_today);
  -- production รอบวันนี้อาจถูก admin ปิดไว้ → force-active ใน tx นี้ (ROLLBACK ตอนท้าย ไม่มีมลพิษ)
  -- ต้องมี round active จริงเพื่อให้ engine ผ่าน round-status gate ไปถึง trigger ที่กำลังทดสอบ
  UPDATE public.delivery_rounds
     SET status = 'active'
   WHERE scheduled_date = v_today AND archived = false AND status <> 'active';
  -- capacity deterministic (template อาจต่ำกว่า 2 ที่ G2+G3b สร้าง) — rollback ตอนท้าย
  UPDATE public.delivery_rounds
     SET current_count = 0, max_capacity = GREATEST(max_capacity, 10)
   WHERE scheduled_date = v_today;

  SELECT id INTO v_round FROM public.delivery_rounds
   WHERE scheduled_date = v_today AND status = 'active' AND archived = false
   ORDER BY delivery_start LIMIT 1;
  IF v_round IS NULL THEN
    RAISE EXCEPTION 'FIXTURE FAIL: no active round for %', v_today;
  END IF;

  SELECT id INTO v_round_morning FROM public.delivery_rounds
   WHERE scheduled_date = v_today AND COALESCE(round_key, name) = 'morning' AND archived = false
   LIMIT 1;
  IF v_round_morning IS NULL THEN
    RAISE EXCEPTION 'FIXTURE FAIL: no morning round for %', v_today;
  END IF;

  SELECT id INTO v_pid FROM public.products
   WHERE is_available AND COALESCE(available_same_day, false) AND NOT COALESCE(archived, false)
   ORDER BY sort_order LIMIT 1;
  IF v_pid IS NULL THEN
    UPDATE public.products
       SET is_available = true, available_same_day = true, archived = false
     WHERE id = (SELECT id FROM public.products ORDER BY sort_order LIMIT 1)
     RETURNING id INTO v_pid;
  END IF;
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'FIXTURE FAIL: no products';
  END IF;

  SELECT COALESCE(b.kitchen_latitude,  (public.kitchen_location()->>'latitude')::numeric)  + 0.001,
         COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001
    INTO v_lat, v_lng
    FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main';
  IF v_lat IS NULL THEN
    v_lat := (public.kitchen_location()->>'latitude')::numeric  + 0.001;
    v_lng := (public.kitchen_location()->>'longitude')::numeric + 0.001;
  END IF;

  -- ===== G0: narrow hours = [now+2h, now+3h) BKK → now guaranteed outside =====
  UPDATE public.business_settings
     SET value = jsonb_build_object(
       'open',  to_char((now() at time zone 'Asia/Bangkok' + interval '2 hours'), 'HH24:MI'),
       'close', to_char((now() at time zone 'Asia/Bangkok' + interval '3 hours'), 'HH24:MI'))
   WHERE key = 'hours';
  IF NOT FOUND THEN
    INSERT INTO public.business_settings (key, value)
    VALUES ('hours', jsonb_build_object(
      'open',  to_char((now() at time zone 'Asia/Bangkok' + interval '2 hours'), 'HH24:MI'),
      'close', to_char((now() at time zone 'Asia/Bangkok' + interval '3 hours'), 'HH24:MI')));
  END IF;
  v_out := v_out || format('[hours=%s-%s BKK] ',
    (SELECT value->>'open'  FROM public.business_settings WHERE key='hours'),
    (SELECT value->>'close' FROM public.business_settings WHERE key='hours'));

  -- ===== G1: delivery SAME_DAY นอกเวลา → ERR_STORE_CLOSED (default path คงเดิม) =====
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.create_order_with_items_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round,
      p_delivery_method := 'self_delivery', p_delivery_address := 'r65-184-addr',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng,
      p_customer_name := 'r65contract', p_customer_phone := '0900000000',
      p_payment_method := 'cash_on_delivery',
      p_branch_id := NULL,
      p_client_submit_key := 'R65-184-G1');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE '%ERR_STORE_CLOSED%' THEN
    RAISE EXCEPTION 'G1 FAIL: delivery นอกเวลาต้องโดน ERR_STORE_CLOSED (ok=%, err=%)', v_ok, v_err;
  END IF;
  v_out := v_out || 'G1(delivery-blocked-outside)=PASS; ';

  -- ===== G2: pickup SAME_DAY นอกเวลา → SUCCESS + notice + pickup_code + fee=0 =====
  v_ok := false; v_err := '';
  BEGIN
    v_res := public.create_pickup_order_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round,
      p_customer_name := 'r65contract', p_customer_phone := '0900000000',
      p_payment_method := 'cash_on_delivery',
      p_special_instructions := 'รับนอกเวลาเปิดร้าน',
      p_order_mode := 'SAME_DAY',
      p_branch_id := NULL,
      p_client_submit_key := 'R65-184-G2');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'G2 FAIL: pickup นอกเวลาต้องสำเร็จ (err=%)', v_err;
  END IF;
  IF COALESCE(v_res->>'delivery_method', '') <> 'pickup' THEN
    RAISE EXCEPTION 'G2 FAIL: delivery_method=% (ต้องเป็น pickup)', v_res->>'delivery_method';
  END IF;
  IF COALESCE(v_res->>'delivery_fee', 'x')::numeric <> 0 THEN
    RAISE EXCEPTION 'G2 FAIL: delivery_fee=% (ต้องเป็น 0)', v_res->>'delivery_fee';
  END IF;
  IF v_res->>'pickup_code' IS NULL OR v_res->>'pickup_code' !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'G2 FAIL: pickup_code=% (ต้อง 6 หลัก)', v_res->>'pickup_code';
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM public.orders
        WHERE order_number = v_res->>'order_number'
          AND special_instructions = 'รับนอกเวลาเปิดร้าน'
          AND delivery_method = 'pickup'
  ) THEN
    RAISE EXCEPTION 'G2 FAIL: notice "รับนอกเวลาเปิดร้าน" ไม่ถูกบันทึกลงออเดอร์';
  END IF;
  v_out := v_out || 'G2(pickup-outside-notice)=PASS; ';
  -- contract รัน tx เดียว → reset GUC เพื่อจำลอง PostgREST (1 RPC = 1 transaction)
  PERFORM set_config('app.pickup_order', '', true);
  -- คืน hours กว้าง (CI standard) ก่อน G3–G5 → ให้แต่ละ group ทดสอบเฉพาะ gate ตัวเอง
  UPDATE public.business_settings
     SET value = jsonb_build_object('open', '00:00', 'close', '23:59')
   WHERE key = 'hours';

  -- ===== G3a: delivery + round-key toggle ปิด → ERR_ROUND_CLOSED (ยังบังคับ) =====
  INSERT INTO public.business_settings (key, value)
  VALUES ('operating_hours', '{"same_day_open":true,"pre_order_open":true,"morning_open":false,"midday_open":true,"evening_open":true}'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.create_order_with_items_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round_morning,
      p_delivery_method := 'self_delivery', p_delivery_address := 'r65-184-addr',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng,
      p_customer_name := 'r65contract', p_customer_phone := '0900000000',
      p_payment_method := 'cash_on_delivery',
      p_branch_id := NULL,
      p_client_submit_key := 'R65-184-G3A');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE '%ERR_ROUND_CLOSED%' THEN
    RAISE EXCEPTION 'G3a FAIL: delivery ต้องโดน round-key toggle (ok=%, err=%)', v_ok, v_err;
  END IF;
  v_out := v_out || 'G3a(delivery-round-key-enforced)=PASS; ';

  -- ===== G3b: pickup + round-key toggle ปิด → SUCCESS (184 ข้ามเฉพาะ pickup) =====
  v_ok := false; v_err := '';
  BEGIN
    v_res := public.create_pickup_order_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round_morning,
      p_customer_name := 'r65contract', p_customer_phone := '0900000000',
      p_payment_method := 'cash_on_delivery',
      p_order_mode := 'SAME_DAY',
      p_branch_id := NULL,
      p_client_submit_key := 'R65-184-G3B');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'G3b FAIL: pickup ต้องข้าม round-key toggle (err=%)', v_err;
  END IF;
  IF COALESCE(v_res->>'delivery_method', '') <> 'pickup' THEN
    RAISE EXCEPTION 'G3b FAIL: delivery_method=%', v_res->>'delivery_method';
  END IF;
  v_out := v_out || 'G3b(pickup-round-key-exempt)=PASS; ';
  PERFORM set_config('app.pickup_order', '', true);

  -- ===== G4: pickup + same_day_open=false → ERR_ORDER_MODE_CLOSED (mode-level ไม่ยกเว้น) =====
  INSERT INTO public.business_settings (key, value)
  VALUES ('operating_hours', '{"same_day_open":false,"pre_order_open":true,"morning_open":true,"midday_open":true,"evening_open":true}'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  v_ok := false; v_err := '';
  BEGIN
    v_res := public.create_pickup_order_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round,
      p_customer_name := 'r65contract', p_customer_phone := '0900000000',
      p_payment_method := 'cash_on_delivery',
      p_order_mode := 'SAME_DAY',
      p_branch_id := NULL,
      p_client_submit_key := 'R65-184-G4');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE '%ERR_ORDER_MODE_CLOSED%' THEN
    RAISE EXCEPTION 'G4 FAIL: pickup ต้องโดน mode kill-switch (ok=%, err=%)', v_ok, v_err;
  END IF;
  v_out := v_out || 'G4(pickup-mode-switch-enforced)=PASS; ';
  PERFORM set_config('app.pickup_order', '', true);

  -- ===== G5: pickup + รอบ status='closed' → ERR_ROUND_CLOSED (engine gates คงเดิม) =====
  INSERT INTO public.business_settings (key, value)
  VALUES ('operating_hours', '{"same_day_open":true,"pre_order_open":true,"morning_open":true,"midday_open":true,"evening_open":true}'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  UPDATE public.delivery_rounds SET status = 'closed' WHERE id = v_round;

  v_ok := false; v_err := '';
  BEGIN
    v_res := public.create_pickup_order_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round,
      p_customer_name := 'r65contract', p_customer_phone := '0900000000',
      p_payment_method := 'cash_on_delivery',
      p_order_mode := 'SAME_DAY',
      p_branch_id := NULL,
      p_client_submit_key := 'R65-184-G5');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE '%ERR_ROUND_CLOSED%' THEN
    RAISE EXCEPTION 'G5 FAIL: engine ต้องยังปฏิเสธรอบที่ปิด (ok=%, err=%)', v_ok, v_err;
  END IF;
  v_out := v_out || 'G5(engine-round-gate-intact)=PASS; ';
  PERFORM set_config('app.pickup_order', '', true);

  RAISE NOTICE 'R65_184_RESULTS %', v_out;
END $$;

ROLLBACK;
-- ============================================
-- END OF CONTRACT 184
-- ============================================
