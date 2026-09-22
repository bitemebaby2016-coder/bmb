-- ============================================
-- Bite Me Baby — Migration 028: Payment → Confirm → Inventory → Kitchen guarantees (PHASE 3A)
-- Date: 2026-09-22 · Baseline: 36a3a3c · Design: ORDER_SPINE_DESIGN.md @ 6cffbe5
--
-- 1) CONFIRMATION ATOMICITY GUARANTEE (brief §5):
--    transition_order_status (019) already deducts inside its own transaction, but a
--    DIRECT table UPDATE of orders.status='confirmed' (admin RLS allows it; the guard
--    trigger validates only the allow-list) could confirm WITHOUT deduction.
--    New AFTER trigger makes "confirmed ⇒ inventory deducted" a DATABASE invariant:
--    any path that sets status→confirmed deducts (idempotent) in the same transaction;
--    insufficient stock blocks the confirmation entirely.
-- 2) DUPLICATE BATCH PROTECTION (brief §9):
--    intended lifecycle = a batch is a snapshot of confirmed/preparing orders of one
--    round+date that are NOT YET in any batch of that same round+date. Re-batching
--    picks up only NEW orders (kitchen never receives the same order twice).
--    Implemented as a source filter (NOT a blind unique constraint).
-- 3) ROUND TEMPLATE HARDENING (brief §14 — verify-only scope, minimal guard):
--    ensure_rounds_for_date now clones only ACTIVE templates and also validates
--    delivery_start/delivery_end presence, so an admin-deactivated or broken
--    template can never be instantiated into an active round.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS orders_ensure_deduct_on_confirm ON public.orders;
--   DROP FUNCTION IF EXISTS public.ensure_inventory_deducted_on_confirm();
--   (create_production_batch / ensure_rounds_for_date: recreate จากไฟล์ 027/024)
-- ============================================

BEGIN;

