-- ============================================
-- Bite Me Baby — Migration 123: publish_menu_schedule enforcement (PHASE 1)
-- Date: 2026-10-13 · Baseline: 26919b2 · Source: OWNER DIRECTIVE — WEEKLY
-- PRE_ORDER MENU CONTROL PHASE 1 (Owner decisions #1/#3 + Step B scope).
--
-- OWNER BUSINESS INTENT:
--   Weekly PRE_ORDER schedule = 14 entries/week (exactly 2 per day × 7 days).
--   Drafts may be incomplete; PUBLISHING a date requires exactly 2 distinct,
--   valid, PRE_ORDER-eligible products. Server-side validation is the ONLY
--   authority — UI checks are convenience mirrors.
--
-- DESIGN (extends 039, never replaces; NO table/column change):
--   publish_menu_schedule(date, publish=true) now validates BEFORE flipping:
--     1) the date HAS schedule rows            → else ERR_MENU_NOT_FOUND
--     2) row count = exactly 2 (UNIQUE(date,product) = distinct) → else
--        ERR_MENU_COUNT_INVALID
--     3) both rows are valid = product exists AND is_available AND
--        available_preorder (canonical) AND NOT archived → else
--        ERR_PRODUCT_INVALID (publish of a disabled/archived/non-preorder
--        product is rejected)
--   publish=false (unpublish) stays unconditional so admins can always
--   take a non-compliant date off sale. set_menu_schedule (draft editor)
--   is unchanged — drafts may be incomplete by design (Owner #3).
--   No schema (table/column/index/RLS) change: the existing model already
--   expresses the requirement via menu_schedule rows + products columns.
--
-- AFFECTED: publish_menu_schedule() function body only.
-- SECURITY: unchanged — SECURITY DEFINER + is_admin + auth checks kept.
-- ROLLBACK: re-run 039 body of the same function (or revert this file and
--   re-apply); no data is modified by this migration itself.
-- DEPENDENCIES: 039 (menu_schedule), 025 (canonical RPC), 055 (archived).
-- VERIFICATION: e2e/contracts_123_menu_publish.sql (BEGIN...ROLLBACK) +
--   src/__tests__/menuSchedule.test.ts (mock mirror — mock ≠ production).
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.publish_menu_schedule(
  p_scheduled_date date,
  p_publish boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_n integer;
  v_total integer;
  v_valid integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  IF p_publish IS TRUE THEN
    -- Phase 1 (Owner #3): publishing a date requires exactly 2 distinct,
    -- valid, PRE_ORDER-eligible products. Server authority — UI is mirror only.
    SELECT COUNT(*) INTO v_total
      FROM public.menu_schedule
     WHERE scheduled_date = p_scheduled_date;

    IF v_total = 0 THEN
      RAISE EXCEPTION 'ERR_MENU_NOT_FOUND: no schedule for %', p_scheduled_date::text;
    END IF;
    IF v_total <> 2 THEN
      RAISE EXCEPTION 'ERR_MENU_COUNT_INVALID: % entries for % (exactly 2 required)',
        v_total, p_scheduled_date::text;
    END IF;

    SELECT COUNT(*) INTO v_valid
      FROM public.menu_schedule ms
      JOIN public.products p ON p.id = ms.product_id
     WHERE ms.scheduled_date = p_scheduled_date
       AND COALESCE(p.is_available, false) = true
       AND COALESCE(p.available_preorder, false) = true
       AND COALESCE(p.archived, false) = false;

    IF v_valid <> 2 THEN
      RAISE EXCEPTION 'ERR_PRODUCT_INVALID: % valid PRE_ORDER menus for % (disabled/archived/non-preorder product in schedule)',
        v_valid, p_scheduled_date::text;
    END IF;
  END IF;

  UPDATE public.menu_schedule
     SET is_published = p_publish, updated_at = NOW()
   WHERE scheduled_date = p_scheduled_date;

  SELECT COUNT(*) INTO v_n FROM public.menu_schedule
   WHERE scheduled_date = p_scheduled_date AND is_published = p_publish;

  PERFORM public.append_audit_log(
    p_action := 'menu_schedule_publish',
    p_entity_type := 'menu_schedule',
    p_entity_id := p_scheduled_date::text,
    p_description := CASE WHEN p_publish THEN 'menu published' ELSE 'menu unpublished' END,
    p_metadata := jsonb_build_object('rows', v_n)
  );
  RETURN jsonb_build_object('ok', true, 'date', p_scheduled_date::text, 'rows', v_n);
END;
$$;

COMMIT;
