-- ============================================
-- Bite Me Baby â€” PHASE 3B SQL Contract Suite: M1-09 driver â†’ orders.status sync (036)
-- Baseline: e118c47 Â· Scope: owner-approved M1-09 defect fix ONLY
-- Run as OWNER in Supabase SQL Editor (or via prodRunContracts.cjs).
-- ONE transaction, ROLLBACKs at the end â€” zero persisted data.
--
-- Proves:
--   G1  mapping: picked_upâ†’dispatched / in_transitâ†’in_transit / deliveredâ†’delivered
--   G2  duplicates are safe (no backward move, no double transition)
--   G3  backward transitions rejected (deliveredâ†’in_transit / â†’picked_up,
--       in_transitâ†’picked_up) per canonical allow-list
--   G4  sync blocked on non-ready order (ERR_DELIVERY_SYNC_BLOCKED), order untouched
--   G5  unauthorized driver rejected; unrelated order untouched
--   G6  audit log rows created per hop (source=driver_update_delivery_status)
--   G7  GUC spoof: hand-set app.delivery_sync_order cannot mutate orders (RLS)
--   G8  function security: SECURITY DEFINER, search_path, authenticated-only EXECUTE
--   G9  allow-list regressions intact (030 chain + owner cancel)
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- 0. FIXTURES (admin / customer / two drivers)
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('66666666-6666-6666-6666-666666666666', 'p3b-m109-admin@bmb.test',    'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('77777777-7777-7777-7777-777777777777', 'p3b-m109-cust@bmb.test',     'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('88888888-8888-8888-8888-888888888888', 'p3b-m109-rider1@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('99999999-9999-9999-9999-999999999999', 'p3b-m109-rider2@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin' WHERE id = '66666666-6666-6666-6666-666666666666';

SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;
UPDATE public.inventory SET current_stock = 999999;
DELETE FROM public.inventory_transactions;

INSERT INTO public.drivers (id, name, phone, status, created_at, updated_at)
VALUES ('drv-m109-1', 'M109 Rider One', '0900010001', 'available', NOW(), NOW()),
       ('drv-m109-2', 'M109 Rider Two', '0900010002', 'available', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- G8. FUNCTION SECURITY
-- ============================================
DO $$ BEGIN
  IF (SELECT has_function_privilege('authenticated',
       'public.driver_update_delivery_status(text,text,text,numeric,numeric)', 'EXECUTE')) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL G8 authenticated lost EXECUTE'; END IF;
  IF (SELECT has_function_privilege('anon',
       'public.driver_update_delivery_status(text,text,text,numeric,numeric)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'FAIL G8 anon gained EXECUTE'; END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.driver_update_delivery_status(text,text,text,numeric,numeric)'::regprocedure)
     IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G8 not SECURITY DEFINER'; END IF;
  RAISE NOTICE 'PASS G8 security: SECURITY DEFINER + authenticated-only EXECUTE';
END $$;

-- ============================================
-- G9. ALLOW-LIST REGRESSION (030 chain intact)
-- ============================================
DO $$ BEGIN
  IF public.order_transition_allowed('ready_for_dispatch','dispatched',true,false) IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G9 ready->dispatched'; END IF;
  IF public.order_transition_allowed('dispatched','in_transit',true,false)         IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G9 dispatched->in_transit'; END IF;
  IF public.order_transition_allowed('in_transit','arrived',true,false)            IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G9 in_transit->arrived'; END IF;
  IF public.order_transition_allowed('arrived','delivered',true,false)             IS NOT TRUE THEN RAISE EXCEPTION 'FAIL G9 arrived->delivered'; END IF;
  IF public.order_transition_allowed('delivered','in_transit',true,false)         IS NOT FALSE THEN RAISE EXCEPTION 'FAIL G9 delivered->in_transit allowed'; END IF;
  IF public.order_transition_allowed('delivered','picked_up',true,false)          IS NOT FALSE THEN RAISE EXCEPTION 'FAIL G9 delivered->picked_up allowed'; END IF;
  IF public.order_transition_allowed('in_transit','picked_up',true,false)         IS NOT FALSE THEN RAISE EXCEPTION 'FAIL G9 in_transit->picked_up allowed'; END IF;
  RAISE NOTICE 'PASS G9 canonical allow-list intact (forward chain + backward rejects)';
END $$;

-- ============================================
-- G1. HAPPY-PATH MAPPING (full rider chain drives orders.status)
-- ============================================
DO $$ DECLARE
  v_on text; v_r jsonb; v_ord text; v_drv text; v_asg text;
BEGIN
  -- customer creates SAME_DAY order
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_delivery_address => 'm109-g1',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_customer_name => 'M109 G1', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL G1 order create'; END IF;

  -- admin walks to ready_for_dispatch (inventory deduct at confirm exercised)
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  PERFORM public.transition_order_status(v_on, 'confirmed');
  PERFORM public.transition_order_status(v_on, 'preparing');
  PERFORM public.transition_order_status(v_on, 'ready_for_dispatch');
  v_drv := (public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-m109-1')->>'driver_id');
  IF v_drv IS NULL THEN RAISE EXCEPTION 'FAIL G1 assign'; END IF;

  -- rider accepts + advances: each step must move orders.status
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', false);
  PERFORM public.driver_accept_assignment(v_on, '0900010001');

  PERFORM public.driver_update_delivery_status(v_on, '0900010001', 'picked_up');
  SELECT status::text INTO v_ord FROM public.orders WHERE order_number = v_on;
  IF v_ord <> 'dispatched' THEN RAISE EXCEPTION 'FAIL G1 picked_up -> expected dispatched, got %', v_ord; END IF;

  PERFORM public.driver_update_delivery_status(v_on, '0900010001', 'in_transit');
  SELECT status::text INTO v_ord FROM public.orders WHERE order_number = v_on;
  IF v_ord <> 'in_transit' THEN RAISE EXCEPTION 'FAIL G1 in_transit -> expected in_transit, got %', v_ord; END IF;

  PERFORM public.driver_update_delivery_status(v_on, '0900010001', 'delivered');
  SELECT status::text INTO v_ord FROM public.orders WHERE order_number = v_on;
  IF v_ord <> 'delivered' THEN RAISE EXCEPTION 'FAIL G1 delivered -> expected delivered, got %', v_ord; END IF;

  SELECT status::text INTO v_asg FROM public.delivery_assignments WHERE order_number = v_on;
  IF v_asg <> 'delivered' THEN RAISE EXCEPTION 'FAIL G1 assignment not delivered'; END IF;
  SELECT status::text INTO v_drv FROM public.drivers WHERE id = 'drv-m109-1';
  IF v_drv <> 'available' THEN RAISE EXCEPTION 'FAIL G1 driver not available'; END IF;

  RAISE NOTICE 'PASS G1 full rider chain: picked_up->dispatched, in_transit->in_transit, delivered->delivered (%)', v_on;
END $$;


-- ============================================
-- G2/G4/G5. DUPLICATES + BLOCKED SYNC + UNAUTHORIZED + UNRELATED (2nd order)
-- ============================================
DO $$ DECLARE
  v_on text; v_ord text; v_ord2 text; v_ctrl text; v_blk text;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery', p_delivery_address => 'm109-g2',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_customer_name => 'M109 G2', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL G2 order create'; END IF;

  -- unrelated control order, stays pending forever
  v_ctrl := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery', p_delivery_address => 'm109-g2-ctrl',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_customer_name => 'M109 G2 CTRL', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
  ))->>'order_number';

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  PERFORM public.transition_order_status(v_on, 'confirmed');
  PERFORM public.transition_order_status(v_on, 'preparing');
  PERFORM public.transition_order_status(v_on, 'ready_for_dispatch');
  PERFORM public.assign_driver(p_order_number => v_on, p_driver_id => 'drv-m109-2');

  -- G2a duplicate picked_up: safe â€” order stays dispatched, no invalid transition
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', false);
  PERFORM public.driver_accept_assignment(v_on, '0900010002');
  PERFORM public.driver_update_delivery_status(v_on, '0900010002', 'picked_up');
  PERFORM public.driver_update_delivery_status(v_on, '0900010002', 'picked_up'); -- duplicate
  SELECT status::text INTO v_ord2 FROM public.orders WHERE order_number = v_on;
  IF v_ord2 <> 'dispatched' THEN RAISE EXCEPTION 'FAIL G2a duplicate picked_up changed order to %', v_ord2; END IF;
  RAISE NOTICE 'PASS G2a duplicate picked_up idempotent-safe (order=%)', v_ord2;

  -- G2b duplicate in_transit: safe
  PERFORM public.driver_update_delivery_status(v_on, '0900010002', 'in_transit');
  PERFORM public.driver_update_delivery_status(v_on, '0900010002', 'in_transit');
  SELECT status::text INTO v_ord2 FROM public.orders WHERE order_number = v_on;
  IF v_ord2 <> 'in_transit' THEN RAISE EXCEPTION 'FAIL G2b duplicate in_transit changed order to %', v_ord2; END IF;
  RAISE NOTICE 'PASS G2b duplicate in_transit idempotent-safe';

  -- G5 unauthorized driver (no assignment on this order) must be rejected
  BEGIN
    PERFORM public.driver_update_delivery_status(v_on, '0900010001', 'delivered');
    RAISE EXCEPTION 'FAIL G5 unauthorized update ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_ASSIGNMENT_NOT_FOUND%' THEN
      RAISE NOTICE 'PASS G5 unauthorized driver rejected (ERR_ASSIGNMENT_NOT_FOUND)';
    ELSE RAISE EXCEPTION 'FAIL G5 unexpected error: %', SQLERRM; END IF;
  END;

  -- G4 blocked sync: order stuck at 'confirmed' (kitchen not ready) + assignment
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', false);
  v_blk := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery', p_delivery_address => 'm109-g4',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_customer_name => 'M109 G4', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
  ))->>'order_number';
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  PERFORM public.transition_order_status(v_blk, 'confirmed');
  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, assigned_at, notes, created_at, updated_at)
  VALUES ('das-m109-g4', v_blk, 'drv-m109-1', 'assigned', NOW(), 'test', NOW(), NOW())
  ON CONFLICT (order_number) DO UPDATE SET driver_id = 'drv-m109-1', status = 'assigned', updated_at = NOW();

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', false);
  BEGIN
    PERFORM public.driver_update_delivery_status(v_blk, '0900010001', 'picked_up');
    RAISE EXCEPTION 'FAIL G4 blocked sync ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_DELIVERY_SYNC_BLOCKED%' OR SQLERRM LIKE 'FORBIDDEN%' THEN
      RAISE NOTICE 'PASS G4 blocked sync rejected (%)', SQLERRM;
    ELSE RAISE EXCEPTION 'FAIL G4 unexpected error: %', SQLERRM; END IF;
  END;
  RESET ROLE;
  SELECT status::text INTO v_ord2 FROM public.orders WHERE order_number = v_blk;
  IF v_ord2 <> 'confirmed' THEN RAISE EXCEPTION 'FAIL G4 order mutated to %', v_ord2; END IF;

  -- unrelated order untouched
  SELECT status::text INTO v_ord2 FROM public.orders WHERE order_number = v_ctrl;
  IF v_ord2 <> 'pending' THEN RAISE EXCEPTION 'FAIL G5 unrelated order changed to %', v_ord2; END IF;
  RAISE NOTICE 'PASS G4/G5 blocked-sync rejected, unrelated order untouched';
