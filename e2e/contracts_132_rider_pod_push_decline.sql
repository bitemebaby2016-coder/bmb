-- ============================================
-- Bite Me Baby — SQL Contract: Migration 132 rider POD + push + decline/cancel
-- Date: 2026-10-20 · Run on ephemeral PG17 (apply_all_migrations.sh) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves:
--   G1  driver_decline_assignment: 'assigned' → 'declined' + reason + audit;
--       reassign via assign_driver resets POD/decline/cancel fields (ON CONFLICT)
--   G2  admin_cancel_assignment: active → 'cancelled' + reason + audit + driver freed
--   G3  order cancelled/failed → active assignment auto-closed (history preserved)
--   G4  driver_attach_pod guards: own-folder path only; closed assignment rejected;
--       delivered requires POD (ERR_POD_REQUIRED) — see also contracts_036 G1-POD
--   G5  push audience: register driver/customer split; claim = service_role only
--   G6  new RPCs: SECURITY DEFINER + authenticated EXECUTE, no anon
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- 0. FIXTURES (admin / rider1 / rider2 / customer + linked driver rows)
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('61616161-6161-6161-6161-616161616161', 'c132-admin@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('62626262-6262-6262-6262-626262626262', 'c132-rider1@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('63636363-6363-6363-6363-636363636363', 'c132-rider2@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('64646464-6464-6464-6464-646464646464', 'c132-cust@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, created_at, updated_at)
VALUES
  ('61616161-6161-6161-6161-616161616161', 'admin', now(), now()),
  ('62626262-6262-6262-6262-626262626262', 'customer', now(), now()),
  ('63636363-6363-6363-6363-636363636363', 'customer', now(), now()),
  ('64646464-6464-6464-6464-646464646464', 'customer', now(), now())
ON CONFLICT (id) DO NOTHING;
-- trigger อาจสร้าง profile ไว้ก่อน (handle_new_user) — บังคับ role ให้ตรง fixture
UPDATE public.profiles SET role = 'admin'    WHERE id = '61616161-6161-6161-6161-616161616161';
UPDATE public.profiles SET role = 'customer' WHERE id IN (
  '62626262-6262-6262-6262-626262626262',
  '63636363-6363-6363-6363-636363636363',
  '64646464-6464-6464-6464-646464646464');

-- harness parity: Supabase มี default table grants ให้ authenticated (RLS คุมแถว);
-- prelude ของ replay ไม่มี → ให้สิทธิ์ชั่วคราวใน transaction นี้ (ROLLBACK ตอนจบ)
GRANT SELECT ON public.orders, public.delivery_assignments, public.drivers, public.audit_logs, public.order_status_history, public.push_subscriptions TO authenticated;

INSERT INTO public.drivers (id, name, phone, status, created_at, updated_at)
VALUES ('drv-132-a', 'C132 Rider A', '0911111111', 'available', NOW(), NOW()),
       ('drv-132-b', 'C132 Rider B', '0922222222', 'available', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
UPDATE public.drivers SET user_id = '62626262-6262-6262-6262-626262626262' WHERE id = 'drv-132-a';
UPDATE public.drivers SET user_id = '63636363-6363-6363-6363-636363636363' WHERE id = 'drv-132-b';

SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', same_day_cutoff = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;
UPDATE public.inventory SET current_stock = 999999;
DELETE FROM public.inventory_transactions;

-- helper: สร้างออเดอร์ SAME_DAY พร้อมเดินไป ready_for_dispatch (แบบ 036 G1)
CREATE OR REPLACE FUNCTION pg_temp.c132_make_order(p_addr text) RETURNS text AS $fn$
DECLARE v_on text; v_lat numeric; v_lon numeric;
BEGIN
  -- พิกัด dropoff = ครัวจริงใน DB + 0.002° (ห้าม hardcode — kitchen ย้ายได้; แบบ 124)
  v_lat := (public.kitchen_location()->>'latitude')::numeric + 0.002;
  v_lon := (public.kitchen_location()->>'longitude')::numeric + 0.002;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"64646464-6464-6464-6464-646464646464","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_delivery_address => p_addr,
    p_dropoff_latitude => v_lat, p_dropoff_longitude => v_lon,
    p_customer_name => 'C132', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL c132 order create (%)', p_addr; END IF;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"61616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  PERFORM public.transition_order_status(v_on, 'confirmed');
  PERFORM public.transition_order_status(v_on, 'preparing');
  PERFORM public.transition_order_status(v_on, 'ready_for_dispatch');
  RETURN v_on;
END $fn$ LANGUAGE plpgsql;

-- ============================================
-- G1. DECLINE + REASSIGN RESET
-- ============================================
DO $$ DECLARE
  v_on text; v_asg text; v_rsn text; v_drv text; v_n int;
BEGIN
  v_on := pg_temp.c132_make_order('c132-g1');

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"61616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-132-a');

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"62626262-6262-6262-6262-626262626262","role":"authenticated"}', false);
  PERFORM public.driver_decline_assignment(v_on, 'test-decline-reason');

  SELECT status::text, decline_reason INTO v_asg, v_rsn FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg <> 'declined' THEN RAISE EXCEPTION 'FAIL G1 expected declined, got %', v_asg; END IF;
  IF v_rsn <> 'test-decline-reason' THEN RAISE EXCEPTION 'FAIL G1 reason not stored: %', v_rsn; END IF;
  RESET ROLE; -- audit_logs = admin-scoped — อ่านแบบ global เพื่อตรวจว่ามีแถวจริง
  SELECT COUNT(*) INTO v_n FROM public.audit_logs WHERE action = 'delivery_declined' AND entity_id = v_on;
  IF v_n < 1 THEN RAISE EXCEPTION 'FAIL G1 no audit row'; END IF;

  -- reassign → ON CONFLICT reset (132): decline/POD fields cleared, status=assigned
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"61616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-132-b');
  SELECT status::text, driver_id, decline_reason INTO v_asg, v_drv, v_rsn FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg <> 'assigned' OR v_drv <> 'drv-132-b' THEN RAISE EXCEPTION 'FAIL G1 reassign: %/%', v_asg, v_drv; END IF;
  IF v_rsn IS NOT NULL THEN RAISE EXCEPTION 'FAIL G1 decline_reason not reset'; END IF;

  -- ป้องกันรับซ้ำ/หลังปฏิเสธ: rider2 รับซ้ำหลังเปลี่ยนสถานะแล้วต้องไม่สำเร็จเกิน 1 ครั้ง
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"63636363-6363-6363-6363-636363636363","role":"authenticated"}', false);
  PERFORM public.driver_accept_assignment(v_on, '');
  BEGIN
    PERFORM public.driver_accept_assignment(v_on, '');
    RAISE EXCEPTION 'FAIL G1 double-accept not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ASSIGNMENT_NOT_ACCEPTABLE%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS G1 decline + reason + audit + reassign reset + single-accept (%)', v_on;
