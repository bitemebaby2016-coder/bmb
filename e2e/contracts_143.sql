-- ============================================
-- Bite Me Baby — SQL Contract: Migration 143
-- (pre-order cutoff = order_policy.cutoff_hours ก่อนส่ง + พรีออเดอร์วันนี้ได้)
-- Date: 2026-10-24 · Run on SQL Editor / Management API
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves (Owner production test 2026-10-24):
--   G1  ตะกร้ารวม (เมนูวันนี้ + สินค้าทั่วไป) PRE_ORDER วันนี้ ก่อนคัทออฟ = created (เคส Owner)
--   G2  หลังคัทออฟ cutoff_hours (ก่อน delivery_start) = ERR_CUTOFF_PASSED (cutoff_time ไม่ช่วย)
--   G3  วันที่สั่ง != วันรอบ = ERR_ROUND_DATE_MISMATCH (เดิม)
--   G4  สินค้าทั่วไปล้วน วันนี้ = ERR_PRE_ORDER_REQUIRES_MENU (gate 142 คงเดิม)
--   G5  เมนู + วันอนาคต = created (gate 142 regression)
--   G6  SAME_DAY หลัง cutoff_time ของรอบ = ต้องสร้างได้ (148: SAME_DAY ไม่มีคัทออฟ)
--   G7  SAME_DAY ก่อน cutoff_time = created (ไม่สน cutoff_hours — เซมเดย์ส่งได้ตลอด)
--   G8  order_setting ค่าพัง = ใช้ default ไม่ crash (order_policy "มี7" ไม่พังอีก)
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000c14301', 'c143@example.com');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14301","role":"service_role"}', true);

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

-- G1 fixture ใช้ cutoff_hours = 0 (คัทออฟ = เวลาส่งเอง) เพื่อทดสอบ "วันนี้ก่อนคัทออฟ" ได้ทุกเวลาที่รัน
UPDATE public.business_settings SET value = jsonb_set(value, '{cutoff_hours}', '0'::jsonb, true) WHERE key = 'order_policy';

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c143-cat', 'c143-cat', 'c143-cat', '', 0, true);

INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c143-regular', 'c143-regular', '', 10, 'c143-cat', '', true, false, true, false, 0),
  ('c143-menu', 'c143-menu', '', 20, 'c143-cat', '', true, true, true, true, 0);

INSERT INTO public.delivery_rounds
  (id, round_key, display_name, cutoff_time, delivery_start, delivery_end,
   max_capacity, current_count, date, scheduled_date, name, status, created_at, updated_at, branch_id)
VALUES
  ('c143-today-eve', 'evening', 'c143-today-eve', '23:59:59', '23:59:59', '23:59:59',
   50, 0, (now() at time zone 'Asia/Bangkok')::date, (now() at time zone 'Asia/Bangkok')::date,
   'evening', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c143-today-soon', 'midday', 'c143-today-soon', '23:59:00',
   ((now() at time zone 'Asia/Bangkok') + interval '1 hour')::time,
   ((now() at time zone 'Asia/Bangkok') + interval '3 hours')::time,
   50, 0, (now() at time zone 'Asia/Bangkok')::date, (now() at time zone 'Asia/Bangkok')::date,
   'midday', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c143-today-cut', 'morning', 'c143-today-cut',
   ((now() at time zone 'Asia/Bangkok') - interval '1 minute')::time,
   ((now() at time zone 'Asia/Bangkok') + interval '2 hours')::time,
   ((now() at time zone 'Asia/Bangkok') + interval '4 hours')::time,
   50, 0, (now() at time zone 'Asia/Bangkok')::date, (now() at time zone 'Asia/Bangkok')::date,
   'morning', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c143-future', 'midday', 'c143-future', '10:30:00', '11:00:00', '14:00:00',
   50, 0, ((now() at time zone 'Asia/Bangkok')::date + 2), ((now() at time zone 'Asia/Bangkok')::date + 2),
   'midday', 'active', now(), now(), 'branch-tenant-bmb-001-main');

INSERT INTO public.menu_schedule (id, scheduled_date, product_id, delivery_round_key, is_published, note) VALUES
  ('c143-ms-today', (now() at time zone 'Asia/Bangkok')::date, 'c143-menu', NULL, true, ''),
  ('c143-ms-future', ((now() at time zone 'Asia/Bangkok')::date + 2), 'c143-menu', NULL, true, '');

