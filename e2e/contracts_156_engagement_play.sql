-- ============================================
-- Bite Me Baby — SQL Contract: Migration 156
-- (G&R STAGE 4 · Engagement & Play: Spin&Win รางวัลจริง + Creator Affiliate แต้ม
--  + แคตตาล็อก Rewards ย้าย hardcode → ตาราง admin · §2 ข้อ 4/5/7)
-- Date: 2026-10-25 · ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves:
--   G1  สคีมา: 3 ตาราง RLS deny + ledger types += spin/affiliate + seed 2 policies
--       (ปิดทั้งคู่ · ไม่เดาอัตรา §3.1) + catalog seed 4 รายการเป๊ะ + 16 fns + 2 triggers + anon deny
--   G2  catalog: ลูกค้า list ได้ 4 รายการเรียงถูก · แอดมิน save/remove/list ผ่าน gate +
--       validate (ชื่อว่าง/แต้ม≤0 ถูกบล็อก) + audit · non-admin = ERR_FORBIDDEN · anon ถูกกัน
--   G3  spin gates: default ปิด → ERR_SPIN_DISABLED (ZERO-FAKE) · เปิดแต่อัตรา 0 →
--       ERR_SPIN_NO_RATE · เปิดจริง → ได้แต้มจริง + audit + daily_limit บล็อกครั้งที่ 2
--   G4  affiliate code: my_code idempotent · normalize · claim กัน self/ซ้ำ/ไม่พบ/
--       ออเดอร์ตาย/ไม่ใช่เจ้าของ · disabled → pending (ไม่แสร้งว่าได้)
--   G5  affiliate qualify: เปิด policy → walk delivered → +30 ครั้งเดียว + audit ·
--       re-fire/sync ซ้ำ = idempotent · ปิด policy ขณะ walk = ไม่จ่าย (เปิดแล้วตาม catch-up)
--   G6  cap + reverse: monthly_cap บล็อกเมื่อชน (ปรับแล้วจ่ายได้) · ยกเลิกหลังได้ →
--       −30 ครั้งเดียว state=reversed · sync ซ้ำนิ่ง (delta-model ไม่หักซ้ำ §4.2)
--   G7  admin gates: stats ทุกตัว = ERR_FORBIDDEN กับ non-admin · anon ถูกกัน ·
--       admin ได้ stats ครบ (spin วันนี้ · affiliate codes/att/points)
--   G8  ledger invariants: UPDATE = ERR_LEDGER_APPEND_ONLY · authenticated ลบ/แก้ไม่ได้ ·
--       entry_type ผิด/แต้ม 0/purchase ซ้ำ = constraint บล็อก (types เดิมยังเข้มเหมือน 155)
--   G9  ZERO-FAKE: order-fn ไม่ถูกแตะ (ไม่มี affiliate/spin/loyalty ใน prosrc) ·
--       policy keys = ไม่มีช่องเงินสดใด ๆ (§4.1 ข้อ 5) · catalog ซ่อน is_active=false
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, phone) VALUES
  ('00000000-0000-4000-8000-000000c15601', 'c156-main@example.com',  '0991560001'),
  ('00000000-0000-4000-8000-000000c15602', 'c156-admin@example.com', '0991560002'),
  ('00000000-0000-4000-8000-000000c15603', 'c156-aff@example.com',   '0991560003');
-- fixture: เบอร์ช่วง 09915600xx เฉพาะ contract นี้ (บทเรียน 153/154 G4)
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000c15602';

-- customers rows ให้ครบ 3 คน (กัน FK ตอน probe ledger + make_order จะใช้ row เดิม)
INSERT INTO public.customers (id, user_id, full_name, phone) VALUES
  ('00000000-0000-4000-8000-000000c15601', '00000000-0000-4000-8000-000000c15601', 'c156-main',  '0991560001'),
  ('00000000-0000-4000-8000-000000c15603', '00000000-0000-4000-8000-000000c15603', 'c156-aff',   '0991560003')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c156-cat', 'c156-cat', 'c156-cat', '', 0, true);
INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c156-pa', 'c156-pa', '', 100, 'c156-cat', '', true, false, true, false, 0);