-- ============================================
-- 1. confirmed ⇒ deducted (database invariant, idempotent)
-- ============================================
CREATE OR REPLACE FUNCTION public.ensure_inventory_deducted_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    -- deduct_inventory_for_order is idempotent (skips if 'auto-deduct%' rows exist)
    -- and RAISES ERR_INSUFFICIENT_INGREDIENT — which rolls back the confirmation.
    PERFORM public.deduct_inventory_for_order(NEW.order_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_ensure_deduct_on_confirm ON public.orders;
CREATE TRIGGER orders_ensure_deduct_on_confirm
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.ensure_inventory_deducted_on_confirm();

COMMIT;
-- ============================================
-- Migration 028 (ต่อ) — batch idempotency + round template hardening
-- ============================================

BEGIN;

-- 2. create_production_batch — idempotent per order (no duplicate production)
CREATE OR REPLACE FUNCTION public.create_production_batch(
  p_delivery_round_id text,
  p_scheduled_date date DEFAULT CURRENT_DATE,
  p_order_mode text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_batch_id text;
  v_items integer;
  v_row record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ROUND';
  END IF;
  IF p_order_mode IS NOT NULL AND p_order_mode NOT IN ('SAME_DAY', 'PRE_ORDER') THEN
    RAISE EXCEPTION 'ERR_INVALID_ORDER_MODE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = p_delivery_round_id) THEN
    RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND';
  END IF;

  v_batch_id := 'batch-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
                || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.production_batches (id, delivery_round_id, scheduled_date, status, created_by, created_at, updated_at)
  VALUES (v_batch_id, p_delivery_round_id, p_scheduled_date, 'open', v_uid, NOW(), NOW());

  v_items := 0;
  FOR v_row IN
    SELECT o.id AS order_id, o.order_number, o.order_mode,
           oi.product_id, oi.product_name, SUM(oi.quantity) AS qty
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
     WHERE o.delivery_round_id = p_delivery_round_id
       AND o.scheduled_date = p_scheduled_date
       AND (p_order_mode IS NULL OR o.order_mode::text = p_order_mode)
       AND o.status IN ('confirmed', 'preparing')
       -- PHASE 3A: never hand the same order to the kitchen twice for this round+date
       AND NOT EXISTS (
         SELECT 1 FROM public.production_batch_items pbi
          JOIN public.production_batches pb2 ON pb2.id = pbi.batch_id
         WHERE pbi.order_id = o.id
           AND pb2.delivery_round_id = p_delivery_round_id
           AND pb2.scheduled_date = p_scheduled_date
       )
     GROUP BY o.id, o.order_number, o.order_mode, oi.product_id, oi.product_name
  LOOP
    INSERT INTO public.production_batch_items (
      id, batch_id, order_id, order_number, product_id, product_name, quantity, order_mode, status, created_at
    ) VALUES (
      'pbi-' || v_batch_id || '-' || v_items,
      v_batch_id, v_row.order_id, v_row.order_number,
      v_row.product_id, v_row.product_name, v_row.qty, v_row.order_mode, 'queued', NOW()
    );
    v_items := v_items + 1;
  END LOOP;

  PERFORM public.append_audit_log(
    p_action := 'batch_created',
    p_entity_type := 'production_batch',
    p_entity_id := v_batch_id,
    p_description := 'production batch created (round ' || p_delivery_round_id || ', ' || v_items || ' items)',
    p_metadata := jsonb_build_object('scheduled_date', p_scheduled_date, 'order_mode', p_order_mode, 'items_count', v_items)
  );

  RETURN jsonb_build_object('ok', true, 'batch_id', v_batch_id, 'delivery_round_id', p_delivery_round_id, 'items_count', v_items);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_production_batch(text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_production_batch(text, date, text) TO authenticated;

COMMIT;
-- ============================================
-- Migration 028 (ต่อ) — round template hardening (§14: verify-only scope, minimal guard)
-- ROLLBACK: recreate ensure_rounds_for_date จากไฟล์ 024
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_rounds_for_date(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_key text;
  v_tpl public.delivery_rounds%ROWTYPE;
  v_id text;
  v_rounds jsonb;
BEGIN
  IF p_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_DATE'; END IF;
  IF p_date < v_today THEN RAISE EXCEPTION 'ERR_DATE_IN_PAST'; END IF;
  IF p_date > v_today + 30 THEN RAISE EXCEPTION 'ERR_DATE_TOO_FAR'; END IF;

  FOREACH v_key IN ARRAY ARRAY['morning','midday','evening'] LOOP
    -- PHASE 3A hardening: only an ACTIVE round may serve as a template — an
    -- admin-deactivated or closed round must never be re-instantiated as active.
    SELECT * INTO v_tpl
      FROM public.delivery_rounds
     WHERE COALESCE(round_key, name) = v_key
       AND status = 'active'
     ORDER BY scheduled_date DESC NULLS LAST, created_at DESC
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ERR_ROUND_TEMPLATE_MISSING: %', v_key;
    END IF;
    -- validate the template is operationally complete (no stale/degenerate clone)
    IF v_tpl.cutoff_time IS NULL OR v_tpl.max_capacity IS NULL OR v_tpl.max_capacity <= 0
       OR v_tpl.delivery_start IS NULL OR v_tpl.delivery_end IS NULL
       OR v_tpl.delivery_end <= v_tpl.delivery_start THEN
      RAISE EXCEPTION 'ERR_ROUND_TEMPLATE_INVALID: %', v_key;
    END IF;

    v_id := 'round-' || to_char(p_date, 'YYYYMMDD') || '-' || v_key;
    INSERT INTO public.delivery_rounds (
      id, round_key, name, display_name, cutoff_time, delivery_start, delivery_end,
      max_capacity, current_count, date, scheduled_date, status
    ) VALUES (
      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time, v_tpl.delivery_start,
      v_tpl.delivery_end, v_tpl.max_capacity, 0, p_date, p_date, 'active'
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'round_key', r.round_key, 'display_name', r.display_name,
           'scheduled_date', r.scheduled_date, 'cutoff_time', r.cutoff_time,
           'delivery_start', r.delivery_start, 'delivery_end', r.delivery_end,
           'max_capacity', r.max_capacity, 'current_count', r.current_count, 'status', r.status
         ) ORDER BY r.delivery_start), '[]'::jsonb)
    INTO v_rounds
    FROM public.delivery_rounds r
   WHERE r.scheduled_date = p_date AND r.status = 'active';

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'rounds', v_rounds);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_rounds_for_date(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_rounds_for_date(date) TO authenticated;

COMMIT;
-- ============================================
-- Migration 028 (ต่อ) — record_payment_result: single-attempt targeting (PHASE 3A §10 live finding)
--
-- LIVE BUG (caught by contract_028 T8): with a retried payment the order has 2 intent
-- rows (failed attempt + new attempt). The 010 UPDATE blanket-set
-- payment_intent_id on ALL rows of the order → unique index
-- uq_payment_intents_provider_id violation → the retry webhook 500s and the order
-- can never become 'paid'.
-- FIX: update exactly ONE row — the row already carrying this payment_intent_id,
-- else the oldest unattached (payment_intent_id IS NULL) attempt of the order.
-- Idempotency pre-check (010) unchanged.
-- ROLLBACK: recreate record_payment_result จากไฟล์ 010
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.record_payment_result(
  p_order_number text,
  p_payment_intent_id text,
  p_amount numeric,
  p_currency text DEFAULT 'thb',
  p_status text DEFAULT 'completed',
  p_failure_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_total numeric;
  v_existing text;
  v_new_payment_status text;
  v_target_id text;
BEGIN
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;
  IF p_payment_intent_id IS NULL OR trim(p_payment_intent_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_PAYMENT_INTENT_ID';
  END IF;

  -- Idempotency (010): only a terminal result recorded for this PaymentIntent
  -- short-circuits. A still-pending row (created by create-checkout) must NOT
  -- look like a replay, otherwise the first real webhook delivery never applies.
  SELECT status INTO v_existing
    FROM public.payment_intents
   WHERE payment_intent_id = p_payment_intent_id
     AND status IN ('completed', 'failed');
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'order_number', p_order_number,
      'payment_status', (SELECT payment_status FROM public.orders WHERE order_number = p_order_number),
      'intent_status', v_existing
    );
  END IF;

  -- Authoritative amount check.
  SELECT total_amount INTO v_order_total
    FROM public.orders
   WHERE order_number = p_order_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND';
  END IF;
  IF COALESCE(p_amount, -1) <> v_order_total THEN
    RAISE EXCEPTION 'ERR_AMOUNT_MISMATCH';
  END IF;

  v_new_payment_status := CASE
    WHEN p_status = 'completed' THEN 'paid'
    WHEN p_status = 'failed'    THEN 'pending'
    ELSE 'pending'
  END;

  -- PHASE 3A: target EXACTLY ONE attempt row (never blanket-update the order's rows,
  -- never violate uq_payment_intents_provider_id on retried payments).
  SELECT id INTO v_target_id
    FROM public.payment_intents
   WHERE order_number = p_order_number
     AND (payment_intent_id = p_payment_intent_id OR payment_intent_id IS NULL)
   ORDER BY (payment_intent_id = p_payment_intent_id) DESC, created_at ASC
   LIMIT 1;
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'ERR_NO_PAYMENT_INTENT';
  END IF;

  UPDATE public.payment_intents
     SET status            = p_status,
         payment_intent_id = COALESCE(payment_intent_id, p_payment_intent_id),
         amount            = p_amount,
         currency          = p_currency,
         failure_reason    = COALESCE(p_failure_reason, failure_reason),
         completed_at      = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
         updated_at        = NOW()
   WHERE id = v_target_id;

  UPDATE public.orders
     SET payment_status = v_new_payment_status::payment_status,
         updated_at     = NOW()
   WHERE order_number = p_order_number;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'order_number', p_order_number,
    'payment_status', v_new_payment_status
  );
END;
$$;

-- Re-assert grants (unchanged: webhook/service only)
REVOKE EXECUTE ON FUNCTION public.record_payment_result FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_result TO service_role;

COMMIT;
-- ============================================
-- END OF MIGRATION 028
-- ============================================
