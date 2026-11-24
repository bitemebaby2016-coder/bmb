-- ============================================
-- Bite Me Baby — Migration 214: Create Suppliers Table
-- Date: 2026-11-24
-- Phase 1 Task 1.1: Create normalized supplier master (MUST BE FIRST per Owner Decision B5)
-- ============================================

BEGIN;

-- ============================================
-- 1. SUPPLIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  code            TEXT UNIQUE,                     -- short code for display/selection
  contact_name    TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  payment_terms_days  INTEGER DEFAULT 30,         -- e.g., 30, 60, 90
  lead_time_days      INTEGER DEFAULT 7,          -- typical lead time
  is_active       BOOLEAN NOT NULL DEFAULT true,
  tenant_id       TEXT REFERENCES public.tenants(id) ON DELETE SET NULL,
  branch_id       TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_branch ON public.suppliers(branch_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm ON public.suppliers USING gin (name gin_trgm_ops);

-- ============================================
-- 3. RLS
-- ============================================
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS suppliers_admin ON public.suppliers;
CREATE POLICY suppliers_admin ON public.suppliers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Staff (inventory, kitchen, pos, finance) can read active suppliers
DROP POLICY IF EXISTS suppliers_staff_read ON public.suppliers;
CREATE POLICY suppliers_staff_read ON public.suppliers
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
DROP TRIGGER IF EXISTS suppliers_updated_at ON public.suppliers;
CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. GRANTS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT ON public.suppliers TO anon;

-- ============================================
-- 6. SEED FROM EXISTING DENORMALIZED DATA (dry-run helper)
-- ============================================
-- This section is for reference only - actual backfill happens in migration 215
-- after this table exists. The dry-run script should be run separately.
--
-- Example dry-run query:
-- SELECT DISTINCT
--   'sup-' || md5(lower(trim(supplier_name)) || '|' || trim(supplier_phone)) as id,
--   trim(supplier_name) as name,
--   lower(regexp_replace(trim(supplier_name), '\s+', '', 'g')) as code,
--   NULL as contact_name,
--   trim(supplier_phone) as phone,
--   NULL as email,
--   NULL as address,
--   30 as payment_terms_days,
--   7 as lead_time_days,
--   true as is_active,
--   NULL as tenant_id,
--   NULL as branch_id
-- FROM public.inventory
-- WHERE supplier_name IS NOT NULL AND supplier_name != ''
--   AND supplier_phone IS NOT NULL AND supplier_phone != ''
-- ORDER BY supplier_name;

COMMIT;

-- ============================================
-- END OF MIGRATION 214
-- ============================================