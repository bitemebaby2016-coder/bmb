-- ============================================
-- Bite Me Baby — Migration 032: PUBLIC EXECUTE drift repair (PHASE 3B · WAVE 2 addendum)
-- Date: 2026-09-22 · Baseline: post-031 · Found by: post-031 anonFnProbe residual diff
--
-- Root cause: 5 lifecycle/pre-order-internal functions on production carry a
--   PUBLIC EXECUTE grant (ACL `{=X/postgres,...}`) — the empty grantee = PUBLIC.
--   Migration 031 removed the per-role anon entries; a PUBLIC grant is a
--   DIFFERENT ACL entry and survives it. Canonical state (local) denies anon on
--   all five — so production must too.
--
-- Functions (exact identity signatures from pg_get_function_identity_arguments):
--   auto_approve_order() · calculate_loyalty_points(numeric) ·
--   check_product_availability(uuid) · update_order_status() ·
--   validate_order_before_submit()
--
-- Change: REVOKE EXECUTE ... FROM PUBLIC on exactly those five (DO-block
--   tolerant of undefined_function so environments missing any of them are fine).
--   anonymous users keep every canonical anon grant (the 49 shared functions).
--
-- NOT changed: authenticated/service_role grants · RLS · table ACLs.
-- Idempotent: safe to re-run.
-- ============================================

BEGIN;

DO $$
DECLARE
  sigs text[] := ARRAY[
    'auto_approve_order()',
    'calculate_loyalty_points(p_order_total numeric)',
    'check_product_availability(p_product_id uuid)',
    'update_order_status()',
    'validate_order_before_submit()'
  ];
  s text;
BEGIN
  FOREACH s IN ARRAY sigs LOOP
    BEGIN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION public.' || s || ' FROM PUBLIC';
    EXCEPTION WHEN undefined_function OR undefined_object THEN
      NULL; -- function absent on this environment: nothing to revoke
    END;
  END LOOP;
END
$$;

COMMIT;

-- ============================================
-- END OF MIGRATION 032
-- ============================================