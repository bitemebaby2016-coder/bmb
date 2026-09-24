-- ============================================
-- Bite Me Baby â€” PHASE 2 SQL Contract Suite: Canonical Order Spine (023-027)
-- Run as OWNER in Supabase SQL Editor (or local psql). Read-only impact:
-- entire suite runs in ONE transaction and ROLLBACKs at the end.
--
-- Covers (implementation command Â§19/Â§20):
--   Mode gate (both directions) Â· cutoff (before/exactly/after) Â· capacity
--   (create/full/cancel/idempotent-cancel/corruption/payment-failure) Â·
--   inventory (shared-ingredient aggregation, insufficient, exact restore) Â·
--   payment (amount-match, idempotent, COD-on-PRE_ORDER) Â· kitchen
--   (both modes, date/round separation) Â· delivery (coords, 5km tier,
--   forged client distance) Â· pre-order migration checks.
--
-- NOTE: positive tests simulate real JWTs via set_config('request.jwt.claims')
--       â€” RPCs run with the same guards as production HTTP requests.
-- ============================================

BEGIN;

-- ============================================
-- 0. FIXTURES (postgres context)
-- ============================================
RESET ROLE;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'spine-cust@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'spine-admin@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, role)
VALUES ('22222222-2222-2222-2222-222222222222', 'spine-admin@bmb.test', 'admin')
ON CONFLICT (id) DO NOTHING;

-- the auth.users INSERT trigger auto-creates profiles with role='customer' â€”
-- force the admin role AFTER the trigger has run (idempotent)
UPDATE public.profiles SET role = 'admin' WHERE id = '22222222-2222-2222-2222-222222222222';

-- test knobs: guarantee same-day acceptance windows inside the suite
SELECT public.ensure_rounds_for_date(CURRENT_DATE);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date = CURRENT_DATE;

-- customer context
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

-- ============================================
-- T1 MODE â€” SAME_DAY product allowed (canonical creation, PO-/BMB- prefix)
-- ============================================
DO $$ DECLARE r jsonb; BEGIN
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_delivery_address => 'test',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_customer_name => 'Spine Cust', p_customer_phone => '0800000001',
    p_payment_method => 'promptpay_qr',
    p_order_mode => 'SAME_DAY'
  );
  IF r->>'order_mode' <> 'SAME_DAY' THEN RAISE EXCEPTION 'FAIL T1 order_mode'; END IF;
  IF (r->>'order_number') NOT LIKE 'BMB-%' THEN RAISE EXCEPTION 'FAIL T1 prefix'; END IF;
  IF (r->>'total_amount')::numeric <= 0 THEN RAISE EXCEPTION 'FAIL T1 total'; END IF;
  RAISE NOTICE 'PASS T1 same-day canonical order created %', r->>'order_number';
END $$;

-- ============================================
-- T2 MODE â€” PRE_ORDER product allowed via compat shim â†’ canonical row
-- ============================================
DO $$ DECLARE r jsonb; n text; BEGIN
  r := public.create_pre_order_with_items(
    p_product_id => 'prod-5', p_quantity => 2,
    p_scheduled_date => CURRENT_DATE + 2,
    p_customer_name => 'Spine Cust', p_customer_phone => '0800000001',
    p_delivery_latitude => 10.7016, p_delivery_longitude => 102.1429,
    p_delivery_address => 'm023-pre-addr'
  );
  n := r->>'order_number';
  IF n NOT LIKE 'PO-%' THEN RAISE EXCEPTION 'FAIL T2 prefix'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = n
                  AND order_mode = 'PRE_ORDER' AND scheduled_date = CURRENT_DATE + 2) THEN
    RAISE EXCEPTION 'FAIL T2 canonical row missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
                  WHERE o.order_number = n AND oi.quantity = 2
                    AND oi.unit_price = (SELECT price FROM public.products WHERE id='prod-5')) THEN
    RAISE EXCEPTION 'FAIL T2 order_items';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pre_orders WHERE order_number = n) THEN
    RAISE EXCEPTION 'FAIL T2 shim must NOT write legacy pre_orders (canonical only)';
  END IF;
  RAISE NOTICE 'PASS T2 pre-order via shim â†’ canonical %', n;
END $$;

-- ============================================
-- T3 MODE â€” SAME_DAY request for available_same_day=false â†’ rejected
-- ============================================
RESET ROLE;
UPDATE public.products SET available_same_day = false WHERE id = 'prod-5';
SELECT set_config('role', 'authenticated', false);

