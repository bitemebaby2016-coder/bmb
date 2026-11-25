-- ============================================================
-- Contract 205 — Social Order Actions (cancel_order_as_customer + social_timeline_for_web)
-- ครอบคลุม:
--   205.1 cancel_order_as_customer — service_role only, identity binding (orders.customer_ref = p_customer_ref)
--   205.2 cancel_order_as_customer — sets JWT claims → calls canonical cancel_order (capacity + inventory + payment + audit)
--   205.3 cancel_order_as_customer — forbids authenticated callers (has JWT claims)
--   205.4 social_timeline_for_web — auth.uid() → customer_channel_identities.external_user_id → social_events
--   205.5 social_timeline_for_web — returns customer messages + AI replies (truncated 200) last 10
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin + customer ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

DO $$
DECLARE
  v_cust_uid uuid := '210a2050-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c205-1';
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_cust_uid,'fixture-c205@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name)
  VALUES (v_cust_id, v_cust_uid, 'Social Actions Customer')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.branches (id, code, slug, name, tenant_id, address_line1, latitude, longitude, kitchen_latitude, kitchen_longitude, status)
  VALUES ('br-c186', 'c186', 'c186', 'Contract 186 Branch', 'tenant-bmb-001', '186 Test Road', 13.0, 100.0, 13.0, 100.0, 'active')
  ON CONFLICT (id) DO NOTHING;

  -- fixture order (pending, within cancel window)
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id, created_at)
  VALUES ('ord-c205-1', 'BMB-C205-001', v_cust_id, v_cust_uid, 'Social Actions Customer', '0812052051', 'pending', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', 'br-c186', NOW() - interval '1 minute')
  ON CONFLICT (order_number) DO NOTHING;

  RAISE NOTICE 'Fixture ready for 205';
END $$;

-- ---------- 205.1 cancel_order_as_customer — service_role only + identity binding ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a2050-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c205-1';
  v_result jsonb;
BEGIN
  -- service_role call (no JWT claims — ล้าง claims ที่ค้างจาก fixture)
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'service_role', true);

  v_result := public.cancel_order_as_customer('BMB-C205-001', v_cust_uid, 'Customer requested via social');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '205.1 FAIL: cancel_order_as_customer failed: %', v_result;
  END IF;

  -- verify order cancelled
  IF NOT EXISTS (
    SELECT 1 FROM public.orders WHERE order_number = 'BMB-C205-001' AND status = 'cancelled'
  ) THEN
    RAISE EXCEPTION '205.1 FAIL: order not cancelled';
  END IF;

  -- verify payment voided (no payment_intents)
  IF NOT EXISTS (
    SELECT 1 FROM public.orders WHERE order_number = 'BMB-C205-001' AND payment_status = 'void'
  ) THEN
    RAISE EXCEPTION '205.1 FAIL: payment_status not void';
  END IF;

  -- verify audit log
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs WHERE action = 'order_cancelled' AND entity_id = 'BMB-C205-001'
  ) THEN
    RAISE EXCEPTION '205.1 FAIL: order_cancelled audit log missing';
  END IF;

  PERFORM set_config('role', 'authenticated', true);

  RAISE NOTICE '205.1 PASS: cancel_order_as_customer service_role + identity binding OK';
END $$;

-- ---------- 205.2 cancel_order_as_customer — wrong customer_ref = ERR_FORBIDDEN ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a2050-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c205-1';
  v_wrong_uid uuid := '00000000-0000-0000-0000-000000000000';
  v_order_id text := 'ord-c205-2';
  v_order_number text := 'BMB-C205-002';
  v_result jsonb;
BEGIN
  -- fixture order for different customer
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id, created_at)
  VALUES (v_order_id, v_order_number, v_cust_id, v_cust_uid, 'Social Actions Customer', '0812052051', 'pending', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', 'br-c186', NOW() - interval '1 minute')
  ON CONFLICT (order_number) DO NOTHING;

  -- service_role call with wrong customer_ref (ล้าง claims ก่อนเพื่อทดสอบ identity binding จริง)
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'service_role', true);

  BEGIN
    v_result := public.cancel_order_as_customer(v_order_number, v_wrong_uid, 'Wrong customer');
  EXCEPTION WHEN OTHERS THEN
    v_result := jsonb_build_object('ok', false, 'error', SQLERRM);
  END;
  IF (v_result->>'ok')::boolean IS TRUE THEN
    RAISE EXCEPTION '205.2 FAIL: wrong customer_ref should be forbidden';
  END IF;
  IF (v_result->>'error') NOT LIKE '%ERR_FORBIDDEN%' THEN
    RAISE EXCEPTION '205.2 FAIL: expected ERR_FORBIDDEN, got: %', v_result->>'error';
  END IF;

  PERFORM set_config('role', 'authenticated', true);

  RAISE NOTICE '205.2 PASS: cancel_order_as_customer identity binding enforced';
END $$;

-- ---------- 205.3 cancel_order_as_customer — forbids authenticated callers ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a2050-0000-4000-8000-000000000001';
  v_result jsonb;
