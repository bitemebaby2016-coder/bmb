-- ============================================
-- Bite Me Baby — §22 LIVE verification (Phase 3B) on LOCAL stack
-- Container: supabase_db_ivkdfognyiwjcmrhcnwz (psql -U postgres)
-- Scope: customer PWA consumes the canonical order backend end-to-end.
--   A  SAME_DAY + PromptPay   create → intent → slip → kitchen visibility →
--                             delivered → paid → tracking read (DB)
--   B  SAME_DAY + COD         confirm BEFORE delivered rejected; after → paid
--   C  UI cancel              customer cancels own pending order in window →
--                             capacity release; other customer rejected
--   D  PRE_ORDER              ensure_rounds_for_date (029 GRANT) → PO- order →
--                             future-date kitchen batch/queue
--   RLS                       cross-tenant invisibility
-- Fixture prep (documented, rolled back at end): demo users, one today round,
-- prod-1/prod-2 mode flags, inventory stock headroom.
-- ALL INSIDE ONE TRANSACTION — ROLLBACK at the end leaves the DB untouched.
-- ============================================

BEGIN;
RESET ROLE;

DO $$ DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  -- ===== fixtures (superuser context) =====
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('44444444-4444-4444-4444-444444444444', 'p3b-live-c1@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
       , ('55555555-5555-5555-5555-555555555555', 'p3b-live-admin@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
       , ('66666666-6666-6666-6666-666666666666', 'p3b-live-c2@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.profiles SET role = 'admin' WHERE id = '55555555-5555-5555-5555-555555555555';
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '55555555-5555-5555-5555-555555555555' AND role = 'admin') THEN
    RAISE EXCEPTION 'FAIL FIXTURE admin profile promotion';
  END IF;

  -- SAME_DAY round: today (Bangkok), cutoff wide-open, cap 10
  INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, scheduled_date, status)
  VALUES ('round-LIVE-SD', 'live-sd', 'LIVE §22 SAME_DAY', '23:59', '00:00', '23:59', 10, 0, v_today, 'active');

  -- deterministic happy-path fixtures for the mode gates + inventory guard
  UPDATE public.products SET available_same_day = true, available_preorder = true, is_available = true
   WHERE id IN ('prod-1', 'prod-2');
  UPDATE public.inventory SET current_stock = 9999 WHERE id IN ('ing-1', 'ing-2', 'ing-3', 'ing-4');

  RAISE NOTICE 'PASS FIXTURE users/admin/round/products ready (today=%)', v_today;
END $$;

RESET ROLE;
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', false);

-- ============================================
-- A1. customer creates SAME_DAY PromptPay order on today's round
-- ============================================
DO $$ DECLARE
  r jsonb; v_cap int;
BEGIN
  r := public.create_order_with_items(
    p_items            := '[{"product_id":"prod-1","quantity":2}]'::jsonb,
    p_delivery_round_id => 'round-LIVE-SD',
    p_delivery_method   => 'grab_rider',
    p_dropoff_latitude  => 10.7616,
    p_dropoff_longitude => 102.1429,
    p_delivery_address  => '99 Live Test Rd',
    p_customer_name     => 'Live Customer',
    p_customer_phone    => '0810000001',
    p_payment_method    => 'promptpay_qr'
  );
  IF r->>'order_number' NOT LIKE 'BMB-%' THEN RAISE EXCEPTION 'FAIL A1 order_number prefix: %', r->>'order_number'; END IF;
  IF (r->>'status') <> 'pending' OR (r->>'payment_status') <> 'pending' THEN RAISE EXCEPTION 'FAIL A1 initial states'; END IF;
  IF (r->>'total_amount')::numeric <= 0 THEN RAISE EXCEPTION 'FAIL A1 server total not positive'; END IF;
  SELECT current_count INTO v_cap FROM public.delivery_rounds WHERE id = 'round-LIVE-SD';
  IF v_cap <> 1 THEN RAISE EXCEPTION 'FAIL A1 capacity not incremented (got %)', v_cap; END IF;
  RAISE NOTICE 'PASS A1 SAME_DAY create % total=% cap=1', r->>'order_number', r->>'total_amount';
END $$;

-- A2/A3. PromptPay intent + slip reference (pending → processing)
DO $$ DECLARE
  r jsonb; v_on text; v_total numeric; v_intent text;
BEGIN
  SELECT order_number, total_amount INTO v_on, v_total
    FROM public.orders WHERE delivery_round_id = 'round-LIVE-SD' ORDER BY created_at LIMIT 1;
  r := public.create_payment_intent_record(v_on, v_total, 'promptpay_qr', 'promptpay');
  IF (r->>'status') <> 'pending' THEN RAISE EXCEPTION 'FAIL A2 intent not pending'; END IF;
  r := public.submit_offline_payment_reference(v_on, 'TXN-LIVE-22');
  SELECT status INTO v_intent FROM public.payment_intents
   WHERE order_number = v_on AND method = 'promptpay_qr' ORDER BY created_at DESC LIMIT 1;
  IF v_intent <> 'processing' THEN RAISE EXCEPTION 'FAIL A3 reference did not move intent to processing'; END IF;
  RAISE NOTICE 'PASS A2+A3 intent % pending→processing', r->>'order_number';
END $$;
RESET ROLE;
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false);

