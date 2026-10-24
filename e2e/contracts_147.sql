-- ============================================
-- Bite Me Baby — SQL Contract: Migration 147 (role RLS matrix)
-- Owner sign-off 2026-10-24 · ONE transaction, ROLLBACK · access matrix ราย role:
--   G1 KITCHEN เขียนครัวได้ · กัน inventory · RPC gates ผ่านเป็นห้ามต่างกัน
--   G2 INVENTORY เขียน inventory ได้ (grant คืน + policy) · kitchen/customer ไม่ได้
--   G3 FINANCE close_day+daily_closings ได้ · kitchen โดนห้าม
--   G4 MARKETING เขียน posts ได้ + RPC gates · G5 SUPPORT อ่านอย่างเดียว
--   G6 AUDITOR/DEV อ่านอย่างเดียวจริง · G7 POS staff-family · G8 RIDER policies
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000c14701', 'c147-kitchen@example.com'),
  ('00000000-0000-4000-8000-000000c14702', 'c147-inventory@example.com'),
  ('00000000-0000-4000-8000-000000c14703', 'c147-finance@example.com'),
  ('00000000-0000-4000-8000-000000c14704', 'c147-marketing@example.com'),
  ('00000000-0000-4000-8000-000000c14705', 'c147-pos@example.com'),
  ('00000000-0000-4000-8000-000000c14706', 'c147-support@example.com'),
  ('00000000-0000-4000-8000-000000c14707', 'c147-auditor@example.com'),
  ('00000000-0000-4000-8000-000000c14708', 'c147-developer@example.com'),
  ('00000000-0000-4000-8000-000000c14709', 'c147-rider@example.com'),
  ('00000000-0000-4000-8000-000000c14710', 'c147-customer@example.com'),
  ('00000000-0000-4000-8000-000000c14711', 'c147-orderer@example.com');

UPDATE profiles SET role='kitchen'   WHERE id = '00000000-0000-4000-8000-000000c14701';
UPDATE profiles SET role='inventory' WHERE id = '00000000-0000-4000-8000-000000c14702';
UPDATE profiles SET role='finance'   WHERE id = '00000000-0000-4000-8000-000000c14703';
UPDATE profiles SET role='marketing' WHERE id = '00000000-0000-4000-8000-000000c14704';
UPDATE profiles SET role='pos'       WHERE id = '00000000-0000-4000-8000-000000c14705';
UPDATE profiles SET role='support'   WHERE id = '00000000-0000-4000-8000-000000c14706';
UPDATE profiles SET role='auditor'   WHERE id = '00000000-0000-4000-8000-000000c14707';
UPDATE profiles SET role='developer' WHERE id = '00000000-0000-4000-8000-000000c14708';
UPDATE profiles SET role='rider'     WHERE id = '00000000-0000-4000-8000-000000c14709';

INSERT INTO public.drivers (id, name, phone, user_id) VALUES
  ('drv-147', 'R147', '0991471470', '00000000-0000-4000-8000-000000c14709');

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c147-cat', 'c147-cat', 'c147-cat', '', 0, true);
INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c147-regular', 'c147-regular', '', 10, 'c147-cat', '', true, false, true, false, 0);

INSERT INTO public.delivery_rounds
  (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
   delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
VALUES
  ('c147-round', 'midday', 'midday', 'c147-round', '23:59', NULL,
   ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
   ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
   10, 0, (now() at time zone 'Asia/Bangkok')::date, (now() at time zone 'Asia/Bangkok')::date,
   'active', 'branch-tenant-bmb-001-main');

INSERT INTO public.inventory (id, name, category) VALUES ('inv-147', 'inv-147', 'c147');

-- ออเดอร์จริง 1 ใบ (SAME_DAY) เป็นเป้าหมายทดสอบสิทธิ์เขียนของ support/auditor
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14711","role":"service_role"}', false);
DO $$ DECLARE v_n integer; BEGIN
  SELECT count(*) INTO v_n FROM public.create_order_with_items(
    p_items := '[{"product_id":"c147-regular","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c147-round',
    p_order_mode := 'SAME_DAY',
    p_customer_name := 'c147', p_customer_phone := '0900000147', p_delivery_address := 'c147-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'));
  IF v_n <> 1 THEN RAISE EXCEPTION 'FIXTURE FAIL: order create (n=%)', v_n; END IF;
END $$;

