-- ============================================
-- Migration 050 — W5-H1: CLOSE ANON ORDERS PII EXPOSURE
-- ============================================
-- Owner decision (W5-1, approved path 1a):
--   ปิด anonymous direct SELECT บน orders ทั้งหมด
--   + /track ใช้ order_number + phone ผ่าน minimal secure RPC
--
-- Scope guard (per W5-1 contract):
--   - READ PATH เท่านั้น: ไม่เปลี่ยน order state / payment / delivery /
--     customer identity / business rules
--   - RPC คืนเพาะ tracking-scope fields — ไม่มี customer_name,
--     customer_phone, dropoff_detail, address, coordinates,
--     payment-sensitive, internal fields
--   - ไม่ใช่ security-by-obscurity: ต้องมี order_number + phone ค่กัน
--     + rate limiting (5 failed / 15 นาที ต่อเบอร)
--   - Anti-enumeration: wrong number / wrong phone / nonexistent
--     คืน response รปร่างเดียวกัน {"found": false}
--
-- REVERSIBLE (downgrade):
--   DROP FUNCTION IF EXISTS public.track_order(text, text);
--   DROP TABLE IF EXISTS public.track_order_attempts;
--   GRANT SELECT ON public.orders TO anon;
--   CREATE POLICY orders_anon_read ON orders FOR SELECT TO anon
--     USING (status IN ('delivered','cancelled'));
-- ============================================

-- 1) ปิด anon direct read บน orders
DROP POLICY IF EXISTS orders_anon_read ON orders;
REVOKE SELECT ON public.orders FROM anon;

-- 2) throttle ledger (RLS deny-all; เข้าถึงได้ผ่าน SECURITY DEFINER เท่านั้น)
CREATE TABLE IF NOT EXISTS public.track_order_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_digits text NOT NULL,
  order_number text NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.track_order_attempts ENABLE ROW LEVEL SECURITY;
-- ไม่สร้าง policy ใดเลย = anon/authenticated อ่าน/เขียนตรงไม่ได้ทั้งหมด
REVOKE ALL ON public.track_order_attempts FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS track_order_attempts_phone_time_idx
  ON public.track_order_attempts (phone_digits, attempted_at);

-- 3) minimal secure tracking read path
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
  -- บังคับพารามิเตอรครบ (ไม่มี path ที่ใช้ order_number เดี่ยว)
  v_digits := COALESCE(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '');
  IF p_order_number IS NULL OR trim(p_order_number) = '' OR v_digits = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- rate limiting: 5 failed attempts / 15 นาที ต่อเบอร
  SELECT count(*) INTO v_fails
    FROM public.track_order_attempts
   WHERE phone_digits = v_digits
     AND ok = false
     AND attempted_at > now() - interval '15 minutes';
  IF v_fails >= 5 THEN
    -- รปร่างเดียวกับ not-found (กัน enumeration oracle)
    RETURN jsonb_build_object('found', false);
  END IF;

  -- lookup: order_number + phone (เทียบเพาะตัวเลข เพื่อกัน format drift)
  SELECT * INTO v_order
    FROM public.orders o
   WHERE o.order_number = trim(p_order_number)
     AND regexp_replace(COALESCE(o.customer_phone, ''), '[^0-9]', '', 'g') = v_digits
   LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.track_order_attempts (phone_digits, order_number, ok)
    VALUES (v_digits, trim(p_order_number), false);
    RETURN jsonb_build_object('found', false);
  END IF;

  INSERT INTO public.track_order_attempts (phone_digits, order_number, ok)
  VALUES (v_digits, trim(p_order_number), true);

  -- tracking-scope fields ONLY — no PII / no address / no coordinates
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

GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.track_order(text, text) FROM public;
