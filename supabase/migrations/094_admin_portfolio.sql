-- ============================================
-- Bite Me Baby Migration 094: CAT-04 Admin Portfolio / Past Works
-- Date: 2026-09-30 · Baseline: Media assets exist (migration 011)
-- Scope: Dedicated table for admin-managed portfolio/past works albums
--        Separate from verified customer reviews — this is marketing content.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_portfolio_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL, -- stored in bmb-images bucket
  media_asset_id TEXT REFERENCES public.media_assets(id), -- optional link to media_assets
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_portfolio_items IS
  'CAT-04 ADMIN PORTFOLIO: Admin-curated past works / promotional images separate from customer reviews.';

-- RLS: Only admins can manage; public can read active items
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_portfolio_items' AND policyname = 'admins_full_access'
  ) THEN
    CREATE POLICY "admins_full_access" ON public.admin_portfolio_items FOR ALL USING (is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_portfolio_items' AND policyname = 'public_read_active'
  ) THEN
    CREATE POLICY "public_read_active" ON public.admin_portfolio_items
      FOR SELECT USING (is_active = true);
  END IF;
EXCEPTION WHEN undefined_object THEN null; END $$;

COMMIT;
