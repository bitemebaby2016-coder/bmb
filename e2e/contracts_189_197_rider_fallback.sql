-- ============================================================
-- Contract 189+197 — Claim Dispatch Offer Fallback + Rider Available After Loop
-- ครอบคลุม:
--   189.1 claim_dispatch_offer — assigned fallback (assignment status='assigned' ของตัวเอง → accept + sync)
--   189.2 claim_dispatch_offer — atomic claim (FOR UPDATE SKIP LOCKED equivalent) + other driver assigned = ERR_OFFER_NOT_AVAILABLE
--   197.1 driver_update_delivery_status — delivered = available เฉพาะไม่มีงานค้างจริง (ออเดอร์ตาย/หายไม่ได้ค้าง)
--   197.2 backfill: assignment ของออเดอร์ cancelled/failed/delivered → cancelled
--   197.3 backfill: driver busy โดยไม่มีงานจริง → available
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin + rider ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- ---------- fixture: rider + orders ----------
DO $$
DECLARE
  v_rider_uid uuid := '210a1890-0000-4000-8000-000000000001';
  v_rider_id text := 'drv-c189-1';
  v_order_number text := 'BMB-C189-001';
  v_round_id text := 'round-c189-1';
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_rider_uid,'fixture-c189-rider@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.drivers (id, name, phone, status, user_id, tenant_id)
  VALUES (v_rider_id, 'Contract 189 Rider', '0818891891', 'available', v_rider_uid, 'tenant-bmb-001')
  ON CONFLICT (id) DO NOTHING;

  -- fixture: customers (auth.users — orders.customer_ref FK)
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES
    ('210a1890-0000-4000-8000-000000000002','fixture-c189-cust@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated'),
    ('210a1890-0000-4000-8000-000000000004','fixture-c189-cust2@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated'),
    ('210a1890-0000-4000-8000-000000000005','fixture-c189-cust3@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated'),
    ('210a1890-0000-4000-8000-000000000006','fixture-c189-custdead@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.branches (id, code, slug, name, tenant_id, address_line1, latitude, longitude, kitchen_latitude, kitchen_longitude, status)
  VALUES ('br-c189', 'c189', 'c189', 'Contract 189 Branch', 'tenant-bmb-001', '189 Test Road', 13.0, 100.0, 13.0, 100.0, 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.delivery_rounds (id, branch_id, tenant_id, name, display_name, scheduled_date, cutoff_time, delivery_start, delivery_end, status, max_capacity, current_count)
  VALUES (v_round_id, 'br-c189', 'tenant-bmb-001', 'Test Round', 'Test Round', (now() AT TIME ZONE 'Asia/Bangkok')::date, '22:00', '10:00', '12:00', 'active', 50, 0)
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

  -- order ready_for_dispatch (for claim test)
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, delivery_round_id, branch_id)
  VALUES ('ord-c189-1', v_order_number, 'cust-c189', '210a1890-0000-4000-8000-000000000002', 'C189 Cust 1', '0818891891', 'ready_for_dispatch', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', v_round_id, 'br-c189')
  ON CONFLICT (order_number) DO NOTHING;

  RAISE NOTICE 'Fixture ready for 189+197';
END $$;

-- ---------- 189.1 claim_dispatch_offer — assigned fallback ----------
DO $$
DECLARE
  v_rider_uid uuid := '210a1890-0000-4000-8000-000000000001';
  v_rider_id text := 'drv-c189-1';
  v_order_number text := 'BMB-C189-001';
  v_result jsonb;
BEGIN
  -- admin assigns rider first (assignment status = 'assigned')
  UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, branch_id, assigned_at)
  VALUES ('das-c189-assigned', v_order_number, v_rider_id, 'assigned', 'br-c189', NOW())
  ON CONFLICT (order_number) DO UPDATE SET driver_id = EXCLUDED.driver_id, status = 'assigned', assigned_at = NOW();

  -- now rider calls claim_dispatch_offer (should fallback to accept)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);

  v_result := public.claim_dispatch_offer(v_order_number);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '189.1 FAIL: claim_dispatch_offer assigned fallback failed: %', v_result;
  END IF;
  IF (v_result->>'status') IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION '189.1 FAIL: status should be accepted, got %', v_result->>'status';
  END IF;
  IF (v_result->>'via') IS DISTINCT FROM 'assigned_fallback' THEN
    RAISE EXCEPTION '189.1 FAIL: via should be assigned_fallback, got %', v_result->>'via';
  END IF;

  -- verify assignment updated to accepted
  IF NOT EXISTS (
    SELECT 1 FROM public.delivery_assignments
    WHERE order_number = v_order_number AND driver_id = v_rider_id AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION '189.1 FAIL: assignment not updated to accepted';
  END IF;

  -- verify order status synced to dispatched
  IF NOT EXISTS (
    SELECT 1 FROM public.orders WHERE order_number = v_order_number AND status = 'dispatched'
  ) THEN
    RAISE EXCEPTION '189.1 FAIL: order not synced to dispatched';
  END IF;

  -- verify driver status = busy
  IF NOT EXISTS (
    SELECT 1 FROM public.drivers WHERE id = v_rider_id AND status = 'busy'
  ) THEN
    RAISE EXCEPTION '189.1 FAIL: driver status not busy';
  END IF;

  RAISE NOTICE '189.1 PASS: claim_dispatch_offer assigned fallback OK (accept + sync)';
END $$;

-- ---------- 189.2 claim_dispatch_offer — atomic claim + other driver assigned = ERR_OFFER_NOT_AVAILABLE ----------
DO $$
DECLARE
  v_rider_uid uuid := '210a1890-0000-4000-8000-000000000001';
  v_rider_id text := 'drv-c189-1';
  v_other_rider_uid uuid := '210a1890-0000-4000-8000-000000000003';
  v_other_rider_id text := 'drv-c189-2';
  v_order_number text := 'BMB-C189-002';
  v_round_id text := 'round-c189-1';
  v_result jsonb;
BEGIN
  -- fixture other rider (admin claims เพราะ trigger drivers_promote_rider อัปเดต profiles ต้องผ่าน guard)
  UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_other_rider_uid,'fixture-c189-rider2@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.drivers (id, name, phone, status, user_id, tenant_id)
  VALUES (v_other_rider_id, 'Contract 189 Rider 2', '0818891892', 'available', v_other_rider_uid, 'tenant-bmb-001')
  ON CONFLICT (id) DO NOTHING;

  -- fixture order with dispatch offer
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, delivery_round_id, branch_id)
  VALUES ('ord-c189-2', v_order_number, 'cust-c189-2', '210a1890-0000-4000-8000-000000000004', 'C189 Cust 2', '0818891892', 'ready_for_dispatch', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', v_round_id, 'br-c189')
  ON CONFLICT (order_number) DO NOTHING;

  INSERT INTO public.dispatch_offers (id, order_number, branch_id, status, created_at, updated_at)
  VALUES ('do-c189-1', v_order_number, 'br-c189', 'offered', NOW(), NOW())
  ON CONFLICT (order_number) DO UPDATE SET status = 'offered', updated_at = NOW();

  -- rider 1 claims
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.claim_dispatch_offer(v_order_number);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '189.2 FAIL: first claim failed: %', v_result;
  END IF;

  -- rider 2 tries to claim same offer → ERR_OFFER_NOT_AVAILABLE (function raises → จับด้วย nested block)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_other_rider_uid::text, 'role', 'authenticated')::text, true);
  BEGIN
    v_result := public.claim_dispatch_offer(v_order_number);
  EXCEPTION WHEN OTHERS THEN
    v_result := jsonb_build_object('ok', false, 'error', SQLERRM);
  END;
  IF (v_result->>'ok')::boolean IS TRUE THEN
    RAISE EXCEPTION '189.2 FAIL: second claim should fail';
  END IF;
  IF (v_result->>'error') NOT LIKE '%ERR_OFFER_NOT_AVAILABLE%' THEN
    RAISE EXCEPTION '189.2 FAIL: expected ERR_OFFER_NOT_AVAILABLE, got: %', v_result->>'error';
  END IF;

  -- test: other driver has active assignment = ERR_OFFER_NOT_AVAILABLE
  -- new order, rider 2 has assignment
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, delivery_round_id, branch_id)
  VALUES ('ord-c189-3', 'BMB-C189-003', 'cust-c189-3', '210a1890-0000-4000-8000-000000000005', 'C189 Cust 3', '0818891893', 'ready_for_dispatch', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', v_round_id, 'br-c189')
  ON CONFLICT (order_number) DO NOTHING;

  INSERT INTO public.dispatch_offers (id, order_number, branch_id, status, created_at, updated_at)
  VALUES ('do-c189-2', 'BMB-C189-003', 'br-c189', 'offered', NOW(), NOW())
  ON CONFLICT (order_number) DO UPDATE SET status = 'offered', updated_at = NOW();

  -- rider 2 has active assignment for this order (guard เช็ค assignment ของ order เดียวกัน)
  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, branch_id, assigned_at)
  VALUES ('das-c189-other', 'BMB-C189-003', v_other_rider_id, 'accepted', 'br-c189', NOW())
  ON CONFLICT (order_number) DO NOTHING;

  -- rider 1 tries to claim → should fail because rider 2 has active assignment (same order)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);
  BEGIN
    v_result := public.claim_dispatch_offer('BMB-C189-003');
  EXCEPTION WHEN OTHERS THEN
    v_result := jsonb_build_object('ok', false, 'error', SQLERRM);
  END;
  IF (v_result->>'ok')::boolean IS TRUE THEN
    RAISE EXCEPTION '189.2 FAIL: claim should fail when other driver has active assignment';
  END IF;
  IF (v_result->>'error') NOT LIKE '%ERR_OFFER_NOT_AVAILABLE%' THEN
    RAISE EXCEPTION '189.2 FAIL: expected ERR_OFFER_NOT_AVAILABLE for other driver active, got: %', v_result->>'error';
  END IF;

  RAISE NOTICE '189.2 PASS: claim_dispatch_offer atomic claim + other driver guard OK';
