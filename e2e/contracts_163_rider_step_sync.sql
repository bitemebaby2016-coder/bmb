-- ============================================
-- Bite Me Baby — SQL Contract: Migration 163 rider step-sync + check-in + auto-close
-- Date: 2026-10-27 · Run on ephemeral PG17 (apply_all_migrations.sh) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves (ตามที่ Owner สั่ง 2026-10-27):
--   G1  accept → orders.status = 'dispatched' ('เริ่มจัดส่ง') ทันที + แจ้งเตือน (161)
--       [เดิม accept ไม่แตะ orders.status = ต้นตอ "ยังพร้อมจัดส่งอยู่"]
--   G2  claim_dispatch_offer → 'dispatched' เช่นกัน (claim = accept ในตัว)
--   G3  driver_checkin_arrival ในรัศมี 300 ม. → 'arrived' ('ถึงปลายทาง') + หลักฐาน
--       check-in · ห่างเกิน 300 ม. → ERR_GEOFENCE (ห้ามหลุดพื้นที่)
--   G4  ครบเงื่อนไข (ในพื้นที่ + มีรูป) → delivered ปิดวงจรอัตโนมัติ:
--       order='delivered' + assignment='delivered' + driver='available'
--       โดยไม่เรียก admin_advance — แอดมินไม่ต้องกดปิดวงจรซ้ำ
--   G5  security: driver_checkin_arrival EXECUTE authenticated-only, non-driver rejected
-- ============================================

BEGIN;
RESET ROLE;

-- fixtures (แบบ 036): admin/customer/rider + kitchen/dropoff
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a6a', 'c163-admin@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('7b7b7b7b-7b7b-7b7b-7b7b-7b7b7b7b7b7b', 'c163-cust@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('8c8c8c8c-8c8c-8c8c-8c8c-8c8c8c8c8c8c', 'c163-rider1@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin' WHERE id = '6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a6a';
UPDATE public.profiles SET role = 'customer' WHERE id IN ('7b7b7b7b-7b7b-7b7b-7b7b-7b7b7b7b7b7b', '8c8c8c8c-8c8c-8c8c-8c8c-8c8c8c8c8c8c');

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

INSERT INTO public.drivers (id, name, phone, status, created_at, updated_at)
VALUES ('drv-163-1', 'C163 Rider', '0955555555', 'available', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
UPDATE public.drivers SET user_id = '8c8c8c8c-8c8c-8c8c-8c8c-8c8c8c8c8c8c' WHERE id = 'drv-163-1';
GRANT SELECT ON public.orders, public.delivery_assignments, public.drivers, public.audit_logs, public.order_status_history, public.dispatch_offers, public.notifications TO authenticated;

-- helper: SAME_DAY order + walk ถึง ready_for_dispatch (dropoff = ครัวจริง + 0.002°)
CREATE OR REPLACE FUNCTION pg_temp.c163_make_order(p_addr text) RETURNS text AS $fn$
DECLARE v_on text; v_lat numeric; v_lon numeric;
BEGIN
  v_lat := (public.kitchen_location()->>'latitude')::numeric + 0.002;
  v_lon := (public.kitchen_location()->>'longitude')::numeric + 0.002;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"7b7b7b7b-7b7b-7b7b-7b7b-7b7b7b7b7b7b","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_delivery_address => p_addr,
    p_dropoff_latitude => v_lat, p_dropoff_longitude => v_lon,
    p_customer_name => 'C163', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL c163 order create (%)', p_addr; END IF;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a6a","role":"authenticated"}', false);
  PERFORM public.transition_order_status(v_on, 'confirmed');
  PERFORM public.transition_order_status(v_on, 'preparing');
  PERFORM public.transition_order_status(v_on, 'ready_for_dispatch');
  RETURN v_on;
END $fn$ LANGUAGE plpgsql;

-- ============================================
-- G1. ACCEPT → 'dispatched' ทันที (ต้นตอที่ Owner เจอ: เดิม accept ไม่แตะ orders.status)
-- ============================================
DO $$ DECLARE
  v_on text; v_ord text; v_n int; v_r jsonb;
BEGIN
  v_on := pg_temp.c163_make_order('c163-g1');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a6a","role":"authenticated"}', false);
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-163-1');

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"8c8c8c8c-8c8c-8c8c-8c8c-8c8c8c8c8c8c","role":"authenticated"}', false);
  v_r := public.driver_accept_assignment(v_on, '');
  IF (v_r->>'status') <> 'accepted' THEN RAISE EXCEPTION 'FAIL G1 accept: %', v_r; END IF;

  -- (RESET ROLE อ่าน orders — ใต้ JWT ไรเดอร์โดน RLS บล็อก → ค่า NULL = assertion กลวง)
  RESET ROLE;
  SELECT status::text INTO v_ord FROM public.orders WHERE order_number = v_on;
  IF v_ord IS DISTINCT FROM 'dispatched' THEN
    RAISE EXCEPTION 'FAIL G1 accept ไม่เดินสถานะ (ต้อง dispatched เริ่มจัดส่ง): got %', v_ord;
  END IF;

  -- แจ้งเตือนต้องยิง (161 trigger) ตั้งแต่ก้าวแรก — แอดมิน+ลูกค้าเห็นตรงกัน
  RESET ROLE;
  SELECT COUNT(*) INTO v_n FROM public.notifications
   WHERE notification_type = 'ORDER_DISPATCHED' AND message LIKE '%' || v_on || '%';
  IF v_n < 1 THEN RAISE EXCEPTION 'FAIL G1 ไม่มีแจ้งเตือน ORDER_DISPATCHED ตอน accept'; END IF;
  RAISE NOTICE 'PASS G1 accept -> dispatched + แจ้งเตือน (%)', v_on;
