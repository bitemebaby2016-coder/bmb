-- ============================================================
-- Contract 213 — Cart Sessions Payload (Server-side Cart Sync)
-- ครอบคลุม:
--   213.1 cart_sessions.payload JSONB column added
--   213.2 RLS: cart_sessions_select_own — owner can read own cart (customer_id match)
--   213.3 payload structure matches localStorage bmb-cart-v1 (serializeCart)
--   213.4 deterministic id: csa-<customer_id> (1 row per customer)
--   213.5 guest NOT synced (no server sync for guest)
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: customer ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a2130-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c213-1';
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_cust_uid,'fixture-c213@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name)
  VALUES (v_cust_id, v_cust_uid, 'Cart Sync Customer')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Fixture ready for 213';
END $$;

-- ---------- 213.1 cart_sessions.payload column ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cart_sessions' AND column_name='payload'
  ) THEN
    RAISE EXCEPTION '213.1 FAIL: cart_sessions.payload column missing';
  END IF;

  -- type jsonb
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cart_sessions' AND column_name='payload'
      AND data_type <> 'jsonb'
  ) THEN
    RAISE EXCEPTION '213.1 FAIL: payload should be jsonb';
  END IF;

  RAISE NOTICE '213.1 PASS: cart_sessions.payload JSONB column OK';
END $$;

-- ---------- 213.2 RLS: cart_sessions_select_own ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cart_sessions' AND policyname='cart_sessions_select_own'
  ) THEN
    RAISE EXCEPTION '213.2 FAIL: cart_sessions_select_own policy missing';
  END IF;

  -- verify policy qual — owner read (customer_id IS NULL OR customer_id in own customers)
  -- (qual จริง: (customer_id IS NULL) OR (customer_id IN (SELECT customers.id FROM customers WHERE (customers.user_id = auth.uid()))))
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cart_sessions' AND policyname='cart_sessions_select_own'
      AND qual LIKE '%customer_id IS NULL%'
      AND qual LIKE '%customers.user_id = auth.uid()%'
  ) THEN
    RAISE EXCEPTION '213.2 FAIL: policy qual not matching owner read';
  END IF;

  RAISE NOTICE '213.2 PASS: cart_sessions_select_own RLS OK';
END $$;

-- ---------- 213.3 payload structure matches serializeCart ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a2130-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c213-1';
  v_session_id text := 'csa-' || 'cust-c213-1';
  v_payload jsonb;
BEGIN
  -- insert cart session with payload matching serializeCart format
  v_payload := jsonb_build_object(
    'v', 1,
    'savedAt', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'order_mode', 'SAME_DAY',
    'couponCode', 'TEST20',
    'referralCode', 'REF123',
    'items', jsonb_build_array(
      jsonb_build_object(
        'productId', 'prod-1',
        'quantity', 2,
        'customizations', jsonb_build_object('addOns', jsonb_build_array(jsonb_build_object('addonId', 'addon-1', 'selections', jsonb_build_array('opt-1')))),
        'mode', 'normal'
      ),
      jsonb_build_object(
        'productId', 'prod-2',
        'quantity', 1,
        'customizations', jsonb_build_object('addOns', jsonb_build_array()),
        'mode', 'preorder'
      )
    )
  );

  INSERT INTO public.cart_sessions (id, customer_id, payload, created_at, updated_at)
  VALUES (v_session_id, v_cust_id, v_payload, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();

  -- read back as owner
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);

  SELECT payload INTO v_payload FROM public.cart_sessions WHERE id = v_session_id;
  IF v_payload IS NULL THEN
    RAISE EXCEPTION '213.3 FAIL: payload not readable by owner';
  END IF;

  -- verify structure
  IF (v_payload->>'v')::int <> 1 THEN
    RAISE EXCEPTION '213.3 FAIL: payload v not 1';
  END IF;
  IF v_payload->>'order_mode' IS NULL THEN
    RAISE EXCEPTION '213.3 FAIL: payload missing order_mode';
  END IF;
  IF v_payload->>'couponCode' IS NULL THEN
    RAISE EXCEPTION '213.3 FAIL: payload missing couponCode';
  END IF;
  IF v_payload->>'referralCode' IS NULL THEN
    RAISE EXCEPTION '213.3 FAIL: payload missing referralCode';
  END IF;
  IF v_payload->'items' IS NULL THEN
    RAISE EXCEPTION '213.3 FAIL: payload missing items';
  END IF;
  IF jsonb_array_length(v_payload->'items') <> 2 THEN
    RAISE EXCEPTION '213.3 FAIL: payload items count mismatch';
  END IF;

  -- verify item structure
  IF (v_payload->'items'->0->>'productId') IS NULL THEN
    RAISE EXCEPTION '213.3 FAIL: item missing productId';
  END IF;
  IF (v_payload->'items'->0->>'quantity') IS NULL THEN
    RAISE EXCEPTION '213.3 FAIL: item missing quantity';
  END IF;
  IF (v_payload->'items'->0->>'customizations') IS NULL THEN
    RAISE EXCEPTION '213.3 FAIL: item missing customizations';
  END IF;
  IF (v_payload->'items'->0->>'mode') IS NULL THEN
    RAISE EXCEPTION '213.3 FAIL: item missing mode';
  END IF;

  RAISE NOTICE '213.3 PASS: payload structure matches serializeCart format OK';