-- A4. kitchen visibility: admin confirms the order then batches + queues it
DO $$ DECLARE
  r jsonb; v_on text; v_batch jsonb; v_found boolean;
BEGIN
  SELECT order_number INTO v_on FROM public.orders WHERE delivery_round_id = 'round-LIVE-SD' ORDER BY created_at LIMIT 1;
  r := public.transition_order_status(v_on, 'confirmed');
  IF (r->>'to') <> 'confirmed' THEN RAISE EXCEPTION 'FAIL A4 confirm transition'; END IF;
  r := public.create_production_batch('round-LIVE-SD', (SELECT scheduled_date FROM public.orders WHERE order_number = v_on), NULL);
  IF (r->>'items_count')::int < 1 THEN RAISE EXCEPTION 'FAIL A4 batch has no items'; END IF;
  v_batch := public.kitchen_queue('round-LIVE-SD', (SELECT scheduled_date FROM public.orders WHERE order_number = v_on));
  v_found := EXISTS (SELECT 1 FROM jsonb_array_elements((v_batch->'batches')::jsonb) b
                      , jsonb_array_elements(b->'items') it WHERE it->>'order_number' = v_on);
  IF NOT v_found THEN RAISE EXCEPTION 'FAIL A4 kitchen_queue missing order %', v_on; END IF;
  RAISE NOTICE 'PASS A4 kitchen sees % via batch + queue (items_count=%)', v_on, r->>'items_count';
END $$;

-- A5. admin drives the full chain to delivered
DO $$ DECLARE
  v_on text; s text;
  chain text[] := ARRAY['preparing','ready_for_dispatch','dispatched','in_transit','arrived','delivered'];
BEGIN
  SELECT order_number INTO v_on FROM public.orders WHERE delivery_round_id = 'round-LIVE-SD' ORDER BY created_at LIMIT 1;
  FOREACH s IN ARRAY chain LOOP
    PERFORM public.transition_order_status(v_on, s::public.order_status);
  END LOOP;
  IF (SELECT status::text FROM public.orders WHERE order_number = v_on) <> 'delivered'
  THEN RAISE EXCEPTION 'FAIL A5 chain did not reach delivered'; END IF;
  RAISE NOTICE 'PASS A5 status chain pending→…→delivered';
END $$;

-- A6. admin confirms the (already processed) PromptPay payment → paid
DO $$ DECLARE
  v_on text; r jsonb;
BEGIN
  SELECT order_number INTO v_on FROM public.orders WHERE delivery_round_id = 'round-LIVE-SD' ORDER BY created_at LIMIT 1;
  r := public.confirm_offline_payment(v_on);
  IF (SELECT payment_status::text FROM public.orders WHERE order_number = v_on) <> 'paid'
  THEN RAISE EXCEPTION 'FAIL A6 payment not paid'; END IF;
  IF (SELECT status::text FROM public.payment_intents WHERE order_number = v_on ORDER BY created_at DESC LIMIT 1) <> 'completed'
  THEN RAISE EXCEPTION 'FAIL A6 intent not completed'; END IF;
  RAISE NOTICE 'PASS A6 PromptPay paid via kitchen confirm (order %)', v_on;
END $$;
RESET ROLE;
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', false);

-- A7. tracking read path: customer sees own order/items/intents (RLS)
DO $$ DECLARE
  v_on text; n int;
BEGIN
  SELECT order_number INTO v_on FROM public.orders WHERE delivery_round_id = 'round-LIVE-SD' ORDER BY created_at LIMIT 1;
  SELECT COUNT(*) INTO n FROM public.orders WHERE order_number = v_on;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL A7 customer cannot read own order'; END IF;
  SELECT COUNT(*) INTO n FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id WHERE o.order_number = v_on;
  IF n < 1 THEN RAISE EXCEPTION 'FAIL A7 customer cannot read own order_items'; END IF;
  SELECT COUNT(*) INTO n FROM public.payment_intents WHERE order_number = v_on;
  IF n < 1 THEN RAISE EXCEPTION 'FAIL A7 customer cannot read own payment_intents'; END IF;
  RAISE NOTICE 'PASS A7 tracking reads DB as customer (order/items/intents)';
END $$;

-- ============================================
-- B. SAME_DAY COD — confirm before delivery must be rejected
-- ============================================
DO $$ DECLARE
  r jsonb; v_on text;