END $$;

-- ============================================
-- G2. ADMIN CANCEL (history preserved)
-- ============================================
DO $$ DECLARE
  v_on text; v_asg text; v_drv_status text;
BEGIN
  v_on := pg_temp.c132_make_order('c132-g2');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"61616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-132-a');

  -- rider ห้ามยกเลิกเอง (ERR_FORBIDDEN)
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"62626262-6262-6262-6262-626262626262","role":"authenticated"}', false);
  BEGIN
    PERFORM public.admin_cancel_assignment(v_on, 'nope');
    RAISE EXCEPTION 'FAIL G2 rider cancelled an assignment';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"61616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  PERFORM public.admin_cancel_assignment(v_on, 'switching-rider');
  SELECT status::text, cancel_reason INTO v_asg, v_drv_status FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg <> 'cancelled' THEN RAISE EXCEPTION 'FAIL G2 expected cancelled, got %', v_asg; END IF;
  IF v_drv_status <> 'switching-rider' THEN RAISE EXCEPTION 'FAIL G2 cancel_reason missing'; END IF;
  -- แถว assignment ยังอยู่ (ประวัติไม่หาย)
  IF NOT EXISTS (SELECT 1 FROM public.delivery_assignments WHERE order_number = v_on) THEN
    RAISE EXCEPTION 'FAIL G2 assignment row deleted';
  END IF;
  RAISE NOTICE 'PASS G2 admin cancel + reason + history preserved (%)', v_on;
END $$;

-- ============================================
-- G3. ORDER TERMINAL → ACTIVE ASSIGNMENT AUTO-CLOSED
-- ============================================
DO $$ DECLARE
  v_on text; v_asg text; v_rsn text;
BEGIN
  v_on := pg_temp.c132_make_order('c132-g3');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"61616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-132-a');
  PERFORM public.transition_order_status(v_on, 'cancelled');
  SELECT status::text, cancel_reason INTO v_asg, v_rsn FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg <> 'cancelled' THEN RAISE EXCEPTION 'FAIL G3 expected auto-cancelled, got %', v_asg; END IF;
  IF v_rsn <> 'order_cancelled' THEN RAISE EXCEPTION 'FAIL G3 reason = %', v_rsn; END IF;
  RAISE NOTICE 'PASS G3 order terminal auto-closes assignment (history kept) (%)', v_on;
END $$;

-- ============================================
-- G4. POD GUARDS (path scope + closed assignment + delivered gate)
-- ============================================
DO $$ DECLARE
  v_on text; v_pod text;
