-- ============================================
-- Bite Me Baby Migration 101: menu_sections anon read grant (ACL drift fix)
-- Symptom (production probe 2026-10-01, anon key): "permission denied for
--   table menu_sections" — menu_sections_public_read policy (055) exists but
--   the anon/authenticated SELECT grant is missing, so guest MenuPage cannot
--   load admin-created sections at all (getSections() → []) and categories
--   assigned to those sections disappear from the customer menu.
-- Root cause: ACL drift — migration 097 lists menu_sections in its grant loop,
--   but the production DB never got the grant for this table.
-- Fix: idempotent GRANT (same pattern as 097/100). RLS stays ON; the 055
--   policy (is_active = true) still gates which rows guests can see.
-- ============================================

BEGIN;

GRANT SELECT ON public.menu_sections TO anon, authenticated;

-- Verification: anon grant must exist (must be 0 missing)
DO $$
DECLARE v_missing int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM information_schema.tables it
  WHERE it.table_schema = 'public' AND it.table_name = 'menu_sections'
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public' AND g.table_name = 'menu_sections'
        AND g.grantee = 'anon' AND g.privilege_type = 'SELECT'
    );
  RAISE NOTICE 'menu_sections anon grant audit — missing: %', v_missing;
  IF v_missing > 0 THEN RAISE EXCEPTION 'ERR_MENU_SECTIONS_GRANT_MISSING'; END IF;
END $$;

COMMIT;