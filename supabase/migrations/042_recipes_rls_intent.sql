-- ============================================
-- Bite Me Baby — Migration 042: RECIPES RLS — AUTHENTICATED READ / ADMIN WRITE
-- (F-18 · WAVE 2-C)
-- Date: 2026-09-27 · Baseline: 7341b40 · Scope: Wave 2 (F-18 only)
--
-- OWNER INTENT (Decision 13 / F-18):
--   recipes = Authenticated Read / Admin Write.
--   Anon must NOT read recipes outside an intended public policy.
--
-- CURRENT REALITY (tested): recipes_anon_read (migr 019) exposes the FULL BOM
--   (ingredient ids + quantity_per_unit — operational/cost data) to anon.
--   No visibility/secret column exists in public.recipes (019 §1).
--
-- CHANGE: remove anon read (anon → deny); add authenticated read (whole table).
--   Client consumers verified: recipes is read only by the ADMIN client
--   (src/lib/bmbAdminApi_recipes.ts) — no anon/public consumer exists.
--
-- GAP REPORTED (NOT decided by dev): "Master Recipe / secret recipe = Admin only"
--   requires a per-row visibility column (e.g. recipes.is_public) which does not
--   exist. Per NO ASSUMPTION RULE this granularity is an OWNER DECISION. Until
--   decided, authenticated users can read the full BOM and anon cannot read
--   anything (matches Decision 13 at table granularity).
-- SAFETY: CREATE/DROP POLICY only, single transaction, re-run safe.
-- ============================================

BEGIN;

DROP POLICY IF EXISTS recipes_anon_read ON public.recipes;

DROP POLICY IF EXISTS recipes_auth_read ON public.recipes;
CREATE POLICY recipes_auth_read ON public.recipes
  FOR SELECT TO authenticated
  USING (true);

-- recipes_admin (migr 019: FOR ALL TO authenticated USING is_admin) unchanged.

-- Defense-in-depth: drop the legacy blanket anon grant (RLS already denies,
-- this removes the grant surface too).
REVOKE SELECT ON TABLE public.recipes FROM anon;

COMMIT;

-- ============================================
-- END OF MIGRATION 042
-- ============================================
