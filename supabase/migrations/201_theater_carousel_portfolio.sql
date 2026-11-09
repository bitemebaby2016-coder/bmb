-- ============================================
-- Bite Me Baby Migration 201: Food Theater Carousel (extends admin_portfolio_items)
-- Date: 2026-11-09 · Baseline: 094_admin_portfolio.sql exists
-- Scope: Extend admin_portfolio_items for theater carousel on /shop
--        Adds product link, theater flag, and theater-specific caption
-- ============================================

BEGIN;

-- Extend admin_portfolio_items for theater carousel
ALTER TABLE public.admin_portfolio_items
  ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_theater_carousel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS theater_caption TEXT;

-- Index for theater carousel queries
CREATE INDEX IF NOT EXISTS idx_admin_portfolio_theater_carousel
  ON public.admin_portfolio_items (is_theater_carousel, display_order)
  WHERE is_theater_carousel = true AND is_active = true;

-- Index for product lookup
CREATE INDEX IF NOT EXISTS idx_admin_portfolio_product_id
  ON public.admin_portfolio_items (product_id)
  WHERE product_id IS NOT NULL;

COMMENT ON COLUMN public.admin_portfolio_items.product_id IS
  'Optional link to products table for theater carousel navigation to /menu?product=<id>';

COMMENT ON COLUMN public.admin_portfolio_items.is_theater_carousel IS
  'When true, this item appears in the Food Theater carousel on /shop';

COMMENT ON COLUMN public.admin_portfolio_items.theater_caption IS
  'Optional theater-specific caption (overrides description in carousel)';

COMMIT;