END $$;

-- ---------- 197.1 driver_update_delivery_status — delivered = available iff no real pending work ----------
DO $$
DECLARE
  v_rider_uid uuid := '210a1890-0000-4000-8000-000000000001';
  v_rider_id text := 'drv-c189-1';
  v_order_number text := 'BMB-C189-001';
  v_result jsonb;
BEGIN
  -- reset rider to busy with this order
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);

  -- ปิดงานค้างจาก 189.2 (assignment BMB-C189-002) เพื่อทดสอบเคส "ไม่มีงานค้างจริง"
  UPDATE public.delivery_assignments SET status='cancelled', updated_at=NOW()
   WHERE order_number='BMB-C189-002' AND driver_id=v_rider_id;

  -- A3: attach POD ก่อน delivered (path ต้องอยู่ในโฟลเดอร์ของไรเดอร์เอง)
  v_result := public.driver_attach_pod(v_order_number, 'drv-c189-1/pod-c189-1.jpg', 13.7563, 100.5018);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '197.1 FAIL: driver_attach_pod failed: %', v_result;
  END IF;

  -- order is dispatched (from 189.1 test), update to delivered
  v_result := public.driver_update_delivery_status(v_order_number, '0818891891', 'delivered', 13.7563, 100.5018);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '197.1 FAIL: driver_update_delivery_status delivered failed: %', v_result;
  END IF;

  -- rider should be available (no other active assignments)
  IF NOT EXISTS (
    SELECT 1 FROM public.drivers WHERE id = v_rider_id AND status = 'available'
  ) THEN
    RAISE EXCEPTION '197.1 FAIL: rider should be available after delivered with no other work';
  END IF;

  RAISE NOTICE '197.1 PASS: delivered -> available when no real pending work OK';
