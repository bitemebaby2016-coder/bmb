-- ============================================================
-- Bite Me Baby — Migration 191: ปิดคลาส UTC date ที่เหลือ (คิวครัวผิดวัน 00:00-07:00 ICT)
-- Date: 2026-11-06 · Owner สั่ง: "ทำเรื่องค้างทั้งหมด" (ข้อ ① kitchen UTC defaults)
--
-- Context: fn ครัว 3 ตัว (m167 = latest) + table defaults 2 จุด ยัง fallback เป็น
--   CURRENT_DATE (UTC session) = ช่วง 00:00-07:00 ICT คิวครัว/สรุปครัว/สร้าง batch
--   มองเป็น "เมื่อวาน UTC" = คิวว่าง/ผิดวัน (time-bomb คลาสเดียวกับที่ m186/m190 ปิดไป)
--
-- FIX = 3 fn body VERBATIM จาก 167_kitchen_batch_loop_fix.sql (สร้างด้วย e2e/ci/_r73e_mk191.cjs)
--   เปลี่ยนเฉพาะ 4 บรรทัดวันที่ (default x3 + COALESCE x1) -> (now() AT TIME ZONE 'Asia/Bangkok')::date
--   + ALTER COLUMN scheduled_date SET DEFAULT (BKK) 2 ตาราง (fallback เดียวกัน · ทุกเส้น insert
--     ส่งวันที่ explicit อยู่แล้ว = metadata-only ไม่เปลี่ยนพฤติกรรมของ caller)
--   (assertion/business rule/grant คงเดิมทุกประการ)
-- Evidence: e2e/_r73e_verify_progress.log (stage 2 prosrc/proargdefaults audit = 0 ทั้ง schema)
-- ============================================================
BEGIN;
CREATE OR REPLACE FUNCTION public.create_production_batch(
  p_delivery_round_id text,
  p_scheduled_date date DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date,
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
CREATE OR REPLACE FUNCTION public.kitchen_queue(
  p_delivery_round_id text DEFAULT NULL,
  p_scheduled_date date DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date
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
     WHERE pb.scheduled_date = COALESCE(p_scheduled_date, (now() AT TIME ZONE 'Asia/Bangkok')::date)
       AND (p_delivery_round_id IS NULL OR pb.delivery_round_id = p_delivery_round_id)
     GROUP BY pb.id, pb.delivery_round_id, pb.scheduled_date, pb.status, pb.created_at
     ORDER BY pb.created_at ASC
  ) b;

  RETURN jsonb_build_object('ok', true, 'batches', COALESCE(v_result, '[]'::jsonb));
END;
$$;
CREATE OR REPLACE FUNCTION public.get_kitchen_summary(
  p_date date DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date
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
-- ---- table defaults: fallback วันที่เดียวกัน (ทุก insert path ส่งค่า explicit อยู่แล้ว) ----
ALTER TABLE public.delivery_rounds ALTER COLUMN scheduled_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date);
ALTER TABLE public.production_batches ALTER COLUMN scheduled_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date);

COMMIT;
