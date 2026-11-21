-- ============================================
-- Bite Me Baby — SQL Contract: Migration 210 Rider my_deliveries v3 JOIN fix + offline gate + arrived completeness
-- Date: 2026-11-21 · Run on ephemeral PG (contract-tests.yml) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
-- Pattern: e2e/contracts_163_rider_step_sync.sql (CI-green pattern — UUID literals in JWT claims)
--
-- Proves (ตามแผน 210):
--   G1  my_deliveries 5-arg executes without 42703 "column o.round_id does not exist"
--       → returns assignments with scheduled_date populated from delivery_rounds.scheduled_date + offers array
--   G2  Filter params (p_scheduled_from/to) work correctly
--   G3  Offers come through my_deliveries (JOIN via o.delivery_round_id fixed)
--   G4  Offline gate: driver_accept_assignment + claim_dispatch_offer → ERR_DRIVER_OFFLINE when driver.status='offline'
--       (หมายเหตุ: assign_driver พา status ไป busy เสมอ → ต้อง force offline ด้วย superuser หลัง assign)
--   G5  'arrived' auto-close: cancel_order (195: admin ยกเลิก non-delivered ได้) ตอน assignment='arrived'
--       → assignment auto-closes เป็น 'cancelled' (จุดแก้ m210 — close_assignments_on_order_terminal + 'arrived')
--   G6  Ambiguity guards: 0-arg/1-arg resolve unambiguously (same as m207)
-- ============================================

BEGIN;
RESET ROLE;

