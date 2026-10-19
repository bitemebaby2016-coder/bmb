-- ============================================================
-- Bite Me Baby — Migration 127: CUSTOMER PICKUP FULFILLMENT
-- Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19 (Owner directive)
--
-- Additive-only design (existing functions untouched):
--   1) delivery_method enum += 'pickup'
--   2) orders.pickup_code / picked_up_at / handed_by
--   3) pickup_code auto-generation trigger (INSERT + pickup patch UPDATE)
--   4) picked_up_at auto-stamp when pickup order reaches 'delivered'
--   5) compute_delivery_fee: pickup => 0 (early return, no zone lookup)
--   6) order_transition_allowed: ready_for_dispatch -> delivered
--      (admin/staff counter handover)
--   7) create_pickup_order_i: canonical pickup order creation
--      - DELEGATES to create_order_with_items_i (idempotency 124 intact)
--        with delivery_method='self_delivery' + kitchen coords, then PATCHES
--        the row: method='pickup', fee=0, total recalculated, pickup_code
--      - replay-safe: every patch step is idempotent
-- Policy: pickup delivery_fee = 0 (Owner-approved); all other pricing untouched.
-- ============================================================

-- ---------- 1. enum value ----------
DO $$ BEGIN
  ALTER TYPE public.delivery_method ADD VALUE IF NOT EXISTS 'pickup';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 2. order columns ----------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS handed_by TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_pickup_code_unique
  ON public.orders (pickup_code) WHERE pickup_code IS NOT NULL;

-- ---------- 3. pickup_code generator (6 digits, collision-guarded) ----------
CREATE OR REPLACE FUNCTION public.gen_pickup_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_try integer := 0;
BEGIN
  LOOP
    v_code := lpad((floor(random() * 900000)::int + 100000)::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE pickup_code = v_code);
    v_try := v_try + 1;
    IF v_try > 20 THEN
      RAISE EXCEPTION 'ERR_PICKUP_CODE_EXHAUSTED';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.gen_pickup_code() FROM PUBLIC, anon, authenticated;

-- ---------- 4. row triggers (stamp code + handed-over time) ----------
CREATE OR REPLACE FUNCTION public.trg_orders_pickup_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_method::text = 'pickup' THEN
    IF NEW.pickup_code IS NULL THEN
      NEW.pickup_code := public.gen_pickup_code();
    END IF;
    IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered'
       AND NEW.picked_up_at IS NULL THEN
      NEW.picked_up_at := NOW();
      NEW.handed_by := COALESCE(auth.uid()::text, NEW.handed_by, 'system');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_pickup_stamp ON public.orders;
CREATE TRIGGER trg_orders_pickup_stamp
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_pickup_stamp();

