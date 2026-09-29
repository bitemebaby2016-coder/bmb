-- ============================================
-- Bite Me Baby — Migration 054: Kitchen READY_TO_MAKE gate (STEP 3B-2C)
-- Owner decision (approved): Option A — canonical server-side gate RPC.
--   order_ready_to_make(p_order_number) returns READY/NOT_READY + reason codes.
--   The state machine (008/030 + transition_order_status 019) REMAINS the sole
--   transition authority; this gate NEVER mutates anything (pure read).
-- Canonical semantics (from real schema — NOT inferred):
--   orders.payment_method  ∈ {'promptpay_qr','credit_card','cash_on_delivery'} (nullable TEXT)
--   orders.payment_status  CHECK IN ('pending','paid','refund')  (migration 035)
--   → 'failed'/'processing'/'partially_refunded' do NOT exist on orders; any
--     non-(paid | COD+pending) state is NOT_READY by the allow-list below.
-- Payment policy (Owner-approved canonical):
--   credit_card      → READY only when payment_status = 'paid'
--   promptpay_qr     → READY only when payment_status = 'paid'
--   cash_on_delivery → READY when 'pending' or 'paid' (settled at delivery);
--                      never when 'refund' or terminal-invalid state
-- ROLLBACK: DROP FUNCTION IF EXISTS public.order_ready_to_make(text);
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.order_ready_to_make(p_order_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_order public.orders%ROWTYPE;
  v_today date;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ready', false, 'reason_code', 'ORDER_NOT_FOUND');
  END IF;

  -- 1. Canonical spine + non-terminal
  IF v_order.status IN ('cancelled', 'failed', 'delivered') THEN
    RETURN jsonb_build_object('ready', false, 'reason_code', 'TERMINAL_STATE',
      'status', v_order.status);
  END IF;
  -- 2. Prep window only: confirmed (start) / preparing (already started)
  IF v_order.status NOT IN ('confirmed', 'preparing') THEN
    RETURN jsonb_build_object('ready', false, 'reason_code', 'INVALID_ORDER_STATE',
      'status', v_order.status);
  END IF;

  -- 3. Commercial gate — by REAL payment method source field (never inferred
  --    from payment_status alone, per Owner §3)
  IF v_order.payment_status = 'refund' THEN
    RETURN jsonb_build_object('ready', false, 'reason_code', 'PAYMENT_REFUNDED');
  END IF;
  IF v_order.payment_method = 'cash_on_delivery' THEN
    -- COD: 'pending' allowed (settled at delivery); 'paid' also fine (pre-paid COD)
    IF v_order.payment_status NOT IN ('pending', 'paid') THEN
      RETURN jsonb_build_object('ready', false, 'reason_code', 'PAYMENT_NOT_READY',
        'payment_status', v_order.payment_status);
    END IF;
  ELSE
    -- credit_card / promptpay_qr / unknown-or-null method: require canonical paid
    IF v_order.payment_status IS DISTINCT FROM 'paid' THEN
      RETURN jsonb_build_object('ready', false, 'reason_code',
        CASE WHEN v_order.payment_method IS NULL OR trim(coalesce(v_order.payment_method,'')) = ''
             THEN 'PAYMENT_METHOD_UNKNOWN' ELSE 'PAYMENT_NOT_PAID' END,
        'payment_status', v_order.payment_status,
        'payment_method', v_order.payment_method);
    END IF;
  END IF;

  -- 4. Order content: non-empty, quantity > 0, producible reference
  IF NOT EXISTS (
    SELECT 1 FROM public.order_items oi
     WHERE oi.order_id = v_order.id
       AND oi.quantity > 0
       AND (oi.product_id IS NOT NULL OR coalesce(oi.product_name, '') <> '')
  ) THEN
    RETURN jsonb_build_object('ready', false, 'reason_code', 'EMPTY_ORDER');
  END IF;
  -- 5. Product validity (backend-supported only: FK-anchored product rows)
  IF EXISTS (
    SELECT 1 FROM public.order_items oi
     LEFT JOIN public.products pr ON pr.id = oi.product_id
     WHERE oi.order_id = v_order.id
       AND oi.product_id IS NOT NULL AND pr.id IS NULL
  ) THEN
    RETURN jsonb_build_object('ready', false, 'reason_code', 'PRODUCT_INVALID');
  END IF;

  -- 6. Schedule from DB (server clock ONLY — Asia/Bangkok canonical zone per 025)
  v_today := (NOW() AT TIME ZONE 'Asia/Bangkok')::date;
  IF v_order.order_mode = 'PRE_ORDER' THEN
    IF v_order.scheduled_date IS NULL THEN
      RETURN jsonb_build_object('ready', false, 'reason_code', 'MISSING_SCHEDULE');
    END IF;
    IF v_order.scheduled_date < v_today THEN
      RETURN jsonb_build_object('ready', false, 'reason_code', 'SCHEDULE_PAST_DUE');
    END IF;
  END IF;
  -- SAME_DAY: no extra rule — operational gates already server-side (025/038).

  RETURN jsonb_build_object(
    'ready', true,
    'order_number', p_order_number,
    'status', v_order.status,
    'order_mode', v_order.order_mode,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'scheduled_date', v_order.scheduled_date,
    'delivery_round_id', v_order.delivery_round_id,
    'checked_at', NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.order_ready_to_make(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_ready_to_make(text) TO authenticated;

COMMIT;
-- ============================================
-- Migration 054 — end. (Read-only gate: no data mutation, no audit spam.)
-- ============================================
