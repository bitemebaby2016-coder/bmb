-- ============================================
-- Bite Me Baby — Migration 023: Canonical Order Domain (PHASE 2)
-- Date: 2026-09-22 · Design: ORDER_SPINE_DESIGN.md @ 6cffbe5 (APPROVED)
--
-- 1) enum order_mode ('SAME_DAY','PRE_ORDER')
-- 2) orders.order_mode + orders.scheduled_date (+ backfill invariant from rounds)
-- 3) products.available_same_day / available_preorder (mode rule A/B/C)
--    is_preorder KEPT as deprecated read-alias, synced ONE-DIRECTION:
--    canonical = available_preorder → trigger mirrors it into is_preorder.
--    (Consumers of is_preorder: homeProviders, MenuPage filter, ReviewCarouselSection,
--     bmbAdminApi_products get*Products + upsert. They keep working via the mirror.
--     Admin writes to is_preorder are IGNORED in favor of the canonical column.)
-- 4) production_batch_items.order_mode (kitchen queue snapshot)
-- 5) business_settings 'order_policy' seed (D-1 max_items_per_order=20, D-4 lead 1, D-5 cancel 5m)
--    NOTE: D-2 canonical cutoffs (08:00/10:30/16:00) are applied in 024 (round lifecycle).
--
-- Additive · idempotent · transactional · no DROP of data.
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS products_sync_mode_alias ON public.products;
--   DROP FUNCTION IF EXISTS public.sync_product_mode_alias();
--   DROP INDEX IF EXISTS idx_products_preorder_mode; DROP INDEX IF EXISTS idx_products_sameday_off;
--   DROP INDEX IF EXISTS idx_orders_mode_date; DROP INDEX IF EXISTS idx_orders_scheduled_date;
--   ALTER TABLE public.orders DROP COLUMN IF EXISTS scheduled_date;
--   ALTER TABLE public.orders DROP COLUMN IF EXISTS order_mode;
--   ALTER TABLE public.production_batch_items DROP COLUMN IF EXISTS order_mode;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS available_preorder;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS available_same_day;
--   DELETE FROM public.business_settings WHERE key='order_policy';
--   DROP TYPE IF EXISTS public.order_mode;  -- only after all dependent columns/functions removed
-- ============================================

BEGIN;

-- 1. order_mode enum (guarded)
DO $$ BEGIN
  CREATE TYPE public.order_mode AS ENUM ('SAME_DAY', 'PRE_ORDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. canonical order columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_mode public.order_mode NOT NULL DEFAULT 'SAME_DAY';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_date DATE;

-- Invariant backfill: existing rows adopt their round's date (same-day semantics preserved).
UPDATE public.orders o
   SET scheduled_date = r.scheduled_date
  FROM public.delivery_rounds r
 WHERE o.delivery_round_id = r.id
   AND o.scheduled_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_mode_date ON public.orders (order_mode, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_date ON public.orders (scheduled_date);

-- 3. product mode columns + preserve is_preorder as alias
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_same_day BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_preorder BOOLEAN NOT NULL DEFAULT false;

-- Backfill (idempotent): map the boolean semantic that exists today.
UPDATE public.products SET available_preorder = COALESCE(is_preorder, false)
 WHERE available_preorder <> COALESCE(is_preorder, false);

CREATE INDEX IF NOT EXISTS idx_products_preorder_mode ON public.products (available_preorder) WHERE available_preorder = true;
CREATE INDEX IF NOT EXISTS idx_products_sameday_off ON public.products (available_same_day) WHERE available_same_day = false;

-- One-directional alias sync (canonical -> deprecated alias). NO reverse trigger.
CREATE OR REPLACE FUNCTION public.sync_product_mode_alias()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_preorder := COALESCE(NEW.available_preorder, false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_sync_mode_alias ON public.products;
CREATE TRIGGER products_sync_mode_alias
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_mode_alias();

-- 4. kitchen queue mode snapshot
ALTER TABLE public.production_batch_items
  ADD COLUMN IF NOT EXISTS order_mode public.order_mode NOT NULL DEFAULT 'SAME_DAY';

-- 5. order_policy settings (D-1 / D-4 / D-5 — configurable at runtime, DB is authority)
INSERT INTO public.business_settings (key, value) VALUES
  ('order_policy', '{"max_items_per_order":20,"pre_order_lead_days":1,"cancel_window_minutes":5}')
ON CONFLICT (key) DO NOTHING;

COMMIT;
-- ============================================
-- END OF MIGRATION 023
-- ============================================
