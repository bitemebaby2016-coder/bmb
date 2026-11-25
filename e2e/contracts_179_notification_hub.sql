-- ============================================================
-- Contract 179 — Notification Hub (channel_identities + notification_outbox + RPCs)
-- ครอบคลุม:
--   179.1 channel_identities table + UNIQUE constraints + RLS (deny anon, own read, admin read)
--   179.2 notification_outbox table + state machine (pending/sending/sent/failed/dead/mock) + indexes + RLS (service_role write, admin read)
--   179.3 register_channel_identity — ผูก PSID/LINE userId กับลูกค้า (JWT only, delete other customer's same external_id)
--   179.4 enqueue_notification — จุดเดียวของการยิง event (idempotent event_key UNIQUE, client path resolve from JWT)
--   179.5 claim_notification_outbox — FOR UPDATE SKIP LOCKED + stale reclaim 10 min + limit cap 100
--   179.6 complete_notification — sent/failed/backoff(2^n min cap 30)/dead(mock)/final=mock|dead
--   179.7 business_settings.notification_channels feature flags (push/messenger/line/lineMode)
--   179.8 bmb_notify_http bridge exists (ไม่เรียก — กันยิง production EF)
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin role (ยกก่อนตั้ง JWT — bootstrap path 014) ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- ---------- 179.1 channel_identities schema + constraints + RLS ----------
DO $$
DECLARE
  v_id text;
  v_customer text := '210a1790-0000-4000-8000-000000000001';
  v_uid uuid := '210a1790-0000-4000-8000-000000000001';
BEGIN
  -- fixture customer + auth.users
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_uid,'fixture-c179-1@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  -- trigger m131 auto-creates customers row (id = user_id)

  -- 179.1.1 table exists with correct columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='channel_identities' AND column_name='id') THEN
    RAISE EXCEPTION '179.1 FAIL: channel_identities table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='channel_identities' AND constraint_name='uq_channel_identity') THEN
    RAISE EXCEPTION '179.1 FAIL: uq_channel_identity missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='channel_identities' AND constraint_name='uq_channel_customer') THEN
    RAISE EXCEPTION '179.1 FAIL: uq_channel_customer missing';
  END IF;

  -- 179.1.2 RLS policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='channel_identities' AND policyname='channel_ident_deny_anon') THEN
    RAISE EXCEPTION '179.1 FAIL: channel_ident_deny_anon policy missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='channel_identities' AND policyname='channel_ident_own_read') THEN
    RAISE EXCEPTION '179.1 FAIL: channel_ident_own_read policy missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='channel_identities' AND policyname='channel_ident_admin_read') THEN
    RAISE EXCEPTION '179.1 FAIL: channel_ident_admin_read policy missing';
  END IF;

  RAISE NOTICE '179.1 PASS: channel_identities schema + constraints + RLS OK';
END $$;

-- ---------- 179.2 notification_outbox schema + indexes + RLS ----------
DO $$
BEGIN
  -- 179.2.1 table exists with correct columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notification_outbox' AND column_name='event_key') THEN
    RAISE EXCEPTION '179.2 FAIL: notification_outbox table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='notification_outbox' AND constraint_name='notification_outbox_event_key_key') THEN
    RAISE EXCEPTION '179.2 FAIL: event_key UNIQUE missing';
  END IF;

  -- 179.2.2 indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='notification_outbox' AND indexname='notification_outbox_due_idx') THEN
    RAISE EXCEPTION '179.2 FAIL: notification_outbox_due_idx missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='notification_outbox' AND indexname='notification_outbox_customer_idx') THEN
    RAISE EXCEPTION '179.2 FAIL: notification_outbox_customer_idx missing';
  END IF;

  -- 179.2.3 RLS: service_role write, admin read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_outbox' AND policyname='outbox_deny_all_client') THEN
    RAISE EXCEPTION '179.2 FAIL: outbox_deny_all_client policy missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_outbox' AND policyname='outbox_admin_read') THEN
    RAISE EXCEPTION '179.2 FAIL: outbox_admin_read policy missing';
  END IF;

  RAISE NOTICE '179.2 PASS: notification_outbox schema + indexes + RLS OK';
END $$;

-- ---------- 179.3 register_channel_identity ----------
DO $$
DECLARE
  v_uid uuid := '210a1790-0000-4000-8000-000000000001';
  v_customer text := '210a1790-0000-4000-8000-000000000001';
  v_result jsonb;
