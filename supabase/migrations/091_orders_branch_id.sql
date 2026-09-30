-- ============================================
-- Bite Me Baby Migration 091: TEN-08 Orders Branch ID
-- Date: 2026-09-30 · Baseline: m090 deployed
-- Scope: Add branch_id to orders for Order Tenancy isolation
-- Impact: Denormalized column — updated by create_order_with_items RPC (M089)
-- DEPENDENCY: Must be executed BEFORE any strict RLS/Filter relying on orders.branch_id
-- ============================================

BEGIN;

-- 1. Add branch_id column to orders (nullable to avoid backfill)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id TEXT;

COMMENT ON COLUMN public.orders.branch_id IS
  'TEN-08 ORDER TENANCY: FK to branches(id). Denormalized from delivery_rounds.branch_id for fast order-level branch scope & RLS.';

-- 2. Add FK constraint (nullable)
DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Index for efficient tenant/branch scoped reads & admin filtering
CREATE INDEX IF NOT EXISTS idx_orders_branch ON public.orders (branch_id);

COMMIT;
