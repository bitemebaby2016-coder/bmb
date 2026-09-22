-- ============================================
-- Bite Me Baby — Migration 027: Canonical Kitchen Batch (PHASE 2 — §17 of implementation command)
-- Date: 2026-09-22 · Design: ORDER_SPINE_DESIGN.md §9 (APPROVED)
--
-- create_production_batch: canonical source = orders + order_items (NEVER pre_orders).
-- Supports SAME_DAY + PRE_ORDER via scheduled_date / delivery_round_id / order_mode
-- (p_order_mode NULL = both modes — preserves the old signature/consumer behavior).
-- Adds order_mode snapshot to production_batch_items; kitchen_queue exposes it.
--
-- ROLLBACK:
--   CREATE OR REPLACE ... recreate 019 versions (git history of 019_kitchen_core.sql);
--   ALTER TABLE public.production_batch_items DROP COLUMN IF EXISTS order_mode;  (in 023 rollback)
-- ============================================

BEGIN;

-- Defensive: remove the legacy 2-arg overload so the canonical 3-arg signature
-- (p_order_mode default NULL = both modes) is the ONLY overload (PostgREST/REVOKE safety).
DROP FUNCTION IF EXISTS public.create_production_batch(text, date);

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
  v_mode text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ROUND';
  END IF;
  IF p_order_mode IS NOT NULL AND p_order_mode NOT IN ('SAME_DAY', 'PRE_ORDER') THEN
    RAISE EXCEPTION 'ERR_INVALID_ORDER_MODE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = p_delivery_round_id) THEN
    RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND';
  END IF;

  v_batch_id := 'batch-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
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
    p_metadata := jsonb_build_object(
      'scheduled_date', p_scheduled_date,
      'order_mode', p_order_mode,
      'items_count', v_items
    )
  );

  RETURN jsonb_build_object('ok', true, 'batch_id', v_batch_id, 'delivery_round_id', p_delivery_round_id, 'items_count', v_items);
END;
$$;

-- kitchen_queue: expose order_mode per item (view compatibility — same signature)
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
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT jsonb_agg(b) INTO v_result FROM (
    SELECT pb.id AS batch_id, pb.delivery_round_id, pb.scheduled_date, pb.status,
           COALESCE(jsonb_agg(jsonb_build_object(
             'item_id', pbi.id, 'order_number', pbi.order_number, 'order_mode', pbi.order_mode,
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

REVOKE EXECUTE ON FUNCTION public.create_production_batch(text, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.kitchen_queue(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_production_batch(text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kitchen_queue(text, date) TO authenticated;

COMMIT;
-- ============================================
-- END OF MIGRATION 027
-- ============================================