BEGIN
  -- authenticated caller (has JWT claims)
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);

  BEGIN
    v_result := public.cancel_order_as_customer('BMB-C205-002', v_cust_uid, 'From web');
  EXCEPTION WHEN OTHERS THEN
    v_result := jsonb_build_object('ok', false, 'error', SQLERRM);
  END;
  IF (v_result->>'ok')::boolean IS TRUE THEN
    RAISE EXCEPTION '205.3 FAIL: authenticated caller should be forbidden';
  END IF;
  IF (v_result->>'error') NOT LIKE '%ERR_FORBIDDEN%'
     AND (v_result->>'error') NOT LIKE '%permission denied for function%' THEN
    RAISE EXCEPTION '205.3 FAIL: expected ERR_FORBIDDEN (หรือ permission denied), got: %', v_result->>'error';
  END IF;

  RAISE NOTICE '205.3 PASS: cancel_order_as_customer forbids authenticated callers';
END $$;

-- ---------- 205.4 social_timeline_for_web — identity chain ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a2050-0000-4000-8000-000000000001';
  v_psid text := 'psid-c205-1';
  v_result jsonb;
BEGIN
  -- fixture: channel identity mapping (id uuid default, ไม่มีคอลัมน์ status) — service_role (RLS บล็อก authenticated)
  PERFORM set_config('role', 'service_role', true);
  INSERT INTO public.customer_channel_identities (customer_ref, external_user_id, channel)
  VALUES (v_cust_uid, v_psid, 'MESSENGER');

  -- fixture: social_events for this PSID (event_id/platform/page_id/tenant_id NOT NULL)
  INSERT INTO public.social_events (customer_id, event_id, platform, page_id, event_type, content, ai_reply_text, received_at, tenant_id)
  VALUES
    (v_psid, 'se-c205-1', 'MESSENGER', 'page-c205', 'message', 'Hello from customer', 'Hello! How can I help?', NOW() - interval '1 hour', 'tenant-bmb-001'),
    (v_psid, 'se-c205-2', 'MESSENGER', 'page-c205', 'comment', 'Nice post!', 'Thanks!', NOW() - interval '30 minutes', 'tenant-bmb-001'),
    (v_psid, 'se-c205-3', 'MESSENGER', 'page-c205', 'message', 'Another message', 'Sure thing', NOW() - interval '10 minutes', 'tenant-bmb-001')
  ON CONFLICT (id) DO NOTHING;

  -- call as authenticated customer
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);

  v_result := public.social_timeline_for_web();
  IF (v_result IS NULL) OR (jsonb_typeof(v_result) <> 'array') THEN
    RAISE EXCEPTION '205.4 FAIL: result not array: %', v_result;
  END IF;

  -- should return 3 events (truncated to 200 chars)
  IF jsonb_array_length(v_result) <> 3 THEN
    RAISE EXCEPTION '205.4 FAIL: expected 3 events, got %', jsonb_array_length(v_result);
  END IF;

  -- verify structure: event_type, content, reply, received_at
  IF (v_result->0->>'event_type') IS NULL OR (v_result->0->>'content') IS NULL OR (v_result->0->>'reply') IS NULL OR (v_result->0->>'received_at') IS NULL THEN
    RAISE EXCEPTION '205.4 FAIL: event structure missing fields';
  END IF;

  -- verify truncation (200 chars)
  IF length(v_result->0->>'content') > 200 OR length(v_result->0->>'reply') > 200 THEN
    RAISE EXCEPTION '205.4 FAIL: content/reply not truncated to 200';
  END IF;

  RAISE NOTICE '205.4 PASS: social_timeline_for_web identity chain + truncation OK';
END $$;

-- ---------- 205.5 social_timeline_for_web — limit 10 + order by received_at ASC ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a2050-0000-4000-8000-000000000001';
  v_psid text := 'psid-c205-1';
  v_result jsonb;
BEGIN
  -- add more events (15 total) — service_role (RLS บล็อก authenticated)
  PERFORM set_config('role', 'service_role', true);
  INSERT INTO public.social_events (customer_id, event_id, platform, page_id, event_type, content, ai_reply_text, received_at, tenant_id)
  SELECT v_psid, 'se-c205-' || i, 'MESSENGER', 'page-c205', 'message', 'Message ' || i, 'Reply ' || i, NOW() - (15 - i) * interval '1 minute', 'tenant-bmb-001'
  FROM generate_series(4, 15) i
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);

  v_result := public.social_timeline_for_web();

  -- should return max 10 (most recent first, but function orders ASC)
  IF jsonb_array_length(v_result) <> 10 THEN
    RAISE EXCEPTION '205.5 FAIL: expected 10 events (limit), got %', jsonb_array_length(v_result);
  END IF;

  -- verify order: ASC by received_at
  IF (v_result->0->>'received_at')::timestamptz > (v_result->1->>'received_at')::timestamptz THEN
    RAISE EXCEPTION '205.5 FAIL: not ordered ASC by received_at';
  END IF;

  RAISE NOTICE '205.5 PASS: social_timeline_for_web limit 10 + ASC order OK';
END $$;

ROLLBACK;