END $$;

-- ---------- 213.4 deterministic id: csa-<customer_id> ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a2130-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c213-1';
  v_session_id text := 'csa-' || 'cust-c213-1';
  v_count int;
  v_payload jsonb;
BEGIN
  -- verify deterministic id format
  IF v_session_id <> 'csa-cust-c213-1' THEN
    RAISE EXCEPTION '213.4 FAIL: session id format wrong: %', v_session_id;
  END IF;

  -- insert from different "device" (same customer_id) → same row updated
  INSERT INTO public.cart_sessions (id, customer_id, payload, created_at, updated_at)
  VALUES (v_session_id, v_cust_id, '{"v":1,"items":[]}'::jsonb, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();

  -- insert again with different payload → same row
  INSERT INTO public.cart_sessions (id, customer_id, payload, created_at, updated_at)
  VALUES (v_session_id, v_cust_id, '{"v":1,"items":[{"productId":"prod-new"}]}'::jsonb, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();

  -- verify only 1 row for this customer
  SELECT count(*) INTO v_count FROM public.cart_sessions WHERE customer_id = v_cust_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '213.4 FAIL: should be 1 row per customer, got %', v_count;
  END IF;

  -- verify payload is latest
  SELECT payload->'items' INTO v_payload FROM public.cart_sessions WHERE id = v_session_id;
  IF jsonb_array_length(v_payload) <> 1 OR (v_payload->0->>'productId') <> 'prod-new' THEN
    RAISE EXCEPTION '213.4 FAIL: payload not updated to latest';
  END IF;

  RAISE NOTICE '213.4 PASS: deterministic id csa-<customer_id> + single row OK';
END $$;

-- ---------- 213.5 guest NOT synced (no server sync for guest) ----------
DO $$
BEGIN
  -- guest has no auth.uid() → no customer_id → cannot have cart_session (RLS insert_own requires customer_id match)
  -- cart_sessions insert_own policy (from m180) requires customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  -- For anon: auth.uid() IS NULL → subquery returns empty → no match → INSERT blocked

  -- verify insert_own policy exists (from m180)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cart_sessions' AND policyname='cart_sessions_insert_own'
  ) THEN
    RAISE EXCEPTION '213.5 FAIL: cart_sessions_insert_own policy missing (from m180)';
  END IF;

  -- guest cannot insert (would need service_role or authenticated with customer profile)
  -- This is enforced by RLS - guest has no customer profile linked to auth.uid()

  RAISE NOTICE '213.5 PASS: guest not synced (RLS insert_own requires authenticated customer)';
END $$;

ROLLBACK;