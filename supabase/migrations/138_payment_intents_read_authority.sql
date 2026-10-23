-- ============================================
-- Bite Me Baby — Migration 138: payment_intents read authority (D-08 · P0-1)
-- Date: 2026-10-23 · Owner decision: Option A — SECURITY DEFINER read RPC
--   (canonical model from 034: "access via SECURITY DEFINER RPC / views only"
--    — ไม่ทำ GRANT SELECT แบบกว้างตาม Option B)
-- ============================================
-- WHY (evidence 2026-10-23 · docs/BMB_RECOVERY_PLAN_2026-10-23.md D-08):
--   034:88 REVOKE ALL ON payment_intents FROM authenticated และไม่มี GRANT คืน
--   ในทุก migration หลังจากนั้น → probe จริง has_table_privilege('authenticated',
--   'payment_intents','SELECT') = false → ทุก client read `from('payment_intents')`
--   โดน permission denied แล้วเงียบ error คืน [] → แผงตรวจสลิปบอด (ปุ่ม disabled
--   ทุกแถว) + dedupe (R1.2) ตาบอด → intent ซ้ำจริง 2 แถว/ออเดอร์ (841/205)
--   + confirm_offline_payment แบบ created_at DESC LIMIT 1 อาจเจอแถว 'completed'
--   จากคู่ซ้ำ → ERR_INTENT_NOT_PROCESSING ทั้งที่มีหลักฐาน
--
-- WHAT:
--   1. get_payment_intents_for_orders(...) — SECURITY DEFINER read RPC
--      scope: admin/staff = ทุกแถวที่ขอ · customer = เฉพาะออเดอร์ตัวเอง
--      (orders.customer_ref = auth.uid()) · anon = ERR_NOT_AUTHENTICATED
--   2. create_payment_intent_record — server-side dedupe: ห้ามมี ACTIVE intent
--      (pending/processing) ที่สองสำหรับ (order_number, method) — คืนแถวเดิม
--      (idempotent=true) · concurrent race โดน unique index ด้านล่าง แล้วคืนแถวเดิม
--   3. uq_payment_intents_active_order_method — partial unique index (fail-loud:
--      ถ้ามี ACTIVE ซ้ำอยู่ก่อน apply จะหยุดด้วย ERR_ACTIVE_INTENT_DUPLICATES
--      เพื่อเสนอ data repair ก่อน — ห้ามลบ/merge payment records อัตโนมัติ)
--   4. confirm_offline_payment — เลือกแถว 'processing' (แถวที่มีหลักฐาน) ก่อน
--      เสมอ ไม่ใช่ created_at DESC แบบตาบอด + คืน audit log (restore ที่ 018 เคยมี
--      แต่ 129 ทำหลุดไปตอน copy 008) — behavior อื่นคงเดิมทุกประการ (staff ยืนยันได้)
-- ============================================

BEGIN;

-- --------------------------------------------
-- 1. Read RPC (canonical access path — ไม่แตะ GRANT ของตาราง)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payment_intents_for_orders(
  p_order_numbers text[]     DEFAULT NULL,
  p_intent_id     text       DEFAULT NULL,
  p_status        text       DEFAULT NULL,
  p_created_from  timestamptz DEFAULT NULL,
  p_created_to    timestamptz DEFAULT NULL
)
RETURNS SETOF public.payment_intents
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_staff boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  v_staff := public.is_admin() OR public.is_staff();

  RETURN QUERY
    SELECT pi.*
      FROM public.payment_intents pi
     WHERE (p_intent_id IS NULL OR pi.id = p_intent_id)
       AND (p_order_numbers IS NULL OR pi.order_number = ANY(p_order_numbers))
       AND (p_status IS NULL OR pi.status = p_status)
       AND (p_created_from IS NULL OR pi.created_at >= p_created_from)
       AND (p_created_to IS NULL OR pi.created_at <= p_created_to)
       AND (
         v_staff
         OR EXISTS (
           SELECT 1 FROM public.orders o
            WHERE o.order_number = pi.order_number
              AND o.customer_ref = v_uid
         )
       )
     ORDER BY pi.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_payment_intents_for_orders FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payment_intents_for_orders TO authenticated, service_role;

COMMENT ON FUNCTION public.get_payment_intents_for_orders IS
  'D-08 (migration 138): canonical READ path for payment_intents (table stays REVOKE''d per 034). admin/staff see requested rows; customers see only their own orders'' rows.';

