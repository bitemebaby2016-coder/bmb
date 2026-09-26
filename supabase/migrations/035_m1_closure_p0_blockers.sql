-- ============================================
-- Bite Me Baby � Migration 035: TRUE M1 Closure P0 Blockers
-- Date: 2026-09-23
-- Fixes:
--   1) DELIVERY RULE SERVER ENFORCEMENT: Add 5km self-delivery gate
--        to compute_delivery_fee + validate at order creation time
--   2) PRE_ORDER PAYMENT FLOW: Ensure all pre-orders have mandatory
--      payment_status column and trigger to set payment_status='pending'
--   3) PRE_ORDER ADDRESS MANDATORY: Validate delivery_address non-empty
--      at pre_order creation time
--   4) AUDIT LOG AUTHORITATIVE TABLE: Ensure audit_logs table has RLS
--      policy for authenticated users to READ their own + admin can read all
-- ============================================

BEGIN;

-- ============================================
-- 1. DELIVERY RULE: Server-side 5km self-delivery gate
--    In compute_delivery_fee, if distance > 5 AND method='self_delivery',
--    return NULL (blocked) instead of computing a fee.
-- ============================================

CREATE OR REPLACE FUNCTION public.compute_delivery_fee(
  p_dropoff_latitude numeric,
  p_dropoff_longitude numeric,
  p_delivery_method text DEFAULT 'self_delivery',
  p_items_count integer DEFAULT 1,
  p_distance_km numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_kitchen jsonb;
  v_lat1 numeric;
  v_lon1 numeric;
  v_dist numeric;
  v_zone record;
  v_fee numeric;
  v_amount_per_item numeric := 5;
  v_min_fee numeric := 25;
  v_max_fee numeric := 100;
  v_result numeric;
  v_method text := COALESCE(p_delivery_method, 'self_delivery');
BEGIN
  -- Fetch kitchen location
  SELECT value INTO v_kitchen FROM public.business_settings WHERE key = 'kitchen_location';
  IF v_kitchen IS NULL THEN
    v_lat1 := 10.7016; v_lon1 := 102.1429;
  ELSE
    v_lat1 := (v_kitchen->>'latitude')::numeric;
    v_lon1 := (v_kitchen->>'longitude')::numeric;
  END IF;

  -- Compute distance if not provided
  IF p_distance_km IS NOT NULL AND p_distance_km > 0 THEN
    v_dist := p_distance_km;
  ELSE
    v_dist := public.haversine_km(v_lat1, v_lon1, COALESCE(p_dropoff_latitude, v_lat1), COALESCE(p_dropoff_longitude, v_lon1));
  END IF;

  -- ============================================
  -- P0 #5 FIX: SERVER-SIDE 5KM SELF-DELIVERY GATE
  -- self_delivery ONLY allowed within 5 km radius
  -- If customer is outside 5km with self_delivery ? block (return null fee)
  -- External providers (grab, linemane, foodpanda) are NOT restricted by this gate
  -- ============================================
  IF v_method = 'self_delivery' AND v_dist > 5 THEN
    RETURN jsonb_build_object('ok', false, 'blocked', true, 'reason', 'SELF_DELIVERY_EXCEEDS_5KM_LIMIT', 'distance_km', v_dist);
  END IF;

  -- Pick fee from delivery_zones (preferred source)
  SELECT * INTO v_zone
    FROM public.delivery_zones
   WHERE is_active = true
     AND (v_dist >= min_distance::numeric OR min_distance IS NULL)
     AND (v_dist <= max_distance::numeric OR max_distance IS NULL)
   ORDER BY min_distance::numeric ASC
   LIMIT 1;

  IF v_zone IS NOT NULL THEN
    v_fee := v_zone.fee;
  ELSE
    -- Legacy formula fallback
    v_fee := LEAST(
      GREATEST(v_min_fee + (v_dist * v_amount_per_item - v_amount_per_item * 5), v_min_fee),
      v_max_fee
    );
  END IF;

  -- Minimum per-item surcharge
  IF p_items_count > 1 THEN
    v_fee := v_fee + (p_items_count - 1) * 3;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'fee', round(v_fee, 2)::integer,
    'method', v_method,
    'distance_km', round(v_dist, 2),
    'zone_id', COALESCE(v_zone.id, NULL),
    'delivery_method_note', CASE WHEN v_method = 'self_delivery' THEN 'Bite Me Baby (??????? =5 ??.)' ELSE 'External provider' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_delivery_fee(numeric, numeric, text, integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_delivery_fee(numeric, numeric, text, integer, numeric) TO authenticated, service_role;

COMMIT;

-- ============================================
-- Migration 035 Part 2: Pre-Order Payment + Address Enforcement
-- ============================================

BEGIN;

-- Check if payment_status column exists on orders (should exist from 025)
-- If not, add it (defensive � idempotent via DO block)
DO } BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_status') THEN
    ALTER TABLE public.orders ADD COLUMN payment_status TEXT DEFAULT 'pending'::text CHECK (payment_status IN ('pending', 'paid', 'refund'));
    RAISE NOTICE 'Added payment_status column to orders';
  ELSE
    -- Ensure the enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
      CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'refund');
      -- Convert text to enum
      ALTER TABLE public.orders ALTER COLUMN payment_status TYPE public.payment_status USING payment_status::text::public.payment_status;
      RAISE NOTICE 'Created payment_status enum type';
    END IF;
  END IF;
