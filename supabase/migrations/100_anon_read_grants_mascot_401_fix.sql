-- ============================================
-- Bite Me Baby Migration 100: anon read grants for brands (mascot_overrides 401 fix)
-- Root cause: mascots_public_read_v2 (migration 078) subqueries public.brands,
--   but role anon had no GRANT on brands -> PostgREST 401 "permission denied for table brands"
--   (code 42501) whenever mascot_overrides was queried with the publishable key.
-- Verified on production (ivkdfognyiwjcmrhcnwz): after GRANT, all endpoints return 200.
-- ============================================

BEGIN;

-- Grants (idempotent)
GRANT SELECT ON public.brands TO anon;
GRANT SELECT ON public.mascot_overrides TO anon;
GRANT SELECT ON public.business_settings TO anon;

COMMIT;
