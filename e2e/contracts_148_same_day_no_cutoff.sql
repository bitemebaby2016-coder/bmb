-- ============================================
-- Bite Me Baby — SQL Contract: Migration 148
-- (SAME_DAY = เปิด–ปิดไม่มีคัทออฟ · ถอด same_day_cutoff)
-- Date: 2026-10-24 · Owner directive (ปิดเซสชันรอบ 13):
--   "รอบจัดส่งเซมเดย์ต้องวิ่งปกติตั้งแต่ร้านเปิด–ปิด ไม่มี cutoff ใด ๆ"
--   "คัทออฟมีเฉพาะ PRE_ORDER เท่านั้น" — same_day_cutoff (145) = ถูกถอด
-- ONE transaction, ROLLBACK at the end — zero persisted data.
-- แทนที่ e2e/contracts_145.sql (สองคัทออฟ) ที่ถูกรื้อตามคำสั่งเดียวกัน
--
-- Proves:
--   G1  คอลัมน์ same_day_cutoff หายจาก schema + คีย์เดียวกันหายจาก order_pattern
--       + ผลลัพธ์ ensure_rounds_for_date ไม่มีคีย์นี้แล้ว
--   G2  SAME_DAY สั่งได้จริงแม้ cutoff_time ของรอบผ่านไปแล้ว (ไม่มี ERR_CUTOFF_PASSED)
--       + ด่านวันที่/สถานะ/ความจุ ยังคงอยู่ (รอบเมื่อวาน + รอบปิด + รอบเต็ม ยังถูกปฏิเสธ)
--   G3  auto_close ไม่ปิดรอบวันนี้ด้วย cutoff — ปิดเฉพาะรอบวันที่ผ่านไปแล้ว
--   G4  PRE_ORDER override (pre_order_cutoff ตั้งตรง) ยัง reject/allow ได้เหมือนเดิม
--   G5  PRE_ORDER fallback (delivery_start − cutoff_hours) ยังทำงานเมื่อไม่ตั้ง override
--   G6  shared slot: SAME_DAY + PRE_ORDER ใช้แถวรอบเดียวกัน ความจุก้อนเดียว
--   (G5/G6 เดิมของ 145 = >=2 publish ยังคุ้มครองโดย contracts_123 P1/P2 — ไม่ทำซ้ำ)
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000c14801', 'c148@example.com');
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000c14802', 'c148-admin@example.com');
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000c14802';
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14801","role":"service_role"}', true);

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

-- กฎ fallback คงเดิม: cutoff_hours = 0 (คัทออฟพรีออเดอร์ = เวลาส่งเอง) เหมือน contract 145
UPDATE public.business_settings SET value = jsonb_set(value, '{cutoff_hours}', '0'::jsonb, true) WHERE key = 'order_policy';

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c148-cat', 'c148-cat', 'c148-cat', '', 0, true);

INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c148-regular', 'c148-regular', '', 10, 'c148-cat', '', true, false, true, false, 0),
  ('c148-menu', 'c148-menu', '', 20, 'c148-cat', '', true, true, true, true, 0);

-- วันนี้: เมนู published สำหรับเคสพรีออเดอร์วันนี้ (G4/G5/G6)
INSERT INTO public.menu_schedule (id, scheduled_date, product_id, delivery_round_key, is_published, note) VALUES
  ('c148-ms-today', (now() at time zone 'Asia/Bangkok')::date, 'c148-menu', NULL, true, '');

DO $$
DECLARE
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_yesterday date := (now() at time zone 'Asia/Bangkok')::date - 1;
  v_n integer; v_ok boolean; v_err text; v_status text; v_sd_keys integer;
  v_res jsonb; v_round_id text;
