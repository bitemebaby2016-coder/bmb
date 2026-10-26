-- ============================================
-- Bite Me Baby — QA-03 SQL Contract Suite for migration 020 (OWNER: SQL Editor)
-- ALL tests run inside a transaction that ROLLS BACK — zero production writes persist.
-- Must pass AFTER:  supabase db push   (migration 020)
-- ============================================
BEGIN;

-- W-2 (B-2): fixture ไรเดอร์ (auth.users + profiles + drivers) — driver_login ยึด JWT เท่านั้น
--   (เดิม self-upsert by phone ถูกถอดออกเพื่อความปลอดภัย) · ทั้งหมดอยู่ใน txn + ROLLBACK
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('66666666-6666-6666-6666-666666666666', 'contract-020-rider@bmb.test', 'x',
        now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role)
VALUES ('66666666-6666-6666-6666-666666666666', 'rider')
ON CONFLICT (id) DO UPDATE SET role = 'rider';
INSERT INTO public.drivers (id, name, phone, user_id, status)
VALUES ('qa-driver-020', 'QA Rider', '0800000001', '66666666-6666-6666-6666-666666666666', 'available')
ON CONFLICT (id) DO NOTHING;

-- fixture แอดมินสำหรับขั้น dispatch (assign_driver ตรวจ is_admin()/is_staff())
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('77777777-7777-7777-7777-777777777777', 'contract-020-admin@bmb.test', 'x',
        now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role)