END $$;

-- ============================================
-- G2. claim_dispatch_offer → 'dispatched' (claim = accept ในตัว)
-- ============================================
DO $$ DECLARE
  v_on text; v_ord text; v_r jsonb;
BEGIN
  v_on := pg_temp.c163_make_order('c163-g2');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a6a","role":"authenticated"}', false);
  PERFORM public.dispatch_order(v_on);

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"8c8c8c8c-8c8c-8c8c-8c8c-8c8c8c8c8c8c","role":"authenticated"}', false);
  v_r := public.claim_dispatch_offer(v_on);
  IF (v_r->>'status') <> 'accepted' THEN RAISE EXCEPTION 'FAIL G2 claim: %', v_r; END IF;

  -- (RESET ROLE อ่าน orders — ใต้ JWT ไรเดอร์โดน RLS บล็อก → ค่า NULL = assertion กลวง)
  RESET ROLE;
  SELECT status::text INTO v_ord FROM public.orders WHERE order_number = v_on;
  IF v_ord IS DISTINCT FROM 'dispatched' THEN
    RAISE EXCEPTION 'FAIL G2 claim ไม่เดินสถานะ (ต้อง dispatched): got %', v_ord;
  END IF;
  RAISE NOTICE 'PASS G2 claim -> dispatched (%)', v_on;
END $$;

-- ============================================
-- G3. CHECK-IN: ในรัศมี 300 ม. -> 'arrived' · ห่างเกิน -> ERR_GEOFENCE
-- ============================================
DO $$ DECLARE
  v_on text; v_ord text; v_r jsonb; v_lat numeric; v_lon numeric;
BEGIN
  v_on := pg_temp.c163_make_order('c163-g3');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a6a","role":"authenticated"}', false);
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-163-1');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"8c8c8c8c-8c8c-8c8c-8c8c-8c8c8c8c8c8c","role":"authenticated"}', false);
  PERFORM public.driver_accept_assignment(v_on, '');

  -- ห่างเกิน 300 ม. (ประมาณ +0.05° ≈ 5+ กม.) ต้องถูกปฏิเสธ
  BEGIN
    v_lat := (public.kitchen_location()->>'latitude')::numeric + 0.05;
    v_lon := (public.kitchen_location()->>'longitude')::numeric + 0.05;
    PERFORM public.driver_checkin_arrival(v_on, v_lat, v_lon);
    RAISE EXCEPTION 'FAIL G3 geofence ห่างเกินยังผ่าน';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_GEOFENCE%' THEN RAISE; END IF;
  END;

  -- ในรัศมี (พิกัด dropoff ตรง ๆ) -> 'arrived' + หลักฐาน check-in
  -- (RESET ROLE ก่อนอ่าน orders — ใต้ JWT ไรเดอร์โดน RLS orders บล็อก → ค่า NULL)
  RESET ROLE;
  SELECT dropoff_latitude, dropoff_longitude INTO v_lat, v_lon FROM public.orders WHERE order_number = v_on;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"8c8c8c8c-8c8c-8c8c-8c8c-8c8c8c8c8c8c","role":"authenticated"}', false);
  v_r := public.driver_checkin_arrival(v_on, v_lat, v_lon);
  IF (v_r->>'status') <> 'arrived' THEN RAISE EXCEPTION 'FAIL G3 checkin: %', v_r; END IF;
  RESET ROLE;
  SELECT status::text INTO v_ord FROM public.orders WHERE order_number = v_on;
  IF v_ord IS DISTINCT FROM 'arrived' THEN RAISE EXCEPTION 'FAIL G3 สถานะต้อง arrived (ถึงปลายทาง): got %', v_ord; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_assignments
                  WHERE order_number = v_on AND arrived_at IS NOT NULL AND checkin_latitude IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL G3 ไม่มีหลักฐาน check-in';
  END IF;
  RAISE NOTICE 'PASS G3 check-in geofence: ในรัศมี -> arrived · ห่างเกิน -> ERR_GEOFENCE (%)', v_on;