-- G1: OWNER SCENARIO — ตะกร้ารวม (เมนูวันนี้ + สินค้าทั่วไป) PRE_ORDER วันนี้ ก่อนคัทออฟ = created
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c143-menu","quantity":1},{"product_id":"c143-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c143-today-eve',
    p_order_mode := 'PRE_ORDER',
    p_scheduled_date := (now() at time zone 'Asia/Bangkok')::date,
    p_customer_name := 'c143', p_customer_phone := '0900000000', p_delivery_address := 'c143-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G1 FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G1 PASS';
END $$;

-- G2: หลังคัทออฟ cutoff_hours (2 ชม. ก่อน delivery_start) = ERR_CUTOFF_PASSED
--     (cutoff_time = 23:59 ไม่ช่วย — คัทออฟ cutoff_hours คุม)
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  UPDATE public.business_settings SET value = jsonb_set(value, '{cutoff_hours}', '2'::jsonb, true) WHERE key = 'order_policy';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c143-menu","quantity":1},{"product_id":"c143-regular","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c143-today-soon',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := (now() at time zone 'Asia/Bangkok')::date,
      p_customer_name := 'c143', p_customer_phone := '0900000000', p_delivery_address := 'c143-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_CUTOFF_PASSED%' THEN
    RAISE EXCEPTION 'G2 FAIL: expected ERR_CUTOFF_PASSED, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G2 PASS';
END $$;

-- G3: วันที่สั่ง != วันรอบ = ERR_ROUND_DATE_MISMATCH (เดิม)
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c143-menu","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c143-today-eve',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 1),
      p_customer_name := 'c143', p_customer_phone := '0900000000', p_delivery_address := 'c143-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_ROUND_DATE_MISMATCH%' THEN
    RAISE EXCEPTION 'G3 FAIL: expected ERR_ROUND_DATE_MISMATCH, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G3 PASS';
END $$;

-- G4: สินค้าทั่วไปล้วน (ไม่มีเมนู) วันนี้ = ERR_PRE_ORDER_REQUIRES_MENU (gate 142 คงเดิม)
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  UPDATE public.business_settings SET value = jsonb_set(value, '{cutoff_hours}', '0'::jsonb, true) WHERE key = 'order_policy';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c143-regular","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c143-today-eve',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := (now() at time zone 'Asia/Bangkok')::date,
      p_customer_name := 'c143', p_customer_phone := '0900000000', p_delivery_address := 'c143-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_PRE_ORDER_REQUIRES_MENU%' THEN
    RAISE EXCEPTION 'G4 FAIL: expected ERR_PRE_ORDER_REQUIRES_MENU, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G4 PASS';
END $$;

-- G5: เมนู + วันอนาคต = created (gate 142 regression — พรีออเดอร์ล่วงหน้ายังใช้ได้)
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c143-menu","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c143-future',
    p_order_mode := 'PRE_ORDER',
    p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 2),
    p_customer_name := 'c143', p_customer_phone := '0900000000', p_delivery_address := 'c143-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G5 FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G5 PASS';
END $$;

-- G6 (148 แก้กฎ Owner 2026-10-24): SAME_DAY หลัง cutoff_time ของรอบ = ต้องสร้างได้
--   (เดิม 143: เคย assert ว่าถูกปฏิเสธด้วย ERR_CUTOFF_PASSED — SAME_DAY ไม่มีคัทออฟแล้ว)
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c143-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c143-today-cut',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c143', p_customer_phone := '0900000000', p_delivery_address := 'c143-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'G6 FAIL: same-day past cutoff_time must be accepted (148 = no same-day cutoff), got % rows', v_n;
  END IF;
  RAISE NOTICE 'G6 PASS (same-day accepted past cutoff_time)';
END $$;

-- G7: SAME_DAY ก่อน cutoff_time = created (ไม่สน cutoff_hours — เซมเดย์ส่งได้ตลอดเหมือนเดิม)
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c143-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c143-today-eve',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c143', p_customer_phone := '0900000000', p_delivery_address := 'c143-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G7 FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G7 PASS';
END $$;

-- G8: order_setting ค่าพัง (ค่าไม่ใช่ตัวเลข) = ใช้ default ไม่ crash
DO $$
DECLARE v numeric;
BEGIN
  UPDATE public.business_settings
     SET value = jsonb_set(value, '{cutoff_hours}', '"xx"'::jsonb, true)
   WHERE key = 'order_policy';
  v := public.order_setting('cutoff_hours', 2);
  IF v IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'G8 FAIL: expected default 2, got %', v;
  END IF;
  RAISE NOTICE 'G8 PASS';
END $$;

ROLLBACK;