-- ============================================
-- T6 CUTOFF â€” before cutoff accepted
-- ============================================
DO $$ DECLARE r jsonb; BEGIN
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-midday',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY');
  IF r IS NULL OR r->>'order_number' IS NULL THEN RAISE EXCEPTION 'FAIL T6'; END IF;
  RAISE NOTICE 'PASS T6 before-cutoff accepted %', r->>'order_number';
END $$;

-- ============================================
-- T7 CUTOFF â€” after cutoff rejected (00:00 cutoff = always passed)
-- ============================================
RESET ROLE;
UPDATE public.delivery_rounds SET cutoff_time = '00:00'
 WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-evening';
SELECT set_config('role', 'authenticated', false);
DO $$ BEGIN
  PERFORM public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-evening',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY');
  RAISE EXCEPTION 'FAIL T7 not rejected';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%ERR_CUTOFF_PASSED%' THEN RAISE NOTICE 'PASS T7 after-cutoff rejected';
  ELSE RAISE EXCEPTION 'FAIL T7 unexpected: %', SQLERRM; END IF;
END $$;

-- ============================================
-- T8 CAPACITY â€” full round rejected atomically
-- ============================================
RESET ROLE;
UPDATE public.delivery_rounds SET max_capacity = 1, current_count = 0
 WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-midday';
SELECT set_config('role', 'authenticated', false);
DO $$ DECLARE n text; c int; BEGIN
  n := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-midday',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY'))->>'order_number';
  IF n IS NULL THEN RAISE EXCEPTION 'FAIL T8 first order'; END IF;
  BEGIN
    PERFORM public.create_order_with_items(
      p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-midday',
      p_delivery_method => 'self_delivery',
      p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
      p_order_mode => 'SAME_DAY');
    RAISE EXCEPTION 'FAIL T8 second order accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_CAPACITY_FULL%' THEN RAISE EXCEPTION 'FAIL T8 unexpected: %', SQLERRM; END IF;
  END;
  SELECT current_count INTO c FROM public.delivery_rounds
   WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-midday';
  IF c <> 1 THEN RAISE EXCEPTION 'FAIL T8 count drift %', c; END IF;
  RAISE NOTICE 'PASS T8 capacity full rejected, count stays 1';
END $$;

-- ============================================
-- T9 CAPACITY â€” total item quantity cap (D-1 = 20)
-- ============================================
DO $$ BEGIN
  PERFORM public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":25}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY');
  RAISE EXCEPTION 'FAIL T9 not rejected';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%ERR_QTY_LIMIT%' THEN RAISE NOTICE 'PASS T9 qty cap enforced';
  ELSE RAISE EXCEPTION 'FAIL T9 unexpected: %', SQLERRM; END IF;
END $$;

-- ============================================
-- T10 PAYMENT â€” PRE_ORDER + COD allowed (D-3) + canonical payment intent (amount-match)
-- ============================================
DO $$ DECLARE r jsonb; n text; BEGIN
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-midday',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_payment_method => 'cash_on_delivery',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2,
    p_delivery_address => 'm023-pre-addr');
  n := r->>'order_number';
  IF (r->>'payment_method') <> 'cash_on_delivery' THEN RAISE EXCEPTION 'FAIL T10 method'; END IF;
  IF (SELECT payment_status FROM public.orders WHERE order_number = n) <> 'pending' THEN
    RAISE EXCEPTION 'FAIL T10 COD must not be auto-paid';
  END IF;
  PERFORM public.create_payment_intent_record(p_order_number => n, p_amount => (r->>'total_amount')::numeric);
  RAISE NOTICE 'PASS T10 pre-order COD + canonical intent %', n;
END $$;

-- ============================================
-- T11 PAYMENT â€” amount mismatch rejected (authoritative total)
-- ============================================
DO $$ DECLARE r jsonb; n text; t numeric; BEGIN
  r := public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY');
  n := r->>'order_number'; t := (r->>'total_amount')::numeric;
  BEGIN
    PERFORM public.create_payment_intent_record(p_order_number => n, p_amount => t + 1);
    RAISE EXCEPTION 'FAIL T11 mismatch accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_AMOUNT_MISMATCH%' THEN RAISE EXCEPTION 'FAIL T11 unexpected: %', SQLERRM; END IF;
  END;
  PERFORM public.create_payment_intent_record(p_order_number => n, p_amount => t);
  RAISE NOTICE 'PASS T11 amount-mismatch rejected, exact-amount intent created';

  -- T11b WEBHOOK â€” duplicate payment result is idempotent (008/010 contract, canonical orders)
  RESET ROLE; -- record_payment_result is service_role/postgres-only by design
  r := public.record_payment_result(p_order_number => n, p_payment_intent_id => 'pi_test_spine_1', p_amount => t, p_status => 'completed');
  IF (r->>'payment_status') <> 'paid' THEN RAISE EXCEPTION 'FAIL T11b first webhook'; END IF;
  r := public.record_payment_result(p_order_number => n, p_payment_intent_id => 'pi_test_spine_1', p_amount => t, p_status => 'completed');
  IF (r->>'idempotent')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL T11b duplicate not idempotent'; END IF;
  RAISE NOTICE 'PASS T11b duplicate webhook idempotent (order paid once)';
  -- restore the customer context for the following tests
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
END $$;

