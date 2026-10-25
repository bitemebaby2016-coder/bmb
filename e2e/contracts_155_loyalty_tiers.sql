-- ============================================
-- Bite Me Baby — SQL Contract: Migration 155
-- (G&R STAGE 3 · Loyalty: 4 ระดับ rolling 12 เดือน · points ledger append-only ·
--  refund delta-reversal · audit · admin gates)
-- Date: 2026-10-25 · ตาม handoff §9.2 ข้อ 1 (inspect-first → ทำเหมือน Stage 1/2)
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves:
--   G1  สคีมา: points_ledger + RLS deny (0 policy) + append-only trigger + policy seed
--       (tiers on · 1500/4000/8000 · 12 เดือน · points off/0) + 12 fns + 3 triggers
--       + anon ถูกกัน (ตาราง + RPC)
--   G2  tier math: 0/1499.99=member · 1500=silver · 3999.99=silver · 4000=gold ·
--       7999.99=gold · 8000=platinum · admin เปลี่ยน threshold ตามจริง ·
--       threshold ไม่เรียงตรง → fallback ชุดเริ่มต้น (ไม่แสร้งว่าใช้ได้)
--   G3  gates: anon อ่านตาราง/เรียก RPC ไม่ได้ · authenticated อ่านตารางตรงไม่ได้ ·
--       ไม่ล็อกอิน → ERR_NOT_AUTHENTICATED · my_status ของตัวเองถูกต้อง
--   G4  net sales: subtotal−ส่วนลด (ไม่รวมค่าส่ง) · ยกเลิก=0 · คืนเงินเต็ม=0 ·
--       ออเดอร์ 13 เดือนก่อน = นอก window · tier=gold จากยอดจริง
--   G5  earn: เปิดอัตรา 1.5 → delivered = floor(net×rate) 1 แถว + notice + audit ·
--       trigger ยิงซ้ำ/เรียก sync ซ้ำ = ไม่มีแถวที่ 2 (idempotent)
--   G6  partial refund: delta reversal 50% → −225 · คืนเงินเต็ม → −225 (รวม 450=0) ·
--       sync ซ้ำ = ไม่เพิ่ม (ไม่หักซ้ำ §4.2)
--   G7  earn ที่ confirmed (earn_qualify_status ปรับได้) → ยกเลิก = reversal เต็มจำนวน
--       ครั้งเดียว · sync ซ้ำนิ่ง (state machine ไม่ให้ delivered → cancelled)
--   G8  append-only: UPDATE ledger = ERR_LEDGER_APPEND_ONLY · authenticated ลบ/แก้ไม่ได้ ·
--       purchase ซ้ำ/เครื่องหมายผิด = constraint บล็อก
--   G9  admin: stats/adjust = ERR_FORBIDDEN กับ non-admin · anon เรียกไม่ได้ ·
--       admin ได้ stats ครบ + adjust (audit) + validate (0 แต้ม/ไม่มีเหตุผล/ไม่พบลูกค้า)
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, phone) VALUES
  ('00000000-0000-4000-8000-000000c15501', 'c155-main@example.com',  '0991550001'),
  ('00000000-0000-4000-8000-000000c15502', 'c155-admin@example.com', '0991550002');
-- fixture: เบอร์ช่วง 09915500xx เฉพาะ contract นี้ (บทเรียน 153/154 G4: ห้ามชน ambient)
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000c15502';

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c155-cat', 'c155-cat', 'c155-cat', '', 0, true);
INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c155-pa', 'c155-pa', '', 100, 'c155-cat', '', true, false, true, false, 0);

