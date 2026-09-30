-- ============================================
-- Bite Me Baby — Migration 098: Reviews public read (verified only)
-- Symptom: console showed `rest/v1/reviews ... 401` (11+ calls) because
-- M093 RLS only allowed owner/admin reads, but the storefront's
-- VerifiedReviewsSection reads reviews per product as guest.
-- Fix: grant SELECT to anon/authenticated + policy that exposes ONLY
-- verified reviews (is_verified = true) — drafts / private reviews stay hidden.
-- Idempotent — safe to re-run.
-- ============================================

BEGIN;

GRANT SELECT ON public.reviews TO anon, authenticated;

-- Public read: only VERIFIED reviews (has order linkage / is_verified flag)
IF NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviews' AND policyname = 'public_read_verified_reviews'
) THEN
  CREATE POLICY "public_read_verified_reviews" ON public.reviews
    FOR SELECT USING (is_verified = true);
END IF;

-- Verification: report missing grant / policy (must be 0)
DO $$ DECLARE v_missing int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM (SELECT
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'reviews'
        AND grantee = 'anon' AND privilege_type = 'SELECT'
    ) THEN 1 ELSE 0 END
    + CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = 'reviews' AND policyname = 'public_read_verified_reviews'
    ) THEN 1 ELSE 0 END) AS missing;
  RAISE NOTICE 'Reviews public-read audit — missing: %', v_missing;
  IF v_missing > 0 THEN RAISE EXCEPTION 'ERR_REVIEWS_PUBLIC_READ_MISSING'; END IF;
END $$;

COMMIT;