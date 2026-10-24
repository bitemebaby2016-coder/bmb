-- ============================================
-- Bite Me Baby — SQL Contract: Migration 142
-- (PRE_ORDER requires a calendar-menu item of that date — R5c)
-- Date: 2026-10-23 · Run on ephemeral PG (apply_all_migrations.sh) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves (Owner contract R5c 2026-10-23):
--   G1  ตะกร้าสินค้าทั่วไปล้วน (ไม่มีเมนูปฏิทิน) สั่งพรีออเดอร์ไม่ได้ = ERR_PRE_ORDER_REQUIRES_MENU
--   G2  สินค้าทั่วไป + เมนูปฏิทินของวันนั้น → created (ออเดอร์เดียว สินค้าทั่วไปติดรอบพรีออเดอร์)
--   G3  เมนูผูกวันอื่น (ไม่มีเมนูของวันที่สั่งเลย) = ERR_PRODUCT_NOT_ON_MENU (§5-C เดิม)
--   G4  วันที่มีเมนูของ "สินค้าอื่น" แต่ตะกร้าไม่มีเมนู = ERR_PRE_ORDER_REQUIRES_MENU (ปิด free-date)
--   G5  SAME_DAY สินค้าทั่วไป = created (gate เดิมไม่เปลี่ยน)
-- ============================================

BEGIN;
RESET ROLE;

-- จำลอง service-role JWT + ผู้ใช้สำหรับ FK (Management API ไม่มี JWT จริง)
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000c14201', 'c142@example.com');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14201","role":"service_role"}', true);

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c142-cat', 'c142-cat', 'c142-cat', '', 0, true);

INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c142-regular', 'c142-regular', '', 10, 'c142-cat', '', true, false, true, false, 0),
  ('c142-menu', 'c142-menu', '', 20, 'c142-cat', '', true, true, true, true, 0);

INSERT INTO public.delivery_rounds
  (id, round_key, display_name, cutoff_time, delivery_start, delivery_end,
   max_capacity, current_count, date, scheduled_date, name, status, created_at, updated_at, branch_id)
VALUES
  ('c142-menu-day', 'midday', 'c142-menu-day', '10:30:00', '11:00:00', '14:00:00',
   50, 0, ((now() at time zone 'Asia/Bangkok')::date + 2), ((now() at time zone 'Asia/Bangkok')::date + 2),
   'midday', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c142-other-day', 'midday', 'c142-other-day', '10:30:00', '11:00:00', '14:00:00',
   50, 0, ((now() at time zone 'Asia/Bangkok')::date + 3), ((now() at time zone 'Asia/Bangkok')::date + 3),
   'midday', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c142-today', 'evening', 'c142-today',
   CASE WHEN extract(hour from (now() at time zone 'Asia/Bangkok')) >= 22
        THEN time '23:59:00'
        ELSE ((now() at time zone 'Asia/Bangkok') + interval '2 hours')::time END,
   '17:00:00', '20:00:00',
   50, 0, (now() at time zone 'Asia/Bangkok')::date, (now() at time zone 'Asia/Bangkok')::date,
   'evening', 'active', now(), now(), 'branch-tenant-bmb-001-main');

-- เมนูปฏิทิน: c142-menu ผูกวัน +2 เท่านั้น (วันอื่นไม่มีเมนูเลย)
INSERT INTO public.menu_schedule (id, scheduled_date, product_id, delivery_round_key, is_published, note) VALUES
  ('c142-ms-menu', ((now() at time zone 'Asia/Bangkok')::date + 2), 'c142-menu', NULL, true, '');

-- G1: ตะกร้าสินค้าทั่วไปล้วน (ไม่มีเมนูปฏิทิน) → ERR_PRE_ORDER_REQUIRES_MENU
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c142-regular","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c142-menu-day',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 2),
      p_customer_name := 'c142', p_customer_phone := '0900000000', p_delivery_address := 'c142-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_PRE_ORDER_REQUIRES_MENU%' THEN
    RAISE EXCEPTION 'G1 FAIL: expected ERR_PRE_ORDER_REQUIRES_MENU, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G1 PASS';
END $$;

-- G2: สินค้าทั่วไป + เมนูปฏิทินของวันนั้น → created (ออเดอร์เดียว)
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c142-regular","quantity":1},{"product_id":"c142-menu","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c142-menu-day',
    p_order_mode := 'PRE_ORDER',
    p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 2),
    p_customer_name := 'c142', p_customer_phone := '0900000000', p_delivery_address := 'c142-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G2 FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G2 PASS';
END $$;

-- G3: เมนูผูกวันอื่น + วันที่สั่งไม่มีเมนูเลย → ERR_PRODUCT_NOT_ON_MENU (§5-C เดิม)
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c142-menu","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c142-other-day',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 2) + 1,
      p_customer_name := 'c142', p_customer_phone := '0900000000', p_delivery_address := 'c142-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_PRODUCT_NOT_ON_MENU%' THEN
    RAISE EXCEPTION 'G3 FAIL: expected ERR_PRODUCT_NOT_ON_MENU, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G3 PASS';
END $$;

-- G4: วันที่มีเมนูของ "สินค้าอื่น" แต่ตะกร้าเป็นสินค้าทั่วไปล้วน → ERR_PRE_ORDER_REQUIRES_MENU
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c142-regular","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c142-menu-day',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 2),
      p_customer_name := 'c142', p_customer_phone := '0900000000', p_delivery_address := 'c142-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_PRE_ORDER_REQUIRES_MENU%' THEN
    RAISE EXCEPTION 'G4 FAIL: expected ERR_PRE_ORDER_REQUIRES_MENU, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G4 PASS';
END $$;

-- G5: SAME_DAY สินค้าทั่วไป → created (gate เดิมไม่เปลี่ยน)
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c142-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c142-today',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c142', p_customer_phone := '0900000000', p_delivery_address := 'c142-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G5 FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G5 PASS';
END $$;

ROLLBACK;