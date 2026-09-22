-- ============================================
-- Bite Me Baby — Migration 030: order_transition_allowed ELSE (PHASE 3B · WAVE 2)
-- Date: 2026-09-22 · Baseline: fa93f9d · Approved: F-1 (owner: "อนุมัติ ต่อเลย")
--
-- Root cause (F-1):
--   order_transition_allowed(p_from, p_to, p_is_admin, p_is_owner) validates the
--   admin branch with a bare plpgsql CASE that has NO ELSE. Any transition
--   outside the allow-list (delivered→cancelled, pending→delivered,
--   arrived→confirmed, …) falls off the CASE and raises the internal
--   `case not found` (SQLSTATE 20000, case_not_found) instead of returning
--   false — so transition_order_status (migration 019 §9b) surfaces a raw
--   internal error instead of the contracted ERR_INVALID_TRANSITION.
--
-- Change: EXACTLY ONE functional line — `ELSE RETURN false;` added to the admin
--   CASE. The body is otherwise identical to the live definition at baseline
--   fa93f9d (proven via pg_get_functiondef). The owner branch already had
--   explicit fallthrough returns and is untouched.
--
-- NOT changed (per Phase 3B gate):
--   signature · SECURITY DEFINER · SET search_path · allow-list entries ·
--   owner branch · EXECUTE grants (service_role only) · all callers
--   (transition_order_status, guard_order_status_transition, cancel_order flow).
--
-- Rollback: re-apply the pre-030 body (the same CREATE OR REPLACE FUNCTION
--   WITHOUT the `ELSE RETURN false;` line).
-- Idempotent: safe to re-run (CREATE OR REPLACE).
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.order_transition_allowed(p_from text, p_to text, p_is_admin boolean, p_is_owner boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_from = p_to THEN RETURN true; END IF;

  IF p_is_admin THEN
    CASE
      WHEN (p_from = 'pending'            AND p_to = 'confirmed') THEN RETURN true;
      WHEN (p_from = 'confirmed'          AND p_to = 'preparing') THEN RETURN true;
      WHEN (p_from = 'preparing'          AND p_to = 'ready_for_dispatch') THEN RETURN true;
      WHEN (p_from = 'ready_for_dispatch' AND p_to = 'dispatched') THEN RETURN true;
      WHEN (p_from = 'dispatched'         AND p_to = 'in_transit') THEN RETURN true;
      WHEN (p_from = 'in_transit'         AND p_to = 'arrived') THEN RETURN true;
      WHEN (p_from = 'arrived'            AND p_to = 'delivered') THEN RETURN true;
      WHEN (p_from IN ('pending','confirmed','preparing','ready_for_dispatch','dispatched','in_transit','arrived') AND p_to = 'cancelled') THEN RETURN true;
      WHEN (p_from IN ('pending','confirmed','preparing','ready_for_dispatch','dispatched','in_transit','arrived') AND p_to = 'failed') THEN RETURN true;
      ELSE RETURN false; -- F-1: off-allow-list admin transitions return false (were: case not found)
    END CASE;
    RETURN false;
  END IF;

  -- Customer (owner): can only cancel their own order from pending
  IF p_is_owner THEN
    IF p_from = 'pending' AND p_to = 'cancelled' THEN RETURN true; END IF;
    RETURN false;
  END IF;

  RETURN false;
END;
$function$;

-- Grants unchanged (kept explicit; CREATE OR REPLACE preserves them anyway)
REVOKE EXECUTE ON FUNCTION public.order_transition_allowed(text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_transition_allowed(text, text, boolean, boolean) TO service_role;

COMMIT;

-- ============================================
-- END OF MIGRATION 030
-- ============================================