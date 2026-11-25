-- ============================================================
-- Contract 203+204 — AI Grounding + user_post_context + Order Memory
-- ครอบคลุม:
--   203.1 social_events.grounding_data (jsonb) + reply_draft (text) columns
--   203.2 idx_social_events_grounding_data GIN index
--   203.3 user_post_context table (PK user_id,page_id) + RLS service_role + columns
--   204.1 social_events: customer_id + last_order_id + order_history columns
--   204.2 indexes: idx_social_events_customer_id + idx_social_events_last_order_id
--   204.3 review_content sync: approval -> marketing_posts status='approved'
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- ---------- 203.1 social_events AI grounding columns ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='social_events' AND column_name='grounding_data') THEN
    RAISE EXCEPTION '203.1 FAIL: grounding_data column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='social_events' AND column_name='reply_draft') THEN
    RAISE EXCEPTION '203.1 FAIL: reply_draft column missing';
  END IF;

  -- grounding_data type jsonb
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_events' AND column_name='grounding_data'
      AND data_type <> 'jsonb'
  ) THEN
    RAISE EXCEPTION '203.1 FAIL: grounding_data should be jsonb';
  END IF;

  RAISE NOTICE '203.1 PASS: social_events AI grounding columns OK';
END $$;

-- ---------- 203.2 GIN index on grounding_data ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='social_events' AND indexname='idx_social_events_grounding_data'
  ) THEN
    RAISE EXCEPTION '203.2 FAIL: idx_social_events_grounding_data missing';
  END IF;

  -- verify GIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='social_events' AND indexname='idx_social_events_grounding_data'
      AND indexdef LIKE '%USING gin%'
  ) THEN
    RAISE EXCEPTION '203.2 FAIL: index not GIN';
  END IF;

  RAISE NOTICE '203.2 PASS: idx_social_events_grounding_data GIN OK';
END $$;

-- ---------- 203.3 user_post_context table ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='user_post_context'
  ) THEN
    RAISE EXCEPTION '203.3 FAIL: user_post_context table missing';
  END IF;

  -- PK (user_id, page_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='user_post_context' AND constraint_type='PRIMARY KEY'
  ) THEN
    RAISE EXCEPTION '203.3 FAIL: PK missing';
  END IF;

  -- columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_post_context' AND column_name='user_id') THEN
    RAISE EXCEPTION '203.3 FAIL: user_id column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_post_context' AND column_name='page_id') THEN
    RAISE EXCEPTION '203.3 FAIL: page_id column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_post_context' AND column_name='post_id') THEN
    RAISE EXCEPTION '203.3 FAIL: post_id column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_post_context' AND column_name='post_message') THEN
    RAISE EXCEPTION '203.3 FAIL: post_message column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_post_context' AND column_name='post_created_at') THEN
    RAISE EXCEPTION '203.3 FAIL: post_created_at column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_post_context' AND column_name='updated_at') THEN
    RAISE EXCEPTION '203.3 FAIL: updated_at column missing';
  END IF;

  -- RLS enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='user_post_context' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION '203.3 FAIL: RLS not enabled';
  END IF;

  -- policy service_role_full_access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_post_context' AND policyname='service_role_full_access'
  ) THEN
    RAISE EXCEPTION '203.3 FAIL: service_role_full_access policy missing';
  END IF;

  -- index on updated_at
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='user_post_context' AND indexname='idx_user_post_context_updated'
  ) THEN
    RAISE EXCEPTION '203.3 FAIL: idx_user_post_context_updated missing';
  END IF;

  RAISE NOTICE '203.3 PASS: user_post_context table + PK + RLS + index OK';
END $$;

-- ---------- 204.1 social_events order memory columns ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='social_events' AND column_name='customer_id') THEN
    RAISE EXCEPTION '204.1 FAIL: customer_id column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='social_events' AND column_name='last_order_id') THEN
    RAISE EXCEPTION '204.1 FAIL: last_order_id column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='social_events' AND column_name='order_history') THEN
    RAISE EXCEPTION '204.1 FAIL: order_history column missing';
  END IF;

  -- order_history type jsonb
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_events' AND column_name='order_history'
      AND data_type <> 'jsonb'
  ) THEN
    RAISE EXCEPTION '204.1 FAIL: order_history should be jsonb';
  END IF;

  RAISE NOTICE '204.1 PASS: social_events order memory columns OK';
END $$;

-- ---------- 204.2 indexes ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='social_events' AND indexname='idx_social_events_customer_id'
  ) THEN
    RAISE EXCEPTION '204.2 FAIL: idx_social_events_customer_id missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='social_events' AND indexname='idx_social_events_last_order_id'
  ) THEN
    RAISE EXCEPTION '204.2 FAIL: idx_social_events_last_order_id missing';
  END IF;

  RAISE NOTICE '204.2 PASS: order memory indexes OK';
END $$;

-- ---------- 204.3 review_content sync marketing_posts ----------
DO $$
DECLARE
  v_approval_id text := 'approval-c204-1';
  v_result jsonb;
BEGIN
  -- fixture: content_approvals pending for marketing post
  INSERT INTO public.content_approvals (id, content_type, title, body, image_url, mascot, status, created_by, created_at)
  VALUES (v_approval_id, 'post', 'Test Post', 'Test body', NULL, NULL, 'pending', 'dddf4b57-405f-4852-a985-76d8d52b1b72', NOW())
  ON CONFLICT (id) DO UPDATE SET status = 'pending';

  -- fixture: marketing_posts with approval_id
  INSERT INTO public.marketing_posts (id, title, status, approval_id)
  VALUES ('mp-c204-1', 'Test Marketing Post', 'pending_approval', v_approval_id)
  ON CONFLICT (id) DO UPDATE SET status = 'pending_approval', approval_id = EXCLUDED.approval_id;

  -- admin approves
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

  v_result := public.review_content(v_approval_id, 'approved', 'Looks good');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '204.3 FAIL: review_content failed: %', v_result;
  END IF;

  -- verify marketing_posts status = approved
  IF NOT EXISTS (
    SELECT 1 FROM public.marketing_posts WHERE approval_id = v_approval_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION '204.3 FAIL: marketing_posts not synced to approved';
  END IF;

  -- verify audit log
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs WHERE action = 'marketing_post_synced' AND entity_id = v_approval_id
  ) THEN
    RAISE EXCEPTION '204.3 FAIL: marketing_post_synced audit log missing';
  END IF;

  RAISE NOTICE '204.3 PASS: review_content syncs marketing_posts to approved OK';
END $$;

ROLLBACK;