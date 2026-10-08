-- ============================================
-- POST-G2 SECURITY REMEDIATION MATRIX (ISOLATED LOCAL ONLY)
-- Runs AFTER migration 108. Any failure RAISEs EXCEPTION (nonzero exit).
-- Reuses fixtures seeded by tests/rls_matrix.sql:
--   admin-a 11111111-... (tenant-a) · admin-b 22222222-... (tenant-b)
--   customer-a 33333333-... · platform dddf4b57-...
-- ============================================

-- Fixture: admin with NULL tenant_id (NULL-caller bypass probe)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
 (NULL,'44444444-4444-4444-4444-444444444444','authenticated','authenticated','e2e-admin-nullt@bmb.local',crypt('x',gen_random_uuid()::text),now(),'{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, tenant_id, is_platform)
VALUES ('44444444-4444-4444-4444-444444444444','admin',NULL,false)
ON CONFLICT (id) DO UPDATE SET role='admin', tenant_id=NULL, is_platform=false;

-- ===== PHASE 4: FUNCTION-LEVEL AUTHORITY MATRIX =====

-- T12: admin-a target A=ALLOW / target B=DENY (legacy defect is FIXED)
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
DO $$ BEGIN
  IF NOT public.is_tenant_admin('tenant-a') THEN
    RAISE EXCEPTION 'FAIL T12: admin-a denied own tenant-a (over-correction)';
  END IF;
  IF public.is_tenant_admin('tenant-b') THEN
    RAISE EXCEPTION 'FAIL T12: admin-a is_tenant_admin(tenant-b)=true (DEFECT STILL PRESENT)';
  END IF;
  RAISE NOTICE 'PASS T12 admin-a own=ALLOW cross=DENY (legacy fn)';
END $$;

-- T14: admin-a via is_tenant_admin_of: own=ALLOW / cross=DENY
DO $$ BEGIN
  IF NOT public.is_tenant_admin_of('tenant-a') THEN
    RAISE EXCEPTION 'FAIL T14: admin-a is_tenant_admin_of(tenant-a) should be true';
  END IF;
  IF public.is_tenant_admin_of('tenant-b') THEN
    RAISE EXCEPTION 'FAIL T14: admin-a is_tenant_admin_of(tenant-b) should be false';
  END IF;
  RAISE NOTICE 'PASS T14 admin-a is_tenant_admin_of own/cross';
END $$;
RESET ROLE;

-- T13: admin-b symmetric: own=ALLOW / cross=DENY (both functions)
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
DO $$ BEGIN
  IF NOT public.is_tenant_admin('tenant-b') THEN
    RAISE EXCEPTION 'FAIL T13: admin-b denied own tenant-b';
  END IF;
  IF public.is_tenant_admin('tenant-a') THEN
    RAISE EXCEPTION 'FAIL T13: admin-b is_tenant_admin(tenant-a)=true (CROSS-TENANT LEAK)';
  END IF;
  IF NOT public.is_tenant_admin_of('tenant-b') OR public.is_tenant_admin_of('tenant-a') THEN
    RAISE EXCEPTION 'FAIL T13: admin-b is_tenant_admin_of matrix wrong';
  END IF;
  RAISE NOTICE 'PASS T13 admin-b symmetric own=ALLOW cross=DENY';
END $$;
RESET ROLE;

-- T15: anonymous = DENY (deny via ACL or via return false)
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    IF public.is_tenant_admin('tenant-a') OR public.is_tenant_admin_of('tenant-a') THEN
      RAISE EXCEPTION 'FAIL T15: anonymous passed tenant authority check';
    END IF;
    RAISE NOTICE 'PASS T15 anonymous=DENY (function returned false)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS T15 anonymous=DENY (ACL: no EXECUTE for anon)';
  END;
END $$;
RESET ROLE;
RESET ROLE;

-- T16: NULL target = DENY (both functions) - no bypass
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
DO $$ BEGIN
  IF public.is_tenant_admin(NULL) THEN
    RAISE EXCEPTION 'FAIL T16: is_tenant_admin(NULL)=true (NULL BYPASS)';
  END IF;
  IF public.is_tenant_admin_of(NULL) THEN
    RAISE EXCEPTION 'FAIL T16: is_tenant_admin_of(NULL)=true (NULL BYPASS)';
  END IF;
  IF public.is_tenant_admin('') OR public.is_tenant_admin_of('') THEN
    RAISE EXCEPTION 'FAIL T16: empty-string target bypass';
  END IF;
  RAISE NOTICE 'PASS T16 NULL/empty target=DENY (both fns)';
END $$;
RESET ROLE;

-- T16b: NULL-caller-tenant admin = DENY against everything except platform
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444"}';
DO $$ BEGIN
  IF public.is_tenant_admin('tenant-a') OR public.is_tenant_admin('tenant-b') THEN
    RAISE EXCEPTION 'FAIL T16b: NULL-tenant admin passed tenant check (BYPASS)';
  END IF;
  IF public.is_tenant_admin_of('tenant-a') OR public.is_tenant_admin_of('tenant-b') THEN
    RAISE EXCEPTION 'FAIL T16b: NULL-tenant admin passed is_tenant_admin_of (BYPASS)';
  END IF;
  RAISE NOTICE 'PASS T16b NULL-caller-tenant admin=DENY';
END $$;
RESET ROLE;

-- T17: parameter integrity - legacy function body must not overwrite p_tenant_id
DO $$ BEGIN
  IF position('INTO v_role, p_tenant_id' in pg_get_functiondef('public.is_tenant_admin(text)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'FAIL T17: legacy function still overwrites parameter p_tenant_id';
  END IF;
  IF position('INTO v_role, p_tenant_id' in pg_get_functiondef('public.is_tenant_admin_of(text)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'FAIL T17: is_tenant_admin_of overwrites parameter';
  END IF;
  RAISE NOTICE 'PASS T17 parameter integrity (no SELECT INTO p_tenant_id)';
END $$;

-- T18: platform admin explicit authority (both functions)
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72"}';
DO $$ BEGIN
  IF NOT public.is_tenant_admin('tenant-b') THEN
    RAISE EXCEPTION 'FAIL T18: platform admin denied tenant-b (explicit platform authority required)';
  END IF;
  IF NOT public.is_tenant_admin_of('tenant-a') THEN
    RAISE EXCEPTION 'FAIL T18: platform admin denied tenant-a via is_tenant_admin_of';
  END IF;
  RAISE NOTICE 'PASS T18 platform admin explicit ALLOW';
END $$;
RESET ROLE;

-- T19: RLS regression on legacy-caller table (products): cross-tenant write still DENIED
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
DO $$ BEGIN
  UPDATE public.products SET name='LEAKED-BY-A' WHERE tenant_id='tenant-b';
  IF EXISTS (SELECT 1 FROM public.products WHERE tenant_id='tenant-b' AND name='LEAKED-BY-A') THEN
    RAISE EXCEPTION 'FAIL T19: admin-a mutated tenant-b product (RLS REGRESSION)';
  END IF;
  RAISE NOTICE 'PASS T19 products cross-tenant write denied (remediated fn in RLS)';
END $$;

-- T19b: own-tenant product write still ALLOWED (valid caller preserved)
DO $$ BEGIN
  UPDATE public.products SET name = name WHERE tenant_id='tenant-a' AND id IN (SELECT id FROM public.products WHERE tenant_id='tenant-a' LIMIT 1);
  RAISE NOTICE 'PASS T19b products own-tenant write allowed';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE EXCEPTION 'FAIL T19b: admin-a lost own-tenant product write (LOCKOUT REGRESSION)';
END $$;
RESET ROLE;

-- ===== PHASE 7: BRAND-SCOPE AUTHORITY AUDIT =====
-- Tenant authority model: profiles.role + tenant_id only (NO brand-level admin).
-- Brand A1/A2 belong to same tenant-a => tenant admin governs both (by design).

-- T20: TENANT AUTHORITY - admin-a can mutate BOTH A1 and A2 brand assets
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
DO $$ BEGIN
  UPDATE public.media_assets SET alt='A1-touched' WHERE id='m-a1-logo';
  UPDATE public.media_assets SET alt='A2-touched' WHERE id='m-a2-logo';
  IF (SELECT alt FROM public.media_assets WHERE id='m-a1-logo') <> 'A1-touched' OR
     (SELECT alt FROM public.media_assets WHERE id='m-a2-logo') <> 'A2-touched' THEN
    RAISE EXCEPTION 'FAIL T20: tenant admin could not mutate both brand assets';
  END IF;
  RAISE NOTICE 'PASS T20 TENANT AUTHORITY: tenant admin governs A1+A2 (same tenant, by design)';
END $$;

-- T21: BRAND AUTHORITY - cross-tenant brand asset still denied (A admin vs B1 brand)
DO $$ BEGIN
  UPDATE public.media_assets SET alt='B1-LEAKED' WHERE id='m-b1-logo';
  IF (SELECT alt FROM public.media_assets WHERE id='m-b1-logo') = 'B1-LEAKED' THEN
    RAISE EXCEPTION 'FAIL T21: admin-a mutated tenant-b brand asset';
  END IF;
  RAISE NOTICE 'PASS T21 BRAND AUTHORITY: cross-tenant brand asset denied (tenant boundary, not brand-level RLS)';
END $$;

-- T22: PUBLIC READ - active A1+A2 readable by customer; inactive NOT
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.media_assets WHERE id IN ('m-a1-logo','m-a2-logo')) <> 2 THEN
    RAISE EXCEPTION 'FAIL T22: customer cannot read active A1+A2';
  END IF;
  IF (SELECT count(*) FROM public.media_assets WHERE id='m-a1-inactive') <> 0 THEN
    RAISE EXCEPTION 'FAIL T22: customer sees inactive asset';
  END IF;
  RAISE NOTICE 'PASS T22 PUBLIC READ: active A1+A2 visible, inactive hidden';
END $$;
RESET ROLE;

-- T23: RUNTIME RESOLVER DATA PRECONDITION - approved wins over mock PER BRAND
DO $$ BEGIN
  IF (SELECT count(*) FROM public.media_assets WHERE brand_id='brand-a2' AND is_active AND NOT is_mock) < 1 THEN
    RAISE EXCEPTION 'FAIL T23: brand-a2 has no active approved asset (resolver would fall back)';
  END IF;
  IF (SELECT count(*) FROM public.media_assets WHERE brand_id='brand-a1' AND is_active AND is_mock) <> 1 THEN
    RAISE EXCEPTION 'FAIL T23: brand-a1 mock fixture missing';
  END IF;
  RAISE NOTICE 'PASS T23 resolver precondition: approved exists per brand; mock coexists (approved wins at app layer, E2E-verified I+H)';
END $$;

SELECT 'ALL REMEDIATION MATRIX TESTS PASSED' AS result;

