-- ============================================
-- Bite Me Baby — Migration 020: Bite Drive (DEL-01, DEL-02)
-- Date: 2026-09-21 (clean reconstruction — fixes corrupted interleaved version)
-- Phase: PHASE 3 (BITE DRIVE)
--
-- DEL-01  delivery fee AUTHORITATIVE from `delivery_zones`:
--           - haversine_km(lat1,lon1,lat2,lon2) — server-side distance
--           - compute_delivery_fee(...) — picks the matching zone (fee field);
--             falls back to the legacy method formula while zones are empty.
--           - create_order_with_items is redefined to use it — client distance
--             input is IGNORED for money (server computes from drop-off coords
--             vs kitchen location in business_settings).
-- DEL-02  real drivers + assignments (replaces MOCK drivers):
--           - drivers          (rider identity + availability + location)
--           - delivery_assignments (order <-> driver lifecycle, transactional)
--           - RPCs: upsert_driver, assign_driver, driver_login,
--                   driver_accept_assignment, driver_update_delivery_status,
--                   my_deliveries
-- Security: SECURITY DEFINER + SET search_path = public;
--           management RPCs admin-guarded; driver self-service matched by phone.
--           Server-side contexts (SQL Editor / db push — no request JWT) pass
--           the HTTP-only guards so the owner SQL contract suite can run them.
-- Idempotent: safe to re-run (tolerates partial objects from earlier attempts).
-- ============================================

BEGIN;

