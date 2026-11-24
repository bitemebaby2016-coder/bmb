-- ============================================
-- Bite Me Baby — Migration 218: Add Batch Yield & Cost Fields to Recipes
-- Date: 2026-11-24
-- Phase 1 Task 1.5: Add batch yield, waste, cost fields to recipes
-- Implements Owner Decision B3 (separate batch yield from prep yield)
-- ============================================

BEGIN;

-- ============================================
-- 1. NEW COLUMNS FOR RECIPES
-- ============================================

-- Batch Yield & Waste (Recipe-level, during cooking) — Owner Decision B3
-- Separate from ingredient prep_yield_factor/prep_waste_pct
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS batch_yield_factor NUMERIC(5,4) NOT NULL DEFAULT 1.0000
    CHECK (batch_yield_factor > 0 AND batch_yield_factor <= 1),
  ADD COLUMN IF NOT EXISTS batch_waste_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00
    CHECK (batch_waste_pct >= 0 AND batch_waste_pct <= 100);

-- Computed Cost Fields
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(12,4),      -- Yield-adjusted cost per recipe unit
  ADD COLUMN IF NOT EXISTS last_cost_calculated_at TIMESTAMPTZ;

-- ============================================
-- 2. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_recipes_cost_per_unit ON public.recipes(cost_per_unit);

-- ============================================
-- 3. COMMENTS
-- ============================================
COMMENT ON COLUMN public.recipes.batch_yield_factor IS 
  'Recipe/batch yield: final output / raw input (e.g., 0.90 for soup evaporation). Owner Decision B3: separate from ingredient prep_yield_factor. Formula: Recipe Cost (Yield-Adjusted) = Raw Recipe Cost / (prep_yield_factor × batch_yield_factor).';
COMMENT ON COLUMN public.recipes.batch_waste_pct IS 
  'Recipe/batch waste percentage (0-100). For reference; batch_yield_factor is authoritative.';
COMMENT ON COLUMN public.recipes.cost_per_unit IS 
  'Computed yield-adjusted cost per recipe unit. Updated by calculate_recipe_cost RPC. Includes ingredient WAVG + dual yield adjustment.';
COMMENT ON COLUMN public.recipes.last_cost_calculated_at IS 
  'Timestamp of last cost calculation. Used for staleness checks.';

COMMIT;

-- ============================================
-- END OF MIGRATION 218
-- ============================================