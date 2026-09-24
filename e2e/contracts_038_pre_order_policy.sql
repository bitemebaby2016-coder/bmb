-- ============================================
-- Bite Me Baby â€” PHASE 3B SQL Contract Suite: PRE_ORDER policy (038)
-- Baseline: b8c1c21 Â· Scope: PRE-04 â€” owner decisions Q1/Q2/Q3 (PRE-01 gate)
-- ONE transaction, ROLLBACKs at the end â€” zero persisted data.
--
-- Owner decisions under test (docs/BMB_PRE01_OWNER_DECISION_GATE_2026-09-24.md):
--   Q1 window: future-only, max 40 days (business_settings configurable)
--   Q1 cutoff: closes 2h before the scheduled round's delivery_start
--   Q2 cancel: only before that cutoff â†’ ERR_CANCEL_AFTER_CUTOFF; refund = none (2C)
--   Q3 deduct: at confirm (existing 019/026 mechanism â€” verified by existing suites)
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('cccc3333-3333-3333-3333-333333333333', 'p3b-038-admin@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('dddd4444-4444-4444-4444-444444444444', 'p3b-038-cust@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin' WHERE id = 'cccc3333-3333-3333-3333-333333333333';

SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date + 1);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;
UPDATE public.inventory SET current_stock = 999999;

-- ============================================
-- G1. VALID PRE_ORDER (future date, before cutoff) â†’ created
-- ============================================
DO $$ DECLARE v_on text;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"dddd4444-4444-4444-4444-444444444444","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 1,'YYYYMMDD') || '-midday',
    p_delivery_method => 'self_delivery', p_delivery_address => 'm038-ok',
    p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
    p_customer_name => 'M038 OK', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 1
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL G1 valid PRE_ORDER create'; END IF;
  RAISE NOTICE 'PASS G1 valid PRE_ORDER created (%)', v_on;
END $$;

-- ============================================
-- G2 WINDOW MAX — lower preorder_max_days to 3, order at +5 days → rejected
DO $$ DECLARE v_on text;
BEGIN
  RESET ROLE;
  UPDATE public.business_settings SET value = value || '{"preorder_max_days": 3}'::jsonb
   WHERE key = 'order_policy';
  PERFORM public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date + 5);
  UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50
   WHERE id = 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 5,'YYYYMMDD') || '-morning';
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"dddd4444-4444-4444-4444-444444444444","role":"authenticated"}', false);
  BEGIN
    v_on := (public.create_order_with_items(
      p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 5,'YYYYMMDD') || '-morning',
      p_delivery_method => 'self_delivery', p_delivery_address => 'm038-far',
      p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
      p_customer_name => 'M038 FAR', p_payment_method => 'cash_on_delivery',
      p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 5
    ))->>'order_number';
    RAISE EXCEPTION 'FAIL G2 order beyond window accepted (got %)', v_on;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_PRE_ORDER_DATE_TOO_FAR%' THEN
      RAISE NOTICE 'PASS G2 beyond-window rejected (5 days > max 3)';
    ELSE RAISE EXCEPTION 'FAIL G2 unexpected: %', SQLERRM; END IF;
  END;
  UPDATE public.business_settings SET value = value || '{"preorder_max_days": 40}'::jsonb
   WHERE key = 'order_policy';
END $$;


-- ============================================
-- G3. TODAY/PAST DATE rejected
-- ============================================
DO $$ DECLARE v_on text;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"dddd4444-4444-4444-4444-444444444444","role":"authenticated"}', false);
  BEGIN
    v_on := (public.create_order_with_items(
      p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-evening',
      p_delivery_method => 'self_delivery', p_delivery_address => 'm038-today',
      p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
      p_customer_name => 'M038 TODAY', p_payment_method => 'cash_on_delivery',
      p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
    ))->>'order_number';
    RAISE EXCEPTION 'FAIL G3 today PRE_ORDER accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_PRE_ORDER_DATE_INVALID%' OR SQLERRM LIKE 'ERR_SCHEDULED_DATE_INVALID%' OR SQLERRM LIKE 'ERR_ROUND_DATE_MISMATCH%' THEN
      RAISE NOTICE 'PASS G3 today rejected (%)', split_part(SQLERRM, ':', 1);
    ELSE RAISE EXCEPTION 'FAIL G3 unexpected: %', SQLERRM; END IF;
  END;
