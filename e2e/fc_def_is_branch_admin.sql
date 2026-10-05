CREATE OR REPLACE FUNCTION public.is_branch_admin(p_branch_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$
