-- ============================================
-- Bite Me Baby — Migration 059: TEN-02 Tenant Foundation
-- Date: 2026-09-29 · Baseline: 8169853b
-- Scope: Create tenants + brands tables (new, nullable-only, no backfill yet)
-- Purpose: Multi-tenant architecture foundation for TEN-02
-- ============================================

BEGIN;

-- 1. Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tenants IS
  'TENANT_IDENTITY: multi-tenant root entity. Current production = single tenant (tenant-bmb-001).';

-- 2. Brands table (FK → tenants, nullable tenant_id during transition)
CREATE TABLE IF NOT EXISTS public.brands (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES public.tenants(id),
  name TEXT NOT NULL DEFAULT '',
  logo_url TEXT DEFAULT '',
  color_scheme TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.brands IS
  'BRAND_PRESENTATION: presentation layer per tenant. FK to tenants.';

-- 3. RLS on new tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- tenants: admin manage
DROP POLICY IF EXISTS tenants_admin_manage ON public.tenants;
CREATE POLICY tenants_admin_manage ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- tenants: public read (for future routing resolution)
DROP POLICY IF EXISTS tenants_public_read ON public.tenants;
CREATE POLICY tenants_public_read ON public.tenants
  FOR SELECT TO authenticated
  USING (true);

-- brands: admin manage
DROP POLICY IF EXISTS brands_admin_manage ON public.brands;
CREATE POLICY brands_admin_manage ON public.brands
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- brands: public read
DROP POLICY IF EXISTS brands_public_read ON public.brands;
CREATE POLICY brands_public_read ON public.brands
  FOR SELECT TO authenticated
  USING (true);

-- 4. Grants
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMIT;
