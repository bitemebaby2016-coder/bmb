-- ============================================================
-- Contract 182+183+187+188 — Order Messages + Notifications + Dedup
-- ครอบคลุม:
--   182.1 order_messages table + RLS (admin/owner/rider) + no INSERT policy
--   182.2 owns_order_msg / drives_order_msg helpers
--   182.3 send_order_message — validate role + insert + enqueue_notification for admin/rider
--   183.1 send_order_message v2 — notifications table: customer (customer_id) + admin (customer_id NULL)
--   187.1 send_order_message v3 — id suffix -c/-a/-r (prevent PK conflict) + rider notification (user_id)
--   188.1 orders_notify_hook — deterministic id evt-ord-<order>-<status> + ON CONFLICT DO NOTHING
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin role ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- ---------- fixture: customer + rider ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1820-0000-4000-8000-000000000001';
  v_rider_uid uuid := '210a1820-0000-4000-8000-000000000002';
  v_cust_id text := 'cust-c182-1';
  v_rider_id text := 'drv-c182-1';
  v_order_number text := 'BMB-TEST182-001';
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_cust_uid,'fixture-c182-cust@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name) VALUES (v_cust_id, v_cust_uid, 'Contract 182 Customer')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_rider_uid,'fixture-c182-rider@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.drivers (id, name, phone, status, user_id, tenant_id)
  VALUES (v_rider_id, 'Contract 182 Rider', '0818881821', 'available', v_rider_uid, 'tenant-bmb-001')
  ON CONFLICT (id) DO NOTHING;

  -- fixture branch (FK orders.branch_id)
  INSERT INTO public.branches (id, code, slug, name, tenant_id, address_line1, latitude, longitude, kitchen_latitude, kitchen_longitude, status)
  VALUES ('br-c186', 'c186', 'c186', 'Contract 186 Branch', 'tenant-bmb-001', '186 Test Road', 13.0, 100.0, 13.0, 100.0, 'active')
  ON CONFLICT (id) DO NOTHING;

  -- fixture order
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id)
  VALUES ('ord-c182-1', v_order_number, v_cust_id, v_cust_uid, 'Contract 182 Customer', '0818881821', 'confirmed', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', 'br-c186')
  ON CONFLICT (order_number) DO NOTHING;

  -- fixture delivery assignment for rider
  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, branch_id, assigned_at, accepted_at)
  VALUES ('das-c182-1', v_order_number, v_rider_id, 'accepted', 'br-c186', NOW(), NOW())
  ON CONFLICT (order_number) DO NOTHING;

  RAISE NOTICE 'Fixture ready for 182-188';
END $$;

-- ---------- 182.1 order_messages table + RLS ----------
DO $$
BEGIN
  -- table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_messages' AND column_name='sender_role') THEN
    RAISE EXCEPTION '182.1 FAIL: order_messages table missing';
  END IF;

  -- CHECK constraint on sender_role
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
    WHERE ccu.table_schema='public' AND ccu.table_name='order_messages' AND ccu.column_name='sender_role'
  ) THEN
    RAISE EXCEPTION '182.1 FAIL: sender_role CHECK missing';
  END IF;

  -- RLS policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_messages' AND policyname='order_messages_select') THEN
    RAISE EXCEPTION '182.1 FAIL: order_messages_select policy missing';
  END IF;

  -- no INSERT policy = direct write blocked
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_messages' AND cmd='INSERT') THEN
    RAISE EXCEPTION '182.1 FAIL: INSERT policy should not exist (write via RPC only)';
  END IF;

  RAISE NOTICE '182.1 PASS: order_messages table + RLS (no INSERT policy) OK';
END $$;

-- ---------- 182.2 owns_order_msg / drives_order_msg ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1820-0000-4000-8000-000000000001';
  v_rider_uid uuid := '210a1820-0000-4000-8000-000000000002';
  v_order_number text := 'BMB-TEST182-001';
  v_owns boolean;
  v_drives boolean;
