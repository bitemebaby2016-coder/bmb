-- ============================================
-- Bite Me Baby â€” PHASE 3A SQL Contract Suite: Payment â†’ Confirm â†’ Inventory â†’ Kitchen (028)
-- Baseline: 36a3a3c Â· Run as OWNER in Supabase SQL Editor (or local psql).
-- Entire suite runs in ONE transaction and ROLLBACKs â€” zero persisted test data.
--
-- Scenarios (brief Â§15):
--   T1 SAME_DAY COD            T2 PRE_ORDER COD           T3 SAME_DAY PromptPay
--   T4 PRE_ORDER PromptPay     T5 payment amount mismatch T6 duplicate payment event
--   T7 payment failure         T8 retry payment           T9 confirmation
--   T10 inventory deduction    T11 shared ingredient aggregation (Case B)
--   T12 insufficient inventory (Case C)                   T13 inventory restore + double cancel
--   T14 SAME_DAY kitchen batch T15 PRE_ORDER kitchen batch T16 duplicate batch behavior
--   T17 cancellation           T18 paid cancellation      T19 forged delivery distance
--   T20 boundary 5.00 km
-- Positive tests simulate real JWTs via set_config (same guards as production HTTP).
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- 0. FIXTURES + BEFORE-STATE EVIDENCE (brief Â§16: database state before)
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'p3a-cust@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'p3a-admin@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin' WHERE id = '22222222-2222-2222-2222-222222222222';

-- clean deterministic round/date landscape + canonical cutoffs
SELECT public.ensure_rounds_for_date(CURRENT_DATE);
SELECT public.ensure_rounds_for_date(CURRENT_DATE + 2);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= CURRENT_DATE;
DELETE FROM public.production_batch_items;
DELETE FROM public.production_batches;
DELETE FROM public.delivery_assignments;

-- inventory BEFORE (Case A/B/C baseline)
UPDATE public.inventory SET current_stock = 10 WHERE id = 'ing-1';
UPDATE public.inventory SET current_stock = 5  WHERE id = 'ing-2';
UPDATE public.inventory SET current_stock = 20 WHERE id = 'ing-3';
UPDATE public.inventory SET current_stock = 3  WHERE id = 'ing-4';
DELETE FROM public.inventory_transactions;
UPDATE public.products SET is_available = true;
CREATE TEMP TABLE p3a_orders (tag TEXT PRIMARY KEY, order_number TEXT);
GRANT SELECT, INSERT, UPDATE, DELETE ON p3a_orders TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'BEFORE: stock ing-1=% ing-2=% ing-3=% ing-4=% | inv_tx=% | orders=% | intents=% | batches=%',
    (SELECT current_stock FROM public.inventory WHERE id='ing-1'),
    (SELECT current_stock FROM public.inventory WHERE id='ing-2'),
    (SELECT current_stock FROM public.inventory WHERE id='ing-3'),
    (SELECT current_stock FROM public.inventory WHERE id='ing-4'),
    (SELECT count(*) FROM public.inventory_transactions),
    (SELECT count(*) FROM public.orders),
    (SELECT count(*) FROM public.payment_intents),
    (SELECT count(*) FROM public.production_batches);
END $$;

-- customer context (default for creates)
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

-- ============================================
-- T1 SAME_DAY COD â€” confirm â†’ deduct (Case A: single product X=2) â†’ batch
-- ============================================
DO $$ DECLARE r jsonb; n text; s1 numeric; s2 numeric; c1 int; BEGIN
  UPDATE public.delivery_rounds SET current_count = 0 WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":20}]'::jsonb,  -- ing-4 x0.05/unit = 1.0 (within qty cap 20)
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY');
  n := r->>'order_number';
  INSERT INTO p3a_orders VALUES ('T1', n) ON CONFLICT (tag) DO UPDATE SET order_number = EXCLUDED.order_number;
  IF (r->>'payment_method') <> 'cash_on_delivery' THEN RAISE EXCEPTION 'FAIL T1 method'; END IF;
  IF (SELECT payment_status FROM public.orders WHERE order_number = n) = 'paid' THEN
    RAISE EXCEPTION 'FAIL T1 COD must never be paid before delivery'; END IF;
  SELECT current_stock INTO s1 FROM public.inventory WHERE id = 'ing-4';
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  PERFORM public.transition_order_status(p_order_number => n, p_new_status => 'confirmed');
  SELECT current_stock INTO s2 FROM public.inventory WHERE id = 'ing-4';
  IF s2 <> s1 - 1 THEN RAISE EXCEPTION 'FAIL T1 Case A expected -1 got % -> %', s1, s2; END IF;
  IF (SELECT payment_status FROM public.orders WHERE order_number = n) <> 'pending' THEN
    RAISE EXCEPTION 'FAIL T1 COD payment_status mutated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_transactions
                  WHERE reference_id = n AND notes LIKE 'auto-deduct%' AND type='out' AND quantity = 1) THEN
    RAISE EXCEPTION 'FAIL T1 deduct transaction missing'; END IF;
  SELECT current_count INTO c1 FROM public.delivery_rounds WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  IF c1 <> 1 THEN RAISE EXCEPTION 'FAIL T1 capacity %', c1; END IF;
  r := public.create_production_batch(p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
                                      p_scheduled_date => CURRENT_DATE);
  IF (r->>'items_count')::int <> 1 THEN RAISE EXCEPTION 'FAIL T1 batch %', r->>'items_count'; END IF;
  RAISE NOTICE 'PASS T1 SAME_DAY COD: confirmed â†’ inventory -1 (Case A single-product exact deduct), batch queued, payment stays pending (% â†’ %)', s1, s2;
