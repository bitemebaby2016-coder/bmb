-- ============================================
-- Bite Me Baby — Migration 062: TEN-02 Deterministic Backfill
-- Date: 2026-09-29 · Baseline: 8169853b
-- Scope: INSERT single tenant row + backfill ALL ops tables to tenant-bmb-001
-- Evidence: Production is single-business → deterministic single-tenant mapping
-- Safety: No destructive changes; existing PKs/FKs intact
-- ============================================

BEGIN;

-- 1. Create the single operational tenant
INSERT INTO public.tenants (id, name, slug, status, created_at, updated_at)
VALUES ('tenant-bmb-001', 'Bite Me Baby', 'bite-me-baby', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Verification before update: confirm no pre-existing tenant_id values exist
DO $$
DECLARE v_drivers_null int; v_rounds_null int; v_zones_null int; v_assignments_null int;
BEGIN
  SELECT count(*) INTO v_drivers_null FROM public.drivers WHERE tenant_id IS NOT NULL;
  SELECT count(*) INTO v_rounds_null FROM public.delivery_rounds WHERE tenant_id IS NOT NULL;
  SELECT count(*) INTO v_zones_null FROM public.delivery_zones WHERE tenant_id IS NOT NULL;
  SELECT count(*) INTO v_assignments_null FROM public.delivery_assignments WHERE tenant_id IS NOT NULL;
  
  IF v_drivers_null > 0 OR v_rounds_null > 0 OR v_zones_null > 0 OR v_assignments_null > 0 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_CONFLICT: Pre-existing tenant_id found. drivers=%, rounds=%, zones=%, assignments=%.',
      v_drivers_null, v_rounds_null, v_zones_null, v_assignments_null;
  END IF;
END $$;

-- 3. Backfill all operational tables
UPDATE public.drivers SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;
UPDATE public.delivery_rounds SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;
UPDATE public.delivery_zones SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;
UPDATE public.delivery_assignments SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;

COMMIT;
