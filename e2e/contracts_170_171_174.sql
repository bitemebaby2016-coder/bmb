-- ============================================================
-- Contract 170 + 171 + 174 — product cost fields / my_role RPC /
-- customer rider position privacy
-- ครอบคลุม:
--   170.1 products cost columns NOT NULL DEFAULT 0 + nonneg CHECK
--   170.2 unit_cost = generated (cogs + packaging + other) — บวกต่างกันต้องได้ผลรวมตรง
--   170.3 ค่าติดลบ -> ถูก constraint ปฏิเสธ
--   171.1 my_role() คืนบทบาทจริงจาก profiles.role (ไม่ map เป็น admin)
--   171.2 anon เรียก my_role() ไม่ได้ (GRANT แค่ authenticated)
--   174.1 order_rider_position: NULL สำหรับคนไม่ใช่เจ้าของ/ไม่ล็อกอิน (ไม่ enumerate)
--   174.2 เจ้าของออเดอร์ได้พิกัดไรเดอร์จริง / admin ได้เหมือนกัน
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin role (ยกก่อนตั้ง JWT ใด ๆ — 014 bootstrap path) ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';

-- ---------- 170.1/170.2/170.3 cost fields ----------
DO $$
DECLARE v_prod text; v_cat text; v_unit numeric; v_orig_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products'
      AND column_name IN ('cogs','packaging_cost','other_unit_cost','unit_cost')) THEN
    RAISE EXCEPTION '170.1 FAIL: cost columns missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.products'::regclass AND conname='products_cost_fields_nonneg') THEN
    RAISE EXCEPTION '170.1 FAIL: products_cost_fields_nonneg missing';
  END IF;

  v_cat := 'cat-c170';
  v_prod := 'prod-c170';
  INSERT INTO public.product_categories (id, name, slug) VALUES (v_cat, 'Contract 170', 'contract-170')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.products (id, name, description, price, category_id, cogs, packaging_cost, other_unit_cost)
  VALUES (v_prod, 'Contract 170 Product', '', 100, v_cat, 30.50, 5.00, 2.50);
  SELECT unit_cost INTO v_unit FROM public.products WHERE id = v_prod;
  IF v_unit IS DISTINCT FROM 38.00 THEN
    RAISE EXCEPTION '170.2 FAIL: unit_cost generated = % (expected 38.00)', v_unit;
  END IF;

  BEGIN
    UPDATE public.products SET cogs = -1 WHERE id = v_prod;
    RAISE EXCEPTION '170.3 FAIL: negative cogs accepted';
  EXCEPTION WHEN check_violation THEN
    NULL; -- expected
  END;

  DELETE FROM public.products WHERE id = v_prod;
  DELETE FROM public.product_categories WHERE id = v_cat;
  RAISE NOTICE '170 PASS: cost columns + generated unit_cost + nonneg guard';
END $$;

-- ---------- 171.1/171.2 my_role ----------
DO $$
DECLARE v_role text; v_uid uuid := '210a1700-0000-4000-8000-000000000171';
BEGIN
  -- fixture แยกของ 171 (ไม่แตะ fixture admin หลัก) — ยก role ตอน auth.uid() IS NULL
  -- (bootstrap path ของ guard 014) ก่อนตั้ง JWT ของ fixture นี้เสมอ
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_uid,'fixture-kitchen-171@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET role='kitchen' WHERE id=v_uid;

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  v_role := public.my_role();
  IF v_role IS DISTINCT FROM 'kitchen' THEN
    RAISE EXCEPTION '171.1 FAIL: my_role = % (expected kitchen — real role, not admin)', v_role;
  END IF;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.my_role();
    RESET ROLE;
    RAISE EXCEPTION '171.2 FAIL: anon called my_role';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM NOT LIKE '%permission denied%' AND SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN
      RAISE EXCEPTION '171.2 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '171 PASS: my_role returns real role / anon denied';
END $$;

-- ---------- 174.1/174.2 rider position privacy ----------
DO $$
DECLARE v_out jsonb; v_cust uuid := '210a1680-0000-4000-8000-000000000002';
BEGIN
  -- fixture: driver + assigned order ของลูกค้า v_cust
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id='drv-c174') THEN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
    VALUES (v_cust,'fixture-cust-174@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated'),
           ('210a1680-0000-4000-8000-000000000003','fixture-driver-174@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.drivers (id, name, phone, status, user_id, current_latitude, current_longitude, last_seen_at)
    VALUES ('drv-c174', 'Contract 174 Rider', '0-174-0000001', 'busy',
      '210a1680-0000-4000-8000-000000000003', 13.1, 102.1, NOW())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, customer_ref, status,
      delivery_method, dropoff_detail, subtotal, delivery_fee, total_amount, payment_status)
    VALUES ('ord-c174', 'BMB-C174-POS', 'cust-174', 'Owner 174', '0344444444', v_cust,
      'in_transit', 'self_delivery', 'จุดส่ง 174', 50, 0, 50, 'paid');
    INSERT INTO public.delivery_assignments (id, order_number, driver_id, status)
    VALUES ('da-c174', 'BMB-C174-POS', 'drv-c174', 'in_transit');
  END IF;

  -- 174.1 anon -> NULL / คนอื่น -> NULL (ไม่ enumerate)
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  v_out := public.order_rider_position('BMB-C174-POS');
  IF v_out IS NOT NULL THEN RAISE EXCEPTION '174.1 FAIL: anon got position'; END IF;

  PERFORM set_config('request.jwt.claims',
    '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('99999999-9999-4999-8999-999999999999','fixture-other-174@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  v_out := public.order_rider_position('BMB-C174-POS');
  IF v_out IS NOT NULL THEN RAISE EXCEPTION '174.1 FAIL: non-owner got position'; END IF;

  -- 174.2 เจ้าของ -> พิกัดจริง / admin -> เหมือนกัน
  PERFORM set_config('request.jwt.claims',
    '{"sub":"210a1680-0000-4000-8000-000000000002","role":"authenticated"}', true);
  v_out := public.order_rider_position('BMB-C174-POS');
  IF v_out IS NULL OR (v_out->>'latitude')::numeric IS DISTINCT FROM 13.1 THEN
    RAISE EXCEPTION '174.2 FAIL: owner position wrong %', v_out;
  END IF;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  v_out := public.order_rider_position('BMB-C174-POS');
  IF v_out IS NULL OR (v_out->>'latitude')::numeric IS DISTINCT FROM 13.1 THEN
    RAISE EXCEPTION '174.2 FAIL: admin position wrong %', v_out;
  END IF;
  RAISE NOTICE '174 PASS: privacy guards + owner/admin read OK';
END $$;

ROLLBACK;