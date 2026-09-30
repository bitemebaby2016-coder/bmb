-- ============================================
-- Bite Me Baby — Migration 097: Public-read ACL safety net (401 fix)
-- Symptom: production console showed repeated "401 Unauthorized" and the
-- floating banner / storefront sections rendered empty.
-- Fix: guarantee GRANT SELECT to anon + authenticated on every table the
-- public storefront reads directly. Idempotent — safe to re-run.
-- RLS stays ON everywhere; these grants only let the request reach the
-- RLS filter (a row the policy hides still won't be returned).
-- ============================================

BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products',
    'product_categories',
    'promotions',
    'branches',
    'delivery_rounds',
    'delivery_zones',
    'business_settings',
    'admin_portfolio_items'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    END IF;
  END LOOP;

  -- Ensure a public SELECT policy exists on the portfolio table (M094 has it,
  -- but re-assert defensively in case a policy was dropped during ACL audits).
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_portfolio_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_portfolio_items' AND policyname = 'public_read_active'
  ) THEN
    CREATE POLICY "public_read_active" ON public.admin_portfolio_items FOR SELECT USING (is_active = true);
  END IF;
END $$;

-- Verification: report any storefront table missing an anon grant (must be 0)
DO $$
DECLARE v_missing int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM (VALUES ('products'),('product_categories'),('promotions'),('branches'),
               ('delivery_rounds'),('delivery_zones'),('business_settings'),
               ('admin_portfolio_items')) AS wanted(t)
  JOIN information_schema.tables it
    ON it.table_schema = 'public' AND it.table_name = wanted.t
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public' AND g.table_name = wanted.t
      AND g.grantee = 'anon' AND g.privilege_type = 'SELECT'
  );
  RAISE NOTICE 'Public-read grant audit — tables still missing anon SELECT: %', v_missing;
  IF v_missing > 0 THEN RAISE EXCEPTION 'ERR_PUBLIC_READ_GRANT_MISSING'; END IF;
END $$;

COMMIT;