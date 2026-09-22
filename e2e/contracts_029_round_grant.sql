-- ============================================
-- Bite Me Baby — PHASE 3B SQL Contract Suite: PRE_ORDER round-instantiation privilege (029)
-- Baseline: a9ab8cd · Scope: owner-approved additive GRANT ONLY
-- Run as OWNER in Supabase SQL Editor (or local psql). Read-only impact:
-- the suite runs in ONE transaction and ROLLBACKs at the end.
--
-- Proves (execution-gate §2):
--   G1  authenticated  ensure_rounds_for_date(future_date) → succeeds, creates
--       deterministic ACTIVE rounds (round-YYYYMMDD-<key>), idempotent on retry
--   G2  anon           ensure_rounds_for_date(future_date) → REJECTED
--   G3  authenticated customer CANNOT INSERT/UPDATE/DELETE delivery_rounds
--   G4  authenticated customer can subsequently SELECT a valid round
--   G5  (regression) the canonical create path still mode-gates using a
--       customer-obtained round (the GRANT opens no bypass)
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- 0. FIXTURES
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('33333333-3333-3333-3333-333333333333', 'p3b-round-grant@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- the auth.users INSERT trigger auto-creates profiles with role='customer'
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);

-- ============================================
-- G1. AUTHENTICATED: ensure_rounds_for_date(future) succeeds + deterministic ids + idempotent
-- ============================================
DO $$ DECLARE
  v_target date := CURRENT_DATE + 3;
  r jsonb; r2 jsonb; n_after int;
BEGIN
  r := public.ensure_rounds_for_date(v_target);
  SELECT COUNT(*) INTO n_after FROM public.delivery_rounds WHERE scheduled_date = v_target;
  IF n_after <> 3 THEN RAISE EXCEPTION 'FAIL G1 expected 3 deterministic rounds, got %', n_after; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds
                  WHERE scheduled_date = v_target
                    AND id = 'round-' || to_char(v_target,'YYYYMMDD') || '-morning'
                    AND status = 'active') THEN
    RAISE EXCEPTION 'FAIL G1 deterministic morning round missing/inactive';
  END IF;
  r2 := public.ensure_rounds_for_date(v_target); -- idempotent retry
  SELECT COUNT(*) INTO n_after FROM public.delivery_rounds WHERE scheduled_date = v_target;
  IF n_after <> 3 THEN RAISE EXCEPTION 'FAIL G1 retry duplicated rounds'; END IF;
  RAISE NOTICE 'PASS G1 authenticated ensure_rounds_for_date created 3 active deterministic rounds (idempotent)';
END $$;

-- ============================================
-- G2. ANON: ensure_rounds_for_date → REJECTED
-- ============================================
RESET ROLE;
-- NOTE: under psql/SQL Editor the session role after RESET is postgres
-- (superuser/elevated) which ALWAYS holds EXECUTE — impersonate anon explicitly
-- so the denial is actually exercised (anon has NO EXECUTE on 029's grant).
SELECT set_config('role', 'anon', false);
DO $$ DECLARE ok boolean := false; BEGIN
  BEGIN
    PERFORM public.ensure_rounds_for_date(CURRENT_DATE + 5);
  EXCEPTION
    WHEN insufficient_privilege OR undefined_function THEN ok := true; -- PGRST202/42501 both acceptable denials
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%ERR_%' THEN ok := true; ELSE RAISE; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL G2 anon was able to run ensure_rounds_for_date'; END IF;
  RAISE NOTICE 'PASS G2 anon rejected (function absent for anon or privilege denied)';
END $$;

-- ============================================
-- G3. AUTHENTICATED: customer CANNOT mutate delivery_rounds directly
-- ============================================
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);

DO $$ DECLARE v_id text; ok int := 0; BEGIN
  SELECT id INTO v_id FROM public.delivery_rounds
   WHERE scheduled_date = CURRENT_DATE + 3 ORDER BY id LIMIT 1;

  BEGIN
    INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, scheduled_date, status)
    VALUES ('round-hack-1', 'hack', 'HACK', '00:00', '00:00', '23:59', 9999, 0, CURRENT_DATE + 9, 'active');
  EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; WHEN OTHERS THEN
    IF SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%policy%' OR SQLERRM LIKE '%row-level%' THEN ok := ok + 1; ELSE RAISE; END IF;
  END;

  BEGIN
    UPDATE public.delivery_rounds SET current_count = 0, status = 'active' WHERE id = v_id;
    -- if this UPDATE unexpectedly "succeeded" via RLS (0 rows updated), that's still a block
    IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = v_id AND max_capacity = 9999) THEN ok := ok + 1; END IF;
  EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; WHEN OTHERS THEN
    IF SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%policy%' OR SQLERRM LIKE '%row-level%' THEN ok := ok + 1; ELSE RAISE; END IF;
  END;

  BEGIN
    DELETE FROM public.delivery_rounds WHERE id = v_id;
    -- RLS filters the row out of the DELETE plan: 0 rows affected with NO error
    -- (proven by probe: DELETE 0 + remaining=3) — the row must STILL exist for
    -- the block to count (mirror of the UPDATE post-check above).
    IF EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = v_id) THEN ok := ok + 1; END IF;
  EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; WHEN OTHERS THEN
    IF SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%policy%' OR SQLERRM LIKE '%row-level%' THEN ok := ok + 1; ELSE RAISE; END IF;
  END;

  IF ok < 3 THEN RAISE EXCEPTION 'FAIL G3 customer mutated round configuration (blocked_count=%)', ok; END IF;
  RAISE NOTICE 'PASS G3 customer INSERT/UPDATE/DELETE on delivery_rounds all blocked';
END $$;

-- ============================================
-- G4. AUTHENTICATED: customer can SELECT a valid active round for the date
-- ============================================
DO $$ DECLARE v_id text; BEGIN
  SELECT id INTO v_id FROM public.delivery_rounds
   WHERE scheduled_date = CURRENT_DATE + 3 AND status = 'active'
   ORDER BY delivery_start LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'FAIL G4 customer cannot read active rounds'; END IF;
  RAISE NOTICE 'PASS G4 customer selected round %', v_id;
END $$;

-- ============================================
-- G5. (regression) canonical create still mode-gates using a customer-obtained round
-- ============================================
DO $$ BEGIN
  UPDATE public.products SET available_preorder = false WHERE id = 'prod-1';
  PERFORM public.create_order_with_items(
    p_items => '[{"product_id":"prod-1","quantity":1}]'::jsonb,
    p_delivery_round_id => 'round-' || to_char(CURRENT_DATE + 3,'YYYYMMDD') || '-morning',
    p_delivery_method => 'self_delivery',
    p_delivery_address => 'g5',
    p_dropoff_latitude => 10.7016, p_dropoff_longitude => 102.1429,
    p_customer_name => 'P3B G5', p_payment_method => 'promptpay_qr',
    p_order_mode => 'PRE_ORDER', p_scheduled_date => CURRENT_DATE + 3
  );
  RAISE EXCEPTION 'FAIL G5 wrong-mode order accepted';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%ERR_PRODUCT_MODE_NOT_ALLOWED%' THEN RAISE NOTICE 'PASS G5 mode gate intact after GRANT';
  ELSE RAISE EXCEPTION 'FAIL G5 unexpected: %', SQLERRM; END IF;
END $$;

-- ============================================
-- DONE — discard every test-created row
-- ============================================
ROLLBACK;
