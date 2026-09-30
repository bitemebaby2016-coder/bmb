-- ============================================
-- Bite Me Baby Migration 090: TEN-07 profiles branch_id
-- Date: 2026-09-30 · Baseline: m087 deployed
-- Scope: Add branch_id to profiles for branch staff RLS isolation
-- Impact: Additive only — nullable column, no backfill required (optional for branch staff)
-- DEPENDENCY: Must be executed BEFORE m088 (is_branch_admin references profiles.branch_id)
-- ============================================

BEGIN;

-- 1. Add branch_id column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id TEXT;

COMMENT ON COLUMN public.profiles.branch_id IS
  'BRANCH_STAFF: FK to branches(id). Set for branch_staff role to enable branch-level RLS. NULL for tenant/platform admins.';

-- 2. Add FK constraint (nullable)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id);

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON public.profiles (branch_id);

-- 4. Update is_branch_admin function to use profiles.branch_id
-- (Already uses it - no change needed)

COMMIT;