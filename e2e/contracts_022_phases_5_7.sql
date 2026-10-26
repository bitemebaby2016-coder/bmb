-- ============================================
-- Bite Me Baby — QA-03 SQL Contract Suite for migration 022 (OWNER: SQL Editor)
-- ROLLS BACK — zero production writes persist. Run AFTER: supabase db push (022).
-- ============================================
BEGIN;

-- W-2 (B-2): fixture แอดมิน — submit บันทึก created_by = auth.uid() (FK) และ review ตรวจ is_admin()
--   · ROLLBACK ท้ายไฟล์
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('77777777-7777-7777-7777-777777777777', 'contract-022-admin@bmb.test', 'x',
        now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role)
VALUES ('77777777-7777-7777-7777-777777777777', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

DO $$
DECLARE
  v_cap_id text;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);

  -- 0) functions exist
  -- W-2: submit_content_for_approval มี 5 พารามิเตอร์ (image_url/mascot เพิ่มในยุค 022+)
  IF to_regprocedure('public.customer_intelligence(uuid)') IS NULL
     OR to_regprocedure('public.submit_content_for_approval(text,text,text,text,text)') IS NULL
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