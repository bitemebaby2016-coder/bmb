-- ============================================
-- Bite Me Baby Migration 088: TEN-07 Branch-Level RLS Policies
-- Date: 2026-09-30 · Baseline: m087 deployed, m090 executed first
-- Scope: Create is_branch_admin helper + rewrite all RLS for branch-level isolation
-- Impact: Policy updates only — no schema changes
-- DEPENDENCY: Requires m090 (profiles.branch_id) to be run BEFORE this migration
-- ============================================

BEGIN;

-- 1. Helper function: is_branch_admin(p_branch_id)
CREATE OR REPLACE FUNCTION public.is_branch_admin(p_branch_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID; v_role TEXT; v_is_platform BOOLEAN;
  v_user_tenant TEXT; v_user_branch TEXT; v_branch_tenant TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  SELECT role, COALESCE(tenant_id, 'tenant-bmb-001'), branch_id INTO v_role, v_user_tenant, v_user_branch
    FROM public.profiles WHERE id = v_uid LIMIT 1;
  IF v_role IS NULL THEN RETURN FALSE; END IF;

  SELECT COALESCE(is_platform, FALSE) INTO v_is_platform FROM public.profiles WHERE id = v_uid LIMIT 1;
  IF v_is_platform THEN RETURN TRUE; END IF;

  SELECT tenant_id INTO v_branch_tenant FROM public.branches WHERE id = p_branch_id LIMIT 1;
  IF v_branch_tenant IS NULL THEN RETURN FALSE; END IF;

  IF v_role IN ('admin', 'tenant_admin') AND v_user_tenant = v_branch_tenant THEN RETURN TRUE; END IF;
  IF v_role = 'branch_staff' AND v_user_branch = p_branch_id THEN RETURN TRUE; END IF;
  RETURN FALSE;
END $$;

REVOKE EXECUTE ON FUNCTION public.is_branch_admin(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_branch_admin(TEXT) TO authenticated;

COMMENT ON FUNCTION public.is_branch_admin(TEXT) IS
  'AUTHORIZATION: Checks if authenticated user has admin access to a branch.';

-- 2. branches: add branch_staff_manage (read already in m081)
DROP POLICY IF EXISTS branches_branch_staff_manage ON public.branches;
CREATE POLICY branches_branch_staff_manage ON public.branches
  FOR ALL TO authenticated USING (public.is_branch_admin(id)) WITH CHECK (public.is_branch_admin(id));

-- 3. delivery_rounds RLS: branch-level
DROP POLICY IF EXISTS delivery_rounds_tenant_admin_manage ON public.delivery_rounds;
CREATE POLICY delivery_rounds_branch_admin_manage ON public.delivery_rounds
  FOR ALL TO authenticated USING (public.is_branch_admin(branch_id)) WITH CHECK (public.is_branch_admin(branch_id));
DROP POLICY IF EXISTS delivery_rounds_public_read ON public.delivery_rounds;
CREATE POLICY delivery_rounds_public_read ON public.delivery_rounds
  FOR SELECT TO anon, authenticated USING (status = 'active');

-- 4. delivery_zones RLS: branch-level
DROP POLICY IF EXISTS delivery_zones_tenant_admin_manage ON public.delivery_zones;
CREATE POLICY delivery_zones_branch_admin_manage ON public.delivery_zones
  FOR ALL TO authenticated USING (public.is_branch_admin(branch_id)) WITH CHECK (public.is_branch_admin(branch_id));
DROP POLICY IF EXISTS delivery_zones_public_read ON public.delivery_zones;
CREATE POLICY delivery_zones_public_read ON public.delivery_zones
  FOR SELECT TO anon, authenticated USING (is_active = true);


-- 5. drivers RLS: branch-level
DROP POLICY IF EXISTS drivers_tenant_admin_manage ON public.drivers;
CREATE POLICY drivers_branch_admin_manage ON public.drivers
  FOR ALL TO authenticated USING (public.is_branch_admin(home_branch_id)) WITH CHECK (public.is_branch_admin(home_branch_id));
DROP POLICY IF EXISTS drivers_self_read ON public.drivers;
CREATE POLICY drivers_self_read ON public.drivers
  FOR SELECT TO authenticated USING (
    id = (SELECT driver_id FROM public.driver_profiles WHERE user_id = auth.uid() LIMIT 1)
    OR public.is_branch_admin(home_branch_id)
  );

-- 6. delivery_assignments RLS: branch-level
DROP POLICY IF EXISTS assignments_tenant_admin_manage ON public.delivery_assignments;
CREATE POLICY assignments_branch_admin_manage ON public.delivery_assignments
  FOR ALL TO authenticated USING (public.is_branch_admin(branch_id)) WITH CHECK (public.is_branch_admin(branch_id));
DROP POLICY IF EXISTS assignments_driver_read ON public.delivery_assignments;
CREATE POLICY assignments_driver_read ON public.delivery_assignments
  FOR SELECT TO authenticated USING (
    public.is_branch_admin(branch_id)
    OR driver_id = (SELECT driver_id FROM public.driver_profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- 7. business_settings RLS: branch override + tenant default
DROP POLICY IF EXISTS business_settings_tenant_admin_manage ON public.business_settings;
CREATE POLICY business_settings_branch_admin_manage ON public.business_settings
  FOR ALL TO authenticated
  USING ((branch_id IS NOT NULL AND public.is_branch_admin(branch_id)) OR (branch_id IS NULL AND public.is_tenant_admin(tenant_id)))
  WITH CHECK ((branch_id IS NOT NULL AND public.is_branch_admin(branch_id)) OR (branch_id IS NULL AND public.is_tenant_admin(tenant_id)));

DROP POLICY IF EXISTS business_settings_public_read ON public.business_settings;
CREATE POLICY business_settings_public_read ON public.business_settings
  FOR SELECT TO anon, authenticated
  USING (key IN ('delivery_policy', 'hours', 'kitchen_location', 'operating_hours', 'order_policy')
    AND (branch_id IS NULL OR (branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.branches WHERE id = business_settings.branch_id AND status = 'active'))));

COMMIT;

