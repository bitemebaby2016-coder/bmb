
-- tenant_update_admin(p_tenant_id, p_name, p_slug, p_status): Update tenant metadata
-- Platform admin: any tenant | Tenant admin: own tenant only
CREATE OR REPLACE FUNCTION public.tenant_update_admin(p_tenant_id TEXT, p_name TEXT, p_slug TEXT, p_status TEXT)
RETURNS TABLE (id TEXT, name TEXT, slug TEXT, status TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT; v_is_platform BOOLEAN; v_user_tenant TEXT; v_norm_slug TEXT; v_exists INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT p.role, COALESCE(p.tenant_id, 'tenant-bmb-001') INTO v_role, v_user_tenant FROM public.profiles p WHERE p.id = auth.uid();
  IF v_role IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT COALESCE(is_platform, false) INTO v_is_platform FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_platform AND v_user_tenant != p_tenant_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_slug IS NOT NULL AND TRIM(p_slug) != '' THEN
    v_norm_slug := LOWER(TRIM(p_slug));
    v_norm_slug := REGEXP_REPLACE(v_norm_slug, '[^a-z0-9]+', '-', 'g');
    v_norm_slug := REGEXP_REPLACE(v_norm_slug, '^-*|-*$', '');
    IF v_norm_slug = '' THEN RAISE EXCEPTION 'BAD_REQUEST: slug must contain alphanumeric characters.'; END IF;
    SELECT count(*) INTO v_exists FROM public.tenants WHERE slug = v_norm_slug AND id != p_tenant_id;
    IF v_exists > 0 THEN RAISE EXCEPTION 'CONFLICT: Slug already in use.'; END IF;
  END IF;
  UPDATE public.tenants SET
    name = COALESCE(NULLIF(p_name, ''), name),
    slug = COALESCE(v_norm_slug, slug),
    status = COALESCE(NULLIF(p_status, ''), status),
    updated_at = NOW()
  WHERE id = p_tenant_id;
  RETURN QUERY SELECT id, name, slug, status, updated_at FROM public.tenants WHERE id = p_tenant_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tenant_update_admin(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_update_admin(text,text,text,text) TO authenticated;

-- tenant_set_status(p_tenant_id, p_status): Quick status toggle
CREATE OR REPLACE FUNCTION public.tenant_set_status(p_tenant_id TEXT, p_status TEXT)
RETURNS TABLE (id TEXT, status TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_platform BOOLEAN; v_user_tenant TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT p.role, COALESCE(p.tenant_id, 'tenant-bmb-001') INTO v_role, v_user_tenant FROM public.profiles p WHERE p.id = auth.uid();
  SELECT COALESCE(is_platform, false) INTO v_is_platform FROM public.profiles WHERE id = auth.uid();
  IF p_status NOT IN ('active','inactive','suspended') THEN RAISE EXCEPTION 'BAD_REQUEST: Invalid status.'; END IF;
  IF NOT v_is_platform AND v_user_tenant != p_tenant_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.tenants SET status = p_status, updated_at = NOW() WHERE id = p_tenant_id;
  RETURN QUERY SELECT id, status, updated_at FROM public.tenants WHERE id = p_tenant_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tenant_set_status(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_set_status(text,text) TO authenticated;


-- ============================================
-- Bite Me Baby Migration 079: TEN-06 Admin Tenant CRUD + Tenant-Aware RLS
-- Date: 2026-09-29 · Baseline: m078 deployed
-- Scope: Rewrite tenants RLS (is_tenant_admin) + Create canonical PostgreSQL RPCs for tenant CRUD
-- Impact: Non-destructive — only adds policies and functions
-- OWNER DECISION: Option C (PostgreSQL Canonical RPC)
-- ============================================

BEGIN;

-- -------------------------------------------------------
-- 1. REWRITE TENANTS RLS POLICIES
-- -------------------------------------------------------
DROP POLICY IF EXISTS tenants_admin_manage ON public.tenants;
CREATE POLICY tenants_platform_admin_manage ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS tenants_public_read ON public.tenants;
CREATE POLICY tenants_public_read ON public.tenants
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS tenants_deny_anon_write ON public.tenants;
CREATE POLICY tenants_deny_anon_write ON public.tenants
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- -------------------------------------------------------
-- 2. CANONICAL RPC FUNCTIONS — tenant CRUD
-- -------------------------------------------------------

-- tenant_list_admin(): List all tenants for platform/admin users
CREATE OR REPLACE FUNCTION public.tenant_list_admin()
RETURNS TABLE (
  id TEXT, name TEXT, slug TEXT, status TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'tenant_admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY SELECT t.id, t.name, t.slug, t.status, t.created_at, t.updated_at
    FROM public.tenants t ORDER BY t.name;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tenant_list_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_list_admin() TO authenticated;

-- tenant_get_admin(p_tenant_id): Get single tenant detail
-- Platform admin: any tenant | Tenant admin: own tenant only
CREATE OR REPLACE FUNCTION public.tenant_get_admin(p_tenant_id TEXT)
RETURNS TABLE (
  id TEXT, name TEXT, slug TEXT, status TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT; v_is_platform BOOLEAN; v_user_tenant TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT p.role, COALESCE(p.tenant_id, 'tenant-bmb-001') INTO v_role, v_user_tenant
    FROM public.profiles p WHERE p.id = auth.uid();
  IF v_role IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT COALESCE(is_platform, false) INTO v_is_platform FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_platform AND v_user_tenant != p_tenant_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY SELECT t.id, t.name, t.slug, t.status, t.created_at, t.updated_at
    FROM public.tenants t WHERE t.id = p_tenant_id ORDER BY t.name;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tenant_get_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_get_admin(text) TO authenticated;

-- tenant_create_admin(p_name, p_slug): Create new tenant (platform admin ONLY)
CREATE OR REPLACE FUNCTION public.tenant_create_admin(p_name TEXT, p_slug TEXT)
RETURNS TABLE (id TEXT, name TEXT, slug TEXT, status TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_platform BOOLEAN; v_norm_slug TEXT; v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT COALESCE(is_platform, false) INTO v_is_platform FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_platform THEN RAISE EXCEPTION 'FORBIDDEN: Only platform admins can create tenants.'; END IF;
  IF TRIM(p_name) = '' OR TRIM(p_slug) = '' THEN RAISE EXCEPTION 'BAD_REQUEST: name and slug required.'; END IF;
  v_norm_slug := LOWER(TRIM(p_slug));
  v_norm_slug := REGEXP_REPLACE(v_norm_slug, '[^a-z0-9]+', '-', 'g');
  v_norm_slug := REGEXP_REPLACE(v_norm_slug, '^-*|-*$', '');
  IF v_norm_slug = '' THEN RAISE EXCEPTION 'BAD_REQUEST: slug must contain alphanumeric characters.'; END IF;
  SELECT count(*) INTO v_count FROM public.tenants WHERE slug = v_norm_slug;
  IF v_count > 0 THEN RAISE EXCEPTION 'CONFLICT: Slug already exists.'; END IF;
  INSERT INTO public.tenants (id, name, slug, status)
    VALUES ('tenant-' || v_norm_slug, p_name, v_norm_slug, 'active')
    RETURNING id, name, slug, status, created_at;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tenant_create_admin(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_create_admin(text,text) TO authenticated;

COMMIT;
