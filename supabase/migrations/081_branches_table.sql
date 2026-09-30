-- ============================================
-- Bite Me Baby Migration 081: TEN-07 Branches Table
-- Date: 2026-09-30 · Baseline: m080 deployed
-- Scope: Create branches table for multi-location tenancy
-- Impact: Additive only — new table, no existing data affected
-- ============================================

BEGIN;

-- 1. Create branches table
CREATE TABLE IF NOT EXISTS public.branches (
  id                  TEXT PRIMARY KEY,           -- 'branch-{tenant_slug}-{code}'
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id),
  code                TEXT NOT NULL,              -- unique per tenant: 'main', 'sukhumvit', 'rangsit'
  name                TEXT NOT NULL,              -- 'Bite Me Baby Sukhumvit'
  slug                TEXT NOT NULL,              -- 'sukhumvit'
  display_name        TEXT,
  
  -- Physical Address
  address_line1       TEXT NOT NULL,
  address_line2       TEXT,
  city                TEXT NOT NULL DEFAULT 'Bangkok',
  province            TEXT NOT NULL DEFAULT 'Bangkok',
  postal_code         TEXT,
  country             TEXT NOT NULL DEFAULT 'TH',
  
  -- Geo Location (for distance calc)
  latitude            NUMERIC(10,7) NOT NULL,
  longitude           NUMERIC(10,7) NOT NULL,
  service_radius_km   NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  
  -- Kitchen Location (may differ from customer-facing address)
  kitchen_latitude    NUMERIC(10,7),
  kitchen_longitude   NUMERIC(10,7),
  
  -- Operational
  operating_hours     JSONB DEFAULT '{"open":"10:00","close":"22:00"}'::jsonb,
  status              TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active','inactive','maintenance')),
  is_default          BOOLEAN NOT NULL DEFAULT false,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, slug)
);

COMMENT ON TABLE public.branches IS
  'BRANCH_LOCATION: Physical branch/store location within a tenant. One tenant can have multiple branches.';

COMMENT ON COLUMN public.branches.latitude IS 'Customer-facing address latitude for distance calculation';
COMMENT ON COLUMN public.branches.longitude IS 'Customer-facing address longitude for distance calculation';
COMMENT ON COLUMN public.branches.kitchen_latitude IS 'Kitchen/prep location latitude for dispatch routing (may differ from address)';
COMMENT ON COLUMN public.branches.kitchen_longitude IS 'Kitchen/prep location longitude for dispatch routing';
COMMENT ON COLUMN public.branches.service_radius_km IS 'Delivery service radius from this branch (km)';
COMMENT ON COLUMN public.branches.operating_hours IS 'JSON: {open:"HH:MM", close:"HH:MM", timezone:"Asia/Bangkok", exceptions:[]}';
COMMENT ON COLUMN public.branches.is_default IS 'Default branch for tenant (fallback when no branch specified)';

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON public.branches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_branches_geo ON public.branches (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_branches_default ON public.branches (tenant_id, is_default) WHERE is_default = true;

-- 3. RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Platform admin: manage all branches
DROP POLICY IF EXISTS branches_platform_admin_manage ON public.branches;
CREATE POLICY branches_platform_admin_manage ON public.branches
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform = true));

-- Tenant admin: manage branches of own tenant
DROP POLICY IF EXISTS branches_tenant_admin_manage ON public.branches;
CREATE POLICY branches_tenant_admin_manage ON public.branches
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'tenant_admin')
              AND COALESCE(p.tenant_id, 'tenant-bmb-001') = branches.tenant_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'tenant_admin')
              AND COALESCE(p.tenant_id, 'tenant-bmb-001') = branches.tenant_id)
  );

-- Branch staff: read own branch only (via profiles.branch_id)
DROP POLICY IF EXISTS branches_branch_staff_read ON public.branches;
CREATE POLICY branches_branch_staff_read ON public.branches
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.branch_id = branches.id)
  );

-- Public read: active branches for brand routing (?brand=slug)
DROP POLICY IF EXISTS branches_public_read ON public.branches;
CREATE POLICY branches_public_read ON public.branches
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- Deny anon write
DROP POLICY IF EXISTS branches_deny_anon_write ON public.branches;
CREATE POLICY branches_deny_anon_write ON public.branches
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- 4. Grants
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(text) TO authenticated;

-- 5. Updated_at trigger
DROP TRIGGER IF EXISTS branches_updated_at ON public.branches;
CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;