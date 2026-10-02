-- ============================================
-- S1-prime-A REPLAY SEED (ISOLATED LOCAL ONLY - NEVER DEPLOYED TO PRODUCTION)
-- Minimal deterministic auth seed required by migration 066 assertion
-- (ERR_PLATFORM_ADMIN expects exactly 1 profile with is_platform=true,
--  hard-coded UUID from production identity evidence in 066 L37).
-- Case A per Owner Phase 1: production UUID used in isolated replay DB only.
-- Normally the profiles row is created by trigger on_auth_user_created (006);
-- the explicit profile insert below is a deterministic fallback (same UUID).
-- ============================================
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  NULL,
  'dddf4b57-405f-4852-a985-76d8d52b1b72',
  'authenticated',
  'authenticated',
  'replay-platform-admin@bmb.local',
  crypt('replay-only-no-production-use', gen_random_uuid()::text),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, name, role, is_active)
VALUES (
  'dddf4b57-405f-4852-a985-76d8d52b1b72',
  'replay-platform-admin@bmb.local',
  'Replay Platform Admin',
  'admin',
  true
) ON CONFLICT (id) DO NOTHING;