VALUES ('77777777-7777-7777-7777-777777777777', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

DO $$
DECLARE
  v_fee numeric;
  v_result jsonb;
  v_driver_id text;
  v_order public.orders%ROWTYPE;
  v_round public.delivery_rounds%ROWTYPE;
BEGIN
  -- 0) helpers exist
  -- W-2: ปรับ signature ให้ตรง DB ปัจจุบัน (112 เพิ่ม p_branch_id · driver_login เปลี่ยนเป็น JWT-only 1 arg)
  IF to_regprocedure('public.haversine_km(numeric,numeric,numeric,numeric)') IS NULL
     OR to_regprocedure('public.compute_delivery_fee(numeric,numeric,text,integer,numeric,text)') IS NULL
     OR to_regprocedure('public.compute_delivery_fee_rpc(numeric,numeric,text,integer,numeric,text)') IS NULL
     OR to_regprocedure('public.upsert_driver(text,text,text)') IS NULL
     OR to_regprocedure('public.assign_driver(text,text)') IS NULL
     OR to_regprocedure('public.driver_login(text)') IS NULL
     OR to_regprocedure('public.driver_accept_assignment(text,text)') IS NULL
     OR to_regprocedure('public.driver_update_delivery_status(text,text,text,numeric,numeric)') IS NULL
     OR to_regprocedure('public.my_deliveries(text)') IS NULL THEN
    RAISE EXCEPTION 'FAIL migration 020 functions missing';
  END IF;

  -- W-2: JWT context — driver_login ยึด identity จาก JWT เท่านั้น (ต้องมีผู้ใช้จริงใน fixture)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);

  -- 1) DEL-01: ค่าจัดส่งต้องมาจากโซนที่ active และครอบคลุมระยะนั้น
  -- W-2: เดิม assert ค่าตายตัว 25/45 (พิกัดกรุงเทพฯ + 8 กม.) — ปัจจุบัน (a) fixture ใช้พิกัดครัว
  --   (เดิมห่าง ~212 กม. → SELF_DELIVERY_EXCEEDS_5KM_LIMIT) (b) รัศมี self_delivery = 5 กม.
  --   (delivery_policy) (c) มีโซนทับซ้อนจาก 112 (0-3 = 35 · 3-6 = 55) → ทดสอบแบบอิงโซนจริง
  v_fee := public.compute_delivery_fee(12.615659, 102.098063, 'self_delivery', 1, NULL, NULL);
  IF v_fee IS NULL OR v_fee <= 0
     OR v_fee NOT IN (SELECT z.fee FROM public.delivery_zones z
                       WHERE z.is_active AND 0 >= z.min_distance_km AND 0 < z.max_distance_km) THEN
    RAISE EXCEPTION 'FAIL near-kitchen fee not from covering zone: %', v_fee;
  END IF;
  RAISE NOTICE 'near-kitchen (0 km) fee = %', v_fee;

  v_fee := public.compute_delivery_fee(NULL, NULL, 'self_delivery', 1, 4, NULL);
  IF v_fee IS NULL OR v_fee <= 0
     OR v_fee NOT IN (SELECT z.fee FROM public.delivery_zones z
                       WHERE z.is_active AND 4 >= z.min_distance_km AND 4 < z.max_distance_km) THEN
    RAISE EXCEPTION 'FAIL 4km fee not from covering zone: %', v_fee;
  END IF;
  RAISE NOTICE '4 km fee = %', v_fee;

  -- 2) DEL-02: driver login (identity = JWT + drivers row ที่ admin provisioning ไว้)
  v_result := public.driver_login('QA Rider');
  v_driver_id := (v_result->'driver'->>'id')::text;
  IF v_driver_id IS NULL OR v_driver_id = '' THEN RAISE EXCEPTION 'FAIL driver_login: %', v_result; END IF;

  -- 3) DEL-02: dispatchable order + assign
  -- W-2: assign_driver = งานแอดมิน (ตรวจ is_admin()/is_staff()) → สลับ claims เป็นผู้ใช้แอดมิน
  PERFORM set_config('request.jwt.claims',
    '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
  SELECT * INTO v_round FROM public.delivery_rounds
   WHERE status IN ('active','open','scheduled') AND current_count < max_capacity LIMIT 1;
  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone,
                             delivery_round_id, status, delivery_method, payment_method, total_amount)
  VALUES ('qa-drive-probe', 'QA-BITE-DRIVE-001', 'qa-cust', 'QA Drive', '0800000002',
          v_round.id, 'ready_for_dispatch', 'self_delivery', 'promptpay_qr', 1)
  ON CONFLICT (id) DO NOTHING;

  v_result := public.assign_driver('QA-BITE-DRIVE-001', v_driver_id);
  IF (v_result->>'status') <> 'assigned' THEN RAISE EXCEPTION 'FAIL assign_driver'; END IF;

  -- 4) DEL-02: driver accept + advance + deliver
  -- W-2: กลับเป็น identity ของไรเดอร์ (driver_accept ยึดผู้ใช้ที่ผูกกับ drivers ด้วย)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
  v_result := public.driver_accept_assignment('QA-BITE-DRIVE-001', '0800000001');
  IF (v_result->>'status') <> 'accepted' THEN RAISE EXCEPTION 'FAIL accept'; END IF;
  v_result := public.driver_update_delivery_status('QA-BITE-DRIVE-001', '0800000001', 'in_transit', 10.75, 102.2);
  IF (v_result->>'status') <> 'in_transit' THEN RAISE EXCEPTION 'FAIL in_transit'; END IF;
  -- W-2: 132 กำหนดให้บันทึก POD ก่อนยืนยันส่ง (ERR_POD_REQUIRED) — path ต้องอยู่ในโฟลเดอร์ของตน
  PERFORM public.driver_attach_pod('QA-BITE-DRIVE-001', 'qa-driver-020/pod-020.jpg', 12.615659, 102.098063);
  v_result := public.driver_update_delivery_status('QA-BITE-DRIVE-001', '0800000001', 'delivered', 10.75, 102.2);
  IF (v_result->>'status') <> 'delivered' THEN RAISE EXCEPTION 'FAIL delivered'; END IF;

  -- 5) my_deliveries lists it
  v_result := public.my_deliveries('0800000001');
  IF NOT (v_result->>'assignments')::jsonb @> '[{"order_number":"QA-BITE-DRIVE-001"}]' THEN
    RAISE EXCEPTION 'FAIL my_deliveries missing assignment';
  END IF;

  RAISE NOTICE 'QA-03 migration 020 SQL suite PASS (transaction rolled back — no writes persisted)';
END $$;

ROLLBACK;
-- ============================================
-- END — paste output into e2e/contracts-020-bite-drive-sql-result.txt (owner action, read-only)
-- ============================================