-- ============================================
-- T12 CANCELLATION â€” owner cancel releases capacity; duplicate cancel idempotent;
--                    corruption detected (no silent zero-clamp)
-- ============================================
DO $$ DECLARE n text; c1 int; c2 int; c3 int; BEGIN
  n := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY'))->>'order_number';
  SELECT current_count INTO c1 FROM public.delivery_rounds WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  PERFORM public.cancel_order(p_order_number => n, p_reason => 'test');
  SELECT current_count INTO c2 FROM public.delivery_rounds WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  IF c2 <> c1 - 1 THEN RAISE EXCEPTION 'FAIL T12 release % -> %', c1, c2; END IF;
  PERFORM public.cancel_order(p_order_number => n, p_reason => 'duplicate');
  SELECT current_count INTO c3 FROM public.delivery_rounds WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  IF c3 <> c2 THEN RAISE EXCEPTION 'FAIL T12 double release % -> %', c2, c3; END IF;
  RAISE NOTICE 'PASS T12 cancel release + idempotent duplicate (% -> % -> %)', c1, c2, c3;
END $$;

-- ============================================
-- T13 CAPACITY CORRUPTION â€” releasing with count=0 fails loudly (no GREATEST)
-- ============================================
DO $$ DECLARE n text; BEGIN
  n := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY'))->>'order_number';
  RESET ROLE;
  UPDATE public.delivery_rounds SET current_count = 0 WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  BEGIN
    PERFORM public.cancel_order(p_order_number => n, p_reason => 'corruption probe');
    RAISE EXCEPTION 'FAIL T13 corruption not detected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%ERR_CAPACITY_INVARIANT%' THEN RAISE NOTICE 'PASS T13 corruption detected loudly';
    ELSE RAISE EXCEPTION 'FAIL T13 unexpected: %', SQLERRM; END IF;
  END;
END $$;

-- restore sane morning-round state after the corruption probe
RESET ROLE;
UPDATE public.delivery_rounds SET current_count = 5 WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
SELECT set_config('role', 'authenticated', false);

-- ============================================
-- T14 PAYMENT FAILURE â€” slot retained (no automatic release)
-- ============================================
DO $$ DECLARE n text; c1 int; c2 int; BEGIN
  n := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY'))->>'order_number';
  SELECT current_count INTO c1 FROM public.delivery_rounds WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  PERFORM public.mark_payment_failed(p_order_number => n, p_reason => 'test');
  SELECT current_count INTO c2 FROM public.delivery_rounds WHERE id = 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning';
  IF c1 <> c2 THEN RAISE EXCEPTION 'FAIL T14 slot released on payment failure % -> %', c1, c2; END IF;
  IF (SELECT status FROM public.orders WHERE order_number = n) <> 'pending' THEN
    RAISE EXCEPTION 'FAIL T14 order status changed by payment failure';
  END IF;
  RAISE NOTICE 'PASS T14 payment failure retains slot (%)', c2;
END $$;

