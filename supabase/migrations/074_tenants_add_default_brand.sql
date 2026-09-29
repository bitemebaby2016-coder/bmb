-- ============================================
-- Bite Me Baby — Migration 074: TEN-04 Tenants Add Default Brand
-- Date: 2026-09-29 · Baseline: post-migration-073 (seeding complete)
-- Scope: Add tenants.default_brand_id TEXT FK→brands(id)
-- Impact: Column addition only; backfill via application logic in migration-075
-- Owner decisions: tenant needs default_brand_id for routing fallback
-- ============================================

BEGIN;

-- Add default_brand_id to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS default_brand_id TEXT REFERENCES public.brands(id);

COMMENT ON COLUMN public.tenants.default_brand_id IS 'Reference to the default brand used for routing fallback when tenant has multiple brands.';

COMMIT;