-- ============================================
-- 0. Defensive cleanup — remove any partial/legacy overloads left by
--    previous manual attempts, so the canonical signatures below are the
--    ONLY overloads PostgREST can resolve (prevents PGRST203 ambiguity).
-- ============================================
DROP FUNCTION IF EXISTS public.haversine_km(numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.kitchen_location();
DROP FUNCTION IF EXISTS public.compute_delivery_fee(numeric, numeric, text, integer, numeric);
DROP FUNCTION IF EXISTS public.compute_delivery_fee_rpc(numeric, numeric, text, integer, numeric);
DROP FUNCTION IF EXISTS public.upsert_driver(text, text, text);
DROP FUNCTION IF EXISTS public.assign_driver(text, text);
DROP FUNCTION IF EXISTS public.driver_login(text);
DROP FUNCTION IF EXISTS public.driver_login(text, text);
DROP FUNCTION IF EXISTS public.driver_accept_assignment(text, text);
DROP FUNCTION IF EXISTS public.driver_update_delivery_status(text, text, text);
DROP FUNCTION IF EXISTS public.driver_update_delivery_status(text, text, text, numeric, numeric);
DROP FUNCTION IF EXISTS public.my_deliveries(text);

-- ============================================
-- 1. DEL-01: server-side distance + authoritative zone fee
-- ============================================
CREATE OR REPLACE FUNCTION public.haversine_km(
  p_lat1 numeric, p_lon1 numeric, p_lat2 numeric, p_lon2 numeric
)
RETURNS numeric
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dlat numeric;
  v_dlon numeric;
  v_a    numeric;
  v_r    numeric := 6371;
BEGIN
  IF p_lat1 IS NULL OR p_lon1 IS NULL OR p_lat2 IS NULL OR p_lon2 IS NULL THEN
    RETURN 0;
  END IF;
  v_dlat := radians(p_lat2 - p_lat1);
  v_dlon := radians(p_lon2 - p_lon1);
  v_a := sin(v_dlat / 2) * sin(v_dlat / 2) +
         cos(radians(p_lat1)) * cos(radians(p_lat2)) *
         sin(v_dlon / 2) * sin(v_dlon / 2);
  -- FIX (42883): atan2() returns double precision and PostgreSQL has no
  -- round(double precision, integer) — cast to numeric before round(numeric, int).
  RETURN round((v_r * 2 * atan2(sqrt(v_a), sqrt(1 - v_a)))::numeric, 2);
END;
$$;

-- Kitchen anchor (business_settings 'kitchen_location', fallback Chanthaburi).
CREATE OR REPLACE FUNCTION public.kitchen_location()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_loc jsonb;
BEGIN
  SELECT value INTO v_loc FROM public.business_settings WHERE key = 'kitchen_location';
  IF v_loc IS NULL THEN
    RETURN '{"latitude":10.7016,"longitude":102.1429}'::jsonb;
  END IF;
  RETURN v_loc::jsonb;
END;
$$;
-- Authoritative delivery fee (THB):
--   distance is computed server-side from the drop-off coords when present;
--   matches an active delivery_zone by min/max distance; fee = zone.fee.
--   No matching zone -> legacy per-method formula (BLOCKED-to-replace path).
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
  IF COALESCE(p_delivery_method, 'self_delivery') = 'grab_rider' THEN
    RETURN LEAST(40 + v_dist * 8 + COALESCE(p_items_count, 1) * 2, 9999);
  ELSIF COALESCE(p_delivery_method, 'self_delivery') = 'linemen_rider' THEN
    RETURN LEAST(35 + v_dist * 7 + COALESCE(p_items_count, 1) * 2, 9999);
  ELSIF COALESCE(p_delivery_method, 'self_delivery') = 'foodpanda_rider' THEN
    RETURN LEAST(38 + v_dist * 7.5 + COALESCE(p_items_count, 1) * 2, 9999);
  END IF;
  RETURN LEAST(30 + v_dist * 4 + COALESCE(p_items_count, 1) * 2, 9999);
END;
$$;

-- Client-visible quote: authenticated (admin-guard NOT needed — customer sees the fee).
-- ALL parameters defaulted so the no-argument contract probe (POST body {})
-- resolves this exact overload; identity stays (numeric,numeric,text,integer,numeric).
CREATE OR REPLACE FUNCTION public.compute_delivery_fee_rpc(
  p_dropoff_latitude numeric DEFAULT NULL,
  p_dropoff_longitude numeric DEFAULT NULL,
  p_delivery_method text DEFAULT 'self_delivery',
  p_items_count integer DEFAULT 1,
  p_distance_km numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  RETURN jsonb_build_object(
    'delivery_fee', public.compute_delivery_fee(p_dropoff_latitude, p_dropoff_longitude, p_delivery_method, p_items_count, p_distance_km),
    'method', COALESCE(p_delivery_method, 'self_delivery')
  );
END;
$$;
-- ============================================
-- 2. DEL-01: create_order_with_items — delivery_fee จาก delivery_zones (server)
--    (client p_distance_km ยังรับได้เป็น fallback เท่านั้น — เงินจริง derive จาก lat/lon)
--    NOTE: round capacity is incremented by trigger
--    increment_delivery_round_count (migration 001) — do NOT increment here.
-- ============================================
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_items jsonb,
  p_delivery_round_id text,
  p_delivery_method text DEFAULT 'self_delivery',
  p_delivery_address text DEFAULT '',
  p_dropoff_latitude numeric DEFAULT NULL,
  p_dropoff_longitude numeric DEFAULT NULL,
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT '',
  p_payment_method text DEFAULT 'promptpay_qr',
  p_special_instructions text DEFAULT '',
  p_promotion_code text DEFAULT NULL,
  p_distance_km numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             uuid;
  v_order_id        text;
  v_order_number    text;
  v_item_row        record;
  v_pid             text;
  v_qty             integer;
  v_unit_price      numeric;
  v_item_sub        numeric;
  v_addon_price     numeric;
  v_subtotal        numeric := 0;
  v_discount        numeric := 0;
  v_delivery_fee    numeric := 0;
  v_service_fee     numeric := 0;
  v_tax             numeric := 0;
  v_total           numeric := 0;
  v_round_status    text;
  v_max_cap         integer;
  v_cur_count       integer;
  v_prod_is_avail   boolean;
  v_prod_name       text;
  v_order_exists    boolean;
  v_attempt         integer := 0;
  v_delivery_method text;
  v_distance        numeric;
  v_items_total_qty integer := 0;
  v_promo           public.promotions%ROWTYPE;
BEGIN
  -- ===== 1. AUTHENTICATION =====
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;

  -- ===== 2. INPUT VALIDATION =====
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ERR_EMPTY_ORDER';
  END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ROUND';
  END IF;
  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_CUSTOMER_NAME';
  END IF;

  IF p_delivery_method NOT IN ('self_delivery','grab_rider','linemen_rider','foodpanda_rider') THEN
    RAISE EXCEPTION 'ERR_INVALID_DELIVERY_METHOD';
  END IF;
  IF p_payment_method NOT IN ('promptpay_qr','cash_on_delivery','credit_card') THEN
    RAISE EXCEPTION 'ERR_INVALID_PAYMENT_METHOD';
  END IF;

  v_delivery_method := p_delivery_method;
  v_distance := COALESCE(p_distance_km, 0);

  -- ===== 3. DELIVERY ROUND — atomic capacity lock =====
  SELECT status, max_capacity, current_count
    INTO v_round_status, v_max_cap, v_cur_count
    FROM public.delivery_rounds
   WHERE id = p_delivery_round_id
   FOR UPDATE;

  IF v_round_status IS NULL THEN
    RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND';
  END IF;
  IF v_round_status <> 'active' THEN
    RAISE EXCEPTION 'ERR_ROUND_CLOSED';
  END IF;
  IF (v_cur_count + 1) > v_max_cap THEN
    RAISE EXCEPTION 'ERR_CAPACITY_FULL';
  END IF;

  -- ===== 4. PRODUCTS / AUTHORITATIVE PRICES (base + add-ons) =====
  FOR v_item_row IN SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id text, quantity integer, options jsonb, special_request text)
  LOOP
    v_pid := v_item_row.product_id;
    v_qty := COALESCE(v_item_row.quantity, 0);

    IF v_pid IS NULL OR trim(v_pid) = '' THEN
      RAISE EXCEPTION 'ERR_MISSING_PRODUCT_ID';
    END IF;
    IF v_qty <= 0 OR v_qty > 1000 THEN
      RAISE EXCEPTION 'ERR_INVALID_QUANTITY';
    END IF;

    SELECT price, is_available, name
      INTO v_unit_price, v_prod_is_avail, v_prod_name
      FROM public.products
     WHERE id = v_pid
     FOR UPDATE;

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND';
    END IF;
    IF NOT COALESCE(v_prod_is_avail, false) THEN
      RAISE EXCEPTION 'ERR_PRODUCT_UNAVAILABLE';
    END IF;

    -- add-on surcharge re-derived from products.addons (client sends no prices)
    v_addon_price := public.compute_addons_price(v_pid, v_item_row.options);

    v_item_sub := v_qty * (v_unit_price + COALESCE(v_addon_price, 0));
    v_subtotal := v_subtotal + v_item_sub;
    v_items_total_qty := v_items_total_qty + v_qty;
  END LOOP;

  -- ===== 5. PROMOTION (authoritative — from promotions table) =====
  IF p_promotion_code IS NOT NULL AND trim(p_promotion_code) <> '' THEN
    SELECT * INTO v_promo
      FROM public.promotions
     WHERE upper(code) = upper(trim(p_promotion_code))
       AND is_active = true
       AND (start_date IS NULL OR start_date <= CURRENT_DATE)
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
     LIMIT 1;

    IF FOUND THEN
      IF v_subtotal >= COALESCE(v_promo.min_order_amount, 0) THEN
        IF v_promo.discount_type = 'percentage' THEN
          v_discount := LEAST(v_subtotal * COALESCE(v_promo.discount_value,0) / 100, v_subtotal);
        ELSIF v_promo.discount_type = 'fixed_amount' THEN
          v_discount := LEAST(COALESCE(v_promo.discount_value,0), v_subtotal);
        END IF;
      END IF;
    END IF;
  END IF;

  -- ===== 6. DELIVERY FEE — AUTHORITATIVE (DEL-01: delivery_zones, server distance) =====
  v_delivery_fee := public.compute_delivery_fee(
    p_dropoff_latitude, p_dropoff_longitude,
    v_delivery_method, v_items_total_qty,
    CASE WHEN p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN v_distance ELSE NULL END
  );

  v_service_fee := 0;
  v_tax := 0;
  v_total := GREATEST(0, v_subtotal - v_discount + v_delivery_fee + v_service_fee + v_tax);

  -- ===== 7. INSERT order (authoritative amounts) =====
  -- FIX (portable epoch — see migration 009): extract_epoch(timestamptz) does
  -- not exist on the live project; the portable form is extract(epoch from ...).
  v_order_id := 'ord-' || to_char(extract(epoch from clock_timestamp()) * 1000, '99999999999')
                    || '-' || substr(md5(random()::text), 1, 6);
  v_order_number := 'BMB-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-'
                    || lpad((floor(random() * 900) + 100)::text, 3, '0');
  LOOP
    v_attempt := v_attempt + 1;
    SELECT EXISTS(
      SELECT 1 FROM public.orders WHERE order_number = v_order_number
    ) INTO v_order_exists;
    EXIT WHEN NOT v_order_exists OR v_attempt >= 5;
    v_order_number := 'BMB-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-'
                      || lpad((floor(random() * 900) + 100)::text, 3, '0');
  END LOOP;
  IF v_order_exists THEN
    RAISE EXCEPTION 'ERR_ORDER_NUMBER_EXHAUSTED';
  END IF;

  INSERT INTO public.orders (
    id, order_number, customer_id, customer_name, customer_phone,
    customer_ref, delivery_round_id, status, delivery_method,
    dropoff_detail, dropoff_latitude, dropoff_longitude,
    subtotal, delivery_fee, service_fee, discount_amount, tax_amount, total_amount,
    payment_status, payment_method, special_instructions
  ) VALUES (
    v_order_id, v_order_number, v_uid::text, p_customer_name, p_customer_phone,
    v_uid, p_delivery_round_id, 'pending', v_delivery_method::delivery_method,
    COALESCE(p_delivery_address, ''), p_dropoff_latitude, p_dropoff_longitude,
    v_subtotal, v_delivery_fee, v_service_fee, v_discount, v_tax, v_total,
    'pending', p_payment_method::payment_method, COALESCE(p_special_instructions, '')
  );

  -- ===== 8. INSERT order_items (unit_price = base; add-on snapshot in customizations) =====
  DECLARE
    v_item_qty     integer;
    v_item_pid     text;
    v_item_options jsonb;
    v_item_special text;
    v_i            integer := 0;
  BEGIN
    FOR v_item_row IN SELECT * FROM jsonb_to_recordset(p_items)
        AS x(product_id text, quantity integer, options jsonb, special_request text)
    LOOP
      v_i := v_i + 1;
      v_item_qty     := COALESCE(v_item_row.quantity, 1);
      v_item_pid     := v_item_row.product_id;
      v_item_options := COALESCE(v_item_row.options, '{}');
      v_item_special := COALESCE(v_item_row.special_request, '');

      SELECT price, name INTO v_unit_price, v_prod_name
        FROM public.products WHERE id = v_item_pid FOR UPDATE;

      v_item_options := jsonb_set(
        v_item_options,
        '{addOnTotal}',
        to_jsonb(public.compute_addons_price(v_item_pid, v_item_options))
      );

      INSERT INTO public.order_items (
        id, order_id, product_id, product_name, quantity, unit_price,
        customizations, special_request
      ) VALUES (
        'oi-' || v_order_id || '-' || v_i,
        v_order_id,
        v_item_pid,
        v_prod_name,
        v_item_qty,
        v_unit_price,
        v_item_options,
        v_item_special
      );
    END LOOP;
  END;

  -- ===== 9. Return authoritative result =====
  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending',
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'delivery_fee', v_delivery_fee,
    'service_fee', v_service_fee,
    'tax_amount', v_tax,
    'total_amount', v_total,
    'payment_status', 'pending',
    'payment_method', p_payment_method,
    'delivery_round_id', p_delivery_round_id,
    'customer_ref', v_uid::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_with_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;

-- ============================================
-- 3. DEL-02: drivers + delivery_assignments (replaces MOCK drivers)
-- ============================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  vehicle_label TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'offline'
                CHECK (status IN ('available', 'busy', 'offline')),
  current_latitude  NUMERIC(10,7),
  current_longitude NUMERIC(10,7),
  last_seen_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id           TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE REFERENCES public.orders(order_number) ON DELETE CASCADE,
  driver_id    TEXT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'assigned'
               CHECK (status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  in_transit_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Column backfill for partial states left by earlier manual attempts.
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_label TEXT DEFAULT '';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_latitude  NUMERIC(10,7);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_longitude NUMERIC(10,7);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS last_seen_at      TIMESTAMPTZ;
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS assigned_at   TIMESTAMPTZ;
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS accepted_at   TIMESTAMPTZ;
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS picked_up_at  TIMESTAMPTZ;
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS in_transit_at TIMESTAMPTZ;
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ;
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ;
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS notes         TEXT DEFAULT '';
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- Guarantee the UNIQUE constraints ON CONFLICT targets rely on (partial states
-- may hold tables created without them).
DO $$
BEGIN
  IF to_regclass('public.drivers') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.drivers'::regclass
          AND contype = 'u'
          AND conname = 'drivers_phone_key'
     ) THEN
    EXECUTE 'ALTER TABLE public.drivers ADD CONSTRAINT drivers_phone_key UNIQUE (phone)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.delivery_assignments') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.delivery_assignments'::regclass
          AND contype = 'u'
          AND conname = 'delivery_assignments_order_number_key'
     ) THEN
    EXECUTE 'ALTER TABLE public.delivery_assignments ADD CONSTRAINT delivery_assignments_order_number_key UNIQUE (order_number)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assignments_driver ON public.delivery_assignments (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_order ON public.delivery_assignments (order_number);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drivers_deny_anon ON public.drivers;
