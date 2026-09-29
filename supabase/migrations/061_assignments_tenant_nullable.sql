-- ============================================
-- Bite Me Baby — Migration 061: TEN-02 Delivery Assignments Tenant ID
-- Date: 2026-09-29 · Baseline: 8169853b
-- Scope: Add tenant_id TEXT NULL to delivery_assignments
-- Impact: Additive only — resolved from linked driver row at backfill time
-- ============================================

BEGIN;

ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS tenant_id TEXT;

COMMENT ON COLUMN public.delivery_assignments.tenant_id IS
  'TENANT_IDENTITY: FK to tenants(id). Nullable until backfill + enforcement (TEN-02). Resolved from drivers.tenant_id.';

COMMIT;
