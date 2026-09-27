-- ============================================
-- Bite Me Baby — Migration 049: F-14 single-signature repair (production)
-- Context: 048 (applied) contained BOTH the 16-param legacy wrapper and the
-- 17-param trusted wrapper → PostgREST PGRST203 ambiguous for existing callers.
-- This migration removes the 16-param overload so exactly ONE public
-- signature remains (17-param, additive defaults) — matching the repo's
-- corrected 048 file.
-- Additive repair; reversible (re-create removed function if ever needed).
-- ============================================

DROP FUNCTION IF EXISTS public.create_order_with_items(
  jsonb, text, text, text, numeric, numeric, text, text, text, text, text, numeric, text, date, text, text
);