INSERT INTO public.delivery_rounds
  (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
   delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
VALUES
  ('c155-round', 'midday', 'midday', 'c155-round', '00:00', '23:59',
   ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
   ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
   99, 0, (now() AT TIME ZONE 'Asia/Bangkok')::date, (now() AT TIME ZONE 'Asia/Bangkok')::date,
   'active', 'branch-tenant-bmb-001-main');

-- ---- helpers (mirror 154 contract — claims/round เป๊ะ) ----
CREATE OR REPLACE FUNCTION public.c155_claims(p_sub text, p_role text DEFAULT 'authenticated')
RETURNS void LANGUAGE sql AS $fn$
  SELECT set_config('request.jwt.claims',
    CASE WHEN p_sub IS NULL THEN jsonb_build_object('role', p_role)::text
         ELSE jsonb_build_object('sub', p_sub, 'role', p_role)::text END, true);
$fn$;

CREATE OR REPLACE FUNCTION public.c155_make_order(p_uid uuid, p_phone text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v jsonb;
BEGIN
  SELECT public.create_order_with_items(
    p_items := '[{"product_id":"c155-pa","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c155-round', p_order_mode := 'SAME_DAY',
    p_customer_name := 'c155', p_customer_phone := p_phone,
    p_delivery_address := 'c155-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_customer_ref := p_uid
  ) INTO v;
  RETURN v->>'order_number';
END;
$fn$;

-- walk สถานะ (allow-list guard 008 — claims ตั้งเป็น admin ก่อนเรียก)
CREATE OR REPLACE FUNCTION public.c155_walk(p_order_number text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.orders SET status = 'confirmed'          WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'preparing'          WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'ready_for_dispatch' WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'dispatched'         WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'in_transit'         WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'arrived'            WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'delivered'          WHERE order_number = p_order_number;
END;
$fn$;

DO $$
DECLARE
  v_user_claims text := COALESCE(current_setting('request.jwt.claims', true), '');
  v_n integer;
  v_pts integer;
  v_rec integer;
  v_j jsonb;
  v_txt text;
  v_saved jsonb;
  v_on_a text; v_on_b text; v_on_c text; v_on_d text; v_on_e text; v_on_f text;
  v_eid text;
  v_uid_main uuid := '00000000-0000-4000-8000-000000c15501';
  v_uid_adm  uuid := '00000000-0000-4000-8000-000000c15502';
BEGIN
  -- ===== G1: สคีมา + RLS deny + append-only + policy seed + 12 fns + 3 triggers + anon deny =====
  IF to_regclass('public.points_ledger') IS NULL THEN RAISE EXCEPTION 'G1 FAIL: points_ledger missing'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.points_ledger'::regclass) THEN
    RAISE EXCEPTION 'G1 FAIL: RLS not enabled';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies WHERE tablename = 'points_ledger';
  IF v_n <> 0 THEN RAISE EXCEPTION 'G1 FAIL: expected 0 policies (deny-all), got %', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_points_ledger_append_only' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'G1 FAIL: append-only trigger missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_loyalty_order_sync' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_loyalty_intent_sync' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'G1 FAIL: loyalty sync triggers missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'loyalty_policy'
                   AND (value->>'tiers_enabled')::boolean = true
                   AND (value->>'window_months')::numeric = 12
                   AND (value->>'tier_silver_min')::numeric = 1500
                   AND (value->>'tier_gold_min')::numeric = 4000
                   AND (value->>'tier_platinum_min')::numeric = 8000
                   AND (value->>'points_enabled')::boolean = false
                   AND (value->>'points_per_baht')::numeric = 0
                   AND value->>'earn_qualify_status' = 'delivered') THEN
    RAISE EXCEPTION 'G1 FAIL: loyalty_policy seed wrong';
  END IF;
  v_j := public.loyalty_policy_state();
  FOREACH v_txt IN ARRAY ARRAY['tiers_enabled','window_months','tier_silver_min','tier_gold_min',
                               'tier_platinum_min','points_enabled','points_per_baht',
                               'earn_qualify_status'] LOOP
    IF NOT (v_j ? v_txt) THEN RAISE EXCEPTION 'G1 FAIL: policy_state missing key %', v_txt; END IF;
  END LOOP;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN (
     'loyalty_policy_state','loyalty_tier_of','loyalty_order_net','loyalty_net_sales',
     'loyalty_sync_order','loyalty_order_hook','loyalty_payment_intent_hook',
     'loyalty_my_status','loyalty_my_history','loyalty_admin_stats','loyalty_admin_adjust',
     'points_ledger_guard');
  IF v_n <> 12 THEN RAISE EXCEPTION 'G1 FAIL: expected 12 loyalty functions, got %', v_n; END IF;
  -- order_net: ไม่รวมค่าส่ง · ยกเลิก = 0 (fixture ไม่มีออเดอร์ → NULL = ถูก)
  IF public.loyalty_order_net('no-such-order') IS NOT NULL THEN
    RAISE EXCEPTION 'G1 FAIL: order_net unknown order should be NULL';
  END IF;
  EXECUTE 'SET ROLE anon';
  BEGIN
    SELECT count(*) INTO v_n FROM public.points_ledger;
    RAISE EXCEPTION 'G1 FAIL: anon must not read points_ledger';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.loyalty_my_status();
    RAISE EXCEPTION 'G1 FAIL: anon must not exec loyalty_my_status';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'G1 PASS (schema + RLS deny + append-only + seed + 12 fns + triggers + anon deny)';

  -- ===== G2: tier math (ค่าเริ่มต้น) + เปลี่ยน threshold ได้จริง + fallback เมื่อค่าเสีย =====
  IF public.loyalty_tier_of(0) <> 'member'
     OR public.loyalty_tier_of(-100) <> 'member'
     OR public.loyalty_tier_of(1499.99) <> 'member'
     OR public.loyalty_tier_of(1500) <> 'silver'
     OR public.loyalty_tier_of(3999.99) <> 'silver'
     OR public.loyalty_tier_of(4000) <> 'gold'
     OR public.loyalty_tier_of(7999.99) <> 'gold'
     OR public.loyalty_tier_of(8000) <> 'platinum'
     OR public.loyalty_tier_of(NULL) <> 'member' THEN
    RAISE EXCEPTION 'G2 FAIL: default tier boundaries wrong';
  END IF;
  SELECT value INTO v_saved FROM public.business_settings WHERE key = 'loyalty_policy';
  UPDATE public.business_settings
     SET value = value || '{"tier_silver_min":100,"tier_gold_min":200,"tier_platinum_min":300}'::jsonb
   WHERE key = 'loyalty_policy';
  IF public.loyalty_tier_of(150) <> 'silver'
     OR public.loyalty_tier_of(250) <> 'gold'
     OR public.loyalty_tier_of(300) <> 'platinum' THEN
    RAISE EXCEPTION 'G2 FAIL: admin threshold change not effective';
  END IF;
  -- threshold ไม่เรียงตรง (gold ≤ silver) → fallback ชุดเริ่มต้น (ไม่แสร้งว่าใช้ได้)
  UPDATE public.business_settings
     SET value = v_saved || '{"tier_gold_min":100,"tier_platinum_min":50}'::jsonb
   WHERE key = 'loyalty_policy';
  v_j := public.loyalty_policy_state();
  IF (v_j->>'tier_silver_min')::numeric <> 1500
     OR (v_j->>'tier_gold_min')::numeric <> 4000
     OR (v_j->>'tier_platinum_min')::numeric <> 8000 THEN
    RAISE EXCEPTION 'G2 FAIL: malformed thresholds should fall back to defaults (got %)', v_j;
  END IF;
  IF public.loyalty_tier_of(1500) <> 'silver' OR public.loyalty_tier_of(4000) <> 'gold' THEN
    RAISE EXCEPTION 'G2 FAIL: tier_of should use fallback defaults';
  END IF;
  UPDATE public.business_settings SET value = v_saved WHERE key = 'loyalty_policy';
  RAISE NOTICE 'G2 PASS (boundaries + admin thresholds + malformed fallback)';

  -- ===== G3: gates — anon/authenticated ถูกกัน · ไม่ล็อกอิน · my_status ของตัวเอง =====
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    SELECT count(*) INTO v_n FROM public.points_ledger;
    RAISE EXCEPTION 'G3 FAIL: authenticated must not read points_ledger directly';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM public.c155_claims(NULL, 'authenticated');
  BEGIN
    v_j := public.loyalty_my_status();
    RAISE EXCEPTION 'G3 FAIL: expect ERR_NOT_AUTHENTICATED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NOT_AUTHENTICATED%' THEN RAISE; END IF;
  END;
  PERFORM public.c155_claims(v_uid_main::text);
  v_j := public.loyalty_my_status();
  IF (v_j->>'tier') <> 'member'
     OR (v_j->>'tier_label') <> 'Member'
     OR (v_j->>'points_balance')::integer <> 0
     OR (v_j->>'points_enabled')::boolean <> false
     OR (v_j->>'points_per_baht')::numeric <> 0
     OR (v_j->>'tiers_enabled')::boolean <> true
     OR (v_j->>'window_months')::numeric <> 12
     OR (v_j->>'net_sales')::numeric <> 0
     OR (v_j->>'next_tier') <> 'silver'
     OR (v_j->'thresholds'->>'silver')::numeric <> 1500
     OR (v_j->'thresholds'->>'gold')::numeric <> 4000
     OR (v_j->'thresholds'->>'platinum')::numeric <> 8000 THEN
    RAISE EXCEPTION 'G3 FAIL: my_status defaults wrong (%)', v_j;
  END IF;
  v_j := public.loyalty_my_history(10);
  IF jsonb_typeof(v_j->'entries') <> 'array'
     OR jsonb_array_length(v_j->'entries') <> 0
     OR (v_j->>'balance')::integer <> 0 THEN
    RAISE EXCEPTION 'G3 FAIL: history should be empty (%)', v_j;
  END IF;
  RAISE NOTICE 'G3 PASS (role gates + not-authenticated + my_status/history defaults)';

  -- ===== G4: net sales = subtotal − ส่วนลด (ไม่รวมค่าส่ง) · ยกเลิก/คืนเงิน = 0 · window 12 เดือน =====
  PERFORM public.c155_claims(v_uid_main::text);
  v_on_a := public.c155_make_order(v_uid_main, '0991550001');
  v_on_b := public.c155_make_order(v_uid_main, '0991550001');
  v_on_c := public.c155_make_order(v_uid_main, '0991550001');
  v_on_d := public.c155_make_order(v_uid_main, '0991550001');
  IF v_on_a IS NULL OR v_on_b IS NULL OR v_on_c IS NULL OR v_on_d IS NULL THEN
    RAISE EXCEPTION 'G4 FAIL: order creation failed (a=%,b=%,c=%,d=%)', v_on_a, v_on_b, v_on_c, v_on_d;
  END IF;
  PERFORM public.c155_claims(v_uid_adm::text);
  -- A: 4600 − 100 ส่วนลด = 4500 (ค่าส่ง 77 + ค่าบริการ 25 = ไม่นับ) · ชำระแล้ว
  UPDATE public.orders
     SET subtotal = 4600, discount_amount = 100, delivery_fee = 77, service_fee = 25,
         payment_status = 'paid'
   WHERE order_number = v_on_a;
  UPDATE public.orders SET subtotal = 3000 WHERE order_number = v_on_b;                    -- ยกเลิก
  UPDATE public.orders SET subtotal = 9000 WHERE order_number = v_on_c;                    -- 13 เดือนก่อน
  UPDATE public.orders SET subtotal = 1000, payment_status = 'refund' WHERE order_number = v_on_d; -- คืนเงินเต็ม
  UPDATE public.orders SET status = 'cancelled' WHERE order_number = v_on_b;
  UPDATE public.orders SET created_at = now() - interval '13 months' WHERE order_number = v_on_c;
  PERFORM public.c155_walk(v_on_a);
  -- แต้มยังปิด = ห้ามมี ledger row ใด ๆ
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE customer_id = v_uid_main::text;
  IF v_n <> 0 THEN RAISE EXCEPTION 'G4 FAIL: ledger must be empty while points disabled (got %)', v_n; END IF;
  PERFORM public.c155_claims(v_uid_main::text);
  v_j := public.loyalty_my_status();
  IF (v_j->>'net_sales')::numeric <> 4500
     OR (v_j->>'tier') <> 'gold'
     OR (v_j->>'next_tier') <> 'platinum'
     OR (v_j->>'next_threshold')::numeric <> 8000
     OR (v_j->>'remaining')::numeric <> 3500
     OR (v_j->>'progress')::numeric <> 0.5625 THEN
    RAISE EXCEPTION 'G4 FAIL: expected net 4500 / gold / progress .5625 (got %)', v_j;
  END IF;
  RAISE NOTICE 'G4 PASS (net 4500 = gold · fees excluded · cancel/refund/out-of-window = 0)';

  -- ===== G5: เปิดอัตราแต้ม → earn ครั้งเดียว + notice + audit · ยิงซ้ำ = idempotent =====
  -- (requirements: อัตราแต้ม = แอดมินตั้งเอง · ค่า seed = ปิด/0 — ทดสอบด้วยการ "เปิด" ใน tx นี้)
  UPDATE public.business_settings
     SET value = value || '{"points_enabled":true,"points_per_baht":1.5}'::jsonb
   WHERE key = 'loyalty_policy';
  PERFORM public.c155_claims(v_uid_main::text);
  v_on_e := public.c155_make_order(v_uid_main, '0991550001');
  IF v_on_e IS NULL THEN RAISE EXCEPTION 'G5 FAIL: order E creation failed'; END IF;
  PERFORM public.c155_claims(v_uid_adm::text);
  UPDATE public.orders SET subtotal = 300, discount_amount = 0 WHERE order_number = v_on_e;
  PERFORM public.c155_walk(v_on_e);
  SELECT id INTO v_eid FROM public.orders WHERE order_number = v_on_e;
  SELECT count(*), COALESCE(MAX(l.points), 0) INTO v_n, v_pts
    FROM public.points_ledger l
   WHERE l.order_id = v_eid AND l.entry_type = 'purchase';
  IF v_n <> 1 OR v_pts <> 450 THEN
    RAISE EXCEPTION 'G5 FAIL: expect 1 purchase row of 450 (rows=%, pts=%)', v_n, v_pts;
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM public.points_ledger l
        WHERE l.order_id = v_eid AND l.entry_type = 'purchase'
          AND l.basis_amount = 300 AND l.rate_used = 1.5
          AND l.order_number = v_on_e AND l.customer_ref = v_uid_main
          AND l.customer_id = v_uid_main::text) THEN
    RAISE EXCEPTION 'G5 FAIL: purchase row fields wrong';
  END IF;
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE notification_type = 'loyalty_points_earned' AND customer_id = v_uid_main::text;
  IF v_n <> 1 THEN RAISE EXCEPTION 'G5 FAIL: expect 1 points notice (got %)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.audit_logs
   WHERE action = 'loyalty_points_earn' AND entity_id = v_uid_main::text;
  IF v_n <> 1 THEN RAISE EXCEPTION 'G5 FAIL: expect 1 earn audit (got %)', v_n; END IF;
  -- ยิง trigger ซ้ำ (pending → paid) = ห้ามมีแถวที่ 2
  UPDATE public.orders SET payment_status = 'paid' WHERE order_number = v_on_e;
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE order_id = v_eid AND entry_type = 'purchase';
  IF v_n <> 1 THEN RAISE EXCEPTION 'G5 FAIL: duplicate purchase after re-fire (%)', v_n; END IF;
  -- เรียก sync ตรง ๆ ซ้ำ = เขียน 0
  SELECT public.loyalty_sync_order(v_eid) INTO v_n;
  IF v_n <> 0 THEN RAISE EXCEPTION 'G5 FAIL: sync rerun should write 0 (got %)', v_n; END IF;
  PERFORM public.c155_claims(v_uid_main::text);
  v_j := public.loyalty_my_status();
  IF (v_j->>'points_balance')::integer <> 450 OR (v_j->>'net_sales')::numeric <> 4800 THEN
    RAISE EXCEPTION 'G5 FAIL: balance 450 / net 4800 expected (%)', v_j;
  END IF;
  RAISE NOTICE 'G5 PASS (earn 450 = floor(300×1.5) + notice + audit · rerun idempotent)';

  -- ===== G6: partial refund → delta reversal 50% · คืนเต็ม → ครบ 450 · ไม่หักซ้ำ =====
  PERFORM public.c155_claims(v_uid_adm::text);
  INSERT INTO public.payment_intents (id, order_number, amount, status, metadata)
  VALUES ('pi155-e', v_on_e, 300, 'succeeded', '{}'::jsonb);
  UPDATE public.orders SET payment_status = 'partially_refunded' WHERE order_number = v_on_e;
  UPDATE public.payment_intents
     SET metadata = metadata || '{"refunded_total_minor":15000}'::jsonb
   WHERE id = 'pi155-e';
  SELECT count(*), COALESCE(-SUM(l.points), 0) INTO v_n, v_rec
    FROM public.points_ledger l
   WHERE l.order_id = v_eid AND l.entry_type = 'reversal';
  IF v_n <> 1 OR v_rec <> 225 THEN
    RAISE EXCEPTION 'G6 FAIL: partial 50 pct expect 1 row/225 (rows=%, rec=%)', v_n, v_rec;
  END IF;
  UPDATE public.payment_intents
     SET metadata = metadata || '{"refunded_total_minor":30000}'::jsonb
   WHERE id = 'pi155-e';
  UPDATE public.orders SET payment_status = 'refund' WHERE order_number = v_on_e;
  SELECT count(*), COALESCE(-SUM(l.points), 0) INTO v_n, v_rec
    FROM public.points_ledger l
   WHERE l.order_id = v_eid AND l.entry_type = 'reversal';
  IF v_n <> 2 OR v_rec <> 450 THEN
    RAISE EXCEPTION 'G6 FAIL: full refund expect 2 rows/450 (rows=%, rec=%)', v_n, v_rec;
  END IF;
  SELECT public.loyalty_sync_order(v_eid) INTO v_n;
  IF v_n <> 0 THEN RAISE EXCEPTION 'G6 FAIL: rerun should write 0 (got %)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE order_id = v_eid AND entry_type = 'reversal';
  IF v_n <> 2 THEN RAISE EXCEPTION 'G6 FAIL: reversal duplicated (%)', v_n; END IF;
  PERFORM public.c155_claims(v_uid_main::text);
  v_j := public.loyalty_my_status();
  IF (v_j->>'net_sales')::numeric <> 4500 OR (v_j->>'points_balance')::integer <> 0 THEN
    RAISE EXCEPTION 'G6 FAIL: net back to 4500 / balance 0 expected (%)', v_j;
  END IF;
  RAISE NOTICE 'G6 PASS (partial 225 -> full 450 · rerun stable · net 4500 · balance 0)';

  -- ===== G7: ยกเลิกหลังได้แต้ม → reversal เต็มครั้งเดียว · ซ้ำ = นิ่ง =====
  --   (state machine ไม่อนุญาต delivered → cancelled — ใช้ earn_qualify_status='confirmed'
  --    ที่แอดมินตั้งได้จริงตาม policy · ยืนยัน reversal ทำงานบนเส้นทางยกเลิกปกติ)
  UPDATE public.business_settings
     SET value = value || '{"earn_qualify_status":"confirmed"}'::jsonb
   WHERE key = 'loyalty_policy';
  PERFORM public.c155_claims(v_uid_main::text);
  v_on_f := public.c155_make_order(v_uid_main, '0991550001');
  IF v_on_f IS NULL THEN RAISE EXCEPTION 'G7 FAIL: order F creation failed'; END IF;
  PERFORM public.c155_claims(v_uid_adm::text);
  UPDATE public.orders SET subtotal = 600, discount_amount = 0 WHERE order_number = v_on_f;
  UPDATE public.orders SET status = 'confirmed' WHERE order_number = v_on_f; -- ผ่าน qualify → earn
  SELECT id INTO v_eid FROM public.orders WHERE order_number = v_on_f;
  IF NOT EXISTS (SELECT 1 FROM public.points_ledger
                  WHERE order_id = v_eid AND entry_type = 'purchase' AND points = 900) THEN
    RAISE EXCEPTION 'G7 FAIL: expect purchase 900 at confirmed';
  END IF;
  UPDATE public.orders SET status = 'cancelled' WHERE order_number = v_on_f;
  SELECT count(*), COALESCE(-SUM(points), 0) INTO v_n, v_rec
    FROM public.points_ledger WHERE order_id = v_eid AND entry_type = 'reversal';
  IF v_n <> 1 OR v_rec <> 900 THEN
    RAISE EXCEPTION 'G7 FAIL: expect 1 reversal of 900 (rows=%, rec=%)', v_n, v_rec;
  END IF;
  SELECT public.loyalty_sync_order(v_eid) INTO v_n;
  IF v_n <> 0 THEN RAISE EXCEPTION 'G7 FAIL: rerun should write 0 (got %)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE order_id = v_eid;
  IF v_n <> 2 THEN RAISE EXCEPTION 'G7 FAIL: expect exactly 2 ledger rows (%)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE notification_type = 'loyalty_points_earned' AND customer_id = v_uid_main::text;
  IF v_n <> 2 THEN RAISE EXCEPTION 'G7 FAIL: expect 2 notices (E+F), got %', v_n; END IF;
  PERFORM public.c155_claims(v_uid_main::text);
  v_j := public.loyalty_my_status();
  IF (v_j->>'points_balance')::integer <> 0 OR (v_j->>'net_sales')::numeric <> 4500 THEN
    RAISE EXCEPTION 'G7 FAIL: balance 0 / net 4500 after cancel (%)', v_j;
  END IF;
  -- คืนค่า earn_qualify_status เป็น delivered (ค่าเริ่มต้นตามสัญญา seed)
  UPDATE public.business_settings
     SET value = value || '{"earn_qualify_status":"delivered"}'::jsonb
   WHERE key = 'loyalty_policy';
  RAISE NOTICE 'G7 PASS (earn at confirmed -> cancel -> reversal 900 once · rerun stable · balance 0)';

  -- ===== G8: append-only · บทบาทถูกกัน · constraint ป้องกันแถวผิด =====
  BEGIN
    UPDATE public.points_ledger SET points = points + 1
     WHERE customer_id = v_uid_main::text AND entry_type = 'purchase';
    RAISE EXCEPTION 'G8 FAIL: ledger UPDATE must be blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_LEDGER_APPEND_ONLY%' THEN RAISE; END IF;
  END;
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    DELETE FROM public.points_ledger WHERE customer_id = v_uid_main::text;
    RAISE EXCEPTION 'G8 FAIL: authenticated DELETE should be denied';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.points_ledger SET points = 1 WHERE customer_id = v_uid_main::text;
    RAISE EXCEPTION 'G8 FAIL: authenticated UPDATE should be denied';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  BEGIN
    INSERT INTO public.points_ledger (id, customer_id, points, entry_type, order_id, order_number, reason)
    SELECT 'plt-c155-dup', v_uid_main::text, 10, 'purchase', o.id, o.order_number, 'dup'
      FROM public.orders o WHERE o.order_number = v_on_e;
    RAISE EXCEPTION 'G8 FAIL: duplicate purchase row accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%idx_points_ledger_order_purchase%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.points_ledger (id, customer_id, points, entry_type, reason)
    VALUES ('plt-c155-sign', v_uid_main::text, -5, 'purchase', 'bad sign');
    RAISE EXCEPTION 'G8 FAIL: negative purchase accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%points_ledger_sign%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.points_ledger (id, customer_id, points, entry_type, reason)
    VALUES ('plt-c155-zero', v_uid_main::text, 0, 'adjustment', 'zero');
    RAISE EXCEPTION 'G8 FAIL: zero points accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%points_ledger_points_check%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'G8 PASS (append-only + role deny + unique/sign/zero constraints)';

  -- ===== G9: admin gates · stats ครบ · adjust (validate + audit) =====
  PERFORM public.c155_claims(v_uid_main::text);
  BEGIN
    v_j := public.loyalty_admin_stats();
    RAISE EXCEPTION 'G9 FAIL: stats must be admin-only';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.loyalty_admin_adjust(v_uid_main::text, 5, 'x');
    RAISE EXCEPTION 'G9 FAIL: adjust must be admin-only';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  EXECUTE 'SET ROLE anon';
  BEGIN
    v_j := public.loyalty_admin_stats();
    RAISE EXCEPTION 'G9 FAIL: anon must not exec admin_stats';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';

  PERFORM public.c155_claims(v_uid_adm::text);
  v_j := public.loyalty_admin_stats();
  FOREACH v_txt IN ARRAY ARRAY['policy','window_months','tiers','points','recent'] LOOP
    IF NOT (v_j ? v_txt) THEN RAISE EXCEPTION 'G9 FAIL: stats missing key %', v_txt; END IF;
  END LOOP;
  IF (v_j->'tiers'->>'gold')::integer < 1 OR jsonb_typeof(v_j->'recent') <> 'array' THEN
    RAISE EXCEPTION 'G9 FAIL: stats content wrong (%)', v_j;
  END IF;
  IF (v_j->'points'->>'entries')::integer < 5 THEN
    RAISE EXCEPTION 'G9 FAIL: stats should see all 5 ledger entries (%)', v_j->'points';
  END IF;
  IF (v_j->'policy'->>'points_per_baht')::numeric <> 1.5 THEN
    RAISE EXCEPTION 'G9 FAIL: stats policy not reflected (%)', v_j->'policy';
  END IF;
  BEGIN
    v_j := public.loyalty_admin_adjust(v_uid_main::text, 0, 'x');
    RAISE EXCEPTION 'G9 FAIL: 0 points accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_INVALID_POINTS%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.loyalty_admin_adjust(v_uid_main::text, 5, '   ');
    RAISE EXCEPTION 'G9 FAIL: empty reason accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_MISSING_REASON%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.loyalty_admin_adjust('no-such-customer-155', 5, 'x');
    RAISE EXCEPTION 'G9 FAIL: unknown customer accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_CUSTOMER_NOT_FOUND%' THEN RAISE; END IF;
  END;
  v_j := public.loyalty_admin_adjust(v_uid_main::text, 25, 'contract test');
  IF (v_j->>'ok')::boolean IS DISTINCT FROM true OR (v_j->>'balance')::integer <> 25 THEN
    RAISE EXCEPTION 'G9 FAIL: adjust result wrong (%)', v_j;
  END IF;
  SELECT count(*) INTO v_n FROM public.audit_logs
   WHERE action = 'loyalty_adjust' AND entity_id = v_uid_main::text;
  IF v_n <> 1 THEN RAISE EXCEPTION 'G9 FAIL: adjust audit missing (%)', v_n; END IF;
  -- ยอดรวมมีลูกค้า = 25 (450+900 ถูกปรับกลับครบ · adjust +25) · history clamp limit=5
  PERFORM public.c155_claims(v_uid_main::text);
  v_j := public.loyalty_my_status();
  IF (v_j->>'points_balance')::integer <> 25 THEN
    RAISE EXCEPTION 'G9 FAIL: final balance 25 expected (%)', v_j->>'points_balance';
  END IF;
  v_j := public.loyalty_my_history(5);
  IF jsonb_array_length(v_j->'entries') <> 5 OR (v_j->>'balance')::integer <> 25 THEN
    RAISE EXCEPTION 'G9 FAIL: history limit/balance wrong (%)', v_j;
  END IF;
  RAISE NOTICE 'G9 PASS (admin gates + stats + adjust validate/audit + history clamp)';

  PERFORM set_config('request.jwt.claims', v_user_claims, true);
  RAISE NOTICE 'CONTRACT 155: PASS';
END $$;

ROLLBACK;