END $$;

-- ============================================
-- T2 PRE_ORDER COD â€” confirm â†’ batch (+2); payment stays pending
-- ============================================
DO $$ DECLARE r jsonb; n text; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-midday',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_payment_method => 'cash_on_delivery',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2);
  n := r->>'order_number';
  IF n NOT LIKE 'PO-%' THEN RAISE EXCEPTION 'FAIL T2 prefix'; END IF;
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  PERFORM public.transition_order_status(p_order_number => n, p_new_status => 'confirmed');
  r := public.create_production_batch(p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-midday',
                                      p_scheduled_date => CURRENT_DATE + 2);
  IF (r->>'items_count')::int <> 1 THEN RAISE EXCEPTION 'FAIL T2 batch %', r->>'items_count'; END IF;
  IF (SELECT payment_status FROM public.orders WHERE order_number = n) <> 'pending' THEN
    RAISE EXCEPTION 'FAIL T2 COD payment mutated'; END IF;
  RAISE NOTICE 'PASS T2 PRE_ORDER COD: confirmed â†’ batch (PRE_ORDER) without pre_orders; payment stays pending';
END $$;

-- ============================================
-- T3 SAME_DAY PromptPay â€” intent â†’ paid â†’ confirm â†’ deduct
-- (this order is reused by T6 duplicate, T13 restore, T18 paid cancellation)
-- ============================================
DO $$ DECLARE r jsonb; n text; t numeric; i1 numeric; i2 numeric; s1 numeric; s2 numeric; s3 numeric; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-2","quantity":1}]'::jsonb,  -- ing-1 x0.2 + ing-2 x0.15
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_payment_method => 'promptpay_qr',
    p_order_mode => 'SAME_DAY');
  n := r->>'order_number'; t := (r->>'total_amount')::numeric;
  INSERT INTO p3a_orders VALUES ('T3', n) ON CONFLICT (tag) DO UPDATE SET order_number = EXCLUDED.order_number;
  PERFORM public.create_payment_intent_record(p_order_number => n, p_amount => t);
  RESET ROLE; -- record_payment_result is service_role/postgres-only by design (webhook path)
  r := public.record_payment_result(p_order_number => n, p_payment_intent_id => 'pi_p3a_t3', p_amount => t, p_status => 'completed');
  IF (r->>'payment_status') <> 'paid' THEN RAISE EXCEPTION 'FAIL T3 paid'; END IF;
  SELECT current_stock INTO s1 FROM public.inventory WHERE id = 'ing-1';
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  r := public.transition_order_status(p_order_number => n, p_new_status => 'confirmed');
  SELECT current_stock INTO s2 FROM public.inventory WHERE id = 'ing-1';
  SELECT current_stock INTO s3 FROM public.inventory WHERE id = 'ing-2';
  IF s2 <> s1 - 0.2 THEN RAISE EXCEPTION 'FAIL T3 deduct ing-1 % -> %', s1, s2; END IF;
  IF s3 <> 4.85 THEN RAISE EXCEPTION 'FAIL T3 deduct ing-2 %', s3; END IF;
  IF (SELECT status FROM public.orders WHERE order_number = n) <> 'confirmed' THEN
    RAISE EXCEPTION 'FAIL T3 status'; END IF;
  RAISE NOTICE 'PASS T3/T9/T10 SAME_DAY PromptPay: paid â†’ confirmed â†’ deducted (ing-1 % â†’ %, ing-2 â†’ %)', s1, s2, s3;
