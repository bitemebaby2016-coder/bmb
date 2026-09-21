-- ============================================
-- Bite Me Baby — Migration 019: Kitchen Core (INV-01, INV-02, KIT-01, KIT-02)
-- Date: 2026-09-21
-- Phase: PHASE 2 (KITCHEN)
--
-- Implements:
--   KIT-02  recipes (BOM): product -> ingredient -> quantity_per_unit
--   KIT-01  production_batches + production_batch_items (per round work queue)
--   INV-01  inventory auto-deduct at order CONFIRM + auto-restore at CANCEL/FAIL
--           (server-side, idempotent, audited via inventory_transactions)
--   INV-02  auto sold-out: when an ingredient drops below min_stock all products
--           whose recipe uses it are flipped is_available=false (marked), and
--           restore flips them back when stock recovers.
--
-- Security: SECURITY DEFINER + SET search_path = public.
--   deduct/restore EXECUTE authenticated only (guard is_admin inside).
--   kitchen_queue EXECUTE authenticated only (guard is_admin inside).
-- Idempotent: safe to re-run.
-- ============================================

BEGIN;

-- ============================================
-- 1. Recipes (BOM) — KIT-02
-- ============================================
CREATE TABLE IF NOT EXISTS public.recipes (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id     TEXT NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  quantity_per_unit NUMERIC(10, 4) NOT NULL DEFAULT 1 CHECK (quantity_per_unit > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, ingredient_id)
);

-- ============================================
-- 2. Production batches — KIT-01
-- ============================================
CREATE TABLE IF NOT EXISTS public.production_batches (
  id               TEXT PRIMARY KEY,
  delivery_round_id TEXT REFERENCES public.delivery_rounds(id) ON DELETE SET NULL,
  scheduled_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'in_progress', 'ready', 'done', 'cancelled')),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.production_batch_items (
  id           TEXT PRIMARY KEY,
  batch_id     TEXT NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  order_id     TEXT NOT NULL,
  order_number TEXT NOT NULL,
  product_id   TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status       TEXT NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued', 'preparing', 'ready')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pbi_batch ON public.production_batch_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_pbi_round ON public.production_batches (delivery_round_id, scheduled_date);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batch_items ENABLE ROW LEVEL SECURITY;

-- Recipes: anon read (public menu/availability), admin write.
DROP POLICY IF EXISTS recipes_anon_read ON public.recipes;
CREATE POLICY recipes_anon_read ON public.recipes
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS recipes_admin ON public.recipes;
CREATE POLICY recipes_admin ON public.recipes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Batches: admin read/write
DROP POLICY IF EXISTS batches_admin ON public.production_batches;
CREATE POLICY batches_admin ON public.production_batches
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS batch_items_admin ON public.production_batch_items;
CREATE POLICY batch_items_admin ON public.production_batch_items
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================
-- 3. RPC: deduct_inventory_for_order — INV-01 (auto-deduct at confirm)
-- ============================================
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_order(p_order_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_item record;
  v_ingr record;
  v_deducted boolean;
  v_done_ids text[] := '{}';
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  -- Idempotency guard: never deduct the same order twice.
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_transactions
     WHERE reference_type = 'order' AND reference_id = p_order_number
       AND notes LIKE 'auto-deduct%'
  ) INTO v_deducted;
  IF v_deducted THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order_number', p_order_number);
  END IF;

  -- Per order item -> per recipe ingredient -> deduct stock (transactional).
  FOR v_item IN
    SELECT oi.product_id, oi.quantity FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.order_number = p_order_number
  LOOP
    FOR v_ingr IN
      SELECT r.ingredient_id, r.quantity_per_unit FROM public.recipes r
       WHERE r.product_id = v_item.product_id
    LOOP
      IF NOT (v_ingr.ingredient_id = ANY(v_done_ids)) THEN
        UPDATE public.inventory
           SET current_stock = GREATEST(current_stock - v_item.quantity * v_ingr.quantity_per_unit, 0),
               updated_at = NOW()
         WHERE id = v_ingr.ingredient_id;

        INSERT INTO public.inventory_transactions (
          id, inventory_id, type, quantity, reference_type, reference_id, notes, created_by, created_at
        ) VALUES (
          'itx-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 6),
          v_ingr.ingredient_id, 'out', v_item.quantity * v_ingr.quantity_per_unit,
          'order', p_order_number, 'auto-deduct', v_uid::text, NOW()
        );

        -- INV-02: below min_stock -> auto sold-out products using this ingredient.
        IF (SELECT current_stock < min_stock FROM public.inventory WHERE id = v_ingr.ingredient_id) THEN
          UPDATE public.products p
             SET is_available = false, updated_at = NOW()
           WHERE p.id IN (SELECT product_id FROM public.recipes WHERE ingredient_id = v_ingr.ingredient_id);

          INSERT INTO public.inventory_transactions (
            id, inventory_id, type, quantity, reference_type, reference_id, notes, created_by, created_at
          ) VALUES (
            'itx-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 6),
            v_ingr.ingredient_id, 'adjustment', 0,
            'sold_out_auto', v_ingr.ingredient_id, 'auto sold-out (below min_stock)', v_uid::text, NOW()
          );
        END IF;

        v_done_ids := array_append(v_done_ids, v_ingr.ingredient_id);
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'order_number', p_order_number);
END;
$$;