BEGIN
  r := public.create_order_with_items(
    p_items            := '[{"product_id":"prod-2","quantity":2}]'::jsonb,
    p_delivery_round_id => 'round-LIVE-SD',
    p_delivery_method   => 'grab_rider',
    p_dropoff_latitude  => 10.7616,
    p_dropoff_longitude => 102.1429,
    p_customer_name     => 'Live COD',
    p_customer_phone    => '0810000002',
    p_payment_method    => 'cash_on_delivery'
  );
  v_on := r->>'order_number';
  IF v_on NOT LIKE 'BMB-%' THEN RAISE EXCEPTION 'FAIL B1 create'; END IF;

  -- customer cannot confirm payment at all
  BEGIN
    PERFORM public.confirm_offline_payment(v_on);
    RAISE EXCEPTION 'FAIL B2 customer was able to confirm COD payment';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%ERR_FORBIDDEN%' THEN NULL; ELSE RAISE; END IF;
  END;
  RAISE NOTICE 'PASS B1+B2 COD order % created; customer confirm rejected', v_on;
END $$;

RESET ROLE;
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false);

DO $$ DECLARE
  v_on text; s text;
BEGIN
  SELECT order_number INTO v_on
    FROM public.orders WHERE payment_method = 'cash_on_delivery' AND delivery_round_id = 'round-LIVE-SD' ORDER BY created_at LIMIT 1;
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL B3 COD order not found'; END IF;

  -- admin: still not delivered → must be rejected
  BEGIN
    PERFORM public.confirm_offline_payment(v_on);
    RAISE EXCEPTION 'FAIL B3 admin confirmed COD before delivered';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%ERR_COD_NOT_DELIVERED%' THEN NULL; ELSE RAISE; END IF;
  END;
  IF (SELECT payment_status::text FROM public.orders WHERE order_number = v_on) <> 'pending'
  THEN RAISE EXCEPTION 'FAIL B3 payment_status mutated by rejected confirm'; END IF;

  -- deliver through the canonical chain, then COD settles
  PERFORM public.transition_order_status(v_on, 'confirmed');
  FOREACH s IN ARRAY ARRAY['preparing','ready_for_dispatch','dispatched','in_transit','arrived','delivered'] LOOP
    PERFORM public.transition_order_status(v_on, s::public.order_status);
  END LOOP;
  PERFORM public.confirm_offline_payment(v_on);
  IF (SELECT payment_status::text FROM public.orders WHERE order_number = v_on) <> 'paid'
  THEN RAISE EXCEPTION 'FAIL B4 COD not paid after delivery'; END IF;
  RAISE NOTICE 'PASS B3+B4 COD: pre-delivery rejected (status stayed pending), post-delivery paid';
END $$;
RESET ROLE;
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', false);

-- ============================================
-- C. UI cancel — customer cancels own pending order inside the window
-- ============================================
DO $$ DECLARE
  r jsonb; v_on text; v_cap_before int; v_cap_after int;
BEGIN
  r := public.create_order_with_items(
    p_items            := '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-LIVE-SD',
    p_delivery_method   => 'grab_rider',
    p_dropoff_latitude  => 10.7616,
    p_dropoff_longitude => 102.1429,
    p_customer_name     := 'Live Cancel',
    p_customer_phone    := '0810000003',
    p_payment_method    := 'promptpay_qr'
  );
  v_on := r->>'order_number';
  SELECT current_count INTO v_cap_before FROM public.delivery_rounds WHERE id = 'round-LIVE-SD';
  IF v_cap_before <> 3 THEN RAISE EXCEPTION 'FAIL C1 expected cap 3 before cancel, got %', v_cap_before; END IF;

  r := public.cancel_order(v_on, 'customer changed mind');
  IF (r->>'status') <> 'cancelled' OR (r->>'capacity_released')::boolean IS NOT TRUE
  THEN RAISE EXCEPTION 'FAIL C2 cancel result: %', r::text; END IF;
  SELECT current_count INTO v_cap_after FROM public.delivery_rounds WHERE id = 'round-LIVE-SD';
  IF v_cap_after <> 2 THEN RAISE EXCEPTION 'FAIL C2 capacity not released (got %)', v_cap_after; END IF;
  IF (SELECT status::text FROM public.orders WHERE order_number = v_on) <> 'cancelled'
  THEN RAISE EXCEPTION 'FAIL C2 order not cancelled'; END IF;
  RAISE NOTICE 'PASS C customer cancel: % cancelled, capacity 3→2', v_on;
END $$;

-- RLS + ownership: the OTHER customer can neither read nor cancel
RESET ROLE;
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', false);

DO $$ DECLARE
  v_on text; n int; ok boolean := false;