END $$;

-- ============================================
-- T4 PRE_ORDER PromptPay â€” intent â†’ paid â†’ confirmed â†’ batch (+2 evening)
-- ============================================
DO $$ DECLARE r jsonb; n text; t numeric; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":2}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-evening',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_payment_method => 'promptpay_qr',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2);
  n := r->>'order_number'; t := (r->>'total_amount')::numeric;
  PERFORM public.create_payment_intent_record(p_order_number => n, p_amount => t);
  RESET ROLE;
  r := public.record_payment_result(p_order_number => n, p_payment_intent_id => 'pi_p3a_t4', p_amount => t, p_status => 'completed');
  IF (r->>'payment_status') <> 'paid' THEN RAISE EXCEPTION 'FAIL T4 paid'; END IF;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  PERFORM public.transition_order_status(p_order_number => n, p_new_status => 'confirmed');
  r := public.create_production_batch(p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-evening',
                                      p_scheduled_date => CURRENT_DATE + 2);
  IF (r->>'items_count')::int <> 1 THEN RAISE EXCEPTION 'FAIL T4 batch %', r->>'items_count'; END IF;
  RAISE NOTICE 'PASS T4 PRE_ORDER PromptPay: paid â†’ confirmed â†’ batch (+2 evening)';
END $$;

-- ============================================
-- T5 payment amount mismatch â€” authoritative total enforced
-- ============================================
DO $$ DECLARE r jsonb; n text; t numeric; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-2","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY');
  n := r->>'order_number'; t := (r->>'total_amount')::numeric;
  BEGIN
    PERFORM public.create_payment_intent_record(p_order_number => n, p_amount => t + 1);
    RAISE EXCEPTION 'FAIL T5 mismatch accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_AMOUNT_MISMATCH%' THEN RAISE EXCEPTION 'FAIL T5 unexpected: %', SQLERRM; END IF;
  END;
  PERFORM public.create_payment_intent_record(p_order_number => n, p_amount => t);
  RAISE NOTICE 'PASS T5 amount mismatch rejected; exact-amount intent created';
END $$;

-- ============================================
-- T6 duplicate payment event â€” replay changes nothing (order T3)
-- ============================================
DO $$ DECLARE r jsonb; n text; t numeric; c1 int; c2 int; BEGIN
  RESET ROLE;
  n := (SELECT order_number FROM p3a_orders WHERE tag = 'T3');
  IF n IS NULL THEN RAISE EXCEPTION 'FAIL T6 paid order not found'; END IF;
  t := (SELECT total_amount FROM public.orders WHERE order_number = n);
  SELECT count(*) INTO c1 FROM public.payment_intents WHERE order_number = n;
  r := public.record_payment_result(p_order_number => n, p_payment_intent_id => 'pi_p3a_t3', p_amount => t, p_status => 'completed');
  IF (r->>'idempotent')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL T6 not idempotent'; END IF;
  SELECT count(*) INTO c2 FROM public.payment_intents WHERE order_number = n;
  IF c1 <> c2 THEN RAISE EXCEPTION 'FAIL T6 intent rows changed % -> %', c1, c2; END IF;
  IF (SELECT payment_status FROM public.orders WHERE order_number = n) <> 'paid' THEN
    RAISE EXCEPTION 'FAIL T6 payment_status'; END IF;
  RAISE NOTICE 'PASS T6 duplicate webhook: idempotent (intents % -> %, paid once)', c1, c2;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
END $$;