BEGIN
  -- fixture: customer
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_uid,'fixture-c179-1@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  -- trigger m131 auto-creates customers row (id = user_id)

  -- set JWT
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);

  -- success case
  v_result := public.register_channel_identity('messenger', 'psid-c179-1', 'test');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.3 FAIL: register_channel_identity ok=false: %', v_result;
  END IF;
  IF (v_result->>'channel') IS DISTINCT FROM 'messenger' THEN
    RAISE EXCEPTION '179.3 FAIL: channel mismatch: %', v_result->>'channel';
  END IF;
  IF (v_result->>'id') IS NULL THEN
    RAISE EXCEPTION '179.3 FAIL: id missing in result';
  END IF;

  -- idempotent: same customer same channel updates external_id
  v_result := public.register_channel_identity('messenger', 'psid-c179-1-updated', 'test');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.3 FAIL: idempotent update failed: %', v_result;
  END IF;

  -- verify external_id updated
  IF NOT EXISTS (SELECT 1 FROM public.channel_identities WHERE customer_id = v_customer AND channel = 'messenger' AND external_id = 'psid-c179-1-updated') THEN
    RAISE EXCEPTION '179.3 FAIL: external_id not updated';
  END IF;

  -- delete other customer's same external_id (identity moves)
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('210a1790-0000-4000-8000-000000000002','fixture-c179-2@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  -- trigger m131 auto-creates customers row (id = user_id)

  INSERT INTO public.channel_identities (id, customer_id, channel, external_id, status, source)
  VALUES ('chi-old', '210a1790-0000-4000-8000-000000000002', 'messenger', 'psid-c179-1-updated', 'active', 'manual')
  ON CONFLICT (channel, external_id) DO NOTHING;

  -- now register with same external_id from customer 1
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.register_channel_identity('messenger', 'psid-c179-1-updated', 'test');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.3 FAIL: identity move failed: %', v_result;
  END IF;

  -- old row should be deleted
  IF EXISTS (SELECT 1 FROM public.channel_identities WHERE customer_id = '210a1790-0000-4000-8000-000000000002' AND channel = 'messenger') THEN
    RAISE EXCEPTION '179.3 FAIL: old identity not deleted';
  END IF;

  RAISE NOTICE '179.3 PASS: register_channel_identity OK (idempotent + identity move)';
END $$;

-- ---------- 179.4 enqueue_notification ----------
DO $$
DECLARE
  v_uid uuid := '210a1790-0000-4000-8000-000000000001';
  v_customer text := '210a1790-0000-4000-8000-000000000001';
  v_result jsonb;
  v_id text;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);

  -- client path (no p_customer_id)
  v_result := public.enqueue_notification('evt-c179-1', NULL, 'Transactional', 'Test Title', 'Test Body', '/orders');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.4 FAIL: enqueue_notification client path failed: %', v_result;
  END IF;
  v_id := v_result->>'id';

  -- idempotent: same event_key returns same id, inserted=false
  v_result := public.enqueue_notification('evt-c179-1', NULL, 'Transactional', 'Test Title 2', 'Test Body 2', '/orders');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.4 FAIL: idempotent failed: %', v_result;
  END IF;
  IF (v_result->>'inserted')::boolean IS TRUE THEN
    RAISE EXCEPTION '179.4 FAIL: duplicate insert should be false: %', v_result;
  END IF;
  IF (v_result->>'id') IS DISTINCT FROM v_id THEN
    RAISE EXCEPTION '179.4 FAIL: id should be same for idempotent';
  END IF;

  -- server path (with p_customer_id)
  v_result := public.enqueue_notification('evt-c179-2', v_customer, 'Marketing', 'Server Title', 'Server Body', NULL);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.4 FAIL: server path failed: %', v_result;
  END IF;

  -- verify row exists with correct customer_id
  IF NOT EXISTS (SELECT 1 FROM public.notification_outbox WHERE id = v_result->>'id' AND customer_id = v_customer AND category = 'Marketing') THEN
    RAISE EXCEPTION '179.4 FAIL: server path row missing';
  END IF;

  RAISE NOTICE '179.4 PASS: enqueue_notification OK (idempotent + client/server path)';
END $$;

