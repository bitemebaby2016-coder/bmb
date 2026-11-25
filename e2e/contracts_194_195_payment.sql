-- ============================================================
-- Contract 194+195 — Payment Status Void Enum + Close Payment on Cancel
-- ครอบคลุม:
--   194.1 payment_status enum + 'void' value (or TEXT CHECK includes 'void')
--   195.1 cancel_order — payment_status = 'void' when cancelled + no payment captured
--   195.2 cancel_order — payment_status kept 'pending' when payment evidence exists
--   195.3 cancel_order — payment_status = 'paid' unchanged (refund = admin follow-up)
--   195.4 backfill: cancelled + pending + no evidence → void
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin + customer ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

DO $$
DECLARE
  v_cust_uid uuid := '210a1950-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c195-1';
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_cust_uid,'fixture-c195@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name)
  VALUES (v_cust_id, v_cust_uid, 'Payment Void Customer')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Fixture ready for 194+195';
END $$;

-- ---------- 194.1 payment_status has 'void' ----------
DO $$
DECLARE
  v_has_void boolean;
BEGIN
  -- check enum
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_status' AND e.enumlabel = 'void'
  ) INTO v_has_void;

  IF v_has_void THEN
    RAISE NOTICE '194.1 PASS: payment_status enum has void';
  ELSE
    -- check TEXT + CHECK constraint
    SELECT EXISTS (
      SELECT 1 FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
      WHERE ccu.table_schema='public' AND ccu.table_name='orders' AND ccu.column_name='payment_status'
        AND cc.check_clause ILIKE '%void%'
    ) INTO v_has_void;
    IF v_has_void THEN
      RAISE NOTICE '194.1 PASS: payment_status TEXT CHECK includes void';
    ELSE
      RAISE EXCEPTION '194.1 FAIL: payment_status has no void value';
    END IF;
  END IF;
END $$;

-- ---------- 195.1 cancel_order — void when no payment captured ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1950-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c195-1';
  v_order_number text := 'BMB-C195-001';
  v_order_id text := 'ord-c195-1';
  v_result jsonb;
  v_pay_status text;
BEGIN
  -- fixture branch (FK orders.branch_id)
  INSERT INTO public.branches (id, code, slug, name, tenant_id, address_line1, latitude, longitude, kitchen_latitude, kitchen_longitude, status)
  VALUES ('br-c186', 'c186', 'c186', 'Contract 186 Branch', 'tenant-bmb-001', '186 Test Road', 13.0, 100.0, 13.0, 100.0, 'active')
  ON CONFLICT (id) DO NOTHING;

  -- fixture order (pending payment, no payment_intents)
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id, created_at)
  VALUES (v_order_id, v_order_number, v_cust_id, v_cust_uid, 'C194 Cust', '0811941941', 'pending', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', 'br-c186', NOW() - interval '1 minute')
  ON CONFLICT (order_number) DO NOTHING;

  -- customer cancels
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.cancel_order(v_order_number, 'Customer changed mind');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '195.1 FAIL: cancel_order failed: %', v_result;
  END IF;

  -- verify payment_status = void
  SELECT payment_status INTO v_pay_status FROM public.orders WHERE order_number = v_order_number;
  IF v_pay_status <> 'void' THEN
    RAISE EXCEPTION '195.1 FAIL: payment_status should be void, got %', v_pay_status;
  END IF;

  -- verify audit log
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs WHERE action = 'payment_voided' AND entity_id = v_order_number
  ) THEN
    RAISE EXCEPTION '195.1 FAIL: payment_voided audit log missing';
  END IF;

  RAISE NOTICE '195.1 PASS: cancel_order voids payment when no capture';
END $$;

-- ---------- 195.2 cancel_order — pending kept when payment evidence exists ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1950-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c195-1';
  v_order_number text := 'BMB-C195-002';
  v_order_id text := 'ord-c195-2';
  v_result jsonb;
  v_pay_status text;
BEGIN
  -- fixture order with payment_intent processing
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id, created_at)
  VALUES (v_order_id, v_order_number, v_cust_id, v_cust_uid, 'C194 Cust', '0811941941', 'pending', 'self_delivery', 'pending', 'credit_card', 100, 'SAME_DAY', 'br-c186', NOW() - interval '1 minute')
  ON CONFLICT (order_number) DO NOTHING;

  INSERT INTO public.payment_intents (id, order_number, amount, status, provider, created_at)
  VALUES ('pi-c195-1', v_order_number, 100, 'processing', 'omise', NOW())
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);
  v_result := public.cancel_order(v_order_number, 'Customer changed mind');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '195.2 FAIL: cancel_order failed: %', v_result;
  END IF;

  -- payment_status should remain pending (admin must review)
  SELECT payment_status INTO v_pay_status FROM public.orders WHERE order_number = v_order_number;
  IF v_pay_status <> 'pending' THEN
    RAISE EXCEPTION '195.2 FAIL: payment_status should remain pending with evidence, got %', v_pay_status;
  END IF;

  -- verify note in result
  IF (v_result->>'note') NOT LIKE '%payment evidence exists%' THEN
    RAISE EXCEPTION '195.2 FAIL: note should mention payment evidence: %', v_result->>'note';
  END IF;

  RAISE NOTICE '195.2 PASS: cancel_order keeps pending when payment evidence exists';