-- --------------------------------------------
-- 2. create_payment_intent_record — server-side dedupe (B5/B10)
--    (signature เดิม 008 ทุกตัวอักษร — เฉพาะ body)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.create_payment_intent_record(
  p_order_number text,
  p_amount numeric,
  p_method payment_method DEFAULT 'promptpay_qr',
  p_provider text DEFAULT 'promptpay',
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_order_total numeric;
  v_pi_id text;
  v_is_admin boolean;
  v_existing public.payment_intents%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  v_is_admin := public.is_admin();
  SELECT total_amount INTO v_order_total
    FROM public.orders
   WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF NOT v_is_admin AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE order_number = p_order_number AND customer_ref = v_uid
  ) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF v_order_total IS DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'ERR_AMOUNT_MISMATCH';
  END IF;

  -- R3 (D-08): dedupe ฝั่ง server — ห้ามมี ACTIVE intent ที่สองสำหรับ
  -- (order_number, method) — เดิม dedupe อยู่ฝั่ง client ที่อ่าน from('payment_intents')
  -- ซึ่งโดน REVOKE → ตาบอด → intent ซ้ำจริง (841/205)
  SELECT * INTO v_existing
    FROM public.payment_intents
   WHERE order_number = p_order_number
     AND method = p_method::text
     AND status IN ('pending', 'processing')
   ORDER BY created_at DESC
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'order_number', v_existing.order_number,
      'amount', v_existing.amount,
      'status', v_existing.status,
      'method', v_existing.method,
      'idempotent', true
    );
  END IF;

  v_pi_id := 'pi-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
             || '-' || substr(md5(random()::text), 1, 6);

  BEGIN
    INSERT INTO public.payment_intents (
      id, order_number, amount, currency, status, method, provider, metadata, created_at, updated_at
    ) VALUES (
      v_pi_id, p_order_number, p_amount, 'thb', 'pending', p_method::text, p_provider, COALESCE(p_metadata, '{}'), NOW(), NOW()
    );
  EXCEPTION WHEN unique_violation THEN
    -- concurrent duplicate (uq_payment_intents_active_order_method) — คืนแถวที่ชนะ
    SELECT * INTO v_existing
      FROM public.payment_intents
     WHERE order_number = p_order_number
       AND method = p_method::text
       AND status IN ('pending', 'processing')
     ORDER BY created_at DESC
     LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'order_number', v_existing.order_number,
        'id', v_existing.id,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'method', v_existing.method,
        'idempotent', true
      );
    END IF;
    RAISE;
  END;

  RETURN jsonb_build_object(
    'id', v_pi_id,
    'order_number', p_order_number,
    'amount', p_amount,
    'status', 'pending',
    'method', p_method::text,
    'idempotent', false
  );
END;
$$;

-- --------------------------------------------
-- 3. Partial unique index — ดัก intent ซ้ำที่สถานะ ACTIVE ใต้ concurrency
--    fail-loud guard: ถ้าของจริงมี ACTIVE ซ้ำอยู่แล้ว → หยุดเพื่อเสนอ data repair
--    (ห้ามลบ/merge payment records โดยไม่มีแผนและ Owner approval)
-- --------------------------------------------
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(order_number || '/' || method || ' x' || cnt, ', ')
    INTO v_bad
    FROM (
      SELECT order_number, method, count(*) AS cnt
        FROM public.payment_intents
       WHERE status IN ('pending', 'processing')
       GROUP BY 1, 2
      HAVING count(*) > 1
    ) d;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_ACTIVE_INTENT_DUPLICATES: % — data repair (Owner-approved) required before uq_payment_intents_active_order_method', v_bad;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_active_order_method
  ON public.payment_intents (order_number, method)
  WHERE status IN ('pending', 'processing');

-- --------------------------------------------
-- 4. confirm_offline_payment — prefer the 'processing' intent (evidence row)
--    + restore append_audit_log (018 behavior ที่ 129 ทำหลุด) · guard อื่นคงเดิม
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_offline_payment(
  p_order_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_method text;
  v_order_status public.order_status;
  v_intent_status text;
  v_intent_id text;
  v_paid_status public.payment_status;
BEGIN
  IF NOT (public.is_admin() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
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
    -- R3 (D-08): แถว 'processing' (มีหลักฐานแล้ว) ต้องมาก่อนเสมอ — เดิม
    -- created_at DESC LIMIT 1 ตาบอด → คู่ซ้ำ (processing + completed) ทำให้เจอ
    -- แถว 'completed' → ERR_INTENT_NOT_PROCESSING ทั้งที่ยืนยันได้จริง
    SELECT status, id INTO v_intent_status, v_intent_id
      FROM public.payment_intents
     WHERE order_number = p_order_number AND method = v_payment_method
     ORDER BY (status = 'processing') DESC, created_at DESC
     LIMIT 1;
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

REVOKE EXECUTE ON FUNCTION public.confirm_offline_payment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_offline_payment TO authenticated;

COMMIT;