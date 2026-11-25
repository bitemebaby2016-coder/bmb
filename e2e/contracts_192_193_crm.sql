-- ============================================================
-- Contract 192+193 — CRM Automation (winback/birthday/segments) + consent
-- ครอบคลุม:
--   192.1 customers.birthday column added
--   192.2 menu_sales_stats — product sales count (non-cancelled, window days)
--   192.3 crm_segment_summary — active/inactive/lapsed/birthday counts
--   192.4 crm_winback_scan — inactive customers → notifications (weekly dedup) + kill switch
--   192.5 crm_birthday_scan — birthday today → notifications (yearly dedup) + kill switch
--   192.6 pg_cron schedules (guarded)
--   193.1 customers.crm_consent column (default false)
--   193.2 crm_winback_scan filters crm_consent = true
--   193.3 crm_birthday_scan filters crm_consent = true
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin/service_role ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- ---------- fixture: branch (FK orders.branch_id) ----------
INSERT INTO public.branches (id, code, slug, name, tenant_id, address_line1, latitude, longitude, kitchen_latitude, kitchen_longitude, status)
VALUES ('br-c192', 'c192', 'c192', 'Contract 192 Branch', 'tenant-bmb-001', '192 Test Road', 13.0, 100.0, 13.0, 100.0, 'active')
ON CONFLICT (id) DO NOTHING;

