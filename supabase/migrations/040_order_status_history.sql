-- ============================================
-- Bite Me Baby — Migration 040: ORDER LIFECYCLE HISTORY (F-05 · WAVE 2-A)
-- Date: 2026-09-27 · Baseline: 7341b40 · Scope: Wave 2 (F-05 only)
--
-- WHY (F-05 = MISSING, Reality Freeze):
--   No authoritative order status history table exists. audit_logs is a generic
--   audit feed (admin-filterable, not lifecycle-authoritative). Kitchen /
--   Tracking / Forensics cannot answer "when / from / to / who / why".
--
-- DESIGN (authority preserved — PostgreSQL stays Transaction Authority):
--   order_status_history is written ONLY by an AFTER INSERT/UPDATE row trigger
--   on public.orders. Every production writer of orders.status is an
--   authoritative server-side path (transition_order_status RPC validated by
--   order_transition_allowed; driver delivery-sync hops migr 036 with the same
--   allow-list; server-side contexts). Clients have NO RLS UPDATE path to
--   orders.status and NO INSERT policy on this table → history cannot be
--   forged. Illegal transitions are rejected BEFORE the UPDATE → no history row
--   for rejected transitions. The trigger runs INSIDE the same transaction as
--   the UPDATE → history insert failure rolls the whole transaction back.
--
-- ACTOR RESOLUTION (inside the transaction):
--   1. GUC app.delivery_sync_order (set by migr 036) → 'DRIVER'
--   2. no JWT (server-side context)                  → 'SYSTEM'
--   3. JWT with is_admin()                           → 'ADMIN'
--   4. JWT owner of the order (customer_ref)         → 'CUSTOMER'
--   5. otherwise                                     → 'RPC'
--   Optional reason via transaction-local GUC app.order_transition_reason.
--
-- STATUS VOCABULARY: existing production enum public.order_status — NO new statuses.
-- INITIAL EVENT: on INSERT → from_status = NULL, to_status = NEW.status.
-- BACKFILL: NOT executed here — PROPOSED (HISTORICAL_BASELINE) pending OWNER
--   approval (PROPOSED_wave2_history_backfill.sql).
-- SAFETY: single transaction · CREATE-only · re-run safe.
--   Rollback: drop trigger + function + table.
-- DEPENDENCIES: 001 (orders, order_status enum) · 005/006 (is_admin) · 036 (sync GUC).
-- ============================================

BEGIN;

-- ============================================
-- 1. Table (TEXT PK per repo convention)
-- ============================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id           TEXT PRIMARY KEY,
  order_number TEXT NOT NULL REFERENCES public.orders(order_number) ON DELETE CASCADE,
  from_status  public.order_status,                       -- NULL = initial creation event
  to_status    public.order_status NOT NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('CUSTOMER','ADMIN','DRIVER','SYSTEM','WEBHOOK','RPC')),
  actor_id     TEXT,
  reason       TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_osh_order ON public.order_status_history (order_number, changed_at);
CREATE INDEX IF NOT EXISTS idx_osh_actor ON public.order_status_history (actor_type, actor_id);

-- ============================================
-- 2. RLS — deny-by-default: no INSERT/UPDATE/DELETE policy at all
--    (clients cannot forge history). SELECT: admin only (ops/forensics).
--    Server-side writers use the SECURITY DEFINER trigger (bypasses RLS).
-- ============================================
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS osh_admin_read ON public.order_status_history;
CREATE POLICY osh_admin_read ON public.order_status_history
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Defense-in-depth: no direct mutation grants for non-service roles.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.order_status_history FROM anon, authenticated;

-- ============================================
-- 3. Trigger function + trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.write_order_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid;
  v_sync       text;
  v_actor_type text;
  v_actor_id   text;
BEGIN
  -- UPDATE without a status change → no history row
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;

  v_uid  := auth.uid();
  v_sync := NULLIF(current_setting('app.delivery_sync_order', true), '');

  IF v_sync IS NOT NULL AND v_sync = NEW.order_number::text THEN
    -- Trusted delivery sync (migr 036) — actor is the JWT-bound driver
    v_actor_type := 'DRIVER';
    SELECT id INTO v_actor_id FROM public.drivers WHERE user_id = v_uid LIMIT 1;
    v_actor_id := COALESCE(v_actor_id, v_uid::text);
  ELSIF v_uid IS NULL THEN
    v_actor_type := 'SYSTEM';
    v_actor_id   := NULL;
  ELSIF public.is_admin() THEN
    v_actor_type := 'ADMIN';
    v_actor_id   := v_uid::text;
  ELSIF NEW.customer_ref IS NOT NULL AND NEW.customer_ref = v_uid THEN
    v_actor_type := 'CUSTOMER';
    v_actor_id   := v_uid::text;
  ELSE
    v_actor_type := 'RPC';
    v_actor_id   := v_uid::text;
  END IF;

  INSERT INTO public.order_status_history (
    id, order_number, from_status, to_status, changed_at,
    actor_type, actor_id, reason, metadata
  ) VALUES (
    'osh-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999999')
             || '-' || substr(md5(random()::text), 1, 8),
    NEW.order_number,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status,
    NOW(),
    v_actor_type,
    v_actor_id,
    NULLIF(current_setting('app.order_transition_reason', true), ''),
    jsonb_build_object('source', 'order_status_trigger', 'operation', TG_OP, 'order_id', NEW.id)
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_status_history ON public.orders;
CREATE TRIGGER trg_orders_status_history
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.write_order_status_history();

COMMIT;

-- ============================================
-- END OF MIGRATION 040
-- ============================================

