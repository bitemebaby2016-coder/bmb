-- ============================================
-- Bite Me Baby Migration 083: TEN-07 delivery_zones branch_id
-- Date: 2026-09-30 · Baseline: m081 deployed
-- Scope: Add branch_id to delivery_zones, backfill to default branch
-- Impact: Additive only — nullable column first, backfill, then enforce NOT NULL in m087
-- ============================================

BEGIN;

-- 1. Add branch_id column (nullable for safe migration)
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS branch_id TEXT;

COMMENT ON COLUMN public.delivery_zones.branch_id IS
  'BRANCH_SCOPE: FK to branches(id). Each zone belongs to a specific branch service area. Nullable until backfill + enforcement (m087).';

-- 2. Backfill: Set branch_id to tenant's default branch
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
    
    UPDATE public.delivery_zones
      SET branch_id = v_default_branch_id
      WHERE tenant_id = v_tenant_id
        AND branch_id IS NULL;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE 'TEN-07 Backfill: delivery_zones tenant=% branch=% updated=%', v_tenant_id, v_default_branch_id, v_updated_count;
  END LOOP;
END $$;

-- 3. Verify no nulls remain
DO $$
DECLARE v_null_count INT;
BEGIN
  SELECT count(*) INTO v_null_count FROM public.delivery_zones WHERE branch_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_NULLS: % delivery_zones still have null branch_id', v_null_count;
  END IF;
  RAISE NOTICE 'TEN-07 Verify: delivery_zones.branch_id backfill complete — nulls=0';
END $$;

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_delivery_zones_branch ON public.delivery_zones (branch_id);

COMMIT;