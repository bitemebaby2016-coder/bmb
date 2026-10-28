-- ============================================
-- Bite Me Baby — Migration 167: Kitchen batch loop fix (R14 · Owner 2026-10-28)
-- Proven root causes (e2e/r14ProbeA2/C/D-result.json):
--   1) Batch ID แสดงเป็น "###########" — to_char(epoch_ms,'99999999999') ล้น 11 หลัก
--      (epoch ms = 13 หลัก) → Postgres คืน '#' ทั้งแถว → id = 'batch- ###...-md5'
--      (cosmetic แต่ UI slice(5,15) โผล่ '- ##########' ทุกแถว)
--   2) get_kitchen_summary ไม่ส่ง created_at → หน้าครัว new Date(undefined) = "Invalid Date"
--   3) ยืนยันชำระ (confirm_offline_payment) ตั้งแค่ payment_status='paid'
--      "ไม่ hop pending→confirmed" → ครัวกรอง confirmed/preparing = มองไม่เห็นออเดอร์
--      (พิสูจน์: PO-20261028-135 paid 14:08:12 แต่ status ยัง pending → คิวว่าง → batch 3 ใบว่าง)
--   4) kitchen_queue ไม่ส่ง created_at (ให้เท่ากับ summary)
-- Guards: คง server authority เดิม (147: admin|kitchen · 138: admin|staff · 037: admin|kitchen เพิ่ม)
-- ROLLBACK: CREATE OR REPLACE ด้วย body ต้นฉบับ (147 create/kitchen_queue · 037 summary · 138 confirm)
-- ============================================

BEGIN;