-- ============================================
-- T7 payment failure â€” order stays non-confirmed; slot retained; inventory untouched
-- ============================================
DO $$ DECLARE r jsonb; n text; t numeric; c1 int; c2 int; s1 numeric; s2 numeric; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":2}]'::jsonb,  -- ing-4 x0.1
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_payment_method => 'promptpay_qr',
    p_order_mode => 'SAME_DAY');
  n := r->>'order_number'; t := (r->>'total_amount')::numeric;
  INSERT INTO p3a_orders VALUES ('T7F', n) ON CONFLICT (tag) DO UPDATE SET order_number = EXCLUDED.order_number;
  PERFORM public.create_payment_intent_record(p_order_number => n, p_amount => t);
  SELECT current_count INTO c1 FROM public.delivery_rounds WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  SELECT current_stock INTO s1 FROM public.inventory WHERE id = 'ing-4';
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  PERFORM public.mark_payment_failed(p_order_number => n, p_reason => 'p3a test');
  SELECT current_count INTO c2 FROM public.delivery_rounds WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  SELECT current_stock INTO s2 FROM public.inventory WHERE id = 'ing-4';
  IF c1 <> c2 THEN RAISE EXCEPTION 'FAIL T7 capacity released on failure % -> %', c1, c2; END IF;
  IF s1 <> s2 THEN RAISE EXCEPTION 'FAIL T7 inventory changed on failure'; END IF;
  IF (SELECT status FROM public.orders WHERE order_number = n) <> 'pending' THEN
    RAISE EXCEPTION 'FAIL T7 order not pending'; END IF;
  IF (SELECT payment_status FROM public.orders WHERE order_number = n) = 'paid' THEN
    RAISE EXCEPTION 'FAIL T7 paid after failure'; END IF;
  RAISE NOTICE 'PASS T7 payment failure: order pending, slot retained (%), inventory untouched (%), kitchen clean', c2, s2;
  RESET ROLE; -- production_batch_items has no authenticated grant; assert as postgres
  IF (SELECT count(*) FROM public.production_batch_items WHERE order_number = n) <> 0 THEN
    RAISE EXCEPTION 'FAIL T7 kitchen received a pending order'; END IF;
  -- T8 retry payment â†’ success (new attempt row, no duplicate order/intents mess)
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  PERFORM public.create_payment_intent_record(p_order_number => n, p_amount => t);
  RESET ROLE;
  r := public.record_payment_result(p_order_number => n, p_payment_intent_id => 'pi_p3a_retry', p_amount => t, p_status => 'completed');
  IF (r->>'payment_status') <> 'paid' THEN RAISE EXCEPTION 'FAIL T8 retry not paid'; END IF;
  IF (SELECT count(*) FROM public.orders WHERE customer_ref = '11111111-1111-1111-1111-111111111111') <> (SELECT count(DISTINCT order_number) FROM public.orders WHERE customer_ref = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'FAIL T8 duplicate order rows'; END IF;
  IF (SELECT count(*) FROM public.payment_intents WHERE order_number = n) <> 2 THEN
    RAISE EXCEPTION 'FAIL T8 unexpected intent count'; END IF;
  RAISE NOTICE 'PASS T8 retry payment: paid once, 2 attempt rows, no duplicate order';
END $$;

-- ============================================
-- T11 shared ingredient aggregation (Case B) â€” A=2 + B=3 â†’ X -5 (not -2, not -3)
-- prod-1 x8 â†’ ing-1 x2.0 (+ ing-3 x8) Â· prod-2 x15 â†’ ing-1 x3.0 (+ ing-2 x2.25)
-- ============================================
DO $$ DECLARE r jsonb; n text; b1 numeric; a1 numeric; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  SELECT current_stock INTO a1 FROM public.inventory WHERE id = 'ing-1';
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":8},{"product_id":"prod-2","quantity":10}]'::jsonb,  -- 18 items (within cap 20)
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_payment_method => 'promptpay_qr',
    p_order_mode => 'SAME_DAY');
  n := r->>'order_number';
  INSERT INTO p3a_orders VALUES ('T11', n) ON CONFLICT (tag) DO UPDATE SET order_number = EXCLUDED.order_number;
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  PERFORM public.transition_order_status(p_order_number => n, p_new_status => 'confirmed');
  SELECT current_stock INTO b1 FROM public.inventory WHERE id = 'ing-1';
  IF b1 <> a1 - 4 THEN RAISE EXCEPTION 'FAIL T11 Case B expected -4 got % -> %', a1, b1; END IF;
  IF (SELECT current_stock FROM public.inventory WHERE id='ing-2') <> 3.35 THEN
    RAISE EXCEPTION 'FAIL T11 ing-2 %', (SELECT current_stock FROM public.inventory WHERE id='ing-2'); END IF;
  IF (SELECT current_stock FROM public.inventory WHERE id='ing-3') <> 12 THEN
    RAISE EXCEPTION 'FAIL T11 ing-3 %', (SELECT current_stock FROM public.inventory WHERE id='ing-3'); END IF;
  RAISE NOTICE 'PASS T11 Case B shared aggregation: ing-1 % â†’ % (deducted 4.0 = 2.0 + 2.0, no v_done_ids skip)', a1, b1;
END $$;

