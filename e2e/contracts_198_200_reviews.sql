-- ============================================================
-- Contract 198+199+200 — Reviews (verified rules + moderation + id default)
-- ครอบคลุม:
--   198.1 submit_verified_review — must be delivered + dedupe (order_number, product_id)
--   199.1 reviews table: order_number, branch_id, product_name_display, status, reply, replied_at
--   199.2 reviews UNIQUE INDEX idx_reviews_order_product
--   199.3 RLS: public read approved only + customer read own + customer insert pending only
--   199.4 legacy policies removed (reviews_anon_read, reviews_public_read, reviews_own_update, reviews_own_insert)
--   199.5 get_verified_reviews_batch — only approved + verified
--   199.6 submit_verified_review v2 — status='pending' + product_name_display
--   200.1 reviews.id DEFAULT rev-<ms>-<suffix6>
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin + customer ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

DO $$
DECLARE
  v_cust_uid uuid := '210a1980-0000-4000-8000-000000000001';
  v_cust_id text := 'cust-c198-1';
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_cust_uid,'fixture-c198@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name)
  VALUES (v_cust_id, v_cust_uid, 'Review Customer')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.branches (id, code, slug, name, tenant_id, address_line1, latitude, longitude, kitchen_latitude, kitchen_longitude, status)
  VALUES ('br-c186', 'c186', 'c186', 'Contract 186 Branch', 'tenant-bmb-001', '186 Test Road', 13.0, 100.0, 13.0, 100.0, 'active')
  ON CONFLICT (id) DO NOTHING;

  -- fixture delivered order
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id)
  VALUES ('ord-c198-1', 'BMB-C198-001', v_cust_uid::text, v_cust_uid, 'Review Customer', '0811981981', 'delivered', 'self_delivery', 'paid', 'promptpay_qr', 100, 'SAME_DAY', 'br-c186')
  ON CONFLICT (order_number) DO NOTHING;

  -- fixture product
  INSERT INTO public.products (id, name, price, category_id, is_available, available_same_day, available_preorder)
  VALUES ('prod-c198-1', 'Review Product', 100, 'cat-1', true, true, true),
         ('prod-c198-2', 'Review Product 2', 100, 'cat-1', true, true, true)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Fixture ready for 198-200';
END $$;

-- ---------- 198.1 submit_verified_review — delivered required + dedupe ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1980-0000-4000-8000-000000000001';
  v_result record;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);

  -- success: delivered order
  FOR v_result IN SELECT * FROM public.submit_verified_review('BMB-C198-001', 'prod-c198-1', 5, 'Great!', 'br-c186') LOOP
    IF v_result.review_id IS NULL THEN
      RAISE EXCEPTION '198.1 FAIL: review_id missing';
    END IF;
  END LOOP;

  -- verify review created with is_verified = true
  IF NOT EXISTS (
    SELECT 1 FROM public.reviews WHERE order_number = 'BMB-C198-001' AND product_id = 'prod-c198-1' AND is_verified = true
  ) THEN
    RAISE EXCEPTION '198.1 FAIL: verified review not created';
  END IF;

  -- duplicate: same order + product = ERR_REVIEW_ALREADY_EXISTS
  BEGIN
    FOR v_result IN SELECT * FROM public.submit_verified_review('BMB-C198-001', 'prod-c198-1', 4, 'Good', 'br-c186') LOOP
      RAISE EXCEPTION '198.1 FAIL: duplicate should have raised';
    END LOOP;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%ERR_REVIEW_ALREADY_EXISTS%' THEN
      RAISE EXCEPTION '198.1 FAIL: expected ERR_REVIEW_ALREADY_EXISTS, got: %', SQLERRM;
    END IF;
  END;

  -- not delivered = ERR_REVIEW_ORDER_NOT_DELIVERED
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id)
  VALUES ('ord-c198-2', 'BMB-C198-002', v_cust_uid::text, v_cust_uid, 'Review Customer', '0811981981', 'confirmed', 'self_delivery', 'pending', 'promptpay_qr', 100, 'SAME_DAY', 'br-c186')
  ON CONFLICT (order_number) DO NOTHING;

  BEGIN
    FOR v_result IN SELECT * FROM public.submit_verified_review('BMB-C198-002', 'prod-c198-1', 5, 'Great!', 'br-c186') LOOP
      RAISE EXCEPTION '198.1 FAIL: non-delivered should have raised';
    END LOOP;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%ERR_REVIEW_ORDER_NOT_DELIVERED%' THEN
      RAISE EXCEPTION '198.1 FAIL: expected ERR_REVIEW_ORDER_NOT_DELIVERED, got: %', SQLERRM;
    END IF;
  END;

  RAISE NOTICE '198.1 PASS: submit_verified_review delivered required + dedupe OK';
