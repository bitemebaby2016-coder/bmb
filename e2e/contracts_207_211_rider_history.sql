-- ============================================================
-- Contract 207+211 — Rider History (my_deliveries v3 + v3-fixed)
-- ครอบคลุม:
--   207.1 my_deliveries 5-arg (no defaults) — scheduled_date from delivery_rounds.scheduled_date
--   207.2 filter params: p_assigned_from/to (timestamptz) + p_scheduled_from/to (date)
--   207.3 JOIN delivery_rounds via orders.delivery_round_id (NOT legacy round_id)
--   207.4 offline gate: driver status='offline' → ERR_DRIVER_OFFLINE
--   207.5 ambiguity guards: 0-arg and 1-arg resolve unambiguously
--   211.1 RETURN uses to_jsonb(v_drv) not subquery SELECT *
--   211.2 verify_return DO block runs with real JWT → ok=true + driver object
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: rider + orders ----------
DO $$
DECLARE
  v_rider_uid uuid := '210a2070-0000-4000-8000-000000000001';
  v_rider_id text := 'drv-c207-1';
  v_round_id text := 'round-c207-1';
  v_round_id2 text := 'round-c207-2';
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_rider_uid,'fixture-c207@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated'),
         ('210a2070-0000-4000-8000-000000000009','fixture-c207-cust@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name)
  VALUES ('cust-c207', '210a2070-0000-4000-8000-000000000009', 'C207 Cust')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.drivers (id, name, phone, status, user_id, tenant_id)
  VALUES (v_rider_id, 'Contract 207 Rider', '0812072071', 'available', v_rider_uid, 'tenant-bmb-001')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.branches (id, code, slug, name, tenant_id, address_line1, latitude, longitude, kitchen_latitude, kitchen_longitude, status)
  VALUES ('br-c207', 'c207', 'c207', 'Contract 207 Branch', 'tenant-bmb-001', '207 Test Road', 13.0, 100.0, 13.0, 100.0, 'active')
  ON CONFLICT (id) DO NOTHING;

  -- today round
  INSERT INTO public.delivery_rounds (id, branch_id, tenant_id, name, display_name, scheduled_date, cutoff_time, delivery_start, delivery_end, status, max_capacity, current_count)
  VALUES (v_round_id, 'br-c207', 'tenant-bmb-001', 'Today Round', 'Today Round', (now() AT TIME ZONE 'Asia/Bangkok')::date, '22:00', '10:00', '12:00', 'active', 50, 0)
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

  -- tomorrow round
  INSERT INTO public.delivery_rounds (id, branch_id, tenant_id, name, display_name, scheduled_date, cutoff_time, delivery_start, delivery_end, status, max_capacity, current_count)
  VALUES (v_round_id2, 'br-c207', 'tenant-bmb-001', 'Tomorrow Round', 'Tomorrow Round', (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, '22:00', '10:00', '12:00', 'active', 50, 0)
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

  -- fixture orders + assignments
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, delivery_round_id, branch_id)
  VALUES
    ('ord-c207-1', 'BMB-C207-001', 'cust-c207', '210a2070-0000-4000-8000-000000000009', 'C207 Cust', '0812072071', 'dispatched', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', v_round_id, 'br-c207'),
    ('ord-c207-2', 'BMB-C207-002', 'cust-c207', '210a2070-0000-4000-8000-000000000009', 'C207 Cust', '0812072071', 'in_transit', 'self_delivery', 'pending', 'promptpay_qr', 200, 'SAME_DAY', v_round_id, 'br-c207'),
    ('ord-c207-3', 'BMB-C207-003', 'cust-c207', '210a2070-0000-4000-8000-000000000009', 'C207 Cust', '0812072071', 'delivered', 'self_delivery', 'paid', 'promptpay_qr', 150, 'SAME_DAY', v_round_id2, 'br-c207'),
    ('ord-c207-4', 'BMB-C207-004', 'cust-c207', '210a2070-0000-4000-8000-000000000009', 'C207 Cust', '0812072071', 'ready_for_dispatch', 'self_delivery', 'pending', 'promptpay_qr', 120, 'SAME_DAY', v_round_id, 'br-c207')
  ON CONFLICT (order_number) DO NOTHING;

  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, branch_id, assigned_at, accepted_at)
  VALUES
    ('das-c207-1', 'BMB-C207-001', v_rider_id, 'accepted', 'br-c207', NOW() - interval '2 hours', NOW() - interval '1 hour 50 min'),
    ('das-c207-2', 'BMB-C207-002', v_rider_id, 'picked_up', 'br-c207', NOW() - interval '4 hours', NOW() - interval '2 hours 50 min'),
    ('das-c207-3', 'BMB-C207-003', v_rider_id, 'delivered', 'br-c207', NOW() - interval '1 day', NOW() - interval '23 hours')
  ON CONFLICT (order_number) DO NOTHING;

  -- dispatch offer
  INSERT INTO public.dispatch_offers (id, order_number, branch_id, status, created_at, updated_at)
  VALUES ('do-c207-1', 'BMB-C207-004', 'br-c207', 'offered', NOW(), NOW())
  ON CONFLICT (order_number) DO NOTHING;

  RAISE NOTICE 'Fixture ready for 207+211';
END $$;

-- ---------- 207.1 my_deliveries 5-arg — scheduled_date + filters ----------
DO $$
DECLARE
  v_rider_uid uuid := '210a2070-0000-4000-8000-000000000001';
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);

  -- no filters (NULL) = all
  v_result := public.my_deliveries('', NULL, NULL, NULL, NULL);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '207.1 FAIL: my_deliveries failed: %', v_result;
  END IF;

  -- verify assignments have scheduled_date
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'assignments') a
    WHERE a->>'scheduled_date' IS NOT NULL
  ) THEN
    RAISE EXCEPTION '207.1 FAIL: assignments missing scheduled_date';
  END IF;

  -- verify offers have scheduled_date
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'offers') o
    WHERE o->>'scheduled_date' IS NOT NULL
  ) THEN
    RAISE EXCEPTION '207.1 FAIL: offers missing scheduled_date';
  END IF;

  -- filter by assigned_at range
  v_result := public.my_deliveries('', NOW() - interval '3 hours', NOW() - interval '1 hour', NULL, NULL);
  IF jsonb_array_length(v_result->'assignments') <> 1 THEN
    RAISE EXCEPTION '207.1 FAIL: assigned_at filter should return 1, got %', jsonb_array_length(v_result->'assignments');
  END IF;

  -- filter by scheduled_date range (today)
  v_result := public.my_deliveries('', NULL, NULL, (now() AT TIME ZONE 'Asia/Bangkok')::date, (now() AT TIME ZONE 'Asia/Bangkok')::date);
  IF jsonb_array_length(v_result->'assignments') <> 2 THEN
    RAISE EXCEPTION '207.1 FAIL: scheduled_date today filter should return 2, got %', jsonb_array_length(v_result->'assignments');
  END IF;

  -- filter by scheduled_date range (tomorrow)
  v_result := public.my_deliveries('', NULL, NULL, (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, (now() AT TIME ZONE 'Asia/Bangkok')::date + 1);
  IF jsonb_array_length(v_result->'assignments') <> 1 THEN
    RAISE EXCEPTION '207.1 FAIL: scheduled_date tomorrow filter should return 1, got %', jsonb_array_length(v_result->'assignments');
  END IF;

  RAISE NOTICE '207.1 PASS: my_deliveries 5-arg scheduled_date + filters OK';
END $$;

-- ---------- 207.3 JOIN delivery_rounds via delivery_round_id ----------
-- Verified implicitly by scheduled_date working above

-- ---------- 207.4 offline gate ----------
DO $$
DECLARE
  v_rider_uid uuid := '210a2070-0000-4000-8000-000000000001';
  v_result jsonb;
BEGIN
  -- set driver offline
  UPDATE public.drivers SET status = 'offline', updated_at = NOW() WHERE id = 'drv-c207-1';

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);

  BEGIN
    v_result := public.my_deliveries('', NULL, NULL, NULL, NULL);
    RAISE EXCEPTION '207.4 FAIL: offline driver should raise ERR_DRIVER_OFFLINE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%ERR_DRIVER_OFFLINE%' THEN
      RAISE EXCEPTION '207.4 FAIL: expected ERR_DRIVER_OFFLINE, got: %', SQLERRM;
    END IF;
  END;

  -- restore available
  UPDATE public.drivers SET status = 'available', updated_at = NOW() WHERE id = 'drv-c207-1';

  RAISE NOTICE '207.4 PASS: offline gate ERR_DRIVER_OFFLINE OK';
