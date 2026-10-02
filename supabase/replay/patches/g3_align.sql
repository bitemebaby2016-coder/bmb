-- REPLAY ALIGNMENT PATCH (ISOLATED LOCAL ONLY) — G3 PRECONDITION
-- Applies migration 107's scope invariants (composite unique on brands) that
-- migration 109's brand FK requires; 107 itself is a production DATA migration
-- (backfill preconditions are production-specific and do not hold on the
-- isolated fixture DB, which seeds its own brand fixtures).
ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS uq_brands_tenant_id;
ALTER TABLE public.brands ADD CONSTRAINT uq_brands_tenant_id UNIQUE (tenant_id, id);
ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS ck_media_assets_tenant_or_global;
ALTER TABLE public.media_assets ADD CONSTRAINT ck_media_assets_tenant_or_global
  CHECK (tenant_id IS NOT NULL OR (tenant_id IS NULL AND category = 'global'));
ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS ck_media_assets_global_explicit;
ALTER TABLE public.media_assets ADD CONSTRAINT ck_media_assets_global_explicit
  CHECK (tenant_id IS NOT NULL OR category = 'global');
ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS fk_media_assets_brand_tenant;
ALTER TABLE public.media_assets ADD CONSTRAINT fk_media_assets_brand_tenant
  FOREIGN KEY (tenant_id, brand_id) REFERENCES public.brands (tenant_id, id);