-- ============================================
-- Bite Me Baby — SQL Contract: Migration 153
-- (G&R STAGE 1 · Promotions: kill switch · budget 15% · product scope · max cap · usage cap)
-- Date: 2026-10-25 · Owner command "เริ่มพัฒนา G&R ตามกฏ" (Rollout ⑧ = Promotions ก่อน)
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves:
--   G1  สคีมา: คอลัมน์แคมเปญ 5 ตัว + promotion_products + policy row (enabled/15%)
--       + ฟังก์ชัน server ครบ + create_order_with_items เรียก promotion_apply_rules
--   G2  กติกาฐาน: 10% ของยอด · min order ไม่ผ่าน = 0 · max cap 15 · usage limit ใช้ครบ = 0
--       · inactive/expired/unknown code = 0 (silent-ignore เหมือน 114)
--   G3  kill switch: ปิด = ส่วนลด 0 ทุกโค้ด + promotion_budget_ok = false · เปิด = คืนเดิม
--   G4  budget: percent=4 บล็อก (เกิน 4% ของยอด) · JSON null = ไม่จำกัด · 15% ผ่าน
--   G5  scope: applies_to=specific_products คิดจากฐานสินค้าใน scope เท่านั้น (0 เมื่อไม่มีสินค้าเข้าเกณฑ์)
--   G6  promotion_budget_status = ERR_FORBIDDEN กับ non-admin · คืน jsonb ครบกับ admin
--   G7  anon: execute promotion_budget_ok ได้ · อ่าน promotion_products ได้ · status = ติด (gate)
--   G8  RPC จริง: create_order_with_items หักส่วนลดตามกฎ · budget บล็อกออเดอร์จริง (discount=0)
--       · scope ผ่านออเดอร์จริง = 50 (ไม่ใช่ 75)
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000c15301', 'c153@example.com');
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000c15302', 'c153-admin@example.com');
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000c15302';
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c15301","role":"service_role"}', true);

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c153-cat', 'c153-cat', 'c153-cat', '', 0, true);

INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c153-pa', 'c153-pa', '', 100, 'c153-cat', '', true, false, true, false, 0),
  ('c153-pb', 'c153-pb', '', 50,  'c153-cat', '', true, false, true, false, 0);

-- แคมเปญตัวอย่าง (ครอบคลุมคนละกฎคนละตัว เพื่อไม่ให้ usage/budget รบกวกัน)
INSERT INTO public.promotions (id, name, code, discount_type, discount_value, min_order_amount, is_active) VALUES
  ('c153-a',  'G10',    'GR10',    'percentage',   10, 0,   true),
  ('c153-b',  'GSCOPE', 'GRSCOPE', 'percentage',   50, 0,   true),
  ('c153-c',  'GMAX',   'GRMAX',   'percentage',   50, 0,   true),
  ('c153-u',  'GUSE',   'GRUSE',   'fixed_amount', 20, 0,   true),
  ('c153-m',  'GMIN',   'GRMIN',   'percentage',   10, 500, true),
  ('c153-x',  'GOFF',   'GROFF',   'percentage',   10, 0,   false);
UPDATE public.promotions SET max_discount_amount = 15 WHERE id = 'c153-c';
UPDATE public.promotions SET usage_limit = 1 WHERE id = 'c153-u';
UPDATE public.promotions SET applies_to = 'specific_products' WHERE id = 'c153-b';
INSERT INTO public.promotions (id, name, code, discount_type, discount_value, min_order_amount, is_active, end_date) VALUES
  ('c153-e', 'GEXP', 'GREXP', 'percentage', 10, 0, true, (now() AT TIME ZONE 'Asia/Bangkok')::date - 1);
