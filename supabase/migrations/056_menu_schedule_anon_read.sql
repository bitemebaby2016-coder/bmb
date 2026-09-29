-- ============================================
-- Bite Me Baby — Migration 056: CAT-02 customer read of published menu schedule
-- CAT-D02=A: connect EXISTING migration 039 menu_schedule to Admin + Customer PWA.
--
-- ADDITIVE ONLY: 1 RLS SELECT policy for ANON reading PUBLISHED schedule rows.
--   Rationale: get_menu_for_date (039) is authenticated-only, so anonymous
--   customers could not read the schedule — while trg_menu_gate REJECTS their
--   off-menu PRE_ORDER orders. Customer must see the same canonical schedule
--   the server enforces (CAT-02 §5: no "admin closed / customer open" split).
--   Scoped: is_published = true rows only. No anon write. No policy reduced.
-- No other change: table, RPCs, triggers, orders, state machine untouched.
-- ============================================

DROP POLICY IF EXISTS menu_schedule_published_anon_read ON public.menu_schedule;
CREATE POLICY menu_schedule_published_anon_read ON public.menu_schedule
  FOR SELECT TO anon
  USING (is_published = true);

-- Table-level GRANT (039 granted authenticated/service_role/postgres only —
-- anon SELECT was missing, verified 401 via REST with the anon key).
-- RLS above still scopes anon to published rows; no write privileges granted.
GRANT SELECT ON public.menu_schedule TO anon;