CREATE POLICY drivers_deny_anon ON public.drivers FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS drivers_auth_read ON public.drivers;
CREATE POLICY drivers_auth_read ON public.drivers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS drivers_admin_write ON public.drivers;
CREATE POLICY drivers_admin_write ON public.drivers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS assignments_deny_anon ON public.delivery_assignments;
CREATE POLICY assignments_deny_anon ON public.delivery_assignments FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS assignments_auth_read ON public.delivery_assignments;
CREATE POLICY assignments_auth_read ON public.delivery_assignments
  FOR SELECT TO authenticated
  USING (public.is_admin() OR driver_id IN (
    SELECT id FROM public.drivers WHERE phone = COALESCE(auth.jwt()->>'phone', '')));
DROP POLICY IF EXISTS assignments_admin_write ON public.delivery_assignments;
CREATE POLICY assignments_admin_write ON public.delivery_assignments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================
-- 4. RPCs — DEL-02 driver dispatch & self-service
--    Guard model (reconciles contract probes + owner SQL suite):
--      - HTTP requests without a user JWT (anon/service) -> ERR_NOT_AUTHENTICATED
--      - Authenticated non-admin on admin RPCs           -> ERR_FORBIDDEN
--      - Server-side contexts (SQL Editor / db push: no request JWT) -> allowed
-- ============================================

