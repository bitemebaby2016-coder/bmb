-- ============================================
-- Bite Me Baby — 033: TABLE-ACL ALIGNMENT (F-3)
-- Scope: owner-approved GRANT/REVOKE ONLY (no schema, no policy changes)
-- Baseline: dc6e7ca · Wave: PHASE 3B · Follows 031/032 (function-EXECUTE drift repair)
--
-- WHY (evidence):
--   001/002/004 ran `GRANT ALL ON ALL TABLES TO anon, authenticated` (wide-grant
--   era). 006 then narrowed anon to SELECT on 7 tables and granted
--   SELECT/INSERT/UPDATE/DELETE to authenticated — but only on the objects that
--   existed at that time. Tables created later (007-028) never received explicit
--   grants, and the 004-era REFERENCES/TRIGGER/TRUNCATE residue was never
--   revoked. Every public rel is RLS-enabled (verified), so no active leak —
--   but the ACL layer no longer matches the policy layer nor the app's real
--   consumption. That is the exact drift class 031/032 fixed for EXECUTE.
--
-- WHAT (align grants to policies + direct app usage):
--   1. Residue cleanup: REVOKE REFERENCES/TRIGGER/TRUNCATE from
--      anon+authenticated on every public rel (tables AND views — the
--      004-era `GRANT ALL ON ALL TABLES` also left meaningless TRUNCATE
--      entries in view ACLs, e.g. customer_intelligence; PG15 accepts
--      REVOKE TRUNCATE on views).
--   2. service_role: full restore on ALL public tables+views (platform
--      canonical: server-only key, RLS bypass; used by Stripe webhooks / jobs)
--      + default privileges for future objects created by `postgres`.
--   3. authenticated: policy-backed grants for tables the app consumes
--      directly via PostgREST:
--        business_settings (SELECT — checkout reads config; policy auth_read)
--        content_approvals  (SELECT — listContentApprovals; auth_read own/admin)
--        media_assets       (SELECT,INSERT,UPDATE,DELETE — AdminMedia CRUD)
--        mascot_overrides   (SELECT,INSERT,UPDATE,DELETE — AdminMascot)
--   4. anon: mascot_overrides SELECT (storefront mascot; policy anon_read).
--      The canonical 006 anon SELECT set (products, product_categories,
--      delivery_rounds, reviews, promotions, preorder_votes, orders) untouched.
--   5. SECURITY: close the updatable-view write path. public_profiles is a VIEW
--      over profiles; views execute with owner rights (profiles RLS does NOT
--      apply inside), so write privileges on the view equal an RLS bypass
--      (cross-user profile modification). The app only ever SELECTs it
--      (bmbAdminApi_users.ts getUsers). Revoke INSERT/UPDATE/DELETE from
--      authenticated; keep SELECT (admin users page).
--   6. pre_orders: 024 made it a read-only archive (SELECT policies only;
--      writes go through SECURITY DEFINER RPC shims). Revoke the 006-era
--      INSERT/UPDATE/DELETE grants from authenticated.
-- ============================================

BEGIN;

-- --------------------------------------------
-- 1. GRANT-ALL-era residue cleanup
-- --------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r','p','v')
  LOOP
    EXECUTE format('REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.%I FROM anon', r.relname);
    EXECUTE format('REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.%I FROM authenticated', r.relname);
  END LOOP;
END $$;

-- --------------------------------------------
-- 2. service_role platform-canonical restore
-- --------------------------------------------
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- --------------------------------------------
-- 3. authenticated: policy-backed, app-consumed grants
-- --------------------------------------------
GRANT SELECT ON public.business_settings TO authenticated;
GRANT SELECT ON public.content_approvals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mascot_overrides TO authenticated;

-- --------------------------------------------
-- 4. anon: storefront mascot read (policy mascot_overrides_anon_read)
-- --------------------------------------------
GRANT SELECT ON public.mascot_overrides TO anon;

-- --------------------------------------------
-- 5. SECURITY: updatable-view write path closure
--    public_profiles is a VIEW over profiles — views execute with the owner's
--    rights (profiles RLS does not apply inside), so write privileges here
--    equal an RLS bypass (cross-user profile modification). The app only ever
--    SELECTs it (bmbAdminApi_users.ts getUsers); keep SELECT for the page.
-- --------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.public_profiles FROM authenticated;

-- --------------------------------------------
-- 6. pre_orders read-only archive (024) — writes only via SECURITY DEFINER RPC
-- --------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.pre_orders FROM authenticated;

COMMIT;