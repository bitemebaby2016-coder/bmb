-- ============================================
-- Bite Me Baby Migration 077: TEN-04 Brand/Mascot/Settings RLS Rewrite
-- Scope: Tenant-aware RLS for brands/mascots/business_settings
====================================================BEGIN;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ DECLARE v_uid uuid; v_role text; v_is_platform boolean; BEGIN
  v_uid := auth.uid(); IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT role, COALESCE(tenant_id, 'tenant-bmb-001') INTO v_role, p_tenant_id FROM public.profiles WHERE id = v_uid;
  IF v_role IS NULL THEN RETURN false; END IF;
  SELECT COALESCE(is_platform, false) INTO v_is_platform FROM public.profiles WHERE id = v_uid;
  IF v_is_platform THEN RETURN true; END IF;
  IF v_role IN ('admin', 'tenant_admin') AND COALESCE((SELECT tenant_id FROM public.profiles WHERE id = v_uid), 'tenant-bmb-001') = COALESCE(p_tenant_id, 'tenant-bmb-001') THEN RETURN true; END IF;
  RETURN false; END $$;

REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(text) TO authenticated;

DROP POLICY IF EXISTS brands_admin_manage ON public.brands;
DROP POLICY IF EXISTS brands_public_read ON public.brands;
CREATE POLICY brands_tenant_admin_manage ON public.brands FOR ALL TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE POLICY brands_public_read ON public.brands FOR SELECT TO anon, authenticated USING (status = 'active' AND is_published = true);
CREATE POLICY brands_deny_anon ON public.brands FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS mascot_overrides_anon_read ON public.mascot_overrides;
DROP POLICY IF EXISTS mascot_overrides_admin_manage ON public.mascot_overrides;
CREATE POLICY mascots_tenant_admin_manage ON public.mascot_overrides FOR ALL TO authenticated USING (tenant_id IS NULL OR public.is_tenant_admin(tenant_id)) WITH CHECK (tenant_id IS NULL OR public.is_tenant_admin(tenant_id));
CREATE POLICY mascots_public_read ON public.mascot_overrides FOR SELECT TO anon, authenticated USING (brand_id IS NULL);
CREATE POLICY mascots_deny_anon_write ON public.mascot_overrides FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS business_settings_admin ON public.business_settings;
DROP POLICY IF EXISTS business_settings_auth_read ON public.business_settings;
CREATE POLICY business_settings_tenant_admin_manage ON public.business_settings FOR ALL TO authenticated USING (public.is_tenant_admin(tenant_id)) WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE POLICY business_settings_public_read ON public.business_settings FOR SELECT TO anon, authenticated USING (key IN ('delivery_policy', 'hours', 'kitchen_location', 'operating_hours'));
CREATE POLICY business_settings_deny_anon_write ON public.business_settings FOR ALL TO anon USING (false) WITH CHECK (false);

COMMIT;
