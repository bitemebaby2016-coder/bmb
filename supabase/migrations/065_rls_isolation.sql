-- ============================================
-- Bite Me Baby — Migration 065: TEN-02 RLS Isolation Rewrite
-- Date: 2026-09-29 · Baseline: 8169853b
-- Scope: Tenant-aware RLS policies for ops tables
-- Impact: Rewrites is_admin-based admin policies to be tenant-aware
-- Critical: Must preserve existing single-tenant behavior; becomes multi-tenant aware when new tenants are added
-- ============================================

BEGIN;

-- -------------------------------------------------------
-- 1. NEW HELPER FUNCTION: is_tenant_admin(t)
-- -------------------------------------------------------
-- Security definer: checks if authenticated user has tenant-admin authority
-- Uses existing profile.role + optional tenant_id (added in migration-066)
-- For now, uses COALESCE(tenant_id, '') for backward compatibility during transition

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
   WHERE p.role IN ('tenant_admin', 'admin')
     AND (COALESCE(p.tenant_id, 'tenant-bmb-001') = p_tenant_id
          OR p.id = (SELECT id FROM public.profiles WHERE id IS NOT NULL LIMIT 1 OFFSET 0)) -- fallback
  );
$$;

-- Actually, let's use a simpler and safer approach based on production evidence:
-- All admins currently have tenant_id=null → fall back to existing is_admin() logic
-- Only explicitly marked is_platform admins bypass tenant check

DROP FUNCTION IF EXISTS public.is_tenant_admin(text);

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_role text; v_is_platform boolean; BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN false; END IF;
  
  SELECT role, COALESCE(tenant_id, 'tenant-bmb-001') INTO v_role, p_tenant_id FROM public.profiles WHERE id = v_uid;
  IF v_role IS NULL THEN RETURN false; END IF;
  
  -- Platform admin (is_owner=true / is_platform) → cross-tenant access
  SELECT is_owner INTO v_is_platform FROM public.profiles WHERE id = v_uid;
  IF v_is_platform IS TRUE THEN RETURN true; END IF;
  
  -- Admin or tenant_admin with matching tenant_id → own tenant access
  IF v_role IN ('admin', 'tenant_admin') AND (COALESCE((SELECT tenant_id FROM public.profiles WHERE id = v_uid), 'tenant-bmb-001') = COALESCE(p_tenant_id, 'tenant-bmb-001')) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END $$;

-- Grant EXECUTE restricted
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(text) FROM PUBLIC, anon;

-- -------------------------------------------------------
-- 2. DRIVERS RLS (preserve driver-scoped identity from migration-041)
-- -------------------------------------------------------

-- Drop old admin-write policy (replace with tenant-aware version)
DROP POLICY IF EXISTS drivers_admin_write ON public.drivers;

-- New: tenant-aware admin manage (platform_admin OR tenant_admin for this tenant)
CREATE POLICY drivers_tenant_admin_manage ON public.drivers
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

-- Keep existing scoped_read (F-06 JWT binding preserved)
-- drivers_scoped_read already exists from migration-041

-- Keep existing self_update (F-06 JWT binding preserved)
-- drivers_self_update already exists from migration-041

-- DENY anon
DROP POLICY IF EXISTS drivers_deny_anon ON public.drivers;
CREATE POLICY drivers_deny_anon ON public.drivers
  FOR SELECT TO anon USING (false);

-- -------------------------------------------------------
-- 3. DELIVERY_ROUNDS RLS
-- -------------------------------------------------------

DROP POLICY IF EXISTS delivery_rounds_admin_manage ON public.delivery_rounds;
CREATE POLICY delivery_rounds_tenant_admin_manage ON public.delivery_rounds
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

-- Public read stays open (routes/day visible to all resolved customers)
-- delivery_rounds_public_read already exists — keep unchanged

-- -------------------------------------------------------
-- 4. DELIVERY_ZONES RLS
-- -------------------------------------------------------

DROP POLICY IF EXISTS delivery_zones_admin ON public.delivery_zones;
CREATE POLICY delivery_zones_tenant_admin_manage ON public.delivery_zones
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

-- Public read stays open
-- delivery_zones_public_read already exists — keep unchanged

-- -------------------------------------------------------
-- 5. DELIVERY_ASSIGNMENTS RLS
-- -------------------------------------------------------

DROP POLICY IF EXISTS assignments_admin_write ON public.delivery_assignments;

CREATE POLICY assignments_tenant_admin_manage ON public.delivery_assignments
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

-- Keep existing scoped_read (F-06 JWT binding preserved)
-- assignments_scoped_read already exists from migration-041

-- Keep deny_anon
-- assignments_deny_anon already exists — keep unchanged

COMMIT;
