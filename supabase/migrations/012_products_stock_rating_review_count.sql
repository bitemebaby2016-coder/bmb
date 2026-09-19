-- ============================================
-- Bite Me Baby — Migration 012: products display stock/rating/review_count
-- Date: 2026-09-19 (Home UI v5 — real data for product cards)
--
-- Context:
--   - Home cards show low-stock badge / star rating / review count.
--   - These are DISPLAY values only (stock is not authoritative capacity —
--     real capacity enforcement remains delivery_rounds + inventory via the 007 RPC).
--   - delivery_rounds ALREADY has a public-read policy (migration 006) so the Home
--     store-status provider reads them live; no new policy needed.
--
-- ROLE: OWNER applies this in the Supabase SQL Editor (dev has no DB password).
-- IDEMPOTENT: safe to re-run.
-- ============================================

BEGIN;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rating NUMERIC(2, 1);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;

-- Seed display values for the seeded product ids (prod-1..prod-6 from migration 001/004)
-- so Home cards render real values right after apply. Guard: only fill NULLs.
UPDATE public.products SET stock = 8,  rating = 5.0, review_count = 42 WHERE id = 'prod-1' AND stock IS NULL;
UPDATE public.products SET stock = 12, rating = 4.8, review_count = 31 WHERE id = 'prod-2' AND stock IS NULL;
UPDATE public.products SET stock = 3,  rating = 4.6, review_count = 18 WHERE id = 'prod-3' AND stock IS NULL;
UPDATE public.products SET stock = 20, rating = 4.9, review_count = 57 WHERE id = 'prod-4' AND stock IS NULL;
UPDATE public.products SET stock = NULL, rating = 5.0, review_count = 12 WHERE id = 'prod-5' AND stock IS NULL;
UPDATE public.products SET stock = NULL, rating = 5.0, review_count = 9  WHERE id = 'prod-6' AND stock IS NULL;

COMMIT;

-- ============================================
-- END OF MIGRATION 012
-- ============================================