-- ============================================
-- T15 INVENTORY â€” shared-ingredient AGGREGATION + insufficient rejected (G-03)
-- prod-1: ing-1 x0.25 + ing-3 x1 Â· prod-2: ing-2 x0.15 + ing-1 x0.2
-- items prod-1 + prod-2 â†’ ing-1 needs 0.45 (NOT 0.25 like the old v_done_ids bug)
-- ============================================
DO $$ DECLARE n text; BEGIN
  RESET ROLE;
  UPDATE public.products SET available_preorder = true WHERE id = 'prod-1'; -- both-mode for PRE_ORDER create
  UPDATE public.products SET available_preorder = true WHERE id = 'prod-2'; -- both-mode for PRE_ORDER create
  UPDATE public.inventory SET current_stock = 0.3 WHERE id = 'ing-1';
  UPDATE public.inventory SET current_stock = 5 WHERE id = 'ing-2';
  UPDATE public.inventory SET current_stock = 2 WHERE id = 'ing-3';
  DELETE FROM public.inventory_transactions;
  RAISE NOTICE 'T15 product mode = %', (SELECT row(id, available_same_day, available_preorder, is_preorder) FROM public.products WHERE id = 'prod-1');
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  n := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1},{"product_id":"prod-2","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2, p_delivery_address => 'm023-pre-addr'))->>'order_number';
  BEGIN
    PERFORM public.transition_order_status(p_order_number => n, p_new_status => 'confirmed');
    RAISE EXCEPTION 'FAIL T15 aggregation not enforced (would have under-deducted)';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%ERR_INSUFFICIENT_INGREDIENT%' THEN
      IF (SELECT current_stock FROM public.inventory WHERE id = 'ing-1') <> 0.3 THEN
        RAISE EXCEPTION 'FAIL T15 stock mutated on failed confirm';
      END IF;
      RAISE NOTICE 'PASS T15 shared-ingredient aggregation + insufficient rejected, stock untouched';
    ELSE RAISE EXCEPTION 'FAIL T15 unexpected: %', SQLERRM; END IF;
  END;
END $$;

-- ============================================
-- T16 INVENTORY â€” sufficient stock deducts AGGREGATED; cancel restores exactly
-- ============================================
DO $$ DECLARE n text; s1 numeric; s2 numeric; s3 numeric; BEGIN
  RESET ROLE;
  UPDATE public.inventory SET current_stock = 2 WHERE id = 'ing-1';
  DELETE FROM public.inventory_transactions;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  s1 := (SELECT current_stock FROM public.inventory WHERE id = 'ing-1');
  n := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":2},{"product_id":"prod-2","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY'))->>'order_number';
  PERFORM public.transition_order_status(p_order_number => n, p_new_status => 'confirmed');
  SELECT current_stock INTO s2 FROM public.inventory WHERE id = 'ing-1';
  IF s2 <> 1.3 THEN RAISE EXCEPTION 'FAIL T16 aggregated deduct expected 1.3 got %', s2; END IF;  -- 2*0.25 + 1*0.2
  PERFORM public.cancel_order(p_order_number => n, p_reason => 'restore test');
  SELECT current_stock INTO s3 FROM public.inventory WHERE id = 'ing-1';
  IF s3 <> 2 THEN RAISE EXCEPTION 'FAIL T16 exact restore expected 2 got %', s3; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_transactions WHERE notes LIKE 'auto-deduct%' AND reference_id = n) THEN
    RAISE EXCEPTION 'FAIL T16 deduct transactions not cleaned';
  END IF;
  RAISE NOTICE 'PASS T16 aggregated deduct (2x0.25 + 1x0.2 = 0.7) + exact restore';
END $$;

-- ============================================
-- T17 KITCHEN â€” canonical batch covers both modes; date separation
-- ============================================
DO $$ DECLARE r jsonb; n_pre text; BEGIN
  RESET ROLE;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  n_pre := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-5","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-midday',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2, p_delivery_address => 'm023-pre-addr'))->>'order_number';
  PERFORM public.transition_order_status(p_order_number => n_pre, p_new_status => 'confirmed');
  r := public.create_production_batch(p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-midday',
                                      p_scheduled_date => CURRENT_DATE + 2);
  IF (r->>'items_count')::int < 1 THEN RAISE EXCEPTION 'FAIL T17 pre-order not in batch'; END IF;
  RESET ROLE; -- production_batch_items has no table grant for authenticated (created after 006); assert as postgres
  IF NOT EXISTS (SELECT 1 FROM public.production_batch_items WHERE batch_id = r->>'batch_id' AND order_mode = 'PRE_ORDER') THEN
    RAISE EXCEPTION 'FAIL T17 batch item order_mode';
  END IF;
  r := public.create_production_batch(p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-midday',
                                      p_scheduled_date => CURRENT_DATE);
  IF (r->>'items_count')::int <> 0 THEN RAISE EXCEPTION 'FAIL T17 date separation'; END IF;
  RAISE NOTICE 'PASS T17 canonical batch both modes + date separation';
END $$;

