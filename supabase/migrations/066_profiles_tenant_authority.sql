-- ============================================
-- Bite Me Baby — Migration 066: TEN-02 Profile Tenant ID + Platform Authority
-- Date: 2026-09-29 · Baseline: 8169853b
-- Scope: 
--   - Add tenant_id TEXT NULL to profiles
--   - Add is_platform BOOLEAN to profiles  
-- Backfill: Deterministic from production identity evidence
--   - is_platform = true ONLY for profile id=dddf4b57-405f-4852-a985-76d8d52b1b72 (is_owner=true, earliest admin)
--   - All profiles tenant_id = 'tenant-bmb-001'
-- Evidence source: ten02-identity-probe.cjs ran against prod
-- ============================================

BEGIN;

-- 1. Add columns (nullable first for safe migration)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_platform BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.tenant_id IS
  'TENANT_IDENTITY: FK-like reference to tenants(id). nullable until enforcement.';

COMMENT ON COLUMN public.profiles.is_platform IS
  'AUTHORIZATION: Explicit platform-admin authority flag. Only ONE row has true (profile id=dddf4b57, verified by is_owner=true).';

-- 2. Verification before backfill
DO $$
DECLARE v_profiles_total int; v_admin_total int; v_customer_total int;
BEGIN
  SELECT count(*) INTO v_profiles_total FROM public.profiles;
  SELECT count(*) INTO v_admin_total FROM public.profiles WHERE role = 'admin';
  SELECT count(*) INTO v_customer_total FROM public.profiles WHERE role = 'customer';
  RAISE NOTICE 'TEN-02 PROFILE BACKFILL: total=% admin=% customer=%', v_profiles_total, v_admin_total, v_customer_total;
END $$;

-- 3. Backfill is_platform deterministically (only the single platform owner)
UPDATE public.profiles SET is_platform = true
WHERE id = 'dddf4b57-405f-4852-a985-76d8d52b1b72'
  AND (is_platform IS NULL OR is_platform != true);

-- 4. Backfill all profiles to single tenant
UPDATE public.profiles SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;

-- 5. Verify backfill correctness
DO $$
DECLARE v_null_tenant int; v_platform_count int; BEGIN
  SELECT count(*) INTO v_null_tenant FROM public.profiles WHERE tenant_id IS NULL;
  SELECT count(*) INTO v_platform_count FROM public.profiles WHERE is_platform = true;
  
  IF v_null_tenant > 0 THEN
    RAISE EXCEPTION 'ERR_PROFILE_BACKFILL: % profiles still have null tenant_id', v_null_tenant;
  END IF;
  IF v_platform_count <> 1 THEN
    RAISE EXCEPTION 'ERR_PLATFORM_ADMIN: Expected exactly 1 platform_admin, found %', v_platform_count;
  END IF;
  
  RAISE NOTICE 'TEN-02 VERIFY: profiles.backfill OK — tenant_id=null=%, is_platform=true=%', v_null_tenant, v_platform_count;
END $$;

COMMIT;