END $$;

-- ---------- 195.3 cancel_order — paid unchanged (refund = admin follow-up) ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1950-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c195-1';
  v_order_number text := 'BMB-C195-003';
  v_order_id text := 'ord-c195-3';
  v_result jsonb;
  v_pay_status text;
BEGIN
  -- fixture paid order
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id, created_at)
  VALUES (v_order_id, v_order_number, v_cust_id, v_cust_uid, 'C195 Cust', '0811951951', 'confirmed', 'self_delivery', 'paid', 'promptpay_qr', 100, 'SAME_DAY', 'br-c186', NOW() - interval '10 minutes')
  ON CONFLICT (order_number) DO NOTHING;

  INSERT INTO public.payment_intents (id, order_number, amount, status, provider, created_at)
  VALUES ('pi-c195-2', v_order_number, 100, 'completed', 'omise', NOW())
  ON CONFLICT (id) DO NOTHING;

  -- admin cancels (owner can't cancel non-pending)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  v_result := public.cancel_order(v_order_number, 'Admin cancel');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '195.3 FAIL: admin cancel_order failed: %', v_result;
  END IF;

  -- payment_status should remain paid
  SELECT payment_status INTO v_pay_status FROM public.orders WHERE order_number = v_order_number;
  IF v_pay_status <> 'paid' THEN
    RAISE EXCEPTION '195.3 FAIL: payment_status should remain paid, got %', v_pay_status;
  END IF;

  -- verify note
  IF (v_result->>'note') NOT LIKE '%refund via stripe-refund EF is an admin follow-up%' THEN
    RAISE EXCEPTION '195.3 FAIL: note should mention refund follow-up: %', v_result->>'note';
  END IF;

  RAISE NOTICE '195.3 PASS: cancel_order keeps paid (refund = admin follow-up)';
END $$;

-- ---------- 195.4 backfill: cancelled + pending + no evidence → void ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1950-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c195-1';
  v_order_number text := 'BMB-C195-BACKFILL';
  v_order_id text := 'ord-c195-backfill';
  v_pay_status text;
  r RECORD;
BEGIN
  -- fixture cancelled order with stale pending payment (no payment_intents)
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id)
  VALUES (v_order_id, v_order_number, v_cust_id, v_cust_uid, 'C195 Cust', '0811951951', 'cancelled', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', 'br-c186')
  ON CONFLICT (order_number) DO NOTHING;

  -- run backfill (เหมือน migration 195: UPDATE + audit log 'payment_voided' ต่อรายการ)
  FOR r IN
    SELECT o.order_number FROM public.orders o
     WHERE o.status = 'cancelled'
       AND o.payment_status = 'pending'
       AND NOT EXISTS (
         SELECT 1 FROM public.payment_intents pi
          WHERE pi.order_number = o.order_number
            AND pi.status IN ('processing', 'completed')
       )
  LOOP
    UPDATE public.orders SET payment_status = 'void', updated_at = NOW()
     WHERE order_number = r.order_number;
    PERFORM public.append_audit_log(
      'payment_voided', 'order', r.order_number,
      'backfill 195: cancelled order with stale pending payment closed as void (no capture evidence)',
      jsonb_build_object('payment_status', 'void', 'from', 'pending', 'source', 'migration_195')
    );
  END LOOP;

  -- verify backfilled
  SELECT payment_status INTO v_pay_status FROM public.orders WHERE order_number = v_order_number;
  IF v_pay_status <> 'void' THEN
    RAISE EXCEPTION '195.4 FAIL: backfill should set void, got %', v_pay_status;
  END IF;

  -- verify audit log
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs WHERE action = 'payment_voided' AND entity_id = v_order_number
  ) THEN
    RAISE EXCEPTION '195.4 FAIL: backfill payment_voided audit log missing';
  END IF;

  RAISE NOTICE '195.4 PASS: backfill cancelled+pending+no evidence -> void OK';
END $$;

ROLLBACK;