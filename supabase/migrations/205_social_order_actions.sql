-- ============================================
-- Bite Me Baby — Migration 205: Social AI order actions + web timeline (R96/R97 closure)
-- Owner directive 2026-11-15: "รวมใช้บริบทเดียวกันทุกช่องทางและรับต่อเนื่องกัน"
-- ============================================
-- 1) cancel_order_as_customer(p_order_number, p_customer_ref, p_reason)
--    ให้ social-ai-worker (service role) ยกเลิกออเดอร์ "แทนลูกค้าที่ระบุตัวตนได้"
--    โดยไม่คัดลอก/ตัดทอน logic กฎเหล็ก: guard ผูกตัวตน (orders.customer_ref =
--    p_customer_ref เท่านั้น) → ตั้ง JWT claims เป็นลูกค้า (transaction-local) →
--    เรียก canonical public.cancel_order (025/195) = release capacity + restore
--    inventory + close payment (void) + audit log ครบทุกขั้น ตาม owner branch:
--    pending-only + cancel window (D-5 default 5 นาที) — ห้าม PATCH orders ตรง
--
-- 2) social_timeline_for_web()
--    ประวัติการคุยข้ามช่องทาง (คอมเมนต์ FB + Messenger) ของลูกค้าที่ล็อกอินบนเว็บ
--    = บริบท "ต่อเนื่องกันทุกช่องทาง" ฝั่งเว็บ (TalkToBite) — เครื่องใหม่ก็ได้บริบท
--    ผ่าน identity map ย้อน: auth.uid → customer_channel_identities.external_user_id
--    → social_events.customer_id (PSID) — คืนข้อความลูกค้า + คำตอบระบบ (truncated)
--
-- Reversible: DROP FUNCTION (additive; no existing table/column touched).
-- ============================================

BEGIN;

-- ---------- 1) cancel_order_as_customer ----------
CREATE OR REPLACE FUNCTION public.cancel_order_as_customer(
  p_order_number text,
  p_customer_ref uuid,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order    public.orders%ROWTYPE;
  v_claims   text;
  v_result   jsonb;
BEGIN
  -- มี JWT claims ของจริงอยู่แล้ว (authenticated เรียกเอง) = ห้ามใช้ทางนี้
  -- (เว็บลูกค้าใช้ cancel_order ตรงมาตั้งแต่ 025 — ทางนี้สำหรับ EF service role เท่านั้น)
  v_claims := COALESCE(current_setting('request.jwt.claims', true), '');
  IF v_claims <> '' AND COALESCE(v_claims::jsonb ->> 'sub', '') <> '' THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;
  IF p_customer_ref IS NULL THEN
    RAISE EXCEPTION 'ERR_MISSING_CUSTOMER';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  -- ผูกตัวตน (ห้ามละเมิดเด็ดขาด): ออเดอร์ต้องเป็นของลูกค้าที่ระบุตัวตนมาเท่านั้น
  IF v_order.customer_ref IS NULL OR v_order.customer_ref <> p_customer_ref THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  -- ตั้ง JWT claims เป็นลูกค้า (transaction-local) → canonical cancel_order ทำงาน
  -- ใน owner branch (pending-only + window + capacity/inventory/payment/audit ครบ)
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_customer_ref::text, 'role', 'authenticated')::text,
    true
  );
  v_result := public.cancel_order(p_order_number, p_reason);

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cancel_order_as_customer FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_as_customer TO service_role;

-- ---------- 2) social_timeline_for_web ----------
CREATE OR REPLACE FUNCTION public.social_timeline_for_web()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_extids  text[];
  v_result  jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT COALESCE(array_agg(external_user_id), '{}') INTO v_extids
    FROM public.customer_channel_identities
   WHERE customer_ref = v_uid;
  IF array_length(v_extids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY received_at ASC), '[]'::jsonb) INTO v_result
    FROM (
      SELECT se.event_type,
             left(COALESCE(se.content, ''), 200)   AS content,
             left(COALESCE(se.ai_reply_text, ''), 200) AS reply,
             se.received_at
        FROM public.social_events se
       WHERE se.customer_id = ANY (v_extids)
         AND se.event_type IN ('comment', 'message')
       ORDER BY se.received_at DESC
       LIMIT 10
    ) r;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.social_timeline_for_web FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_timeline_for_web TO authenticated;

COMMIT;
