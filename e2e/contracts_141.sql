-- ============================================
-- Bite Me Baby — SQL Contract: Migration 141
-- (PRE_ORDER universal products + menu-calendar date binding + archive rows)
-- Date: 2026-10-23 · Run on ephemeral PG (apply_all_migrations.sh) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves (Owner directive 2026-10-23 · G1/G4 reconciled 2026-10-24 to R5c/142):
--   G1  PRE_ORDER สินค้าทั่วไปล้วน (ไม่มีเมนูปฏิทินในตะกร้า) → ERR_PRE_ORDER_REQUIRES_MENU
--       (เดิมคาดว่า created — ถูกยกเลิกโดย Owner R5c/migration 142: "ไม่มีเมนู
--        ปฏิทินในตะกร้า = same-day เท่านั้น"; ยังพิสูจน์ว่าไม่ใช่
--        ERR_PRODUCT_MODE_NOT_ALLOWED — mode-gate ไม่ได้บล็อกสินค้าทั่วไป)
--   G2  mixed cart: สินค้าทั่วไป + เมนูรอบพิเศษ ส่งร่วมรอบเดียวกันในวันเมนู = created
--   G3  เมนูรอบพิเศษสั่งวันอื่นที่ไม่ใช่วันเมนู = ERR_PRODUCT_NOT_ON_MENU (วันถูกกำหนดโดยปฏิทินแอดมิน)
--   G4  สินค้าที่มีเฉพาะเมนู archived (วันผ่านรอบจัดส่ง) → ERR_PRE_ORDER_REQUIRES_MENU
--       (แถวเมนูที่ผ่านรอบแล้วไม่นับ — พรีออเดอร์ต้องมาจากเมนูของวันนั้นจริง)
--   G5  SAME_DAY gate คงเดิม: available_same_day=false = ERR_PRODUCT_MODE_NOT_ALLOWED · control = created
-- ============================================

BEGIN;
RESET ROLE;

-- จำลอง service-role JWT + ผู้ใช้สำหรับ FK (Management API ไม่มี JWT จริง —
-- create_order_with_items ตรวจ auth.uid()/has_service_role() จะ.raise ERR_NOT_AUTHENTICATED)
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000c14101', 'c141@example.com');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14101","role":"service_role"}', true);

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c141-cat', 'c141-cat', 'c141-cat', '', 0, true);

INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c141-regular', 'c141-regular', '', 10, 'c141-cat', '', true, false, true, false, 0),
  ('c141-menu', 'c141-menu', '', 20, 'c141-cat', '', true, true, true, true, 0),
  ('c141-arch', 'c141-arch', '', 30, 'c141-cat', '', true, true, true, true, 0),
  ('c141-sameday-closed', 'c141-sameday-closed', '', 40, 'c141-cat', '', true, true, false, true, 0);

INSERT INTO public.delivery_rounds
  (id, round_key, display_name, cutoff_time, delivery_start, delivery_end,
   max_capacity, current_count, date, scheduled_date, name, status, created_at, updated_at, branch_id)
VALUES
  ('c141-menu-day', 'midday', 'c141-menu-day', '10:30:00', '11:00:00', '14:00:00',
   50, 0, ((now() at time zone 'Asia/Bangkok')::date + 2), ((now() at time zone 'Asia/Bangkok')::date + 2),
   'midday', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c141-other-day', 'midday', 'c141-other-day', '10:30:00', '11:00:00', '14:00:00',
   50, 0, ((now() at time zone 'Asia/Bangkok')::date + 3), ((now() at time zone 'Asia/Bangkok')::date + 3),
   'midday', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c141-today', 'evening', 'c141-today',
   CASE WHEN extract(hour from (now() at time zone 'Asia/Bangkok')) >= 22
        THEN time '23:59:00'
        ELSE ((now() at time zone 'Asia/Bangkok') + interval '2 hours')::time END,
   '17:00:00', '20:00:00',
   50, 0, (now() at time zone 'Asia/Bangkok')::date, (now() at time zone 'Asia/Bangkok')::date,
   'evening', 'active', now(), now(), 'branch-tenant-bmb-001-main');