END $$;

-- ============================================
-- G4. ครบเงื่อนไข (ในพื้นที่ + มีรูป) = ปิดวงจรอัตโนมัติ — ไม่ต้องเรียก admin_advance
-- ============================================
DO $$ DECLARE
  v_on text; v_ord text; v_asg text; v_drv text; v_lat numeric; v_lon numeric;
BEGIN
  v_on := pg_temp.c163_make_order('c163-g4');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a6a","role":"authenticated"}', false);
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-163-1');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"8c8c8c8c-8c8c-8c8c-8c8c-8c8c8c8c8c8c","role":"authenticated"}', false);
  PERFORM public.driver_accept_assignment(v_on, '');
  -- (RESET ROLE ก่อนอ่าน orders — ใต้ JWT ไรเดอร์โดน RLS orders บล็อก → ค่า NULL)
  RESET ROLE;
  SELECT dropoff_latitude, dropoff_longitude INTO v_lat, v_lon FROM public.orders WHERE order_number = v_on;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"8c8c8c8c-8c8c-8c8c-8c8c-8c8c8c8c8c8c","role":"authenticated"}', false);
  PERFORM public.driver_checkin_arrival(v_on, v_lat, v_lon);

  -- ไม่มีรูป = ปิดไม่ได้ (เงื่อนไข "มีรูป")
  BEGIN
    PERFORM public.driver_update_delivery_status(v_on, '', 'delivered');
    RAISE EXCEPTION 'FAIL G4 ปิดงานโดยไม่มีรูปสำเร็จ (ต้อง ERR_POD_REQUIRED)';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_POD_REQUIRED%' THEN RAISE; END IF;
  END;

  PERFORM public.driver_attach_pod(v_on, 'drv-163-1/' || v_on || '-pod.jpg', v_lat, v_lon);
  PERFORM public.driver_update_delivery_status(v_on, '', 'delivered', v_lat, v_lon);

  -- (RESET ROLE อ่านผลลัพธ์ — ใต้ JWT ไรเดอร์โดน RLS บล็อก = assertion กลวง)
  RESET ROLE;
  SELECT status::text INTO v_ord FROM public.orders WHERE order_number = v_on;
  SELECT status::text INTO v_asg FROM public.delivery_assignments WHERE order_number = v_on;
  SELECT status::text INTO v_drv FROM public.drivers WHERE id = 'drv-163-1';
  IF v_ord <> 'delivered' THEN RAISE EXCEPTION 'FAIL G4 order ไม่ปิด: %', v_ord; END IF;
  IF v_asg <> 'delivered' THEN RAISE EXCEPTION 'FAIL G4 assignment ไม่ปิด: %', v_asg; END IF;
  IF v_drv <> 'available' THEN RAISE EXCEPTION 'FAIL G4 driver ไม่ถูกปล่อย (ปิดวงจรไม่ครบ): %', v_drv; END IF;
  RAISE NOTICE 'PASS G4 auto-close: order+assignment=delivered · driver=available โดยไม่ใช้ admin_advance (%)', v_on;
END $$;

-- ============================================
-- G5. SECURITY — driver_checkin_arrival: authenticated-only + non-driver rejected
-- ============================================
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.driver_checkin_arrival(text,numeric,numeric)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL G5 anon ต้อง execute driver_checkin_arrival ไม่ได้';
  END IF;
  IF has_function_privilege('authenticated', 'public.driver_checkin_arrival(text,numeric,numeric)', 'EXECUTE') = false THEN
    RAISE EXCEPTION 'FAIL G5 authenticated ต้อง execute driver_checkin_arrival ได้';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.driver_checkin_arrival(text,numeric,numeric)'::regprocedure) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL G5 driver_checkin_arrival ต้องเป็น SECURITY DEFINER';
  END IF;

  -- customer (ไม่ใช่ไรเดอร์) เช็คอินไม่ได้
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"7b7b7b7b-7b7b-7b7b-7b7b-7b7b7b7b7b7b","role":"authenticated"}', false);
  BEGIN
    PERFORM public.driver_checkin_arrival('c163-g5-none', 10.7016, 102.1429);
    RAISE EXCEPTION 'FAIL G5 non-driver checkin accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NOT_A_DRIVER%' THEN RAISE; END IF;
  END;
  RESET ROLE;
  RAISE NOTICE 'PASS G5 security: authenticated-only + non-driver rejected';
END $$;

-- ============================================
-- DONE — discard every test-created row
-- ============================================
RESET ROLE;
ROLLBACK;