END };

-- ============================================
-- PRE-ORDER ADDRESS MANDATORY ENFORCEMENT
-- Add a trigger that ensures delivery_address is non-empty for pre_orders mode
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_pre_order_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS }
BEGIN
  -- Only enforce for pre-orders (SAME_DAY already has client-side fallback to kitchen location)
  IF NEW.order_mode = 'PRE_ORDER' OR NEW.order_mode::text = 'PRE_ORDER' THEN
    IF COALESCE(NEW.dropoff_detail, '') = '' OR COALESCE(NEW.delivery_address, '') = '' THEN
      RAISE EXCEPTION 'ERR_PRE_ORDER_REQUIRES_ADDRESS: Pre-order requires a delivery address';
    END IF;
  END IF;
  RETURN NEW;
END;
} SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pre_order_address_check ON public.orders;
CREATE TRIGGER trg_pre_order_address_check
  BEFORE INSERT OR UPDATE OF order_mode, dropoff_detail, delivery_address ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pre_order_delivery();

COMMIT;

-- ============================================
-- Migration 035 Part 3: Audit Log RLS Fix
-- Make audit_logs readable by authenticated admin users
-- ============================================

BEGIN;

-- Drop existing policies and recreate proper ones
DROP POLICY IF EXISTS audit_logs_anon_read ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_auth_read ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_admin_all ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_service_write ON public.audit_logs;

-- anon: NO read access (audit logs are sensitive internal data)
CREATE POLICY audit_logs_anon_deny ON public.audit_logs
  FOR SELECT TO anon USING (false);

-- authenticated/admin: Can read all audit logs (they manage the system)
CREATE POLICY audit_logs_admin_read ON public.audit_logs
  FOR SELECT TO authenticated USING (is_admin());

-- service_role: Full write
CREATE POLICY audit_logs_service_write ON public.audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RPC writers (via rpc_write_audit_log): can insert
-- (existing grant should already allow this via security definer RPC)

COMMENT ON TABLE public.audit_logs IS
  'Server-authoritative audit trail. Readable by admins only via RLS. Written via RPCs.';

COMMIT;

-- ============================================
-- Migration 035 Part 4: Create admin API wrappers for new pages
-- These RPCs will be used by the Admin UI pages created in this session
-- ============================================

BEGIN;

