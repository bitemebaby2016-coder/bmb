-- ============================================================
-- Contract 157 + 158 — anon policy role scoping / grants+RLS alignment
-- ครอบคลุม:
--   157.1 ไม่มี policy ที่ anon/public ประเมินได้และเรียก is_*() helper (fail-closed invariant)
--   157.2 reviews_anon_read มีอยู่ (anon อ่านเฉพาะ is_verified)
--   157.3 anon SELECT รีวิว verified ได้จริง / แถวไม่ verified มองไม่เห็น
--   158.1 RLS เปิดบน admin_portfolio_items + products_branch_overrides
--   158.2 authenticated มี SELECT ครบ 31 ตารางที่ 158 GRANT
--   158.3 anon ไม่ได้สิทธิ์เพิ่มจาก default privileges (มีแต่ authenticated/service_role)
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- 157.1 fail-closed invariant ----------
DO $$
DECLARE v_bad int;
BEGIN
  SELECT count(*) INTO v_bad FROM pg_policies p
   WHERE p.schemaname='public'
     AND (p.roles::text[] @> ARRAY['anon'] OR p.roles::text[] @> ARRAY['public'])
     AND (p.qual ~ 'is_[a-z_]+\s*\(' OR COALESCE(p.with_check,'') ~ 'is_[a-z_]+\s*\(');
  IF v_bad <> 0 THEN RAISE EXCEPTION '157.1 FAIL: % anon-visible policies still call is_*()', v_bad; END IF;
  RAISE NOTICE '157.1 PASS: no anon/public policy evaluates is_*() helpers';
END $$;

-- ---------- 157.2 legacy review policies stay dropped (198/199 supersede) ----------
DO $$
DECLARE v_legacy int;
BEGIN
  -- 198/199: reviews_anon_read (157-era) และ reviews_public_read ถูกถอดโดยเจตนา
  --   (moderation era ใช้ public_read_approved_reviews) — ห้ามกลับมา
  SELECT count(*) INTO v_legacy FROM pg_policies
   WHERE schemaname='public' AND tablename='reviews'
     AND policyname IN ('reviews_anon_read','reviews_public_read');
  IF v_legacy <> 0 THEN RAISE EXCEPTION '157.2 FAIL: % legacy review policy(ies) returned', v_legacy; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='reviews' AND policyname='public_read_approved_reviews') THEN
    RAISE EXCEPTION '157.2 FAIL: public_read_approved_reviews (198-era) missing';
  END IF;
  RAISE NOTICE '157.2 PASS: legacy review policies absent, moderation-era policy in place';
END $$;

-- ---------- 157.3 behavior: anon reads approved/verified reviews only (moderation era) ----------
DO $$
DECLARE v_cat text; v_prod text; v_seen int;
BEGIN
  v_cat := 'cat-c157';
  v_prod := 'prod-c157';
  INSERT INTO public.product_categories (id, name, slug) VALUES (v_cat, 'Contract 157', 'contract-157')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.products (id, name, description, price, category_id)
    VALUES (v_prod, 'Contract 157 Product', '', 10, v_cat)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.reviews (id, product_id, customer_name, rating, comment, is_verified, status)
  VALUES ('rev-c157-ok', v_prod, 'Tester', 5, 'approved review', true, 'approved');
  INSERT INTO public.reviews (id, product_id, customer_name, rating, comment, is_verified, status)
  VALUES ('rev-c157-no', v_prod, 'Tester', 1, 'unverified', false, 'pending');

  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_seen FROM public.reviews WHERE id IN ('rev-c157-ok','rev-c157-no');
  RESET ROLE;
  IF v_seen <> 1 THEN
    RAISE EXCEPTION '157.3 FAIL: anon sees % of 2 reviews (expected only the approved one)', v_seen;
  END IF;
  RAISE NOTICE '157.3 PASS: anon reads approved review only';
END $$;

-- ---------- 158.1 RLS enabled on the two missed tables ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='admin_portfolio_items' AND c.relrowsecurity) THEN
    RAISE EXCEPTION '158.1 FAIL: admin_portfolio_items RLS not enabled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='products_branch_overrides' AND c.relrowsecurity) THEN
    RAISE EXCEPTION '158.1 FAIL: products_branch_overrides RLS not enabled';
  END IF;
  RAISE NOTICE '158.1 PASS: RLS enabled on admin_portfolio_items + products_branch_overrides';
END $$;

-- ---------- 158.2 authenticated SELECT on the 31 granted tables ----------
DO $$
DECLARE r record; v_bad int := 0; v_ok int := 0;
BEGIN
  FOR r IN SELECT t FROM (VALUES ('addon_groups'), ('addons'), ('admin_portfolio_items'), ('ai_customer_memory'),
    ('audit_logs'), ('branches'), ('brands'), ('business_settings'), ('content_approvals'),
    ('customer_channel_identities'), ('customer_intelligence'), ('daily_closings'), ('delivery_zones'),
    ('dispatch_offer_declines'), ('dispatch_offers'), ('driver_location_history'), ('marketing_posts'),
    ('marketing_rules'), ('menu_schedule'), ('menu_sections'), ('notification_prefs'),
    ('order_status_history'), ('print_jobs'), ('product_addon_groups'), ('products_branch_overrides'),
    ('promotion_products'), ('provider_orders'), ('push_subscriptions'), ('shifts'), ('system_errors'),
    ('tenants')) AS v(t)
  LOOP
    IF to_regclass('public.' || r.t) IS NULL THEN CONTINUE; END IF;
    IF NOT has_table_privilege('authenticated', 'public.' || r.t, 'SELECT') THEN
      v_bad := v_bad + 1;
    ELSE
      v_ok := v_ok + 1;
    END IF;
  END LOOP;
  IF v_bad <> 0 THEN RAISE EXCEPTION '158.2 FAIL: authenticated missing SELECT on % table(s)', v_bad; END IF;
  IF v_ok < 31 THEN RAISE EXCEPTION '158.2 FAIL: only % of 31 tables verified (missing tables in chain?)', v_ok; END IF;
  RAISE NOTICE '158.2 PASS: authenticated SELECT verified on % tables', v_ok;
END $$;

-- ---------- 158.3 default privileges exclude anon ----------
DO $$
DECLARE v_anon_rows int;
BEGIN
  -- default ACL บนตาราง (defaclobjtype='r') ใน schema public ต้องไม่มีรายการ grantee=anon
  SELECT count(*) INTO v_anon_rows
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
   WHERE n.nspname = 'public'
     AND d.defaclobjtype = 'r'
     AND EXISTS (
       SELECT 1 FROM unnest(d.defaclacl) acl
        WHERE (regexp_replace(acl::text, '=.*$', '') = 'anon'
               OR acl::text LIKE '%=arwdDxt/anon%' OR acl::text LIKE 'anon=%')
     );
  IF v_anon_rows <> 0 THEN RAISE EXCEPTION '158.3 FAIL: default table ACL grants anon (% rows)', v_anon_rows; END IF;
  RAISE NOTICE '158.3 PASS: default privileges do not include anon';
END $$;

ROLLBACK;