-- ============================================
-- Migration 051 — W5-2 fix: track_order phone normalization (E.164 vs local)
-- ============================================
-- FINDING (W5-2 QA verify, 2026-09-28):
--   phone-auto-login stores auth phone in E.164 (+66…), Thai customers type
--   local format (099…). track_order compared digits-only, so +66990000001
--   (stored) ≠ 0990000001 (typed) → legitimate tracking failed.
-- FIX: canonicalize BOTH sides to Thai E.164 digits: 0XXXXXXXXX → 66XXXXXXXXX.
-- Read-only, no state change, reversible (re-apply migration 050 function body).
-- ============================================
CREATE OR REPLACE FUNCTION public.track_order(
  p_order_number text,
  p_phone text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_digits text;
  v_fails integer;
  v_items jsonb;
  v_intent record;
BEGIN
  v_digits := COALESCE(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '');
  -- canonicalize Thai local (09…) → E.164 digits (669…)
  IF length(v_digits) = 10 AND left(v_digits, 1) = '0' THEN
    v_digits := '66' || substr(v_digits, 2);
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' OR v_digits = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT count(*) INTO v_fails
    FROM public.track_order_attempts
   WHERE phone_digits = v_digits
     AND ok = false
     AND attempted_at > now() - interval '15 minutes';
  IF v_fails >= 5 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_order
    FROM public.orders o
   WHERE o.order_number = trim(p_order_number)
     AND (
       regexp_replace(COALESCE(o.customer_phone, ''), '[^0-9]', '', 'g') = v_digits
       -- stored 0XXXXXXXXX → 66XXXXXXXXX (same canonicalization both sides)
       OR ('66' || substr(regexp_replace(COALESCE(o.customer_phone, ''), '[^0-9]', '', 'g'), 2)) = v_digits
         AND length(regexp_replace(COALESCE(o.customer_phone, ''), '[^0-9]', '', 'g')) = 10
         AND left(regexp_replace(COALESCE(o.customer_phone, ''), '[^0-9]', '', 'g'), 1) = '0'
     )
   LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.track_order_attempts (phone_digits, order_number, ok)
    VALUES (v_digits, trim(p_order_number), false);
    RETURN jsonb_build_object('found', false);
  END IF;

  INSERT INTO public.track_order_attempts (phone_digits, order_number, ok)
  VALUES (v_digits, trim(p_order_number), true);

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'product_id', i.product_id,
             'product_name', i.product_name,
             'quantity', i.quantity,
             'unit_price', i.unit_price
           ) ORDER BY i.created_at), '[]'::jsonb)
    INTO v_items
    FROM public.order_items i
   WHERE i.order_id = v_order.id;

  SELECT pi.receipt_url, pi.status AS intent_status
    INTO v_intent
    FROM public.payment_intents pi
   WHERE pi.order_number = v_order.order_number
   ORDER BY pi.created_at DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'found', true,
    'order', jsonb_build_object(
      'order_number', v_order.order_number,
      'status', v_order.status,
      'order_mode', v_order.order_mode,
      'payment_status', v_order.payment_status,
      'delivery_method', v_order.delivery_method,
      'delivery_round_id', v_order.delivery_round_id,
      'scheduled_date', v_order.scheduled_date,
      'total_amount', v_order.total_amount,
      'created_at', v_order.created_at,
      'receipt_url', v_intent.receipt_url
    ),
    'items', v_items
  );
END;
$$;

-- keep grants identical to 050
REVOKE ALL ON FUNCTION public.track_order(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated;