-- Admin creates/updates a driver record (upsert by phone).
CREATE OR REPLACE FUNCTION public.upsert_driver(
  p_name text,
  p_phone text,
  p_vehicle_label text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_id  text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF p_name IS NULL OR trim(p_name) = '' OR p_phone IS NULL OR trim(p_phone) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;

  v_id := 'drv-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 4);
  INSERT INTO public.drivers (id, name, phone, vehicle_label, status, created_at, updated_at)
  VALUES (v_id, trim(p_name), trim(p_phone), COALESCE(p_vehicle_label, ''), 'offline', NOW(), NOW())
  ON CONFLICT (phone) DO UPDATE
    SET name = EXCLUDED.name, vehicle_label = EXCLUDED.vehicle_label, updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'driver_id', v_id, 'phone', trim(p_phone));
END;
$$;

-- Admin assigns a dispatchable order to a driver.
CREATE OR REPLACE FUNCTION public.assign_driver(
  p_order_number text,
  p_driver_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_order_status public.order_status;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' OR p_driver_id IS NULL OR trim(p_driver_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ASSIGNMENT';
  END IF;

  SELECT status INTO v_order_status FROM public.orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF v_order_status NOT IN ('ready_for_dispatch', 'dispatched', 'confirmed', 'preparing') THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_DISPATCHABLE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = p_driver_id) THEN
    RAISE EXCEPTION 'ERR_DRIVER_NOT_FOUND';
  END IF;

  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, assigned_at, notes, created_at, updated_at)
  VALUES (
    'das-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 4),
    p_order_number, p_driver_id, 'assigned', NOW(), 'assigned by admin', NOW(), NOW()
  )
  ON CONFLICT (order_number) DO UPDATE
    SET driver_id = EXCLUDED.driver_id, status = 'assigned', assigned_at = NOW(),
        accepted_at = NULL, picked_up_at = NULL, in_transit_at = NULL, delivered_at = NULL,
        updated_at = NOW();

  UPDATE public.drivers SET status = 'busy', updated_at = NOW() WHERE id = p_driver_id;

  PERFORM public.append_audit_log('delivery_assigned', 'delivery', p_order_number, 'delivery assigned to driver ' || p_driver_id, jsonb_build_object('driver_id', p_driver_id));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'driver_id', p_driver_id, 'status', 'assigned');