BEGIN
  v_on := pg_temp.c132_make_order('c132-g4');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"61616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-132-a');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"62626262-6262-6262-6262-626262626262","role":"authenticated"}', false);
  PERFORM public.driver_accept_assignment(v_on, '');

  -- path ของคนอื่น (โฟลเดอร์ไม่ใช่ของตน) → ERR_POD_PATH_FORBIDDEN
  BEGIN
    PERFORM public.driver_attach_pod(v_on, 'drv-132-b/evil.jpg', NULL, NULL);
    RAISE EXCEPTION 'FAIL G4 foreign pod path accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_POD_PATH_FORBIDDEN%' THEN RAISE; END IF;
  END;

  PERFORM public.driver_attach_pod(v_on, 'drv-132-a/' || v_on || '-pod.jpg', 10.7016, 102.1429);
  SELECT proof_of_delivery_path INTO v_pod FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_pod IS NULL THEN RAISE EXCEPTION 'FAIL G4 pod path not recorded'; END IF;

  -- ปิดงานแล้ว attach ซ้ำไม่ได้ (ERR_ASSIGNMENT_CLOSED)
  PERFORM public.driver_update_delivery_status(v_on, '', 'delivered');
  BEGIN
    PERFORM public.driver_attach_pod(v_on, 'drv-132-a/late.jpg', NULL, NULL);
    RAISE EXCEPTION 'FAIL G4 attach after close accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ASSIGNMENT_CLOSED%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS G4 pod path guard + record + closed-assignment guard (%)', v_on;
END $$;

-- ============================================
-- G5. PUSH AUDIENCE (driver vs customer) + claim/unregister guards
-- ============================================
DO $$ DECLARE
  v_c text; v_d text; v_id text;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"62626262-6262-6262-6262-626262626262","role":"authenticated"}', false);
  v_id := (public.register_push_subscription('https://push.test/endpoint-132-driver-aaaaaaaaaaaaaaaaaaaaaa', 'p256dh-x', 'auth-x', 'test', 'driver')->>'id');
  SELECT customer_id, driver_id INTO v_c, v_d FROM public.push_subscriptions WHERE id = v_id;
  IF v_d IS DISTINCT FROM 'drv-132-a' OR v_c IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL G5 driver audience row wrong: %/%', v_c, v_d;
  END IF;

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"64646464-6464-6464-6464-646464646464","role":"authenticated"}', false);
  v_id := (public.register_push_subscription('https://push.test/endpoint-132-customer-bbbbbbbbbbbbbbbbbbbbbb', 'p256dh-y', 'auth-y', 'test', 'customer')->>'id');
  SELECT customer_id, driver_id INTO v_c, v_d FROM public.push_subscriptions WHERE id = v_id;
  IF v_c IS NULL OR v_d IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL G5 customer audience row wrong: %/%', v_c, v_d;
  END IF;

  -- audience CHECK (132): ทุกแถวต้องมี customer_id XOR driver_id (อ่านแบบ global)
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE (customer_id IS NULL) = (driver_id IS NULL)) THEN
    RAISE EXCEPTION 'FAIL G5 audience CHECK violated';
  END IF;

  -- claim ฝั่ง driver = service_role ONLY
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"62626262-6262-6262-6262-626262626262","role":"authenticated"}', false);
  BEGIN
    PERFORM public.claim_push_driver_targets('drv-132-a', 5);
    RAISE EXCEPTION 'FAIL G5 claim_push_driver_targets ran as authenticated';
  EXCEPTION WHEN OTHERS THEN
    -- ได้ทั้ง ERR_FORBIDDEN (จากฟังก์ชัน) และ permission denied (จาก GRANT revoke)
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;

  -- unregister: ลบได้เฉพาะของตน — rider1 แตะ subscription ของลูกค้าคนอื่นไม่ได้
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"62626262-6262-6262-6262-626262626262","role":"authenticated"}', false);
  PERFORM public.unregister_push_subscription(NULL, 'https://push.test/endpoint-132-customer-bbbbbbbbbbbbbbbbbbbbbb');
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE endpoint = 'https://push.test/endpoint-132-customer-bbbbbbbbbbbbbbbbbbbbbb') THEN
    RAISE EXCEPTION 'FAIL G5 cross-account unregister deleted a foreign row';
  END IF;
  RAISE NOTICE 'PASS G5 push audience split + claim service-role-only + unregister ownership';
END $$;

-- ============================================
-- G6. SECURITY (SECURITY DEFINER + authenticated EXECUTE, no anon)
-- ============================================
DO $$ BEGIN
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.driver_decline_assignment(text,text)'::regprocedure)
     IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G6 driver_decline not SECURITY DEFINER'; END IF;
  IF (SELECT has_function_privilege('anon', 'public.driver_decline_assignment(text,text)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'FAIL G6 anon has EXECUTE on driver_decline_assignment'; END IF;
  IF (SELECT has_function_privilege('anon', 'public.admin_cancel_assignment(text,text)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'FAIL G6 anon has EXECUTE on admin_cancel_assignment'; END IF;
  IF (SELECT has_function_privilege('anon', 'public.driver_attach_pod(text,text,numeric,numeric)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'FAIL G6 anon has EXECUTE on driver_attach_pod'; END IF;
  IF (SELECT has_function_privilege('authenticated', 'public.claim_push_driver_targets(text,integer)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'FAIL G6 authenticated has EXECUTE on claim_push_driver_targets'; END IF;
  RAISE NOTICE 'PASS G6 security: definer + authenticated-only EXECUTE on new RPCs';
END $$;

-- ============================================
-- DONE — discard every test-created row
-- ============================================
RESET ROLE;
ROLLBACK;