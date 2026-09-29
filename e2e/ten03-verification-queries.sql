-- TEN-03 Production Verification Queries
-- Target: ivkdfognyiwjcmrhcnwz (bitemebaby2016-coder)
-- Run AFTER all 5 migrations complete (067 -> 068 -> 069 -> 070 -> 071)

-- 1. ROW COUNTS -- must match pre-migration baseline
SELECT 'products' as tbl, count(*) as cnt FROM public.products UNION ALL
SELECT 'product_categories', count(*) FROM public.product_categories UNION ALL
SELECT 'menu_sections', count(*) FROM public.menu_sections UNION ALL
SELECT 'addon_groups', count(*) FROM public.addon_groups UNION ALL
SELECT 'addons', count(*) FROM public.addons UNION ALL
SELECT 'product_addon_groups', count(*) FROM public.product_addon_groups UNION ALL
SELECT 'menu_schedule', count(*) FROM public.menu_schedule UNION ALL
SELECT 'media_assets', count(*) FROM public.media_assets UNION ALL
SELECT 'orders', count(*) FROM public.orders UNION ALL
SELECT 'order_items', count(*) FROM public.order_items ORDER BY tbl;

-- 2. UNMATCHED tenant_id -- should return EXACTLY ZERO rows
SELECT 'products' as table_name, tenant_id, count(*) as cnt FROM public.products GROUP BY table_name, tenant_id HAVING tenant_id <> 'tenant-bmb-001'
UNION ALL SELECT 'product_categories', tenant_id, count(*) FROM public.product_categories GROUP BY table_name, tenant_id HAVING tenant_id <> 'tenant-bmb-001'
UNION ALL SELECT 'menu_sections', tenant_id, count(*) FROM public.menu_sections GROUP BY table_name, tenant_id HAVING tenant_id <> 'tenant-bmb-001'
UNION ALL SELECT 'addon_groups', tenant_id, count(*) FROM public.addon_groups GROUP BY table_name, tenant_id HAVING tenant_id <> 'tenant-bmb-001'
UNION ALL SELECT 'addons', tenant_id, count(*) FROM public.addons GROUP BY table_name, tenant_id HAVING tenant_id <> 'tenant-bmb-001'
UNION ALL SELECT 'product_addon_groups', tenant_id, count(*) FROM public.product_addon_groups GROUP BY table_name, tenant_id HAVING tenant_id <> 'tenant-bmb-001'
UNION ALL SELECT 'menu_schedule', tenant_id, count(*) FROM public.menu_schedule GROUP BY table_name, tenant_id HAVING tenant_id <> 'tenant-bmb-001';

-- 3. CROSS-TENANT ORDER REFS -- MUST BE 0
SELECT count(*) as cross_tenant_order_refs FROM public.order_items oi JOIN public.products p ON oi.product_id = p.id WHERE p.tenant_id <> 'tenant-bmb-001';

-- 4. NOT NULL enforcement check -- all is_nullable must be NO
SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenant_id' AND table_name IN ('products','product_categories','menu_sections','addon_groups','addons','product_addon_groups','menu_schedule') ORDER BY table_name;

-- 5. RLS POLICIES EXISTING
SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('products','product_categories','menu_sections','addon_groups','addons','product_addon_groups','menu_schedule','media_assets') ORDER BY tablename, policyname;

-- 6. HELPER FUNCTION EXISTS
SELECT proname FROM pg_proc WHERE proname = 'is_tenant_admin';

-- 7. ARCHIVED SEMANTICS PRESERVED
SELECT 'archived_products' as cp, count(*) as v FROM public.products WHERE archived = true UNION ALL
SELECT 'archived_categories', count(*) FROM public.product_categories WHERE archived = true UNION ALL
SELECT 'unavailable_products', count(*) FROM public.products WHERE is_available = false;

-- 8. MEDIA ASSETS UNCHANGED
SELECT 'media_assets_rows' as cp, count(*) as v FROM public.media_assets UNION ALL
SELECT 'products_with_image_url', count(*) FROM public.products WHERE image_url <> '';