-- ============================================
-- Bite Me Baby — SQL Contract: Migration 135 dispatch offers (E1 ประกาศ-รับงาน)
-- Date: 2026-10-22 · Run on ephemeral PG17 (apply_all_migrations.sh) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves:
--   G1  dispatch_order (admin) = ประกาศ 1 แถว/ออเดอร์; ประกาศซ้ำ = รอบใหม่
--       (เคลียร์ claim/decline ของรอบก่อน)
--   G2  claim_dispatch_offer = คนแรกรับ = จองคนเดียว (atomic) — assignment
--       เกิดเป็น 'accepted' ทันที (การรับงาน = trigger สถานะ) · คนสองได้
--       ERR_OFFER_NOT_AVAILABLE
--   G3  assign_driver ตรงระหว่างประกาศ = แอดมินชนะ → offer ถูกปิดอัตโนมัติ
--   G4  driver_decline_offer = ต่อคน (คนอื่นยังเห็น/รับได้)
--   G5  cancel_dispatch_offer (admin) + ออเดอร์จบทาง → offer ปิดอัตโนมัติ
--   G6  my_deliveries คืน offers[] เฉพาะที่ยังว่างและฉันไม่ได้ปฏิเสธ
--   G7  security: SECURITY DEFINER + authenticated EXECUTE, ไม่มี anon,
--       non-admin dispatch ไม่ได้, non-driver claim ไม่ได้
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- 0. FIXTURES (admin / rider1 / rider2 / customer + linked driver rows)
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('71616161-6161-6161-6161-616161616161', 'c135-admin@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('72626262-6262-6262-6262-626262626262', 'c135-rider1@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('73636363-6363-6363-6363-636363636363', 'c135-rider2@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('74646464-6464-6464-6464-646464646464', 'c135-cust@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, created_at, updated_at)
VALUES
  ('71616161-6161-6161-6161-616161616161', 'admin', now(), now()),
  ('72626262-6262-6262-6262-626262626262', 'customer', now(), now()),
  ('73636363-6363-6363-6363-636363636363', 'customer', now(), now()),
  ('74646464-6464-6464-6464-646464646464', 'customer', now(), now())
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin'    WHERE id = '71616161-6161-6161-6161-616161616161';
UPDATE public.profiles SET role = 'customer' WHERE id IN (
  '72626262-6262-6262-6262-626262626262',
  '73636363-6363-6363-6363-636363636363',
  '74646464-6464-6464-6464-646464646464');

GRANT SELECT ON public.orders, public.delivery_assignments, public.drivers, public.audit_logs, public.order_status_history, public.dispatch_offers, public.dispatch_offer_declines TO authenticated;

INSERT INTO public.drivers (id, name, phone, status, created_at, updated_at)
VALUES ('drv-135-a', 'C135 Rider A', '0933333333', 'available', NOW(), NOW()),
       ('drv-135-b', 'C135 Rider B', '0944444444', 'available', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
UPDATE public.drivers SET user_id = '72626262-6262-6262-6262-626262626262' WHERE id = 'drv-135-a';
UPDATE public.drivers SET user_id = '73636363-6363-6363-6363-636363636363' WHERE id = 'drv-135-b';

SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;
UPDATE public.inventory SET current_stock = 999999;
DELETE FROM public.inventory_transactions;

-- helper: ออเดอร์ SAME_DAY พร้อมเดินถึง ready_for_dispatch (แบบ 132)
-- พิกัด dropoff = ครัวจริงใน DB + 0.002° (~0.3 กม. — อยู่ใน radius 5 กม. และ zone 0-5)
-- ห้าม hardcode พิกัด — kitchen ย้ายได้ (แบบ 124 ที่แก้ปัญหานี้ไว้แล้ว)
CREATE OR REPLACE FUNCTION pg_temp.c135_make_order(p_addr text) RETURNS text AS $fn$
DECLARE v_on text; v_lat numeric; v_lon numeric;
BEGIN
  v_lat := (public.kitchen_location()->>'latitude')::numeric + 0.002;
  v_lon := (public.kitchen_location()->>'longitude')::numeric + 0.002;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"74646464-6464-6464-6464-646464646464","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_delivery_address => p_addr,
    p_dropoff_latitude => v_lat, p_dropoff_longitude => v_lon,
    p_customer_name => 'C135', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL c135 order create (%)', p_addr; END IF;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"71616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  PERFORM public.transition_order_status(v_on, 'confirmed');
  PERFORM public.transition_order_status(v_on, 'preparing');
  PERFORM public.transition_order_status(v_on, 'ready_for_dispatch');
  RETURN v_on;
END $fn$ LANGUAGE plpgsql;

-- helper: ตั้ง JWT ให้เป็น actor ตาม uuid ที่ระบุ
CREATE OR REPLACE FUNCTION pg_temp.c135_as(p_uid uuid) RETURNS void AS $fn$
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"' || p_uid::text || '","role":"authenticated"}', false);
END $fn$ LANGUAGE plpgsql;

-- ============================================
-- G1. dispatch_order = ประกาศ 1 แถว/ออเดอร์ + ประกาศซ้ำ = รอบใหม่
-- ============================================
DO $$ DECLARE
  v_on text; v_status text; v_n int; v_id1 text; v_id2 text;
BEGIN
  v_on := pg_temp.c135_make_order('c135-g1');
  PERFORM pg_temp.c135_as('71616161-6161-6161-6161-616161616161'::uuid);
  PERFORM public.dispatch_order(v_on);
  SELECT status::text, id INTO v_status, v_id1 FROM public.dispatch_offers WHERE order_number = v_on;
  IF v_status <> 'offered' THEN RAISE EXCEPTION 'FAIL G1 expected offered, got %', v_status; END IF;

  -- rider1 ปฏิเสธ → แถว decline ติดกับ offer รอบนี้
  PERFORM pg_temp.c135_as('72626262-6262-6262-6262-626262626262'::uuid);
  PERFORM public.driver_decline_offer(v_on);
  SELECT COUNT(*) INTO v_n FROM public.dispatch_offer_declines WHERE offer_id = v_id1;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL G1 decline row missing'; END IF;

  -- ประกาศซ้ำ = รอบใหม่: เคลียร์ decline + rider_pushed_at + status กลับ offered
  PERFORM pg_temp.c135_as('71616161-6161-6161-6161-616161616161'::uuid);
  PERFORM public.dispatch_order(v_on);
  SELECT status::text, id INTO v_status, v_id2 FROM public.dispatch_offers WHERE order_number = v_on;
  IF v_status <> 'offered' THEN RAISE EXCEPTION 'FAIL G1 re-announce status %', v_status; END IF;
  IF v_id2 <> v_id1 THEN RAISE EXCEPTION 'FAIL G1 re-announce must reuse the single row (UNIQUE order_number)'; END IF;
  SELECT COUNT(*) INTO v_n FROM public.dispatch_offer_declines WHERE offer_id = v_id2;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL G1 re-announce must clear declines'; END IF;
  RAISE NOTICE 'PASS G1 dispatch announce + re-announce reset (%)', v_on;
END $$;

-- ============================================
-- G2. คนแรกรับ = จองคนเดียว (atomic) — คนสอง ERR_OFFER_NOT_AVAILABLE
-- ============================================
DO $$ DECLARE
  v_on text; v_status text; v_drv text; v_asg text;
BEGIN
  v_on := pg_temp.c135_make_order('c135-g2');
  PERFORM pg_temp.c135_as('71616161-6161-6161-6161-616161616161'::uuid);
  PERFORM public.dispatch_order(v_on);

  -- rider1 รับงาน → จองสำเร็จ + assignment เกิดเป็น 'accepted' ทันที
  PERFORM pg_temp.c135_as('72626262-6262-6262-6262-626262626262'::uuid);
  PERFORM public.claim_dispatch_offer(v_on);
  SELECT status::text, claimed_by_driver_id INTO v_status, v_drv FROM public.dispatch_offers WHERE order_number = v_on;
  IF v_status <> 'claimed' OR v_drv <> 'drv-135-a' THEN
    RAISE EXCEPTION 'FAIL G2 offer not claimed by rider1: %/%', v_status, v_drv;
  END IF;
  SELECT status::text INTO v_asg FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg <> 'accepted' THEN RAISE EXCEPTION 'FAIL G2 claim must be accept (status %)', v_asg; END IF;

  -- rider2 มารับทีหลัง → ต้องพลาด (งานถูกจองแล้ว)
  PERFORM pg_temp.c135_as('73636363-6363-6363-6363-636363636363'::uuid);
  BEGIN
    PERFORM public.claim_dispatch_offer(v_on);
    RAISE EXCEPTION 'FAIL G2 second claim must be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_OFFER_NOT_AVAILABLE%' THEN RAISE; END IF;
  END;
  SELECT status::text, claimed_by_driver_id INTO v_status, v_drv FROM public.dispatch_offers WHERE order_number = v_on;
  IF v_status <> 'claimed' OR v_drv <> 'drv-135-a' THEN RAISE EXCEPTION 'FAIL G2 claim corrupted by race'; END IF;
  RAISE NOTICE 'PASS G2 first-claim wins, second rejected (%)', v_on;
END $$;

-- ============================================
-- G3. assign_driver ตรงระหว่างประกาศ = แอดมินชนะ (offer ปิดอัตโนมัติ)
-- ============================================
DO $$ DECLARE
  v_on text; v_status text; v_asg text; v_drv text;
BEGIN
  v_on := pg_temp.c135_make_order('c135-g3');
  PERFORM pg_temp.c135_as('71616161-6161-6161-6161-616161616161'::uuid);
  PERFORM public.dispatch_order(v_on);
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-135-b');
  SELECT status::text INTO v_status FROM public.dispatch_offers WHERE order_number = v_on;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL G3 offer must close on direct assign, got %', v_status; END IF;
  SELECT status::text, driver_id INTO v_asg, v_drv FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg <> 'assigned' OR v_drv <> 'drv-135-b' THEN RAISE EXCEPTION 'FAIL G3 admin assign lost: %/%', v_asg, v_drv; END IF;

  -- หลังแอดมินปิดประกาศแล้ว ไรเดอร์กดรับไม่ได้
  PERFORM pg_temp.c135_as('72626262-6262-6262-6262-626262626262'::uuid);
  BEGIN
    PERFORM public.claim_dispatch_offer(v_on);
    RAISE EXCEPTION 'FAIL G3 claim after admin assign must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_OFFER_NOT_AVAILABLE%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS G3 admin direct-assign wins over offer (%)', v_on;
END $$;

-- ============================================
-- G4. driver_decline_offer = ต่อคน (คนอื่นยังเห็น/รับได้)
-- ============================================
DO $$ DECLARE
  v_on text; v_json jsonb; v_n int;
BEGIN
  v_on := pg_temp.c135_make_order('c135-g4');
  PERFORM pg_temp.c135_as('71616161-6161-6161-6161-616161616161'::uuid);
  PERFORM public.dispatch_order(v_on);

  -- rider1 เห็น offer ใน my_deliveries → ปฏิเสธ → หายจากของ rider1 เท่านั้น
  PERFORM pg_temp.c135_as('72626262-6262-6262-6262-626262626262'::uuid);
  v_json := public.my_deliveries();
  SELECT COUNT(*) INTO v_n FROM jsonb_array_elements(COALESCE(v_json->'offers','[]'::jsonb)) x
   WHERE x->>'order_number' = v_on;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL G4 rider1 must see the open offer'; END IF;
  PERFORM public.driver_decline_offer(v_on);
  v_json := public.my_deliveries();
  SELECT COUNT(*) INTO v_n FROM jsonb_array_elements(COALESCE(v_json->'offers','[]'::jsonb)) x
   WHERE x->>'order_number' = v_on;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL G4 declined offer must hide from rider1'; END IF;

  -- rider2 ยังเห็นและรับได้ (การปฏิเสธไม่ปิดประกาศ)
  PERFORM pg_temp.c135_as('73636363-6363-6363-6363-636363636363'::uuid);
  v_json := public.my_deliveries();
  SELECT COUNT(*) INTO v_n FROM jsonb_array_elements(COALESCE(v_json->'offers','[]'::jsonb)) x
   WHERE x->>'order_number' = v_on;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL G4 rider2 must still see the offer'; END IF;
  PERFORM public.claim_dispatch_offer(v_on);
  RAISE NOTICE 'PASS G4 per-person decline, others unaffected (%)', v_on;
END $$;

-- ============================================
-- G5. cancel_dispatch_offer (admin) + ออเดอร์จบทาง → ปิดอัตโนมัติ
-- ============================================
DO $$ DECLARE
  v_on text; v_status text;
BEGIN
  -- 5a: แอดมินยกเลิกประกาศ
  v_on := pg_temp.c135_make_order('c135-g5a');
  PERFORM pg_temp.c135_as('71616161-6161-6161-6161-616161616161'::uuid);
  PERFORM public.dispatch_order(v_on);
  PERFORM public.cancel_dispatch_offer(v_on, 'test-cancel');
  SELECT status::text INTO v_status FROM public.dispatch_offers WHERE order_number = v_on;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL G5a expected cancelled, got %', v_status; END IF;

  -- 5b: ออเดอร์ถูกยกเลิก → trigger ปิด offer ค้าง (ไม่เหลืองานผีให้รับ)
  v_on := pg_temp.c135_make_order('c135-g5b');
  PERFORM pg_temp.c135_as('71616161-6161-6161-6161-616161616161'::uuid);
  PERFORM public.dispatch_order(v_on);
  PERFORM public.cancel_order(v_on, 'test-order-cancel');
  SELECT status::text INTO v_status FROM public.dispatch_offers WHERE order_number = v_on;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL G5b offer must auto-close with order, got %', v_status; END IF;
  RAISE NOTICE 'PASS G5 admin cancel + order-terminal auto-close';
END $$;

-- ============================================
-- G6. my_deliveries คืน offers[] เฉพาะที่ยังว่าง (และ assignments ตามเดิม)
-- ============================================
DO $$ DECLARE
  v_on text; v_json jsonb; v_n int; v_has_assign boolean;
BEGIN
  v_on := pg_temp.c135_make_order('c135-g6');
  PERFORM pg_temp.c135_as('71616161-6161-6161-6161-616161616161'::uuid);
  PERFORM public.dispatch_order(v_on);
  PERFORM pg_temp.c135_as('73636363-6363-6363-6363-636363636363'::uuid);
  v_json := public.my_deliveries();
  IF v_json->'offers' IS NULL THEN RAISE EXCEPTION 'FAIL G6 offers key missing'; END IF;
  SELECT COUNT(*) INTO v_n FROM jsonb_array_elements(v_json->'offers') x
   WHERE x->>'order_number' = v_on AND x->>'assignment_status' = 'offered';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL G6 offer row missing/wrong shape'; END IF;

  -- หลังรับ → ย้ายจาก offers ไปอยู่ assignments (accepted) ทันที
  PERFORM public.claim_dispatch_offer(v_on);
  v_json := public.my_deliveries();
  SELECT COUNT(*) INTO v_n FROM jsonb_array_elements(COALESCE(v_json->'offers','[]'::jsonb)) x
   WHERE x->>'order_number' = v_on;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL G6 claimed job must leave offers'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_json->'assignments','[]'::jsonb)) x
     WHERE x->>'order_number' = v_on AND x->>'assignment_status' = 'accepted'
  ) INTO v_has_assign;
  IF NOT v_has_assign THEN RAISE EXCEPTION 'FAIL G6 claimed job must appear in assignments as accepted'; END IF;
  RAISE NOTICE 'PASS G6 my_deliveries offers[] + claim moves to assignments (%)', v_on;
