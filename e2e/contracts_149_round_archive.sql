-- ============================================
-- Bite Me Baby — SQL Contract: Migration 149
-- (ROUND ARCHIVE + CLEANUP — P0-2 "รอบค้าง ลบไม่ได้")
-- Date: 2026-10-24 · Owner directive: "บางอันลบไม่ได้ ที่ค้างทั้งหมดเป็นพวกลบไม่ได้"
-- Root cause (probe e2e/p14ProbeRounds.json): orders/products → delivery_rounds = FK NO ACTION
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves:
--   G1  คอลัมน์ archived (default false) มีจริง
--   G2  รอบที่มีออเดอร์อ้างอิง = DELETE ถูกปฏิเสธด้วย FK (23503) — นี่คือ "ลบไม่ได้" จริง
--   G3  archive ทำได้ (archived=true + status='closed' พร้อมกัน — RLS public read กรอง active)
--   G4  ลูกค้า (anon, RLS) มองไม่เห็นแถวที่ archive แล้ว
--   G5  restore คืนรายการหลักได้ (archived=false)
--   G6  รอบที่ไม่มีใครอ้างอิง = DELETE ถาวรสำเร็จ (cleanup ทำได้จริง)
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000c14901', 'c149@example.com');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14901","role":"service_role"}', true);

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c149-cat', 'c149-cat', 'c149-cat', '', 0, true);
INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c149-regular', 'c149-regular', '', 10, 'c149-cat', '', true, false, true, false, 0);

DO $$
DECLARE
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_ok boolean; v_err text; v_sqlstate text; v_n integer; v_arch boolean; v_status text;
BEGIN
  -- ===== G1: คอลัมน์ archived =====
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='delivery_rounds' AND column_name='archived'
       AND data_type = 'boolean'
  ) THEN
    RAISE EXCEPTION 'G1 FAIL: column delivery_rounds.archived (boolean) missing';
  END IF;

  INSERT INTO public.delivery_rounds
    (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
     delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES
    ('c149-ref', 'midday', 'c149-ref', 'c149-ref', '23:59', NULL,
     ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main'),
    ('c149-free', 'evening', 'c149-free', 'c149-free', '23:59', NULL,
     ((now() at time zone 'Asia/Bangkok')::time + interval '7 hours'),
     ((now() at time zone 'Asia/Bangkok')::time + interval '9 hours'),
     10, 0, v_today, v_today, 'active', 'branch-tenant-bmb-001-main');

  -- ออเดอร์จริง 1 ใบผูกกับ c149-ref (SAME_DAY — 148: ไม่มีคัทออฟ)
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c149-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c149-ref',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c149', p_customer_phone := '0900000000', p_delivery_address := 'c149-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'G2 setup FAIL: order creation expected 1 row, got %', v_n; END IF;

  -- ===== G2: DELETE รอบที่มีออเดอร์ = FK violation (นี่คือต้นตอ "ลบไม่ได้") =====
  v_ok := false; v_err := ''; v_sqlstate := '';
  BEGIN
    DELETE FROM public.delivery_rounds WHERE id = 'c149-ref';
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM; v_sqlstate := SQLSTATE;
  END;
  IF v_ok OR v_sqlstate <> '23503' THEN
    RAISE EXCEPTION 'G2 FAIL: expected FK 23503 on round with orders, got ok=% state=% err=%', v_ok, v_sqlstate, v_err;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = 'c149-ref') THEN
    RAISE EXCEPTION 'G2 FAIL: round row must still exist after failed delete';
  END IF;
  RAISE NOTICE 'G2 PASS (FK blocks delete of round with orders: %)', v_err;

  -- ===== G3: archive = archived=true + status='closed' =====
  UPDATE public.delivery_rounds SET archived = true, status = 'closed', updated_at = now() WHERE id = 'c149-ref';
  SELECT archived, status INTO v_arch, v_status FROM public.delivery_rounds WHERE id = 'c149-ref';
  IF v_arch IS DISTINCT FROM true OR v_status <> 'closed' THEN
    RAISE EXCEPTION 'G3 FAIL: expected archived=true + status=closed, got archived=% status=%', v_arch, v_status;
  END IF;
  RAISE NOTICE 'G3 PASS (archive marks archived + closed)';

  -- ===== G4: ลูกค้า (authenticated + RLS public_read status=active) มองไม่เห็นแถวที่เก็บ =====
  SET ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.delivery_rounds WHERE id = 'c149-ref';
  RESET ROLE;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'G4 FAIL: archived round must be invisible to customers, got % row(s)', v_n;
  END IF;
  RAISE NOTICE 'G4 PASS (customer RLS cannot see archived round)';

  -- ===== G5: restore = กลับรายการหลัก =====
  UPDATE public.delivery_rounds SET archived = false, updated_at = now() WHERE id = 'c149-ref';
  SELECT archived INTO v_arch FROM public.delivery_rounds WHERE id = 'c149-ref';
  IF v_arch IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'G5 FAIL: restore must clear archived, got %', v_arch;
  END IF;
  RAISE NOTICE 'G5 PASS (restore clears archived)';

  -- ===== G6: รอบที่ไม่มีใครอ้างอิง = ลบถาวรได้จริง (cleanup) =====
  DELETE FROM public.delivery_rounds WHERE id = 'c149-free';
  IF EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = 'c149-free') THEN
    RAISE EXCEPTION 'G6 FAIL: unreferenced round must delete cleanly';
  END IF;
  RAISE NOTICE 'G6 PASS (unreferenced round hard-deleted)';

  RAISE NOTICE 'CONTRACT 149: PASS';
END $$;
ROLLBACK;