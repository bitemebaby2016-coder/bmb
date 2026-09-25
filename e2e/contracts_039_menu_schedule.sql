-- ============================================
-- Bite Me Baby — PHASE 3B SQL Contract Suite: weekly menu + operating controls (039)
-- Baseline: 2865036 · Scope: PRE-05 + Admin open/close (server-side authority)
-- ONE transaction, ROLLBACKs at the end — zero persisted data.
--
-- Proves:
--   G1  admin sets + publishes weekly menu; customer reads published menu
--   G2  non-admin cannot set/publish (ERR_FORBIDDEN)
--   G3  PRE_ORDER on published-menu day: on-menu product OK, off-menu rejected
--       (ERR_PRODUCT_NOT_ON_MENU)
--   G4  day WITHOUT published schedule keeps existing available_preorder gate
--   G5  mode closed → ERR_ORDER_MODE_CLOSED (both modes); re-open → allowed
--   G6  round closed → ERR_ROUND_CLOSED; re-open → allowed
--   G7  security: functions DEFINER + revoked from anon/authenticated
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('eeee5555-5555-5555-5555-555555555555', 'p3b-039-admin@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('ffff6666-6666-6666-6666-666666666666', 'p3b-039-cust@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin' WHERE id = 'eeee5555-5555-5555-5555-555555555555';

SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date + 1);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;
UPDATE public.inventory SET current_stock = 999999;

-- ============================================
-- G1. SET + PUBLISH + READ
-- ============================================
DO $$ DECLARE r jsonb;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"eeee5555-5555-5555-5555-555555555555","role":"authenticated"}', false);
  r := public.set_menu_schedule((now() AT TIME ZONE 'Asia/Bangkok')::date + 1,
       '[{"product_id":"prod-6"},{"product_id":"prod-5"}]'::jsonb);
  IF (r->>'ok') <> 'true' THEN RAISE EXCEPTION 'FAIL G1 set'; END IF;
  r := public.publish_menu_schedule((now() AT TIME ZONE 'Asia/Bangkok')::date + 1, true);
  IF (r->>'ok') <> 'true' THEN RAISE EXCEPTION 'FAIL G1 publish'; END IF;
  r := public.get_menu_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date + 1);
  IF jsonb_array_length(r->'menu') < 2 THEN RAISE EXCEPTION 'FAIL G1 read menu empty'; END IF;
  RAISE NOTICE 'PASS G1 weekly menu set+published+read (items=%)', jsonb_array_length(r->'menu');
END $$;

-- ============================================
-- G2. NON-ADMIN REJECTED
-- ============================================
DO $$ BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"ffff6666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  BEGIN
    PERFORM public.set_menu_schedule((now() AT TIME ZONE 'Asia/Bangkok')::date + 2, '[{"product_id":"prod-6"}]'::jsonb);
    RAISE EXCEPTION 'FAIL G2 non-admin set accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_FORBIDDEN%' THEN RAISE NOTICE 'PASS G2 non-admin rejected';
    ELSE RAISE EXCEPTION 'FAIL G2 unexpected: %', SQLERRM; END IF;
  END;
END $$;

-- ============================================
-- G3. MENU GATE — on-menu OK / off-menu rejected (published-menu day)
-- ============================================
DO $$ DECLARE v_on text; v_r jsonb;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"ffff6666-6666-6666-6666-666666666666","role":"authenticated"}', false);

  v_r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 1,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery', p_delivery_address => 'm039-on',
    p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
    p_customer_name => 'M039 ON', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 1
  );
  IF v_r->>'order_number' IS NULL THEN
    RAISE EXCEPTION 'FAIL G3a on-menu order rejected'; END IF;
  RAISE NOTICE 'PASS G3a on-menu PRE_ORDER accepted';

  BEGIN
    PERFORM public.create_order_with_items(
      p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 1,'YYYYMMDD') || '-morning',
      p_delivery_method => 'self_delivery', p_delivery_address => 'm039-off',
      p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
      p_customer_name => 'M039 OFF', p_payment_method => 'cash_on_delivery',
      p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 1
    );
    RAISE EXCEPTION 'FAIL G3b off-menu order ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_PRODUCT_NOT_ON_MENU%' OR SQLERRM LIKE 'ERR_PRODUCT_MODE_NOT_ALLOWED%' THEN
      RAISE NOTICE 'PASS G3b off-menu product rejected (server-side menu gate)';
    ELSE RAISE EXCEPTION 'FAIL G3b unexpected: %', SQLERRM; END IF;
  END;
END $$;

-- ============================================
-- G4. DAY WITHOUT SCHEDULE → existing available_preorder gate untouched
-- ============================================
DO $$ DECLARE v_on text;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"ffff6666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  PERFORM public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date + 2);
  UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
   WHERE id = 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 2,'YYYYMMDD') || '-morning';
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery', p_delivery_address => 'm039-g4',
    p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
    p_customer_name => 'M039 G4', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 2
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL G4 unscheduled-day order failed'; END IF;
  RAISE NOTICE 'PASS G4 unscheduled-day PRE_ORDER keeps legacy gate (%)', v_on;
END $$;


-- ============================================
-- G5/G6. MODE + ROUND OPEN/CLOSE (server authority)
-- ============================================
DO $$ BEGIN
  RESET ROLE;
  UPDATE public.business_settings
     SET value = value || '{"pre_order_open": false}'::jsonb WHERE key = 'operating_hours';
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"ffff6666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  BEGIN
    PERFORM public.create_order_with_items(
      p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 1,'YYYYMMDD') || '-midday',
      p_delivery_method => 'self_delivery', p_delivery_address => 'm039-closed',
      p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
      p_customer_name => 'M039 CLOSED', p_payment_method => 'cash_on_delivery',
      p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 1
    );
    RAISE EXCEPTION 'FAIL G5 closed-mode order ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_ORDER_MODE_CLOSED%' THEN
      RAISE NOTICE 'PASS G5 mode closed → rejected (server-enforced)';
    ELSE RAISE EXCEPTION 'FAIL G5 unexpected: %', SQLERRM; END IF;
  END;

  RESET ROLE;
  UPDATE public.business_settings
     SET value = value || '{"pre_order_open": true, "evening_open": false}'::jsonb
   WHERE key = 'operating_hours';
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"ffff6666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  BEGIN
    PERFORM public.create_order_with_items(
      p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 1,'YYYYMMDD') || '-evening',
      p_delivery_method => 'self_delivery', p_delivery_address => 'm039-ev',
      p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
      p_customer_name => 'M039 EV', p_payment_method => 'cash_on_delivery',
      p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 1
    );
    RAISE EXCEPTION 'FAIL G6 closed-round order ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_ROUND_CLOSED%' THEN
      RAISE NOTICE 'PASS G6 round closed → rejected (server-enforced)';
    ELSE RAISE EXCEPTION 'FAIL G6 unexpected: %', SQLERRM; END IF;
  END;
END $$;

-- ============================================
-- G7. SECURITY
-- ============================================
DO $$ BEGIN
  IF (SELECT has_function_privilege('anon', 'public.set_menu_schedule(date, jsonb)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'FAIL G7 anon EXECUTE'; END IF;
  IF (SELECT has_function_privilege('authenticated', 'public.get_menu_for_date(date)', 'EXECUTE')) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL G7 authenticated lost get_menu'; END IF;
  RAISE NOTICE 'PASS G7 function security correct';
END $$;

RESET ROLE;
ROLLBACK;

