-- ============================================
-- Bite Me Baby — Migration 014: Owner Full-Access Admin bootstrap
-- Date: 2026-09-19
--
-- Purpose:
--   Bootstraps the OWNER as a full-access admin WITHOUT storing any owner
--   identity/email/password in git (owner runs the promotion call themselves
--   in the Supabase SQL Editor).
--
-- What this migration does (idempotent, safe to re-run):
--   1. Adds profiles.is_owner flag. role='admin' already grants full access
--      to every admin-managed RLS policy — is_owner is the owner marker.
--   2. Softens guard_profile_mutation() ONLY for server-side contexts
--      (auth.uid() IS NULL, e.g. Supabase SQL Editor running as postgres).
--      Authenticated users still cannot change their own role/is_active/id;
--      anonymous writes are still fully blocked by RLS. This is required
--      because the old guard made role promotion impossible even for the
--      owner from the SQL Editor (no JWT → is_admin() false → FORBIDDEN).
--   3. Adds public.promote_to_full_admin(p_email text) — a SECURITY DEFINER
--      helper (postgres-only; NOT exposed to anon/authenticated) that turns
--      an existing account into the owner full-access admin.
--
-- ROLE: OWNER applies this in the Supabase SQL Editor (dev has no DB password).
-- THEN run once per owner account (replace the email here — it is NOT committed):
--   select public.promote_to_full_admin('owner@example.com');
-- The owner then logs in normally and the AdminRoute opens /admin (role='admin').
-- Idempotent: safe to re-run.
-- ============================================

BEGIN;

-- 1) Owner marker on profiles (role='admin' is still what grants full RLS access)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- 2) Guard softener: allow role changes ONLY for server-side bootstrap contexts.
CREATE OR REPLACE FUNCTION public.guard_profile_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Server-side bootstrap (SQL Editor / migrations): no JWT → auth.uid() IS NULL.
  -- RLS already denies every anonymous write; postgres/service_role bypass RLS anyway.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Authenticated path keeps the original escalation guard.
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'FORBIDDEN: changing role requires admin';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'FORBIDDEN: changing is_active requires admin';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'FORBIDDEN: changing id requires admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_mutation ON profiles;
CREATE TRIGGER profiles_guard_mutation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_mutation();

-- 3) Owner full-access promotion helper (postgres-only via SQL Editor).
CREATE OR REPLACE FUNCTION public.promote_to_full_admin(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_uid   uuid;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_EMAIL';
  END IF;
  v_email := lower(trim(p_email));

  SELECT id INTO v_uid FROM public.profiles WHERE email = v_email LIMIT 1;
  IF v_uid IS NULL THEN
    SELECT id INTO v_uid FROM auth.users WHERE email = v_email LIMIT 1;
  END IF;
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_ACCOUNT_FOUND', 'email', v_email);
  END IF;

  -- Ensure a profile row exists (in case the signup trigger was absent at signup time).
  INSERT INTO public.profiles (id, email, role, is_owner, is_active, updated_at)
  VALUES (v_uid, v_email, 'admin', true, true, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Full access: role='admin' (+ owner marker). Enforced server-side only, so the
  -- guard's server-side branch lets this pass; authenticated users cannot run it.
  UPDATE public.profiles
     SET role = 'admin', is_owner = true, is_active = true, updated_at = NOW()
   WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'email', v_email, 'role', 'admin', 'is_owner', true);
END;
$$;

-- NOT exposed over PostgREST: runnable only by postgres / service_role (SQL Editor).
REVOKE EXECUTE ON FUNCTION public.promote_to_full_admin(text) FROM PUBLIC, anon, authenticated;

COMMIT;

-- ============================================
-- END OF MIGRATION 014
-- ============================================