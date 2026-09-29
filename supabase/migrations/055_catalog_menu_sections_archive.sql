-- ============================================
-- Bite Me Baby — Migration 055: CAT-01 Menu/Section/Archive catalog structure
-- Owner decisions: CAT-D01=B (Menu→Section→Category→Product, SERVER-ENFORCED),
--                  CAT-D04=B (soft archive; hard DELETE is NOT the normal mechanism)
-- Tenancy: TEN-D01=A — tenant-owned catalog (single default tenant for now;
--          tenant_id columns are NOT added in this gate).
--
-- ADDITIVE ONLY:
--   + menu_sections (new table)
--   + product_categories.menu_section_id (nullable FK)
--   + product_categories.archived (default false)
--   + products.archived (default false)
--   + gate trigger on order_items (catalog visibility enforcement at order time)
-- Existing orders / snapshots / state machine / payment / dispatch: UNTOUCHED.
-- ============================================

-- 1) Sections (Menu → Section level)
CREATE TABLE IF NOT EXISTS public.menu_sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Category belongs to a section (nullable = legacy/no section, always allowed)
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS menu_section_id TEXT REFERENCES public.menu_sections(id);
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- 3) Product soft archive (CAT-D04=B)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- 4) RLS on new table (same model as products: public read active, admin manage)
ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS menu_sections_public_read ON public.menu_sections;
CREATE POLICY menu_sections_public_read ON public.menu_sections
  FOR SELECT TO anon, authenticated
  USING (is_active = true);
DROP POLICY IF EXISTS menu_sections_admin_manage ON public.menu_sections;
CREATE POLICY menu_sections_admin_manage ON public.menu_sections
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5) SERVER-ENFORCED catalog visibility gate (CAT-D01=B).
--    Runs at order time on order_items (AFTER INSERT) so the canonical
--    create_order_with_items RPC and any direct insert both pass the gate.
--    Read-only checks; raises → whole order transaction aborts.
--    Section/category unset (NULL) = allowed (additive, zero disruption).
CREATE OR REPLACE FUNCTION public.enforce_catalog_visibility_gate() RETURNS trigger AS $fn$
DECLARE
  v_prod RECORD;
BEGIN
  SELECT p.archived, p.is_available,
         c.is_active AS cat_active, c.archived AS cat_archived,
         s.is_active AS section_active
    INTO v_prod
    FROM public.products p
    JOIN public.product_categories c ON c.id = p.category_id
    LEFT JOIN public.menu_sections s ON s.id = c.menu_section_id
   WHERE p.id = NEW.product_id;

  IF v_prod IS NULL THEN
    RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND';
  END IF;
  IF COALESCE(v_prod.archived, false) THEN
    RAISE EXCEPTION 'ERR_PRODUCT_ARCHIVED';
  END IF;
  IF NOT COALESCE(v_prod.is_available, false) THEN
    RAISE EXCEPTION 'ERR_PRODUCT_UNAVAILABLE';
  END IF;
  IF COALESCE(v_prod.cat_archived, false) THEN
    RAISE EXCEPTION 'ERR_CATEGORY_ARCHIVED';
  END IF;
  IF NOT COALESCE(v_prod.cat_active, false) THEN
    RAISE EXCEPTION 'ERR_CATEGORY_CLOSED';
  END IF;
  IF v_prod.section_active = false THEN
    RAISE EXCEPTION 'ERR_SECTION_CLOSED';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_catalog_visibility_gate ON public.order_items;
CREATE TRIGGER trg_catalog_visibility_gate
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_catalog_visibility_gate();

-- 6) updated_at touch for sections
CREATE OR REPLACE FUNCTION public.touch_menu_sections_updated_at() RETURNS trigger AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_menu_sections_touch ON public.menu_sections;
CREATE TRIGGER trg_menu_sections_touch
  BEFORE UPDATE ON public.menu_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_menu_sections_updated_at();
