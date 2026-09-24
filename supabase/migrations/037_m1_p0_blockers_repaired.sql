-- ============================================
-- Bite Me Baby — Migration 037: M1 closure P0 blockers — REPAIRED (PRE-02)
-- Date: 2026-09-24 · Baseline: ed5f955 · Scope: owner directive PRE-02
--
-- WHY:
--   Migration 035 is CORRUPTED and was never applied to production:
--   - dollar-quotes `AS $$` / `DO $$` replaced by literal paths (`d:\A PROJECT\...`)
--     and stray `}` characters (lines 33/106/121/134/144/154/249/276/317/336/359/372/395)
--   - one malformed aggregate (L304-308)
--   - Thai string mojibake (L103)
--   - list_drivers() references columns that do NOT exist:
--     drivers.driver_name/phone_number/max_capacity + delivery_assignments.driver_phone
--     (real schema 020: drivers.name/phone, delivery_assignments.driver_id)
--   - validate_pre_order_delivery() checks orders.delivery_address — column does not exist
--     (real column: dropoff_detail)
--   Production probes (2026-09-24): compute_delivery_fee exists WITHOUT the 5km gate;
--   list_drivers/get_kitchen_summary/list_recipes_with_inventory/validate_pre_order_delivery
--   DO NOT EXIST → admin pages (DeliveryManagement/AdminKitchen/Recipes) call RPCs that 404.
--
-- 035 PART RESOLUTION:
--   Part 1 (5km self-delivery gate)  → REQUIRED, repaired here (Part A).
--   Part 2 (payment_status column)   → SUPERSEDED — orders.payment_status already live (025).
--   Part 2 (pre-order address)       → REQUIRED, repaired (dropoff_detail only — no
--                                      delivery_address column) (Part B).
--   Part 3 (audit RLS)               → SUPERSEDED — audit_logs already has 3 policies (018),
--                                      verified anon-deny in M1 security review.
--   Part 4 (get_all_orders_for_admin)→ SKIPPED — no client caller found (grep src/ = 0);
--                                      do not expand RPC surface without a consumer.
--   Part 5 (get_kitchen_summary)     → REQUIRED, rewritten clean to match
--                                      KitchenQueueResponse (bmbAdminApi_kitchen.ts) (Part C).
--   Part 6 (list_drivers)            → REQUIRED, schema-corrected, output aliased to
--                                      DriverRow (driver_name/phone_number); max_capacity
--                                      has no backing column → returned as NULL (UI falls
--                                      back to 5, DeliveryManagement L31) (Part D).
--   Part 6 (list_recipes_with_inventory) → REQUIRED, repaired (inventory table, not
--                                      the non-existent "ingredients") (Part E).
--
-- AFFECTED TABLES: none (functions + 1 trigger only). orders untouched at rest.
-- SECURITY IMPACT: none negative — no RLS change; all RPCs SECURITY DEFINER with
--   explicit auth.uid()/is_admin() checks; EXECUTE granted to authenticated only.
-- ROLLBACK / SAFETY: single transaction, CREATE OR REPLACE + DROP/CREATE TRIGGER only;
--   re-run safe. Rollback = restore pre-037 function bodies (live def captured in
--   this session) + drop trigger trg_pre_order_address_check.
-- DEPENDENCIES: 005 (is_admin), 018 (audit), 020 (drivers/assignments/fee_rpc), 024 (rounds).
-- PRODUCTION VERIFICATION: e2e/contracts_037_p0_blockers_repaired.sql (BEGIN...ROLLBACK).
-- ============================================

BEGIN;

