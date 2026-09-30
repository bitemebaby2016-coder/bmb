-- ============================================
-- Bite Me Baby Migration 086: TEN-07 business_settings branch_id
-- Date: 2026-09-30 · Baseline: m081 deployed
-- Scope: Add branch_id to business_settings for branch-level settings override
-- Impact: Additive only — nullable column first, backfill, then enforce NOT NULL in m087
--         Tenant-level settings remain as defaults; branch-level overrides when branch_id set
-- ============================================

BEGIN;

-- 1. Add branch_id column (nullable)
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS branch_id TEXT;

COMMENT ON COLUMN public.business_settings.branch_id IS
  'BRANCH_SCOPE: FK to branches(id). NULL = tenant-level default setting. Non-NULL = branch-specific override. Nullable until backfill + enforcement (m087).';

-- 2. Backfill: Set branch_id to NULL for existing rows (tenant-level defaults)
-- Existing rows are tenant-level defaults, keep as NULL
-- New branch-specific settings will have branch_id set
DO $$
DECLARE v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM public.business_settings WHERE branch_id IS NOT NULL;
  RAISE NOTICE 'TEN-07 Backfill: business_settings branch-specific rows=%, tenant-default rows=%, total rows=%', 
    v_count, 
    (SELECT count(*) FROM public.business_settings) - v_count,
    (SELECT count(*) FROM public.business_settings);
END $$;

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_business_settings_branch ON public.business_settings (branch_id);
CREATE INDEX IF NOT EXISTS idx_business_settings_tenant_branch ON public.business_settings (tenant_id, branch_id);

COMMIT;