-- ============================================
-- Bite Me Baby — Migration 217: Create Supplier Products Mapping Table
-- Date: 2026-11-24
-- Phase 1 Task 1.4: Supplier ↔ Ingredient mapping with 3 price states
-- Implements Owner Decision B4 (Purchase Price History States)
-- ============================================

BEGIN;

-- ============================================
-- 1. SUPPLIER_PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id                      TEXT PRIMARY KEY,
  supplier_id             TEXT NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  ingredient_id           TEXT NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  supplier_sku            TEXT,                          -- Supplier's product code/SKU
  supplier_name           TEXT,                          -- Supplier's name for this product
  purchase_unit           TEXT NOT NULL,                 -- Unit when purchasing (e.g., carton)
  use_unit                TEXT NOT NULL,                 -- Unit used internally (e.g., bottle)
  conversion_factor       NUMERIC(10,4) NOT NULL DEFAULT 1.0000
    CHECK (conversion_factor > 0),                       -- use_units per 1 purchase_unit
  
  -- Three Price States — Owner Decision B4
  last_committed_price    NUMERIC(12,4),                 -- PO approved (committed)
  last_realized_price     NUMERIC(12,4),                 -- GRN posted (realized)
  last_approved_price     NUMERIC(12,4),                 -- Admin approved for costing
  
  last_committed_at       TIMESTAMPTZ,
  last_realized_at        TIMESTAMPTZ,
  last_approved_at        TIMESTAMPTZ,
  
  last_purchase_date      DATE,                          -- Last GRN date
  min_order_qty           NUMERIC(10,2) DEFAULT 1,
  lead_time_days          INTEGER DEFAULT 7,
  is_preferred            BOOLEAN NOT NULL DEFAULT false,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  
  tenant_id               TEXT REFERENCES public.tenants(id) ON DELETE SET NULL,
  branch_id               TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (supplier_id, ingredient_id)                    -- One mapping per supplier-ingredient
);

-- ============================================
-- 2. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON public.supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_ingredient ON public.supplier_products(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_active ON public.supplier_products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_supplier_products_preferred ON public.supplier_products(is_preferred) WHERE is_preferred = true;
CREATE INDEX IF NOT EXISTS idx_supplier_products_sku ON public.supplier_products(supplier_sku);

-- ============================================
-- 3. RLS
-- ============================================
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS supplier_products_admin ON public.supplier_products;
CREATE POLICY supplier_products_admin ON public.supplier_products
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Staff (inventory, kitchen, pos, finance) read active mappings
DROP POLICY IF EXISTS supplier_products_staff_read ON public.supplier_products;
CREATE POLICY supplier_products_staff_read ON public.supplier_products
  FOR SELECT TO authenticated USING (
    is_active = true
    AND (
      public.is_admin()
      OR public.is_inventory()
      OR public.is_kitchen()
      OR public.is_pos()
      OR public.is_finance()
    )
  );

-- ============================================
-- 4. TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS supplier_products_updated_at ON public.supplier_products;
CREATE TRIGGER supplier_products_updated_at
  BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. GRANTS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_products TO authenticated;
GRANT SELECT ON public.supplier_products TO anon;

-- ============================================
-- 6. COMMENTS
-- ============================================
COMMENT ON COLUMN public.supplier_products.conversion_factor IS 
  'USE_UNITS per 1 PURCHASE_UNIT. Matches inventory.conversion_factor. Example: carton=24 bottles.';
COMMENT ON COLUMN public.supplier_products.last_committed_price IS 
  'PO approved price per purchase_unit. Owner Decision B4: Committed state (no stock change).';
COMMENT ON COLUMN public.supplier_products.last_realized_price IS 
  'GRN posted price per purchase_unit. Owner Decision B4: Realized state (stock increases, feeds WAVG).';
COMMENT ON COLUMN public.supplier_products.last_approved_price IS 
  'Admin-approved price for costing per purchase_unit. Owner Decision B4: Approved state (policy gate).';
COMMENT ON TABLE public.supplier_products IS 
  'Maps supplier SKU to ingredient. One mapping per supplier-ingredient. Tracks 3 price states per Owner Decision B4.';

COMMIT;

-- ============================================
-- END OF MIGRATION 217
-- ============================================