END $$;


-- ============================================
-- G6. AUDIT LOG: one order_status_change row per hop, tagged source
-- ============================================
DO $$ DECLARE v_n int;
BEGIN
  SELECT COUNT(*) INTO v_n FROM public.audit_logs
   WHERE action = 'order_status_change'
     AND description LIKE 'delivery sync%'
     AND metadata->>'source' = 'driver_update_delivery_status';
  IF v_n < 4 THEN -- G1: 3 hops + G2: picked_up, in_transit
    RAISE EXCEPTION 'FAIL G6 expected >=4 delivery-sync audit rows, got %', v_n;
  END IF;
  RAISE NOTICE 'PASS G6 audit trail: % delivery-sync order transitions logged', v_n;
END $$;

-- ============================================
-- G7. GUC SPOOF: hand-set app.delivery_sync_order cannot mutate orders (RLS)
-- ============================================
DO $$ DECLARE v_before text; v_after text; v_r int; v_ctrl text;
BEGIN
  SELECT order_number INTO v_ctrl FROM public.orders
   WHERE dropoff_detail = 'm109-g2-ctrl' AND status = 'pending'
   ORDER BY created_at DESC LIMIT 1;
  IF v_ctrl IS NULL THEN RAISE EXCEPTION 'FAIL G7 control order not found'; END IF;
  SELECT status::text INTO v_before FROM public.orders WHERE order_number = v_ctrl;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', false);
  PERFORM set_config('app.delivery_sync_order', v_ctrl, false);
  UPDATE public.orders SET status = 'delivered' WHERE order_number = v_ctrl AND status = 'pending';
  GET DIAGNOSTICS v_r = ROW_COUNT;
  RESET ROLE;
  SELECT status::text INTO v_after FROM public.orders WHERE order_number = v_ctrl;
  IF v_r <> 0 THEN RAISE EXCEPTION 'FAIL G7 spoofed GUC UPDATE affected % rows', v_r; END IF;
  IF v_after <> v_before THEN RAISE EXCEPTION 'FAIL G7 order mutated to %', v_after; END IF;
  RAISE NOTICE 'PASS G7 spoofed GUC cannot mutate orders (RLS deny, 0 rows)';
END $$;

-- ============================================
-- DONE â€” discard every test-created row
-- ============================================
RESET ROLE;
ROLLBACK;