END $$;

-- ---------- 207.5 ambiguity guards ----------
DO $$
BEGIN
  -- 0-arg should resolve to legacy my_deliveries(text) not ambiguous
  BEGIN
    PERFORM public.my_deliveries();
    RAISE EXCEPTION '207.5 FAIL: 0-arg should raise ERR_NOT_AUTHENTICATED';
  EXCEPTION
    WHEN ambiguous_function THEN
      RAISE EXCEPTION '207.5 FAIL: my_deliveries() ambiguous (42725)';
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%ERR_NOT_AUTHENTICATED%' THEN
        RAISE EXCEPTION '207.5 FAIL: 0-arg unexpected error: %', SQLERRM;
      END IF;
  END;

  -- 1-arg should resolve to legacy my_deliveries(text) not ambiguous
  BEGIN
    PERFORM public.my_deliveries('0000000000'::text);
    RAISE EXCEPTION '207.5 FAIL: 1-arg should raise ERR_NOT_AUTHENTICATED';
  EXCEPTION
    WHEN ambiguous_function THEN
      RAISE EXCEPTION '207.5 FAIL: my_deliveries(text) ambiguous (42725)';
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%ERR_NOT_AUTHENTICATED%' THEN
        RAISE EXCEPTION '207.5 FAIL: 1-arg unexpected error: %', SQLERRM;
      END IF;
  END;

  RAISE NOTICE '207.5 PASS: ambiguity guards 0-arg/1-arg unambiguous';