END $$;

-- ---------- 197.2 backfill: dead order assignments → cancelled ----------
DO $$
DECLARE
  v_rider_id text := 'drv-c189-1';
  v_dead_order text := 'BMB-C189-DEAD';
  v_count int;
BEGIN
  -- create assignment for cancelled order
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, delivery_round_id, branch_id)
  VALUES ('ord-c189-dead', v_dead_order, 'cust-c189-dead', '210a1890-0000-4000-8000-000000000006', 'C189 Cust Dead', '0818891896', 'cancelled', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', 'round-c189-1', 'br-c189')
  ON CONFLICT (order_number) DO NOTHING;

  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, branch_id, assigned_at)
  VALUES ('das-c189-dead', v_dead_order, v_rider_id, 'assigned', 'br-c189', NOW())
  ON CONFLICT (order_number) DO NOTHING;

  -- run backfill (simulate migration 197 backfill)
  UPDATE public.delivery_assignments da
     SET status = 'cancelled', updated_at = NOW()
   WHERE da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived')
     AND NOT EXISTS (
       SELECT 1 FROM public.orders o
        WHERE o.order_number = da.order_number
          AND o.status NOT IN ('cancelled', 'failed', 'delivered')
     );

  -- verify assignment cancelled
  IF NOT EXISTS (
    SELECT 1 FROM public.delivery_assignments WHERE order_number = v_dead_order AND status = 'cancelled'
  ) THEN
    RAISE EXCEPTION '197.2 FAIL: dead order assignment not cancelled';
  END IF;

  -- verify active order assignment NOT cancelled (หลัง 197.1 status เป็น 'delivered' — ไม่ต้องถูกยกเลิก)
  IF EXISTS (
    SELECT 1 FROM public.delivery_assignments WHERE order_number = 'BMB-C189-001' AND status = 'cancelled'
  ) THEN
    RAISE EXCEPTION '197.2 FAIL: active order assignment incorrectly cancelled';
  END IF;

  RAISE NOTICE '197.2 PASS: backfill dead order assignments -> cancelled OK';
END $$;

-- ---------- 197.3 backfill: driver busy with no real work → available ----------
DO $$
DECLARE
  v_rider_id text := 'drv-c189-1';
  v_count int;
BEGIN
  -- set driver to busy
  UPDATE public.drivers SET status = 'busy', updated_at = NOW() WHERE id = v_rider_id;

  -- run backfill (simulate migration 197 backfill)
  UPDATE public.drivers d
     SET status = 'available', updated_at = NOW()
   WHERE d.status = 'busy'
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_assignments da
        WHERE da.driver_id = d.id
          AND da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived')
          AND EXISTS (
            SELECT 1 FROM public.orders o
             WHERE o.order_number = da.order_number
               AND o.status NOT IN ('cancelled', 'failed', 'delivered')
          )
     );

  -- driver should be available (all assignments are for dead orders)
  IF NOT EXISTS (
    SELECT 1 FROM public.drivers WHERE id = v_rider_id AND status = 'available'
  ) THEN
    RAISE EXCEPTION '197.3 FAIL: driver with no real work should be available';
  END IF;

  RAISE NOTICE '197.3 PASS: backfill idle busy driver -> available OK';
END $$;

ROLLBACK;