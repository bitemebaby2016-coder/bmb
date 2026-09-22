-- ============================================
-- Bite Me Baby — Migration 026: Inventory Deduct Fix (G-03) — PHASE 2 initial inventory correction
-- Date: 2026-09-22 · Design: ORDER_SPINE_DESIGN.md §7 (APPROVED)
--
-- FIXES:
--   1) v_done_ids dedup bug: item A and item B using the SAME ingredient were
--      deduced only ONCE per order. Now requirements are AGGREGATED per ingredient
--      across all order items (A=2 + B=3 → deduct 5).
--   2) GREATEST(current_stock - req, 0) silently under-deducted. Now:
--      requires current_stock >= req, otherwise ERR_INSUFFICIENT_INGREDIENT —
--      the whole confirmation transaction fails (no partial deduction, no negative stock).
--   3) Ingredient rows are locked FOR UPDATE (concurrency-safe deduction).
--   4) INV-02 auto sold-out runs once after aggregation (unchanged semantics).
--
-- Timing model preserved (design §15): CREATE = advisory only; CONFIRM = authoritative.
-- restore_inventory_for_order already restores exactly from inventory_transactions
-- and deletes them — unchanged, works for both modes because canonical orders.
--
-- ROLLBACK: recreate the 019 version (aggregate-by-order bug version) — body kept in
-- git history `supabase/migrations/019_kitchen_core.sql`; no schema change here.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.deduct_inventory_for_order(p_order_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid;
  v_tx       record;
  v_had_deduct boolean;
  v_agg      record;
  v_ing      public.inventory%ROWTYPE;
  v_sold_out text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  -- idempotent: already deducted → no-op (same contract as 019)
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_transactions
     WHERE reference_type = 'order' AND reference_id = p_order_number
       AND notes LIKE 'auto-deduct%'
  ) INTO v_had_deduct;
  IF v_had_deduct THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order_number', p_order_number);
  END IF;

  -- AGGREGATED requirement per ingredient across ALL order items of the order
  -- (fixes the v_done_ids skip: same ingredient used by several items = summed)
  FOR v_agg IN
    SELECT r.ingredient_id, SUM(oi.quantity * r.quantity_per_unit) AS req
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      JOIN public.recipes r ON r.product_id = oi.product_id
     WHERE o.order_number = p_order_number
     GROUP BY r.ingredient_id
  LOOP
    SELECT * INTO v_ing FROM public.inventory WHERE id = v_agg.ingredient_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ERR_INGREDIENT_MISSING: %', v_agg.ingredient_id;
    END IF;

    -- INVARIANT 4: no silent under-deduct, no negative stock, no partial deduction
    IF v_ing.current_stock < v_agg.req THEN
      RAISE EXCEPTION 'ERR_INSUFFICIENT_INGREDIENT: %', v_ing.name;
    END IF;

    UPDATE public.inventory
       SET current_stock = current_stock - v_agg.req, updated_at = NOW()
     WHERE id = v_agg.ingredient_id;

    INSERT INTO public.inventory_transactions (
      id, inventory_id, type, quantity, reference_type, reference_id, notes, created_by, created_at
    ) VALUES (
      'itx-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 6),
      v_agg.ingredient_id, 'out', v_agg.req,
      'order', p_order_number, 'auto-deduct', v_uid::text, NOW()
    );

    -- INV-02: below min_stock → auto sold-out products using this ingredient (once, after aggregation)
    IF v_ing.current_stock - v_agg.req < v_ing.min_stock THEN
      UPDATE public.products p
         SET is_available = false, updated_at = NOW()
       WHERE p.id IN (SELECT product_id FROM public.recipes WHERE ingredient_id = v_agg.ingredient_id);

      INSERT INTO public.inventory_transactions (
        id, inventory_id, type, quantity, reference_type, reference_id, notes, created_by, created_at
      ) VALUES (
        'itx-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 6),
        v_agg.ingredient_id, 'adjustment', 0,
        'sold_out_auto', v_agg.ingredient_id, 'auto sold-out (below min_stock)', v_uid::text, NOW()
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'order_number', p_order_number);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_inventory_for_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_inventory_for_order TO authenticated;

COMMIT;
-- ============================================
-- END OF MIGRATION 026
-- ============================================
