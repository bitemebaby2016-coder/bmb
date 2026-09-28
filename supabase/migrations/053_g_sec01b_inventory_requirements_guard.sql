-- ============================================
-- 053_g_sec01b_inventory_requirements_guard.sql
-- STEP 3A.1 / G-SEC-01b — enforce canonical admin boundary inside
--   public.get_inventory_requirements (migration 019 function).
-- ============================================
-- Finding: migration 019 granted this SECURITY DEFINER function to
--   `authenticated`, but the body only verified `auth.uid() IS NOT NULL`
--   (no `is_admin()`). Any authenticated (non-admin) user could read
--   per-ingredient `current_stock` / `min_stock` for a product's recipe.
--
-- Fix: add `IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'`
--   INSIDE the function (canonical authorization — same as all admin RPCs/RLS).
--
-- No legitimate non-admin workflow calls this (verified): the only caller is
--   src/lib/kitchenService.getInventoryRequirements (Admin/Kitchen domain);
--   no page / customer PWA / Edge Function / order path uses it.
--
-- Unchanged: calculation, return structure, product pricing, stock mutation,
--   order state, kitchen logic, GRANT (kept TO authenticated — Admin frontend
--   uses authenticated JWTs; enforcement is INSIDE the function).
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
  -- G-SEC-01b: canonical admin boundary (was missing).
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
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

-- Grant unchanged (authenticated); authorization enforced inside via is_admin().
REVOKE EXECUTE ON FUNCTION public.get_inventory_requirements FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_requirements TO authenticated;

COMMIT;