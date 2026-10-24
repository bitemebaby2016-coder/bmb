-- ============================================
-- Bite Me Baby — PHASE 3B SQL Contract Suite: M1 P0 blockers repaired (037)
-- Baseline: ed5f955 · Scope: PRE-02 035 resolution
-- ONE transaction, ROLLBACKs at the end — zero persisted data.
--
-- Proves:
--   G1  5km gate: self_delivery >5km rejected (fee + order creation)
--   G2  external providers NOT blocked
--   G3  zone fee at <=5km unchanged
--   G4  PRE_ORDER without address rejected
--   G5  PRE_ORDER with address OK + 036 sync coexists with trigger
--   G6  list_drivers DriverRow shape
--   G7  get_kitchen_summary shape
--   G8  list_recipes_with_inventory runs
--   G9  security: authenticated-only + admin gate
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'p3b-037-admin@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('bbbb2222-2222-2222-2222-222222222222', 'p3b-037-cust@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin' WHERE id = 'aaaa1111-1111-1111-1111-111111111111';

SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date + 2);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;
UPDATE public.inventory SET current_stock = 999999;

-- ============================================
-- G1. 5KM GATE — fee quote + order creation reject >5km self_delivery
-- ============================================
DO $$ DECLARE v_on text;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"bbbb2222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  BEGIN
    PERFORM public.compute_delivery_fee(10.85, 102.20, 'self_delivery', 1, 8.5);
    RAISE EXCEPTION 'FAIL G1 fee accepted >5km';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'SELF_DELIVERY_EXCEEDS_5KM_LIMIT%' THEN
      RAISE NOTICE 'PASS G1 fee gate rejects self_delivery >5km (%)', SQLERRM;
    ELSE RAISE EXCEPTION 'FAIL G1 unexpected: %', SQLERRM; END IF;
  END;

  BEGIN
    v_on := (public.create_order_with_items(
      p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
      p_delivery_method => 'self_delivery', p_delivery_address => 'm037-far',
      p_dropoff_latitude => 10.85, p_dropoff_longitude => 102.20,
      p_customer_name => 'M037 FAR', p_payment_method => 'cash_on_delivery',
      p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
    ))->>'order_number';
    RAISE EXCEPTION 'FAIL G1 order accepted >5km (got %)', v_on;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'SELF_DELIVERY_EXCEEDS_5KM_LIMIT%' THEN
      RAISE NOTICE 'PASS G1 order creation blocked >5km (server-enforced)';
    ELSE RAISE EXCEPTION 'FAIL G1 unexpected: %', SQLERRM; END IF;
  END;
END $$;

-- ============================================
-- G2/G3. EXTERNAL PROVIDERS OK + ZONE FEE UNCHANGED
-- ============================================
DO $$ BEGIN
  IF public.compute_delivery_fee(10.85, 102.20, 'grab_rider', 1, 8.5) IS NULL THEN
    RAISE EXCEPTION 'FAIL G2 grab_rider blocked'; END IF;
  IF public.compute_delivery_fee(10.7050, 102.1450, 'self_delivery', 1, 1.0) <> 25 THEN
    RAISE EXCEPTION 'FAIL G3 zone fee changed'; END IF;
  RAISE NOTICE 'PASS G2/G3 external providers allowed; <=5km fee unchanged';
END $$;


