-- ============================================
-- Bite Me Baby — SQL Contract: Migration 141
-- (PRE_ORDER universal products + menu-calendar date binding + archive rows)
-- Date: 2026-10-23 · Run on ephemeral PG (apply_all_migrations.sh) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves (Owner directive 2026-10-23):
--   G1  PRE_ORDER รับสินค้าทั่วไป (available_preorder=false) ได้ — ไม่ใช่ ERR_PRODUCT_MODE_NOT_ALLOWED
--   G2  mixed cart: สินค้าทั่วไป + เมนูรอบพิเศษ ส่งร่วมรอบเดียวกันในวันเมนู = created
--   G3  เมนูรอบพิเศษสั่งวันอื่นที่ไม่ใช่วันเมนู = ERR_PRODUCT_NOT_ON_MENU (วันถูกกำหนดโดยปฏิทินแอดมิน)
--   G4  สินค้าที่มีเฉพาะเมนู archived (วันผ่านรอบจัดส่ง) = ไม่ผูกมัด — สั่งวันอื่นได้
--   G5  SAME_DAY gate คงเดิม: available_same_day=false = ERR_PRODUCT_MODE_NOT_ALLOWED · control = created
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":false,"bite_drive_radius_km":10}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

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

-- G1: PRE_ORDER + สินค้าทั่วไป (ไม่มีเมนูผูกวัน) → created
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c141-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c141-menu-day',
    p_order_mode := 'PRE_ORDER',
    p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 2),
    p_customer_name := 'c141', p_customer_phone := '0900000000');
  IF v_n <> 1 THEN RAISE EXCEPTION 'G1 FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G1%20PASS';
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
    p_customer_name := 'c141', p_customer_phone := '0900000000');
  IF v_n <> 1 THEN RAISE EXCEPTION 'G2 FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G2%20PASS';
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
      p_customer_name := 'c141', p_customer_phone := '0900000000');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_PRODUCT_NOT_ON_MENU%' THEN
    RAISE EXCEPTION 'G3 FAIL: expected ERR_PRODUCT_NOT_ON_MENU, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G3%20PASS';
END $$;

-- G4: สินค้าที่มีเฉพาะเมนู archived (วันผ่านรอบจัดส่ง) → ไม่ผูกมัด — สั่งวันอื่นได้
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c141-arch","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c141-other-day',
    p_order_mode := 'PRE_ORDER',
    p_scheduled_date := ((now() at time zone 'Asia/Bangkok')::date + 3),
    p_customer_name := 'c141', p_customer_phone := '0900000000');
  IF v_n <> 1 THEN RAISE EXCEPTION 'G4 FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G4%20PASS';
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
      p_customer_name := 'c141', p_customer_phone := '0900000000');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_PRODUCT_MODE_NOT_ALLOWED%' THEN
    RAISE EXCEPTION 'G5a FAIL: expected ERR_PRODUCT_MODE_NOT_ALLOWED, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G5a%20PASS';
END $$;

-- G5b: SAME_DAY control + สินค้าทั่วไป → created
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c141-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c141-today',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c141', p_customer_phone := '0900000000');
  IF v_n <> 1 THEN RAISE EXCEPTION 'G5b FAIL: expected 1 row, got %', v_n; END IF;
  RAISE NOTICE 'G5b%20PASS';
END $$;

ROLLBACK;