INSERT INTO public.delivery_rounds
  (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
   delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
VALUES
  ('c156-round', 'midday', 'midday', 'c156-round', '00:00', '23:59',
   ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
   ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
   99, 0, (now() AT TIME ZONE 'Asia/Bangkok')::date, (now() AT TIME ZONE 'Asia/Bangkok')::date,
   'active', 'branch-tenant-bmb-001-main');

-- ---- helpers (mirror 155 contract — claims/round เป๊ะ) ----
CREATE OR REPLACE FUNCTION public.c156_claims(p_sub text, p_role text DEFAULT 'authenticated')
RETURNS void LANGUAGE sql AS $fn$
  SELECT set_config('request.jwt.claims',
    CASE WHEN p_sub IS NULL THEN jsonb_build_object('role', p_role)::text
         ELSE jsonb_build_object('sub', p_sub, 'role', p_role)::text END, true);
$fn$;

CREATE OR REPLACE FUNCTION public.c156_make_order(p_uid uuid, p_phone text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v jsonb;
BEGIN
  SELECT public.create_order_with_items(
    p_items := '[{"product_id":"c156-pa","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c156-round', p_order_mode := 'SAME_DAY',
    p_customer_name := 'c156', p_customer_phone := p_phone,
    p_delivery_address := 'c156-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_customer_ref := p_uid
  ) INTO v;
  RETURN v->>'order_number';
END;
$fn$;

CREATE OR REPLACE FUNCTION public.c156_walk(p_order_number text)
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
  v_arr jsonb;
  v_code text;
  v_code2 text;
  v_on_x text; v_on_y text; v_on_z text; v_on_w text; v_on_v text;
  v_eid text;
  v_uid_main uuid := '00000000-0000-4000-8000-000000c15601';
  v_uid_adm  uuid := '00000000-0000-4000-8000-000000c15602';
  v_uid_aff  uuid := '00000000-0000-4000-8000-000000c15603';
BEGIN
  -- ===== G1: สคีมา 3 ตาราง RLS deny + ledger types + seeds + 15 fns + 2 triggers + anon deny =====
  IF to_regclass('public.rewards_catalog') IS NULL
     OR to_regclass('public.affiliate_codes') IS NULL
     OR to_regclass('public.affiliate_attributions') IS NULL THEN
    RAISE EXCEPTION 'G1 FAIL: one of the 3 tables missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.rewards_catalog'::regclass AND relrowsecurity)
     OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.affiliate_codes'::regclass AND relrowsecurity)
     OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.affiliate_attributions'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'G1 FAIL: RLS not enabled on a table';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE tablename IN ('rewards_catalog','affiliate_codes','affiliate_attributions');
  IF v_n <> 0 THEN RAISE EXCEPTION 'G1 FAIL: expected 0 policies (deny-all), got %', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_affiliate_order_sync' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_affiliate_intent_sync' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'G1 FAIL: affiliate triggers missing';
  END IF;
  -- seed policies = ปิดทั้งคู่ · ไม่เดาอัตรา (§3.1)
  IF NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'spin_policy'
                   AND (value->>'enabled')::boolean = false
                   AND (value->>'daily_limit')::numeric = 1
                   AND (value->>'points_per_spin')::numeric = 0) THEN
    RAISE EXCEPTION 'G1 FAIL: spin_policy seed wrong';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'affiliate_policy'
                   AND (value->>'enabled')::boolean = false
                   AND (value->>'points_per_qualified_order')::numeric = 0
                   AND (value->>'monthly_cap')::numeric = 0
                   AND value->>'qualify_status' = 'delivered') THEN
    RAISE EXCEPTION 'G1 FAIL: affiliate_policy seed wrong';
  END IF;
  v_j := public.spin_policy_state();
  FOREACH v_txt IN ARRAY ARRAY['enabled','daily_limit','points_per_spin'] LOOP
    IF NOT (v_j ? v_txt) THEN RAISE EXCEPTION 'G1 FAIL: spin_state missing %', v_txt; END IF;
  END LOOP;
  v_j := public.affiliate_policy_state();
  FOREACH v_txt IN ARRAY ARRAY['enabled','points_per_qualified_order','monthly_cap','qualify_status'] LOOP
    IF NOT (v_j ? v_txt) THEN RAISE EXCEPTION 'G1 FAIL: affiliate_state missing %', v_txt; END IF;
  END LOOP;
  -- catalog seed = รายการ hardcode เดิม 4 ชิ้นเป๊ะ (§2 ข้อ 7)
  SELECT count(*) INTO v_n FROM public.rewards_catalog;
  IF v_n <> 4 THEN RAISE EXCEPTION 'G1 FAIL: catalog seed expected 4, got %', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rewards_catalog WHERE id='rw-coupon-10' AND name='คูปองลด 10%' AND points_cost=100)
     OR NOT EXISTS (SELECT 1 FROM public.rewards_catalog WHERE id='rw-ship-free' AND name='ส่งฟรี 1 ครั้ง' AND points_cost=150)
     OR NOT EXISTS (SELECT 1 FROM public.rewards_catalog WHERE id='rw-menu-free' AND name='เมนูฟรี 1 จาน' AND points_cost=200)
     OR NOT EXISTS (SELECT 1 FROM public.rewards_catalog WHERE id='rw-coupon-20' AND name='คูปองลด 20%' AND points_cost=300) THEN
    RAISE EXCEPTION 'G1 FAIL: catalog seed content wrong';
  END IF;
  -- ledger types ขยาย: spin>0 / affiliate ใส่ได้ (ขอบเขต 'adjustment' เดิมถูกแทนที่แล้ว)
  INSERT INTO public.points_ledger (id, customer_id, customer_ref, points, entry_type, reason)
  VALUES ('g156-spin-probe', v_uid_main::text, v_uid_main, 3, 'spin', 'probe')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.points_ledger (id, customer_id, customer_ref, points, entry_type, reason)
  VALUES ('g156-aff-probe', v_uid_main::text, v_uid_main, -2, 'affiliate', 'probe')
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_n FROM public.points_ledger
   WHERE id IN ('g156-spin-probe','g156-aff-probe');
  IF v_n <> 2 THEN RAISE EXCEPTION 'G1 FAIL: extended ledger types rejected (rows=%)', v_n; END IF;
  DELETE FROM public.points_ledger WHERE id IN ('g156-spin-probe','g156-aff-probe');
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN (
     'spin_policy_state','spin_status','spin_reward','affiliate_policy_state',
     'affiliate_normalize_code','affiliate_my_code','affiliate_claim','affiliate_sync_order',
     'affiliate_order_hook','affiliate_intent_hook','rewards_catalog_list',
     'rewards_admin_list','rewards_admin_save','rewards_admin_remove',
     'spin_admin_stats','affiliate_admin_stats');
  IF v_n <> 16 THEN RAISE EXCEPTION 'G1 FAIL: expected 16 functions, got %', v_n; END IF;
  EXECUTE 'SET ROLE anon';
  BEGIN
    SELECT count(*) INTO v_n FROM public.rewards_catalog;
    RAISE EXCEPTION 'G1 FAIL: anon must not read rewards_catalog';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.spin_reward();
    RAISE EXCEPTION 'G1 FAIL: anon must not exec spin_reward';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.rewards_catalog_list();
    RAISE EXCEPTION 'G1 FAIL: anon must not exec rewards_catalog_list';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'G1 PASS (3 tables deny + types extended + seeds + 16 fns + triggers + anon deny)';

  -- ===== G2: catalog — list ถูก · แอดมิน CRUD ผ่าน gate + validate + audit · non-admin ถูกกัน =====
  PERFORM public.c156_claims(v_uid_main::text);
  v_arr := public.rewards_catalog_list();
  IF jsonb_array_length(v_arr) <> 4 THEN
    RAISE EXCEPTION 'G2 FAIL: expected 4 active items (got %)', v_arr;
  END IF;
  IF (v_arr->0->>'id') <> 'rw-coupon-10' OR (v_arr->0->>'points_cost')::int <> 100
     OR (v_arr->3->>'id') <> 'rw-coupon-20' OR (v_arr->3->>'points_cost')::int <> 300 THEN
    RAISE EXCEPTION 'G2 FAIL: list order/content wrong (%)', v_arr;
  END IF;
  BEGIN
    PERFORM public.c156_claims(NULL, 'authenticated');
    v_arr := public.rewards_catalog_list();
    RAISE EXCEPTION 'G2 FAIL: expect ERR_NOT_AUTHENTICATED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NOT_AUTHENTICATED%' THEN RAISE; END IF;
  END;
  -- non-admin = ห้าม CRUD
  PERFORM public.c156_claims(v_uid_main::text);
  BEGIN
    v_j := public.rewards_admin_save('', 'ของทดสอบ', '', 50, true, 9);
    RAISE EXCEPTION 'G2 FAIL: non-admin must not save';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.rewards_admin_list();
    RAISE EXCEPTION 'G2 FAIL: non-admin must not read admin list';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  -- admin: validate + save + update + deactivate + remove
  PERFORM public.c156_claims(v_uid_adm::text);
  BEGIN
    v_j := public.rewards_admin_save('', '  ', '', 50, true, 9);
    RAISE EXCEPTION 'G2 FAIL: empty name should fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_INVALID_NAME%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.rewards_admin_save('', 'ของทดสอบ', '', 0, true, 9);
    RAISE EXCEPTION 'G2 FAIL: cost 0 should fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_INVALID_POINTS%' THEN RAISE; END IF;
  END;
  v_j := public.rewards_admin_save('', 'ของทดสอบ', 'ไว้ทดสอบ', 50, true, 9);
  IF (v_j->>'ok')::boolean IS DISTINCT FROM true OR COALESCE(v_j->>'id','') = '' THEN
    RAISE EXCEPTION 'G2 FAIL: save should return id (%)', v_j;
  END IF;
  v_txt := v_j->>'id';
  v_arr := public.rewards_catalog_list();
  IF jsonb_array_length(v_arr) <> 5 THEN RAISE EXCEPTION 'G2 FAIL: expected 5 after save (%)', v_arr; END IF;
  UPDATE public.rewards_catalog SET is_active = false WHERE id = v_txt;
  v_arr := public.rewards_catalog_list();
  IF jsonb_array_length(v_arr) <> 4 THEN RAISE EXCEPTION 'G2 FAIL: inactive must be hidden (%)', v_arr; END IF;
  -- แอดมินยัง "เห็น" รายการที่ปิดอยู่ (มิฉะนั้นเปิดกลับไม่ได้)
  PERFORM public.c156_claims(v_uid_adm::text);
  v_arr := public.rewards_admin_list();
  IF jsonb_array_length(v_arr) <> 5
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_arr) e
                     WHERE e->>'id' = v_txt AND (e->>'is_active')::boolean = false) THEN
    RAISE EXCEPTION 'G2 FAIL: admin list must include inactive (%)', v_arr;
  END IF;
  v_j := public.rewards_admin_remove(v_txt);
  SELECT count(*) INTO v_n FROM public.rewards_catalog WHERE id = v_txt;
  IF v_n <> 0 THEN RAISE EXCEPTION 'G2 FAIL: remove did not delete'; END IF;
  BEGIN
    v_j := public.rewards_admin_remove('rw-no-such');
    RAISE EXCEPTION 'G2 FAIL: remove missing should fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NOT_FOUND%' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO v_n FROM public.audit_logs
   WHERE action IN ('rewards_catalog_save','rewards_catalog_remove');
  IF v_n <> 2 THEN RAISE EXCEPTION 'G2 FAIL: expected exactly 2 audit rows (save+remove, got %)', v_n; END IF;
  RAISE NOTICE 'G2 PASS (list 4 · admin CRUD + validate + audit · non-admin/anon blocked)';

  -- ===== G3: spin gates — default ปิด = ไม่สัญญา (ZERO-FAKE) · อัตรา 0 = บล็อก · เพดานรายวัน =====
  PERFORM public.c156_claims(NULL, 'authenticated');
  BEGIN
    v_j := public.spin_status();
    RAISE EXCEPTION 'G3 FAIL: expect ERR_NOT_AUTHENTICATED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NOT_AUTHENTICATED%' THEN RAISE; END IF;
  END;
  PERFORM public.c156_claims(v_uid_main::text);
  v_j := public.spin_status();
  IF (v_j->>'enabled')::boolean <> false
     OR (v_j->>'daily_limit')::int <> 1
     OR (v_j->>'points_per_spin')::int <> 0
     OR (v_j->>'used_today')::int <> 0
     OR (v_j->>'remaining_today')::int <> 1
     OR (v_j->>'balance')::int <> 0 THEN
    RAISE EXCEPTION 'G3 FAIL: spin_status defaults wrong (%)', v_j;
  END IF;
  BEGIN
    v_j := public.spin_reward();
    RAISE EXCEPTION 'G3 FAIL: default disabled must block spin';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_SPIN_DISABLED%' THEN RAISE; END IF;
  END;
  -- เปิด policy แต่อัตรา = 0 → ยังไม่จ่าย (ERR_SPIN_NO_RATE)
  PERFORM public.c156_claims(v_uid_adm::text);
  UPDATE public.business_settings
     SET value = value || '{"enabled":true,"points_per_spin":0}'::jsonb
   WHERE key = 'spin_policy';
  PERFORM public.c156_claims(v_uid_main::text);
  BEGIN
    v_j := public.spin_reward();
    RAISE EXCEPTION 'G3 FAIL: enabled with rate 0 must block';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_SPIN_NO_RATE%' THEN RAISE; END IF;
  END;
  -- เปิดจริง (rate 10 · จำกัด 1/วัน) → ได้แต้มจริง + audit
  PERFORM public.c156_claims(v_uid_adm::text);
  UPDATE public.business_settings
     SET value = value || '{"enabled":true,"points_per_spin":10,"daily_limit":1}'::jsonb
   WHERE key = 'spin_policy';
  PERFORM public.c156_claims(v_uid_main::text);
  v_j := public.spin_reward();
  IF (v_j->>'ok')::boolean IS DISTINCT FROM true
     OR (v_j->>'points')::int <> 10
     OR (v_j->>'used_today')::int <> 1
     OR (v_j->>'remaining_today')::int <> 0
     OR (v_j->>'balance')::int <> 10 THEN
    RAISE EXCEPTION 'G3 FAIL: spin award wrong (%)', v_j;
  END IF;
  SELECT count(*) INTO v_n FROM public.points_ledger
   WHERE entry_type = 'spin' AND customer_ref = v_uid_main;
  IF v_n <> 1 THEN RAISE EXCEPTION 'G3 FAIL: expected 1 spin ledger row (got %)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.audit_logs WHERE action = 'spin_reward';
  IF v_n <> 1 THEN RAISE EXCEPTION 'G3 FAIL: expected 1 spin audit (got %)', v_n; END IF;
  -- ครั้งที่ 2 วันนี้ = เพดานรายวันบล็อก
  BEGIN
    v_j := public.spin_reward();
    RAISE EXCEPTION 'G3 FAIL: 2nd spin today must be blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_SPIN_LIMIT%' THEN RAISE; END IF;
  END;
  -- แอดมินปรับเพดานเป็น 2 → หมุนเพิ่มได้ (controls ได้จริง)
  PERFORM public.c156_claims(v_uid_adm::text);
  UPDATE public.business_settings SET value = value || '{"daily_limit":2}'::jsonb
   WHERE key = 'spin_policy';
  PERFORM public.c156_claims(v_uid_main::text);
  v_j := public.spin_reward();
  IF (v_j->>'points')::int <> 10 OR (v_j->>'used_today')::int <> 2 THEN
    RAISE EXCEPTION 'G3 FAIL: after limit raise expected 2nd spin (%)', v_j;
  END IF;
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE entry_type = 'spin' AND customer_ref = v_uid_main;
  IF v_n <> 2 THEN RAISE EXCEPTION 'G3 FAIL: expected 2 spin rows (got %)', v_n; END IF;
  RAISE NOTICE 'G3 PASS (disabled/no-rate/award/daily-cap · admin limit adjustable)';

  -- ===== G4: affiliate code + claim gates — self/ซ้ำ/ไม่พบ/ออเดอร์ตาย/ไม่ใช่เจ้าของ =====
  BEGIN
    PERFORM public.c156_claims(NULL, 'authenticated');
    v_j := public.affiliate_my_code();
    RAISE EXCEPTION 'G4 FAIL: expect ERR_NOT_AUTHENTICATED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NOT_AUTHENTICATED%' THEN RAISE; END IF;
  END;
  PERFORM public.c156_claims(v_uid_main::text);
  v_j := public.affiliate_my_code();
  v_code := v_j->>'code';
  IF v_code IS NULL OR v_code NOT LIKE 'AFF-%' OR length(v_code) < 10 THEN
    RAISE EXCEPTION 'G4 FAIL: bad affiliate code (%)', v_j;
  END IF;
  IF (v_j->'policy'->>'enabled')::boolean <> false
     OR (v_j->>'points_total')::int <> 0
     OR (v_j->>'orders_pending')::int <> 0 THEN
    RAISE EXCEPTION 'G4 FAIL: my_code defaults wrong (%)', v_j;
  END IF;
  v_j := public.affiliate_my_code();
  IF (v_j->>'code') <> v_code THEN RAISE EXCEPTION 'G4 FAIL: my_code must be stable'; END IF;
  PERFORM public.c156_claims(v_uid_aff::text);
  v_j := public.affiliate_my_code();
  v_code2 := v_j->>'code';
  IF v_code2 = v_code OR v_code2 NOT LIKE 'AFF-%' THEN
    RAISE EXCEPTION 'G4 FAIL: creator needs a different code (%)', v_j;
  END IF;
  PERFORM public.c156_claims(v_uid_main::text);
  IF public.affiliate_normalize_code(' aff-abc123 ') <> 'AFF-ABC123' THEN
    RAISE EXCEPTION 'G4 FAIL: normalize wrong';
  END IF;

  v_on_x := public.c156_make_order(v_uid_main, '0991560001');
  IF v_on_x IS NULL THEN RAISE EXCEPTION 'G4 FAIL: order X creation failed'; END IF;
  BEGIN
    v_j := public.affiliate_claim(v_on_x, '   ');
    RAISE EXCEPTION 'G4 FAIL: empty code should fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_AFFILIATE_CODE_EMPTY%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.affiliate_claim(v_on_x, 'AFF-NOPE99');
    RAISE EXCEPTION 'G4 FAIL: unknown code should fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_AFFILIATE_CODE_NOT_FOUND%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.affiliate_claim('ORD-NO-SUCH', v_code2);
    RAISE EXCEPTION 'G4 FAIL: missing order should fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ORDER_NOT_FOUND%' THEN RAISE; END IF;
  END;
  -- HARD BLOCK: เจ้าของโค้ด = ผู้ซื้อ
  BEGIN
    v_j := public.affiliate_claim(v_on_x, v_code);
    RAISE EXCEPTION 'G4 FAIL: self-affiliate must be blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_SELF_AFFILIATE%' THEN RAISE; END IF;
  END;
  -- ไม่ใช่เจ้าของออเดอร์ → ห้ามผูก
  PERFORM public.c156_claims(v_uid_aff::text);
  BEGIN
    v_j := public.affiliate_claim(v_on_x, v_code2);
    RAISE EXCEPTION 'G4 FAIL: non-owner must not claim';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  -- happy: ผู้ซื้อผูกโค้ดครีเอเตอร์ — policy ยังปิด = pending (ไม่แสร้งว่าได้)
  PERFORM public.c156_claims(v_uid_main::text);
  v_j := public.affiliate_claim(v_on_x, v_code2);
  IF (v_j->>'ok')::boolean IS DISTINCT FROM true OR (v_j->>'state') <> 'pending' THEN
    RAISE EXCEPTION 'G4 FAIL: claim should be pending while disabled (%)', v_j;
  END IF;
  BEGIN
    v_j := public.affiliate_claim(v_on_x, v_code2);
    RAISE EXCEPTION 'G4 FAIL: duplicate claim must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ALREADY_ATTRIBUTED%' THEN RAISE; END IF;
  END;
  -- ออเดอร์ยกเลิก = ไม่รับผูกใหม่
  v_on_y := public.c156_make_order(v_uid_main, '0991560001');
  IF v_on_y IS NULL THEN RAISE EXCEPTION 'G4 FAIL: order Y creation failed'; END IF;
  PERFORM public.c156_claims(v_uid_adm::text);
  UPDATE public.orders SET status = 'cancelled' WHERE order_number = v_on_y;
  PERFORM public.c156_claims(v_uid_main::text);
  BEGIN
    v_j := public.affiliate_claim(v_on_y, v_code2);
    RAISE EXCEPTION 'G4 FAIL: cancelled order must not be claimable';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ORDER_NOT_ELIGIBLE%' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO v_n FROM public.affiliate_attributions;
  IF v_n <> 1 THEN RAISE EXCEPTION 'G4 FAIL: expected 1 attribution (got %)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE entry_type = 'affiliate';
  IF v_n <> 0 THEN RAISE EXCEPTION 'G4 FAIL: disabled policy must not award (rows=%)', v_n; END IF;
  RAISE NOTICE 'G4 PASS (my_code stable · self/dup/dead/non-owner blocked · pending while disabled)';

  -- ===== G5: qualify — เปิด policy → walk delivered → +30 ครั้งเดียว + audit · idempotent =====
  -- (§3.1: อัตรา/เพดาน = แอดมินตั้งเอง — contract "เปิด" ใน tx นี้เท่านั้น)
  PERFORM public.c156_claims(v_uid_adm::text);
  UPDATE public.business_settings
     SET value = value || '{"enabled":true,"points_per_qualified_order":30,"monthly_cap":1000}'::jsonb
   WHERE key = 'affiliate_policy';
  PERFORM public.c156_claims(v_uid_main::text);
  v_on_z := public.c156_make_order(v_uid_main, '0991560001');
  IF v_on_z IS NULL THEN RAISE EXCEPTION 'G5 FAIL: order Z creation failed'; END IF;
  v_j := public.affiliate_claim(v_on_z, v_code2);
  IF (v_j->>'state') <> 'pending' THEN RAISE EXCEPTION 'G5 FAIL: expect pending at claim (%)', v_j; END IF;
  PERFORM public.c156_claims(v_uid_adm::text);
  PERFORM public.c156_walk(v_on_z);
  SELECT id INTO v_eid FROM public.orders WHERE order_number = v_on_z;
  SELECT count(*), COALESCE(MAX(l.points), 0) INTO v_n, v_pts
    FROM public.points_ledger l
   WHERE l.order_id = v_eid AND l.entry_type = 'affiliate' AND l.points > 0;
  IF v_n <> 1 OR v_pts <> 30 THEN
    RAISE EXCEPTION 'G5 FAIL: expect 1 earn row of 30 (rows=%, pts=%)', v_n, v_pts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affiliate_attributions
                  WHERE order_id = v_eid AND state = 'qualified' AND qualified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'G5 FAIL: attribution should be qualified';
  END IF;
  SELECT count(*) INTO v_n FROM public.audit_logs WHERE action = 'affiliate_earn';
  IF v_n <> 1 THEN RAISE EXCEPTION 'G5 FAIL: expected 1 earn audit (got %)', v_n; END IF;
  -- re-fire (payment_status เปลี่ยน) = ห้ามมีแถวที่ 2
  UPDATE public.orders SET payment_status = 'paid' WHERE order_number = v_on_z;
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE order_id = v_eid AND entry_type = 'affiliate';
  IF v_n <> 1 THEN RAISE EXCEPTION 'G5 FAIL: duplicate earn after re-fire (%)', v_n; END IF;
  -- เรียก sync ตรง ๆ ซ้ำ = เขียน 0
  SELECT public.affiliate_sync_order(v_eid) INTO v_n;
  IF v_n <> 0 THEN RAISE EXCEPTION 'G5 FAIL: sync rerun should write 0 (got %)', v_n; END IF;
  -- ปิด policy แล้ว walk ออเดอร์ใหม่ = ไม่จ่าย (pending) → เปิดคืน = catch-up
  PERFORM public.c156_claims(v_uid_adm::text);
  UPDATE public.business_settings SET value = value || '{"enabled":false}'::jsonb
   WHERE key = 'affiliate_policy';
  PERFORM public.c156_claims(v_uid_main::text);
  v_on_w := public.c156_make_order(v_uid_main, '0991560001');
  IF v_on_w IS NULL THEN RAISE EXCEPTION 'G5 FAIL: order W creation failed'; END IF;
  v_j := public.affiliate_claim(v_on_w, v_code2);
  PERFORM public.c156_claims(v_uid_adm::text);
  PERFORM public.c156_walk(v_on_w);
  SELECT id INTO v_eid FROM public.orders WHERE order_number = v_on_w;
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE order_id = v_eid AND entry_type = 'affiliate';
  IF v_n <> 0 THEN RAISE EXCEPTION 'G5 FAIL: disabled policy must not award (rows=%)', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affiliate_attributions WHERE order_id = v_eid AND state = 'pending') THEN
    RAISE EXCEPTION 'G5 FAIL: expect still pending while disabled';
  END IF;
  UPDATE public.business_settings SET value = value || '{"enabled":true}'::jsonb
   WHERE key = 'affiliate_policy';
  UPDATE public.orders SET payment_status = 'paid' WHERE order_number = v_on_w;  -- re-fire = catch-up
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE order_id = v_eid AND entry_type = 'affiliate';
  IF v_n <> 1 THEN RAISE EXCEPTION 'G5 FAIL: catch-up after re-enable failed (rows=%)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.audit_logs WHERE action = 'affiliate_earn';
  IF v_n <> 2 THEN RAISE EXCEPTION 'G5 FAIL: expected 2 earn audits (got %)', v_n; END IF;
  RAISE NOTICE 'G5 PASS (qualify +30 once + audit · idempotent · disabled=wait · re-enable catch-up)';

  -- ===== G6: cap รายเดือนบล็อก · ยกเลิกหลังได้ → กลับครั้งเดียว · sync ซ้ำนิ่ง =====
  -- creator มีไปแล้ว 60 (Z+W) — ตั้ง cap 40 → ออเดอร์ถัดไปต้องติดเพดาน (fail-closed)
  PERFORM public.c156_claims(v_uid_adm::text);
  UPDATE public.business_settings SET value = value || '{"monthly_cap":40}'::jsonb
   WHERE key = 'affiliate_policy';
  PERFORM public.c156_claims(v_uid_main::text);
  v_on_v := public.c156_make_order(v_uid_main, '0991560001');
  IF v_on_v IS NULL THEN RAISE EXCEPTION 'G6 FAIL: order V creation failed'; END IF;
  v_j := public.affiliate_claim(v_on_v, v_code2);
  PERFORM public.c156_claims(v_uid_adm::text);
  PERFORM public.c156_walk(v_on_v);
  SELECT id INTO v_eid FROM public.orders WHERE order_number = v_on_v;
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE order_id = v_eid AND entry_type = 'affiliate';
  IF v_n <> 0 THEN RAISE EXCEPTION 'G6 FAIL: cap must block award (rows=%)', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affiliate_attributions WHERE order_id = v_eid AND state = 'pending') THEN
    RAISE EXCEPTION 'G6 FAIL: capped order should stay pending';
  END IF;
  -- ปรับ cap ขึ้น → ปลดบล็อก (แอดมินคุมได้จริง)
  UPDATE public.business_settings SET value = value || '{"monthly_cap":500}'::jsonb
   WHERE key = 'affiliate_policy';
  UPDATE public.orders SET payment_status = 'paid' WHERE order_number = v_on_v;
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE order_id = v_eid AND entry_type = 'affiliate';
  IF v_n <> 1 THEN RAISE EXCEPTION 'G6 FAIL: cap raise should release award (rows=%)', v_n; END IF;
  -- คืนเงินออเดอร์ Z (เคยได้ 30) → กลับ 30 ครั้งเดียว · ซ้ำ = นิ่ง
  -- (เส้นทาง refund แทน cancel — state machine ไม่ให้ delivered → cancelled · บทเรียน 155 G7)
  SELECT id INTO v_eid FROM public.orders WHERE order_number = v_on_z;
  UPDATE public.orders SET payment_status = 'refund' WHERE order_number = v_on_z;
  SELECT count(*), COALESCE(-SUM(l.points), 0) INTO v_n, v_rec
    FROM public.points_ledger l
   WHERE l.order_id = v_eid AND l.entry_type = 'affiliate' AND l.points < 0;
  IF v_n <> 1 OR v_rec <> 30 THEN
    RAISE EXCEPTION 'G6 FAIL: expect single -30 reversal (rows=%, rec=%)', v_n, v_rec;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affiliate_attributions
                  WHERE order_id = v_eid AND state = 'reversed' AND reversed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'G6 FAIL: attribution should be reversed';
  END IF;
  UPDATE public.orders SET subtotal = subtotal WHERE order_number = v_on_z;  -- re-fire
  SELECT public.affiliate_sync_order(v_eid) INTO v_n;
  IF v_n <> 0 THEN RAISE EXCEPTION 'G6 FAIL: sync after reversed should write 0 (got %)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.points_ledger WHERE order_id = v_eid AND entry_type = 'affiliate';
  IF v_n <> 2 THEN RAISE EXCEPTION 'G6 FAIL: expect earn+reverse only (rows=%)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.audit_logs WHERE action = 'affiliate_reverse';
  IF v_n <> 1 THEN RAISE EXCEPTION 'G6 FAIL: expected 1 reverse audit (got %)', v_n; END IF;
  RAISE NOTICE 'G6 PASS (cap block + admin release · refund reversal once · rerun stable)';

  -- ===== G7: admin gates — stats ทุกตัว = non-admin ถูกกัน · anon ถูกกัน · admin ได้ครบ =====
  PERFORM public.c156_claims(v_uid_main::text);
  BEGIN
    v_j := public.spin_admin_stats();
    RAISE EXCEPTION 'G7 FAIL: non-admin must not read spin_admin_stats';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.affiliate_admin_stats();
    RAISE EXCEPTION 'G7 FAIL: non-admin must not read affiliate_admin_stats';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  EXECUTE 'SET ROLE anon';
  BEGIN
    v_j := public.spin_admin_stats();
    RAISE EXCEPTION 'G7 FAIL: anon must not exec spin_admin_stats';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.affiliate_my_code();
    RAISE EXCEPTION 'G7 FAIL: anon must not exec affiliate_my_code';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM public.c156_claims(v_uid_adm::text);
  v_j := public.spin_admin_stats();
  IF (v_j->'policy'->>'enabled')::boolean IS DISTINCT FROM true
     OR (v_j->>'spins_today')::int <> 2
     OR (v_j->>'points_this_month')::int <> 20
     OR jsonb_typeof(v_j->'recent') <> 'array' THEN
    RAISE EXCEPTION 'G7 FAIL: spin_admin_stats wrong (%)', v_j;
  END IF;
  v_j := public.affiliate_admin_stats();
  IF (v_j->'policy'->>'enabled')::boolean IS DISTINCT FROM true
     OR (v_j->>'codes_active')::int <> 2
     OR (v_j->'attributions'->>'qualified')::int <> 2   -- W + V
     OR (v_j->'attributions'->>'reversed')::int <> 1    -- Z (คืนเงิน)
     OR (v_j->'attributions'->>'pending')::int <> 1     -- X (ผูกไว้ตอน policy ยังปิด ไม่เคยเดิน)
     OR (v_j->>'points_total')::int <> 60               -- (30+30) จาก W+V · Z ได้ 30 แล้วกลับ 30 = 0
     OR jsonb_typeof(v_j->'recent') <> 'array' THEN
    RAISE EXCEPTION 'G7 FAIL: affiliate_admin_stats wrong (%)', v_j;
  END IF;
  RAISE NOTICE 'G7 PASS (admin gates + spin/affiliate stats complete)';

  -- ===== G8: ledger invariants — append-only · role deny · constraints ยังเข้มเหมือน 155 =====
  SELECT id INTO v_eid FROM public.orders WHERE order_number = v_on_z;
  BEGIN
    UPDATE public.points_ledger SET points = 999 WHERE entry_type = 'affiliate' AND order_id = v_eid;
    RAISE EXCEPTION 'G8 FAIL: UPDATE must be blocked by append-only guard';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_LEDGER_APPEND_ONLY%' THEN RAISE; END IF;
  END;
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    DELETE FROM public.points_ledger WHERE entry_type = 'spin';
    RAISE EXCEPTION 'G8 FAIL: authenticated must not delete ledger';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.points_ledger SET points = 1 WHERE entry_type = 'spin';
    RAISE EXCEPTION 'G8 FAIL: authenticated must not update ledger';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  BEGIN
    INSERT INTO public.points_ledger (id, customer_id, points, entry_type, reason)
    VALUES ('g156-bogus', v_uid_main::text, 5, 'bogus_type', 'x');
    RAISE EXCEPTION 'G8 FAIL: invalid entry_type must be blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%points_ledger_entry_type_check%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.points_ledger (id, customer_id, points, entry_type, reason)
    VALUES ('g156-zero-spin', v_uid_main::text, 0, 'spin', 'x');
    RAISE EXCEPTION 'G8 FAIL: zero-point spin must be blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%points_ledger%' OR SQLERRM NOT LIKE '%check%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.points_ledger (id, customer_id, points, entry_type, order_id, reason)
    VALUES ('g156-dup-purchase', v_uid_main::text, 7, 'purchase', v_eid, 'dup');
    INSERT INTO public.points_ledger (id, customer_id, points, entry_type, order_id, reason)
    VALUES ('g156-dup-purchase2', v_uid_main::text, 8, 'purchase', v_eid, 'dup2');
    RAISE EXCEPTION 'G8 FAIL: duplicate purchase must be blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%idx_points_ledger_order_purchase%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'G8 PASS (append-only + role deny + type/sign/unique constraints)';

  -- ===== G9: ZERO-FAKE — order-fn ไม่ถูกแตะ · ไม่มีช่องเงินสดใน policy · ซ่อนรายการปิด =====
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'create_order_with_items'
                AND (p.prosrc LIKE '%affiliate%' OR p.prosrc LIKE '%spin_reward%'
                     OR p.prosrc LIKE '%loyalty%' OR p.prosrc LIKE '%rewards_catalog%')) THEN
    RAISE EXCEPTION 'G9 FAIL: create_order_with_items must stay untouched';
  END IF;
  -- นโยบาย affiliate = ไม่มีช่องเงินสดใด ๆ (§4.1 ข้อ 5 — จ่ายเป็นแต้มเท่านั้น)
  SELECT value INTO v_arr FROM public.business_settings WHERE key = 'affiliate_policy';
  IF v_arr ? 'cash' OR v_arr ? 'payout' OR v_arr ? 'commission_percent'
     OR v_arr ? 'money_per_order' OR v_arr ? 'transfer' THEN
    RAISE EXCEPTION 'G9 FAIL: no cash fields allowed in affiliate_policy (%)', v_arr;
  END IF;
  FOREACH v_txt IN ARRAY ARRAY['enabled','points_per_qualified_order','monthly_cap','qualify_status'] LOOP
    IF NOT (v_arr ? v_txt) THEN RAISE EXCEPTION 'G9 FAIL: affiliate_policy key % missing', v_txt; END IF;
  END LOOP;
  -- catalog: is_active=false ถูกซ่อนจากหน้าลูกค้า
  PERFORM public.c156_claims(v_uid_adm::text);
  INSERT INTO public.rewards_catalog (id, name, description, points_cost, is_active, sort_order)
  VALUES ('rw156-hidden', 'รายการปิด', '', 10, false, 99)
  ON CONFLICT (id) DO UPDATE SET is_active = false;
  PERFORM public.c156_claims(v_uid_main::text);
  v_arr := public.rewards_catalog_list();
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_arr) e WHERE e->>'id' = 'rw156-hidden') THEN
    RAISE EXCEPTION 'G9 FAIL: inactive item must be hidden (%)', v_arr;
  END IF;
  PERFORM public.c156_claims(v_uid_adm::text);
  DELETE FROM public.rewards_catalog WHERE id = 'rw156-hidden';
  RAISE NOTICE 'G9 PASS (order-fn untouched · no cash fields · inactive hidden)';
  RAISE NOTICE 'CONTRACT 156: PASS';
END $$;

ROLLBACK;