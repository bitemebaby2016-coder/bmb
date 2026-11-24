-- ============================================
-- Bite Me Baby — Migration 216: Enrich Inventory with Cost & Yield Fields
-- Date: 2026-11-24
-- Phase 1 Task 1.3: Add prep yield, unit conversion, WAVG, package info to inventory
-- Implements Owner Decisions B1 (Cost Model), B2 (Unit Conversion), B3 (Yield/Waste)
-- ============================================

BEGIN;

-- ============================================
-- 1. NEW COLUMNS FOR INVENTORY
-- ============================================

-- Prep Yield & Waste (Ingredient-level, before recipe) — Owner Decision B3
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS prep_yield_factor NUMERIC(5,4) NOT NULL DEFAULT 1.0000
    CHECK (prep_yield_factor > 0 AND prep_yield_factor <= 1),
  ADD COLUMN IF NOT EXISTS prep_waste_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00
    CHECK (prep_waste_pct >= 0 AND prep_waste_pct <= 100);

-- Unit Conversion — Owner Decision B2
-- conversion_factor = USE_UNITS per 1 PURCHASE_UNIT
-- Example: purchase_unit='carton', use_unit='bottle', conversion_factor=24
--          purchase_unit='bottle', use_unit='ml', conversion_factor=500
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS purchase_unit TEXT,
  ADD COLUMN IF NOT EXISTS use_unit TEXT,
  ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC(10,4) NOT NULL DEFAULT 1.0000
    CHECK (conversion_factor > 0);

-- Package Size & Weight
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS package_size NUMERIC(10,2),        -- e.g., 24 (units per package)
  ADD COLUMN IF NOT EXISTS gross_weight NUMERIC(10,3),        -- kg per package
  ADD COLUMN IF NOT EXISTS net_weight NUMERIC(10,3);          -- kg per package (net)

-- Cost Fields — Owner Decision B1
-- wavg_cost = Perpetual Moving Weighted Average (primary valuation)
-- last_purchase_price = Last GRN realized landed cost per use unit
-- last_approved_price = Last admin-approved price for costing
-- unit_price = LEGACY FIELD RETAINED for backward compatibility
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS wavg_cost NUMERIC(12,4),           -- WAVG per use unit
  ADD COLUMN IF NOT EXISTS last_purchase_price NUMERIC(12,4), -- Last GRN realized
  ADD COLUMN IF NOT EXISTS last_approved_price NUMERIC(12,4); -- Last approved for costing

-- ============================================
-- 2. BACKFILL EXISTING DATA BEFORE CONSTRAINT
-- ============================================
-- Migrate existing unit to use_unit for backward compatibility
UPDATE public.inventory
SET use_unit = unit
WHERE use_unit IS NULL AND unit IS NOT NULL;

-- If purchase_unit not set, default to use_unit (1:1 conversion)
UPDATE public.inventory
SET purchase_unit = use_unit, conversion_factor = 1.0
WHERE purchase_unit IS NULL AND use_unit IS NOT NULL;

-- ============================================
-- 3. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inventory_wavg_cost ON public.inventory(wavg_cost);
CREATE INDEX IF NOT EXISTS idx_inventory_last_purchase ON public.inventory(last_purchase_price);

-- ============================================
-- 4. CONSTRAINTS & VALIDATION (after data is clean)
-- ============================================
-- Ensure use_unit is set when purchase_unit is set (and vice versa)
-- This is a soft constraint; hard enforcement in application layer
-- PostgreSQL doesn't support ADD CONSTRAINT IF NOT EXISTS for CHECK constraints
-- Use DO block to check existence first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'inventory_units_consistency' 
    AND conrelid = 'public.inventory'::regclass
  ) THEN
    ALTER TABLE public.inventory
    ADD CONSTRAINT inventory_units_consistency
    CHECK (
      (purchase_unit IS NULL AND use_unit IS NULL) OR
      (purchase_unit IS NOT NULL AND use_unit IS NOT NULL)
    );
  END IF;
END $$;

-- ============================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN public.inventory.prep_yield_factor IS 
  'Ingredient prep yield: usable qty / purchased qty (e.g., 0.85 for vegetable trim). Owner Decision B3: separate from recipe batch yield.';
COMMENT ON COLUMN public.inventory.prep_waste_pct IS 
  'Ingredient prep waste percentage (0-100). For reference; prep_yield_factor is authoritative for calculations.';
COMMENT ON COLUMN public.inventory.purchase_unit IS 
  'Unit of measure when purchasing from supplier (e.g., carton, bag, kg).';
COMMENT ON COLUMN public.inventory.use_unit IS 
  'Unit of measure used in recipes/kitchen (e.g., piece, ml, g). Base unit for all internal calculations.';
COMMENT ON COLUMN public.inventory.conversion_factor IS 
  'USE_UNITS per 1 PURCHASE_UNIT. Owner Decision B2: conversion_factor = use_qty / purchase_qty. Example: carton=24 bottles → 24. Formula: use_qty = purchase_qty × conversion_factor.';
COMMENT ON COLUMN public.inventory.package_size IS 
  'Number of use_units per supplier package (e.g., 24 bottles per carton).';
COMMENT ON COLUMN public.inventory.gross_weight IS 
  'Gross weight per package in kg.';
COMMENT ON COLUMN public.inventory.net_weight IS 
  'Net weight per package in kg (excl. packaging).';
COMMENT ON COLUMN public.inventory.wavg_cost IS 
  'Perpetual Moving Weighted Average cost per USE_UNIT. Owner Decision B1: primary stock valuation method. Updated atomically on GRN posting.';
COMMENT ON COLUMN public.inventory.last_purchase_price IS 
  'Last GRN realized landed cost per USE_UNIT. Owner Decision B1: separate from WAVG.';
COMMENT ON COLUMN public.inventory.last_approved_price IS 
  'Last admin-approved price for costing (from price_history status=approved). Owner Decision B1: separate from WAVG and last_purchase_price.';
COMMENT ON COLUMN public.inventory.unit_price IS 
  'LEGACY FIELD RETAINED for backward compatibility. NOT updated by GRN flow. Use wavg_cost for valuation.';

COMMIT;

-- ============================================
-- END OF MIGRATION 216
-- ============================================