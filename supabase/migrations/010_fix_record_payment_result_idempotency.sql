-- ============================================
-- Bite Me Baby — Migration 010: record_payment_result idempotency fix
-- Date: 2026-09-19 (STRIPE GATE live finding)
--
-- PROBLEM (live evidence):
--   create-checkout pre-inserts the payment_intents row and (until 009/008-era
--   code) pre-set `payment_intent_id`. record_payment_result's replay guard was
--   `WHERE payment_intent_id = p_payment_intent_id` — i.e. it treated ANY existing
--   row with that id as an idempotent replay. Result: the FIRST legitimate webhook
--   delivery looked like a duplicate, the UPDATE never ran, and orders stayed
--   'pending' forever while the EF still returned HTTP 200.
--
-- FIX:
--   A row only counts as an already-RECORDED result when its status is terminal
--   ('completed' | 'failed'). A still-'pending' row (created at checkout) falls
--   through to the normal update path. Replays of a terminal result keep the
--   idempotent short-circuit.
--   (Companion fix in supabase/functions/create-checkout/index.ts: the EF now
--   inserts payment_intent_id = NULL and lets the webhook set it.)
-- Idempotent: safe to re-run.
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

  UPDATE public.payment_intents
     SET status            = p_status,
         payment_intent_id = COALESCE(payment_intent_id, p_payment_intent_id),
         amount            = p_amount,
         currency          = p_currency,
         failure_reason    = COALESCE(p_failure_reason, failure_reason),
         completed_at      = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
         updated_at        = NOW()
   WHERE order_number      = p_order_number;

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

-- Re-assert grants (idempotent)
REVOKE EXECUTE ON FUNCTION public.record_payment_result FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_result TO service_role;

COMMIT;

-- ============================================
-- END OF MIGRATION 010
-- ============================================