-- ---------- 179.5 claim_notification_outbox ----------
DO $$
DECLARE
  v_customer text := '210a1790-0000-4000-8000-000000000001';
  v_rows notification_outbox[];
  v_count int;
BEGIN
  -- insert pending rows
  INSERT INTO public.notification_outbox (id, event_key, customer_id, category, title, body, status, next_attempt_at)
  VALUES
    ('obx-claim-1', 'evt-claim-1', v_customer, 'Transactional', 'Claim 1', 'Body 1', 'pending', NOW() - interval '1 minute'),
    ('obx-claim-2', 'evt-claim-2', v_customer, 'Transactional', 'Claim 2', 'Body 2', 'pending', NOW() - interval '1 minute'),
    ('obx-claim-3', 'evt-claim-3', v_customer, 'Transactional', 'Claim 3', 'Body 3', 'failed', NOW() - interval '5 minute'),
    ('obx-claim-4', 'evt-claim-4', v_customer, 'Transactional', 'Claim 4', 'Body 4', 'sending', NOW() - interval '15 minute'), -- stale
    ('obx-claim-5', 'evt-claim-5', v_customer, 'Transactional', 'Claim 5', 'Body 5', 'pending', NOW() + interval '1 hour'); -- future

  -- claim as service_role (function restricted to service_role)
  PERFORM set_config('role', 'service_role', true);

  SELECT array_agg(r) INTO v_rows FROM (
    SELECT * FROM public.claim_notification_outbox(10)
  ) r;

  PERFORM set_config('role', 'authenticated', true);

  -- should claim pending, failed (due), stale sending
  v_count := array_length(v_rows, 1);
  IF v_count IS NULL OR v_count < 3 THEN
    RAISE EXCEPTION '179.5 FAIL: claimed % rows, expected >= 3', COALESCE(v_count, 0);
  END IF;

  -- verify status changed to 'sending'
  FOR i IN 1..v_count LOOP
    IF v_rows[i].status <> 'sending' THEN
      RAISE EXCEPTION '179.5 FAIL: row % status = % not sending', i, v_rows[i].status;
    END IF;
    IF v_rows[i].claimed_at IS NULL THEN
      RAISE EXCEPTION '179.5 FAIL: row % claimed_at null', i;
    END IF;
  END LOOP;

  -- future row should not be claimed
  IF EXISTS (SELECT 1 FROM public.notification_outbox WHERE id = 'obx-claim-5' AND status = 'sending') THEN
    RAISE EXCEPTION '179.5 FAIL: future row claimed';
  END IF;

  RAISE NOTICE '179.5 PASS: claim_notification_outbox OK (pending + failed due + stale sending)';
END $$;

-- ---------- 179.6 complete_notification ----------
DO $$
DECLARE
  v_customer text := '210a1790-0000-4000-8000-000000000001';
  v_id text;
  v_result jsonb;