BEGIN
  -- ===== G1: คอลัมน์/คีย์ same_day_cutoff ต้องหายไปหมด =====
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'delivery_rounds' AND column_name = 'same_day_cutoff'
  ) THEN
    RAISE EXCEPTION 'G1 FAIL: column delivery_rounds.same_day_cutoff still exists';
  END IF;

  SELECT count(*) INTO v_sd_keys
    FROM public.business_settings bs,
         jsonb_array_elements(bs.value->'rounds') AS r(elem)
   WHERE bs.key = 'order_pattern' AND r.elem ? 'same_day_cutoff';
  IF v_sd_keys <> 0 THEN
    RAISE EXCEPTION 'G1 FAIL: order_pattern still has % same_day_cutoff key(s)', v_sd_keys;
  END IF;

  v_res := public.ensure_rounds_for_date(v_today);
  IF (v_res->>'ok') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'G1 FAIL: ensure_rounds_for_date returned ok=false (%)', v_res;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_res->'rounds') AS r(elem)
     WHERE r.elem ? 'same_day_cutoff'
  ) THEN
    RAISE EXCEPTION 'G1 FAIL: ensure_rounds_for_date still returns same_day_cutoff key';
  END IF;
  -- จำนวนรอบวันนี้ขึ้นกับข้อมูล (บางวันแอดมินปิดรอบไว้ = 0 แถว active) — ไม่ใช่เงื่อนไขของ 148
  RAISE NOTICE 'G1 PASS (column + pattern key + ensure output all clean, % round(s) active today)',
    jsonb_array_length(v_res->'rounds');

  -- ===== G2: SAME_DAY = ไม่มีคัทออฟ (ต่อให้ cutoff_time ของรอบผ่านไปแล้วก็สั่งได้) =====
  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    -- cutoff_time '00:00' = "เลยคัทออฟแล้ว" ตามกฎเดิม 025/145 — 148 ต้องไม่มีผลกับเซมเดย์อีก
    ('c148-sd-a', 'midday', 'midday', 'c148-sd-a', '00:00', NULL,
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main'),
    -- รอบเมื่อวาน (active แต่คนละวัน) — ด่านวันที่ต้องยังกันอยู่
    ('c148-sd-old', 'midday', 'midday', 'c148-sd-old', '23:59', NULL,
     ((now() at time zone 'Asia/Bangkok')::time - interval '1 hour'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '1 hour'),
     10, 0, v_yesterday, v_yesterday, 'active', 'branch-tenant-bmb-001-main'),
    -- รอบวันนี้ status='closed' — ด่านสถานะต้องยังกันอยู่
    ('c148-sd-closed', 'evening', 'evening', 'c148-sd-closed', '23:59', NULL,
     ((now() at time zone 'Asia/Bangkok')::time + interval '7 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '9 hours'),
     10, 0, v_today, v_today, 'closed', 'branch-tenant-bmb-001-main');

  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c148-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c148-sd-a',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c148', p_customer_phone := '0900000000', p_delivery_address := 'c148-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'G2 FAIL: same-day order past cutoff_time must succeed (no cutoff), got % rows', v_n;
  END IF;
  RAISE NOTICE 'G2a PASS (SAME_DAY accepted despite cutoff_time 00:00)';

  -- ด่านที่ยังต้องอยู่: วันที่ผิด / รอบปิด / รอบเต็ม
  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c148-regular","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c148-sd-old',
      p_order_mode := 'SAME_DAY',
      p_customer_name := 'c148', p_customer_phone := '0900000000', p_delivery_address := 'c148-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE '%ERR_ROUND_DATE%' THEN
    RAISE EXCEPTION 'G2b FAIL: past-dated round must still be rejected, got ok=% err=%', v_ok, v_err;
  END IF;

  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c148-regular","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c148-sd-closed',
      p_order_mode := 'SAME_DAY',
      p_customer_name := 'c148', p_customer_phone := '0900000000', p_delivery_address := 'c148-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE '%ERR_ROUND_CLOSED%' THEN
    RAISE EXCEPTION 'G2c FAIL: closed round must still be rejected, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G2 PASS (no cutoff for SAME_DAY; date/status gates intact)';

  -- ===== G3: auto-close = เฉพาะรอบวันที่ผ่านไปแล้ว (ไม่ปิดวันนี้ด้วย cutoff) =====
  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    ('c148-past', 'midday', 'midday', 'c148-past', '23:59', NULL,
     ((now() at time zone 'Asia/Bangkok')::time - interval '2 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '2 hours'),
     10, 0, v_yesterday, v_yesterday, 'active', 'branch-tenant-bmb-001-main'),
    ('c148-late', 'evening', 'evening', 'c148-late', '00:00', NULL,
     ((now() at time zone 'Asia/Bangkok')::time + interval '7 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '9 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main');

  v_n := public.auto_close_expired_rounds();

  SELECT status INTO v_status FROM public.delivery_rounds WHERE id = 'c148-late';
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'G3 FAIL: today''s round must stay active (no same-day cutoff), got %', v_status;
  END IF;
  SELECT status INTO v_status FROM public.delivery_rounds WHERE id = 'c148-past';
  IF v_status <> 'closed' THEN
    RAISE EXCEPTION 'G3 FAIL: yesterday''s round must be auto-closed, got %', v_status;
  END IF;
  RAISE NOTICE 'G3 PASS (auto-close = date-based only, closed % round(s))', v_n;

  -- ===== G4: PRE_ORDER override (pre_order_cutoff ตั้งตรง) — REJECT ตอนเลยคัทออฟ =====
  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    -- pre_order_cutoff = 00:00 ของวันนี้ (ผ่านแล้ว) → ต้อง REJECT ทั้งที่ fallback (delivery_start +3ชม.) ยังเปิด
    ('c148-po-a', 'evening', 'evening', 'c148-po-a', '23:59', '00:00',
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main'),
    -- pre_order_cutoff = 23:59 ของวันนี้ (ยังไม่ถึง) → ต้อง ALLOW
    ('c148-po-b', 'evening', 'evening', 'c148-po-b', '23:59', '23:59',
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main');

  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c148-menu","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c148-po-a',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_today,
      p_customer_name := 'c148', p_customer_phone := '0900000000', p_delivery_address := 'c148-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE '%ERR_CUTOFF_PASSED%' THEN
    RAISE EXCEPTION 'G4 FAIL: pre_order_cutoff override must reject, got ok=% err=%', v_ok, v_err;
  END IF;

  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c148-menu","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c148-po-b',
    p_order_mode := 'PRE_ORDER',
    p_scheduled_date := v_today,
    p_customer_name := 'c148', p_customer_phone := '0900000000', p_delivery_address := 'c148-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'G4 FAIL: override-open pre-order must be accepted, got % rows', v_n;
  END IF;
  RAISE NOTICE 'G4 PASS (pre_order_cutoff override intact)';

  -- ===== G5: fallback — pre_order_cutoff NULL = กฎเดิม (cutoff_hours=0 → คัทออฟ = delivery_start) =====
  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    ('c148-po-c', 'evening', 'evening', 'c148-po-c', '23:59', NULL,
     ((now() at time zone 'Asia/Bangkok')::time - interval '1 minute'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main');

  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c148-menu","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c148-po-c',
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_today,
      p_customer_name := 'c148', p_customer_phone := '0900000000', p_delivery_address := 'c148-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE '%ERR_CUTOFF_PASSED%' THEN
    RAISE EXCEPTION 'G5 FAIL: fallback rule must still fire, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G5 PASS (pre-order fallback intact)';

  -- ===== G6: shared slot — SAME_DAY + PRE_ORDER บนแถวรอบเดียวกัน (ความจุก้อนเดียว) =====
  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    -- cutoff_time '00:00' เดิมจะบล็อกเซมเดย์ (145) — ตอนนี้ต้องไม่บล็อก และความจุยังนับรวมสองโหมด
    ('c148-share', 'midday', 'midday', 'c148-share', '00:00', '23:59',
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
     2, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main');

  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c148-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c148-share',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c148', p_customer_phone := '0900000000', p_delivery_address := 'c148-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G6 FAIL: same-day leg expected 1 row, got %', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c148-menu","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c148-share',
    p_order_mode := 'PRE_ORDER',
    p_scheduled_date := v_today,
    p_customer_name := 'c148', p_customer_phone := '0900000000', p_delivery_address := 'c148-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G6 FAIL: pre-order leg expected 1 row, got %', v_n; END IF;

  SELECT current_count INTO v_n FROM public.delivery_rounds WHERE id = 'c148-share';
  IF v_n <> 2 THEN RAISE EXCEPTION 'G6 FAIL: shared bucket must be 2 (one row, both modes), got %', v_n; END IF;

  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := '[{"product_id":"c148-regular","quantity":1}]'::jsonb,
      p_delivery_round_id := 'c148-share',
      p_order_mode := 'SAME_DAY',
      p_customer_name := 'c148', p_customer_phone := '0900000000', p_delivery_address := 'c148-addr',
      p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
      p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_CAPACITY_FULL%' THEN
    RAISE EXCEPTION 'G6 FAIL: expected ERR_CAPACITY_FULL after shared 2/2, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G6 PASS (shared slot, no double-counting)';

  RAISE NOTICE 'CONTRACT 148: PASS';
END $$;
ROLLBACK;