END $$;

-- ---------- 199.1 reviews table columns ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='order_number') THEN
    RAISE EXCEPTION '199.1 FAIL: order_number column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='branch_id') THEN
    RAISE EXCEPTION '199.1 FAIL: branch_id column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='product_name_display') THEN
    RAISE EXCEPTION '199.1 FAIL: product_name_display column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='status') THEN
    RAISE EXCEPTION '199.1 FAIL: status column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='reply') THEN
    RAISE EXCEPTION '199.1 FAIL: reply column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='replied_at') THEN
    RAISE EXCEPTION '199.1 FAIL: replied_at column missing';
  END IF;

  -- status CHECK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
    WHERE ccu.table_schema='public' AND ccu.table_name='reviews' AND ccu.column_name='status'
      AND cc.check_clause ILIKE '%pending%approved%rejected%'
  ) THEN
    RAISE EXCEPTION '199.1 FAIL: status CHECK missing';
  END IF;

  RAISE NOTICE '199.1 PASS: reviews all moderation columns + CHECK OK';
END $$;

-- ---------- 199.2 UNIQUE INDEX idx_reviews_order_product ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='reviews' AND indexname='idx_reviews_order_product'
  ) THEN
    RAISE EXCEPTION '199.2 FAIL: idx_reviews_order_product missing';
  END IF;

  -- verify partial index WHERE order_number IS NOT NULL
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='reviews' AND indexname='idx_reviews_order_product'
      AND indexdef LIKE '%order_number IS NOT NULL%'
  ) THEN
    RAISE EXCEPTION '199.2 FAIL: index not partial on order_number IS NOT NULL';
  END IF;

  RAISE NOTICE '199.2 PASS: idx_reviews_order_product unique partial index OK';
END $$;

-- ---------- 199.3 RLS policies ----------
DO $$
BEGIN
  -- public_read_approved_reviews
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='reviews' AND policyname='public_read_approved_reviews'
  ) THEN
    RAISE EXCEPTION '199.3 FAIL: public_read_approved_reviews missing';
  END IF;

  -- customers_read_own_reviews
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='reviews' AND policyname='customers_read_own_reviews'
  ) THEN
    RAISE EXCEPTION '199.3 FAIL: customers_read_own_reviews missing';
  END IF;

  -- customers_insert_own_review (pending only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='reviews' AND policyname='customers_insert_own_review'
  ) THEN
    RAISE EXCEPTION '199.3 FAIL: customers_insert_own_review missing';
  END IF;

  RAISE NOTICE '199.3 PASS: moderation RLS policies exist';
END $$;

-- ---------- 199.4 legacy policies removed ----------
DO $$
DECLARE
  v_legacy text;
BEGIN
  FOR v_legacy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='reviews'
      AND policyname IN ('reviews_anon_read', 'reviews_public_read', 'reviews_own_update', 'reviews_own_insert')
  LOOP
    RAISE EXCEPTION '199.4 FAIL: legacy policy % still exists', v_legacy;
  END LOOP;

  RAISE NOTICE '199.4 PASS: legacy policies removed';
END $$;

-- ---------- 199.5 get_verified_reviews_batch — approved only ----------
DO $$
DECLARE
  v_rows record;
  v_count int := 0;
