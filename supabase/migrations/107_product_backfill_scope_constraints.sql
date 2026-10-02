-- ============================================
-- Bite Me Baby — Migration 107: G2-RV Product Asset Backfill + Scope Constraints
-- ADDITIVE. Backfills EXISTING product media assets to tenant-bmb-001 (Owner-approved)
-- then enforces the Option 3 scope invariants at DB level.
--
-- Pre-conditions verified (Owner order): rows=9, duplicate asset_key=0,
-- missing references=0 — asserted below with HARD STOP semantics.
-- No storage object / URL / product relation / asset_key change.
-- ============================================

BEGIN;

-- 1. Pre-mutation assertions (HARD STOP if drift)
DO $$
DECLARE v_rows int; v_dup int; v_no_tenant int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.media_assets;
  IF v_rows <> 9 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_PRECONDITION: expected 9 media_assets rows, found %', v_rows;
  END IF;
  SELECT count(*) INTO v_dup FROM (
    SELECT asset_key FROM public.media_assets WHERE asset_key IS NOT NULL GROUP BY asset_key HAVING count(*) > 1
  ) d;
  IF v_dup <> 0 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_PRECONDITION: duplicate asset_key groups = %', v_dup;
  END IF;
  SELECT count(*) INTO v_no_tenant FROM public.media_assets WHERE tenant_id IS NULL;
  IF v_no_tenant <> 9 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_PRECONDITION: expected 9 legacy (NULL tenant) rows, found %', v_no_tenant;
  END IF;
END $$;

-- 2. Backfill ownership (data columns ONLY — url/asset_key/category untouched)
UPDATE public.media_assets
   SET tenant_id = 'tenant-bmb-001',
       updated_at = now()
 WHERE tenant_id IS NULL
   AND category = 'product';

-- 3. Post-mutation verification (HARD STOP if mismatch)
DO $$
DECLARE v_rows int; v_nulls int; v_dup int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.media_assets;
  IF v_rows <> 9 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_VERIFY: expected 9 rows after backfill, found %', v_rows;
  END IF;
  SELECT count(*) INTO v_nulls FROM public.media_assets WHERE tenant_id IS NULL;
  IF v_nulls <> 0 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_VERIFY: % rows still have NULL tenant_id', v_nulls;
  END IF;
  SELECT count(*) INTO v_dup FROM (
    SELECT asset_key FROM public.media_assets WHERE asset_key IS NOT NULL GROUP BY asset_key HAVING count(*) > 1
  ) d;
  IF v_dup <> 0 THEN
    RAISE EXCEPTION 'ERR_BACKFILL_VERIFY: duplicate asset_key groups = %', v_dup;
  END IF;
END $$;

-- 4. Scope invariants (Option 3) — NULL scope is NOT global; brand assets stay in tenant
ALTER TABLE public.media_assets ADD CONSTRAINT ck_media_assets_tenant_or_global
  CHECK (tenant_id IS NOT NULL OR category = 'global');
ALTER TABLE public.media_assets ADD CONSTRAINT ck_media_assets_global_explicit
  CHECK (category IS DISTINCT FROM 'global' OR tenant_id IS NULL);
-- Brand-in-tenant enforcement via composite FK (CHECK cannot contain subqueries):
-- brands UNIQUE (id, tenant_id) <- media_assets (tenant_id, brand_id) => a brand asset
-- can only reference a brand owned by the same tenant. NULL brand_id/tenant_id (global) passes (FK NULL rule).
ALTER TABLE public.brands ADD CONSTRAINT uq_brands_id_tenant UNIQUE (id, tenant_id);
ALTER TABLE public.media_assets ADD CONSTRAINT fk_media_assets_brand_in_tenant
  FOREIGN KEY (tenant_id, brand_id) REFERENCES public.brands (tenant_id, id);

COMMIT;

-- ROLLBACK reference (manual):
--   ALTER TABLE public.media_assets
--     DROP CONSTRAINT IF EXISTS ck_media_assets_brand_in_tenant,
--     DROP CONSTRAINT IF EXISTS ck_media_assets_global_explicit,
--     DROP CONSTRAINT IF EXISTS ck_media_assets_tenant_or_global;
--   UPDATE public.media_assets SET tenant_id = NULL WHERE category = 'product';