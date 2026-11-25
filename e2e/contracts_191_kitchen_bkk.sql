-- ============================================================
-- Contract 191 — Kitchen BKK Date (create_production_batch + kitchen_queue + get_kitchen_summary)
-- ครอบคลุม:
--   191.1 create_production_batch — p_scheduled_date default (now() AT TIME ZONE 'Asia/Bangkok')::date
--   191.2 kitchen_queue — p_scheduled_date default (now() AT TIME ZONE 'Asia/Bangkok')::date
--   191.3 get_kitchen_summary — p_date default (now() AT TIME ZONE 'Asia/Bangkok')::date
--   191.4 table defaults: delivery_rounds.scheduled_date + production_batches.scheduled_date = BKK date
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin/kitchen role ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- ---------- fixture: round + orders ----------
DO $$
DECLARE
  v_round_id text := 'round-c191-1';
  v_round_id2 text := 'round-c191-2';
BEGIN
  INSERT INTO public.branches (id, code, slug, name, tenant_id, address_line1, latitude, longitude, kitchen_latitude, kitchen_longitude, status)
  VALUES ('br-c191', 'c191', 'c191', 'Contract 191 Branch', 'tenant-bmb-001', '191 Test Road', 13.0, 100.0, 13.0, 100.0, 'active')
  ON CONFLICT (id) DO NOTHING;

  -- today BKK
  INSERT INTO public.delivery_rounds (id, branch_id, tenant_id, name, display_name, scheduled_date, cutoff_time, delivery_start, delivery_end, status, max_capacity, current_count)
  VALUES (v_round_id, 'br-c191', 'tenant-bmb-001', 'Today Round', 'Today Round', (now() AT TIME ZONE 'Asia/Bangkok')::date, '22:00', '10:00', '12:00', 'active', 50, 0)
  ON CONFLICT (id) DO UPDATE SET scheduled_date = EXCLUDED.scheduled_date, status = EXCLUDED.status;

  -- tomorrow BKK
  INSERT INTO public.delivery_rounds (id, branch_id, tenant_id, name, display_name, scheduled_date, cutoff_time, delivery_start, delivery_end, status, max_capacity, current_count)
  VALUES (v_round_id2, 'br-c191', 'tenant-bmb-001', 'Tomorrow Round', 'Tomorrow Round', (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, '22:00', '10:00', '12:00', 'active', 50, 0)
  ON CONFLICT (id) DO UPDATE SET scheduled_date = EXCLUDED.scheduled_date, status = EXCLUDED.status;

  -- fixture customer (FK orders.customer_ref -> auth.users)
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('210a1910-0000-4000-8000-000000000001','fixture-c191@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- fixture orders for today
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, delivery_round_id, branch_id, scheduled_date)
  VALUES
    ('ord-c191-1', 'BMB-C191-001', 'cust-c191', '210a1910-0000-4000-8000-000000000001', 'C191 Cust', '0811911911', 'confirmed', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', v_round_id, 'br-c191', (now() AT TIME ZONE 'Asia/Bangkok')::date),
    ('ord-c191-2', 'BMB-C191-002', 'cust-c191', '210a1910-0000-4000-8000-000000000001', 'C191 Cust', '0811911911', 'preparing', 'self_delivery', 'pending', 'promptpay_qr', 200, 'SAME_DAY', v_round_id, 'br-c191', (now() AT TIME ZONE 'Asia/Bangkok')::date)
  ON CONFLICT (order_number) DO NOTHING;

  -- fixture products (FK order_items.product_id)
  INSERT INTO public.products (id, name, price, category_id, is_available, available_same_day, available_preorder)
  VALUES
    ('prod-c191-1', 'Product A', 50, 'cat-1', true, true, true),
    ('prod-c191-2', 'Product B', 200, 'cat-1', true, true, true)
  ON CONFLICT (id) DO NOTHING;

  -- fixture order items
  INSERT INTO public.order_items (id, order_id, product_id, product_name, quantity, unit_price, customizations, special_request)
  VALUES
    ('oi-c191-1', 'ord-c191-1', 'prod-c191-1', 'Product A', 2, 50, '{}', ''),
    ('oi-c191-2', 'ord-c191-2', 'prod-c191-2', 'Product B', 1, 200, '{}', '')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Fixture ready for 191';
END $$;

-- ---------- 191.1 create_production_batch default BKK date ----------
DO $$
DECLARE
  v_result jsonb;
  v_batch_id text;
BEGIN
  -- call without p_scheduled_date (should use BKK today — ต้องไม่ส่งพารามิเตอร์จึงจะ trigger DEFAULT)
  v_result := public.create_production_batch('round-c191-1');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '191.1 FAIL: create_production_batch failed: %', v_result;
  END IF;
  v_batch_id := v_result->>'batch_id';

  -- verify batch scheduled_date = today BKK
  IF NOT EXISTS (
    SELECT 1 FROM public.production_batches
    WHERE id = v_batch_id AND scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date
  ) THEN
    RAISE EXCEPTION '191.1 FAIL: batch scheduled_date not today BKK';
  END IF;

  -- verify items created
  IF NOT EXISTS (
    SELECT 1 FROM public.production_batch_items WHERE batch_id = v_batch_id
  ) THEN
    RAISE EXCEPTION '191.1 FAIL: batch items not created';
  END IF;

  -- explicit date should work
  v_result := public.create_production_batch('round-c191-2', (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, 'SAME_DAY');
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '191.1 FAIL: create_production_batch explicit date failed: %', v_result;
  END IF;

  RAISE NOTICE '191.1 PASS: create_production_batch default BKK date OK';
END $$;

-- ---------- 191.2 kitchen_queue default BKK date ----------
DO $$
DECLARE
  v_result jsonb;
  v_batches jsonb;
BEGIN
  -- call without p_scheduled_date (should use BKK today)
  v_result := public.kitchen_queue('round-c191-1', NULL);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '191.2 FAIL: kitchen_queue failed: %', v_result;
  END IF;

  v_batches := v_result->'batches';
  IF jsonb_array_length(v_batches) = 0 THEN
    RAISE EXCEPTION '191.2 FAIL: no batches returned for today';
  END IF;

  -- verify batch scheduled_date = today BKK
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_batches) b
    WHERE (b->>'scheduled_date')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date
  ) THEN
    RAISE EXCEPTION '191.2 FAIL: returned batch not today BKK';
  END IF;

  -- call with explicit date
  v_result := public.kitchen_queue('round-c191-2', (now() AT TIME ZONE 'Asia/Bangkok')::date + 1);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '191.2 FAIL: kitchen_queue explicit date failed: %', v_result;
  END IF;

  RAISE NOTICE '191.2 PASS: kitchen_queue default BKK date OK';
END $$;

-- ---------- 191.3 get_kitchen_summary default BKK date ----------
DO $$
DECLARE
  v_result jsonb;
BEGIN
  -- call without p_date (should use BKK today)
  -- ต้องไม่ส่งพารามิเตอร์จึงจะ trigger DEFAULT (ส่ง NULL = WHERE scheduled_date = NULL ไม่มีผลลัพธ์)
  v_result := public.get_kitchen_summary();
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '191.3 FAIL: get_kitchen_summary failed: %', v_result;
  END IF;

  -- verify date = today BKK
  IF (v_result->>'date')::date <> (now() AT TIME ZONE 'Asia/Bangkok')::date THEN
    RAISE EXCEPTION '191.3 FAIL: summary date not today BKK: %', v_result->>'date';
  END IF;

  -- verify structure
  IF (v_result->>'total_batches') IS NULL THEN
    RAISE EXCEPTION '191.3 FAIL: total_batches missing';
  END IF;
  IF (v_result->'batches') IS NULL THEN
    RAISE EXCEPTION '191.3 FAIL: batches missing';
  END IF;
  IF (v_result->'summary'->>'pending_orders') IS NULL THEN
    RAISE EXCEPTION '191.3 FAIL: summary.pending_orders missing';
  END IF;

  -- explicit date
  v_result := public.get_kitchen_summary((now() AT TIME ZONE 'Asia/Bangkok')::date + 1);
  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '191.3 FAIL: get_kitchen_summary explicit date failed: %', v_result;
  END IF;
  IF (v_result->>'date')::date <> (now() AT TIME ZONE 'Asia/Bangkok')::date + 1 THEN
    RAISE EXCEPTION '191.3 FAIL: explicit date not tomorrow: %', v_result->>'date';
  END IF;

  RAISE NOTICE '191.3 PASS: get_kitchen_summary default BKK date OK';
END $$;

-- ---------- 191.4 table defaults BKK date ----------
DO $$
DECLARE
  v_round_def text;
  v_batch_def text;
BEGIN
  -- delivery_rounds.scheduled_date default
  SELECT column_default INTO v_round_def
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='delivery_rounds' AND column_name='scheduled_date';
  IF v_round_def IS NULL OR v_round_def NOT LIKE '%Asia/Bangkok%' THEN
    RAISE EXCEPTION '191.4 FAIL: delivery_rounds.scheduled_date default not BKK: %', v_round_def;
  END IF;

  -- production_batches.scheduled_date default
  SELECT column_default INTO v_batch_def
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='production_batches' AND column_name='scheduled_date';
  IF v_batch_def IS NULL OR v_batch_def NOT LIKE '%Asia/Bangkok%' THEN
    RAISE EXCEPTION '191.4 FAIL: production_batches.scheduled_date default not BKK: %', v_batch_def;
  END IF;

  RAISE NOTICE '191.4 PASS: table defaults BKK date OK';
END $$;

ROLLBACK;