BEGIN
  -- owns_order_msg: customer
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);
  v_owns := public.owns_order_msg(v_order_number);
  IF v_owns IS NOT TRUE THEN
    RAISE EXCEPTION '182.2 FAIL: customer owns_order_msg should be true';
  END IF;

  -- owns_order_msg: other user = false
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', '00000000-0000-0000-0000-000000000000'::uuid, 'role', 'authenticated')::text, true);
  v_owns := public.owns_order_msg(v_order_number);
  IF v_owns IS TRUE THEN
    RAISE EXCEPTION '182.2 FAIL: other user owns_order_msg should be false';
  END IF;

  -- drives_order_msg: rider
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);
  v_drives := public.drives_order_msg(v_order_number);
  IF v_drives IS NOT TRUE THEN
    RAISE EXCEPTION '182.2 FAIL: rider drives_order_msg should be true';
  END IF;

  -- drives_order_msg: other rider = false
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', '00000000-0000-0000-0000-000000000001'::uuid, 'role', 'authenticated')::text, true);
  v_drives := public.drives_order_msg(v_order_number);
  IF v_drives IS TRUE THEN
    RAISE EXCEPTION '182.2 FAIL: other rider drives_order_msg should be false';
  END IF;

  RAISE NOTICE '182.2 PASS: owns_order_msg / drives_order_msg OK';
END $$;

-- ---------- 182.3 send_order_message (base) ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1820-0000-4000-8000-000000000001';
  v_rider_uid uuid := '210a1820-0000-4000-8000-000000000002';
  v_order_number text := 'BMB-TEST182-001';
  v_result jsonb;
  v_msg_id text;
BEGIN
  -- customer sends message
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.send_order_message(v_order_number, 'Hello from customer', 'customer');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '182.3 FAIL: customer send failed: %', v_result;
  END IF;
  v_msg_id := v_result->>'id';
  IF v_msg_id IS NULL OR v_msg_id NOT LIKE 'omsg-%' THEN
    RAISE EXCEPTION '182.3 FAIL: message id format wrong: %', v_msg_id;
  END IF;

  -- verify message inserted
  IF NOT EXISTS (SELECT 1 FROM public.order_messages WHERE id = v_msg_id AND sender_role = 'customer') THEN
    RAISE EXCEPTION '182.3 FAIL: customer message not inserted';
  END IF;

  -- rider sends message
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.send_order_message(v_order_number, 'Hello from rider', 'rider');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '182.3 FAIL: rider send failed: %', v_result;
  END IF;

  -- verify rider message
  IF NOT EXISTS (SELECT 1 FROM public.order_messages WHERE id = v_result->>'id' AND sender_role = 'rider') THEN
    RAISE EXCEPTION '182.3 FAIL: rider message not inserted';
  END IF;

  -- admin sends message
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'dddf4b57-405f-4852-a985-76d8d52b1b72', 'role', 'authenticated')::text, true);
  v_result := public.send_order_message(v_order_number, 'Hello from admin', 'admin');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '182.3 FAIL: admin send failed: %', v_result;
  END IF;

  -- verify admin message
  IF NOT EXISTS (SELECT 1 FROM public.order_messages WHERE id = v_result->>'id' AND sender_role = 'admin') THEN
    RAISE EXCEPTION '182.3 FAIL: admin message not inserted';
  END IF;

  -- invalid role rejected
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.send_order_message(v_order_number, 'Invalid role', 'invalid');
  IF (v_result->>'ok')::boolean IS TRUE THEN
    RAISE EXCEPTION '182.3 FAIL: invalid role should be rejected';
  END IF;

  RAISE NOTICE '182.3 PASS: send_order_message base OK (customer/rider/admin + validation)';
END $$;

-- ---------- 183.1 send_order_message v2 — notifications (customer + admin) ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1820-0000-4000-8000-000000000001';
  v_rider_uid uuid := '210a1820-0000-4000-8000-000000000002';
  v_order_number text := 'BMB-TEST182-001';
  v_result jsonb;
  v_notif_count int;
