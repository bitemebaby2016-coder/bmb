-- ============================================
-- Bite Me Baby — Migration 195: cancel ปิด payment_status จริง (void) + backfill
-- Owner 2026-11-08 (RT-3.4 follow-up ของ D1): "ปิดให้จริง ถูกต้อง อย่างซื่อสัตย์"
-- ============================================
-- ต้องรัน "หลัง" 194_payment_status_void_enum.sql (คนละครั้งกันใน SQL Editor)
-- ทำ 2 อย่าง:
--   1) CREATE OR REPLACE cancel_order (025) — เพิ่มขั้นตอนปิด payment_status:
--      ยกเลิกแล้ว + ไม่มีหลักฐานเงินเข้า (intent processing/completed) + ยังค้าง
--      pending → ตั้งเป็น 'void' ทันทีใน transaction เดียวกัน
--      · paid คงเดิม (refund = admin follow-up ตามเดิม)
--      · มีหลักฐานสลิปค้าง (processing) → คง pending ให้แอดมินตรวจเอง (ไม่กล้า void)
--   2) backfill ของเดิม: ออเดอร์ cancelled + pending ย้อนหลังทั้งหมด (เงื่อนไขเดียวกัน)
--      + audit log ต่อรายการ
-- ============================================

-- ---------- 1) cancel_order — canonical body (025) + payment close ----------
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_number text,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid;
  v_order      public.orders%ROWTYPE;
  v_is_admin   boolean;
  v_is_owner   boolean;
  v_window_min numeric;
  v_today      date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_pay_closed boolean := false;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  v_is_admin := public.is_admin();
  v_is_owner := (v_order.customer_ref IS NOT NULL AND v_order.customer_ref = v_uid);
  IF NOT v_is_admin AND NOT v_is_owner THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', 'cancelled', 'idempotent', true);
  END IF;

  -- authorization rules (canonical policy, both modes)
  v_window_min := public.order_setting('cancel_window_minutes', 5);
  IF v_is_admin THEN
    IF v_order.status = 'delivered' THEN
      RAISE EXCEPTION 'ERR_ORDER_TERMINAL';
    END IF;
  ELSE
    -- owner: pending only, inside cancel window (D-5, default 5 min)
    IF v_order.status <> 'pending' THEN
      RAISE EXCEPTION 'ERR_CANCEL_WINDOW_PASSED';
    END IF;
    v_window_min := public.order_setting('cancel_window_minutes', 5);
    IF EXTRACT(EPOCH FROM (NOW() - v_order.created_at)) / 60.0 > v_window_min THEN
      RAISE EXCEPTION 'ERR_CANCEL_WINDOW_PASSED';
    END IF;
    IF v_order.order_mode = 'PRE_ORDER' AND v_order.scheduled_date IS NOT NULL
       AND v_order.scheduled_date <= v_today THEN
      RAISE EXCEPTION 'ERR_CANCEL_WINDOW_PASSED';
    END IF;
  END IF;

  -- state transition (allow-list re-checked by guard trigger) → capacity release via trigger
  UPDATE public.orders
     SET status = 'cancelled', updated_at = NOW()
   WHERE order_number = p_order_number;

  -- R84 (Owner 2026-11-08): ปิดสถานะชำระเงินให้ซื่อสัตย์ — ยกเลิกแล้ว = ไม่มีอะไร
  -- ให้รอ (เดิมคอลัมน์ค้าง 'pending' = pill ⏳ pending โกหกในหน้า Manage Orders)
  IF v_order.payment_status = 'pending'
     AND NOT EXISTS (
       SELECT 1 FROM public.payment_intents pi
        WHERE pi.order_number = p_order_number
          AND pi.status IN ('processing', 'completed')
     ) THEN
    UPDATE public.orders SET payment_status = 'void', updated_at = NOW()
     WHERE order_number = p_order_number;
    v_pay_closed := true;
    PERFORM public.append_audit_log(
      'payment_voided', 'order', p_order_number,
      'cancel: no payment captured → payment_status closed as void (not paid)',
      jsonb_build_object('payment_status', 'void', 'from', 'pending', 'admin', v_uid)
    );
  END IF;

  -- inventory restore (only if the order ever reached confirmed/preparing = deducted)
  IF v_order.status IN ('confirmed', 'preparing') THEN
    PERFORM public.restore_inventory_for_order(p_order_number);
  END IF;

  -- delivery assignment cancel (if any, not yet delivered)
  UPDATE public.delivery_assignments
     SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
   WHERE order_number = p_order_number
     AND status NOT IN ('delivered', 'cancelled');

  PERFORM public.append_audit_log(
    p_action := 'order_cancelled',
    p_entity_type := 'order',
    p_entity_id := p_order_number,
    p_description := 'order cancelled by ' || CASE WHEN v_is_admin THEN 'admin' ELSE 'owner' END,
    p_metadata := jsonb_build_object(
      'from_status', v_order.status::text,
      'order_mode', v_order.order_mode::text,
      'payment_status', (SELECT o.payment_status::text FROM public.orders o WHERE o.order_number = p_order_number),
      'payment_closed_void', v_pay_closed,
      'reason', COALESCE(NULLIF(trim(p_reason), ''), 'not specified')
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_number', p_order_number,
    'status', 'cancelled',
    'order_mode', v_order.order_mode::text,
    'previous_status', v_order.status::text,
    'capacity_released', v_order.delivery_round_id IS NOT NULL,
    'inventory_restored', v_order.status IN ('confirmed', 'preparing'),
    'payment_status', (SELECT o.payment_status::text FROM public.orders o WHERE o.order_number = p_order_number),
    'note', CASE WHEN v_order.payment_status = 'paid'
                 THEN 'order was paid — refund via stripe-refund EF is an admin follow-up'
                 WHEN v_pay_closed THEN 'no payment captured — payment_status closed as void'
                 ELSE 'no payment captured (kept pending: payment evidence exists, admin must review)' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order TO authenticated;

-- ---------- 2) backfill ของเดิม (cancelled + pending ย้อนหลัง) ----------
-- เงื่อนไขเดียวกับฝั่ง cancel: ไม่มีหลักฐานเงินเข้า (intent processing/completed)
DO $$
DECLARE r RECORD;
        v_n integer := 0;
BEGIN
  FOR r IN
    SELECT o.order_number FROM public.orders o
     WHERE o.status = 'cancelled'
       AND o.payment_status = 'pending'
       AND NOT EXISTS (
         SELECT 1 FROM public.payment_intents pi
          WHERE pi.order_number = o.order_number
            AND pi.status IN ('processing', 'completed')
       )
  LOOP
    UPDATE public.orders
       SET payment_status = 'void', updated_at = NOW()
     WHERE order_number = r.order_number;
    PERFORM public.append_audit_log(
      'payment_voided', 'order', r.order_number,
      'backfill 195: cancelled order with stale pending payment closed as void (no capture evidence)',
      jsonb_build_object('payment_status', 'void', 'from', 'pending', 'source', 'migration_195')
    );
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE 'migration 195: closed stale pending payment as void for % order(s)', v_n;
END $$;

