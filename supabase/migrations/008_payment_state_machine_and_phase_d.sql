-- ============================================
-- Bite Me Baby — Migration 008: Payment + Order State Machine + Phase D tables
-- Date: 2026-09-18
-- Phase: P0-5 (Payment real integration) + P0-6 (Order state machine) + Phase D
--
-- Goal:
--   A. P0-4 item 3   : CHECK constraint total_amount >= 0 on orders
--   B. P0-5          : server-authoritative payment plumbing
--        - record_payment_result()            — called ONLY by stripe-webhook Edge Function (service_role)
--        - create_payment_intent_record()     — client calls for non-card methods (amount re-checked vs DB)
--        - submit_offline_payment_reference() — customer records PromptPay TXN id (pending → processing)
--        - confirm_offline_payment()          — admin-only; marks intent completed + orders.payment_status='paid'
--          (COD requires order.status='delivered'; PromptPay requires intent='processing')
--        - mark_payment_failed()              — admin-only failure path
--        - unique partial index on payment_intents(payment_intent_id) for webhook idempotency
--   C. P0-6          : order state machine
--        - order_transition_allowed()         — pure allow-list validator
--        - guard_order_status_transition()    — BEFORE UPDATE trigger (direct UPDATE blocked too)
--        - transition_order_status()          — RPC the admin/customer UI uses
--   D. Phase D tables: business_settings, media_assets, delivery_zones, provider_orders
--
-- Security: all functions SECURITY DEFINER + SET search_path = public.
--   record_payment_result → EXECUTE ONLY service_role.
--   Customer-facing RPCs → EXECUTE authenticated only (self-guard inside too).
-- Idempotent: safe to re-run.
-- ============================================

BEGIN;

-- ============================================
-- A. ORDERS CHECK — total_amount >= 0 (P0-4 item 3)
-- ============================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_total_nonneg;
ALTER TABLE public.orders ADD CONSTRAINT orders_total_nonneg CHECK (total_amount >= 0);

-- ============================================
-- B.1 Payment intents idempotency index
-- ============================================
DROP INDEX IF EXISTS uq_payment_intents_provider_id;
CREATE UNIQUE INDEX uq_payment_intents_provider_id
  ON public.payment_intents (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- ============================================
-- B.2 record_payment_result — stripe-webhook Edge Function only (service_role)
--     idempotent (unique payment_intent_id) + amount-match vs orders.total_amount
-- ============================================
CREATE OR REPLACE FUNCTION public.record_payment_result(
  p_order_number text,
  p_payment_intent_id text,
  p_amount numeric,
  p_currency text DEFAULT 'thb',
  p_status text DEFAULT 'completed',
  p_failure_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_total numeric;
  v_existing text;
  v_new_payment_status text;
BEGIN
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;
  IF p_payment_intent_id IS NULL OR trim(p_payment_intent_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_PAYMENT_INTENT_ID';
  END IF;

  -- Idempotency: already applied → return current state.
  SELECT status INTO v_existing
    FROM public.payment_intents
   WHERE payment_intent_id = p_payment_intent_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'order_number', p_order_number,
      'payment_status', (SELECT payment_status FROM public.orders WHERE order_number = p_order_number),
      'intent_status', v_existing
    );
  END IF;

  -- Authoritative amount check.
  SELECT total_amount INTO v_order_total
    FROM public.orders
   WHERE order_number = p_order_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND';
  END IF;
  IF COALESCE(p_amount, -1) <> v_order_total THEN
    RAISE EXCEPTION 'ERR_AMOUNT_MISMATCH';
  END IF;

  v_new_payment_status := CASE
    WHEN p_status = 'completed' THEN 'paid'
    WHEN p_status = 'failed'    THEN 'pending'
    ELSE 'pending'
  END;

  UPDATE public.payment_intents
     SET status            = p_status,
         payment_intent_id = COALESCE(payment_intent_id, p_payment_intent_id),
         amount            = p_amount,
         currency          = p_currency,
         failure_reason    = COALESCE(p_failure_reason, failure_reason),
         completed_at      = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
         updated_at        = NOW()
   WHERE order_number      = p_order_number;

  UPDATE public.orders
     SET payment_status = v_new_payment_status::payment_status,
         updated_at     = NOW()
   WHERE order_number = p_order_number;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'order_number', p_order_number,
    'payment_status', v_new_payment_status
  );
END;
$$;
-- ============================================
-- B.3 create_payment_intent_record — client (non-card) intent rows
--     Amount MUST equal the authoritative orders.total_amount.
-- ============================================
CREATE OR REPLACE FUNCTION public.create_payment_intent_record(
  p_order_number text,
  p_amount numeric,
  p_method payment_method DEFAULT 'promptpay_qr',
  p_provider text DEFAULT 'promptpay',
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_order_total numeric;
  v_pi_id text;
  v_is_admin boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  v_is_admin := public.is_admin();
  SELECT total_amount INTO v_order_total
    FROM public.orders
   WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF NOT v_is_admin AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE order_number = p_order_number AND customer_ref = v_uid
  ) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF v_order_total IS DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'ERR_AMOUNT_MISMATCH';
  END IF;

  v_pi_id := 'pi-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
             || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.payment_intents (
    id, order_number, amount, currency, status, method, provider, metadata, created_at, updated_at
  ) VALUES (
    v_pi_id, p_order_number, p_amount, 'thb', 'pending', p_method::text, p_provider, COALESCE(p_metadata, '{}'), NOW(), NOW()
  );

  RETURN jsonb_build_object(
    'id', v_pi_id,
    'order_number', p_order_number,
    'amount', p_amount,
    'status', 'pending',
    'method', p_method::text
  );
END;
$$;

-- ============================================
-- B.4 submit_offline_payment_reference — customer records PromptPay TXN id
--     pending → processing (kitchen still verifies + confirms via confirm_offline_payment).
-- ============================================
CREATE OR REPLACE FUNCTION public.submit_offline_payment_reference(
  p_order_number text,
  p_reference text
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
  IF p_order_number IS NULL OR trim(p_order_number) = '' OR p_reference IS NULL OR trim(p_reference) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_REFERENCE';
  END IF;

  UPDATE public.payment_intents
     SET status     = 'processing',
         metadata   = jsonb_set(COALESCE(metadata, '{}'), '{reference}', (trim(p_reference))::jsonb),
         updated_at = NOW()
   WHERE order_number = p_order_number
     AND method = 'promptpay_qr'
     AND status = 'pending'
     AND EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = p_order_number AND o.customer_ref = v_uid);

  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NO_PENDING_PROMPTPAY'; END IF;

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'intent_status', 'processing');
END;
$$;
-- ============================================
-- B.5 confirm_offline_payment — ADMIN ONLY
--     - cash_on_delivery: order must have been DELIVERED (door collected).
--     - promptpay_qr   : customer must have submitted a TXN reference (processing).
--     Idempotent: payment_status = 'paid' already → ok.
-- ============================================
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
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT payment_status INTO v_paid_status
    FROM public.orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF v_paid_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order_number', p_order_number);
  END IF;

  SELECT payment_method, status INTO v_payment_method, v_order_status
    FROM public.orders WHERE order_number = p_order_number;

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
     ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NO_PAYMENT_INTENT'; END IF;
    IF v_intent_status <> 'processing' THEN
      RAISE EXCEPTION 'ERR_INTENT_NOT_PROCESSING';
    END IF;
    UPDATE public.payment_intents
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE id = v_intent_id;
  END IF;

  UPDATE public.orders
     SET payment_status = 'paid', updated_at = NOW()
   WHERE order_number = p_order_number;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'order_number', p_order_number, 'payment_status', 'paid');