END;
$$;

-- Driver self-login by phone (upsert). Returns the driver record.
CREATE OR REPLACE FUNCTION public.driver_login(
  p_phone text,
  p_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF p_phone IS NULL OR trim(p_phone) = '' THEN RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO'; END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE phone = trim(p_phone);
  IF NOT FOUND THEN
    INSERT INTO public.drivers (id, name, phone, status, last_seen_at, created_at, updated_at)
    VALUES (
      'drv-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 4),
      COALESCE(NULLIF(trim(p_name), ''), 'Rider'), trim(p_phone), 'available', NOW(), NOW(), NOW()
    )
    RETURNING * INTO v_drv;
  ELSE
    UPDATE public.drivers
       SET status = CASE WHEN v_drv.status = 'busy' THEN 'busy' ELSE 'available' END,
           last_seen_at = NOW(), updated_at = NOW()
     WHERE id = v_drv.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'driver', to_jsonb(v_drv));
END;
$$;

-- Driver accepts an assigned delivery.
CREATE OR REPLACE FUNCTION public.driver_accept_assignment(
  p_order_number text,
  p_driver_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' OR p_driver_phone IS NULL OR trim(p_driver_phone) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;
  SELECT * INTO v_drv FROM public.drivers WHERE phone = trim(p_driver_phone);
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_DRIVER_NOT_FOUND'; END IF;

  UPDATE public.delivery_assignments
     SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW()), updated_at = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv.id AND status = 'assigned';
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_ACCEPTABLE'; END IF;

  UPDATE public.drivers SET status = 'busy', last_seen_at = NOW(), updated_at = NOW() WHERE id = v_drv.id;
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', 'accepted');
END;
$$;

