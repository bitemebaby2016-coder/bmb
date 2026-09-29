-- Bite Me Baby Migration 071: TEN-03 Catalog RLS Isolation Rewrite
-- Tenant-aware RLS policies for catalog tables + preserve public-read behavior
-- NOTE: uses is_tenant_admin(text) from TEN-02 (migration-065/071 in same tx)
BEGIN;

-- Recreate is_tenant_admin helper function (same as TEN-02, idempotent)
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ DECLARE v_uid uuid; v_role text; v_is_platform boolean; BEGIN v_uid := auth.uid(); IF v_uid IS NULL THEN RETURN false; END IF; SELECT role, COALESCE(tenant_id, 'tenant-bmb-001') INTO v_role, p_tenant_id FROM public.profiles WHERE id = v_uid; IF v_role IS NULL THEN RETURN false; END IF; SELECT COALESCE(is_platform, false) INTO v_is_platform FROM public.profiles WHERE id = v_uid; IF v_is_platform THEN RETURN true; END IF; IF v_role IN ('admin', 'tenant_admin') AND COALESCE((SELECT tenant_id FROM public.profiles WHERE id = v_uid), 'tenant-bmb-001') = COALESCE(p_tenant_id, 'tenant-bmb-001') THEN RETURN true; END IF; RETURN false; END $$;
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(text) TO authenticated;

-- products: tenant-aware admin manage + preserve public read
DROP POLICY IF EXISTS products_admin_manage ON public.products;
CREATE POLICY products_tenant_admin_manage ON public.products FOR ALL TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));

-- product_categories: tenant-aware admin manage + preserve public read
DROP POLICY IF EXISTS product_categories_admin_manage ON public.product_categories;
CREATE POLICY product_categories_tenant_admin_manage ON public.product_categories FOR ALL TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));

-- menu_sections: tenant-aware admin manage + preserve public read
DROP POLICY IF EXISTS menu_sections_admin_manage ON public.menu_sections;
CREATE POLICY menu_sections_tenant_admin_manage ON public.menu_sections FOR ALL TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));

-- addon_groups: tenant-aware admin manage
DROP POLICY IF EXISTS addon_groups_admin_manage ON public.addon_groups;
CREATE POLICY addon_groups_tenant_admin_manage ON public.addon_groups FOR ALL TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));

-- addons: tenant-aware admin manage
DROP POLICY IF EXISTS addons_admin_manage ON public.addons;
CREATE POLICY addons_tenant_admin_manage ON public.addons FOR ALL TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));

-- product_addon_groups: tenant-aware admin manage
DROP POLICY IF EXISTS product_addon_groups_admin_manage ON public.product_addon_groups;
CREATE POLICY product_addon_groups_tenant_admin_manage ON public.product_addon_groups FOR ALL TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));

-- menu_schedule: tenant-aware admin manage + preserve existing reads
DROP POLICY IF EXISTS menu_schedule_admin ON public.menu_schedule;
CREATE POLICY menu_schedule_tenant_admin_manage ON public.menu_schedule FOR ALL TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));

-- media_assets: KEEP AS IS per TEN-03 contract decision
COMMIT;