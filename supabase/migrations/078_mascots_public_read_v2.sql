

-- ============================================
-- Bite Me Baby Migration 078: TEN-05 Mascot Public Read Extension
-- Date: 2026-09-29 · Baseline: 6b46cac (TEN-04 deployed)
-- Scope: Extend mascots_public_read to include brand-specific mascot overrides
-- Impact: Non-destructive — only adds new rows visible, no data mutation
-- Owner decision: RD-06 = APPROVED
-- ============================================

BEGIN;

-- Drop old public_read policy (allows NULL brand_id / shared default only)
DROP POLICY IF EXISTS mascots_public_read ON public.mascot_overrides;

-- New: allow anon/authenticated SELECT on:
--   - NULL brand_id (shared default across all brands)
--   - brand_id that matches an active+published brand
CREATE POLICY mascots_public_read_v2 ON public.mascot_overrides
  FOR SELECT TO anon, authenticated
  USING (
    brand_id IS NULL 
    OR brand_id IN (
      SELECT id FROM public.brands 
      WHERE is_published = true AND status = 'active'
    )
  );

COMMIT;