END $$;

-- ---------- 211.1 RETURN uses to_jsonb(v_drv) ----------
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef('public.my_deliveries(text, timestamptz, timestamptz, date, date)'::regprocedure) INTO v_src;

  IF v_src NOT LIKE '%to_jsonb(v_drv)%' THEN
    RAISE EXCEPTION '211.1 FAIL: RETURN must use to_jsonb(v_drv): %', v_src;
  END IF;

  IF v_src LIKE '%to_jsonb((SELECT * FROM public.drivers%' THEN
    RAISE EXCEPTION '211.1 FAIL: subquery SELECT * in RETURN still present (bug)';
  END IF;

  RAISE NOTICE '211.1 PASS: RETURN uses to_jsonb(v_drv) OK';
END $$;

-- ---------- 211.2 verify_return DO block (simulated) ----------
DO $$
DECLARE
  v_rider_uid uuid := '210a2070-0000-4000-8000-000000000001';
  v_result jsonb;
BEGIN
  -- This simulates the verify_return DO block from migration 211
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_rider_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_result := public.my_deliveries('', NULL, NULL, NULL, NULL);

  IF (v_result->>'ok') <> 'true' THEN
    RAISE EXCEPTION '211.2 FAIL: my_deliveries not ok=true: %', v_result;
  END IF;
  IF (v_result->'driver'->>'id') IS NULL THEN
    RAISE EXCEPTION '211.2 FAIL: driver object missing';
  END IF;
  IF (v_result->'driver'->>'id') IS DISTINCT FROM 'drv-c207-1' THEN
    RAISE EXCEPTION '211.2 FAIL: driver id mismatch: %', v_result->'driver'->>'id';
  END IF;

  PERFORM set_config('request.jwt.claims', '', true);
  RESET ROLE;

  RAISE NOTICE '211.2 PASS: verify_return simulation OK (ok=true + driver object)';
END $$;

ROLLBACK;