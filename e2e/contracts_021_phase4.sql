-- ============================================
-- Bite Me Baby — QA-03 SQL Contract Suite for migration 021 (OWNER: SQL Editor)
-- ALL tests run inside a transaction that ROLLS BACK — zero writes persist.
-- Must pass AFTER:  supabase db push   (migration 021)
-- ============================================
BEGIN;

-- W-2 (B-2): fixture ผู้ใช้จริง — save_ai_memory/get_ai_memory ยึด auth.uid() และ
--   ai_customer_memory.user_id มี FK (ไม่มี user = insert ไม่ได้) · ROLLBACK ท้ายไฟล์
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('88888888-8888-8888-8888-888888888888', 'contract-021@bmb.test', 'x',
        now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role)
VALUES ('88888888-8888-8888-8888-888888888888', 'customer')
ON CONFLICT (id) DO UPDATE SET role = 'customer';

DO $$
DECLARE
  v_sys jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);

  -- 0) functions exist
  IF to_regprocedure('public.create_notification(text,text,text,text)') IS NULL
     OR to_regprocedure('public.set_notification_pref(text,boolean)') IS NULL
     OR to_regprocedure('public.record_system_error(text,text,text,jsonb)') IS NULL
     OR to_regprocedure('public.list_system_errors(integer)') IS NULL
     OR to_regprocedure('public.save_ai_memory(jsonb)') IS NULL
     OR to_regprocedure('public.get_ai_memory()') IS NULL
     OR to_regprocedure('public.upsert_mascot_override(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'FAIL migration 021 functions missing';
  END IF;

  -- 1) tables + columns (021 markers)
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.notifications'::regclass AND attname = 'category') THEN
    RAISE EXCEPTION 'FAIL notifications.category missing';
  END IF;
  IF to_regclass('public.notification_prefs') IS NULL
     OR to_regclass('public.system_errors') IS NULL
     OR to_regclass('public.mascot_overrides') IS NULL
     OR to_regclass('public.ai_customer_memory') IS NULL THEN
    RAISE EXCEPTION 'FAIL 021 tables missing';
  END IF;

  -- 2) AI memory round-trip (within rollback txn)
  PERFORM public.save_ai_memory('{"name":"QA"}'::jsonb);
  IF (public.get_ai_memory() ->> 'memory')::jsonb ->> 'name' <> 'QA' THEN
    RAISE EXCEPTION 'FAIL ai memory round-trip';
  END IF;

  -- 3) record_system_error writes a feed row
  v_sys := public.record_system_error('qa probe error', 'client', 'error', '{"probe":true}'::jsonb);
  IF NOT EXISTS (SELECT 1 FROM public.system_errors WHERE message = 'qa probe error') THEN
    RAISE EXCEPTION 'FAIL system_errors insert';
  END IF;

  RAISE NOTICE 'QA-03 migration 021 SQL suite PASS (transaction rolled back — no writes persisted)';
END $$;

ROLLBACK;
-- ============================================
-- END — paste output into e2e/contracts-021-phase4-sql-result.txt (owner action, read-only)
-- ============================================