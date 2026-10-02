-- G2-A apply helper part 2 (indexes + backfill — subset of migration 105)
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_assets_asset_key
  ON public.media_assets (asset_key)
  WHERE asset_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_media_assets_category
  ON public.media_assets (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_media_assets_scope
  ON public.media_assets (tenant_id, brand_id);
UPDATE public.media_assets
   SET category  = 'product',
       asset_key = 'product.' || id,
       is_active = true,
       is_mock   = false,
       version   = 1,
       updated_at = now()
 WHERE category IS NULL
   AND url LIKE '%/bmb-images/products/%';