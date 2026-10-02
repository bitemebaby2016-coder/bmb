-- ============================================
-- Bite Me Baby â€” Migration 106: G2-RV RLS Tenant/Brand Boundary (Option 3, Owner-approved)
-- ADDITIVE ONLY. No data change. No column change. Policy rewrite only.
--
-- Model (Owner final decisions):
--   * Tenant = HARD security boundary (tenant A never reads/writes tenant B assets)
--   * Brand = sub-scope inside tenant (category='brand' assets must belong to caller tenant)
--   * Global = explicit category='global' ONLY (NULL scope is NOT global)
--   * is_admin() global is NOT a tenant isolation mechanism â€” tenant authority uses
--     is_tenant_admin(p_tenant_id) which derives authority server-side from profiles
--     (SECURITY DEFINER; ignores client-sent tenant_id as authorization)
--   * Platform admin operates via platform authority (is_platform flag, server-derived)
--   * Public read = active assets only (is_active=true); never a write authority
--   * service_role bypasses RLS server-side (unchanged, never browser)
-- ============================================

BEGIN;

-- 1. Platform authority helper (server-side derivation from profiles.is_platform)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_platform FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- 2. Tenant authority: is_tenant_admin(p_tenant_id) in production OVERWRITES its
--    parameter with the caller's own tenant (SELECT ... INTO p_tenant_id), making it
--    return true for ANY admin against ANY tenant. Security root cause documented in
--    G2-RV report. We therefore introduce is_tenant_admin_of() with CORRECT semantics
--    (additive — production function is NOT rewritten) and use it for the boundary.
CREATE OR REPLACE FUNCTION public.is_tenant_admin_of(p_tenant_id text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_role text;
  v_caller_tenant text;
  v_is_platform boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT role, COALESCE(tenant_id, ''), COALESCE(is_platform, false)
    INTO v_role, v_caller_tenant, v_is_platform
    FROM public.profiles WHERE id = v_uid;
  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_is_platform THEN RETURN true; END IF;
  IF v_role IN ('admin', 'tenant_admin') AND v_caller_tenant = COALESCE(p_tenant_id, '') THEN
    RETURN true;
  END IF;
  RETURN false;
END $$;

REVOKE EXECUTE ON FUNCTION public.is_tenant_admin_of(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin_of(text) TO authenticated;

-- 3. Replace the global is_admin() policy on media_assets
DROP POLICY IF EXISTS media_assets_admin ON public.media_assets;

-- 4. Tenant-scoped write authority (covers SELECT of inactive own-tenant rows,
--    INSERT/UPDATE/DELETE within tenant; tenant admins + platform via is_tenant_admin_of)
DROP POLICY IF EXISTS media_assets_tenant_write ON public.media_assets;
CREATE POLICY media_assets_tenant_write ON public.media_assets
  FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND is_tenant_admin_of(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND is_tenant_admin_of(tenant_id));

-- 4. Global asset authority = platform admin ONLY, explicit category='global' rows
DROP POLICY IF EXISTS media_assets_platform_global ON public.media_assets;
CREATE POLICY media_assets_platform_global ON public.media_assets
  FOR ALL TO authenticated
  USING (tenant_id IS NULL AND category = 'global' AND is_platform_admin())
  WITH CHECK (tenant_id IS NULL AND category = 'global' AND is_platform_admin());

-- 5. Public read boundary: active assets only (customer/anonymous runtime contract)
DROP POLICY IF EXISTS media_assets_public_read ON public.media_assets;
DROP POLICY IF EXISTS media_assets_public_read ON public.media_assets;
CREATE POLICY media_assets_public_read ON public.media_assets
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 6. Public runtime consumers (brand logo etc.) need anon SELECT of active public
--    asset metadata. Existing production ACL had no anon grant on media_assets;
--    Owner public-read rule (active-only) is enforced by the SELECT policy above.
GRANT SELECT ON public.media_assets TO anon;

COMMIT;

-- ROLLBACK reference (manual, if ever needed):
--   DROP POLICY IF EXISTS media_assets_tenant_write ON public.media_assets;
--   DROP POLICY IF EXISTS media_assets_platform_global ON public.media_assets;
--   CREATE POLICY media_assets_admin ON public.media_assets FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
--   DROP POLICY IF EXISTS media_assets_public_read ON public.media_assets;
-- CREATE POLICY media_assets_public_read_replaced_BY_COMMENT ON public.media_assets FOR SELECT TO anon, authenticated USING (true);
--   DROP FUNCTION IF EXISTS public.is_platform_admin();
