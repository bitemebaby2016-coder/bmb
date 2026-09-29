-- ============================================
-- Bite Me Baby — Migration 060: TEN-02 Operational Tenant IDs
-- Date: 2026-09-29 · Baseline: 8169853b
-- Scope: Add tenant_id TEXT NULL to drivers, delivery_rounds, delivery_zones
-- Impact: Additive only — no destructive changes, existing data preserved
-- ============================================

BEGIN;

-- 1. drivers
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS tenant_id TEXT;

COMMENT ON COLUMN public.drivers.tenant_id IS
  'TENANT_IDENTITY: FK to tenants(id). Nullable until backfill + enforcement (TEN-02).';

-- 2. delivery_rounds
ALTER TABLE public.delivery_rounds ADD COLUMN IF NOT EXISTS tenant_id TEXT;

COMMENT ON COLUMN public.delivery_rounds.tenant_id IS
  'TENANT_IDENTITY: FK to tenants(id). Nullable until backfill + enforcement (TEN-02).';

-- 3. delivery_zones
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS tenant_id TEXT;

COMMENT ON COLUMN public.delivery_zones.tenant_id IS
  'TENANT_IDENTITY: FK to tenants(id). Nullable until backfill + enforcement (TEN-02).';

COMMIT;
