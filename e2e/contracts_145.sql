-- ============================================
-- Bite Me Baby — SQL Contract: Migration 145
-- (คัทออฟ 2 ช่องทางบนรอบเดียว — same_day_cutoff / pre_order_cutoff)
-- Date: 2026-10-24 · Owner approval: "อนุมัติทั้ง schema 2-คัทออฟ + บังคับกฎ >=2"
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves:
--   G1  SAME_DAY ใช้ same_day_cutoff ของรอบ (ไม่ใช่ cutoff_time) — ทั้ง reject + allow
--   G2  PRE_ORDER ใช้ pre_order_cutoff ตั้งตรง (override กฎ cutoff_hours) — ทั้ง reject + allow
--   G3  pre_order_cutoff NULL = กฎเดิม delivery_start - cutoff_hours ยังทำงาน (fallback)
--   G4  shared slot: SAME_DAY + PRE_ORDER ใช้แถวรอบเดียวกัน ความจุก้อนเดียว
--       ไม่นับซ้ำ → รอบเต็มจริง = ERR_CAPACITY_FULL + window ไม่ถูกแตะโดยคัทออฟ
--   G5  >=2 rule: publish 1 รายการ = ERR_MENU_COUNT_INVALID (บังคับ >=2 ตอน publish)
--   G6  >=2 rule บายพาสไม่ได้: authenticated DML ตรง menu_schedule = ถูกปฏิเสธสิทธิ์
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000c14501', 'c145@example.com');
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000c14502', 'c145-admin@example.com');
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000c14502';
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14501","role":"service_role"}', true);

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

-- กฎ fallback คงเดิม: cutoff_hours = 0 (คัทออฟพรีออเดอร์ = เวลาส่งเอง) เหมือน contract 143
UPDATE public.business_settings SET value = jsonb_set(value, '{cutoff_hours}', '0'::jsonb, true) WHERE key = 'order_policy';

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c145-cat', 'c145-cat', 'c145-cat', '', 0, true);

INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c145-regular', 'c145-regular', '', 10, 'c145-cat', '', true, false, true, false, 0),
  ('c145-menu', 'c145-menu', '', 20, 'c145-cat', '', true, true, true, true, 0);

-- วันนี้: เมนู published สำหรับเคสพรีออเดอร์วันนี้ (G2/G4)
INSERT INTO public.menu_schedule (id, scheduled_date, product_id, delivery_round_key, is_published, note) VALUES
  ('c145-ms-today', (now() at time zone 'Asia/Bangkok')::date, 'c145-menu', NULL, true, '');

DO $$
DECLARE
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_n integer; v_ok boolean; v_err text;
  v_win_future boolean; v_cutoff_col time; v_sd_col time;
  v_start_before time; v_end_before time;