END;
$$;

-- ============================================
-- B.6 mark_payment_failed — ADMIN ONLY (idempotent)
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_payment_failed(
  p_order_number text,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  UPDATE public.payment_intents
     SET status = 'failed', failure_reason = COALESCE(NULLIF(p_reason, ''), 'admin'), updated_at = NOW()
   WHERE order_number = p_order_number AND status IN ('pending', 'processing');

  UPDATE public.orders
     SET updated_at = NOW()
   WHERE order_number = p_order_number;

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'payment_status', 'pending');
END;
$$;
-- ============================================
-- C. ORDER STATE MACHINE (P0-6)
--    order_transition_allowed = single source of truth used by BOTH the
--    BEFORE UPDATE trigger AND the transition_order_status RPC.
-- ============================================

-- C.1 Allow-list validator (pure, deterministic)
CREATE OR REPLACE FUNCTION public.order_transition_allowed(
  p_from text,
  p_to text,
  p_is_admin boolean,
  p_is_owner boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      WHEN (p_from IN ('pending','confirmed','preparing','ready_for_dispatch','dispatched','in_transit','arrived') AND p_to = 'cancelled') THEN RETURN true;
      WHEN (p_from IN ('pending','confirmed','preparing','ready_for_dispatch','dispatched','in_transit','arrived') AND p_to = 'failed') THEN RETURN true;
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
$$;

-- C.2 BEFORE UPDATE trigger — blocks ANY direct UPDATE that jumps/skips states
CREATE OR REPLACE FUNCTION public.guard_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_owner boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_is_admin := public.is_admin();
    v_is_owner := (OLD.customer_ref IS NOT NULL AND OLD.customer_ref = auth.uid());
    IF NOT public.order_transition_allowed(OLD.status::text, NEW.status::text, v_is_admin, v_is_owner) THEN
      RAISE EXCEPTION 'FORBIDDEN: invalid order status transition % -> %',
  OLD.status::text,
  NEW.status::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_guard_status_transition ON orders;
CREATE TRIGGER orders_guard_status_transition
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_status_transition();
-- ============================================
-- C.3 transition_order_status — RPC the UI calls (admin or customer self-cancel)
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

  RETURN jsonb_build_object(
    'ok', true,
    'order_number', p_order_number,
    'from', v_old::text,
    'to', p_new_status::text
  );
END;
$$;

-- ============================================
-- D. PHASE D TABLES (from DATABASE_SECURITY_AUDIT §5.2 missing list)
-- ============================================

-- D.1 business_settings (key/value JSON)
CREATE TABLE IF NOT EXISTS public.business_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the hardcoded kitchen coordinates so admin/Settings can manage them
INSERT INTO public.business_settings (key, value) VALUES
  ('kitchen_location', '{"latitude":10.7016,"longitude":102.1429,"address":"Bite Me Baby Kitchen"}'),
  ('delivery_policy',  '{"radius_km":10,"currency":"THB","min_order":0}'),
  ('hours',            '{"open":"10:00","close":"22:00"}')
ON CONFLICT (key) DO NOTHING;

-- D.2 media_assets (admin media library metadata; files live in Storage bucket bmb-images)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id         TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  alt        TEXT NOT NULL DEFAULT '',
  kind       TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image','video','logo','hero','mascot')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- D.3 delivery_zones (fee/distance policy — replaces hardcoded externalProviders)
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  min_distance_km NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_distance_km NUMERIC(6,2) NOT NULL DEFAULT 10,
  fee             NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- D.4 provider_orders (delivery provider orders — replaces localStorage bmb_provider_orders)
CREATE TABLE IF NOT EXISTS public.provider_orders (
  id                      TEXT PRIMARY KEY,
  order_number            TEXT NOT NULL REFERENCES public.orders(order_number) ON DELETE CASCADE,
  provider_id             TEXT NOT NULL,
  provider_name           TEXT NOT NULL DEFAULT '',
  status                  TEXT NOT NULL DEFAULT 'requested',
  pickup_latitude         NUMERIC(10,7),
  pickup_longitude        NUMERIC(10,7),
  dropoff_latitude        NUMERIC(10,7),
  dropoff_longitude       NUMERIC(10,7),
  dropoff_detail          TEXT NOT NULL DEFAULT '',
  items_count             INTEGER NOT NULL DEFAULT 0,
  total_weight            NUMERIC(10,3) NOT NULL DEFAULT 0,
  estimated_delivery_time INTEGER,
  actual_delivery_time    INTEGER,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ============================================
-- E. RLS POLICIES for Phase D tables
-- ============================================
-- business_settings: anon deny; authenticated read (checkout safety read); admin manage
DROP POLICY IF EXISTS business_settings_anon ON business_settings;
CREATE POLICY business_settings_anon ON business_settings FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS business_settings_auth_read ON business_settings;
CREATE POLICY business_settings_auth_read ON business_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS business_settings_admin ON business_settings;
CREATE POLICY business_settings_admin ON business_settings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- media_assets: public read (site assets); admin manage
DROP POLICY IF EXISTS media_assets_public_read ON media_assets;
CREATE POLICY media_assets_public_read ON media_assets
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS media_assets_admin ON media_assets;
CREATE POLICY media_assets_admin ON media_assets
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- delivery_zones: public read active only; admin manage
DROP POLICY IF EXISTS delivery_zones_public_read ON delivery_zones;
CREATE POLICY delivery_zones_public_read ON delivery_zones
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS delivery_zones_admin ON delivery_zones;
CREATE POLICY delivery_zones_admin ON delivery_zones
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- provider_orders: anon deny; authenticated own (via orders.customer_ref); admin all
DROP POLICY IF EXISTS provider_orders_anon ON provider_orders;
CREATE POLICY provider_orders_anon ON provider_orders FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS provider_orders_own ON provider_orders;
CREATE POLICY provider_orders_own ON provider_orders
  FOR SELECT TO authenticated
  USING (order_number IN (SELECT order_number FROM public.orders WHERE customer_ref = auth.uid()));

DROP POLICY IF EXISTS provider_orders_admin ON provider_orders;
CREATE POLICY provider_orders_admin ON provider_orders
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================
-- F. GRANTS (EXECUTE only for the intended actors)
-- ============================================
REVOKE EXECUTE ON FUNCTION public.record_payment_result FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_result TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_payment_intent_record FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_intent_record TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_offline_payment_reference FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_offline_payment_reference TO authenticated;

REVOKE EXECUTE ON FUNCTION public.confirm_offline_payment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_offline_payment TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_payment_failed FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_payment_failed TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transition_order_status FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_order_status TO authenticated;

REVOKE EXECUTE ON FUNCTION public.order_transition_allowed FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_transition_allowed TO service_role;

REVOKE EXECUTE ON FUNCTION public.guard_order_status_transition FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_order_status_transition TO service_role;

-- Phase D tables: enable RLS (policies above)
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_orders    ENABLE ROW LEVEL SECURITY;

-- ============================================
-- G. DONE
-- ============================================
COMMIT;

-- ============================================
-- END OF MIGRATION 008
-- ============================================