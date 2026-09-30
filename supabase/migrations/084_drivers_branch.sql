-- ============================================
-- Bite Me Baby Migration 084: TEN-07 drivers home_branch_id + can_float
-- Date: 2026-09-30 · Baseline: m081 deployed
-- Scope: Add home_branch_id and can_float to drivers (hybrid model)
-- Impact: Additive only — nullable columns first, backfill, then enforce NOT NULL in m087
-- ============================================

BEGIN;

-- 1. Add home_branch_id column (nullable)
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS home_branch_id TEXT;

COMMENT ON COLUMN public.drivers.home_branch_id IS
  'BRANCH_HOME: FK to branches(id). Driver''s primary/home branch. Nullable until backfill + enforcement (m087).';

-- 2. Add can_float column (boolean, default true for flexibility)
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS can_float BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.drivers.can_float IS
  'BRANCH_FLOAT: If true, driver can be assigned to orders from other branches within same tenant. If false, driver only serves home_branch_id.';

-- 3. Backfill: Set home_branch_id to tenant's default branch
DO $$
DECLARE
  v_tenant_id TEXT;
  v_default_branch_id TEXT;
  v_updated_count INT;
BEGIN
  FOR v_tenant_id IN SELECT id FROM public.tenants LOOP
    SELECT id INTO v_default_branch_id
      FROM public.branches
      WHERE tenant_id = v_tenant_id AND is_default = true
      LIMIT 1;
    
    IF v_default_branch_id IS NULL THEN
      INSERT INTO public.branches (id, tenant_id, code, name, slug, address_line1, city, province, country, latitude, longitude, service_radius_km, is_default)
      VALUES (
        'branch-' || v_tenant_id || '-main',
        v_tenant_id,
        'main',
        'Main Branch',
        'main',
        'Default Address',
        'Bangkok', 'Bangkok', 'TH',
        10.7016, 102.1429, 5.00,
        true
      )
      ON CONFLICT (tenant_id, code) DO UPDATE SET id = EXCLUDED.id
      RETURNING id INTO v_default_branch_id;
    END IF;
    
    UPDATE public.drivers
      SET home_branch_id = v_default_branch_id
      WHERE tenant_id = v_tenant_id
        AND home_branch_id IS NULL;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE 'TEN-07 Backfill: drivers tenant=% branch=% updated=%', v_tenant_id, v_default_branch_id, v_updated_count;
  END LOOP;
END $$;

-- 4. Verify no nulls remain on home_branch_id
DO $$
DECLARE v_null_count INT;
BEGIN
  SELECT count(*) INTO v_null_count FROM public.drivers WHERE home_branch_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_NULLS: % drivers still have null home_branch_id', v_null_count;
  END IF;
  RAISE NOTICE 'TEN-07 Verify: drivers.home_branch_id backfill complete — nulls=0';
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_drivers_home_branch ON public.drivers (home_branch_id);
CREATE INDEX IF NOT EXISTS idx_drivers_can_float ON public.drivers (tenant_id, can_float) WHERE can_float = true;

COMMIT;