-- ============================================
-- Bite Me Baby — Migration 105: Asset Registry on media_assets (G2, Option A)
-- Owner Decision (GATE 2 EXECUTION ORDER, 2026-10-02): OPTION A — extend the
-- existing `media_assets` table ADDITIVELY. NO second registry table.
--
-- Safety contract (per Owner):
--   * NOT destructive: ADD COLUMN IF NOT EXISTS only — no DROP of columns/data
--   * Preserves all existing rows (9 production media_assets) and consumers
--     (bmbAdminApi_media.ts, AdminMedia.tsx, uploadProductImage flow)
--   * All new columns nullable or defaulted → existing INSERT paths unaffected
--   * Existing RLS policies on media_assets unchanged and cover new columns
--     (media_assets_public_read SELECT for {anon,authenticated};
--      media_assets_admin ALL for {authenticated}) — verified live on DB
--   * tenant_id/brand_id left NULL on backfill (single-tenant production;
--     assignment happens via Admin UI — no guessing production relationships)
--
-- Backfill strategy (explicit, additive):
--   existing rows are product images (verified: url LIKE '%/products/%') →
--     category='product', asset_key='product.'||id (stable, unique),
--     is_active=true, is_mock=false, version=1, updated_at=now()
--
-- Rollback-safe: reverse = DROP COLUMN ... for each added column (data-free
-- operation; no production asset is mutated or deleted).
-- ============================================

BEGIN;

-- ===== 1. Additive registry columns =====
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS asset_key  text;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS category   text;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS tenant_id  text;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS brand_id   text;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS is_mock    boolean NOT NULL DEFAULT false;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS version    integer NOT NULL DEFAULT 1;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS updated_by uuid;

-- ===== 2. Canonical key uniqueness (DB-level authority, partial = legacy rows unaffected) =====
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_assets_asset_key
  ON public.media_assets (asset_key)
  WHERE asset_key IS NOT NULL;

-- Indexes for the Admin/Runtime lookup paths (filter by category + scope)
CREATE INDEX IF NOT EXISTS ix_media_assets_category
  ON public.media_assets (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_media_assets_scope
  ON public.media_assets (tenant_id, brand_id);

-- ===== 3. Explicit backfill (additive — mutates ONLY the new columns) =====
UPDATE public.media_assets
   SET category  = 'product',
       asset_key = 'product.' || id,
       is_active = true,
       is_mock   = false,
       version   = 1,
       updated_at = now()
 WHERE category IS NULL
   AND url LIKE '%/bmb-images/products/%';

COMMIT;

-- ROLLBACK (for reference — run manually if ever needed):
--   DROP INDEX IF EXISTS public.ix_media_assets_scope;
--   DROP INDEX IF EXISTS public.ix_media_assets_category;
--   DROP INDEX IF EXISTS public.uq_media_assets_asset_key;
--   ALTER TABLE public.media_assets
--     DROP COLUMN IF EXISTS updated_by, DROP COLUMN IF EXISTS updated_at,
--     DROP COLUMN IF EXISTS version, DROP COLUMN IF EXISTS sort_order,
--     DROP COLUMN IF EXISTS is_mock, DROP COLUMN IF EXISTS is_active,
--     DROP COLUMN IF EXISTS brand_id, DROP COLUMN IF EXISTS tenant_id,
--     DROP COLUMN IF EXISTS category, DROP COLUMN IF EXISTS asset_key;