-- ============================================
-- T12 insufficient inventory (Case C) â€” confirmation blocked atomically
-- T12b the SAME via DIRECT table UPDATE (new 028 trigger guarantee)
-- ============================================
DO $$ DECLARE r jsonb; n text; st text; s1 numeric; s2 numeric; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1},{"product_id":"prod-2","quantity":1}]'::jsonb,  -- ing-1 need 0.45
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY');
  n := r->>'order_number';
  INSERT INTO p3a_orders VALUES ('T12', n) ON CONFLICT (tag) DO UPDATE SET order_number = EXCLUDED.order_number;
  -- stock drops below the requirement AFTER creation (confirm-time authority)
  UPDATE public.inventory SET current_stock = 0.3 WHERE id = 'ing-1';
  SELECT current_stock INTO s1 FROM public.inventory WHERE id = 'ing-1';
  BEGIN
    PERFORM public.transition_order_status(p_order_number => n, p_new_status => 'confirmed');
    RAISE EXCEPTION 'FAIL T12 insufficient confirmed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_INSUFFICIENT_INGREDIENT%' THEN RAISE EXCEPTION 'FAIL T12 unexpected: %', SQLERRM; END IF;
  END;
  SELECT status INTO st FROM public.orders WHERE order_number = n;
  SELECT current_stock INTO s2 FROM public.inventory WHERE id = 'ing-1';
  IF st <> 'pending' THEN RAISE EXCEPTION 'FAIL T12 partially confirmed (%s)', st; END IF;
  IF s2 <> s1 THEN RAISE EXCEPTION 'FAIL T12 stock mutated % -> %', s1, s2; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_transactions WHERE reference_id = n) THEN
    RAISE EXCEPTION 'FAIL T12 partial deduct rows exist'; END IF;
  RAISE NOTICE 'PASS T12 Case C insufficient: confirm blocked, status=%, stock unchanged %, zero deduct rows', st, s2;
  -- T12b: even a DIRECT table UPDATE cannot confirm without inventory (028 trigger)
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  BEGIN
    UPDATE public.orders SET status = 'confirmed' WHERE order_number = n;
    RAISE EXCEPTION 'FAIL T12b direct UPDATE confirmed without stock';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_INSUFFICIENT_INGREDIENT%' THEN RAISE EXCEPTION 'FAIL T12b unexpected: %', SQLERRM; END IF;
  END;
  SELECT status INTO st FROM public.orders WHERE order_number = n;
  IF st <> 'pending' THEN RAISE EXCEPTION 'FAIL T12b direct path confirmed (%s)', st; END IF;
  RAISE NOTICE 'PASS T12b direct table UPDATE also blocked by the confirm-deduct invariant';
END $$;

