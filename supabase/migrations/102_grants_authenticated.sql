-- ============================================
-- Bite Me Baby Migration 102: authenticated SELECT grants (ACL drift fix)
-- Symptom (production probe 2026-10-01): admin pages 403 on
--   profiles / branches / product_categories / business_settings
--   (code 42501 "permission denied for table <t>" with hint
--   "GRANT SELECT ON public.<t> TO authenticated").
-- Root cause: ACL drift — RLS policies exist but table-level SELECT grant
--   for role authenticated was never issued on production for these tables.
-- Fix: idempotent GRANT (same pattern as 097/100/101). RLS stays ON and
--   remains authoritative — this only opens the door at the ACL layer.
-- ============================================

BEGIN;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.branches TO authenticated;
GRANT SELECT ON public.product_categories TO authenticated;
GRANT SELECT ON public.delivery_rounds TO authenticated;
GRANT SELECT ON public.business_settings TO authenticated;
GRANT SELECT ON public.menu_sections TO authenticated;

-- Verification: authenticated grant must exist (must be 0 missing)
DO $$
DECLARE v_missing int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM (VALUES ('profiles'),('branches'),('product_categories'),
               ('delivery_rounds'),('business_settings'),('menu_sections')) AS t(name)
  WHERE EXISTS (
    SELECT 1 FROM information_schema.tables it
    WHERE it.table_schema = 'public' AND it.table_name = t.name)
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public' AND g.table_name = t.name
        AND g.grantee = 'authenticated' AND g.privilege_type = 'SELECT');
  RAISE NOTICE 'authenticated grant audit — missing: %', v_missing;
  IF v_missing > 0 THEN RAISE EXCEPTION 'ERR_AUTH_GRANT_MISSING'; END IF;
END $$;

COMMIT;
