-- ============================================
-- Bite Me Baby — Migration 098: Reviews public read (verified only)
-- Symptom: console showed `rest/v1/reviews ... 401` (11+ calls) because
-- M093 RLS only allowed owner/admin reads, but the storefront's
-- VerifiedReviewsSection reads reviews per product as guest.
-- Fix: grant SELECT to anon/authenticated + policy that exposes ONLY
-- verified reviews (is_verified = true) — drafts / private reviews stay hidden.
-- NOTE (v2): the policy block is wrapped in DO $$ ... END $$ — Postgres does
-- not allow bare IF statements outside PL/pgSQL (that was the 42601 error).
-- Idempotent — safe to re-run.
-- ============================================

BEGIN;

GRANT SELECT ON public.reviews TO anon, authenticated;

DO $$
BEGIN
  -- Public read: only VERIFIED reviews (is_verified flag from migration 001)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reviews'
      AND policyname = 'public_read_verified_reviews'
  ) THEN
    CREATE POLICY "public_read_verified_reviews" ON public.reviews
      FOR SELECT
      USING (is_verified = true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- policy already exists
  WHEN undefined_column THEN
    RAISE EXCEPTION 'ERR_REVIEWS_NO_IS_VERIFIED_COLUMN: run migration 001 first';
END $$;

-- Verification: report missing grant / policy (must be 0)
DO $$
DECLARE
  v_missing int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'reviews'
      AND grantee = 'anon' AND privilege_type = 'SELECT'
  ) THEN
    v_missing := v_missing + 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviews'
      AND policyname = 'public_read_verified_reviews'
  ) THEN
    v_missing := v_missing + 1;
  END IF;

  RAISE NOTICE 'Reviews public-read audit — missing: %', v_missing;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'ERR_REVIEWS_PUBLIC_READ_MISSING';
  END IF;
END $$;

COMMIT;