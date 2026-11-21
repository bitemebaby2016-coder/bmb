-- ============================================
-- Bite Me Baby — SQL Contract: Migration 210 Rider my_deliveries v3 JOIN fix + offline gate + arrived completeness
-- Date: 2026-11-21 · Run on ephemeral PG (contract-tests.yml) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves (ตามแผน 210):
--   G1  my_deliveries 5-arg executes without 42703 "column o.round_id does not exist"
--       → returns assignments + offers with scheduled_date populated from delivery_rounds.scheduled_date
--   G2  Filter params (p_assigned_from/to, p_scheduled_from/to) work correctly
--   G3  Both assignments AND offers come through my_deliveries (JOIN via o.delivery_round_id fixed)
--   G4  Offline gate: driver_accept_assignment + claim_dispatch_offer → ERR_DRIVER_OFFLINE when driver.status='offline'
--   G5  'arrived' auto-close: cancel order while assignment='arrived' → assignment auto-closes + driver released
--   G6  Ambiguity guards: 0-arg/1-arg resolve unambiguously (same as m207)
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- Fixtures: admin, customer, riders (one available, one offline)
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('210-0000-0000-0000-000000000001', 'c210-admin@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('210-0000-0000-0000-000000000002', 'c210-cust@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('210-0000-0000-0000-000000000003', 'c210-rider-available@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('210-0000-0000-0000-000000000004', 'c210-rider-offline@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET role = 'admin' WHERE id = '210-0000-0000-0000-000000000001';
UPDATE public.profiles SET role = 'customer' WHERE id IN ('210-0000-0000-0000-000000000002', '210-0000-0000-0000-000000000003', '210-0000-0000-0000-000000000004');

-- Business settings for kitchen location
INSERT INTO public.business_settings (key, value)
VALUES ('kitchen_location', '{"latitude":10.7016,"longitude":102.1429}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Ensure delivery round exists for today (BKK timezone)
SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
UPDATE public.delivery_rounds
   SET max_capacity = 50, current_count = 0, cutoff_time = '23:59'
 WHERE scheduled_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;

-- Inventory
UPDATE public.inventory SET current_stock = 999999;
DELETE FROM public.inventory_transactions;

-- Riders
INSERT INTO public.drivers (id, name, phone, status, user_id, created_at, updated_at)
VALUES
  ('drv-210-available', '210 Rider Available', '0955555551', 'available', '210-0000-0000-0000-000000000003', NOW(), NOW()),
  ('drv-210-offline',   '210 Rider Offline',   '0955555552', 'offline',   '210-0000-0000-0000-000000000004', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, user_id = EXCLUDED.user_id;

-- Grant for contract execution
GRANT SELECT ON public.orders, public.delivery_assignments, public.drivers, public.audit_logs, public.order_status_history, public.dispatch_offers, public.notifications, public.delivery_rounds TO authenticated;

-- Helper: create order + assign driver (admin context)
CREATE OR REPLACE FUNCTION pg_temp.c210_make_order(p_rider_id text, p_status text DEFAULT 'ready_for_dispatch') RETURNS text AS $fn$
DECLARE
  v_on text; v_lat numeric; v_lon numeric;
BEGIN
  v_lat := (public.kitchen_location()->>'latitude')::numeric + 0.002;
  v_lon := (public.kitchen_location()->>'longitude')::numeric + 0.002;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000001","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_delivery_address => 'C210 Test Address',
    p_dropoff_latitude => v_lat, p_dropoff_longitude => v_lon,
    p_customer_name => 'C210 Customer', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL c210 order create'; END IF;

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000001","role":"authenticated"}', false);
  PERFORM public.transition_order_status(v_on, 'confirmed');
  PERFORM public.transition_order_status(v_on, 'preparing');
  PERFORM public.transition_order_status(v_on, 'ready_for_dispatch');

  IF p_status <> 'ready_for_dispatch' THEN
    PERFORM public.assign_driver(v_on, p_rider_id);
    IF p_status = 'accepted' THEN
      PERFORM set_config('role', 'authenticated', false);
      PERFORM set_config('request.jwt.claims', '{"sub":(SELECT user_id FROM public.drivers WHERE id=' || quote_literal(p_rider_id) || '),"role":"authenticated"}', false);
      PERFORM public.driver_accept_assignment(v_on, '');
    ELSIF p_status = 'picked_up' THEN
      PERFORM set_config('role', 'authenticated', false);
      PERFORM set_config('request.jwt.claims', '{"sub":(SELECT user_id FROM public.drivers WHERE id=' || quote_literal(p_rider_id) || '),"role":"authenticated"}', false);
      PERFORM public.driver_accept_assignment(v_on, '');
      PERFORM public.driver_update_delivery_status(v_on, '', 'picked_up', v_lat, v_lon);
    ELSIF p_status = 'arrived' THEN
      PERFORM set_config('role', 'authenticated', false);
      PERFORM set_config('request.jwt.claims', '{"sub":(SELECT user_id FROM public.drivers WHERE id=' || quote_literal(p_rider_id) || '),"role":"authenticated"}', false);
      PERFORM public.driver_accept_assignment(v_on, '');
      PERFORM public.driver_update_delivery_status(v_on, '', 'picked_up', v_lat, v_lon);
      PERFORM public.driver_update_delivery_status(v_on, '', 'in_transit', v_lat, v_lon);
      PERFORM public.driver_checkin_arrival(v_on, v_lat, v_lon);
    END IF;
  END IF;
  RETURN v_on;
END $fn$ LANGUAGE plpgsql;

-- ============================================
-- G1. my_deliveries 5-arg executes without 42703, returns scheduled_date
-- ============================================
DO $$ DECLARE
  v_on text; v_json jsonb; v_drv_id text; v_sched date;
BEGIN
  -- Create order + assign to available rider
  v_on := pg_temp.c210_make_order('drv-210-available', 'assigned');

  -- Call as the available rider (authenticated)
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000003","role":"authenticated"}', false);

  -- 5-arg call (all NULL = no filters) — must NOT throw 42703
  v_json := public.my_deliveries('', NULL, NULL, NULL, NULL);
  IF (v_json->>'ok') <> 'true' THEN RAISE EXCEPTION 'FAIL G1 my_deliveries ok=false: %', v_json; END IF;

  -- Verify scheduled_date present in assignments
  v_drv_id := (v_json->'driver'->>'id');
  IF v_drv_id IS NULL THEN RAISE EXCEPTION 'FAIL G1 driver.id missing'; END IF;
  v_sched := (v_json->'assignments'->0->>'scheduled_date')::date;
  IF v_sched IS NULL THEN
    RAISE EXCEPTION 'FAIL G1 scheduled_date missing in assignments (should come from delivery_rounds.scheduled_date)';
  END IF;
  IF v_sched <> (now() AT TIME ZONE 'Asia/Bangkok')::date THEN
    RAISE EXCEPTION 'FAIL G1 scheduled_date mismatch: got % expected %', v_sched, (now() AT TIME ZONE 'Asia/Bangkok')::date;
  END IF;

  -- Also verify offers array exists (even if empty)
  IF (v_json->'offers') IS NULL THEN RAISE EXCEPTION 'FAIL G1 offers array missing'; END IF;

  RAISE NOTICE 'PASS G1: my_deliveries 5-arg executes (no 42703) + scheduled_date = %', v_sched;
END $$;

-- ============================================
-- G2. Filter params work (scheduled_from/to)
-- ============================================
DO $$ DECLARE
  v_json jsonb; v_count int;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000003","role":"authenticated"}', false);

  -- scheduled_from = tomorrow → should filter out today's assignment
  v_json := public.my_deliveries('', NULL, NULL, (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, NULL);
  IF (v_json->>'ok') <> 'true' THEN RAISE EXCEPTION 'FAIL G2 filter ok=false: %', v_json; END IF;
  v_count := jsonb_array_length(v_json->'assignments');
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL G2 scheduled_from tomorrow should filter out today: got %', v_count; END IF;

  -- scheduled_to = today → should include today's assignment
  v_json := public.my_deliveries('', NULL, NULL, NULL, (now() AT TIME ZONE 'Asia/Bangkok')::date);
  IF (v_json->>'ok') <> 'true' THEN RAISE EXCEPTION 'FAIL G2 filter ok=false: %', v_json; END IF;
  v_count := jsonb_array_length(v_json->'assignments');
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL G2 scheduled_to today should include today: got %', v_count; END IF;

  RAISE NOTICE 'PASS G2: filter params scheduled_from/to work correctly';
END $$;

-- ============================================
-- G3. Offers come through my_deliveries (JOIN fixed)
-- ============================================
DO $$ DECLARE
  v_on text; v_json jsonb; v_offers_count int;
BEGIN
  -- Admin dispatch an offer (no driver assigned yet)
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000001","role":"authenticated"}', false);

  -- Need a fresh order in ready_for_dispatch
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000001","role":"authenticated"}', false);
  v_on := pg_temp.c210_make_order('drv-210-available', 'ready_for_dispatch');
  -- Unassign to make it an offer target
  PERFORM public.admin_cancel_assignment(v_on, 'test unassign for offer');

  -- Dispatch offer
  PERFORM public.dispatch_order(v_on);

  -- Now as available rider, my_deliveries should return the offer
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000003","role":"authenticated"}', false);

  v_json := public.my_deliveries('', NULL, NULL, NULL, NULL);
  IF (v_json->>'ok') <> 'true' THEN RAISE EXCEPTION 'FAIL G3 my_deliveries ok=false: %', v_json; END IF;
  v_offers_count := jsonb_array_length(v_json->'offers');
  IF v_offers_count < 1 THEN RAISE EXCEPTION 'FAIL G3 offer not returned in my_deliveries (JOIN broken?)'; END IF;

  -- Verify offer has scheduled_date from round
  IF (v_json->'offers'->0->>'scheduled_date') IS NULL THEN
    RAISE EXCEPTION 'FAIL G3 offer missing scheduled_date';
  END IF;

  RAISE NOTICE 'PASS G3: offers returned with scheduled_date = %', v_json->'offers'->0->>'scheduled_date';
END $$;

-- ============================================
-- G4. Offline gate: driver_accept_assignment + claim_dispatch_offer → ERR_DRIVER_OFFLINE
-- ============================================
DO $$ DECLARE
  v_on text; v_r jsonb;
BEGIN
  -- Test driver_accept_assignment with offline rider
  v_on := pg_temp.c210_make_order('drv-210-offline', 'assigned');

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000004","role":"authenticated"}', false);

  BEGIN
    v_r := public.driver_accept_assignment(v_on, '');
    RAISE EXCEPTION 'FAIL G4 driver_accept_assignment should ERR_DRIVER_OFFLINE but got: %', v_r;
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM LIKE '%ERR_DRIVER_OFFLINE%' THEN
        RAISE NOTICE 'PASS G4a: driver_accept_assignment offline gate → ERR_DRIVER_OFFLINE';
      ELSE
        RAISE EXCEPTION 'FAIL G4a wrong error: %', SQLERRM;
      END IF;
  END;

  -- Test claim_dispatch_offer with offline rider
  -- Need a fresh offer
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000001","role":"authenticated"}', false);
  v_on := pg_temp.c210_make_order('drv-210-available', 'ready_for_dispatch');
  PERFORM public.admin_cancel_assignment(v_on, 'test unassign for offer 2');
  PERFORM public.dispatch_order(v_on);

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000004","role":"authenticated"}', false);

  BEGIN
    v_r := public.claim_dispatch_offer(v_on);
    RAISE EXCEPTION 'FAIL G4b claim_dispatch_offer should ERR_DRIVER_OFFLINE but got: %', v_r;
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM LIKE '%ERR_DRIVER_OFFLINE%' THEN
        RAISE NOTICE 'PASS G4b: claim_dispatch_offer offline gate → ERR_DRIVER_OFFLINE';
      ELSE
        RAISE EXCEPTION 'FAIL G4b wrong error: %', SQLERRM;
      END IF;
  END;
END $$;

-- ============================================
-- G5. 'arrived' auto-close when order cancelled
-- ============================================
DO $$ DECLARE
  v_on text; v_asg_status text;
BEGIN
  -- Create order assigned to available rider, advance to 'arrived'
  v_on := pg_temp.c210_make_order('drv-210-available', 'arrived');

  -- Verify assignment is 'arrived'
  SELECT status INTO v_asg_status FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg_status IS DISTINCT FROM 'arrived' THEN
    RAISE EXCEPTION 'FAIL G5 setup: assignment not arrived: %', v_asg_status;
  END IF;

  -- Admin cancels the order
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"210-0000-0000-0000-000000000001","role":"authenticated"}', false);
  PERFORM public.admin_cancel_order(v_on, 'test cancel arrived');

  -- Check assignment auto-closed to 'cancelled'
  SELECT status INTO v_asg_status FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg_status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'FAIL G5: arrived assignment not auto-closed on order cancel: %', v_asg_status;
  END IF;

  -- Check driver released to 'available'
  DECLARE v_drv_status text;
  BEGIN
    SELECT status INTO v_drv_status FROM public.drivers WHERE id = 'drv-210-available';
    IF v_drv_status IS DISTINCT FROM 'available' THEN
      RAISE EXCEPTION 'FAIL G5: driver not released to available: %', v_drv_status;
    END IF;
  END;

  RAISE NOTICE 'PASS G5: arrived assignment auto-closed on order cancel + driver released';
END $$;

-- ============================================
-- G6. Ambiguity guards (0-arg/1-arg resolve unambiguously)
-- ============================================
DO $$ BEGIN
  PERFORM public.my_deliveries();
  RAISE EXCEPTION 'FAIL G6 0-arg unexpected OK';
EXCEPTION
  WHEN ambiguous_function THEN
    RAISE EXCEPTION 'FAIL G6 0-arg ambiguous_function (42725)';
  WHEN raise_exception THEN
    IF SQLERRM LIKE '%ERR_NOT_AUTHENTICATED%' THEN
      RAISE NOTICE 'PASS G6a: 0-arg resolves unambiguously (ERR_NOT_AUTHENTICATED)';
    ELSE
      RAISE EXCEPTION 'FAIL G6a 0-arg unexpected error: %', SQLERRM;
    END IF;
END $$;

DO $$ BEGIN
  PERFORM public.my_deliveries('0000000000'::text);
  RAISE EXCEPTION 'FAIL G6 1-arg unexpected OK';
EXCEPTION
  WHEN ambiguous_function THEN
    RAISE EXCEPTION 'FAIL G6 1-arg ambiguous_function (42725)';
  WHEN raise_exception THEN
    IF SQLERRM LIKE '%ERR_NOT_AUTHENTICATED%' THEN
      RAISE NOTICE 'PASS G6b: 1-arg resolves unambiguously (ERR_NOT_AUTHENTICATED)';
    ELSE
      RAISE EXCEPTION 'FAIL G6b 1-arg unexpected error: %', SQLERRM;
    END IF;
END $$;

-- ============================================
-- CLEANUP
-- ============================================
ROLLBACK;
RAISE NOTICE '=== CONTRACT 210 ALL G1-G6 PASS ===';

-- ========== END OF CONTRACT 210 ==========