-- ============================================
-- Part A. compute_delivery_fee — LIVE body (probed 2026-09-24) + 5km gate
-- Contract preserved: RETURNS numeric (rpc wrapper 020 unchanged).
-- Gate raises SELF_DELIVERY_EXCEEDS_5KM_LIMIT → order creation (025 L251 calls
-- this function server-side) is blocked for self_delivery > 5km.
-- ============================================
CREATE OR REPLACE FUNCTION public.compute_delivery_fee(
  p_dropoff_latitude numeric,
  p_dropoff_longitude numeric,
  p_delivery_method text DEFAULT 'self_delivery',
  p_items_count integer DEFAULT 1,
  p_distance_km numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dist    numeric;
  v_fee     numeric;
  v_kitchen jsonb;
  v_method  text := COALESCE(p_delivery_method, 'self_delivery');
BEGIN
  IF p_distance_km IS NOT NULL AND p_distance_km > 0 THEN
    v_dist := p_distance_km;
  ELSIF p_dropoff_latitude IS NOT NULL AND p_dropoff_longitude IS NOT NULL THEN
    v_kitchen := public.kitchen_location();
    v_dist := public.haversine_km(
      (v_kitchen->>'latitude')::numeric, (v_kitchen->>'longitude')::numeric,
      p_dropoff_latitude, p_dropoff_longitude
    );
  ELSE
    v_dist := 0;
  END IF;

  -- P0 #5: server-side 5km self-delivery gate (035 Part 1 intent, repaired)
  IF v_method = 'self_delivery' AND v_dist > 5 THEN
    RAISE EXCEPTION 'SELF_DELIVERY_EXCEEDS_5KM_LIMIT: %', v_dist;
  END IF;

  SELECT fee INTO v_fee
    FROM public.delivery_zones
   WHERE is_active = true
     AND v_dist >= min_distance_km
     AND v_dist <= max_distance_km
   ORDER BY max_distance_km ASC
   LIMIT 1;

  IF v_fee IS NOT NULL THEN
    RETURN v_fee;
  END IF;

  -- Fallback: legacy per-method formula (kept until all zones are seeded).
  IF v_method = 'grab_rider' THEN
    RETURN LEAST(40 + v_dist * 8 + COALESCE(p_items_count, 1) * 2, 9999);
  ELSIF v_method = 'linemen_rider' THEN
    RETURN LEAST(35 + v_dist * 7 + COALESCE(p_items_count, 1) * 2, 9999);
  ELSIF v_method = 'foodpanda_rider' THEN
    RETURN LEAST(38 + v_dist * 7.5 + COALESCE(p_items_count, 1) * 2, 9999);
  END IF;
  RETURN LEAST(30 + v_dist * 4 + COALESCE(p_items_count, 1) * 2, 9999);
END;
$$;

-- ============================================
-- Part B. PRE_ORDER address mandatory (035 Part 2 intent, repaired)
-- Real column: dropoff_detail (no delivery_address on orders).
-- Status-only updates do NOT fire this trigger (UPDATE OF listed columns).
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_pre_order_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_mode::text = 'PRE_ORDER'
     AND COALESCE(NEW.dropoff_detail, '') = '' THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_REQUIRES_ADDRESS: Pre-order requires a delivery address';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pre_order_address_check ON public.orders;

-- ============================================
-- Part C. get_kitchen_summary(date) — matches KitchenQueueResponse
-- (bmbAdminApi_kitchen.ts): batches[] + summary counts.
-- ============================================
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
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'batch_id', b.id, 'delivery_round_id', b.delivery_round_id,
           'scheduled_date', b.scheduled_date, 'status', b.status,
           'total_items', b.total_items, 'ready_items', b.ready_items,
           'pending_items', b.pending_items)), '[]'::jsonb)
    INTO v_batches
    FROM (
      SELECT pb.id, pb.delivery_round_id, pb.scheduled_date, pb.status,
             COUNT(pbi.id)::int AS total_items,
             COUNT(*) FILTER (WHERE pbi.status = 'ready')::int AS ready_items,
             COUNT(*) FILTER (WHERE pbi.status IN ('queued','preparing'))::int AS pending_items
        FROM public.production_batches pb
        LEFT JOIN public.production_batch_items pbi ON pbi.batch_id = pb.id
       WHERE pb.scheduled_date = p_date
       GROUP BY pb.id, pb.delivery_round_id, pb.scheduled_date, pb.status
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

REVOKE EXECUTE ON FUNCTION public.get_kitchen_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kitchen_summary(date) TO authenticated;

CREATE TRIGGER trg_pre_order_address_check
  BEFORE INSERT OR UPDATE OF order_mode, dropoff_detail ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pre_order_delivery();


-- ============================================
-- Part D. list_drivers() — schema-corrected (020 columns), output aliased
-- to DriverRow contract (bmbAdminApi_drivers.ts). max_capacity has no
-- backing column → NULL (UI DeliveryManagement falls back to 5).
-- ============================================
CREATE OR REPLACE FUNCTION public.list_drivers()
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'driver_name', r.driver_name, 'phone_number', r.phone_number,
           'status', r.status, 'max_capacity', r.max_capacity,
           'current_latitude', r.current_latitude, 'current_longitude', r.current_longitude,
           'active_assignments', r.active_assignments, 'last_active', r.last_active)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT d.id, d.name AS driver_name, d.phone AS phone_number, d.status,
             NULL::integer AS max_capacity,
             d.current_latitude, d.current_longitude,
             COUNT(da.id)::int AS active_assignments,
             MAX(da.assigned_at) AS last_active
        FROM public.drivers d
        LEFT JOIN public.delivery_assignments da
               ON da.driver_id = d.id
              AND da.status IN ('assigned', 'accepted', 'in_transit')
       GROUP BY d.id, d.name, d.phone, d.status,
                d.current_latitude, d.current_longitude
       ORDER BY d.name
    ) r;

  RETURN jsonb_build_object('ok', true, 'drivers', v_result, 'count', jsonb_array_length(v_result));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_drivers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_drivers() TO authenticated;


-- ============================================
-- Part E. list_recipes_with_inventory(text) — repaired: joins real
-- `inventory` table (035 referenced the non-existent "ingredients").
-- ============================================
CREATE OR REPLACE FUNCTION public.list_recipes_with_inventory(
  p_product_id text DEFAULT NULL
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'product_id', r.product_id, 'ingredient_id', r.ingredient_id,
           'quantity_per_unit', r.quantity_per_unit, 'ingredient_name', r.ingredient_name,
           'unit', r.unit, 'category', r.category, 'current_stock', r.current_stock,
           'min_stock', r.min_stock, 'inventory_status', r.inventory_status,
           'product_name', r.product_name)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT rec.id, rec.product_id, rec.ingredient_id, rec.quantity_per_unit,
             i.name AS ingredient_name, i.unit, i.category,
             i.current_stock, i.min_stock, i.status AS inventory_status,
             p.name AS product_name
        FROM public.recipes rec
        JOIN public.inventory i ON i.id = rec.ingredient_id
        LEFT JOIN public.products p ON p.id = rec.product_id
       WHERE (p_product_id IS NULL OR rec.product_id = p_product_id)
       ORDER BY p.name, i.category, i.name
    ) r;

  RETURN jsonb_build_object('ok', true, 'recipes', v_result, 'count', jsonb_array_length(v_result));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_recipes_with_inventory(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_recipes_with_inventory(text) TO authenticated;

COMMIT;

-- ============================================
-- END OF MIGRATION 037
-- ============================================