BEGIN
  -- ===== รอบ fixture แยกต่อเคส (gates ไม่ชนกัน) =====
  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, same_day_cutoff, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    -- G1a: same_day_cutoff='00:00' (ผ่านแล้ว) แต่ cutoff_time='23:59' (ยังเปิด) → ต้อง REJECT
    ('c145-sd-a', 'midday', 'midday', 'c145-sd-a', '23:59', '00:00', NULL,
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main'),
    -- G1b: same_day_cutoff='23:59' (ยังไม่ถึง) แต่ cutoff_time='00:00' (ผ่านแล้ว) → ต้อง CREATE
    ('c145-sd-b', 'midday', 'midday', 'c145-sd-b', '00:00', '23:59', NULL,
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main');

  -- G1a: เซมเดย์ same_day_cutoff='00:00' (ผ่านไปแล้ว) → ERR_CUTOFF_PASSED
  --       แม้ cutoff_time='23:59' จะยังเปิด — พิสูจน์ว่าคอลัมน์ใหม่คุม (145b)
  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c145-regular","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c145-sd-a',
      p_order_mode := 'SAME_DAY',
      p_customer_name := 'c145', p_customer_phone := '0900000000', p_delivery_address := 'c145-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_CUTOFF_PASSED%' THEN
    RAISE EXCEPTION 'G1a FAIL: expected ERR_CUTOFF_PASSED from same_day_cutoff, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G1a PASS';

  -- G1b: same_day_cutoff='23:59' (ยังไม่ถึง) → created แม้ cutoff_time='00:00' ผ่านแล้ว
  --       + window (delivery_start/end) ต้องไม่ถูกคัทออฟแตะต้อง — เทียบค่าก่อน/หลังสั่ง
  SELECT delivery_start, delivery_end INTO v_start_before, v_end_before
    FROM public.delivery_rounds WHERE id = 'c145-sd-b';
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c145-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c145-sd-b',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c145', p_customer_phone := '0900000000', p_delivery_address := 'c145-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G1b FAIL: expected 1 row, got %', v_n; END IF;
  SELECT delivery_start, delivery_end, cutoff_time, same_day_cutoff
    INTO v_start_before, v_end_before, v_cutoff_col, v_sd_col
    FROM public.delivery_rounds WHERE id = 'c145-sd-b';
  IF v_cutoff_col <> time '00:00' OR v_sd_col <> time '23:59' OR v_start_before IS NULL OR v_end_before IS NULL THEN
    RAISE EXCEPTION 'G1b FAIL: window/cutoff columns must stay intact (cutoff_time=% same_day_cutoff=% start=% end=%)',
      v_cutoff_col, v_sd_col, v_start_before, v_end_before;
  END IF;
  RAISE NOTICE 'G1b PASS (window kept distinct)';

  -- ===== G2: PRE_ORDER override (pre_order_cutoff ของรอบ) =====
  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, same_day_cutoff, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    -- G2a: pre_order_cutoff='00:00' (ผ่านแล้ว) → REJECT แม้กฎ fallback ยังเปิด (delivery_start อนาคต)
    ('c145-po-a', 'evening', 'evening', 'c145-po-a', '23:59', '23:59', '00:00',
     ((now() at time zone 'Asia/Bangkok')::time + interval '5 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '8 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main'),
    -- G2b: pre_order_cutoff='23:59' (ยังไม่ถึง) → created แม้ cutoff_hours=0 (delivery_start ผ่านไปแล้ว)
    ('c145-po-b', 'evening', 'evening', 'c145-po-b', '00:00', '00:00', '23:59',
     ((now() at time zone 'Asia/Bangkok')::time - interval '1 hour'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main');

  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c145-menu","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c145-po-a',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_today,
      p_customer_name := 'c145', p_customer_phone := '0900000000', p_delivery_address := 'c145-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_CUTOFF_PASSED%' THEN
    RAISE EXCEPTION 'G2a FAIL: expected ERR_CUTOFF_PASSED from pre_order_cutoff, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G2a PASS';

  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c145-menu","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c145-po-b',
    p_order_mode := 'PRE_ORDER',
    p_scheduled_date := v_today,
    p_customer_name := 'c145', p_customer_phone := '0900000000', p_delivery_address := 'c145-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G2b FAIL: expected 1 row (override opens despite rule), got %', v_n; END IF;
  RAISE NOTICE 'G2b PASS';

  -- ===== G3: fallback — pre_order_cutoff NULL = กฎเดิม (cutoff_hours=0 → คัทออฟ = delivery_start) =====
  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, same_day_cutoff, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    ('c145-po-c', 'evening', 'evening', 'c145-po-c', '23:59', '23:59', NULL,
     ((now() at time zone 'Asia/Bangkok')::time - interval '1 minute'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main');

  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c145-menu","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c145-po-c',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_today,
      p_customer_name := 'c145', p_customer_phone := '0900000000', p_delivery_address := 'c145-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_CUTOFF_PASSED%' THEN
    RAISE EXCEPTION 'G3 FAIL: fallback rule must still fire, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G3 PASS';

  -- ===== G4: shared slot — SAME_DAY + PRE_ORDER บนแถวรอบเดียวกัน (ความจุก้อนเดียว) =====
  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, same_day_cutoff, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    ('c145-share', 'midday', 'midday', 'c145-share', '00:00', '23:59', '23:59',
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
     2, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main');

  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c145-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c145-share',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c145', p_customer_phone := '0900000000', p_delivery_address := 'c145-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G4 FAIL: same-day leg expected 1 row, got %', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c145-menu","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c145-share',
    p_order_mode := 'PRE_ORDER',
    p_scheduled_date := v_today,
    p_customer_name := 'c145', p_customer_phone := '0900000000', p_delivery_address := 'c145-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G4 FAIL: pre-order leg expected 1 row, got %', v_n; END IF;

  SELECT current_count INTO v_n FROM public.delivery_rounds WHERE id = 'c145-share';
  IF v_n <> 2 THEN RAISE EXCEPTION 'G4 FAIL: shared bucket must be 2 (one row, both modes), got %', v_n; END IF;

  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c145-regular","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c145-share',
      p_order_mode := 'SAME_DAY',
      p_customer_name := 'c145', p_customer_phone := '0900000000', p_delivery_address := 'c145-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_CAPACITY_FULL%' THEN
    RAISE EXCEPTION 'G4 FAIL: expected ERR_CAPACITY_FULL after shared 2/2, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G4 PASS (shared slot, no double-counting)';

  -- ===== G5: >=2 ต่อวันตอน publish (สัญญา 123 / §3-A — publish ต้องครบ 2 เสมอ) =====
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14502","role":"authenticated"}', false);
  PERFORM public.set_menu_schedule(v_today, '[{"product_id":"c145-menu"}]'::jsonb);
  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.publish_menu_schedule(v_today, true);
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_MENU_COUNT_INVALID%' THEN
    RAISE EXCEPTION 'G5 FAIL: expected ERR_MENU_COUNT_INVALID (1 item), got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G5 PASS';

  -- ===== G6: บายพาสไม่ได้ — authenticated (ไม่ใช่ admin) ต้อง "เปลี่ยนแถวเมนูไม่ได้"
  -- ไม่ว่าด่านจะเป็น grant ปฏิเสธ (CI, ไม่มี default-privilege) หรือ RLS กรอง
  -- (production, grant มีแต่ policy ไม่ผ่าน) — invariant จริง = แถวไม่ถูกแตะ =====
  INSERT INTO public.menu_schedule (id, scheduled_date, product_id, delivery_round_key, is_published, note) VALUES
    ('c145-ms-far', v_today + 7, 'c145-menu', NULL, true, '');
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14501","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      UPDATE public.menu_schedule SET is_published = false WHERE scheduled_date = v_today + 7;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- CI: ไม่มี grant ตั้งแต่แรก = ถูกปฏิเสธตรง ๆ
    END;
    RESET ROLE;
  END;
  IF EXISTS (SELECT 1 FROM public.menu_schedule WHERE id = 'c145-ms-far' AND is_published = false) THEN
    RAISE EXCEPTION 'G6 FAIL: authenticated bypassed the >=2 publish gate (row was modified)';
  END IF;
  RAISE NOTICE 'G6 PASS (authenticated cannot unpublish — grant/RLS both hold)';
END $$;
ROLLBACK;