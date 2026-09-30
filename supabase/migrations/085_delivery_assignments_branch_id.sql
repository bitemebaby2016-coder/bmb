-- ============================================
-- Bite Me Baby Migration 085: TEN-07 delivery_assignments branch_id
-- Date: 2026-09-30 · Baseline: m081 deployed
-- Scope: Add branch_id to delivery_assignments, backfill from driver's home_branch_id
-- Impact: Additive only — nullable column first, backfill, then enforce NOT NULL in m087
-- ============================================

BEGIN;

-- 1. Add branch_id column (nullable)
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS branch_id TEXT;

COMMENT ON COLUMN public.delivery_assignments.branch_id IS
  'BRANCH_SCOPE: FK to branches(id). Assignment resolved from driver''s home_branch_id. Nullable until backfill + enforcement (m087).';

-- 2. Backfill: Set branch_id from driver's home_branch_id
DO $$
DECLARE
  v_updated_count INT;
BEGIN
  UPDATE public.delivery_assignments da
    SET branch_id = d.home_branch_id
    FROM public.drivers d
    WHERE da.driver_id = d.id
      AND da.branch_id IS NULL
      AND d.home_branch_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'TEN-07 Backfill: delivery_assignments from driver.home_branch_id updated=%', v_updated_count;
  
  -- For any remaining nulls (drivers without home_branch_id yet), use tenant default branch
  UPDATE public.delivery_assignments da
    SET branch_id = b.id
    FROM public.branches b
    WHERE da.branch_id IS NULL
      AND b.tenant_id = da.tenant_id
      AND b.is_default = true;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'TEN-07 Backfill: delivery_assignments from tenant default branch updated=%', v_updated_count;
END $$;

-- 3. Verify no nulls remain
DO $$
DECLARE v_null_count INT;
BEGIN
  SELECT count(*) INTO v_null_count FROM public.delivery_assignments WHERE branch_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_NULLS: % delivery_assignments still have null branch_id', v_null_count;
  END IF;
  RAISE NOTICE 'TEN-07 Verify: delivery_assignments.branch_id backfill complete — nulls=0';
END $$;

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_branch ON public.delivery_assignments (branch_id);

COMMIT;