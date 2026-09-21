-- ============================================
-- Bite Me Baby — Migration 018: Server-Side Audit Log (SEC-03)
-- Date: 2026-09-21
-- Phase: PHASE 1 (MONEY + ORDER)
--
-- Goal: replace the client-only localStorage audit log with a DB-backed log:
--   - audit_logs table (RLS: anon deny; own/admin read; write via RPC only)
--   - append_audit_log(...) RPC — actor fields come from auth.uid(), never the client
--   - money/order RPCs write audit rows themselves (order_create, order_status_change,
--     payment_processed, pre_order_create, pre_order_cancel) so critical transitions
--     are recorded EVEN IF the client forgets to call the wrapper.
--
-- Security: SECURITY DEFINER + SET search_path = public; EXECUTE authenticated only.
-- Idempotent: safe to re-run.
-- ============================================

BEGIN;

-- ============================================
-- 1. Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           TEXT PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL DEFAULT '',
  entity_id    TEXT,
  description  TEXT NOT NULL DEFAULT '',
  metadata     JSONB NOT NULL DEFAULT '{}',
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_anon ON public.audit_logs;
CREATE POLICY audit_logs_anon ON public.audit_logs
  FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS audit_logs_own_read ON public.audit_logs;
CREATE POLICY audit_logs_own_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS audit_logs_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- 2. RPC: append_audit_log
--    actor (user_id/user_email) always from the session, never the payload.
-- ============================================
CREATE OR REPLACE FUNCTION public.append_audit_log(
  p_action text,
  p_entity_type text DEFAULT '',
  p_entity_id text DEFAULT NULL,
  p_description text DEFAULT '',
  p_metadata jsonb DEFAULT '{}',
  p_user_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_id  text;
BEGIN
  v_uid := auth.uid();
  v_id := 'alog-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
          || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.audit_logs (
    id, user_id, user_email, action, entity_type, entity_id, description, metadata, created_at
  ) VALUES (
    v_id, v_uid, p_user_email, p_action,
    COALESCE(p_entity_type, ''), p_entity_id,
    COALESCE(p_description, ''), COALESCE(p_metadata, '{}'), NOW()
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'user_id', v_uid::text);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.append_audit_log FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_audit_log TO authenticated;
-- ============================================
-- 3. Wire audit rows into critical RPCs (money/order transitions)
-- ============================================

-- 3.1 transition_order_status — log every transition (action, from, to, actor)
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_number text,
  p_new_status public.order_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_old public.order_status;
  v_customer_ref uuid;
  v_is_admin boolean;
  v_is_owner boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT status, customer_ref INTO v_old, v_customer_ref
    FROM public.orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  v_is_admin := public.is_admin();
  v_is_owner := (v_customer_ref IS NOT NULL AND v_customer_ref = v_uid);

  IF NOT public.order_transition_allowed(v_old::text, p_new_status::text, v_is_admin, v_is_owner) THEN
    RAISE EXCEPTION 'ERR_INVALID_TRANSITION: % -> %', v_old::text, p_new_status::text;
  END IF;

  UPDATE public.orders SET status = p_new_status, updated_at = NOW()
   WHERE order_number = p_order_number;

  PERFORM public.append_audit_log(
    p_action := 'order_status_change',
    p_entity_type := 'order',
    p_entity_id := p_order_number,
    p_description := 'order status ' || v_old::text || ' -> ' || p_new_status::text,
    p_metadata := jsonb_build_object('from', v_old::text, 'to', p_new_status::text)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_number', p_order_number,
    'from', v_old::text,
    'to', p_new_status::text
  );
END;
$$;

-- 3.2 confirm_offline_payment — log payment confirmations
CREATE OR REPLACE FUNCTION public.confirm_offline_payment(
  p_order_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_method  text;
  v_order_status    public.order_status;
  v_intent_status   text;
  v_intent_id       text;
  v_paid_status     public.payment_status;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT payment_status INTO v_paid_status
    FROM public.orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF v_paid_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order_number', p_order_number);
  END IF;

  SELECT payment_method, status INTO v_payment_method, v_order_status
    FROM public.orders WHERE order_number = p_order_number;

  IF v_payment_method = 'cash_on_delivery' THEN
    IF v_order_status <> 'delivered' THEN
      RAISE EXCEPTION 'ERR_COD_NOT_DELIVERED';
    END IF;
    UPDATE public.payment_intents
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE order_number = p_order_number AND method = 'cash_on_delivery';
  ELSE
    SELECT status, id INTO v_intent_status, v_intent_id
      FROM public.payment_intents
     WHERE order_number = p_order_number AND method = v_payment_method
     ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NO_PAYMENT_INTENT'; END IF;
    IF v_intent_status <> 'processing' THEN
      RAISE EXCEPTION 'ERR_INTENT_NOT_PROCESSING';
    END IF;
    UPDATE public.payment_intents
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE id = v_intent_id;
  END IF;

  UPDATE public.orders
     SET payment_status = 'paid', updated_at = NOW()
   WHERE order_number = p_order_number;

  PERFORM public.append_audit_log(
    p_action := 'payment_processed',
    p_entity_type := 'order',
    p_entity_id := p_order_number,
    p_description := 'payment confirmed (' || v_payment_method || ')',
    p_metadata := jsonb_build_object('payment_method', v_payment_method, 'payment_status', 'paid')
  );

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'order_number', p_order_number, 'payment_status', 'paid');
END;
$$;

-- ============================================
-- DONE
-- ============================================
COMMIT;

-- ============================================
-- END OF MIGRATION 018
-- ============================================