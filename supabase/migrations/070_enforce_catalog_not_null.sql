-- Bite Me Baby Migration 070: TEN-03 Enforce NOT NULL on catalog tenant_id
-- SET NOT NULL on all 7 catalog tables after backfill verifies 0 nulls remain
BEGIN;
DO $$ DECLARE v_p int; v_c int; v_s int; BEGIN SELECT count(*) INTO v_p FROM public.products WHERE tenant_id IS NULL; SELECT count(*) INTO v_c FROM public.product_categories WHERE tenant_id IS NULL; SELECT count(*) INTO v_s FROM public.menu_sections WHERE tenant_id IS NULL; IF v_p > 0 OR v_c > 0 OR v_s > 0 THEN RAISE EXCEPTION 'ERR_ENFORCE_NULLS: products=%, categories=%, sections=% still have null.'; END IF; END $$;

-- Also verify newly created tables have no null tenant_id
DO $$ DECLARE v_ag int; v_a int; v_pag int; BEGIN SELECT count(*) INTO v_ag FROM public.addon_groups WHERE tenant_id IS NULL; SELECT count(*) INTO v_a FROM public.addons WHERE tenant_id IS NULL; SELECT count(*) INTO v_pag FROM public.product_addon_groups WHERE tenant_id IS NULL; IF v_ag > 0 OR v_a > 0 OR v_pag > 0 THEN RAISE EXCEPTION 'ERR_ENFORCE_NULLS: addon_groups=%, addons=%, product_addon_groups=% still have null.'; END IF; END $$;

ALTER TABLE public.products ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.product_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.menu_sections ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.addon_groups ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.addons ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.product_addon_groups ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.menu_schedule ALTER COLUMN tenant_id SET NOT NULL;
COMMIT;