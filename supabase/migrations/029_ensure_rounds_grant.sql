-- ============================================
-- Bite Me Baby — Migration 029: PRE_ORDER round-instantiation privilege (PHASE 3B · WAVE 1)
-- Date: 2026-09-22 · Baseline: a9ab8cd · Approved scope: ONE additive GRANT
--
-- Purpose:
--   The canonical customer checkout (Phase 3B) needs `ensure_rounds_for_date(date)`
--   so a customer can instantiate the deterministic rounds of a future PRE_ORDER
--   date before picking one — exactly the action the legacy compat shim
--   (create_pre_order_with_items, migration 025 §4a) already performs internally
--   on the customer's behalf (SECURITY DEFINER).
--   Granting EXECUTE to authenticated exposes ONLY that same action; the function
--   remains SECURITY DEFINER with its strict validation (ERR_MISSING_DATE /
--   ERR_DATE_IN_PAST) and the 028 template hardening (active templates only).
--
-- NOT changed (per Phase 3B gate):
--   order domain schema · create_order_with_items logic · pricing/payment/
--   inventory/delivery authority · RLS policies · round configuration write
--   privileges · service_role privileges.
--
-- ROLLBACK:
--   REVOKE EXECUTE ON FUNCTION public.ensure_rounds_for_date(date) FROM authenticated;
-- ============================================

GRANT EXECUTE ON FUNCTION public.ensure_rounds_for_date(date) TO authenticated;

-- ============================================
-- END OF MIGRATION 029
-- ============================================