INSERT INTO public.menu_schedule (id, scheduled_date, product_id, delivery_round_key, is_published, note) VALUES
  ('c141-ms-menu', ((now() at time zone 'Asia/Bangkok')::date + 2), 'c141-menu', NULL, true, ''),
  ('c141-ms-arch', ((now() at time zone 'Asia/Bangkok')::date - 1), 'c141-arch', NULL, true, '');

-- G1 (reconciled 2026-10-24 -> R5c/migration 142): PRE_ORDER สินค้าทั่วไปล้วน
-- เดิมคาดว่า created — ตอนนี้ตาข่ายเมนูปฏิทิน (142) ปฏิเสธก่อนด้วย
-- ERR_PRE_ORDER_REQUIRES_MENU และยังพิสูจน์ต่อว่าสิ่งที่ยิงไม่ใช่
-- ERR_PRODUCT_MODE_NOT_ALLOWED (mode-gate ไม่ได้บล็อกสินค้าทั่วไป — สัญญา 141 C1)
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c141-regular","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c141-menu-day',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 2),
      p_customer_name := 'c141', p_customer_phone := '0900000000', p_delivery_address := 'c141-addr',
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


-- G2: mixed cart (เมนูรอบพิเศษ + สินค้าทั่วไป) ส่งร่วมรอบเดียวกันในวันเมนู → created
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c141-menu","quantity":1},{"product_id":"c141-regular","quantity":2}]'::jsonb,
    p_delivery_round_id := 'c141-menu-day',
    p_order_mode := 'PRE_ORDER',
    p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 2),
    p_customer_name := 'c141', p_customer_phone := '0900000000', p_delivery_address := 'c141-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G2 FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G2 PASS';
END $$;

-- G3: เมนูรอบพิเศษสั่งวันอื่นที่ไม่ใช่วันเมนู → ERR_PRODUCT_NOT_ON_MENU
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c141-menu","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c141-other-day',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 3),
      p_customer_name := 'c141', p_customer_phone := '0900000000', p_delivery_address := 'c141-addr',
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

-- G4 (reconciled 2026-10-24 -> R5c/migration 142): เมนู archived ทั้งหมดของสินค้า
-- (วันผ่านรอบจัดส่ง) ไม่นับเป็นเมนูปฏิทิน — PRE_ORDER ที่ไม่มีเมนูของ "วันที่สั่ง"
-- = ERR_PRE_ORDER_REQUIRES_MENU (เดิมคาดว่า created — ถูกยกเลิกโดยสัญญา R5c;
-- แถว archived ยังไม่ผูกมัด enforce_menu_gate อย่างเดิม แต่ตาข่าย 142 ยิงก่อน)
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c141-arch","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c141-other-day',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 3),
      p_customer_name := 'c141', p_customer_phone := '0900000000', p_delivery_address := 'c141-addr',
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


-- G5a: SAME_DAY + available_same_day=false → ERR_PRODUCT_MODE_NOT_ALLOWED (คงเดิม)
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c141-sameday-closed","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c141-today',
      p_order_mode := 'SAME_DAY',
      p_customer_name := 'c141', p_customer_phone := '0900000000', p_delivery_address := 'c141-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_PRODUCT_MODE_NOT_ALLOWED%' THEN
    RAISE EXCEPTION 'G5a FAIL: expected ERR_PRODUCT_MODE_NOT_ALLOWED, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G5a PASS';
END $$;

-- G5b: SAME_DAY control + สินค้าทั่วไป → created
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c141-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c141-today',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c141', p_customer_phone := '0900000000', p_delivery_address := 'c141-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G5b FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G5b PASS';
END $$;

ROLLBACK;
