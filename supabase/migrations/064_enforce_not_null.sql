-- ============================================
-- Bite Me Baby — Migration 064: TEN-02 Enforce NOT NULL
-- Date: 2026-09-29 · Baseline: post-migration-063 (verification passed)
-- Scope: Set NOT NULL on tenant_id columns for ops tables
-- Prerequisite: All rows must have tenant_id assigned (verified in migration-063)
-- ============================================

BEGIN;

-- Verify no nulls remain before enforcement (extra safety gate)
DO $$
DECLARE v_null_drivers int; v_null_rounds int; v_null_zones int; v_null_assignments int;
BEGIN
  SELECT count(*) INTO v_null_drivers FROM public.drivers WHERE tenant_id IS NULL;
  SELECT count(*) INTO v_null_rounds FROM public.delivery_rounds WHERE tenant_id IS NULL;
  SELECT count(*) INTO v_null_zones FROM public.delivery_zones WHERE tenant_id IS NULL;
  SELECT count(*) INTO v_null_assignments FROM public.delivery_assignments WHERE tenant_id IS NULL;
  
  IF v_null_drivers > 0 OR v_null_rounds > 0 OR v_null_zones > 0 OR v_null_assignments > 0 THEN
    RAISE EXCEPTION 'ERR_ENFORCEMENT_NULLS: Cannot enforce NOT NULL — drivers=%, rounds=%, zones=%, assignments=% still have null',
      v_null_drivers, v_null_rounds, v_null_zones, v_null_assignments;
  END IF;
END $$;

ALTER TABLE public.drivers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.delivery_rounds ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.delivery_zones ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.delivery_assignments ALTER COLUMN tenant_id SET NOT NULL;

COMMIT;