-- ---------- 5. delivery fee: pickup => 0 (copy of 114 + early return) ----------
CREATE OR REPLACE FUNCTION public.compute_delivery_fee(p_dropoff_latitude numeric, p_dropoff_longitude numeric, p_delivery_method text DEFAULT 'self_delivery'::text, p_items_count integer DEFAULT 1, p_distance_km numeric DEFAULT NULL::numeric, p_branch_id text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dist    numeric;
  v_fee     numeric;
  v_kitchen jsonb;
  v_dp jsonb;
  v_method  text := COALESCE(p_delivery_method, 'self_delivery');
  v_radius  numeric;
  v_br      numeric;
BEGIN
  -- 127: PICKUP POLICY — delivery_fee = 0 for customer pickup (no zone lookup).
  IF v_method = 'pickup' THEN
    RETURN 0;
  END IF;

  -- W-1.4: config from DB (no hardcode)
  SELECT value INTO v_dp FROM public.business_settings WHERE key = 'delivery_policy';
  IF v_dp IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: business_settings.delivery_policy'; END IF;
  IF v_dp->>'bite_drive_radius_km' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.bite_drive_radius_km'; END IF;
  v_radius := (v_dp->>'bite_drive_radius_km')::numeric;
  -- FC-3: branch-specific radius canonical (branches.service_radius_km) when branch context
  IF p_branch_id IS NOT NULL THEN
    SELECT b.service_radius_km INTO v_br FROM public.branches b WHERE b.id = p_branch_id;
    IF v_br IS NOT NULL AND v_br > 0 THEN v_radius := v_br; END IF;
  END IF;

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

  -- server-side self-delivery radius gate (canonical = branch override > delivery_policy)
  IF v_method = 'self_delivery' AND v_dist > v_radius THEN
    RAISE EXCEPTION 'SELF_DELIVERY_EXCEEDS_5KM_LIMIT: % km > configured radius % km', v_dist, v_radius;
  END IF;

  SELECT fee INTO v_fee
    FROM public.delivery_zones
   WHERE is_active = true
     AND (p_branch_id IS NULL OR branch_id = p_branch_id OR branch_id IS NULL)
     AND v_dist >= min_distance_km
     AND v_dist <= max_distance_km
   ORDER BY (branch_id IS NULL) ASC, max_distance_km ASC
   LIMIT 1;

  IF v_fee IS NOT NULL THEN
    RETURN v_fee;
  END IF;

  -- W-1.4: no silent hardcode fallback — admin must cover distance with an active zone
  RAISE EXCEPTION 'ERR_NO_DELIVERY_ZONE: no active delivery_zone covers % km (admin: adjust delivery_zones)', v_dist;
  END;
$function$;

-- ---------- 6. transition matrix: counter handover (copy of 030 + 1 additive row) ----------
CREATE OR REPLACE FUNCTION public.order_transition_allowed(p_from text, p_to text, p_is_admin boolean, p_is_owner boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_from = p_to THEN RETURN true; END IF;

  IF p_is_admin THEN
    CASE
      WHEN (p_from = 'pending'            AND p_to = 'confirmed') THEN RETURN true;
      WHEN (p_from = 'confirmed'          AND p_to = 'preparing') THEN RETURN true;
      WHEN (p_from = 'preparing'          AND p_to = 'ready_for_dispatch') THEN RETURN true;
      WHEN (p_from = 'ready_for_dispatch' AND p_to = 'dispatched') THEN RETURN true;
      WHEN (p_from = 'dispatched'         AND p_to = 'in_transit') THEN RETURN true;
      WHEN (p_from = 'in_transit'         AND p_to = 'arrived') THEN RETURN true;
      WHEN (p_from = 'arrived'            AND p_to = 'delivered') THEN RETURN true;
      -- 127 ADDITIVE: counter handover (pickup collection / no-driver closeout)
      WHEN (p_from = 'ready_for_dispatch' AND p_to = 'delivered') THEN RETURN true;
      WHEN (p_from IN ('pending','confirmed','preparing','ready_for_dispatch','dispatched','in_transit','arrived') AND p_to = 'cancelled') THEN RETURN true;
      WHEN (p_from IN ('pending','confirmed','preparing','ready_for_dispatch','dispatched','in_transit','arrived') AND p_to = 'failed') THEN RETURN true;
      ELSE RETURN false;
    END CASE;
    RETURN false;
  END IF;

  -- Customer (owner): can only cancel their own order from pending
  IF p_is_owner THEN
    IF p_from = 'pending' AND p_to = 'cancelled' THEN RETURN true; END IF;
    RETURN false;
  END IF;

  RETURN false;
END;
$function$;

-- ---------- 7. canonical pickup order creation (idempotent via 124) ----------
CREATE OR REPLACE FUNCTION public.create_pickup_order_i(
  p_items jsonb,
  p_delivery_round_id text,
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT '',
  p_payment_method text DEFAULT 'cash_on_delivery',
  p_special_instructions text DEFAULT '',
  p_promotion_code text DEFAULT NULL,
  p_order_mode text DEFAULT 'SAME_DAY',
  p_scheduled_date date DEFAULT NULL,
  p_branch_id text DEFAULT NULL,
  p_source_channel text DEFAULT 'WEB',
  p_client_submit_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
  v_order_number text;
  v_row public.orders%ROWTYPE;
  v_lat numeric; v_lon numeric;
  v_kitchen jsonb;
BEGIN
  IF p_payment_method NOT IN ('promptpay_qr', 'cash_on_delivery', 'credit_card') THEN
    RAISE EXCEPTION 'ERR_INVALID_PAYMENT_METHOD';
  END IF;

  -- pickup point = branch kitchen when branch given, else canonical kitchen
  IF p_branch_id IS NOT NULL AND trim(p_branch_id) <> '' THEN
    SELECT kitchen_latitude, kitchen_longitude INTO v_lat, v_lon
      FROM public.branches WHERE id = p_branch_id AND status = 'active' LIMIT 1;
    IF v_lat IS NULL OR v_lon IS NULL THEN
      v_kitchen := public.kitchen_location();
      v_lat := (v_kitchen->>'latitude')::numeric;
      v_lon := (v_kitchen->>'longitude')::numeric;
    END IF;
  ELSE
    v_kitchen := public.kitchen_location();
    v_lat := (v_kitchen->>'latitude')::numeric;
    v_lon := (v_kitchen->>'longitude')::numeric;
  END IF;

  -- DELEGATE to the idempotent canonical creation (124 wrapper -> 118 engine).
  -- Pickup is staged as 'self_delivery' + kitchen coords so the untouched inner
  -- gates pass unchanged; the UPDATE below is the single pickup normalizer.
  v_res := public.create_order_with_items_i(
    p_items => p_items,
    p_delivery_round_id => p_delivery_round_id,
    p_delivery_method => 'self_delivery',
    p_delivery_address => 'รับที่ร้าน (Pickup)',
    p_dropoff_latitude => v_lat,
    p_dropoff_longitude => v_lon,
    p_customer_name => p_customer_name,
    p_customer_phone => p_customer_phone,
    p_payment_method => p_payment_method,
    p_special_instructions => p_special_instructions,
    p_promotion_code => p_promotion_code,
    p_distance_km => 0,
    p_order_mode => p_order_mode,
    p_scheduled_date => p_scheduled_date,
    p_branch_id => p_branch_id,
    p_source_channel => p_source_channel,
    p_external_ref_id => NULL,
    p_customer_ref => NULL,
    p_client_submit_key => p_client_submit_key
  );

  -- channel-dedupe duplicate answer: nothing to patch (order already canonical)
  IF (v_res->>'duplicate')::boolean IS TRUE THEN
    RETURN v_res;
  END IF;

  v_order_number := v_res->>'order_number';

  -- IDEMPOTENT NORMALIZER: re-running (replay) keeps values stable —
  -- pickup_code generated only when NULL (trigger), fee stays 0.
  UPDATE public.orders
     SET delivery_method = 'pickup'::public.delivery_method,
         delivery_fee = 0,
         total_amount = GREATEST(0, subtotal - discount_amount + service_fee + tax_amount),
         updated_at = NOW()
   WHERE order_number = v_order_number;

  SELECT * INTO v_row FROM public.orders WHERE order_number = v_order_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_PICKUP_PATCH_ORDER_MISSING';
  END IF;

  RETURN v_res || jsonb_build_object(
    'delivery_method', 'pickup',
    'delivery_fee', 0,
    'total_amount', v_row.total_amount,
    'pickup_code', v_row.pickup_code,
    'status', v_row.status::text,
    'payment_status', v_row.payment_status::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_pickup_order_i FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pickup_order_i TO authenticated, service_role;

-- ========== CONTRACT NOTES (127) ==========
-- * create_order_with_items(_i) signatures UNCHANGED (18-arg overload pin kept).
-- * create_order_with_items_i payload fingerprint unchanged: pickup orders are
--   fingerprinted on the staged 'self_delivery' payload — retries replay correctly.
-- * delivery fee for every existing method byte-identical (pickup branch is new code).
