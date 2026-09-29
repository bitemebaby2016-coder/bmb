-- ============================================
-- Bite Me Baby — Migration 076: TEN-04 Mascot Overrides Brand Extension
-- Date: 2026-09-29 · Baseline: post-migration-075 (business_settings extended)
-- Scope: Add tenant_id + brand_id to mascot_overrides; backfill NULL (shared/default)
-- Impact: Non-destructive; NULL means "readable across all tenants" (default mascot)
-- Owner decisions: mascots are global defaults with optional brand overrides
-- NOTE: This migration does NOT delete existing data or break current mascot system
-- ====================================================BEGIN;

-- Verify tenant-bmb-001 exists before backfill
DO $$ DECLARE v_count int; BEGIN
  SELECT count(*) INTO v_count FROM public.tenants WHERE id = 'tenant-bmb-001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_TENANT: tenant-bmb-001 not found in tenants table';
  END IF;
END $$;

-- Add tenant_id to mascot_overrides
ALTER TABLE public.mascot_overrides ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Add brand_id to mascot_overrides  
ALTER TABLE public.mascot_overrides ADD COLUMN IF NOT EXISTS brand_id TEXT REFERENCES public.brands(id);

CREATE INDEX IF NOT EXISTS idx_mascot_overrides_tenant_brand ON public.mascot_overrides (tenant_id, brand_id);

COMMENT ON COLUMN public.mascot_overrides.tenant_id IS 'Tenant ownership for mascot overrides. NULL = shared default readable across all tenants.';
COMMENT ON COLUMN public.mascot_overrides.brand_id IS 'Brand-scoped mascot override. NULL = uses tenant-level default.';

-- Backfill ALL existing rows → NULL for both columns (shared default behavior preserved)
UPDATE public.mascot_overrides SET tenant_id = NULL, brand_id = NULL WHERE tenant_id IS NULL;

COMMIT;