-- ============================================
-- 4. RPC: restore_inventory_for_order — INV-01 (cancel/fail refund)
-- ============================================
CREATE OR REPLACE FUNCTION public.restore_inventory_for_order(p_order_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tx record;
  v_had_deduct boolean;
  v_ingr public.inventory%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.inventory_transactions
     WHERE reference_type = 'order' AND reference_id = p_order_number
       AND notes LIKE 'auto-deduct%'
  ) INTO v_had_deduct;

  IF NOT v_had_deduct THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order_number', p_order_number, 'restored_amount', 0);
  END IF;

  FOR v_tx IN
    SELECT inventory_id, quantity FROM public.inventory_transactions
     WHERE reference_type = 'order' AND reference_id = p_order_number
       AND notes LIKE 'auto-deduct%'
  LOOP
    UPDATE public.inventory
       SET current_stock = current_stock + v_tx.quantity, updated_at = NOW()
     WHERE id = v_tx.inventory_id;
  END LOOP;

  DELETE FROM public.inventory_transactions
   WHERE reference_type = 'order' AND reference_id = p_order_number
     AND notes LIKE 'auto-deduct%';

  -- Recover availability for products whose ingredients are all >= min_stock again.
  FOR v_ingr IN
    SELECT i.id
      FROM public.inventory i
      JOIN (SELECT DISTINCT inventory_id FROM public.inventory_transactions
             WHERE reference_type = 'sold_out_auto') m ON m.inventory_id = i.id
     WHERE i.current_stock >= i.min_stock
  LOOP
    UPDATE public.products p
       SET is_available = true, updated_at = NOW()
     WHERE p.id IN (SELECT product_id FROM public.recipes WHERE ingredient_id = v_ingr.id)
       AND p.id IN (
         SELECT r2.product_id FROM public.recipes r2
          JOIN public.inventory i2 ON i2.id = r2.ingredient_id
         GROUP BY r2.product_id
         HAVING bool_and(i2.current_stock >= i2.min_stock)
       );

    DELETE FROM public.inventory_transactions
     WHERE reference_type = 'sold_out_auto' AND inventory_id = v_ingr.id;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'order_number', p_order_number, 'restored_amount', 1);
END;
$$;

-- ============================================
-- 5. RPC: create_production_batch — KIT-01 (group confirmed/preparing orders per round)
-- ============================================
CREATE OR REPLACE FUNCTION public.create_production_batch(
  p_delivery_round_id text,
  p_scheduled_date date DEFAULT CURRENT_DATE
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
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ROUND';
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
    SELECT o.id AS order_id, o.order_number, oi.product_id, oi.product_name, sum(oi.quantity) AS qty
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
     WHERE o.delivery_round_id = p_delivery_round_id
       AND o.status IN ('confirmed', 'preparing')
     GROUP BY o.id, o.order_number, oi.product_id, oi.product_name
  LOOP
    INSERT INTO public.production_batch_items (
      id, batch_id, order_id, order_number, product_id, product_name, quantity, status, created_at
    ) VALUES (
      'pbi-' || v_batch_id || '-' || v_items,
      v_batch_id, v_row.order_id, v_row.order_number,
      v_row.product_id, v_row.product_name, v_row.qty, 'queued', NOW()
    );
    v_items := v_items + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'batch_id', v_batch_id, 'delivery_round_id', p_delivery_round_id, 'items_count', v_items);
END;
$$;

-- ============================================
-- 6. RPC: kitchen_queue — KIT-01 (batches + items for a round/date)
-- ============================================
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