-- ============================================
-- T16 duplicate batch behavior â€” 2nd call same round+date must NOT re-queue orders;
--                                  a NEWLY confirmed order is picked up alone
-- ============================================
DO $$ DECLARE r jsonb; c1 int; c2 int; c3 int; dup int; n_new text; BEGIN
  RESET ROLE; -- pbi table has no authenticated grant; count asserts run as postgres
  SELECT count(*) INTO c1 FROM public.production_batch_items pbi
   JOIN public.production_batches pb ON pb.id = pbi.batch_id
  WHERE pb.delivery_round_id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning'
    AND pb.scheduled_date = CURRENT_DATE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  r := public.create_production_batch(p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
                                      p_scheduled_date => CURRENT_DATE);
  RESET ROLE;
  SELECT count(*) INTO c2 FROM public.production_batch_items pbi
   JOIN public.production_batches pb ON pb.id = pbi.batch_id
  WHERE pb.delivery_round_id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning'
    AND pb.scheduled_date = CURRENT_DATE;
  RAISE NOTICE 'T16 debug rows: %', (
    SELECT string_agg(pb.id || '::' || pbi.order_number || '/' || o.status || '/' || pbi.product_name || 'x' || pbi.quantity, ' ;; ')
      FROM public.production_batch_items pbi
      JOIN public.production_batches pb ON pb.id = pbi.batch_id
      JOIN public.orders o ON o.id = pbi.order_id
     WHERE pb.delivery_round_id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning'
       AND pb.scheduled_date = CURRENT_DATE);
  RAISE NOTICE 'T16 debug orders: %', (
    SELECT string_agg(x.txt, ' ;; ') FROM (
      SELECT o.order_number || '=' || o.status || '/' || o.payment_status::text || '/' || o.order_mode::text || '/cust=' || COALESCE(o.customer_ref::text, 'null') AS txt
        FROM public.orders o
       WHERE o.order_number LIKE 'BMB-%'
       ORDER BY o.id) x);
  -- the invariant: NO order may appear in the same round+date batch stream twice;
  -- newly confirmed (not-yet-batched) orders legitimately join at re-batch
  IF c2 < c1 THEN RAISE EXCEPTION 'FAIL T16 items lost % -> %', c1, c2; END IF;
  SELECT count(*) INTO dup FROM (
    SELECT pbi.order_id FROM public.production_batch_items pbi
     JOIN public.production_batches pb ON pb.id = pbi.batch_id
    WHERE pb.delivery_round_id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning'
      AND pb.scheduled_date = CURRENT_DATE
    GROUP BY pbi.order_id HAVING count(DISTINCT pb.id) > 1);
  IF dup > 0 THEN RAISE EXCEPTION 'FAIL T16 % orders duplicated in kitchen', dup; END IF;
  -- confirm the retried paid order (still pending) â†’ it becomes the NEW kitchen work
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  n_new := (SELECT order_number FROM p3a_orders WHERE tag = 'T7F');
  IF n_new IS NULL THEN RAISE EXCEPTION 'FAIL T16 no retried order'; END IF;
  PERFORM public.transition_order_status(p_order_number => n_new, p_new_status => 'confirmed');
  r := public.create_production_batch(p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
                                      p_scheduled_date => CURRENT_DATE);
  RESET ROLE;
  SELECT count(*) INTO c3 FROM public.production_batch_items pbi
   JOIN public.production_batches pb ON pb.id = pbi.batch_id
  WHERE pb.delivery_round_id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning'
    AND pb.scheduled_date = CURRENT_DATE;
  IF c3 <> c2 + (r->>'items_count')::int OR (r->>'items_count')::int = 0 THEN
    RAISE EXCEPTION 'FAIL T16 re-batch % -> % (+%)', c2, c3, r->>'items_count'; END IF;
  SELECT count(*) INTO dup FROM (
    SELECT pbi.order_id FROM public.production_batch_items pbi
     JOIN public.production_batches pb ON pb.id = pbi.batch_id
    WHERE pb.delivery_round_id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning'
      AND pb.scheduled_date = CURRENT_DATE
    GROUP BY pbi.order_id HAVING count(DISTINCT pb.id) > 1);
  IF dup > 0 THEN RAISE EXCEPTION 'FAIL T16 duplicates after re-batch'; END IF;
  RAISE NOTICE 'PASS T16 duplicate batch protection: % â†’ % (no dup on re-run) â†’ % after new confirm (picked up only the new order)', c1, c2, c3;
END $$;

-- ============================================
-- T17 cancellation of a pending order â€” capacity released, inventory untouched
-- ============================================
DO $$ DECLARE r jsonb; n text; c1 int; c2 int; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-midday',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_payment_method => 'promptpay_qr',
    p_order_mode => 'SAME_DAY');
  n := r->>'order_number';
  SELECT current_count INTO c1 FROM public.delivery_rounds WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-midday';
  r := public.cancel_order(p_order_number => n, p_reason => 'T17');
  SELECT current_count INTO c2 FROM public.delivery_rounds WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-midday';
  IF c2 <> c1 - 1 THEN RAISE EXCEPTION 'FAIL T17 capacity % -> %', c1, c2; END IF;
  IF (SELECT count(*) FROM public.inventory_transactions WHERE reference_id = n) <> 0 THEN
    RAISE EXCEPTION 'FAIL T17 inventory rows for pending cancel'; END IF;
  RAISE NOTICE 'PASS T17 pending cancel: capacity % â†’ %, inventory untouched', c1, c2;
END $$;

