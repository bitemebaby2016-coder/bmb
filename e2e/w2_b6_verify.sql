-- W-2/B-6 — ตรวจหลัง apply 157: anon ต้องอ่านตาราง storefront ได้โดยไม่ชน policy
SET ROLE anon;
SELECT 'products' AS t, count(*) AS n FROM public.products
UNION ALL SELECT 'product_categories', count(*) FROM public.product_categories
UNION ALL SELECT 'delivery_rounds', count(*) FROM public.delivery_rounds
UNION ALL SELECT 'reviews', count(*) FROM public.reviews
UNION ALL SELECT 'promotions', count(*) FROM public.promotions
UNION ALL SELECT 'preorder_votes', count(*) FROM public.preorder_votes
UNION ALL SELECT 'mascot_overrides', count(*) FROM public.mascot_overrides
UNION ALL SELECT 'admin_portfolio_items', count(*) FROM public.admin_portfolio_items
UNION ALL SELECT 'branches', count(*) FROM public.branches
UNION ALL SELECT 'brands', count(*) FROM public.brands
UNION ALL SELECT 'business_settings', count(*) FROM public.business_settings
UNION ALL SELECT 'delivery_zones', count(*) FROM public.delivery_zones
UNION ALL SELECT 'media_assets', count(*) FROM public.media_assets
UNION ALL SELECT 'menu_schedule', count(*) FROM public.menu_schedule
UNION ALL SELECT 'menu_sections', count(*) FROM public.menu_sections
UNION ALL SELECT 'promotion_products', count(*) FROM public.promotion_products
ORDER BY 1;
RESET ROLE;

-- ยืนยันว่า anon ยัง "เขียน" ไม่ได้เลย (ไม่มีอะไรถูกเปิดจากการแก้รอบนี้)
SET ROLE anon;
DO $chk$
DECLARE r record; leak int := 0;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','p','v')
  LOOP
    IF has_table_privilege('anon', 'public.' || r.relname, 'INSERT') OR has_table_privilege('anon', 'public.' || r.relname, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || r.relname, 'DELETE') THEN
      leak := leak + 1; RAISE NOTICE 'LEAK %', r.relname;
    END IF;
  END LOOP;
  IF leak <> 0 THEN RAISE EXCEPTION 'anon gained write privileges (%)', leak; END IF;
  RAISE NOTICE 'anon write check: ZERO leak';
END $chk$;
RESET ROLE;