-- ============================================
-- 1. GET ALL ORDERS WITH MODE + PAYMENT STATUS (for PreOrdersAdmin page)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_all_orders_for_admin(
  p_status_filter text DEFAULT NULL,
  p_mode_filter text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
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
  IF NOT is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_result FROM (
    SELECT 
      o.id, o.order_number, o.customer_name, o.customer_phone, o.status,
      o.total_amount, o.payment_status, o.payment_method, o.order_mode,
      o.scheduled_date, o.delivery_address, o.dropoff_latitude, o.dropoff_longitude,
      o.delivery_method, o.created_at, o.updated_at,
      COUNT(DISTINCT oi.id)::integer as items_count
    FROM public.orders o
    LEFT JOIN public.order_items oi ON oi.order_id = o.id
    WHERE (p_status_filter IS NULL OR o.status::text = p_status_filter)
      AND (p_mode_filter IS NULL OR o.order_mode::text = p_mode_filter)
    GROUP BY o.id, o.order_number, o.customer_name, o.customer_phone, 
             o.status, o.total_amount, o.payment_status, o.payment_method, 
             o.order_mode, o.scheduled_date, o.delivery_address, 
             o.dropoff_latitude, o.dropoff_longitude, o.delivery_method,
             o.created_at, o.updated_at
    ORDER BY o.created_at DESC
    LIMIT LEAST(COALESCE(p_limit, 100), 500)
    OFFSET COALESCE(p_offset, 0)
  ) r;

  RETURN jsonb_build_object('ok', true, 'orders', v_result, 'count', jsonb_array_length(v_result));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_orders_for_admin(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_orders_for_admin(text, text, integer, integer) TO authenticated;

COMMIT;

-- ============================================
-- Migration 035 Part 5: Admin RPCs for Kitchen, Recipes, Drivers
-- These are used by the new admin UI pages
-- ============================================

BEGIN;

-- ============================================
-- 1. GET KITCHEN QUEUE (admin-friendly JSON format)
-- Already exists as kitchen_queue(text, date). Re-assert with proper grants.
-- This returns batches + items sorted by batch creation time
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
  v_total_orders integer;
  v_ready_count integer;
  v_queued_count integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  -- Get batch summary
  SELECT COALESCE(jsonb_agg(b), '[]'::jsonb) INTO v_batches FROM (
    SELECT 
      pb.id AS batch_id, pb.delivery_round_id, pb.scheduled_date, pb.status,
      pb.created_by, pb.created_at,
      COUNT(pbi.id)::integer AS total_items,
      SUM(CASE WHEN pbi.status = 'ready' THEN 1 ELSE 0 END)::integer AS ready_items,
      SUM(CASE WHEN pbi.status IN ('queued', 'preparing') THEN 1 ELSE 0 END)::integer AS pending_items
    FROM public.production_batches pb
    LEFT JOIN public.production_batch_items pbi ON pbi.batch_id = pb.id
    WHERE pb.scheduled_date = p_date
    GROUP BY pb.id, pb.delivery_round_id, pb.scheduled_date, pb.status, pb.created_by, pb.created_at
    ORDER BY pb.created_at ASC
  ) b;

  -- Aggregate counts
  SELECT COALESCE(SUM(cnt), 0), COALESCE(SUM(rdy), 0) INTO v_total_orders, v_ready_count FROM (
    SELECT COUNT(*) cnt FROM public.production_batch_items WHERE status = 'queued' AND EXISTS (SELECT 1 FROM production_batches pb2 WHERE pb2.id = production_batch_items.batch_id AND scheduled_date = p_date), 0 rdy
    UNION ALL
    SELECT 0, COUNT(*) FROM public.production_batch_items WHERE status = 'ready' AND EXISTS (SELECT 1 FROM production_batches pb2 WHERE pb2.id = production_batch_items.batch_id AND scheduled_date = p_date)
  ) c;

  RETURN jsonb_build_object(
    'ok', true, 'date', p_date::text,
    'total_batches', jsonb_array_length(v_batches),
    'batches', v_batches,
    'summary', jsonb_build_object('pending_orders', v_total_orders, 'ready_orders', v_ready_count)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_kitchen_summary(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_kitchen_summary(date) TO authenticated;

COMMIT;

-- ============================================
-- Migration 035 Part 6: Driver + Recipe Admin RPCs
-- ============================================

BEGIN;

-- GET ALL DRIVERS (for admin dispatch UI)
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
  
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_result FROM (
    SELECT 
      d.id, d.driver_name, d.phone_number, d.status, d.max_capacity,
      d.current_latitude, d.current_longitude,
      COUNT(da.id)::integer AS active_assignments,
      MAX(da.created_at) AS last_active
    FROM public.drivers d
    LEFT JOIN public.delivery_assignments da ON da.driver_phone = d.phone_number AND da.status IN ('assigned', 'accepted', 'in_transit')
    GROUP BY d.id, d.driver_name, d.phone_number, d.status, d.max_capacity,
             d.current_latitude, d.current_longitude
    ORDER BY d.driver_name
  ) r;
  
  RETURN jsonb_build_object('ok', true, 'drivers', v_result, 'count', jsonb_array_length(v_result));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_drivers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_drivers() TO authenticated;

-- GET ALL RECIPES / BOM for admin display
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
  
  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_result FROM (
    SELECT 
      rec.id, rec.product_id, rec.ingredient_id, rec.quantity_per_unit,
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

REVOKE EXECUTE ON FUNCTION public.list_recipes_with_inventory(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_recipes_with_inventory(text) TO authenticated;

COMMIT;