BEGIN
  -- admin sends → notification to customer (customer_id set)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'dddf4b57-405f-4852-a985-76d8d52b1b72', 'role', 'authenticated')::text, true);
  v_result := public.send_order_message(v_order_number, 'Admin message v2', 'admin');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '183.1 FAIL: admin send v2 failed: %', v_result;
  END IF;

  -- verify customer notification created (id pattern msgn-<msg_id>-c)
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE customer_id = 'cust-c182-1' AND title = '💬 ข้อความใหม่จากร้าน'
  ) THEN
    RAISE EXCEPTION '183.1 FAIL: customer notification not created for admin message';
  END IF;

  -- customer sends → notification to admin (customer_id NULL)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.send_order_message(v_order_number, 'Customer message v2', 'customer');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '183.1 FAIL: customer send v2 failed: %', v_result;
  END IF;

  -- verify admin notification created (customer_id IS NULL)
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE customer_id IS NULL AND title = '💬 ข้อความใหม่จากลูกค้า'
  ) THEN
    RAISE EXCEPTION '183.1 FAIL: admin notification not created for customer message';
  END IF;

  -- rider sends → notification to admin (customer_id NULL)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.send_order_message(v_order_number, 'Rider message v2', 'rider');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '183.1 FAIL: rider send v2 failed: %', v_result;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE customer_id IS NULL AND title = '💬 ข้อความใหม่จากไรเดอร์'
  ) THEN
    RAISE EXCEPTION '183.1 FAIL: admin notification not created for rider message';
  END IF;

  RAISE NOTICE '183.1 PASS: send_order_message v2 notifications (customer + admin) OK';
END $$;

-- ---------- 187.1 send_order_message v3 — id suffix -c/-a/-r + rider notification ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1820-0000-4000-8000-000000000001';
  v_rider_uid uuid := '210a1820-0000-4000-8000-000000000002';
  v_order_number text := 'BMB-TEST182-001';
  v_result jsonb;
  v_msg_id text;
BEGIN
  -- admin sends → 2 notifications: customer (-c), rider (-r) — NO -a (admin doesn't notify self)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'dddf4b57-405f-4852-a985-76d8d52b1b72', 'role', 'authenticated')::text, true);
  v_result := public.send_order_message(v_order_number, 'Admin message v3', 'admin');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '187.1 FAIL: admin send v3 failed: %', v_result;
  END IF;
  v_msg_id := v_result->>'id';

  -- verify 2 notifications with correct suffixes
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-c' AND customer_id = 'cust-c182-1') THEN
    RAISE EXCEPTION '187.1 FAIL: customer notification -c missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-r' AND user_id = v_rider_uid) THEN
    RAISE EXCEPTION '187.1 FAIL: rider notification -r missing (user_id should be rider uid)';
  END IF;
  -- admin should NOT get self-notification
  IF EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-a') THEN
    RAISE EXCEPTION '187.1 FAIL: admin should not get self-notification';
  END IF;

  -- verify titles
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-c' AND title = '💬 ข้อความใหม่จากร้าน') THEN
    RAISE EXCEPTION '187.1 FAIL: customer title wrong';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-r' AND title = '💬 ข้อความใหม่จากร้าน') THEN
    RAISE EXCEPTION '187.1 FAIL: rider title wrong';
  END IF;

  -- customer sends → 2 notifications: admin (-a), rider (-r) (no customer self-notification)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.send_order_message(v_order_number, 'Customer message v3', 'customer');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '187.1 FAIL: customer send v3 failed: %', v_result;
  END IF;
  v_msg_id := v_result->>'id';

  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-a' AND customer_id IS NULL) THEN
    RAISE EXCEPTION '187.1 FAIL: admin notification -a missing for customer send';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-r' AND user_id = v_rider_uid) THEN
    RAISE EXCEPTION '187.1 FAIL: rider notification -r missing for customer send';
  END IF;
  -- customer should NOT get notification
  IF EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-c') THEN
    RAISE EXCEPTION '187.1 FAIL: customer should not get self-notification';
  END IF;

  -- rider sends → 2 notifications: customer (-c), admin (-a)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.send_order_message(v_order_number, 'Rider message v3', 'rider');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '187.1 FAIL: rider send v3 failed: %', v_result;
  END IF;
  v_msg_id := v_result->>'id';

  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-c' AND customer_id = 'cust-c182-1') THEN
    RAISE EXCEPTION '187.1 FAIL: customer notification -c missing for rider send';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-a' AND customer_id IS NULL) THEN
    RAISE EXCEPTION '187.1 FAIL: admin notification -a missing for rider send';
  END IF;
  -- rider should NOT get self-notification
  IF EXISTS (SELECT 1 FROM public.notifications WHERE id = 'msgn-' || v_msg_id || '-r') THEN
    RAISE EXCEPTION '187.1 FAIL: rider should not get self-notification';
  END IF;

  RAISE NOTICE '187.1 PASS: send_order_message v3 id suffix -c/-a/-r + rider notification OK';