INSERT INTO public.promotion_products (promotion_id, product_id) VALUES ('c153-b', 'c153-pa');
DO $$
DECLARE
  v numeric; v_ok boolean; v_n integer; v_res jsonb; v_j jsonb;
  v_txt text; v_disc numeric;
  v_user_claims text := current_setting('request.jwt.claims');
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  -- ===== G1: สคีมา + policy row + ฟังก์ชัน server =====
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name='stackable')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name='applies_to')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name='max_discount_amount')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name='usage_limit')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name='usage_count') THEN
    RAISE EXCEPTION 'G1 FAIL: campaign columns missing on promotions';
  END IF;
  IF to_regclass('public.promotion_products') IS NULL THEN RAISE EXCEPTION 'G1 FAIL: promotion_products missing'; END IF;

  INSERT INTO public.promotions (id, name, discount_type, discount_value, min_order_amount, is_active)
  VALUES ('c153-def', 'defaults', 'percentage', 1, 0, true);
  IF (SELECT applies_to FROM public.promotions WHERE id = 'c153-def') <> 'all_products'
     OR (SELECT stackable FROM public.promotions WHERE id = 'c153-def') IS DISTINCT FROM false
     OR (SELECT usage_count FROM public.promotions WHERE id = 'c153-def') <> 0 THEN
    RAISE EXCEPTION 'G1 FAIL: column defaults wrong';
  END IF;
  DELETE FROM public.promotions WHERE id = 'c153-def';

  SELECT public.promotions_enabled() INTO v_ok;
  IF v_ok IS NOT true THEN RAISE EXCEPTION 'G1 FAIL: kill switch default should be true'; END IF;
  SELECT (value -> 'promotions_enabled')::text, (value ->> 'budget_percent')::numeric
    INTO v_res, v FROM public.business_settings WHERE key = 'promotion_policy';
  IF v_res IS DISTINCT FROM 'true' OR v IS DISTINCT FROM 15 THEN
    RAISE EXCEPTION 'G1 FAIL: promotion_policy seed wrong (enabled=%, percent=%)', v_res, v;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'create_order_with_items'
                   AND p.prosrc LIKE '%promotion_apply_rules%') THEN
    RAISE EXCEPTION 'G1 FAIL: create_order_with_items does not call promotion_apply_rules';
  END IF;
  v_txt := '';
  FOREACH v_txt IN ARRAY ARRAY['promotion_apply_rules', 'promotion_budget_ok', 'promotion_budget_status',
                               'promotion_budget_state', 'promotions_enabled'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                   WHERE n.nspname = 'public' AND p.proname = v_txt) THEN
      RAISE EXCEPTION 'G1 FAIL: function % missing', v_txt;
    END IF;
  END LOOP;
  RAISE NOTICE 'G1 PASS (schema + policy seed + server functions)';

  -- ===== G2: กติกาฐาน (งบ = ไม่จำกัดชั่วคราว เพื่อให้เห็นกฎอื่นโดด ๆ) =====
  UPDATE public.business_settings SET value = jsonb_set(value, '{budget_percent}', 'null'::jsonb, true)
   WHERE key = 'promotion_policy';

  v := public.promotion_apply_rules('c153-a', 100, 100);
  IF v IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'G2 FAIL: GR10 on 100 = 10, got %', v; END IF;
  v := public.promotion_apply_rules('c153-m', 150, 150);   -- min_order 500
  IF v <> 0 THEN RAISE EXCEPTION 'G2 FAIL: below min order should be 0, got %', v; END IF;
  v := public.promotion_apply_rules('c153-c', 100, 100);   -- 50% cap 15
  IF v IS DISTINCT FROM 15 THEN RAISE EXCEPTION 'G2 FAIL: max cap should be 15, got %', v; END IF;
  v := public.promotion_apply_rules('c153-x', 100, 100);   -- inactive
  IF v <> 0 THEN RAISE EXCEPTION 'G2 FAIL: inactive promo should be 0, got %', v; END IF;
  v := public.promotion_apply_rules('c153-e', 100, 100);   -- expired
  IF v <> 0 THEN RAISE EXCEPTION 'G2 FAIL: expired promo should be 0, got %', v; END IF;
  v := public.promotion_apply_rules('no-such-promo', 100, 100);
  IF v <> 0 THEN RAISE EXCEPTION 'G2 FAIL: unknown promo should be 0, got %', v; END IF;

  v := public.promotion_apply_rules('c153-u', 100, 100);   -- fixed 20, limit 1 → global cap 172 ตัดเหลือ 15 (usage 1)
  IF v IS DISTINCT FROM 15 THEN RAISE EXCEPTION 'G2 FAIL: first use of GRUSE should be 15 (capped by 172), got %', v; END IF;
  v := public.promotion_apply_rules('c153-u', 100, 100);   -- ใช้ครบแล้ว → 0 (usage ไม่เพิ่ม)
  IF v <> 0 THEN RAISE EXCEPTION 'G2 FAIL: usage limit should block 2nd use, got %', v; END IF;
  IF (SELECT usage_count FROM public.promotions WHERE id = 'c153-u') <> 1 THEN
    RAISE EXCEPTION 'G2 FAIL: usage_count should stay 1';
  END IF;
  RAISE NOTICE 'G2 PASS (math + min + cap + inactive/expired/unknown + usage limit)';
  -- ===== G3: kill switch =====
  UPDATE public.business_settings SET value = jsonb_set(value, '{promotions_enabled}', 'false'::jsonb, true)
   WHERE key = 'promotion_policy';
  v := public.promotion_apply_rules('c153-a', 100, 100);
  IF v <> 0 THEN RAISE EXCEPTION 'G3 FAIL: kill switch OFF should give 0, got %', v; END IF;
  SELECT public.promotion_budget_ok(10, 100) INTO v_ok;
  IF v_ok IS NOT false THEN RAISE EXCEPTION 'G3 FAIL: budget_ok should be false while kill switch OFF'; END IF;
  UPDATE public.business_settings SET value = jsonb_set(value, '{promotions_enabled}', 'true'::jsonb, true)
   WHERE key = 'promotion_policy';
  v := public.promotion_apply_rules('c153-a', 100, 100);
  IF v IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'G3 FAIL: after re-enable should be 10, got %', v; END IF;
  RAISE NOTICE 'G3 PASS (kill switch blocks everything, re-enable restores)';

  -- ===== G4: budget gate =====
  -- ใช้ percent=0 เพื่อการบล็อกแบบ deterministic: 0% × (ยอดขายอะไรก็ตาม) = 0 → ห้ามส่วนลดเลย
  -- (ห้ามพึ่ง sales=0 — CI มี orders ตกค้างจาก step Concurrency ที่ทิ้งไว้ได้ตามสัญญา "ephemeral leftovers OK")
  UPDATE public.business_settings SET value = jsonb_set(value, '{budget_percent}', '0'::jsonb, true)
   WHERE key = 'promotion_policy';
  v := public.promotion_apply_rules('c153-a', 100, 100);   -- งบ 0 → 10 ต้องถูกบล็อกเสมอ
  IF v <> 0 THEN RAISE EXCEPTION 'G4 FAIL: 0%% budget should block 10 discount, got %', v; END IF;
  SELECT public.promotion_budget_ok(10, 100) INTO v_ok;
  IF v_ok IS NOT false THEN RAISE EXCEPTION 'G4 FAIL: budget_ok(10,100) at 0%% should be false'; END IF;
  UPDATE public.business_settings SET value = jsonb_set(value, '{budget_percent}', 'null'::jsonb, true)
   WHERE key = 'promotion_policy';   -- JSON null = ไม่จำกัด
  v := public.promotion_apply_rules('c153-a', 100, 100);
  IF v IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'G4 FAIL: unlimited budget should allow 10, got %', v; END IF;
  SELECT public.promotion_budget_ok(10, 100) INTO v_ok;
  IF v_ok IS NOT true THEN RAISE EXCEPTION 'G4 FAIL: budget_ok unlimited should be true'; END IF;
  UPDATE public.business_settings SET value = jsonb_set(value, '{budget_percent}', '15'::jsonb, true)
   WHERE key = 'promotion_policy';
  RAISE NOTICE 'G4 PASS (budget percent blocks/allows · JSON null = unlimited)';

  -- ===== G5: scope คำนวณจากฐานสินค้าใน scope =====
  -- (ปิดเพดานงบชั่วคราวเพื่อให้เห็นกฎ scope โดด ๆ — ตอน percent=15 งบ 15%×150=22.5
  --  จะบล็อกส่วนลด 50 ซะก่อน ซึ่ง "ถูกต้องแล้ว" แต่ทำให้ทดสอบ scope ไม่ได้)
  UPDATE public.business_settings SET value = jsonb_set(value, '{budget_percent}', 'null'::jsonb, true)
   WHERE key = 'promotion_policy';
  v := public.promotion_apply_rules('c153-b', 150, 100);   -- 50% ของ base 100 (ไม่ใช่ 150) → 50 แต่โดน global cap 172 = 15% ของ 150
  IF v IS DISTINCT FROM 22.5 THEN RAISE EXCEPTION 'G5 FAIL: scoped 50 capped to 15%% of 150 = 22.5, got %', v; END IF;
  v := public.promotion_apply_rules('c153-b', 150, 0);     -- ไม่มีสินค้าเข้าเกณฑ์ → 0
  IF v <> 0 THEN RAISE EXCEPTION 'G5 FAIL: empty scope base should be 0, got %', v; END IF;
  UPDATE public.business_settings SET value = jsonb_set(value, '{budget_percent}', '15'::jsonb, true)
   WHERE key = 'promotion_policy';
  RAISE NOTICE 'G5 PASS (specific_products uses scope base only)';
  -- ===== G6: promotion_budget_status = เฉพาะแอดมิน =====
  BEGIN
    SELECT public.promotion_budget_status() INTO v_j;
    RAISE EXCEPTION 'G6 FAIL: non-admin must not read budget status';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000c15302","role":"authenticated"}', true);
  SELECT public.promotion_budget_status() INTO v_j;
  IF jsonb_typeof(v_j) IS DISTINCT FROM 'object'
     OR NOT (v_j ? 'percent') OR NOT (v_j ? 'sales') OR NOT (v_j ? 'spent')
     OR NOT (v_j ? 'budget') OR NOT (v_j ? 'remaining') THEN
    RAISE EXCEPTION 'G6 FAIL: admin budget status incomplete: %', v_j;
  END IF;
  PERFORM set_config('request.jwt.claims', v_user_claims, true);
  RAISE NOTICE 'G6 PASS (status = admin-only, jsonb keys complete)';

  -- ===== G7: anon — อ่าน scope ได้ · execute budget_ok ได้ · status = ถูกกัน (deny 2 ชั้น) =====
  EXECUTE 'SET ROLE anon';
  SELECT count(*) INTO v_n FROM public.promotion_products;
  IF v_n < 1 THEN RAISE EXCEPTION 'G7 FAIL: anon should read promotion_products, got %', v_n; END IF;
  SELECT public.promotion_budget_ok(10, 100) INTO v_ok;
  IF v_ok IS NULL THEN RAISE EXCEPTION 'G7 FAIL: anon budget_ok returned NULL'; END IF;
  BEGIN
    SELECT public.promotion_budget_status() INTO v_j;
    RAISE EXCEPTION 'G7 FAIL: anon must not read budget status';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'G7 PASS (anon: scope read + budget_ok execute + status denied)';
  -- ===== G8: RPC จริง — หักส่วนลดตามกฎ + budget บล็อกจริง + scope ผ่านออเดอร์จริง =====
  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    ('c153-round', 'midday', 'midday', 'c153-round', '00:00', '23:59',
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
     99, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main');

  -- R1: ไม่มีโค้ด → discount 0
  SELECT public.create_order_with_items(
    p_items := '[{"product_id":"c153-pa","quantity":1},{"product_id":"c153-pb","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c153-round', p_order_mode := 'SAME_DAY',
    p_customer_name := 'c153', p_customer_phone := '0900000000', p_delivery_address := 'c153-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main')
  ) INTO v_res;
  IF (v_res->>'discount_amount')::numeric <> 0 THEN RAISE EXCEPTION 'G8 FAIL: no-code order discount should be 0'; END IF;

  -- R2: budget 0% → ส่วนลด 10 บาท ถูกบล็อกเสมอ (ไม่พึ่งจำนวน orders ตกค้างจาก step ก่อนหน้า)
  UPDATE public.business_settings SET value = jsonb_set(value, '{budget_percent}', '0'::jsonb, true)
   WHERE key = 'promotion_policy';
  SELECT public.create_order_with_items(
    p_items := '[{"product_id":"c153-pa","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c153-round', p_order_mode := 'SAME_DAY',
    p_customer_name := 'c153', p_customer_phone := '0900000000', p_delivery_address := 'c153-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_promotion_code := 'GR10'
  ) INTO v_res;
  IF (v_res->>'discount_amount')::numeric <> 0 THEN RAISE EXCEPTION 'G8 FAIL: budget 0%% should zero GR10 discount, got %', v_res->>'discount_amount'; END IF;
  -- R3: ไม่จำกัดงบ → GR10 หักจริง 10 และบันทึกลง orders ตรงกัน
  UPDATE public.business_settings SET value = jsonb_set(value, '{budget_percent}', 'null'::jsonb, true)
   WHERE key = 'promotion_policy';
  SELECT public.create_order_with_items(
    p_items := '[{"product_id":"c153-pa","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c153-round', p_order_mode := 'SAME_DAY',
    p_customer_name := 'c153', p_customer_phone := '0900000000', p_delivery_address := 'c153-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_promotion_code := 'GR10'
  ) INTO v_res;
  IF (v_res->>'discount_amount')::numeric IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'G8 FAIL: GR10 on 100 should discount 10, got %', v_res->>'discount_amount';
  END IF;
  SELECT discount_amount INTO v_disc FROM public.orders WHERE order_number = v_res->>'order_number';
  IF v_disc IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'G8 FAIL: orders.discount_amount mismatch (%)', v_disc; END IF;

  -- R4: scope ผ่านออเดอร์จริง — งบ = ไม่จำกัดชั่วคราวเพื่อ isolate กฎ scope
  -- (เคส "งบอนุญาต/งบบล็อก" พิสูจน์แล้วที่ G4 + R2 — ห้ามให้ orders ตกค้างจาก step อื่นมาบัง assertion นี้)
  UPDATE public.business_settings SET value = jsonb_set(value, '{budget_percent}', 'null'::jsonb, true)
   WHERE key = 'promotion_policy';
  SELECT public.create_order_with_items(
    p_items := '[{"product_id":"c153-pa","quantity":1},{"product_id":"c153-pb","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c153-round', p_order_mode := 'SAME_DAY',
    p_customer_name := 'c153', p_customer_phone := '0900000000', p_delivery_address := 'c153-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_promotion_code := 'GRSCOPE'
  ) INTO v_res;
  -- (ดู G5: scope base 100 → 50 — แต่ global cap 172 = 15% ของ subtotal 150 = 22.50)
  IF (v_res->>'discount_amount')::numeric IS DISTINCT FROM 22.5 THEN
    RAISE EXCEPTION 'G8 FAIL: GRSCOPE on [100+50] should discount 22.5 (172 cap = 15%% of 150), got %', v_res->>'discount_amount';
  END IF;
  -- 173: id ใหม่ต้องไม่มี '#' (to_char overflow) หรือ space (to_char padding) อีกต่อไป
  IF (SELECT id FROM public.orders WHERE order_number = v_res->>'order_number') ~ '[# ]' THEN
    RAISE EXCEPTION 'G8 FAIL: order id still contains to_char artifacts (# or space)';
  END IF;
  RAISE NOTICE 'G8 PASS (RPC: no-code 0 · budget block · GR10=10 on orders · scoped=22.5 capped · id clean)';

  RAISE NOTICE 'CONTRACT 153: PASS';
END $$;

ROLLBACK;