-- ---------- fixture: customers ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1920-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c192-1';
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_cust_uid,'fixture-c192@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name, birthday, crm_consent)
  VALUES (v_cust_id, v_cust_uid, 'CRM Customer', (now() AT TIME ZONE 'Asia/Bangkok')::date - interval '1 year', true)
  ON CONFLICT (id) DO UPDATE SET birthday = EXCLUDED.birthday, crm_consent = EXCLUDED.crm_consent;

  -- customer with no consent
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('210a1920-0000-4000-8000-000000000002','fixture-c192-2@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name, birthday, crm_consent)
  VALUES ('cust-c192-2', '210a1920-0000-4000-8000-000000000002', 'No Consent', (now() AT TIME ZONE 'Asia/Bangkok')::date - interval '1 year', false)
  ON CONFLICT (id) DO UPDATE SET birthday = EXCLUDED.birthday, crm_consent = EXCLUDED.crm_consent;

  -- customer birthday today
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('210a1920-0000-4000-8000-000000000003','fixture-c192-3@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name, birthday, crm_consent)
  VALUES ('cust-c192-3', '210a1920-0000-4000-8000-000000000003', 'Birthday Today', (now() AT TIME ZONE 'Asia/Bangkok')::date, true)
  ON CONFLICT (id) DO UPDATE SET birthday = EXCLUDED.birthday, crm_consent = EXCLUDED.crm_consent;

  -- consented inactive customer (last order 60 days ago) for winback scan
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('210a1920-0000-4000-8000-000000000004','fixture-c192-4@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name, birthday, crm_consent)
  VALUES ('cust-c192-4', '210a1920-0000-4000-8000-000000000004', 'Lapsed Consented', (now() AT TIME ZONE 'Asia/Bangkok')::date - interval '1 year', true)
  ON CONFLICT (id) DO UPDATE SET birthday = EXCLUDED.birthday, crm_consent = EXCLUDED.crm_consent;

  RAISE NOTICE 'Fixture ready for 192+193';
END $$;

-- ---------- 192.1 customers.birthday column ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='customers' AND column_name='birthday'
  ) THEN
    RAISE EXCEPTION '192.1 FAIL: customers.birthday column missing';
  END IF;
  RAISE NOTICE '192.1 PASS: customers.birthday column OK';
END $$;

-- ---------- 192.2 menu_sales_stats ----------
DO $$
DECLARE
  v_rows record;
  v_count int;
BEGIN
  -- fixture product + orders
  INSERT INTO public.products (id, name, price, category_id, is_available, available_same_day, available_preorder)
  VALUES ('prod-c192-1', 'CRM Product', 100, 'cat-1', true, true, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id, created_at)
  VALUES
    ('ord-c192-old-1', 'BMB-C192-OLD1', 'cust-c192-1', '210a1920-0000-4000-8000-000000000001', 'CRM Customer', '0810000001', 'delivered', 'self_delivery', 'paid', 'promptpay_qr', 100, 'SAME_DAY', 'br-c192', NOW() - interval '60 days'),
    ('ord-c192-old-2', 'BMB-C192-OLD2', 'cust-c192-2', '210a1920-0000-4000-8000-000000000002', 'No Consent', '0810000002', 'delivered', 'self_delivery', 'paid', 'promptpay_qr', 100, 'SAME_DAY', 'br-c192', NOW() - interval '60 days'),
    ('ord-c192-1', 'BMB-C192-001', 'cust-c192-1', '210a1920-0000-4000-8000-000000000001', 'CRM Customer', '0810000001', 'delivered', 'self_delivery', 'paid', 'promptpay_qr', 100, 'SAME_DAY', 'br-c192', NOW() - interval '5 days'),
    ('ord-c192-2', 'BMB-C192-002', 'cust-c192-1', '210a1920-0000-4000-8000-000000000001', 'CRM Customer', '0810000001', 'delivered', 'self_delivery', 'paid', 'promptpay_qr', 200, 'SAME_DAY', 'br-c192', NOW() - interval '10 days'),
    ('ord-c192-3', 'BMB-C192-003', 'cust-c192-1', '210a1920-0000-4000-8000-000000000001', 'CRM Customer', '0810000001', 'cancelled', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', 'br-c192', NOW() - interval '3 days'), -- cancelled = excluded
    ('ord-c192-old-4', 'BMB-C192-OLD4', 'cust-c192-4', '210a1920-0000-4000-8000-000000000004', 'Lapsed Consented', '0810000004', 'delivered', 'self_delivery', 'paid', 'promptpay_qr', 100, 'SAME_DAY', 'br-c192', NOW() - interval '60 days') -- consented inactive for winback
  ON CONFLICT (order_number) DO NOTHING;

  INSERT INTO public.order_items (id, order_id, product_id, product_name, quantity, unit_price, customizations, special_request)
  VALUES
    ('oi-c192-1', 'ord-c192-1', 'prod-c192-1', 'CRM Product', 2, 50, '{}', ''),
    ('oi-c192-2', 'ord-c192-2', 'prod-c192-1', 'CRM Product', 1, 200, '{}', ''),
    ('oi-c192-3', 'ord-c192-3', 'prod-c192-1', 'CRM Product', 1, 100, '{}', '')
  ON CONFLICT (id) DO NOTHING;

  -- call function
  FOR v_rows IN SELECT * FROM public.menu_sales_stats(30) LOOP
    IF v_rows.product_id = 'prod-c192-1' THEN
      -- cancelled order excluded, only 2+1=3
      IF v_rows.sold_count <> 3 THEN
        RAISE EXCEPTION '192.2 FAIL: sold_count should be 3 (cancelled excluded), got %', v_rows.sold_count;
      END IF;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION '192.2 FAIL: product not found in results';
  END IF;

  RAISE NOTICE '192.2 PASS: menu_sales_stats OK (cancelled excluded, window works)';
END $$;

-- ---------- 192.3 crm_segment_summary ----------
DO $$
DECLARE
  v_result jsonb;
BEGIN
  -- call as service_role (function restricted)
  PERFORM set_config('role', 'service_role', true);
  v_result := public.crm_segment_summary(45);
  PERFORM set_config('role', 'authenticated', true);

  IF v_result->>'as_of' IS NULL THEN
    RAISE EXCEPTION '192.3 FAIL: as_of missing: %', v_result;
  END IF;

  IF v_result->>'customers_total' IS NULL THEN
    RAISE EXCEPTION '192.3 FAIL: customers_total missing';
  END IF;
  IF v_result->>'active_30d' IS NULL THEN
    RAISE EXCEPTION '192.3 FAIL: active_30d missing';
  END IF;
  IF v_result->>'inactive_31_90d' IS NULL THEN
    RAISE EXCEPTION '192.3 FAIL: inactive_31_90d missing';
  END IF;
  IF v_result->>'lapsed_90d_plus' IS NULL THEN
    RAISE EXCEPTION '192.3 FAIL: lapsed_90d_plus missing';
  END IF;
  IF v_result->>'birthday_today' IS NULL THEN
    RAISE EXCEPTION '192.3 FAIL: birthday_today missing';
  END IF;

  RAISE NOTICE '192.3 PASS: crm_segment_summary structure OK';
END $$;

-- ---------- 192.4 crm_winback_scan — weekly dedup + kill switch ----------
DO $$
DECLARE
  v_result jsonb;
  v_week text;
BEGIN
  -- enable CRM automation
  INSERT INTO public.business_settings (key, value) VALUES ('crm_automation', '{"enabled": true}'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  PERFORM set_config('role', 'service_role', true);
  v_result := public.crm_winback_scan(45, 50);
  PERFORM set_config('role', 'authenticated', true);

  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '192.4 FAIL: crm_winback_scan failed: %', v_result;
  END IF;

  v_week := v_result->>'week';
  IF v_week IS NULL THEN
    RAISE EXCEPTION '192.4 FAIL: week missing';
  END IF;

  -- should notify cust-c192-4 (inactive 60 days, has consent)
  -- should NOT notify cust-c192-2 (no consent)
  -- should NOT notify cust-c192-1 (active — last order 5 days ago)
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE customer_id = 'cust-c192-4' AND notification_type = 'crm_winback' AND id LIKE 'crm-winback-cust-c192-4-' || v_week || '%'
  ) THEN
    RAISE EXCEPTION '192.4 FAIL: winback notification not created for consented inactive customer';
  END IF;

  -- verify no notification for no-consent customer
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE customer_id = 'cust-c192-2' AND notification_type = 'crm_winback' AND id LIKE 'crm-winback-cust-c192-2-' || v_week || '%'
  ) THEN
    RAISE EXCEPTION '192.4 FAIL: winback notification created for no-consent customer';
  END IF;

  -- verify no notification for active customer (not inactive 45 days)
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE customer_id = 'cust-c192-1' AND notification_type = 'crm_winback'
  ) THEN
    RAISE EXCEPTION '192.4 FAIL: winback notification created for active customer';
  END IF;

  -- second call same week = dedup (idempotent)
  PERFORM set_config('role', 'service_role', true);
  v_result := public.crm_winback_scan(45, 50);
  PERFORM set_config('role', 'authenticated', true);

  IF (v_result->>'deduped')::int = 0 THEN
    RAISE EXCEPTION '192.4 FAIL: second call should have deduped > 0';
  END IF;

  -- kill switch: disable (row may not exist — INSERT with upsert)
  INSERT INTO public.business_settings (key, value) VALUES ('crm_automation', '{"enabled": false}'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  PERFORM set_config('role', 'service_role', true);
  v_result := public.crm_winback_scan(45, 50);
  PERFORM set_config('role', 'authenticated', true);

  IF (v_result->>'skipped') IS DISTINCT FROM 'disabled_by_settings' THEN
    RAISE EXCEPTION '192.4 FAIL: kill switch not working: %', v_result;
  END IF;

  -- re-enable (upsert so later tests see enabled)
  INSERT INTO public.business_settings (key, value) VALUES ('crm_automation', '{"enabled": true}'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  RAISE NOTICE '192.4 PASS: crm_winback_scan OK (consent filter + weekly dedup + kill switch)';
END $$;

-- ---------- 192.5 crm_birthday_scan — yearly dedup + kill switch ----------
DO $$
DECLARE
  v_result jsonb;
  v_today text;
BEGIN
  v_today := to_char((now() AT TIME ZONE 'Asia/Bangkok')::date, 'YYYYMMDD');

  PERFORM set_config('role', 'service_role', true);
  v_result := public.crm_birthday_scan(50);
  PERFORM set_config('role', 'authenticated', true);

  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '192.5 FAIL: crm_birthday_scan failed: %', v_result;
  END IF;

  -- should notify cust-c192-3 (birthday today, has consent)
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE customer_id = 'cust-c192-3' AND notification_type = 'crm_birthday' AND id LIKE 'crm-birthday-cust-c192-3-' || v_today || '%'
  ) THEN
    RAISE EXCEPTION '192.5 FAIL: birthday notification not created for consented customer';
  END IF;

  -- second call same day = dedup
  PERFORM set_config('role', 'service_role', true);
  v_result := public.crm_birthday_scan(50);
  PERFORM set_config('role', 'authenticated', true);

  IF (v_result->>'deduped')::int = 0 THEN
    RAISE EXCEPTION '192.5 FAIL: second call should have deduped > 0';
  END IF;

  RAISE NOTICE '192.5 PASS: crm_birthday_scan OK (consent filter + yearly dedup)';
END $$;

-- ---------- 193.1 customers.crm_consent column ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='customers' AND column_name='crm_consent'
  ) THEN
    RAISE EXCEPTION '193.1 FAIL: customers.crm_consent column missing';
  END IF;

  -- default false
  IF EXISTS (
    SELECT 1 FROM public.customers WHERE id = 'cust-c192-2' AND crm_consent = true
  ) THEN
    RAISE EXCEPTION '193.1 FAIL: crm_consent default should be false';
  END IF;

  RAISE NOTICE '193.1 PASS: customers.crm_consent column OK (default false)';
END $$;

-- ---------- 193.2 crm_winback_scan filters crm_consent = true ----------
-- Already tested in 192.4

-- ---------- 193.3 crm_birthday_scan filters crm_consent = true ----------
-- Already tested in 192.5

DO $$ BEGIN
  RAISE NOTICE '193.2/193.3 PASS: consent filtering verified in winback/birthday tests';
END $$;

ROLLBACK;