END $$;

-- ---------- 188.1 orders_notify_hook deterministic id + ON CONFLICT DO NOTHING ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1880-0000-4000-8000-000000000001';
  v_order_number text;
  v_order_id text;
  v_notif_count int;
BEGIN
  -- fixture order
  v_order_id := 'ord-c188-' || substr(md5(random()::text), 1, 8);
  v_order_number := 'BMB-C188-' || substr(md5(random()::text), 1, 6);
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_cust_uid,'fixture-c188@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name) VALUES ('cust-c188', v_cust_uid, 'Contract 188 Customer')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id)
  VALUES (v_order_id, v_order_number, 'cust-c188', v_cust_uid, 'Contract 188 Customer', '0818881821', 'pending', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', 'br-c186')
  ON CONFLICT (order_number) DO NOTHING;

  -- INSERT trigger fires → notification with id evt-ord-<order>-pending
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE id = 'evt-ord-' || v_order_number || '-pending' AND customer_id = 'cust-c188'
  ) THEN
    RAISE EXCEPTION '188.1 FAIL: INSERT trigger notification not created with deterministic id';
  END IF;

  -- UPDATE status to confirmed → notification evt-ord-<order>-confirmed
  -- (pending -> confirmed needs admin claims — session is rider from 187.1)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'dddf4b57-405f-4852-a985-76d8d52b1b72', 'role', 'authenticated')::text, true);
  UPDATE public.orders SET status = 'confirmed', updated_at = NOW() WHERE order_number = v_order_number;
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE id = 'evt-ord-' || v_order_number || '-confirmed' AND customer_id = 'cust-c188'
  ) THEN
    RAISE EXCEPTION '188.1 FAIL: status UPDATE trigger notification not created';
  END IF;

  -- duplicate UPDATE same status → should NOT create duplicate (ON CONFLICT DO NOTHING)
  UPDATE public.orders SET status = 'confirmed', updated_at = NOW() WHERE order_number = v_order_number;
  SELECT count(*) INTO v_notif_count FROM public.notifications WHERE id = 'evt-ord-' || v_order_number || '-confirmed';
  IF v_notif_count <> 1 THEN
    RAISE EXCEPTION '188.1 FAIL: duplicate status update created % notifications (expected 1)', v_notif_count;
  END IF;

  -- payment_status update → evt-pay-<order>-paid
  UPDATE public.orders SET payment_status = 'paid', updated_at = NOW() WHERE order_number = v_order_number;
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE id = 'evt-pay-' || v_order_number || '-paid' AND customer_id = 'cust-c188'
  ) THEN
    RAISE EXCEPTION '188.1 FAIL: payment_status trigger notification not created';
  END IF;

  RAISE NOTICE '188.1 PASS: orders_notify_hook deterministic id + dedup OK';
END $$;

ROLLBACK;