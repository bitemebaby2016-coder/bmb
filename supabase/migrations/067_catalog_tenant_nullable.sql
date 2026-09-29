-- Bite Me Baby Migration 067: TEN-03 Catalog Tenant IDs (Nullable)
-- CREATES missing tables + adds tenant_id to ALL catalog tables
-- NOTE: addon_groups/addons/product_addon_groups DO NOT EXIST in production
-- Owner decisions: all = TENANT_OWNED, index per table, archived preserved
BEGIN;

CREATE TABLE IF NOT EXISTS public.addon_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
COMMENT ON TABLE public.addon_groups IS 'TENANT_OWNED';

CREATE TABLE IF NOT EXISTS public.addons (id TEXT PRIMARY KEY, addon_group_id TEXT NOT NULL REFERENCES public.addon_groups(id), name TEXT NOT NULL DEFAULT '', price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0), sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
COMMENT ON TABLE public.addons IS 'TENANT_OWNED';

CREATE TABLE IF NOT EXISTS public.product_addon_groups (product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, addon_group_id TEXT NOT NULL REFERENCES public.addon_groups(id), is_required BOOLEAN NOT NULL DEFAULT false, min_selection INTEGER NOT NULL DEFAULT 0, max_selection INTEGER NOT NULL DEFAULT -1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (product_id, addon_group_id));
COMMENT ON TABLE public.product_addon_groups IS 'TENANT_OWNED';

ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;

DO $$_ BEGIN EXECUTE 'DROP POLICY IF EXISTS _mg_adm ON public.addon_groups'; EXECUTE 'CREATE POLICY _mg_adm ON public.addon_groups FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())'; EXCEPTION WHEN undefined_function THEN NULL; END $$_;
DO $$_ BEGIN EXECUTE 'DROP POLICY IF EXISTS _mg_adm ON public.addons'; EXECUTE 'CREATE POLICY _mg_adm ON public.addons FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())'; EXCEPTION WHEN undefined_function THEN NULL; END $$_;
DO $$_ BEGIN EXECUTE 'DROP POLICY IF EXISTS _mg_adm ON public.product_addon_groups'; EXECUTE 'CREATE POLICY _mg_adm ON public.product_addon_groups FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())'; EXCEPTION WHEN undefined_function THEN NULL; END $$_;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.menu_sections ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.addon_groups ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.addons ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.product_addon_groups ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.menu_schedule ADD COLUMN IF NOT EXISTS tenant_id TEXT;
COMMENT ON COLUMN public.products.tenant_id IS 'TENANT_IDENTITY: FK-like reference to tenants(id). Nullable until backfill + enforcement.';
COMMENT ON COLUMN public.product_categories.tenant_id IS 'TENANT_IDENTITY: FK-like reference to tenants(id). Inherited from parent sections tenant.';
COMMENT ON COLUMN public.menu_sections.tenant_id IS 'TENANT_IDENTITY: FK-like reference to tenants(id). Root of catalog hierarchy.';
COMMENT ON COLUMN public.addon_groups.tenant_id IS 'TENANT_IDENTITY: FK-like reference to tenants(id). Tenants own their addon groups.';
COMMENT ON COLUMN public.addons.tenant_id IS 'TENANT_IDENTITY: FK-like reference to tenants(id). Tenants own their addons.';
COMMENT ON COLUMN public.product_addon_groups.tenant_id IS 'TENANT_IDENTITY: FK-like reference to tenants(id). Linker inherits tenant from related entities.';
COMMENT ON COLUMN public.menu_schedule.tenant_id IS 'TENANT_IDENTITY: FK-like reference to tenants(id). Schedule items belong to same tenant as source product. Preserve existing scheduling semantics.';

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_tenant_id ON public.product_categories (tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_sections_tenant_id ON public.menu_sections (tenant_id);
CREATE INDEX IF NOT EXISTS idx_addon_groups_tenant_id ON public.addon_groups (tenant_id);
CREATE INDEX IF NOT EXISTS idx_addons_tenant_id ON public.addons (tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_addon_groups_tenant_id ON public.product_addon_groups (tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_schedule_tenant_id ON public.menu_schedule (tenant_id);
COMMIT;