-- fixtures (แบบ 036/163): admin/customer/rider-available/rider-offline + kitchen
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('210a0000-0000-0000-0000-000000000001', 'c210-admin@bmb.test',           'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('210a0000-0000-0000-0000-000000000002', 'c210-cust@bmb.test',            'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('210a0000-0000-0000-0000-000000000003', 'c210-rider-available@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('210a0000-0000-0000-0000-000000000004', 'c210-rider-offline@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin'    WHERE id = '210a0000-0000-0000-0000-000000000001';
UPDATE public.profiles SET role = 'customer' WHERE id IN (
  '210a0000-0000-0000-0000-000000000002',
  '210a0000-0000-0000-0000-000000000003',
  '210a0000-0000-0000-0000-000000000004');

INSERT INTO public.business_settings (key, value)
VALUES ('kitchen_location', '{"latitude":10.7016,"longitude":102.1429}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = business_settings.value || EXCLUDED.value;
INSERT INTO public.business_settings (key, value)
VALUES ('delivery_policy', '{"bite_drive_radius_km":5}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = business_settings.value || EXCLUDED.value;
UPDATE public.branches SET kitchen_latitude = 10.7016, kitchen_longitude = 102.1429, service_radius_km = 5;

SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;
UPDATE public.inventory SET current_stock = 999999;
DELETE FROM public.inventory_transactions;

-- riders: คนหนึ่ง available · คนหนึ่ง offline (ผูก user_id = JWT identity)
INSERT INTO public.drivers (id, name, phone, status, user_id, created_at, updated_at)
VALUES
  ('drv-210-available', 'C210 Rider Available', '0955555551', 'available', '210a0000-0000-0000-0000-000000000003', NOW(), NOW()),
  ('drv-210-offline',   'C210 Rider Offline',   '0955555552', 'available', '210a0000-0000-0000-0000-000000000004', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, user_id = EXCLUDED.user_id;
GRANT SELECT ON public.orders, public.delivery_assignments, public.drivers, public.audit_logs, public.order_status_history, public.dispatch_offers, public.notifications, public.delivery_rounds TO authenticated;

-- helper: SAME_DAY order + walk ถึง p_status (dropoff = ครัวจริง + 0.002°)
-- p_rider_user = uuid จริงของไรเดอร์ → claims เป็น UUID LITERAL เสมอ (แบบ 163 — ห้ามฝัง SQL ใน JSON)
CREATE OR REPLACE FUNCTION pg_temp.c210_make_order(p_rider_id text, p_rider_user uuid, p_status text)
RETURNS text AS $fn$
DECLARE
  v_on text; v_lat numeric; v_lon numeric; v_r jsonb;
BEGIN
  v_lat := (public.kitchen_location()->>'latitude')::numeric + 0.002;
  v_lon := (public.kitchen_location()->>'longitude')::numeric + 0.002;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000002","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_delivery_address => 'c210-' || substr(md5(random()::text), 1, 6),
    p_dropoff_latitude => v_lat, p_dropoff_longitude => v_lon,
    p_customer_name => 'C210', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL c210 order create'; END IF;

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000001","role":"authenticated"}', false);
  PERFORM public.transition_order_status(v_on, 'confirmed');
  PERFORM public.transition_order_status(v_on, 'preparing');
  PERFORM public.transition_order_status(v_on, 'ready_for_dispatch');

  IF p_status <> 'ready_for_dispatch' THEN
    PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => p_rider_id);
    PERFORM set_config('role', 'authenticated', false);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || p_rider_user::text || '","role":"authenticated"}', false);
    v_r := public.driver_accept_assignment(v_on, '');
    IF (v_r->>'status') <> 'accepted' THEN RAISE EXCEPTION 'FAIL c210 accept (%): %', p_status, v_r; END IF;
  END IF;

  IF p_status IN ('arrived') THEN
    -- (RESET ROLE อ่าน orders — ใต้ JWT ไรเดอร์โดน RLS บล็อก)
    RESET ROLE;
    SELECT dropoff_latitude, dropoff_longitude INTO v_lat, v_lon FROM public.orders WHERE order_number = v_on;
    PERFORM set_config('role', 'authenticated', false);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || p_rider_user::text || '","role":"authenticated"}', false);
    v_r := public.driver_checkin_arrival(v_on, v_lat, v_lon);
    IF (v_r->>'status') <> 'arrived' THEN RAISE EXCEPTION 'FAIL c210 checkin: %', v_r; END IF;
  END IF;
  RETURN v_on;
END $fn$ LANGUAGE plpgsql;

-- ============================================
-- G1. my_deliveries 5-arg executes (no 42703) + scheduled_date จาก delivery_rounds
-- ============================================
DO $$ DECLARE
  v_on text; v_json jsonb; v_sched date;
BEGIN
  v_on := pg_temp.c210_make_order('drv-210-available', '210a0000-0000-0000-0000-000000000003'::uuid, 'assigned');

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000003","role":"authenticated"}', false);

  -- 5-arg call (all NULL = no filters) — ต้องไม่โยน 42703 "column o.round_id does not exist"
  v_json := public.my_deliveries('', NULL, NULL, NULL, NULL);
  IF (v_json->>'ok') <> 'true' THEN RAISE EXCEPTION 'FAIL G1 my_deliveries ok=false: %', v_json; END IF;
  IF (v_json->'driver'->>'id') IS NULL THEN RAISE EXCEPTION 'FAIL G1 driver.id missing'; END IF;
  IF (v_json->'offers') IS NULL THEN RAISE EXCEPTION 'FAIL G1 offers array missing'; END IF;

  v_sched := (v_json->'assignments'->0->>'scheduled_date')::date;
  IF v_sched IS DISTINCT FROM (now() AT TIME ZONE 'Asia/Bangkok')::date THEN
    RAISE EXCEPTION 'FAIL G1 scheduled_date missing/mismatch: got % expected %',
      v_sched, (now() AT TIME ZONE 'Asia/Bangkok')::date;
  END IF;
  RAISE NOTICE 'PASS G1: my_deliveries 5-arg executes (no 42703) + scheduled_date = %', v_sched;
END $$;

-- ============================================
-- G2. Filter params (p_scheduled_from/to) work
--     (งานของ G1 ยังอยู่ใน tx เดียวกัน → นับแบบ >= เสมอ)
-- ============================================
DO $$ DECLARE
  v_json jsonb; v_count int;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000003","role":"authenticated"}', false);

  -- scheduled_from = พรุ่งนี้ → งานของวันนี้ทั้งหมดถูกกรองออก
  v_json := public.my_deliveries('', NULL, NULL, (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, NULL);
  IF (v_json->>'ok') <> 'true' THEN RAISE EXCEPTION 'FAIL G2 filter ok=false: %', v_json; END IF;
  v_count := jsonb_array_length(v_json->'assignments');
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL G2 scheduled_from tomorrow ต้องเหลือ 0: got %', v_count; END IF;

  -- scheduled_to = วันนี้ → งานวันนี้ต้องหลุดมาอย่างน้อย 1 (G1 + ของตัวเอง)
  v_json := public.my_deliveries('', NULL, NULL, NULL, (now() AT TIME ZONE 'Asia/Bangkok')::date);
  IF (v_json->>'ok') <> 'true' THEN RAISE EXCEPTION 'FAIL G2 filter ok=false: %', v_json; END IF;
  v_count := jsonb_array_length(v_json->'assignments');
  IF v_count < 1 THEN RAISE EXCEPTION 'FAIL G2 scheduled_to today ต้องมีอย่างน้อย 1: got %', v_count; END IF;

  RAISE NOTICE 'PASS G2: filter params scheduled_from/to work (future=0 · today>=1: %)', v_count;
END $$;

-- ============================================
-- G3. Offers มาผ่าน my_deliveries (JOIN ผ่าน o.delivery_round_id ถูกแล้ว)
-- ============================================
DO $$ DECLARE
  v_on text; v_json jsonb; v_offers_count int;
BEGIN
  -- ออเดอร์พร้อมจัดส่ง ยังไม่มอบหมาย → dispatch_order ประกาศเลย (แบบ 163 G2)
  v_on := pg_temp.c210_make_order('drv-210-available', '210a0000-0000-0000-0000-000000000003'::uuid, 'ready_for_dispatch');

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000001","role":"authenticated"}', false);
  PERFORM public.dispatch_order(v_on);

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000003","role":"authenticated"}', false);
  v_json := public.my_deliveries('', NULL, NULL, NULL, NULL);
  IF (v_json->>'ok') <> 'true' THEN RAISE EXCEPTION 'FAIL G3 my_deliveries ok=false: %', v_json; END IF;
  v_offers_count := jsonb_array_length(v_json->'offers');
  IF v_offers_count < 1 THEN RAISE EXCEPTION 'FAIL G3 offer ไม่มาใน my_deliveries (JOIN พัง?)'; END IF;
  IF (v_json->'offers'->0->>'scheduled_date') IS NULL THEN
    RAISE EXCEPTION 'FAIL G3 offer ขาด scheduled_date';
  END IF;
  RAISE NOTICE 'PASS G3: offers returned with scheduled_date = %', v_json->'offers'->0->>'scheduled_date';
END $$;

-- ============================================
-- G4. Offline gate — ERR_DRIVER_OFFLINE
--     (assign_driver พา status ไป busy เสมอ → force offline ด้วย superuser หลัง assign)
-- ============================================
DO $$ DECLARE
  v_on text; v_r jsonb;
BEGIN
  -- G4a: driver_accept_assignment ใต้สถานะ offline
  v_on := pg_temp.c210_make_order('drv-210-offline', '210a0000-0000-0000-0000-000000000004'::uuid, 'ready_for_dispatch');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000001","role":"authenticated"}', false);
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-210-offline');

  -- บังคับสถานะ offline (superuser — จำลอง "แอดมินพักงาน/ไรเดอร์ไม่ว่าง" ตอนมอบหมายแล้ว)
  RESET ROLE;
  UPDATE public.drivers SET status = 'offline' WHERE id = 'drv-210-offline';

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000004","role":"authenticated"}', false);
  BEGIN
    v_r := public.driver_accept_assignment(v_on, '');
    RAISE EXCEPTION 'FAIL G4a accept ต้อง ERR_DRIVER_OFFLINE แต่ได้: %', v_r;
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM LIKE '%ERR_DRIVER_OFFLINE%' THEN
        RAISE NOTICE 'PASS G4a: driver_accept_assignment offline gate → ERR_DRIVER_OFFLINE';
      ELSE RAISE; END IF;
  END;

  -- G4b: claim_dispatch_offer ใต้สถานะ offline (ยังไม่ flip busy เพราะ claim ไม่สำเร็จ)
  v_on := pg_temp.c210_make_order('drv-210-available', '210a0000-0000-0000-0000-000000000003'::uuid, 'ready_for_dispatch');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000001","role":"authenticated"}', false);
  PERFORM public.dispatch_order(v_on);

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000004","role":"authenticated"}', false);
  BEGIN
    v_r := public.claim_dispatch_offer(v_on);
    RAISE EXCEPTION 'FAIL G4b claim ต้อง ERR_DRIVER_OFFLINE แต่ได้: %', v_r;
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM LIKE '%ERR_DRIVER_OFFLINE%' THEN
        RAISE NOTICE 'PASS G4b: claim_dispatch_offer offline gate → ERR_DRIVER_OFFLINE';
      ELSE RAISE; END IF;
  END;
END $$;

-- ============================================
-- G5. 'arrived' auto-close — cancel_order (admin, 195) ตอน assignment='arrived'
--     → assignment ต้องปิดเป็น 'cancelled' (จุดแก้ m210: close_assignments + 'arrived')
-- ============================================
DO $$ DECLARE
  v_on text; v_asg_status text;
BEGIN
  v_on := pg_temp.c210_make_order('drv-210-available', '210a0000-0000-0000-0000-000000000003'::uuid, 'arrived');

  RESET ROLE;
  SELECT status::text INTO v_asg_status FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg_status IS DISTINCT FROM 'arrived' THEN
    RAISE EXCEPTION 'FAIL G5 setup: assignment ต้องเป็น arrived: %', v_asg_status;
  END IF;

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210a0000-0000-0000-0000-000000000001","role":"authenticated"}', false);
  PERFORM public.cancel_order(v_on, 'c210 test cancel arrived');

  RESET ROLE;
  SELECT status::text INTO v_asg_status FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg_status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'FAIL G5: arrived assignment ไม่ถูกปิดเมื่อยกเลิกออเดอร์: %', v_asg_status;
  END IF;
  RAISE NOTICE 'PASS G5: arrived assignment auto-closed on order cancel (%)', v_on;
END $$;

-- ============================================
-- G6. Ambiguity guards (0-arg/1-arg resolve unambiguously)
--     สมบัติที่พิสูจน์ = resolve ได้ "ตัวเดียว" (ไม่โยน 42725 ambiguous_function)
--     ผลลัพธ์ auth อะไรก็ได้ (ERR_NOT_AUTHENTICATED / ERR_NOT_A_DRIVER — claims อาจค้างจาก G5)
-- ============================================
DO $$ BEGIN
  PERFORM public.my_deliveries();
  RAISE EXCEPTION 'FAIL G6a 0-arg ต้องไม่สำเร็จ (ไม่มี JWT)';
EXCEPTION
  WHEN ambiguous_function THEN
    RAISE EXCEPTION 'FAIL G6a 0-arg ambiguous_function (42725) — overload ซ้ำ';
  WHEN OTHERS THEN
    RAISE NOTICE 'PASS G6a: 0-arg resolves unambiguously (%)', SQLERRM;
END $$;

DO $$ BEGIN
  PERFORM public.my_deliveries('0000000000'::text);
  RAISE EXCEPTION 'FAIL G6b 1-arg ต้องไม่สำเร็จ (ไม่มี JWT ของไรเดอร์)';
EXCEPTION
  WHEN ambiguous_function THEN
    RAISE EXCEPTION 'FAIL G6b 1-arg ambiguous_function (42725) — overload ซ้ำ';
  WHEN OTHERS THEN
    RAISE NOTICE 'PASS G6b: 1-arg resolves unambiguously (%)', SQLERRM;
END $$;

-- ============================================
-- DONE — discard every test-created row
-- ============================================
RESET ROLE;
ROLLBACK;
-- ========== END OF CONTRACT 210 ==========