-- ============================================
-- Bite Me Baby — QA-03 SQL Contract Suite for migration 020 (OWNER: SQL Editor)
-- ALL tests run inside a transaction that ROLLS BACK — zero production writes persist.
-- Must pass AFTER:  supabase db push   (migration 020)
-- ============================================
BEGIN;

DO $$
DECLARE
  v_fee numeric;
  v_result jsonb;
  v_driver_id text;
  v_order public.orders%ROWTYPE;
  v_round public.delivery_rounds%ROWTYPE;
BEGIN
  -- 0) helpers exist
  IF to_regprocedure('public.haversine_km(numeric,numeric,numeric,numeric)') IS NULL
     OR to_regprocedure('public.compute_delivery_fee(numeric,numeric,text,integer,numeric)') IS NULL
     OR to_regprocedure('public.compute_delivery_fee_rpc(numeric,numeric,text,integer,numeric)') IS NULL
     OR to_regprocedure('public.upsert_driver(text,text,text)') IS NULL
     OR to_regprocedure('public.assign_driver(text,text)') IS NULL
     OR to_regprocedure('public.driver_login(text,text)') IS NULL
     OR to_regprocedure('public.driver_accept_assignment(text,text)') IS NULL
     OR to_regprocedure('public.driver_update_delivery_status(text,text,text,numeric,numeric)') IS NULL
     OR to_regprocedure('public.my_deliveries(text)') IS NULL THEN
    RAISE EXCEPTION 'FAIL migration 020 functions missing';
  END IF;

  -- 1) DEL-01: nearest zone fee (seeded zones: city 0-5 = 25, suburb 5-10 = 45)
  v_fee := public.compute_delivery_fee(10.71, 102.15, 'self_delivery', 1, NULL);
  IF v_fee <> 25 THEN RAISE EXCEPTION 'FAIL city zone fee: %', v_fee; END IF;
  v_fee := public.compute_delivery_fee(NULL, NULL, 'self_delivery', 1, 8);
  IF v_fee <> 45 THEN RAISE EXCEPTION 'FAIL suburb zone fee (by distance): %', v_fee; END IF;

  -- 2) DEL-02: driver login (self-upsert by phone) inside rollback txn
  v_result := public.driver_login('0800000001', 'QA Rider');
  v_driver_id := (v_result->'driver'->>'id')::text;
  IF v_driver_id IS NULL OR v_driver_id = '' THEN RAISE EXCEPTION 'FAIL driver_login'; END IF;

  -- 3) DEL-02: dispatchable order + assign
  SELECT * INTO v_round FROM public.delivery_rounds
   WHERE status IN ('active','open','scheduled') AND current_count < max_capacity LIMIT 1;
  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone,
                             delivery_round_id, status, delivery_method, payment_method, total_amount)
  VALUES ('qa-drive-probe', 'QA-BITE-DRIVE-001', 'qa-cust', 'QA Drive', '0800000002',
          v_round.id, 'ready_for_dispatch', 'self_delivery', 'promptpay_qr', 1)
  ON CONFLICT (id) DO NOTHING;

  v_result := public.assign_driver('QA-BITE-DRIVE-001', v_driver_id);
  IF (v_result->>'status') <> 'assigned' THEN RAISE EXCEPTION 'FAIL assign_driver'; END IF;

  -- 4) DEL-02: driver accept + advance + deliver
  v_result := public.driver_accept_assignment('QA-BITE-DRIVE-001', '0800000001');
  IF (v_result->>'status') <> 'accepted' THEN RAISE EXCEPTION 'FAIL accept'; END IF;
  v_result := public.driver_update_delivery_status('QA-BITE-DRIVE-001', '0800000001', 'in_transit', 10.75, 102.2);
  IF (v_result->>'status') <> 'in_transit' THEN RAISE EXCEPTION 'FAIL in_transit'; END IF;
  v_result := public.driver_update_delivery_status('QA-BITE-DRIVE-001', '0800000001', 'delivered', 10.75, 102.2);
  IF (v_result->>'status') <> 'delivered' THEN RAISE EXCEPTION 'FAIL delivered'; END IF;

  -- 5) my_deliveries lists it
  v_result := public.my_deliveries('0800000001');
  IF NOT (v_result->>'assignments')::jsonb @> '[{"order_number":"QA-BITE-DRIVE-001"}]' THEN
    RAISE EXCEPTION 'FAIL my_deliveries missing assignment';
  END IF;

  RAISE NOTICE 'QA-03 migration 020 SQL suite PASS (transaction rolled back — no writes persisted)';
END $$;

ROLLBACK;
-- ============================================
-- END — paste output into e2e/contracts-020-bite-drive-sql-result.txt (owner action, read-only)
-- ============================================