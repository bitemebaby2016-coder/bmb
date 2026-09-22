-- ============================================
-- Bite Me Baby — PHASE 3B SQL Contract Suite: order_transition_allowed ELSE (030)
-- Baseline: fa93f9d · Scope: owner-approved F-1 fix ONLY (one ELSE line)
-- Run as OWNER in Supabase SQL Editor (or local psql). Read-only impact:
-- the suite runs in ONE transaction and ROLLBACKs at the end.
--
-- Proves (F-1 contract):
--   G1  allow-list regressions intact (admin chain + owner cancel + identity)
--   G2  off-allow-list pairs RETURN false WITHOUT raising case_not_found
--       (pre-030 this whole block dies with `case not found`)
--   G3  end-to-end admin: transition_order_status on a delivered order →
--       ERR_INVALID_TRANSITION (never `case not found`), order stays delivered
--   G4  end-to-end owner: cancel_order on own pending order still works
--       (pending + window + future PRE_ORDER date) and releases capacity
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- 0. FIXTURES
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('44444444-4444-4444-4444-444444444444', 'p3b-else-admin@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'p3b-else-cust@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
-- the auth.users INSERT trigger auto-creates profiles with role='customer'
UPDATE public.profiles SET role = 'admin' WHERE id = '44444444-4444-4444-4444-444444444444';

-- deterministic round landscape for the fixture dates (024) + wide cutoffs/capacity (028 pattern)
SELECT public.ensure_rounds_for_date(CURRENT_DATE + 2);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= CURRENT_DATE;

-- ============================================
-- G1. ALLOW-LIST REGRESSION — every canonical pair still allowed
-- ============================================
DO $$ BEGIN
  IF public.order_transition_allowed('pending','confirmed',true,false)             IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 pending->confirmed'; END IF;
  IF public.order_transition_allowed('confirmed','preparing',true,false)           IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 confirmed->preparing'; END IF;
  IF public.order_transition_allowed('preparing','ready_for_dispatch',true,false)  IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 preparing->ready'; END IF;
  IF public.order_transition_allowed('ready_for_dispatch','dispatched',true,false) IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 ready->dispatched'; END IF;
  IF public.order_transition_allowed('dispatched','in_transit',true,false)         IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 dispatched->in_transit'; END IF;
  IF public.order_transition_allowed('in_transit','arrived',true,false)            IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 in_transit->arrived'; END IF;
  IF public.order_transition_allowed('arrived','delivered',true,false)             IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 arrived->delivered'; END IF;
  IF public.order_transition_allowed('preparing','cancelled',true,false)           IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 preparing->cancelled'; END IF;
  IF public.order_transition_allowed('confirmed','failed',true,false)              IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 confirmed->failed'; END IF;
  IF public.order_transition_allowed('pending','pending',true,false)               IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 identity'; END IF;
  IF public.order_transition_allowed('pending','cancelled',false,true)             IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G1 owner pending->cancelled'; END IF;
  RAISE NOTICE 'PASS G1 allow-list regressions intact (admin chain + identity + owner cancel)';
END $$;

-- ============================================
-- G2. OFF-ALLOW-LIST PAIRS RETURN FALSE — no case_not_found
-- (pre-030: the FIRST probe here already raised `case not found`)
-- ============================================
DO $$ BEGIN
  IF public.order_transition_allowed('delivered','cancelled',true,true) IS NOT FALSE THEN RAISE EXCEPTION 'FAIL G2 delivered->cancelled'; END IF;
  IF public.order_transition_allowed('delivered','failed',true,true)    IS NOT FALSE THEN RAISE EXCEPTION 'FAIL G2 delivered->failed'; END IF;
  IF public.order_transition_allowed('pending','delivered',true,false)  IS NOT FALSE THEN RAISE EXCEPTION 'FAIL G2 pending->delivered'; END IF;
  IF public.order_transition_allowed('arrived','confirmed',true,false)  IS NOT FALSE THEN RAISE EXCEPTION 'FAIL G2 arrived->confirmed'; END IF;
  IF public.order_transition_allowed('in_transit','pending',true,false) IS NOT FALSE THEN RAISE EXCEPTION 'FAIL G2 in_transit->pending'; END IF;
  IF public.order_transition_allowed('failed','confirmed',true,false)   IS NOT FALSE THEN RAISE EXCEPTION 'FAIL G2 failed->confirmed'; END IF;
  IF public.order_transition_allowed('confirmed','cancelled',false,false) IS NOT FALSE THEN RAISE EXCEPTION 'FAIL G2 non-owner cancel'; END IF;
  IF public.order_transition_allowed('preparing','preparing',false,true) IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G2 owner identity'; END IF;
  RAISE NOTICE 'PASS G2 off-allow-list transitions return false (no case_not_found)';
END $$;

-- ============================================
-- G3. END-TO-END ADMIN: transition_order_status raises the CONTRACTED error
-- ============================================
DO $$ DECLARE
  v_on text;
BEGIN
  -- customer creates a real PRE_ORDER order (canonical RPC, migration 025 v3)
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_delivery_address => 'else-g3',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_customer_name => 'P3B ELSE G3', p_payment_method => 'promptpay_qr',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL G3 order create'; END IF;

  -- force the order to delivered (bypass the guard trigger for seeding only)
  RESET ROLE;
  SET session_replication_role = replica;
  UPDATE public.orders SET status = 'delivered' WHERE order_number = v_on;
  SET session_replication_role = origin;
  IF (SELECT status::text FROM public.orders WHERE order_number = v_on) <> 'delivered' THEN
    RAISE EXCEPTION 'FAIL G3 seed delivered'; END IF;

  -- admin attempts delivered -> cancelled: must raise ERR_INVALID_TRANSITION
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', false);
  BEGIN
    PERFORM public.transition_order_status(v_on, 'cancelled');
    RAISE EXCEPTION 'FAIL G3 invalid transition was ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_INVALID_TRANSITION%' THEN
      RAISE NOTICE 'PASS G3 admin delivered->cancelled rejected with ERR_INVALID_TRANSITION (%)', v_on;
    ELSIF SQLERRM LIKE '%case not found%' THEN
      RAISE EXCEPTION 'FAIL G3 internal case_not_found still surfaced (F-1 NOT fixed)';
    ELSE
      RAISE EXCEPTION 'FAIL G3 unexpected error: %', SQLERRM;
    END IF;
  END;

  -- same for delivered -> failed
  BEGIN
    PERFORM public.transition_order_status(v_on, 'failed');
    RAISE EXCEPTION 'FAIL G3b invalid transition was ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_INVALID_TRANSITION%' THEN
      RAISE NOTICE 'PASS G3b admin delivered->failed rejected with ERR_INVALID_TRANSITION';
    ELSIF SQLERRM LIKE '%case not found%' THEN
      RAISE EXCEPTION 'FAIL G3b internal case_not_found still surfaced';
    ELSE
      RAISE EXCEPTION 'FAIL G3b unexpected error: %', SQLERRM;
    END IF;
  END;

  -- no partial mutation happened
  RESET ROLE;
  IF (SELECT status::text FROM public.orders WHERE order_number = v_on) <> 'delivered' THEN
    RAISE EXCEPTION 'FAIL G3 order mutated by rejected transitions'; END IF;
END $$;

-- ============================================
-- G4. END-TO-END OWNER: cancel_order on own pending order still works
-- ============================================
DO $$ DECLARE
  v_on text; r jsonb; v_round text; v_before int; v_after int;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_delivery_address => 'else-g4',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_customer_name => 'P3B ELSE G4', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL G4 order create'; END IF;

  SELECT delivery_round_id INTO v_round FROM public.orders WHERE order_number = v_on;
  SELECT current_count INTO v_before FROM public.delivery_rounds WHERE id = v_round;

  r := public.cancel_order(p_order_number => v_on, p_reason => 'p3b else owner cancel');
  IF (r->>'status') <> 'cancelled' THEN RAISE EXCEPTION 'FAIL G4 cancel'; END IF;
  IF (r->>'capacity_released')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G4 capacity flag'; END IF;
  SELECT current_count INTO v_after FROM public.delivery_rounds WHERE id = v_round;
  IF v_after <> v_before - 1 THEN RAISE EXCEPTION 'FAIL G4 capacity % -> %', v_before, v_after; END IF;
  RAISE NOTICE 'PASS G4 owner cancel_order end-to-end (%, capacity % -> %)', v_on, v_before, v_after;
END $$;

-- ============================================
-- DONE — discard every test-created row
-- ============================================
RESET ROLE;
ROLLBACK;