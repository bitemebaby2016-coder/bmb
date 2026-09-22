-- ============================================
-- Bite Me Baby — 034: PRODUCTION ACL DRIFT REMEDIATION (F-3 follow-up)
-- Scope: REVOKE-only corrective migration for production 004-era wide-grant residue
-- Baseline: b5f2f1a · Wave: PHASE 3B · Follows 033 (table-ACL alignment)
--
-- WHY (evidence from production):
--   Production retained 004-era `GRANT ALL ON ALL TABLES TO anon, authenticated`
--   that local had already shed. Migration 033 step-1 only revoked
--   REFERENCES/TRIGGER/TRUNCATE residue (its premise from local truth was FALSE on prod).
--   Result on prod after 033:
--     • anon INSERT/UPDATE/DELETE on 16 relations  (gate: anon_write_residue=16)
--     • anon SELECT on 15 non-canonical relations  (gate: anon_extra_select=15)
--     • Live leak: anon GET recipes → 200 with data (recipes_anon_read USING=true + grant)
--     • F-5 policies active for authenticated due to residual grants:
--         payment_intents_policy (ALL USING=true) + authenticated grants on payment_intents
--         inventory_public_read (SELECT USING=true) + authenticated grants on inventory
--         profiles_public_read (SELECT USING=true) + authenticated grants on profiles
--   All 033-owned checks PASS on prod; contracts 023/028/029/030 PASS; only 033 gate fails.
--
-- WHAT (least-privilege REVOKE to align prod grants with canonical model from 006/033):
--   1. Anon write residue: REVOKE INSERT, UPDATE, DELETE on the 16 affected tables.
--   2. Anon extra SELECT: REVOKE SELECT on the 15 non-canonical tables/views.
--      Canonical anon SELECT set (8 tables): products, product_categories, delivery_rounds,
--      reviews, promotions, preorder_votes, orders, mascot_overrides (033 addition).
--   3. Authenticated excess grants on F-5 tables where canonical model = NO GRANTS
--      (access via SECURITY DEFINER RPC / views only):
--      REVOKE ALL on payment_intents, inventory, profiles FROM authenticated.
--   4. Keep ALL 033-owned grants intact (mascot_overrides anon/auth, business_settings auth,
--      content_approvals auth, media_assets auth, mascot_overrides auth, public_profiles SELECT,
--      pre_orders SELECT, service_role full, default privileges).
--   5. Policy layer: recipes_anon_read policy (USING=true) is dormant by design per RLS_MATRIX
--      (anon grant absent). Revoking anon SELECT on recipes makes it dormant again — no policy
--      change needed. Other F-5 policies remain as defense-in-depth; grant revokes make them dormant.
-- ============================================

BEGIN;

-- --------------------------------------------
-- 1. Anon write residue cleanup (16 tables)
--    Gate target: anon_write_residue = 0
-- --------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.ai_customer_memory FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.business_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.content_approvals FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.customer_intelligence FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.delivery_assignments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.delivery_zones FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.drivers FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.mascot_overrides FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.media_assets FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.notification_prefs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.production_batch_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.production_batches FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.provider_orders FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.recipes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.system_errors FROM anon;

-- --------------------------------------------
-- 2. Anon extra SELECT cleanup (15 tables/views)
--    Gate target: anon_extra_select = 0
--    Canonical anon SELECT (8): products, product_categories, delivery_rounds,
--    reviews, promotions, preorder_votes, orders, mascot_overrides
-- --------------------------------------------
REVOKE SELECT ON public.ai_customer_memory FROM anon;
REVOKE SELECT ON public.audit_logs FROM anon;
REVOKE SELECT ON public.business_settings FROM anon;
REVOKE SELECT ON public.content_approvals FROM anon;
REVOKE SELECT ON public.customer_intelligence FROM anon;
REVOKE SELECT ON public.delivery_assignments FROM anon;
REVOKE SELECT ON public.delivery_zones FROM anon;
REVOKE SELECT ON public.drivers FROM anon;
REVOKE SELECT ON public.media_assets FROM anon;
REVOKE SELECT ON public.notification_prefs FROM anon;
REVOKE SELECT ON public.production_batch_items FROM anon;
REVOKE SELECT ON public.production_batches FROM anon;
REVOKE SELECT ON public.provider_orders FROM anon;
REVOKE SELECT ON public.recipes FROM anon;
REVOKE SELECT ON public.system_errors FROM anon;

-- --------------------------------------------
-- 3. Authenticated excess grants on F-5 tables
--    Canonical model (RLS_MATRIX §2/§3): NO GRANTS for authenticated on these;
--    access via SECURITY DEFINER RPC / public_profiles view only.
--    Revoking makes permissive policies (payment_intents_policy, inventory_public_read,
--    profiles_public_read) dormant again — defense-in-depth preserved.
-- --------------------------------------------
REVOKE ALL ON public.payment_intents FROM authenticated;
REVOKE ALL ON public.inventory FROM authenticated;
REVOKE ALL ON public.profiles FROM authenticated;

-- --------------------------------------------
-- 4. Verify 033-owned grants remain (no-op asserts via comments)
--    anon: mascot_overrides SELECT
--    auth: business_settings SELECT, content_approvals SELECT,
--          media_assets S/I/U/D, mascot_overrides S/I/U/D,
--          public_profiles SELECT, pre_orders SELECT
--    service_role: full + default privileges
-- --------------------------------------------

COMMIT;