BEGIN
  -- insert test reviews (product ใหม่ + order numbers ต่างกัน เพื่อไม่ชน idx_reviews_order_product)
  INSERT INTO public.reviews (id, product_id, customer_id, customer_name, rating, comment, is_verified, order_number, branch_id, product_name_display, status)
  VALUES
    ('rev-test-1', 'prod-c198-2', 'cust-c198-1', 'Test User', 5, 'Approved', true, 'BMB-C198-R1', 'br-c186', 'Review Product', 'approved'),
    ('rev-test-2', 'prod-c198-2', 'cust-c198-1', 'Test User', 4, 'Pending', true, 'BMB-C198-R2', 'br-c186', 'Review Product', 'pending'),
    ('rev-test-3', 'prod-c198-2', 'cust-c198-1', 'Test User', 3, 'Rejected', true, 'BMB-C198-R3', 'br-c186', 'Review Product', 'rejected'),
    ('rev-test-4', 'prod-c198-2', 'cust-c198-1', 'Test User', 2, 'Not Verified', false, 'BMB-C198-R4', 'br-c186', 'Review Product', 'approved')
  ON CONFLICT (id) DO NOTHING;

  FOR v_rows IN SELECT * FROM public.get_verified_reviews_batch(ARRAY['prod-c198-2'], 10) LOOP
    v_count := v_count + 1;
    IF v_rows.is_verified IS NOT TRUE THEN
      RAISE EXCEPTION '199.5 FAIL: non-verified returned';
    END IF;
    -- status not returned but should be approved only
  END LOOP;

  IF v_count <> 1 THEN
    RAISE EXCEPTION '199.5 FAIL: should return only 1 (approved+verified), got %', v_count;
  END IF;

  RAISE NOTICE '199.5 PASS: get_verified_reviews_batch returns only approved+verified';
END $$;

-- ---------- 199.6 submit_verified_review v2 — pending + product_name_display ----------
DO $$
DECLARE
  v_cust_uid uuid := '210a1980-0000-4000-8000-000000000001';
  v_result record;
  v_review_id text;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_cust_uid::text, 'role', 'authenticated')::text, true);

  -- new order for new review
  INSERT INTO public.orders (id, order_number, customer_id, customer_ref, customer_name, customer_phone, status, delivery_method, payment_status, payment_method, total_amount, order_mode, branch_id)
  VALUES ('ord-c198-3', 'BMB-C198-003', v_cust_uid::text, v_cust_uid, 'Review Customer', '0811981981', 'delivered', 'self_delivery', 'paid', 'promptpay_qr', 100, 'SAME_DAY', 'br-c186')
  ON CONFLICT (order_number) DO NOTHING;

  FOR v_result IN SELECT * FROM public.submit_verified_review('BMB-C198-003', 'prod-c198-1', 5, 'New review', 'br-c186') LOOP
    v_review_id := v_result.review_id;
  END LOOP;

  -- verify status = pending
  IF NOT EXISTS (
    SELECT 1 FROM public.reviews WHERE id = v_review_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION '199.6 FAIL: new review status not pending';
  END IF;

  -- verify product_name_display
  IF NOT EXISTS (
    SELECT 1 FROM public.reviews WHERE id = v_review_id AND product_name_display = 'Review Product'
  ) THEN
    RAISE EXCEPTION '199.6 FAIL: product_name_display not set';
  END IF;

  RAISE NOTICE '199.6 PASS: submit_verified_review v2 pending + product_name_display OK';
END $$;

-- ---------- 200.1 reviews.id DEFAULT rev-<ms>-<suffix6> ----------
DO $$
DECLARE
  v_default text;
BEGIN
  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='reviews' AND column_name='id';

  IF v_default IS NULL THEN
    RAISE EXCEPTION '200.1 FAIL: reviews.id has no DEFAULT';
  END IF;

  IF v_default NOT LIKE '%rev-%' OR v_default NOT LIKE '%md5(%random%' THEN
    RAISE EXCEPTION '200.1 FAIL: DEFAULT format wrong: %', v_default;
  END IF;

  -- verify NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reviews' AND column_name='id' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION '200.1 FAIL: reviews.id should be NOT NULL';
  END IF;

  RAISE NOTICE '200.1 PASS: reviews.id DEFAULT rev-<ms>-<suffix6> OK';
END $$;

ROLLBACK;