-- ============================================
-- 7. RPC: get_inventory_requirements — KIT-02 (recipe => requirement for a product)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_inventory_requirements(
  p_product_id text,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_req jsonb;
  v_qty integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  v_qty := GREATEST(COALESCE(p_quantity, 1), 1);

  SELECT jsonb_agg(x) INTO v_req FROM (
    SELECT i.id AS ingredient_id, i.name AS ingredient_name, i.unit,
           r.quantity_per_unit, (r.quantity_per_unit * v_qty) AS required,
           i.current_stock, i.min_stock,
           (i.current_stock >= r.quantity_per_unit * v_qty) AS feasible
      FROM public.recipes r
      JOIN public.inventory i ON i.id = r.ingredient_id
     WHERE r.product_id = p_product_id
  ) x;

  RETURN jsonb_build_object(
    'ok', true,
    'product_id', p_product_id,
    'quantity', v_qty,
    'feasible', NOT EXISTS (
      SELECT 1 FROM public.recipes r JOIN public.inventory i ON i.id = r.ingredient_id
       WHERE r.product_id = p_product_id AND i.current_stock < r.quantity_per_unit * v_qty
    ),
    'requirements', COALESCE(v_req, '[]'::jsonb)
  );
END;
$$;

-- ============================================
-- 8. EXECUTE permission — authenticated (admin-guarded inside)
-- ============================================
REVOKE EXECUTE ON FUNCTION public.deduct_inventory_for_order FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_inventory_for_order FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_production_batch FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.kitchen_queue FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_inventory_requirements FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.deduct_inventory_for_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_inventory_for_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_production_batch TO authenticated;
GRANT EXECUTE ON FUNCTION public.kitchen_queue TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inventory_requirements TO authenticated;

-- ============================================
-- 9. Seed demo recipes (prod-1..4 vs inventory ing-1..4)
-- ============================================
INSERT INTO public.recipes (id, product_id, ingredient_id, quantity_per_unit) VALUES
  ('rcp-1', 'prod-1', 'ing-1', 0.25),
  ('rcp-2', 'prod-1', 'ing-3', 1),
  ('rcp-3', 'prod-2', 'ing-2', 0.15),
  ('rcp-4', 'prod-2', 'ing-1', 0.2),
  ('rcp-5', 'prod-3', 'ing-2', 0.2),
  ('rcp-6', 'prod-4', 'ing-4', 0.05)
ON CONFLICT (product_id, ingredient_id) DO NOTHING;

-- ============================================
-- 9b. Hook INV-01 into transition_order_status: deduct at CONFIRM, restore at CANCEL/FAIL
-- ============================================
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_number text,
  p_new_status public.order_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_old public.order_status;
  v_customer_ref uuid;
  v_is_admin boolean;
  v_is_owner boolean;
  v_inv jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT status, customer_ref INTO v_old, v_customer_ref
    FROM public.orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  v_is_admin := public.is_admin();
  v_is_owner := (v_customer_ref IS NOT NULL AND v_customer_ref = v_uid);

  IF NOT public.order_transition_allowed(v_old::text, p_new_status::text, v_is_admin, v_is_owner) THEN
    RAISE EXCEPTION 'ERR_INVALID_TRANSITION: % -> %', v_old::text, p_new_status::text;
  END IF;

  UPDATE public.orders SET status = p_new_status, updated_at = NOW()
   WHERE order_number = p_order_number;

  PERFORM public.append_audit_log(
    p_action := 'order_status_change',
    p_entity_type := 'order',
    p_entity_id := p_order_number,
    p_description := 'order status ' || v_old::text || ' -> ' || p_new_status::text,
    p_metadata := jsonb_build_object('from', v_old::text, 'to', p_new_status::text)
  );

  -- INV-01 (Phase 2): commit raw material at CONFIRM; refund it on CANCEL/FAIL (from non-terminal).
  IF p_new_status = 'confirmed' THEN
    v_inv := public.deduct_inventory_for_order(p_order_number);
  ELSIF p_new_status IN ('cancelled', 'failed') AND v_old IN ('confirmed', 'preparing') THEN
    v_inv := public.restore_inventory_for_order(p_order_number);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_number', p_order_number,
    'from', v_old::text,
    'to', p_new_status::text,
    'inventory', v_inv
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_order_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_order_status TO authenticated;

-- ============================================
-- DONE
-- ============================================
COMMIT;

-- ============================================
-- END OF MIGRATION 019
-- ============================================