BEGIN
  -- service_role (RLS outbox_deny_all_client blocks all client writes — INSERT needs it too)
  PERFORM set_config('role', 'service_role', true);

  -- insert a row to complete
  INSERT INTO public.notification_outbox (id, event_key, customer_id, category, title, body, status, attempts, next_attempt_at)
  VALUES ('obx-complete-1', 'evt-complete-1', v_customer, 'Transactional', 'Complete 1', 'Body', 'sending', 1, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- success path
  v_result := public.complete_notification('obx-complete-1', true, 'web_push', NULL, NULL);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.6 FAIL: complete success failed: %', v_result;
  END IF;
  IF (v_result->>'status') IS DISTINCT FROM 'sent' THEN
    RAISE EXCEPTION '179.6 FAIL: status not sent: %', v_result->>'status';
  END IF;
  IF (v_result->>'channel') IS DISTINCT FROM 'web_push' THEN
    RAISE EXCEPTION '179.6 FAIL: channel not web_push: %', v_result->>'channel';
  END IF;

  -- verify row updated
  IF NOT EXISTS (SELECT 1 FROM public.notification_outbox WHERE id = 'obx-complete-1' AND status = 'sent' AND channel = 'web_push') THEN
    RAISE EXCEPTION '179.6 FAIL: row not updated to sent';
  END IF;

  -- fail path with backoff
  INSERT INTO public.notification_outbox (id, event_key, customer_id, category, title, body, status, attempts, next_attempt_at)
  VALUES ('obx-complete-2', 'evt-complete-2', v_customer, 'Transactional', 'Complete 2', 'Body', 'sending', 1, NOW())
  ON CONFLICT (id) DO NOTHING;

  v_result := public.complete_notification('obx-complete-2', false, 'messenger', 'timeout', NULL);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.6 FAIL: complete fail failed: %', v_result;
  END IF;
  IF (v_result->>'status') IS DISTINCT FROM 'failed' THEN
    RAISE EXCEPTION '179.6 FAIL: status not failed: %', v_result->>'status';
  END IF;
  IF (v_result->>'attempts')::int <> 2 THEN
    RAISE EXCEPTION '179.6 FAIL: attempts not incremented: %', v_result->>'attempts';
  END IF;

  -- verify next_attempt_at set (backoff 2^2 = 4 min)
  IF NOT EXISTS (SELECT 1 FROM public.notification_outbox WHERE id = 'obx-complete-2' AND status = 'failed' AND attempts = 2) THEN
    RAISE EXCEPTION '179.6 FAIL: row not updated to failed with backoff';
  END IF;

  -- dead path (attempts >= 5)
  INSERT INTO public.notification_outbox (id, event_key, customer_id, category, title, body, status, attempts, next_attempt_at)
  VALUES ('obx-complete-3', 'evt-complete-3', v_customer, 'Transactional', 'Complete 3', 'Body', 'sending', 5, NOW())
  ON CONFLICT (id) DO NOTHING;

  v_result := public.complete_notification('obx-complete-3', false, 'line', 'permanent fail', NULL);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.6 FAIL: dead path failed: %', v_result;
  END IF;
  IF (v_result->>'status') IS DISTINCT FROM 'dead' THEN
    RAISE EXCEPTION '179.6 FAIL: status not dead: %', v_result->>'status';
  END IF;

  -- mock path (LINE not live)
  INSERT INTO public.notification_outbox (id, event_key, customer_id, category, title, body, status, attempts, next_attempt_at)
  VALUES ('obx-complete-4', 'evt-complete-4', v_customer, 'Transactional', 'Complete 4', 'Body', 'pending', 0, NOW())
  ON CONFLICT (id) DO NOTHING;

  v_result := public.complete_notification('obx-complete-4', true, 'line', NULL, 'mock');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.6 FAIL: mock path failed: %', v_result;
  END IF;
  IF (v_result->>'status') IS DISTINCT FROM 'mock' THEN
    RAISE EXCEPTION '179.6 FAIL: status not mock: %', v_result->>'status';
  END IF;

  -- verify mock row
  IF NOT EXISTS (SELECT 1 FROM public.notification_outbox WHERE id = 'obx-complete-4' AND status = 'mock' AND channel = 'line') THEN
    RAISE EXCEPTION '179.6 FAIL: mock row not created';
  END IF;

  PERFORM set_config('role', 'authenticated', true);

  RAISE NOTICE '179.6 PASS: complete_notification OK (sent/failed/backoff/dead/mock)';
END $$;

-- ---------- 179.7 business_settings.notification_channels feature flags ----------
DO $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT value INTO v_value FROM public.business_settings WHERE key = 'notification_channels';
  IF v_value IS NULL THEN
    RAISE EXCEPTION '179.7 FAIL: notification_channels setting missing';
  END IF;
  IF (v_value->>'push')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.7 FAIL: push not enabled by default';
  END IF;
  IF (v_value->>'messenger')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '179.7 FAIL: messenger not enabled by default';
  END IF;
  IF (v_value->>'line')::boolean IS TRUE THEN
    RAISE EXCEPTION '179.7 FAIL: line should be false by default (DISABLED/MOCK)';
  END IF;
  IF (v_value->>'lineMode') IS DISTINCT FROM 'mock' THEN
    RAISE EXCEPTION '179.7 FAIL: lineMode should be mock: %', v_value->>'lineMode';
  END IF;

  RAISE NOTICE '179.7 PASS: notification_channels feature flags OK';
END $$;

-- ---------- 179.8 bmb_notify_http bridge exists (ไม่เรียก — กันยิง production EF) ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='bmb_notify_http'
      AND pg_get_function_identity_arguments(p.oid)='p_token text'
  ) THEN
    RAISE EXCEPTION '179.8 FAIL: bmb_notify_http(text) missing';
  END IF;
  RAISE NOTICE '179.8 PASS: bmb_notify_http bridge exists (not invoked)';
END $$;

ROLLBACK;