END $$;

-- ============================================
-- G7. security — RPCs ผูกสิทธิ์ถูกต้อง (no anon · non-admin ประกาศไม่ได้ ·
--     non-driver รับไม่ได้)
-- ============================================
DO $$ DECLARE
  v_on text;
BEGIN
  v_on := pg_temp.c135_make_order('c135-g7');

  IF has_function_privilege('anon', 'public.dispatch_order(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL G7 anon must not execute dispatch_order';
  END IF;
  IF has_function_privilege('anon', 'public.claim_dispatch_offer(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL G7 anon must not execute claim_dispatch_offer';
  END IF;
  IF has_function_privilege('authenticated', 'public.dispatch_order(text)', 'EXECUTE') = false THEN
    RAISE EXCEPTION 'FAIL G7 authenticated must execute dispatch_order';
  END IF;

  -- customer (ไม่ใช่แอดมิน) ประกาศไม่ได้
  PERFORM pg_temp.c135_as('74646464-6464-6464-6464-646464646464'::uuid);
  BEGIN
    PERFORM public.dispatch_order(v_on);
    RAISE EXCEPTION 'FAIL G7 non-admin dispatch must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;

  -- customer (ไม่ใช่ไรเดอร์) รับงานไม่ได้
  BEGIN
    PERFORM public.claim_dispatch_offer(v_on);
    RAISE EXCEPTION 'FAIL G7 non-driver claim must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NOT_A_DRIVER%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS G7 RPC grants + actor guards hold';
END $$;

ROLLBACK;