-- --------------------------------------------
-- 1) create_production_batch — body = 147 (latest) + id gen แก้ overflow
-- --------------------------------------------
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
  IF NOT (public.is_admin() OR public.is_kitchen()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ROUND';
  END IF;
  IF p_order_mode IS NOT NULL AND p_order_mode NOT IN ('SAME_DAY', 'PRE_ORDER') THEN
    RAISE EXCEPTION 'ERR_INVALID_ORDER_MODE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = p_delivery_round_id) THEN
    RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND';
  END IF;

  -- R14 fix: epoch ms (13 หลัก) ต้องไม่ผ่าน to_char 11 หลัก — ใช้ bigint text ตรง ๆ (ไม่มี space/#)
  v_batch_id := 'batch-' || (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint::text
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

-- --------------------------------------------
-- 2) kitchen_queue — body = 147 (latest) + ส่ง created_at เพิ่ม
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.kitchen_queue(
  p_delivery_round_id text DEFAULT NULL,
  p_scheduled_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT (public.is_admin() OR public.is_kitchen()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT jsonb_agg(b) INTO v_result FROM (
    SELECT pb.id AS batch_id, pb.delivery_round_id, pb.scheduled_date, pb.status, pb.created_at,
           COALESCE(jsonb_agg(jsonb_build_object(
             'item_id', pbi.id, 'order_number', pbi.order_number,
             'product_name', pbi.product_name, 'quantity', pbi.quantity, 'status', pbi.status
           )) FILTER (WHERE pbi.id IS NOT NULL), '[]'::jsonb) AS items
      FROM public.production_batches pb
      LEFT JOIN public.production_batch_items pbi ON pbi.batch_id = pb.id
     WHERE pb.scheduled_date = COALESCE(p_scheduled_date, CURRENT_DATE)
       AND (p_delivery_round_id IS NULL OR pb.delivery_round_id = p_delivery_round_id)
     GROUP BY pb.id, pb.delivery_round_id, pb.scheduled_date, pb.status, pb.created_at
     ORDER BY pb.created_at ASC
  ) b;

  RETURN jsonb_build_object('ok', true, 'batches', COALESCE(v_result, '[]'::jsonb));
END;
$$;

-- --------------------------------------------
-- 3) get_kitchen_summary — body = 037 (latest) + ส่ง created_at + guard admin|kitchen
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.get_kitchen_summary(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_batches jsonb;
  v_pending integer;
  v_ready integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT (public.is_admin() OR public.is_kitchen()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'batch_id', b.id, 'delivery_round_id', b.delivery_round_id,
           'scheduled_date', b.scheduled_date, 'status', b.status,
           'created_at', b.created_at,
           'total_items', b.total_items, 'ready_items', b.ready_items, 'pending_items', b.pending_items)), '[]'::jsonb)
    INTO v_batches
    FROM (
      SELECT pb.id, pb.delivery_round_id, pb.scheduled_date, pb.status, pb.created_at,
             COUNT(pbi.id)::int AS total_items,
             COUNT(*) FILTER (WHERE pbi.status = 'ready')::int AS ready_items,
             COUNT(*) FILTER (WHERE pbi.status IN ('queued','preparing'))::int AS pending_items
        FROM public.production_batches pb
        LEFT JOIN public.production_batch_items pbi ON pbi.batch_id = pb.id
       WHERE pb.scheduled_date = p_date
       GROUP BY pb.id, pb.delivery_round_id, pb.scheduled_date, pb.status, pb.created_at
       ORDER BY pb.created_at ASC
    ) b;

  SELECT
    COALESCE(SUM(CASE WHEN s.status IN ('queued','preparing') THEN s.n ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.status = 'ready' THEN s.n ELSE 0 END), 0)
    INTO v_pending, v_ready
    FROM (
      SELECT pbi.status, COUNT(*) AS n
        FROM public.production_batch_items pbi
        JOIN public.production_batches pb ON pb.id = pbi.batch_id
       WHERE pb.scheduled_date = p_date
       GROUP BY pbi.status
    ) s;

  RETURN jsonb_build_object(
    'ok', true, 'date', p_date::text,
    'total_batches', jsonb_array_length(v_batches),
    'batches', v_batches,
    'summary', jsonb_build_object('pending_orders', v_pending, 'ready_orders', v_ready)
  );
END;
$$;

-- --------------------------------------------
-- 4) confirm_offline_payment — body = 138 (latest) + R14 loop hop:
--    ยืนยันชำระแล้ว (ทั้งแบบ processing→completed และ paid ซ้ำ) ถ้าออเดอร์ยัง pending
--    → transition_order_status('confirmed') = allow-list 030 + audit + INV-01 + notify 161
--    (เดิม: ตั้งแค่ paid → ครัวกรอง confirmed/preparing → มองไม่เห็น = loop ขาด)
--    guard: hop เฉพาะ session is_admin (staff ยืนยันได้เหมือนเดิม = เฉพาะชำระเงิน)
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
  v_idempotent boolean := false;
BEGIN
  IF NOT (public.is_admin() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT payment_status, status, payment_method
    INTO v_paid_status, v_order_status, v_payment_method
    FROM public.orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  IF v_paid_status = 'paid' THEN
    -- เงินเข้าแล้ว (เช่น webhook หรือยืนยันไปก่อนหน้า) — เดิม return ทันทีโดยไม่ปลดล็อกสถานะ
    v_idempotent := true;
  ELSE
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
       ORDER BY (status = 'processing') DESC, created_at DESC
       LIMIT 1;
      IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NO_PAYMENT_INTENT'; END IF;
      IF v_intent_status <> 'processing' THEN RAISE EXCEPTION 'ERR_INTENT_NOT_PROCESSING'; END IF;
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
  END IF;

  -- R14: ยืนยันชำระ = เข้าครัว (pending → confirmed) ผ่าน transition canonical
  IF v_order_status = 'pending' AND public.is_admin() THEN
    PERFORM public.transition_order_status(p_order_number, 'confirmed');
    v_order_status := 'confirmed';
  END IF;

  RETURN jsonb_build_object('ok', true, 'idempotent', v_idempotent, 'order_number', p_order_number,
                            'payment_status', 'paid', 'order_status', v_order_status);
END;
$$;

-- --------------------------------------------
-- 5) Grants (คงสิทธิ์เดิม 027/037/138/158)
-- --------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_production_batch(text, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.kitchen_queue(text, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_kitchen_summary(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_offline_payment(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_production_batch(text, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kitchen_queue(text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_kitchen_summary(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_offline_payment(text) TO authenticated, service_role;

COMMIT;
-- ============================================
-- END OF MIGRATION 167
-- ============================================