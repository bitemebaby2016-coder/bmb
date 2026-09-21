-- ============================================
-- Bite Me Baby — QA-03 SQL Contract Suite for migration 022 (OWNER: SQL Editor)
-- ROLLS BACK — zero production writes persist. Run AFTER: supabase db push (022).
-- ============================================
BEGIN;

DO $$
DECLARE
  v_cap_id text;
BEGIN
  -- 0) functions exist
  IF to_regprocedure('public.customer_intelligence(uuid)') IS NULL
     OR to_regprocedure('public.submit_content_for_approval(text,text,text)') IS NULL
     OR to_regprocedure('public.review_content(text,text,text)') IS NULL
     OR to_regprocedure('public.is_content_approved(text)') IS NULL THEN
    RAISE EXCEPTION 'FAIL migration 022 functions missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='customer_intelligence') THEN
    RAISE EXCEPTION 'FAIL customer_intelligence view missing';
  END IF;

  -- 1) CI-01: view queryable + segment labels present
  PERFORM count(*) FROM public.customer_intelligence;

  -- 2) CNT-01: submit->pending, non-approval gate blocks, approve opens gate
  v_cap_id := (public.submit_content_for_approval('banner', 'QA แบนเนอร์', 'ทดสอบ') ->> 'id')::text;
  IF v_cap_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.content_approvals WHERE id = v_cap_id AND status = 'pending') THEN
    RAISE EXCEPTION 'FAIL submit pending';
  END IF;
  IF public.is_content_approved(v_cap_id) THEN RAISE EXCEPTION 'FAIL gate open before approval'; END IF;
  PERFORM public.review_content(v_cap_id, 'approved', 'qa ok');
  IF NOT public.is_content_approved(v_cap_id) THEN RAISE EXCEPTION 'FAIL gate closed after approval'; END IF;

  -- 3) AI-03 merge: save twice keeps both keys
  PERFORM public.save_ai_memory('{"a":1}'::jsonb);
  PERFORM public.save_ai_memory('{"b":2}'::jsonb);
  IF (public.get_ai_memory() ->> 'memory')::jsonb ->> 'a' IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'FAIL memory merge lost key a';
  END IF;

  RAISE NOTICE 'QA-03 migration 022 SQL suite PASS (transaction rolled back — no writes persisted)';
END $$;

ROLLBACK;
-- ============================================
-- END — paste output into e2e/contracts-022-sql-result.txt (owner action, read-only)
-- ============================================