-- ============================================
-- Bite Me Baby — QA-03 SQL Contract Suite for migration 021 (OWNER: SQL Editor)
-- ALL tests run inside a transaction that ROLLS BACK — zero writes persist.
-- Must pass AFTER:  supabase db push   (migration 021)
-- ============================================
BEGIN;

DO $$
DECLARE
  v_sys jsonb;
BEGIN
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