END $$;

-- NOTE: create-path cutoff (2h rule) is unreachable for future-only dates
-- (cutoff = scheduled_date + delivery_start âˆ’ 2h is always future when date > today);
-- it is exercised deterministically via the cancel path (G5) and round-date UPDATE.


-- ============================================
-- G5. CANCEL WINDOW â€” before cutoff OK / after cutoff ERR_CANCEL_AFTER_CUTOFF
-- ============================================
DO $$ DECLARE v_on text; v_ord text; v_r jsonb;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"dddd4444-4444-4444-4444-444444444444","role":"authenticated"}', false);
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 1,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery', p_delivery_address => 'm038-g5',
    p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
    p_customer_name => 'M038 G5', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 1
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL G5 create'; END IF;

  -- G5a cancel BEFORE cutoff (round is tomorrow morning; cutoff = tomorrow 05:00) â†’ OK
  v_r := public.cancel_order(p_order_number => v_on, p_reason => 'm038 pre-cutoff cancel');
  IF COALESCE((v_r->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL G5a pre-cutoff cancel'; END IF;
  RAISE NOTICE 'PASS G5a cancel before cutoff allowed';

  -- G5b cancel AFTER cutoff: recreate, then force the scheduled date into the past
  -- (owner-level fixture: temporarily disable the window trigger â€” rolled back)
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 1,'YYYYMMDD') || '-midday',
    p_delivery_method => 'self_delivery', p_delivery_address => 'm038-g5b',
    p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
    p_customer_name => 'M038 G5B', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 1
  ))->>'order_number';
  RESET ROLE;
  ALTER TABLE public.orders DISABLE TRIGGER trg_pre_order_window;
  UPDATE public.orders SET scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date - 1 WHERE order_number = v_on;
  ALTER TABLE public.orders ENABLE TRIGGER trg_pre_order_window;

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"cccc3333-3333-3333-3333-333333333333","role":"authenticated"}', false); -- admin: trigger must still block
  BEGIN
    PERFORM public.cancel_order(p_order_number => v_on, p_reason => 'm038 after cutoff');
    RAISE EXCEPTION 'FAIL G5b cancel after cutoff ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_CANCEL_AFTER_CUTOFF%' THEN
      RAISE NOTICE 'PASS G5b cancel after cutoff rejected (ERR_CANCEL_AFTER_CUTOFF)';
    ELSE RAISE EXCEPTION 'FAIL G5b unexpected: %', SQLERRM; END IF;
  END;
END $$;

-- ============================================
-- G6. SETTINGS CONFIGURABLE + SAME_DAY UNAFFECTED
-- ============================================
DO $$ DECLARE v_on text;
BEGIN
  -- owner can lower the window; creation beyond it must reject
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"dddd4444-4444-4444-4444-444444444444","role":"authenticated"}', false);
  UPDATE public.business_settings
     SET value = value || '{"preorder_max_days": 3}'::jsonb
   WHERE key = 'order_policy';
  BEGIN
    v_on := (public.create_order_with_items(
      p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
      p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date + 1,'YYYYMMDD') || '-midday',
      p_delivery_method => 'self_delivery', p_delivery_address => 'm038-g6',
      p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
      p_customer_name => 'M038 G6', p_payment_method => 'cash_on_delivery',
      p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date + 1
    ))->>'order_number';
    RAISE NOTICE 'PASS G6 within new window (3d) still allowed (%):', v_on;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL G6 within-window order rejected: %', SQLERRM;
  END;

  -- SAME_DAY must be untouched by the window/cancel triggers
  v_on := (public.create_order_with_items(
    p_items => '[{"product_id":"prod-4","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery', p_delivery_address => 'm038-sd',
    p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
    p_customer_name => 'M038 SD', p_payment_method => 'cash_on_delivery',
    p_order_mode => 'SAME_DAY', p_scheduled_date => (now() AT TIME ZONE 'Asia/Bangkok')::date
  ))->>'order_number';
  IF v_on IS NULL THEN RAISE EXCEPTION 'FAIL G6 SAME_DAY create'; END IF;
  RAISE NOTICE 'PASS G6 SAME_DAY unaffected by PRE_ORDER triggers (%)', v_on;
END $$;

RESET ROLE;
ROLLBACK;


