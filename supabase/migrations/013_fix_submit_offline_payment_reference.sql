-- ============================================
-- Bite Me Baby — Migration 013: fix submit_offline_payment_reference reference casting
-- Date: 2026-09-19 (found via full E2E — order created, TXN submit failed)
--
-- BUG (live evidence 2026-09-19):
--   old body: jsonb_set(COALESCE(metadata,'{}'), '{reference}', (trim(p_reference))::jsonb)
--   → casting a plain alphanumeric ref like "TXN-20260919-..." to jsonb raises
--     22P02 "invalid input syntax for type json" (only pure numeric/JSON text parsed),
--     so PromptPay refs with letters failed with HTTP 400 and the customer could not
--     progress (order stuck pending). Pure-numeric real refs happened to work.
--
-- FIX: use to_jsonb(trim(p_reference)) — stores the ref as a proper JSON string.
--
-- ROLE: OWNER applies in the Supabase SQL Editor (dev has no DB password).
-- IDEMPOTENT: safe to re-run.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.submit_offline_payment_reference(
  p_order_number text,
  p_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' OR p_reference IS NULL OR trim(p_reference) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_REFERENCE';
  END IF;

  UPDATE public.payment_intents
     SET status     = 'processing',
         metadata   = jsonb_set(COALESCE(metadata, '{}'), '{reference}', to_jsonb(trim(p_reference))),
         updated_at = NOW()
   WHERE order_number = p_order_number
     AND method = 'promptpay_qr'
     AND status = 'pending'
     AND EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = p_order_number AND o.customer_ref = v_uid);

  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NO_PENDING_PROMPTPAY'; END IF;

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'intent_status', 'processing');
END;
$$;

-- Re-assert grants (idempotent) — authenticated only (same as before).
REVOKE EXECUTE ON FUNCTION public.submit_offline_payment_reference FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_offline_payment_reference TO authenticated;

COMMIT;

-- ============================================
-- END OF MIGRATION 013
-- ============================================