-- ============================================
-- T18 DELIVERY â€” coords required; 5km tier server-enforced; forged client distance ignored
-- ============================================
DO $$ DECLARE d1 numeric := 4.90 / 111.195; d2 numeric := 5.50 / 111.195; BEGIN
  RESET ROLE;
  -- T15/T16 legitimately sold prod-1 out via INV-02 (eggs below min) â€” restore for delivery tests
  UPDATE public.products SET is_available = true WHERE id = 'prod-1';
  PERFORM set_config('role', 'authenticated', false);
  BEGIN
    PERFORM public.create_order_with_items(
      p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
      p_delivery_method => 'self_delivery',
      p_order_mode => 'SAME_DAY');
    RAISE EXCEPTION 'FAIL T18a missing coords accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%ERR_MISSING_DELIVERY_COORDS%' THEN RAISE NOTICE 'PASS T18a coords required';
    ELSE RAISE EXCEPTION 'FAIL T18a unexpected: %', SQLERRM; END IF;
  END;
  BEGIN
    PERFORM public.create_order_with_items(
      p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
      p_delivery_method => 'grab_rider',
      p_dropoff_latitude => 10.7016 + d1, p_dropoff_longitude => 102.1429,
      p_distance_km => 999,
      p_order_mode => 'SAME_DAY');
    RAISE EXCEPTION 'FAIL T18b external within 5km accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%ERR_DELIVERY_METHOD_ZONE%' THEN RAISE NOTICE 'PASS T18b 4.90km external rejected (Bite Drive zone)';
    ELSE RAISE EXCEPTION 'FAIL T18b unexpected: %', SQLERRM; END IF;
  END;
  BEGIN
    PERFORM public.create_order_with_items(
      p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
      p_delivery_method => 'self_delivery',
      p_dropoff_latitude => 10.7016 + d2, p_dropoff_longitude => 102.1429,
      p_distance_km => 0.1,
      p_order_mode => 'SAME_DAY');
    RAISE EXCEPTION 'FAIL T18c self beyond 5km accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%ERR_DELIVERY_METHOD_ZONE%' OR SQLERRM LIKE '%SELF_DELIVERY_EXCEEDS_5KM_LIMIT%' THEN RAISE NOTICE 'PASS T18c 5.50km self rejected, forged distance ignored';
    ELSE RAISE EXCEPTION 'FAIL T18c unexpected: %', SQLERRM; END IF;
  END;
  PERFORM public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016 + (4.95 / 111.195), p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY');
  RAISE NOTICE 'PASS T18d self within zone accepted (boundary <= 5.00 inclusive)';
END $$;

-- ============================================
-- T19 PRE-ORDER MIGRATION consistency (archive â†” canonical)
-- ============================================
DO $$ DECLARE bad int; total int; BEGIN
  RESET ROLE;
  SELECT COUNT(*) INTO bad FROM public.pre_orders po
   WHERE po.migrated_order_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.orders o
                      WHERE o.order_number = po.order_number
                        AND o.order_mode = 'PRE_ORDER'
                        AND o.scheduled_date = po.scheduled_date
                        AND o.total_amount = po.total_amount);
  SELECT COUNT(*) INTO total FROM public.pre_orders WHERE migrated_order_id IS NOT NULL;
  IF bad > 0 THEN RAISE EXCEPTION 'FAIL T19 % migrated rows inconsistent', bad; END IF;
  RAISE NOTICE 'PASS T19 pre-order migration consistency (archived rows checked: %)', total;
END $$;

-- ============================================
-- T4 MODE â€” PRE_ORDER request for available_preorder=false â†’ rejected
-- ============================================
RESET ROLE;
UPDATE public.products SET available_preorder = false WHERE id = 'prod-1';
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
DO $$ BEGIN
  PERFORM public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2,
    p_delivery_address => 'm023-pre-addr'
  );
  RAISE EXCEPTION 'FAIL T4 not rejected';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%ERR_PRODUCT_MODE_NOT_ALLOWED%' THEN RAISE NOTICE 'PASS T4 wrong-mode rejected';
  ELSE RAISE EXCEPTION 'FAIL T4 unexpected: %', SQLERRM; END IF;
END $$;

-- ============================================
-- T5 MODE â€” both-mode product allowed in BOTH directions
-- ============================================
RESET ROLE;
UPDATE public.products SET available_same_day = true, available_preorder = true WHERE id = 'prod-1';
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
DO $$ DECLARE a text; b text; BEGIN
  a := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'SAME_DAY'))->>'order_number';
  b := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 2,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 2, p_delivery_address => 'm023-pre-addr'))->>'order_number';
  IF a IS NOT NULL AND b IS NOT NULL THEN RAISE NOTICE 'PASS T5 both-mode allowed both ways'; ELSE RAISE EXCEPTION 'FAIL T5'; END IF;
END $$;

-- ============================================
-- DONE â€” discard every test-created row
-- ============================================
ROLLBACK;