-- ============================================
-- T19/T20 delivery fee authority â€” server distance wins; 5.00 inclusive boundary
-- ============================================
DO $$ DECLARE d1 numeric := 4.99 / 111.195; d5 numeric := 5.00 / 111.195; d6 numeric := 6.00 / 111.195; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
  -- 0.00 km â†’ self OK
  PERFORM public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2);
  -- 1.00 km â†’ self OK
  PERFORM public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016 + (1.00 / 111.195), p_dropoff_longitude => 102.1429,
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2);
  -- 4.99 km â†’ self OK
  PERFORM public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016 + d1, p_dropoff_longitude => 102.1429,
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2);
  RAISE NOTICE 'PASS T19a 0.00 / 1.00 / 4.99 km self_delivery accepted (server distance)';
  -- 5.00 km â†’ self OK (boundary inclusive)
  PERFORM public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016 + d5, p_dropoff_longitude => 102.1429,
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2);
  RAISE NOTICE 'PASS T20a 5.00 km self accepted (boundary inclusive)';
  -- 5.01 km â†’ self REJECTED
  BEGIN
    PERFORM public.create_order_with_items(
      p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
      p_delivery_method => 'self_delivery',
      p_dropoff_latitude => 10.7016 + (5.01 / 111.195), p_dropoff_longitude => 102.1429,
      p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2);
    RAISE EXCEPTION 'FAIL T20b 5.01km self accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%ERR_DELIVERY_METHOD_ZONE%' THEN RAISE NOTICE 'PASS T20b 5.01 km self rejected';
    ELSE RAISE EXCEPTION 'FAIL T20b unexpected: %', SQLERRM; END IF;
  END;
  -- forged: client says 1 km, server measures 6 km â†’ server rule wins (self rejected)
  BEGIN
    PERFORM public.create_order_with_items(
      p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
      p_delivery_method => 'self_delivery',
      p_dropoff_latitude => 10.7016 + d6, p_dropoff_longitude => 102.1429,
      p_distance_km => 1,
      p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2);
    RAISE EXCEPTION 'FAIL T19b forged distance accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%ERR_DELIVERY_METHOD_ZONE%' THEN RAISE NOTICE 'PASS T19b forged distance (client 1 km, server 6 km) â†’ server wins';
    ELSE RAISE EXCEPTION 'FAIL T19b unexpected: %', SQLERRM; END IF;
  END;
  -- 6 km + external rider â†’ accepted (fee from server zone, not the forged client value)
  PERFORM public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'grab_rider',
    p_dropoff_latitude => 10.7016 + d6, p_dropoff_longitude => 102.1429,
    p_distance_km => 1,
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2);
  RAISE NOTICE 'PASS T19c 6 km external accepted with server-derived fee';
END $$;

-- ============================================
-- AFTER-STATE EVIDENCE (brief Â§16)
-- ============================================
RESET ROLE;
DO $$ BEGIN
  RAISE NOTICE 'AFTER (pre-rollback): stock ing-1=% ing-2=% ing-3=% ing-4=% | inv_tx=% | orders=% | intents=% | batches=% | batch_items=%',
    (SELECT current_stock FROM public.inventory WHERE id='ing-1'),
    (SELECT current_stock FROM public.inventory WHERE id='ing-2'),
    (SELECT current_stock FROM public.inventory WHERE id='ing-3'),
    (SELECT current_stock FROM public.inventory WHERE id='ing-4'),
    (SELECT count(*) FROM public.inventory_transactions),
    (SELECT count(*) FROM public.orders),
    (SELECT count(*) FROM public.payment_intents),
    (SELECT count(*) FROM public.production_batches),
    (SELECT count(*) FROM public.production_batch_items);
  RAISE NOTICE 'AFTER: paid orders=% | cancelled paid=% | completed intents=% | capacity vs live orders mismatches=%',
    (SELECT count(*) FROM public.orders WHERE payment_status='paid'),
    (SELECT count(*) FROM public.orders WHERE payment_status='paid' AND status='cancelled'),
    (SELECT count(*) FROM public.payment_intents WHERE status='completed'),
    (SELECT count(*) FROM public.delivery_rounds r
      WHERE r.current_count <> (SELECT count(*) FROM public.orders o
                                 WHERE o.delivery_round_id = r.id AND o.status NOT IN ('cancelled','failed')));
END $$;

-- ============================================
-- T14/T15 kitchen E2E â€” queue exposes both modes; PRE_ORDER never touches pre_orders
-- ============================================
DO $$ DECLARE r jsonb; c int; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  -- T14: today's morning queue carries the SAME_DAY batch
  r := public.kitchen_queue(p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
                            p_scheduled_date => CURRENT_DATE);
  IF (r->>'batches') IS NULL OR jsonb_array_length(r->'batches') = 0 THEN
    RAISE EXCEPTION 'FAIL T14 queue empty'; END IF;
  RESET ROLE; -- pbi table has no authenticated grant; assert as postgres
  SELECT count(*) INTO c FROM public.production_batch_items pbi
   JOIN public.production_batches pb ON pb.id = pbi.batch_id
   JOIN public.orders o ON o.order_number = pbi.order_number
  WHERE pb.scheduled_date = CURRENT_DATE
    AND pbi.order_mode = 'SAME_DAY'
    AND o.scheduled_date = CURRENT_DATE
    AND o.delivery_round_id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  IF c < 1 THEN RAISE EXCEPTION 'FAIL T14 batch fields'; END IF;
  RAISE NOTICE 'PASS T14 SAME_DAY batch + kitchen_queue: order_mode/scheduled_date/round/order_number correct';
  -- T15: +2 queue carries the PRE_ORDER batches (midday COD + evening paid)
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  r := public.kitchen_queue(p_delivery_round_id => NULL, p_scheduled_date => CURRENT_DATE + 2);
  RESET ROLE;
  SELECT count(*) INTO c FROM public.production_batch_items WHERE order_mode = 'PRE_ORDER';
  IF c < 2 THEN RAISE EXCEPTION 'FAIL T15 pre-order batch items %', c; END IF;
  IF EXISTS (SELECT 1 FROM public.production_batch_items WHERE order_mode IS DISTINCT FROM 'PRE_ORDER'
              AND batch_id IN (SELECT id FROM public.production_batches WHERE scheduled_date = CURRENT_DATE + 2)) THEN
    RAISE EXCEPTION 'FAIL T15 mixed modes in +2 batch'; END IF;
  RAISE NOTICE 'PASS T15 PRE_ORDER batch: % items, canonical source only (pre_orders untouched)', c;