BEGIN
  -- capture a REAL foreign order number while impersonating c1 (its owner)
  PERFORM set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', false);
  SELECT order_number INTO v_on
    FROM public.orders WHERE delivery_round_id = 'round-LIVE-SD' ORDER BY created_at LIMIT 1;
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL RLS: fixture lost'; END IF;

  -- switch identity INSIDE the DO to the other customer
  PERFORM set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  SELECT COUNT(*) INTO n FROM public.orders WHERE order_number = v_on;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL RLS: other customer read foreign order'; END IF;
  BEGIN
    PERFORM public.cancel_order(v_on, 'sneaky');
    RAISE EXCEPTION 'FAIL RLS: other customer cancelled foreign order';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%ERR_FORBIDDEN%' OR SQLERRM LIKE '%ERR_ORDER_NOT_FOUND%' THEN ok := true; ELSE RAISE; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL RLS: cancel path unexpectedly succeeded'; END IF;
  RAISE NOTICE 'PASS RLS cross-tenant: foreign order invisible (0 rows) and cancel rejected';
END $$;
-- ============================================
-- D. PRE_ORDER — customer instantiates future rounds (029 GRANT), orders PO-
-- ============================================
RESET ROLE;
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', false);

DO $$ DECLARE
  v_date date := CURRENT_DATE + 3;
  r jsonb; v_round text; v_cap int;
BEGIN
  PERFORM public.ensure_rounds_for_date(v_date); -- 029 GRANT exercised live
  SELECT id INTO v_round FROM public.delivery_rounds
   WHERE scheduled_date = v_date AND id = 'round-' || to_char(v_date,'YYYYMMDD') || '-morning';
  IF v_round IS NULL THEN RAISE EXCEPTION 'FAIL D1 deterministic morning round missing'; END IF;

  r := public.create_order_with_items(
    p_items            := '[{"product_id":"prod-2","quantity":2}]'::jsonb,
    p_delivery_round_id := v_round,
    p_order_mode        := 'PRE_ORDER',
    p_scheduled_date    := v_date,
    p_delivery_method   => 'grab_rider',
    p_dropoff_latitude  => 10.7616,
    p_dropoff_longitude => 102.1429,
    p_customer_name     := 'Live Preorder',
    p_customer_phone    := '0810000003'
  );
  IF (r->>'order_number') NOT LIKE 'PO-%' THEN RAISE EXCEPTION 'FAIL D2 PRE_ORDER prefix: %', r->>'order_number'; END IF;
  SELECT current_count INTO v_cap FROM public.delivery_rounds WHERE id = v_round;
  IF v_cap <> 1 THEN RAISE EXCEPTION 'FAIL D2 PRE_ORDER capacity not incremented (got %)', v_cap; END IF;

  -- server authority: scheduled_date must match the round — forged date rejected
  BEGIN
    PERFORM public.create_order_with_items(
      p_items := '[{"product_id":"prod-2","quantity":1}]'::jsonb,
      p_delivery_round_id := v_round,
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_date + 1
    );
    RAISE EXCEPTION 'FAIL D3 forged scheduled_date accepted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%ERR_ROUND_DATE_MISMATCH%' THEN NULL; ELSE RAISE; END IF;
  END;
  RAISE NOTICE 'PASS D1-D3 PRE_ORDER % created (cap 1); forged scheduled_date rejected', r->>'order_number';
END $$;
RESET ROLE;
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false);

DO $$ DECLARE
  v_date date := CURRENT_DATE + 3;
  r jsonb; v_round text; v_batch jsonb; v_on text;
BEGIN
  SELECT order_number INTO v_on
    FROM public.orders WHERE order_mode = 'PRE_ORDER' ORDER BY created_at DESC LIMIT 1;
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL D4 PRE_ORDER order not found'; END IF;
  v_round := 'round-' || to_char(v_date,'YYYYMMDD') || '-morning';

  PERFORM public.transition_order_status(v_on, 'confirmed');
  r := public.create_production_batch(v_round, v_date, 'PRE_ORDER');
  IF (r->>'items_count')::int < 1 THEN RAISE EXCEPTION 'FAIL D4 PRE_ORDER batch empty'; END IF;
  v_batch := public.kitchen_queue(v_round, v_date);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements((v_batch->'batches')::jsonb) b
                  , jsonb_array_elements(b->'items') it
                 WHERE it->>'order_number' = v_on) THEN
    RAISE EXCEPTION 'FAIL D4 future-date kitchen_queue missing %', v_on;
  END IF;
  RAISE NOTICE 'PASS D4 future-date kitchen queue sees % (items_count=%)', v_on, r->>'items_count';
END $$;

ROLLBACK;
-- ============================================
-- END §22 LIVE VERIFICATION — all PASS notices above ⇒ stack consumes canonical domain
-- ============================================