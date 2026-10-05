CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_role text;
  v_caller_tenant text;
  v_is_platform boolean;
  v_target text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- 7. parameter integrity: copy caller argument; never overwrite p_tenant_id
  v_target := p_tenant_id;

  -- 4. NULL/empty target = explicit DENY (no fallback, no bypass)
  IF v_target IS NULL OR v_target = '' THEN
    RETURN false;
  END IF;

  SELECT role, COALESCE(tenant_id, ''), COALESCE(is_platform, false)
    INTO v_role, v_caller_tenant, v_is_platform
    FROM public.profiles
    WHERE id = v_uid;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- 2. explicit platform authority
  IF v_is_platform THEN
    RETURN true;
  END IF;

  -- 1 + 3. tenant admin strictly of own tenant; no NULL fallback mapping
  IF v_role IN ('admin', 'tenant_admin') AND v_caller_tenant <> '' AND v_caller_tenant = v_target THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$