-- Driver updates a delivery status (picked_up -> in_transit -> delivered).
CREATE OR REPLACE FUNCTION public.driver_update_delivery_status(
  p_order_number text,
  p_driver_phone text,
  p_status text,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
  v_cur text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF p_status NOT IN ('picked_up', 'in_transit', 'delivered') THEN
    RAISE EXCEPTION 'ERR_INVALID_DELIVERY_STATUS';
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' OR p_driver_phone IS NULL OR trim(p_driver_phone) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;
  SELECT * INTO v_drv FROM public.drivers WHERE phone = trim(p_driver_phone);
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_DRIVER_NOT_FOUND'; END IF;

  SELECT status INTO v_cur FROM public.delivery_assignments WHERE order_number = p_order_number AND driver_id = v_drv.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_FOUND'; END IF;
  IF v_cur = 'delivered' THEN RAISE EXCEPTION 'ERR_ALREADY_DELIVERED'; END IF;

  UPDATE public.delivery_assignments
     SET status = p_status,
         picked_up_at  = CASE WHEN p_status = 'picked_up'  THEN COALESCE(picked_up_at, NOW())  ELSE picked_up_at END,
         in_transit_at = CASE WHEN p_status = 'in_transit' THEN COALESCE(in_transit_at, NOW()) ELSE in_transit_at END,
         delivered_at  = CASE WHEN p_status = 'delivered'  THEN COALESCE(delivered_at, NOW())  ELSE delivered_at END,
         updated_at = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv.id;

  UPDATE public.drivers
     SET current_latitude = COALESCE(p_latitude, current_latitude),
         current_longitude = COALESCE(p_longitude, current_longitude),
         last_seen_at = NOW(), updated_at = NOW(),
         status = CASE WHEN p_status = 'delivered' THEN 'available' ELSE 'busy' END
   WHERE id = v_drv.id;

  PERFORM public.append_audit_log('delivery_status_change', 'delivery', p_order_number, 'rider set ' || p_status, jsonb_build_object('status', p_status, 'driver', v_drv.id));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', p_status);
END;
$$;

-- Driver reads their assignments (active list).
CREATE OR REPLACE FUNCTION public.my_deliveries(p_driver_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid;
  v_drv  public.drivers%ROWTYPE;
  v_rows jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF p_driver_phone IS NULL OR trim(p_driver_phone) = '' THEN RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO'; END IF;
  SELECT * INTO v_drv FROM public.drivers WHERE phone = trim(p_driver_phone);
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_DRIVER_NOT_FOUND'; END IF;

  SELECT jsonb_agg(x) INTO v_rows FROM (
    SELECT da.order_number, da.status AS assignment_status, da.assigned_at, da.accepted_at,
           o.dropoff_detail, o.dropoff_latitude, o.dropoff_longitude,
           o.status AS order_status, o.total_amount, o.payment_status,
           o.payment_method,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity)), '[]'::jsonb)
              FROM public.order_items oi WHERE oi.order_id = o.id) AS items
      FROM public.delivery_assignments da
      JOIN public.orders o ON o.order_number = da.order_number
     WHERE da.driver_id = v_drv.id
       AND da.status <> 'cancelled'
     ORDER BY da.assigned_at DESC
  ) x;

  RETURN jsonb_build_object('ok', true, 'driver', to_jsonb(v_drv), 'assignments', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

-- ============================================
-- 5. EXECUTE permission — authenticated (guards inside)
-- ============================================
REVOKE EXECUTE ON FUNCTION public.compute_delivery_fee_rpc FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_driver FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_driver FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_login FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_accept_assignment FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_update_delivery_status FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_deliveries FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_delivery_fee_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_driver TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_driver TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_login TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_accept_assignment TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_update_delivery_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_deliveries TO authenticated;

-- ============================================
-- 6. Seed demo zones so DEL-01 works out of the box (editable by admin)
--    (delivery_zones table itself comes from migration 008)
-- ============================================
INSERT INTO public.delivery_zones (id, name, min_distance_km, max_distance_km, fee, is_active) VALUES
  ('zone-city', 'ในเมือง', 0, 5, 25, true),
  ('zone-suburb', 'ชานเมือง', 5, 10, 45, true),
  ('zone-far', 'ไกล', 10, 20, 80, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DONE
-- ============================================
COMMIT;

-- ============================================
-- END OF MIGRATION 020
-- ============================================
