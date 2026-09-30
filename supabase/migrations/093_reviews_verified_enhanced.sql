-- ============================================
-- Bite Me Baby Migration 093: CAT-04 Verified Reviews Enhancement
-- Date: 2026-09-30 · Baseline: `reviews` table exists (migration 012+)
-- Scope: Add order linkage, branch_id, and internal linking support
--        to the existing `reviews` canonical table. Also enhance review API.
-- ============================================

BEGIN;

-- 1. Add link_to_order column (so verified reviews can be linked to actual orders)
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS branch_id TEXT; -- which branch was reviewed at
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS product_name_display TEXT; -- display name of product at time of review

COMMENT ON COLUMN public.reviews.order_number IS 'CAT-04 VERIFIED REVIEWS: FK reference to orders.order_number for internal linking';
COMMENT ON COLUMN public.reviews.branch_id IS 'CAT-04: Which branch this review is associated with';

-- 2. Add RLS policies for verified review reading/writing
DO $$ BEGIN
  -- Allow authenticated users to read their own reviews + admin all reviews
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'users_read_own_reviews'
  ) THEN
    CREATE POLICY "users_read_own_reviews" ON public.reviews
      FOR SELECT USING (customer_id = auth.uid()::text OR is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'admins_all_reviews'
  ) THEN
    CREATE POLICY "admins_all_reviews" ON public.reviews
      FOR ALL USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'customers_insert_own_review'
  ) THEN
    CREATE POLICY "customers_insert_own_review" ON public.reviews
      FOR INSERT WITH CHECK (customer_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'customers_update_own_review'
  ) THEN
    CREATE POLICY "customers_update_own_review" ON public.reviews
      FOR UPDATE USING (customer_id = auth.uid()::text);
  END IF;
EXCEPTION WHEN undefined_object THEN null; END $$;

COMMIT;
