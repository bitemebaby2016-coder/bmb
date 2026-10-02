-- ============================================
-- 108: POST-G2 SECURITY REMEDIATION — legacy tenant authority parameter-overwrite fix
-- Owner-approved: POST-G2 SECURITY REMEDIATION GATE (2026-10-02)
--
-- DEFECT (production-audited, Phase 1):
--   public.is_tenant_admin(p_tenant_id text) overwrote its parameter:
--     SELECT role, COALESCE(tenant_id,'tenant-bmb-001') INTO v_role, p_tenant_id ...
--   => target tenant argument was DISCARDED; final compare compared caller
--   tenant to itself => returned TRUE for ANY admin against ANY tenant
--   (verified live: is_tenant_admin('tenant-b')=true as tenant-A admin).
--
-- AUDIT RESULT (Phase 1):
--   Callers of legacy function = exactly 10 RLS policies (USING + WITH CHECK),
--   each passing the row's own tenant_id:
--     addon_groups, addons, brands, business_settings (branch_id IS NULL branch),
--     mascot_overrides (tenant branch; NULL-scope rows allowed by the policy's
--     own "tenant_id IS NULL OR" branch, not by the function), menu_schedule,
--     menu_sections, product_addon_groups, product_categories, products
--   ZERO callers elsewhere: 0 views, 0 function bodies, 0 triggers, 0 RPCs,
--   0 frontend/script/test code references.
--   => safe to REPLACE body in place (signature preserved for policies).
--
-- CANONICAL CONTRACT (Phase 2, mirrors is_tenant_admin_of semantics):
--   1. caller tenant must equal target tenant
--   2. platform admin explicit via profiles.is_platform (checked before tenant match)
--   3. tenant admin cannot act cross tenant
--   4. NULL/empty target must NOT bypass (explicit deny)
--   5. SECURITY DEFINER with SET search_path = 'public'
--   6. authority derives from auth.uid() (authenticated identity) only
--   7. caller-supplied tenant_id must never be overwritten (local v_target)
--
-- COMPATIBILITY (Phase 3 preconditions verified on production):
--   - 0 NULL-tenant rows in all 10 caller tables => strict deny on NULL target
--     cannot lock out any existing row management
--   - all 71 production profiles have tenant_id set ('tenant-bmb-001') and
--     role IN (admin, customer); 1 platform admin
--   - no privilege broadening; grants unchanged (GRANT authenticated/service_role)
--   - media_assets already uses is_tenant_admin_of (migration 106) and its
--     policy requires tenant_id IS NOT NULL, so tightening is_tenant_admin_of
--     against NULL/empty target causes no behavior change there
--
-- Replaces BOTH functions (same signatures). Additive replay-safe.
-- ============================================

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin_of(p_tenant_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
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

  v_target := p_tenant_id;

  -- 4. tighten: NULL/empty target must NOT bypass (previous body allowed
  --    v_caller_tenant='' = COALESCE(p_tenant_id,'') => ''=''=TRUE)
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

  IF v_is_platform THEN
    RETURN true;
  END IF;

  IF v_role IN ('admin', 'tenant_admin') AND v_caller_tenant <> '' AND v_caller_tenant = v_target THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Grants preserved (OR REPLACE keeps ACLs, but re-assert for replay determinism)
REVOKE ALL ON FUNCTION public.is_tenant_admin(text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_tenant_admin(text) TO authenticated;
GRANT ALL ON FUNCTION public.is_tenant_admin(text) TO service_role;
REVOKE ALL ON FUNCTION public.is_tenant_admin_of(text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_tenant_admin_of(text) TO authenticated;
GRANT ALL ON FUNCTION public.is_tenant_admin_of(text) TO service_role;
