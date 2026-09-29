-- Bite Me Baby Migration 068: TEN-03 Verification Pre-Backfill (READ-ONLY)
-- NOTE: addon_groups/addons/product_addon_groups now exist after migration-067
-- Scope: Verify readiness before backfilling tenant_id on catalog tables
-- Impact: NONE -- no schema changes, no data mutations
BEGIN;

DO $$ DECLARE v_count int; BEGIN SELECT count(*) INTO v_count FROM public.tenants WHERE id = 'tenant-bmb-001'; IF v_count <> 1 THEN RAISE EXCEPTION 'ERR_VERIFY_TENANT: Expected exactly 1 tenant-bmb-001, found %', v_count; END IF; END $$;

-- Verify no pre-existing tenant_id values exist before backfill
DO $$ DECLARE v_p int; v_c int; v_s int; BEGIN SELECT count(*) INTO v_p FROM public.products WHERE tenant_id IS NOT NULL; SELECT count(*) INTO v_c FROM public.product_categories WHERE tenant_id IS NOT NULL; SELECT count(*) INTO v_s FROM public.menu_sections WHERE tenant_id IS NOT NULL; IF v_p > 0 OR v_c > 0 OR v_s > 0 THEN RAISE EXCEPTION 'ERR_BACKFILL_CONFLICT: Pre-existing tenant_id found in products/sections.'; END IF; END $$;

-- Verify newly created tables have NULL tenant_id
DO $$ DECLARE v_ag int; v_a int; v_pag int; BEGIN SELECT count(*) INTO v_ag FROM public.addon_groups WHERE tenant_id IS NOT NULL; SELECT count(*) INTO v_a FROM public.addons WHERE tenant_id IS NOT NULL; SELECT count(*) INTO v_pag FROM public.product_addon_groups WHERE tenant_id IS NOT NULL; IF v_ag > 0 OR v_a > 0 OR v_pag > 0 THEN RAISE EXCEPTION 'ERR_BACKFILL_CONFLICT: New tables have non-null tenant_id.'; END IF; END $$;

-- Print pre-backfill counts for evidence capture
DO $$ DECLARE v_p int; v_c int; v_s int; BEGIN SELECT count(*) INTO v_p FROM public.products; SELECT count(*) INTO v_c FROM public.product_categories; SELECT count(*) INTO v_s FROM public.menu_sections; RAISE NOTICE 'TEN-03 VERIFY PRE-BACKFILL: products=% categories=% sections=%', v_p, v_c, v_s; END $$;
COMMIT;