DO $$
DECLARE v_n integer; v_err text := ''; v_res jsonb;
BEGIN
  -- ===== G1 KITCHEN (#3) =====
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14701","role":"authenticated"}', false);
  -- G1a: insert production_batches ได้
  BEGIN
    SET ROLE authenticated;
    BEGIN
      INSERT INTO public.production_batches (id) VALUES ('batch-147');
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM; RESET ROLE;
      RAISE EXCEPTION 'G1 FAIL: kitchen must write production_batches (%)', v_err;
    END;
    RESET ROLE;
  END;
  -- G1b: kitchen_queue RPC ผ่าน gate (ข้อผิดพลาดต้องเป็นธุรกิจ ไม่ใช่ FORBIDDEN)
  v_err := '';
  BEGIN
    SET ROLE authenticated;
    BEGIN
      PERFORM public.kitchen_queue(NULL, (now() AT TIME ZONE 'Asia/Bangkok')::date);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RESET ROLE;
  END;
  IF v_err LIKE '%ERR_FORBIDDEN%' THEN RAISE EXCEPTION 'G1 FAIL: kitchen_queue blocked for kitchen (%)', v_err; END IF;
  -- G1c: create_production_batch ผ่าน gate แล้วค่อย miss round (พิสูจน์ gate = ERR_MISSING_ROUND)
  v_err := '';
  BEGIN
    SET ROLE authenticated;
    BEGIN
      PERFORM public.create_production_batch(NULL);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RESET ROLE;
  END;
  IF v_err NOT LIKE '%ERR_MISSING_ROUND%' THEN
    RAISE EXCEPTION 'G1 FAIL: kitchen gate should reach ERR_MISSING_ROUND (got %)', v_err;
  END IF;
  -- G1d: เขียน inventory ไม่ได้ (42501 ทั้ง grant/RLS)
  v_err := '';
  BEGIN
    SET ROLE authenticated;
    BEGIN
      INSERT INTO public.inventory (id, name, category) VALUES ('inv-k147', 'x', 'c');
    EXCEPTION WHEN insufficient_privilege THEN v_err := '42501'; END;
    RESET ROLE;
  END;
  IF v_err <> '42501' THEN RAISE EXCEPTION 'G1 FAIL: kitchen must NOT write inventory'; END IF;
  RAISE NOTICE 'G1 PASS (kitchen writes kitchen only)';
END $$;

DO $$
DECLARE v_n integer; v_stock numeric;
BEGIN
  -- ===== G2 INVENTORY (#4) — เขียนได้ (grant คืน + policy) =====
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14702","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      UPDATE public.inventory SET current_stock = 7 WHERE id = 'inv-147';
      GET DIAGNOSTICS v_n = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      v_stock := -1; RESET ROLE;
      RAISE EXCEPTION 'G2 FAIL: inventory role cannot UPDATE (%)', SQLERRM;
    END;
    RESET ROLE;
  END;
  IF v_n <> 1 THEN RAISE EXCEPTION 'G2 FAIL: inventory UPDATE affected % rows', v_n; END IF;
  SELECT current_stock INTO v_stock FROM public.inventory WHERE id = 'inv-147';
  IF v_stock <> 7 THEN RAISE EXCEPTION 'G2 FAIL: stock not written (%)', v_stock; END IF;
  RAISE NOTICE 'G2 PASS';
END $$;

DO $$
DECLARE v_ok jsonb; v_err text := '';
BEGIN
  -- ===== G3 FINANCE (#5) =====
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14703","role":"authenticated"}', false);
  -- G3a: insert daily_closings ตรง ๆ ได้
  BEGIN
    SET ROLE authenticated;
    BEGIN
      INSERT INTO public.daily_closings (business_date, payload)
      VALUES ((now() AT TIME ZONE 'Asia/Bangkok')::date - 1, '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM; RESET ROLE;
      RAISE EXCEPTION 'G3 FAIL: finance cannot insert daily_closings (%)', v_err;
    END;
    RESET ROLE;
  END;
  -- G3b: close_day ของ finance ต้องผ่าน (รวม get_daily_sales ข้างใน)
  v_err := '';
  BEGIN
    SET ROLE authenticated;
    BEGIN
      v_ok := public.close_day((now() AT TIME ZONE 'Asia/Bangkok')::date);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RESET ROLE;
  END;
  IF v_err <> '' OR COALESCE(v_ok->>'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'G3 FAIL: close_day as finance (err=% res=%)', v_err, v_ok;
  END IF;
  -- G3c: kitchen เรียก close_day ไม่ได้
  v_err := '';
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14701","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      PERFORM public.close_day((now() AT TIME ZONE 'Asia/Bangkok')::date);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RESET ROLE;
  END;
  IF v_err NOT LIKE '%ERR_FORBIDDEN%' THEN
    RAISE EXCEPTION 'G3 FAIL: kitchen must not close day (got %)', v_err;
  END IF;
  RAISE NOTICE 'G3 PASS';
END $$;

DO $$
DECLARE v_n integer; v_err text := '';
BEGIN
  -- ===== G4 MARKETING (#9) =====
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14704","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      INSERT INTO public.marketing_posts (id, title) VALUES ('mp-147', 'mp-147');
      GET DIAGNOSTICS v_n = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM; RESET ROLE;
      RAISE EXCEPTION 'G4 FAIL: marketing cannot insert posts (%)', v_err;
    END;
    RESET ROLE;
  END;
  IF v_n <> 1 THEN RAISE EXCEPTION 'G4 FAIL: marketing insert rows=%', v_n; END IF;
  -- RPC gate: ผ่าน is_marketing แล้วค่อยพลาดธุรกิจ (ไม่ใช่ FORBIDDEN)
  v_err := '';
  BEGIN
    SET ROLE authenticated;
    BEGIN
      PERFORM public.marketing_save_rules('{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RESET ROLE;
  END;
  IF v_err NOT LIKE '%ERR_MISSING_ASSIGNMENT%' THEN RAISE EXCEPTION 'G4 FAIL: save_rules gate (got %)', v_err; END IF;
  v_err := '';
  BEGIN
    SET ROLE authenticated;
    BEGIN
      PERFORM public.marketing_schedule_post('mp-missing-147', now());
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RESET ROLE;
  END;
  IF v_err NOT LIKE '%ERR_ORDER_NOT_FOUND%' THEN RAISE EXCEPTION 'G4 FAIL: schedule_post gate (got %)', v_err; END IF;
  -- customer เรียก RPC ต้องโดน FORBIDDEN
  v_err := '';
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14710","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      PERFORM public.marketing_save_rules('{"frequency_per_week":3}'::jsonb);
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RESET ROLE;
  END;
  IF v_err NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE EXCEPTION 'G4 FAIL: customer must be forbidden (got %)', v_err; END IF;
  RAISE NOTICE 'G4 PASS';
END $$;

DO $$
DECLARE v_n integer; v_n2 integer; v_cnt integer; v_status text; v_oid text;
BEGIN
  -- ===== G5 SUPPORT (#8) — อ่านได้ เขียนไม่ได้ (RLS กรอง → 0 rows ทั้ง UPDATE/DELETE) =====
  SELECT id, status INTO v_oid, v_status FROM public.orders WHERE customer_phone = '0900000147' LIMIT 1;
  IF v_oid IS NULL THEN RAISE EXCEPTION 'FIXTURE FAIL: order not found'; END IF;
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14706","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      SELECT count(*) INTO v_cnt FROM public.orders;
      SELECT count(*) INTO v_cnt FROM public.customers;
      UPDATE public.orders SET status = 'confirmed' WHERE id = v_oid;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      DELETE FROM public.orders WHERE id = v_oid;
      GET DIAGNOSTICS v_n2 = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      RAISE EXCEPTION 'G5 FAIL: support path broken (%)', SQLERRM;
    END;
    RESET ROLE;
  END;
  IF v_n <> 0 OR v_n2 <> 0 THEN RAISE EXCEPTION 'G5 FAIL: support must affect 0 rows (upd=% del=%)', v_n, v_n2; END IF;
  SELECT status INTO v_status FROM public.orders WHERE id = v_oid;
  IF v_status IS NULL OR v_status = 'confirmed' THEN RAISE EXCEPTION 'G5 FAIL: order mutated/removed by support'; END IF;
  RAISE NOTICE 'G5 PASS (support = read-only)';
END $$;

DO $$
DECLARE v_n integer; v_n2 integer; v_cnt integer; v_oid text;
BEGIN
  -- ===== G6 AUDITOR (#10) + DEVELOPER (#11) — อ่านอย่างเดียวจริง =====
  SELECT id INTO v_oid FROM public.orders WHERE customer_phone = '0900000147' LIMIT 1;
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14707","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      SELECT count(*) INTO v_cnt FROM public.orders;
      SELECT count(*) INTO v_cnt FROM public.audit_logs;
      SELECT count(*) INTO v_cnt FROM public.business_settings;
      UPDATE public.orders SET status = 'confirmed' WHERE id = v_oid;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      DELETE FROM public.orders WHERE id = v_oid;
      GET DIAGNOSTICS v_n2 = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      RAISE EXCEPTION 'G6 FAIL: auditor read path broken (%)', SQLERRM;
    END;
    RESET ROLE;
  END;
  IF v_n <> 0 OR v_n2 <> 0 THEN RAISE EXCEPTION 'G6 FAIL: auditor must be read-only (upd=% del=%)', v_n, v_n2; END IF;

  -- developer: อ่าน errors/audit ได้ + เขียนไม่ได้
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14708","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      SELECT count(*) INTO v_cnt FROM public.system_errors;
      SELECT count(*) INTO v_cnt FROM public.audit_logs;
      UPDATE public.orders SET status = 'confirmed' WHERE id = v_oid;
      GET DIAGNOSTICS v_n = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      RAISE EXCEPTION 'G6 FAIL: developer path broken (%)', SQLERRM;
    END;
    RESET ROLE;
  END;
  IF v_n <> 0 THEN RAISE EXCEPTION 'G6 FAIL: developer must be read-only (upd=%)', v_n; END IF;
  RAISE NOTICE 'G6 PASS (auditor/developer read-only)';
END $$;

DO $$
DECLARE v_cnt integer; v_err text := '';
BEGIN
  -- ===== G7 POS — staff-family reads =====
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14705","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      SELECT count(*) INTO v_cnt FROM public.delivery_rounds;
      IF NOT public.is_staff() THEN RAISE EXCEPTION 'G7 FAIL: pos must satisfy is_staff()'; END IF;
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      RAISE EXCEPTION 'G7 FAIL: pos read path (%)', SQLERRM;
    END;
    RESET ROLE;
  END;
  RAISE NOTICE 'G7 PASS';
END $$;

DO $$
DECLARE v_n integer; v_policies integer; v_err text := ''; v_oid text; v_status text;
BEGIN
  -- ===== G8 RIDER (#6/P3) — policies อ้าง is_rider + self-update ได้ + customer negative =====
  SELECT count(*) INTO v_policies FROM pg_policies
   WHERE policyname IN ('drivers_scoped_read', 'assignments_scoped_read', 'drivers_self_update')
     AND schemaname = 'public'
     AND (qual LIKE '%is_rider%' OR with_check LIKE '%is_rider%');
  IF v_policies <> 3 THEN RAISE EXCEPTION 'G8 FAIL: expected 3 rider-gated policies, got %', v_policies; END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14709","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      UPDATE public.drivers SET status = 'available' WHERE id = 'drv-147';
      GET DIAGNOSTICS v_n = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      RAISE EXCEPTION 'G8 FAIL: rider self-update (%)', SQLERRM;
    END;
    RESET ROLE;
  END;
  IF v_n <> 1 THEN RAISE EXCEPTION 'G8 FAIL: rider self-update rows=%', v_n; END IF;

  -- customer: ห้ามแตะออเดอร์คนอื่น (0 rows) + ห้ามเขียน inventory (42501 — NOT NULL ครบทุกคอลัมน์ที่ใส่)
  SELECT id INTO v_oid FROM public.orders WHERE customer_phone = '0900000147' LIMIT 1;
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14710","role":"authenticated"}', false);
  BEGIN
    SET ROLE authenticated;
    BEGIN
      UPDATE public.orders SET status = 'confirmed' WHERE id = v_oid;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      BEGIN
        INSERT INTO public.inventory (id, name, category) VALUES ('inv-c147', 'x', 'c');
      EXCEPTION WHEN insufficient_privilege THEN v_err := '42501'; END;
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      RAISE EXCEPTION 'G8 FAIL: customer negative path (%)', SQLERRM;
    END;
    RESET ROLE;
  END;
  IF v_n <> 0 THEN RAISE EXCEPTION 'G8 FAIL: customer must not touch others orders (rows=%)', v_n; END IF;
  IF v_err <> '42501' THEN RAISE EXCEPTION 'G8 FAIL: customer inventory write must be denied'; END IF;
  SELECT status INTO v_status FROM public.orders WHERE id = v_oid;
  IF v_status IS NULL THEN RAISE EXCEPTION 'G8 FAIL: fixture order vanished'; END IF;
  RAISE NOTICE 'G8 PASS (rider gated + customer negative)';
END $$;

ROLLBACK;