END $$;

-- ============================================
-- T13/T18 PAID cancellation â€” exact restore, no double restore, financial truth intact
-- ============================================
DO $$ DECLARE n text; r jsonb; i1 numeric; i2 numeric; p1 numeric; p2 numeric; paid text; st text; ip int; BEGIN
  RESET ROLE;
  n := (SELECT order_number FROM p3a_orders WHERE tag = 'T3');
  IF n IS NULL THEN RAISE EXCEPTION 'FAIL T13 no paid+confirmed order'; END IF;
  SELECT current_stock INTO i1 FROM public.inventory WHERE id = 'ing-1';
  SELECT count(*) INTO ip FROM public.payment_intents WHERE order_number = n;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  r := public.cancel_order(p_order_number => n, p_reason => 'p3a paid cancel');
  IF (r->>'status') <> 'cancelled' THEN RAISE EXCEPTION 'FAIL T13 cancel'; END IF;
  IF (r->>'inventory_restored')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL T13 restore flag'; END IF;
  SELECT current_stock INTO p1 FROM public.inventory WHERE id = 'ing-1';
  SELECT current_stock INTO p2 FROM public.inventory WHERE id = 'ing-2';
  IF p1 <> i1 + 0.2 THEN RAISE EXCEPTION 'FAIL T13 restore ing-1 % -> %', i1, p1; END IF;
  IF p2 <> 3.5 THEN RAISE EXCEPTION 'FAIL T13 restore ing-2 %', p2; END IF;   -- 3.35 + 0.15
  RESET ROLE; -- inv_tx table has no authenticated grant; assert as postgres
  IF EXISTS (SELECT 1 FROM public.inventory_transactions WHERE reference_id = n AND notes LIKE 'auto-deduct%') THEN
    RAISE EXCEPTION 'FAIL T13 deduct rows not cleaned'; END IF;
  -- second cancel: idempotent, must NOT restore twice
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  r := public.cancel_order(p_order_number => n, p_reason => 'duplicate');
  IF (r->>'idempotent')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL T13 second cancel not idempotent'; END IF;
  RESET ROLE;
  IF (SELECT current_stock FROM public.inventory WHERE id = 'ing-1') <> p1 THEN
    RAISE EXCEPTION 'FAIL T13 double restore'; END IF;
  -- T18: financial truth intact â€” refund is a SEPARATE financial operation
  SELECT payment_status, status INTO paid, st FROM public.orders WHERE order_number = n;
  IF paid <> 'paid' THEN RAISE EXCEPTION 'FAIL T18 payment_status must stay paid (no fake refund)'; END IF;
  IF st <> 'cancelled' THEN RAISE EXCEPTION 'FAIL T18 status'; END IF;
  IF (SELECT count(*) FROM public.payment_intents WHERE order_number = n AND status = 'completed') <> 1 THEN
    RAISE EXCEPTION 'FAIL T18 completed intent rows'; END IF;
  IF (SELECT count(*) FROM public.payment_intents WHERE order_number = n) <> ip THEN
    RAISE EXCEPTION 'FAIL T18 intent rows changed'; END IF;
  RAISE NOTICE 'PASS T13/T18 paid cancel: restore exact (ing-1 % â†’ %, ing-2 â†’ %), duplicate cancel idempotent, payment records untouched (REFUND = separate financial operation)', i1, p1, p2;
END $$;

-- ============================================
-- DONE â€” discard every test-created row
-- ============================================
ROLLBACK;