-- ============================================
-- G4/G5. PRE_ORDER ADDRESS TRIGGER + 036 SYNC COMPATIBILITY
-- ============================================
DO $$ DECLARE v_on text; v_ord text;
BEGIN
  BEGIN
    PERFORM set_config('role', 'authenticated', false);
    PERFORM set_config('request.jwt.claims', '{"sub":"bbbb2222-2222-2222-2222-222222222222","role":"authenticated"}', false);
    v_on := (public.create_order_with_items(
      p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
      p_delivery_method => 'self_delivery', p_delivery_address => '',
      p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
      p_customer_name => 'M037 NOADDR', p_payment_method => 'cash_on_delivery',
      p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 2,
      p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 2,'YYYYMMDD') || '-morning'
    ))->>'order_number';
    RAISE EXCEPTION 'FAIL G4 PRE_ORDER without address ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_PRE_ORDER_REQUIRES_ADDRESS%' THEN
      RAISE NOTICE 'PASS G4 PRE_ORDER without address rejected';
    ELSE RAISE EXCEPTION 'FAIL G4 unexpected: %', SQLERRM; END IF;
  END;

  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery', p_delivery_address => 'm037-pre',
    p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
    p_customer_name => 'M037 PRE', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 2
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL G5 PRE_ORDER create'; END IF;

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaa1111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  PERFORM public.transition_order_status(v_on, 'confirmed');
  PERFORM public.transition_order_status(v_on, 'preparing');
  PERFORM public.transition_order_status(v_on, 'ready_for_dispatch');
  PERFORM public.driver_login('0900037001', 'M037 Rider');
  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, assigned_at, notes, created_at, updated_at)
  VALUES ('das-m037', v_on, (SELECT id FROM public.drivers WHERE phone='0900037001'), 'assigned', NOW(), 'test', NOW(), NOW())
  ON CONFLICT (order_number) DO UPDATE SET driver_id = (SELECT id FROM public.drivers WHERE phone='0900037001'), status = 'assigned', updated_at = NOW();
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"bbbb2222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  PERFORM public.driver_update_delivery_status(v_on, '0900037001', 'picked_up');
  SELECT status::text INTO v_ord FROM public.orders WHERE order_number = v_on;
  IF v_ord <> 'dispatched' THEN RAISE EXCEPTION 'FAIL G5 036 sync broken (got %)', v_ord; END IF;
  RAISE NOTICE 'PASS G5 trigger coexists with 036 delivery sync (% -> dispatched)', v_on;
END $$;


-- ============================================
-- G6/G7/G8. ADMIN RPC SHAPES
-- ============================================
DO $$ DECLARE r jsonb;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaa1111-1111-1111-1111-111111111111","role":"authenticated"}', false);

  r := public.list_drivers();
  IF (r->>'ok') <> 'true' OR jsonb_array_length(r->'drivers') < 1 THEN RAISE EXCEPTION 'FAIL G6 list_drivers'; END IF;
  IF (r->'drivers'->0->>'driver_name') IS NULL OR (r->'drivers'->0->>'phone_number') IS NULL THEN
    RAISE EXCEPTION 'FAIL G6 list_drivers aliases missing'; END IF;
  RAISE NOTICE 'PASS G6 list_drivers DriverRow shape ok (count=%)', r->>'count';

  r := public.get_kitchen_summary((now() AT TIME ZONE 'Asia/Bangkok')::date);
  IF (r->>'ok') <> 'true' OR (r->'summary'->>'pending_orders') IS NULL THEN RAISE EXCEPTION 'FAIL G7 kitchen summary'; END IF;
  RAISE NOTICE 'PASS G7 get_kitchen_summary shape ok (batches=%)', r->>'total_batches';

  r := public.list_recipes_with_inventory(NULL);
  IF (r->>'ok') <> 'true' OR (r->>'recipes') IS NULL THEN RAISE EXCEPTION 'FAIL G8 recipes'; END IF;
  RAISE NOTICE 'PASS G8 list_recipes_with_inventory ok (count=%)', r->>'count';
END $$;

-- ============================================
-- G9. SECURITY — grants + admin gate
-- ============================================
DO $$ BEGIN
  IF (SELECT has_function_privilege('anon', 'public.list_drivers()', 'EXECUTE')) THEN
    RAISE EXCEPTION 'FAIL G9 anon EXECUTE'; END IF;
  IF (SELECT has_function_privilege('authenticated', 'public.get_kitchen_summary(date)', 'EXECUTE')) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL G9 authenticated EXECUTE lost'; END IF;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"bbbb2222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  BEGIN
    PERFORM public.list_drivers();
    RAISE EXCEPTION 'FAIL G9 non-admin accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_FORBIDDEN%' THEN
      RAISE NOTICE 'PASS G9 non-admin rejected + grants correct';
    ELSE RAISE EXCEPTION 'FAIL G9 unexpected: %', SQLERRM; END IF;
  END;
END $$;

RESET ROLE;
ROLLBACK;

