-- ============================================
-- Bite Me Baby — SQL Contract: Migration 137 marketing posts + rules
-- Date: 2026-10-22 · ONE transaction, ROLLBACK at the end — zero persisted data.
-- Proves:
--   G1  marketing_schedule_post บังคับ approval='approved' (คนเท่านั้นอนุมัติ)
--       — โพสต์ที่ยังไม่ผ่าน = ERR_APPROVAL_REQUIRED (scheduler ห้ามรันก่อน approval)
--   G2  ผ่านการอนุมัติแล้ว = ตั้งเวลาได้ + audit row + published แล้วแก้ไม่ได้
--   G3  marketing_save_rules: admin บันทึกได้ · non-admin ERR_FORBIDDEN · anon ไม่มี EXECUTE
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('91616161-6161-6161-6161-616161616161', 'c137-admin@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('92626262-6262-6262-6262-626262626262', 'c137-cust@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, created_at, updated_at)
VALUES
  ('91616161-6161-6161-6161-616161616161', 'admin', now(), now()),
  ('92626262-6262-6262-6262-626262626262', 'customer', now(), now())
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin' WHERE id = '91616161-6161-6161-6161-616161616161';

GRANT SELECT ON public.marketing_posts, public.marketing_rules, public.content_approvals, public.audit_logs TO authenticated;

-- helper: สร้างโพสต์ + approval ตามสถานะที่ระบุ (fixture = ฐานะเจ้าของ DB,
-- การสวม role ทดสอบเฉพาะตอนเรียก RPC เท่านั้น)
CREATE OR REPLACE FUNCTION pg_temp.c137_make_post(p_id text, p_ap_status text) RETURNS text AS $fn$
DECLARE v_ap text;
BEGIN
  v_ap := 'ap-' || p_id;
  INSERT INTO public.content_approvals (id, content_type, title, body, status, created_by)
  VALUES (v_ap, 'post', 'title-' || p_id, 'body', p_ap_status, '91616161-6161-6161-6161-616161616161');
  INSERT INTO public.marketing_posts (id, approval_id, title, body, status, created_by)
  VALUES (p_id, v_ap, 'title-' || p_id, 'body', 'draft', '91616161-6161-6161-6161-616161616161');
  RETURN v_ap;
END $fn$ LANGUAGE plpgsql;

-- ============================================
-- G1. ยังไม่ผ่านการอนุมัติ = ตั้งเวลาไม่ได้ (คนเท่านั้นอนุมัติ)
-- ============================================
DO $$ DECLARE v_status text;
BEGIN
  PERFORM pg_temp.c137_make_post('mk-g1', 'pending');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"91616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  BEGIN
    PERFORM public.marketing_schedule_post('mk-g1', NOW() + interval '1 hour');
    RAISE EXCEPTION 'FAIL G1 schedule before approval must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_APPROVAL_REQUIRED%' THEN RAISE; END IF;
  END;
  SELECT status INTO v_status FROM public.marketing_posts WHERE id = 'mk-g1';
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'FAIL G1 status must stay draft, got %', v_status; END IF;
  RAISE NOTICE 'PASS G1 schedule blocked before human approval';
END $$;

-- ============================================
-- G2. อนุมัติแล้ว = ตั้งเวลาได้ + audit + published แล้วแก้ไม่ได้
-- ============================================
DO $$ DECLARE v_status text; v_n int;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.c137_make_post('mk-g2', 'approved');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"91616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  PERFORM public.marketing_schedule_post('mk-g2', NOW() + interval '2 hour');
  SELECT status INTO v_status FROM public.marketing_posts WHERE id = 'mk-g2';
  IF v_status <> 'scheduled' THEN RAISE EXCEPTION 'FAIL G2 expected scheduled, got %', v_status; END IF;
  RESET ROLE;
  SELECT COUNT(*) INTO v_n FROM public.audit_logs WHERE action = 'marketing_scheduled' AND entity_id = 'mk-g2';
  IF v_n < 1 THEN RAISE EXCEPTION 'FAIL G2 no audit row'; END IF;

  -- published แล้ว = ปิดการแก้ไข
  UPDATE public.marketing_posts SET status = 'published' WHERE id = 'mk-g2';
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"91616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  BEGIN
    PERFORM public.marketing_schedule_post('mk-g2', NOW() + interval '3 hour');
    RAISE EXCEPTION 'FAIL G2 reschedule after publish must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ASSIGNMENT_CLOSED%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS G2 approved schedule + audit + published locked';
END $$;

-- ============================================
-- G3. rules — admin บันทึกได้ / non-admin ไม่ได้ / anon ไม่มี EXECUTE
-- ============================================
DO $$ DECLARE v_out jsonb; v_freq int;
BEGIN
  RESET ROLE;
  IF has_function_privilege('anon', 'public.marketing_save_rules(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL G3 anon must not execute marketing_save_rules';
  END IF;
  IF has_function_privilege('anon', 'public.marketing_schedule_post(text,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL G3 anon must not execute marketing_schedule_post';
  END IF;

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"91616161-6161-6161-6161-616161616161","role":"authenticated"}', false);
  v_out := public.marketing_save_rules('{"frequency_per_week": 5, "cooldown_hours": 8}'::jsonb);
  v_freq := (v_out->>'frequency_per_week')::int;
  IF v_freq <> 5 THEN RAISE EXCEPTION 'FAIL G3 rules not saved (freq=%)', v_freq; END IF;

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"92626262-6262-6262-6262-626262626262","role":"authenticated"}', false);
  BEGIN
    PERFORM public.marketing_save_rules('{"frequency_per_week": 9}'::jsonb);
    RAISE EXCEPTION 'FAIL G3 non-admin save_rules must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS G3 rules persistence + actor guards hold';
END $$;

ROLLBACK;