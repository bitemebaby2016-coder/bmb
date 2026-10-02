-- ============================================
-- REPLAY PATCH for migration 070 (ISOLATED LOCAL ONLY)
-- Reason: repo 070 contains a PL/pgSQL compile error (RAISE with 3 placeholders,
-- 0 params) - it cannot have run as-is in production (content drift).
-- This patch reproduces the VERIFIED production constraint state
-- (all catalog tenant_id columns NOT NULL, values tenant-bmb-001).
-- ============================================
ALTER TABLE public.products            ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.product_categories  ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.menu_sections       ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.addon_groups        ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.addons              ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.product_addon_groups ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE public.products             SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;
UPDATE public.product_categories   SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;
UPDATE public.menu_sections        SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;
UPDATE public.addon_groups         SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;
UPDATE public.addons               SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;
UPDATE public.product_addon_groups SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;
ALTER TABLE public.products             ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.product_categories   ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.menu_sections        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.addon_groups         ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.addons               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.product_addon_groups ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.menu_schedule ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE public.menu_schedule SET tenant_id = 'tenant-bmb-001' WHERE tenant_id IS NULL;
ALTER TABLE public.menu_schedule ALTER COLUMN tenant_id SET NOT NULL;
