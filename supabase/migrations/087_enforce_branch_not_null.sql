-- ============================================
-- Bite Me Baby Migration 087: TEN-07 Enforce NOT NULL on branch_id
-- Date: 2026-09-30 · Baseline: m082-m086 deployed (backfill complete)
-- Scope: Enforce NOT NULL on branch_id columns for all operational tables
-- Prerequisite: All rows must have branch_id assigned (verified in m082-m086)
-- Impact: Schema enforcement only — no data changes
-- ============================================

BEGIN;

-- 1. Verify no nulls remain before enforcement (extra safety gate)
DO $$
DECLARE
  v_null_rounds INT;
  v_null_zones INT;
  v_null_drivers INT;
  v_null_assignments INT;
BEGIN
  SELECT count(*) INTO v_null_rounds FROM public.delivery_rounds WHERE branch_id IS NULL;
  SELECT count(*) INTO v_null_zones FROM public.delivery_zones WHERE branch_id IS NULL;
  SELECT count(*) INTO v_null_drivers FROM public.drivers WHERE home_branch_id IS NULL;
  SELECT count(*) INTO v_null_assignments FROM public.delivery_assignments WHERE branch_id IS NULL;
  
  IF v_null_rounds > 0 OR v_null_zones > 0 OR v_null_drivers > 0 OR v_null_assignments > 0 THEN
    RAISE EXCEPTION 'ERR_ENFORCEMENT_NULLS: Cannot enforce NOT NULL — rounds=%, zones=%, drivers=%, assignments=% still have null branch_id',
      v_null_rounds, v_null_zones, v_null_drivers, v_null_assignments;
  END IF;
  
  RAISE NOTICE 'TEN-07 VERIFY: All branch_id columns clean — rounds=%, zones=%, drivers=%, assignments=%',
    v_null_rounds, v_null_zones, v_null_drivers, v_null_assignments;
END $$;

-- 2. Add FK constraints (now that data is clean)
ALTER TABLE public.delivery_rounds
  ADD CONSTRAINT delivery_rounds_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE public.delivery_zones
  ADD CONSTRAINT delivery_zones_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_home_branch_id_fkey
  FOREIGN KEY (home_branch_id) REFERENCES public.branches(id);

ALTER TABLE public.delivery_assignments
  ADD CONSTRAINT delivery_assignments_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id);

-- business_settings branch_id can remain NULL (tenant-level defaults)
ALTER TABLE public.business_settings
  ADD CONSTRAINT business_settings_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id);

-- 3. Enforce NOT NULL on branch-scoped columns
ALTER TABLE public.delivery_rounds ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE public.delivery_zones ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE public.drivers ALTER COLUMN home_branch_id SET NOT NULL;
ALTER TABLE public.delivery_assignments ALTER COLUMN branch_id SET NOT NULL;

-- 4. Verify enforcement
DO $$
DECLARE
  v_null_rounds INT;
  v_null_zones INT;
  v_null_drivers INT;
  v_null_assignments INT;
BEGIN
  SELECT count(*) INTO v_null_rounds FROM public.delivery_rounds WHERE branch_id IS NULL;
  SELECT count(*) INTO v_null_zones FROM public.delivery_zones WHERE branch_id IS NULL;
  SELECT count(*) INTO v_null_drivers FROM public.drivers WHERE home_branch_id IS NULL;
  SELECT count(*) INTO v_null_assignments FROM public.delivery_assignments WHERE branch_id IS NULL;
  
  IF v_null_rounds > 0 OR v_null_zones > 0 OR v_null_drivers > 0 OR v_null_assignments > 0 THEN
    RAISE EXCEPTION 'ERR_POST_ENFORCEMENT: Nulls detected after NOT NULL — rounds=%, zones=%, drivers=%, assignments=%',
      v_null_rounds, v_null_zones, v_null_drivers, v_null_assignments;
  END IF;
  
  RAISE NOTICE 'TEN-07 SUCCESS: NOT NULL enforcement complete on all branch_id columns';
END $$;

COMMIT;