-- ============================================
-- Bite Me Baby — Migration 075: TEN-04 Business Settings Tenant Extension
-- Date: 2026-09-29 · Baseline: post-migration-074 (default_brand_id added)
-- Scope: Add tenant_id to business_settings; backfill existing rows → tenant-bmb-001
-- Impact: New column with deterministic backfill; all existing keys get same tenant
-- Owner decisions: operational settings are tenant-owned
-- NOTE: This migration splits business_settings from global to tenant-scoped
-- ====================================================BEGIN;

-- Verify tenant-bmb-001 exists before backfill
DO $$ DECLARE v_count int; BEGIN
  SELECT count(*) INTO v_count FROM public.tenants WHERE id = 'tenant-bmb-001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_TENANT: tenant-bmb-001 not found in tenants table';
  END IF;
END $$;

-- Add tenant_id to business_settings
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Backfill ALL existing rows to tenant-bmb-001 (deterministic single-tenant production)
UPDATE public.business_settings SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;

-- Create index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_business_settings_tenant_id ON public.business_settings (tenant_id);

COMMENT ON COLUMN public.business_settings.tenant_id IS 'Tenant ownership for business_settings. Operational settings (delivery_policy,hours,kitchen_location,operating_hours,order_policy) are tenant-owned per TEN-D06.';

-- Verify no nulls remain after backfill
DO $$ DECLARE v_count int; BEGIN
  SELECT count(*) INTO v_count FROM public.business_settings WHERE tenant_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_NULLS: % business_settings rows still have null tenant_id', v_count;
  END IF;
END $$;

COMMIT;
