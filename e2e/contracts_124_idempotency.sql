-- ============================================================
-- Bite Me Baby — WAVE 5A SQL Contract: order-submit idempotency (124)
-- ONE transaction, ROLLBACKs at the end — zero persisted data.
-- รันบน isolated/CI DB เท่านั้น (ห้าม production)
-- Matrix:
--   T1  first request (key)        → exactly one order created
--   T2  same key + same payload    → SAME order_number, no new order
--   T3  same key + changed payload → ERR_IDEMPOTENCY_CONFLICT
--   T4  same key + other ownership → ERR_IDEMPOTENCY_CONFLICT (ไม่เปิดเผยข้อมูล)
--   T5  different keys             → independent orders
--   T6  legacy caller (no key)     → original function unchanged (compat)
--   T7  failed txn + key → retry   → no partial row; retry creates exactly once;
--                                    replay after that returns same number
--   T8  retry basis                → stored result->>'order_number' == created
--                                    (ไม่มี order ที่สอง = ไม่มีฐานของ intent ซ้ำ)
--   T9  order_number UNIQUE        → index ยังอยู่ครบ
--   T10 unauthorized replay        → conflict, ไม่ leak เลขออเดอร์ของผู้อื่น
--   T11 definitions                → wrapper มี p_client_submit_key + ครบ 18 args · original ไม่มี key
--   T13 direct-table access       → authenticated อ่าน order_submissions ตรง ๆ ไม่ได้
-- ============================================================
BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'ph1-124-a@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('b2222222-2222-2222-2222-222222222222', 'ph1-124-b@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', same_day_cutoff = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date;
UPDATE public.products SET is_available = true, available_same_day = true WHERE id = 'prod-1';
CREATE FUNCTION pg_temp.c_orders() RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT count(*) FROM public.orders $$;
CREATE FUNCTION pg_temp.c_subs(k text) RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT count(*) FROM public.order_submissions WHERE ($1 IS NULL OR client_submit_key = $1) $$;
CREATE FUNCTION pg_temp.c_phone(ph text) RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT count(*) FROM public.orders WHERE customer_phone = $1 $$;
CREATE FUNCTION pg_temp.sub_num(k text) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT result->>'order_number' FROM public.order_submissions WHERE client_submit_key = $1 $$;
CREATE FUNCTION pg_temp.c_pint(ph text) RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT count(*) FROM public.payment_intents pi JOIN public.orders o ON o.order_number = pi.order_number WHERE o.customer_phone = $1 $$;

DO $$
DECLARE
  v_base_orders int;
  v_r jsonb;
  v_n1 text;
  v_n2 text;
  v_ok text;
  v_lat numeric;
  v_lon numeric;
  v_round text := (SELECT id FROM public.delivery_rounds
                    WHERE scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date
                      AND status = 'active' LIMIT 1);
  v_items jsonb := '[{"product_id":"prod-1","quantity":1,"options":{},"special_request":null}]'::jsonb;
  v_items2 jsonb := '[{"product_id":"prod-1","quantity":2,"options":{},"special_request":null}]'::jsonb;
BEGIN
  ASSERT v_round IS NOT NULL, 'fixture: active SAME_DAY round missing';
  v_base_orders := pg_temp.c_orders();
  -- dropoff fixture = kitchen จริงใน DB + 0.002° (~0.3 กม. — อยู่ใน radius 5 กม.
  -- และ zone 0-5 กม.) — fixture เดิม (กทม. 13.7563,100.5018) ห่าง fallback
  -- kitchen (จันทบุรี 10.7016,102.1429) 383.63 กม. → SELF_DELIVERY_EXCEEDS_5KM_LIMIT
  v_lat := (public.kitchen_location()->>'latitude')::numeric + 0.002;
  v_lon := (public.kitchen_location()->>'longitude')::numeric + 0.002;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

  -- T1: first request with key → exactly one order
  v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T1');
  -- 118 ไม่มีคีย์ 'ok' — สำเร็จ = มี order_number (result shape จริง: duplicate=false)
  ASSERT v_r->>'order_number' IS NOT NULL, 'T1 expected order_number, got: ' || v_r::text;
  v_n1 := v_r->>'order_number';
  ASSERT v_n1 IS NOT NULL, 'T1 order_number missing';
  ASSERT pg_temp.c_orders() = v_base_orders + 1, 'T1 must create exactly one order';
  ASSERT pg_temp.c_subs('CK-T1') = 1, 'T1 submission row';

  -- T2: same key + same payload → same order, no new order
  v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T1');
  ASSERT (v_r->>'order_number') = v_n1, 'T2 replay must return the SAME order_number';
  ASSERT pg_temp.c_orders() = v_base_orders + 1, 'T2 must not create a second order';
  ASSERT pg_temp.c_subs(NULL) = 1, 'T2 submission count unchanged';

  -- T13: ?????????????? order_submissions ??? ? (REVOKE ALL + RLS ????? policy)
  BEGIN
    PERFORM set_config('role','authenticated',false);
    PERFORM (SELECT count(*) FROM public.order_submissions);
    RAISE EXCEPTION 'T13 expected insufficient_privilege';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- T3: same key + changed payload → rejected
  BEGIN
    PERFORM public.create_order_with_items_i(v_items2, v_round, 'self_delivery', '', v_lat, v_lon,
      'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T1');
    RAISE EXCEPTION 'T3 expected idempotency conflict';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T3 got: ' || SQLERRM;
    ASSERT SQLERRM NOT LIKE '%' || v_n1 || '%', 'T3 leaked order number';
  END;
  ASSERT pg_temp.c_orders() = v_base_orders + 1, 'T3 must not create order';

  -- T4: same key + different ownership → rejected (no data of the other party)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  BEGIN
    PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'Other', '0999999999', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T1');
    RAISE EXCEPTION 'T4 expected idempotency conflict';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T4 got: ' || SQLERRM;
    ASSERT SQLERRM NOT LIKE '%' || v_n1 || '%', 'T4 leaked the other order number';
  END;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

  -- T5: different keys → independent orders
  v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T5');
  ASSERT (v_r->>'order_number') IS NOT NULL AND (v_r->>'order_number') <> v_n1, 'T5 must create a distinct order';
  ASSERT pg_temp.c_orders() = v_base_orders + 2, 'T5 order count';

  -- T6: legacy caller (original function, no key) → compatibility contract unchanged
  v_r := public.create_order_with_items(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL);
  ASSERT v_r->>'order_number' IS NOT NULL, 'T6 legacy call failed';
  ASSERT pg_temp.c_orders() = v_base_orders + 3, 'T6 legacy order count';
  ASSERT pg_temp.c_subs(NULL) = 2, 'T6 legacy must not write submissions';

  -- T7: failed transaction with key → nothing persisted → safe retry → exactly once
  PERFORM set_config('role','none',false); -- catalog edit = superuser (RLS admin-only)
  UPDATE public.products SET is_available = false WHERE id = 'prod-1';
  PERFORM set_config('role','authenticated',false);
  BEGIN
    PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T7');
    RAISE EXCEPTION 'T7 expected product unavailable';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_PRODUCT_UNAVAILABLE%', 'T7 got: ' || SQLERRM;
  END;
  ASSERT pg_temp.c_subs('CK-T7') = 0,
    'T7 failed txn must leave no partial submission row';
  ASSERT pg_temp.c_orders() = v_base_orders + 3, 'T7 failed txn must leave no order';
  PERFORM set_config('role','none',false);
  UPDATE public.products SET is_available = true WHERE id = 'prod-1';
  PERFORM set_config('role','authenticated',false);
  v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T7');
  ASSERT v_r->>'order_number' IS NOT NULL, 'T7 retry failed';
  v_n2 := v_r->>'order_number';
  ASSERT pg_temp.c_orders() = v_base_orders + 4, 'T7 retry must create exactly one order';
  v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T7');
  ASSERT (v_r->>'order_number') = v_n2, 'T7 replay number';
  ASSERT pg_temp.c_orders() = v_base_orders + 4, 'T7 replay must not create order';

  -- T8: duplicate retry cannot double payment intents — replay source is the SAME
  -- order_number (client สร้าง intent ต่อ order_number ใหม่เท่านั้น; ไม่มี order ที่สอง
  -- = ไม่มีฐานสร้าง intent ซ้ำ) และ result เก็บฉบับเต็ม (อ่านผ่าน pg_temp helper —
  -- order_submissions ปิด RLS/REVOKE ทุก role รวม authenticated)
  ASSERT pg_temp.sub_num('CK-T1') = v_n1,
    'T8 stored replay result mismatch';
  ASSERT pg_temp.c_phone('0900000000') = 4,
    'T8 unexpected order count for phone';
  -- T8b: submit/replay ไม่แตะ payment_intents เลย — ไม่มี intent/charge ซ้ำที่มาจาก
  -- การ submit ซ้ำ (intent สร้างโดย RPC แยกต่อ order_number; ไม่มี order ที่สอง =
  -- ไม่มีฐานสร้างซ้ำ · การชาร์จจริงอยู่นอก isolated tier)
  ASSERT pg_temp.c_pint('0900000000') = 0,
    'T8b replay must not create payment intents';

  -- T9: order_number uniqueness index ยังคงอยู่
  ASSERT (SELECT count(*) FROM pg_indexes
           WHERE tablename = 'orders' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%order_number%') >= 1,
    'T9 order_number UNIQUE index missing';

  -- T10: unauthorized replay (other user, same key) → conflict, ไม่ leak
  PERFORM set_config('request.jwt.claims',
    '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  BEGIN
    PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'Other', '0999999999', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T1');
    RAISE EXCEPTION 'T10 expected idempotency conflict';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T10 got: ' || SQLERRM;
    ASSERT SQLERRM NOT LIKE '%' || v_n1 || '%', 'T10 leaked order number';
  END;

  -- T11: definitions match the intended contract
  ASSERT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'create_order_with_items_i'
             AND pg_get_function_identity_arguments(p.oid) LIKE '%p_client_submit_key%') = 1,
    'T11 wrapper missing p_client_submit_key';
  ASSERT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'create_order_with_items'
             AND pg_get_function_identity_arguments(p.oid) LIKE '%p_client_submit_key%') = 0,
    'T11 original must stay key-less (no key param leaked into original name)';
  -- T11b: wrapper ต้องครอบคลุม signature 18 ตัวปัจจุบัน (branch/channel/ref)
  ASSERT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'create_order_with_items_i'
             AND pg_get_function_identity_arguments(p.oid) LIKE '%p_branch_id%'
             AND pg_get_function_identity_arguments(p.oid) LIKE '%p_customer_ref%'
             AND pg_get_function_identity_arguments(p.oid) LIKE '%p_client_submit_key%') = 1,
    'T11b wrapper must cover the current 18-arg signature + key';
  -- ============ W5C (2026-10-14) — Owner-approved R1/R2/R3 + T14-T18/R7/R8/R13/R14 ============
  -- T17/T18 = characterization ของ composite owner_key (ทางเลือก ข): false conflict
  --   ข้าม shape "ยังอยู่" ตามสัญญา — ACCEPTED+DOCUMENTED ไม่ใช่ FIXED (การแก้ comment
  --   ไม่ใช่การแก้พฤติกรรม) · ถ้า Owner เลือก (ก) ให้ flip คาดหวังใน T17/T18
  -- ทุกเคส snapshot ฐานเอง (v_mark/v_smark) — ไม่แตะ offset ของ T1-T13 เดิม
  DECLARE
    v_mark int;
    v_smark bigint;
    v_bad text;
    v_n3 text;
    v_n4 text;
  BEGIN
    v_mark := pg_temp.c_orders();
    v_smark := pg_temp.c_subs(NULL);
    PERFORM set_config('role', 'authenticated', false);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

    -- T2b [W5C R3]: เปลี่ยนสถานะแล้ว replay → identity เดิม + สถานะปัจจุบัน + ไม่ mutate
    -- (ใช้ trusted sync context แบบ 036 + allow-list 030 adjacency chain)
    PERFORM set_config('role', 'none', false);
    UPDATE public.inventory SET current_stock = GREATEST(current_stock, 99999); -- fixture: confirmed หักสต๊อกตาม design
    PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false); -- server-side: guard_profile_mutation ให้ service เปลี่ยน role
    UPDATE public.profiles SET role = 'admin' WHERE id = 'dddf4b57-405f-4852-a985-76d8d52b1b72'; -- fixture: is_admin() ต้องผ่าน (deduct inventory เป็น admin-only)
    PERFORM set_config('request.jwt.claims',
      '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', false); -- admin fixture สำหรับ trigger ฝั่ง inventory
    PERFORM set_config('app.delivery_sync_order', v_n1, true);
    UPDATE public.orders SET status = 'confirmed' WHERE order_number = v_n1;
    UPDATE public.orders SET status = 'preparing' WHERE order_number = v_n1;
    PERFORM set_config('app.delivery_sync_order', '', true);
    PERFORM set_config('role', 'authenticated', false);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T1');
    ASSERT (v_r->>'order_number') = v_n1, 'T2b identity must be preserved';
    ASSERT v_r->>'replay' = 'true', 'T2b replay marker';
    ASSERT v_r->>'status' = 'preparing', 'T2b current status, got: ' || (v_r->>'status');
    ASSERT v_r->>'payment_status' = 'pending', 'T2b current payment_status';
    ASSERT pg_temp.c_orders() = v_mark, 'T2b replay must not create order';
    ASSERT (SELECT status::text FROM public.orders WHERE order_number = v_n1) = 'preparing',
      'T2b replay must not mutate status';

    PERFORM set_config('role', 'none', false);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', false);
    PERFORM set_config('app.delivery_sync_order', v_n1, true);
    UPDATE public.orders SET status = 'ready_for_dispatch' WHERE order_number = v_n1;
    UPDATE public.orders SET status = 'dispatched' WHERE order_number = v_n1;
    UPDATE public.orders SET status = 'in_transit' WHERE order_number = v_n1;
    UPDATE public.orders SET status = 'arrived' WHERE order_number = v_n1;
    UPDATE public.orders SET status = 'delivered', payment_status = 'paid' WHERE order_number = v_n1;
    PERFORM set_config('app.delivery_sync_order', '', true);
    PERFORM set_config('role', 'authenticated', false);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T1');
    ASSERT (v_r->>'order_number') = v_n1 AND v_r->>'replay' = 'true', 'T2b delivered replay identity';
    ASSERT v_r->>'status' = 'delivered' AND v_r->>'payment_status' = 'paid', 'T2b delivered/paid current state';
    ASSERT pg_temp.c_orders() = v_mark, 'T2b delivered replay must not create order';
    ASSERT pg_temp.c_pint('0900000000') = 0, 'T2b replay must not create payment intents';

    -- cancelled (order ใหม่ — แยกเคส)
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T2bC', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T2B');
    v_n3 := v_r->>'order_number';
    ASSERT v_n3 IS NOT NULL, 'T2b cancelled: create failed';
    PERFORM set_config('role', 'none', false);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', false);
    PERFORM set_config('app.delivery_sync_order', v_n3, true);
    UPDATE public.orders SET status = 'cancelled' WHERE order_number = v_n3;
    PERFORM set_config('app.delivery_sync_order', '', true);
    PERFORM set_config('role', 'authenticated', false);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T2bC', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T2B');
    ASSERT v_r->>'status' = 'cancelled', 'T2b cancelled current status';
    ASSERT v_r->>'replay' = 'true' AND (v_r->>'order_number') = v_n3, 'T2b cancelled replay';
    ASSERT pg_temp.c_orders() = v_mark + 1, 'T2b cancelled: exactly the one create';

    -- T3b [W5C R1+]: ตัวเลขค่าเท่ากันต่าง scale (1.000/0.0/trailing zero) → replay
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T3b', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1');
    v_n3 := v_r->>'order_number';
    ASSERT v_n3 IS NOT NULL, 'T3b create failed';
    v_r := public.create_order_with_items_i(
      '[{"product_id":"prod-1","quantity":1.000,"options":{},"special_request":null}]'::jsonb,
      v_round, 'self_delivery', '', v_lat + 0.00000, v_lon + 0.00000,
      'T3b', '0900000000', 'cash_on_delivery', '', NULL, 0.0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1');
    ASSERT (v_r->>'order_number') = v_n3, 'T3b numeric-scale variants must replay (R1)';
    ASSERT v_r->>'replay' = 'true', 'T3b replay marker';
    ASSERT pg_temp.c_orders() = v_mark + 2, 'T3b replay must not create order';

    -- T3c [W5C R1-]: ข้อมูลธุรกิจเปลี่ยน (qty/dist/round/special) → conflict ตามสัญญา
    BEGIN
      PERFORM public.create_order_with_items_i(v_items2, v_round, 'self_delivery', '', v_lat, v_lon,
        'T3b', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1');
      RAISE EXCEPTION 'T3c expected conflict (quantity change)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T3c qty: ' || SQLERRM;
    END;
    BEGIN
      PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
        'T3b', '0900000000', 'cash_on_delivery', '', NULL, 5, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1');
      RAISE EXCEPTION 'T3c expected conflict (distance change)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T3c dist: ' || SQLERRM;
    END;
    BEGIN
      PERFORM public.create_order_with_items_i(v_items, 'other-round-x', 'self_delivery', '', v_lat, v_lon,
        'T3b', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1');
      RAISE EXCEPTION 'T3c expected conflict (round change)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T3c round: ' || SQLERRM;
    END;
    BEGIN
      PERFORM public.create_order_with_items_i(
        '[{"product_id":"prod-1","quantity":1,"options":{},"special_request":"changed"}]'::jsonb,
        v_round, 'self_delivery', '', v_lat, v_lon,
        'T3b', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1');
      RAISE EXCEPTION 'T3c expected conflict (special_request change)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T3c special: ' || SQLERRM;
    END;
    ASSERT pg_temp.c_orders() = v_mark + 2, 'T3c conflicts must not create orders';
    -- T5b [W5C R2]: btrim key — padded retry map เดิม · ไม่เก็บ key ดิบ
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T5b', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, '  CK-PAD  ');
    v_n3 := v_r->>'order_number';
    ASSERT v_n3 IS NOT NULL, 'T5b create failed';
    ASSERT pg_temp.sub_num('CK-PAD') = v_n3, 'T5b trimmed key must be stored (R2)';
    ASSERT pg_temp.sub_num('  CK-PAD  ') IS NULL, 'T5b raw padded key must not exist (R2)';
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T5b', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, ' CK-PAD');
    ASSERT (v_r->>'order_number') = v_n3 AND v_r->>'replay' = 'true', 'T5b padded retry must replay (R2)';
    ASSERT pg_temp.c_orders() = v_mark + 3, 'T5b replay must not create order';

    -- T5c [W5C R2]: invalid keys fail closed (ว่างหลัง trim / control char / ยาว > 128)
    FOREACH v_bad IN ARRAY ARRAY['', '   ', E'bad\tkey', repeat('x', 129)] LOOP
      BEGIN
        PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
          'T5c', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, v_bad);
        RAISE EXCEPTION 'T5c expected ERR_IDEMPOTENCY_KEY_INVALID';
      EXCEPTION WHEN raise_exception THEN
        ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_KEY_INVALID%', 'T5c(len=' || length(v_bad) || '): ' || SQLERRM;
      END;
    END LOOP;
    -- boundary: 128 chars ต้องผ่าน (cap = 128)
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T5c', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, repeat('k', 128));
    ASSERT v_r->>'order_number' IS NOT NULL, 'T5c 128-char key must be accepted (cap boundary)';
    ASSERT pg_temp.c_orders() = v_mark + 4, 'T5c invalid keys must not create orders (only the boundary key)';

    -- T5d [W5C R2]: case-sensitive — 'ck-a' ≠ 'ck-A' (ห้าม normalize ตัวพิมพ์)
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T5d', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'ck-a');
    v_n3 := v_r->>'order_number';
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T5d', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'ck-A');
    v_n4 := v_r->>'order_number';
    ASSERT v_n3 <> v_n4, 'T5d case-sensitive keys must map to distinct orders';
    ASSERT pg_temp.c_orders() = v_mark + 6, 'T5d two distinct orders';

    -- T6b: _i กับ key=NULL → legacy passthrough ไม่เขียน order_submissions
    v_smark := pg_temp.c_subs(NULL); -- baseline ณ จุดเรียก (T2b-T5d เขียนไปแล้ว — ต้องไม่เพิ่มอีก)
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T6b', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, NULL);
    ASSERT v_r->>'order_number' IS NOT NULL, 'T6b _i NULL-key passthrough failed';
    ASSERT v_r->>'duplicate' = 'false', 'T6b must return original success shape';
    ASSERT pg_temp.c_subs(NULL) = v_smark, 'T6b legacy path must not write submissions';
    ASSERT pg_temp.c_orders() = v_mark + 7, 'T6b legacy creates exactly one order';
    -- T14 [reduced duplicate shape persist + replay] ≡ R7c — 118:78 extref durable guard
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T14', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, 'LINE', 'EXT-14', NULL, 'CK-T14');
    v_n3 := v_r->>'order_number';
    ASSERT v_n3 IS NOT NULL AND v_r->>'duplicate' = 'false', 'T14 first create';
    -- R7a: same key + same extref → replay
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T14', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, 'LINE', 'EXT-14', NULL, 'CK-T14');
    ASSERT (v_r->>'order_number') = v_n3 AND v_r->>'replay' = 'true', 'R7a same-key same-extref replay';
    -- R7b: same key + different extref → conflict
    BEGIN
      PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
        'T14', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, 'LINE', 'EXT-14B', NULL, 'CK-T14');
      RAISE EXCEPTION 'R7b expected conflict (extref change)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'R7b: ' || SQLERRM;
    END;
    -- T14: NEW key + SAME extref → 118 คืน reduced duplicate:true → persist ใต้ key ใหม่
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T14', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, 'LINE', 'EXT-14', NULL, 'CK-T14B');
    ASSERT v_r->>'duplicate' = 'true', 'T14 reduced duplicate shape expected';
    ASSERT (v_r->>'order_number') = v_n3, 'T14 duplicate must point to the original order';
    ASSERT pg_temp.sub_num('CK-T14B') = v_n3, 'T14 reduced result must persist (has order_number)';
    ASSERT pg_temp.c_orders() = v_mark + 8, 'T14 must not create a second order';
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T14', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, 'LINE', 'EXT-14', NULL, 'CK-T14B');
    ASSERT v_r->>'replay' = 'true' AND (v_r->>'order_number') = v_n3, 'T14 replay of reduced result';
    ASSERT v_r->>'status' = 'pending', 'T14 replay carries current canonical status';

    -- T15: failed result ไม่ persist → retry ดีสร้างครั้งเดียว → replay ได้
    BEGIN
      PERFORM public.create_order_with_items_i('[]'::jsonb, v_round, 'self_delivery', '', v_lat, v_lon,
        'T15', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T15');
      RAISE EXCEPTION 'T15 expected ERR_EMPTY_ORDER';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_EMPTY_ORDER%', 'T15 got: ' || SQLERRM;
    END;
    ASSERT pg_temp.c_subs('CK-T15') = 0, 'T15 failed result must not persist';
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T15', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T15');
    v_n3 := v_r->>'order_number';
    ASSERT v_n3 IS NOT NULL, 'T15 retry must succeed';
    ASSERT pg_temp.c_orders() = v_mark + 9, 'T15 retry creates exactly one order';
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T15', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T15');
    ASSERT v_r->>'replay' = 'true' AND (v_r->>'order_number') = v_n3, 'T15 replay after recovery';

    -- T16: CHECK os_result_has_order — [remediation 2026-10-14] matrix เข้มงวดชนิด:
    --   result = JSON object · order_number = JSON string · trim ไม่ว่าง · expression = TRUE ชัด ๆ
    PERFORM set_config('role', 'none', false);
    -- T16-1: ไม่มี key order_number เลย
    BEGIN
      INSERT INTO public.order_submissions (client_submit_key, owner_key, payload_fingerprint, result, order_number)
      VALUES ('CK-T16', 'x|y', 'fp-t16', '{"no_order": true}'::jsonb, 'T16-ORPHAN');
      RAISE EXCEPTION 'T16-1 expected check_violation';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- T16-2: order_number: null — ของเดิมรอด (btrim(NULL) <> '' = NULL → CHECK ผ่าน) = bug ที่ปิดแล้ว
    BEGIN
      INSERT INTO public.order_submissions (client_submit_key, owner_key, payload_fingerprint, result, order_number)
      VALUES ('CK-T16N', 'x|y', 'fp-t16n', '{"order_number": null}'::jsonb, 'T16-NULL');
      RAISE EXCEPTION 'T16-2 expected check_violation (order_number: null)';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- T16-3: order_number: "" / whitespace-only
    BEGIN
      INSERT INTO public.order_submissions (client_submit_key, owner_key, payload_fingerprint, result, order_number)
      VALUES ('CK-T16E', 'x|y', 'fp-t16e', '{"order_number": ""}'::jsonb, 'T16-EMPTY');
      RAISE EXCEPTION 'T16-3 expected check_violation (empty string)';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.order_submissions (client_submit_key, owner_key, payload_fingerprint, result, order_number)
      VALUES ('CK-T16W', 'x|y', 'fp-t16w', '{"order_number": "   "}'::jsonb, 'T16-WS');
      RAISE EXCEPTION 'T16-3 expected check_violation (whitespace-only)';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- T16-4: order_number ไม่ใช่ JSON string (number / boolean / object / array)
    FOREACH v_bad IN ARRAY ARRAY['{"order_number": 123}', '{"order_number": true}',
                                 '{"order_number": {"a": 1}}', '{"order_number": ["BMB-1"]}'] LOOP
      BEGIN
        INSERT INTO public.order_submissions (client_submit_key, owner_key, payload_fingerprint, result, order_number)
        VALUES ('CK-T16T', 'x|y', 'fp-t16t', v_bad::jsonb, 'T16-TYPE');
        RAISE EXCEPTION 'T16-4 expected check_violation (non-string): %', v_bad;
      EXCEPTION WHEN check_violation THEN NULL;
      END;
    END LOOP;
    -- T16-5: valid non-empty string (มี padding — trim แล้วไม่ว่าง) ต้องผ่าน
    INSERT INTO public.order_submissions (client_submit_key, owner_key, payload_fingerprint, result, order_number)
    VALUES ('CK-T16OK', 'x|y', 'fp-t16ok', '{"order_number": " T16-OK-ORDER  "}'::jsonb, 'T16-OK');
    ASSERT (SELECT count(*) FROM public.order_submissions WHERE client_submit_key = 'CK-T16OK') = 1,
      'T16-5 valid non-empty order_number must persist';
    ASSERT (SELECT count(*) FROM pg_constraint WHERE conname = 'os_result_has_order') = 1,
      'T16 os_result_has_order constraint missing';
    PERFORM set_config('role', 'authenticated', false);
    ASSERT pg_temp.c_subs('CK-T16') = 0 AND pg_temp.c_subs('CK-T16N') = 0
       AND pg_temp.c_subs('CK-T16E') = 0 AND pg_temp.c_subs('CK-T16W') = 0
       AND pg_temp.c_subs('CK-T16T') = 0,
      'T16 bad results must not persist';
    -- ==== T17/T18: owner_key composite (ทางเลือก ข) — false conflict ยังอยู่ตามสัญญา ====
    -- (ACCEPTED+DOCUMENTED — ไม่ใช่ FIXED · ถ้า Owner เลือก (ก) ให้ flip เคสเหล่านี้)
    v_n4 := 'a1111111-1111-1111-1111-111111111111';

    -- T17-b: (uid=X, cref=X) vs service (NULL, X) — same key → conflict + ไม่ leak
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T17', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL,
      'a1111111-1111-1111-1111-111111111111'::uuid, 'CK-T17');
    v_n3 := v_r->>'order_number';
    ASSERT v_n3 IS NOT NULL, 'T17-b create (auth+cref)';
    PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
    BEGIN
      PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
        'T17', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL,
        'a1111111-1111-1111-1111-111111111111'::uuid, 'CK-T17');
      RAISE EXCEPTION 'T17-b expected conflict (cross-shape)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T17-b: ' || SQLERRM;
      ASSERT SQLERRM NOT LIKE '%' || v_n3 || '%', 'T17-b leaked order number';
    END;

    -- R8 + T17-c/e: service-role path (NULL, X) — key ใหม่ สร้างได้ · same-shape replay ได้
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'R8', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL,
      'a1111111-1111-1111-1111-111111111111'::uuid, 'CK-T17E');
    v_n2 := v_r->>'order_number';
    ASSERT v_n2 IS NOT NULL, 'R8 service-role create must succeed';
    ASSERT pg_temp.sub_num('CK-T17E') = v_n2, 'R8 service submission persisted';
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'R8', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL,
      'a1111111-1111-1111-1111-111111111111'::uuid, 'CK-T17E');
    ASSERT (v_r->>'order_number') = v_n2 AND v_r->>'replay' = 'true', 'T17-c service same-shape replay';
    PERFORM set_config('request.jwt.claims',
      '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
    BEGIN
      PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
        'R8', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL,
        'a1111111-1111-1111-1111-111111111111'::uuid, 'CK-T17E');
      RAISE EXCEPTION 'T17-e expected conflict (reverse cross-shape)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T17-e: ' || SQLERRM;
      ASSERT SQLERRM NOT LIKE '%' || v_n2 || '%', 'T17-e leaked order number';
    END;

    -- T17-d: service (NULL, NULL) + key ใหม่ → ERR_NOT_AUTHENTICATED + ไม่ persist
    PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
    BEGIN
      PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
        'T17d', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T17D');
      RAISE EXCEPTION 'T17-d expected ERR_NOT_AUTHENTICATED';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_NOT_AUTHENTICATED%', 'T17-d: ' || SQLERRM;
    END;
    ASSERT pg_temp.c_subs('CK-T17D') = 0, 'T17-d must not persist';

    -- T18-d: service (NULL, X) vs service (NULL, NULL) เดิม key → conflict + ไม่ leak
    BEGIN
      PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
        'R8', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T17E');
      RAISE EXCEPTION 'T18-d expected conflict (service cref drop)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T18-d: ' || SQLERRM;
      ASSERT SQLERRM NOT LIKE '%' || v_n2 || '%', 'T18-d leaked order number';
    END;

    PERFORM set_config('request.jwt.claims',
      '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

    -- T18-a: (X, NULL) [web shape] vs (X, X) เดิม key → conflict + ไม่ leak
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T18', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T18');
    v_n3 := v_r->>'order_number';
    ASSERT v_n3 IS NOT NULL, 'T18-a create (web shape)';
    BEGIN
      PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
        'T18', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL,
        'a1111111-1111-1111-1111-111111111111'::uuid, 'CK-T18');
      RAISE EXCEPTION 'T18-a expected conflict (cref presence change)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T18-a: ' || SQLERRM;
      ASSERT SQLERRM NOT LIKE '%' || v_n3 || '%', 'T18-a leaked order number';
    END;

    -- T18-b: (X, X) vs (X, NULL) เดิม key → conflict (กลับทิศ)
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'T18b', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL,
      'a1111111-1111-1111-1111-111111111111'::uuid, 'CK-T18B');
    v_n3 := v_r->>'order_number';
    BEGIN
      PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
        'T18b', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-T18B');
      RAISE EXCEPTION 'T18-b expected conflict (reverse cref change)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T18-b: ' || SQLERRM;
      ASSERT SQLERRM NOT LIKE '%' || v_n3 || '%', 'T18-b leaked order number';
    END;

    -- T18-c: (X, Y≠X) + key ใหม่ → ERR_FORBIDDEN_CUSTOMER_REF + ไม่ persist
    BEGIN
      PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
        'T18c', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL,
        'b2222222-2222-2222-2222-222222222222'::uuid, 'CK-T18C');
      RAISE EXCEPTION 'T18-c expected ERR_FORBIDDEN_CUSTOMER_REF';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_FORBIDDEN_CUSTOMER_REF%', 'T18-c: ' || SQLERRM;
    END;
    ASSERT pg_temp.c_subs('CK-T18C') = 0, 'T18-c must not persist';

    -- R13: order ถูกลบ (CASCADE) แล้ว replay → identity เดิม + replay:true (ไม่พัง)
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'R13', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R13');
    v_n3 := v_r->>'order_number';
    ASSERT v_n3 IS NOT NULL, 'R13 create failed';
    PERFORM set_config('role', 'none', false);
    DELETE FROM public.orders WHERE order_number = v_n3; -- FKs ON DELETE CASCADE
    PERFORM set_config('role', 'authenticated', false);
    v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', v_lat, v_lon,
      'R13', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R13');
    ASSERT (v_r->>'order_number') = v_n3, 'R13 ghost replay must keep original identity';
    ASSERT v_r->>'replay' = 'true', 'R13 ghost replay marker';
    ASSERT pg_temp.c_orders() = v_mark + 13, 'R13 ghost replay must not recreate the order';
    ASSERT pg_temp.c_pint('0900000000') = 0, 'R13 replay must not create payment intents';
    -- [remediation 2026-10-14] R3 ghost contract: identity fields คงเดิม + สถานะ =
    -- stored snapshot (118:269-273 คืน status/payment_status 'pending') — ไม่มี live
    -- order ให้ merge → ห้ามปั้นสถานะใหม่ (และไม่สร้าง order/intent ใหม่ = asserts บน)
    ASSERT v_r->>'id' IS NOT NULL, 'R13 ghost replay must keep stored identity fields';
    ASSERT v_r->>'status' = 'pending', 'R13 ghost replay must keep stored snapshot status';
    ASSERT v_r->>'payment_status' = 'pending', 'R13 ghost replay must keep stored snapshot payment_status';

    -- ===== [remediation 2026-10-14] R1 nested canonicalization characterization =====
    -- (ไม่เปลี่ยน policy: array order / string / business values ต่าง → conflict ตามสัญญา)
    v_mark := pg_temp.c_orders(); -- rebaseline เฉพาะ section นี้ (อยู่หลัง R13 — ไม่แตะ offset เดิม)
    -- unit: helper ตรง ๆ (as session user — helper REVOKE ทุก role ภายนอก)
    PERFORM set_config('role', 'none', false);
    ASSERT public.order_submit_canonical_jsonb('{"a": [1.00, {"b": 2.500}, "3.00"], "c": 0.0}'::jsonb)
           = '{"a": [1, {"b": 2.5}, "3.00"], "c": 0}'::jsonb,
      'R1 unit nested canonicalization (numbers only, strings untouched)';
    PERFORM set_config('role', 'authenticated', false);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
    -- T3d: nested object/array + trailing zeros ลึก → canonical เดียวกัน → replay
    -- (หมายเหตุ: create call ใช้ quantity=1 เพราะ 118:119 แคสท์ quantity เป็น int —
    --  เลขอย่าง "1.000" ใช้เป็น create payload ไม่ได้ · scale variants ตรวจผ่าน retry
    --  path ที่จบตั้งแต่ fingerprint/replay แบบ T3b)
    v_r := public.create_order_with_items_i(
      '[{"product_id":"prod-1","quantity":1,"options":{"discount":1.00,"nested":{"x":2.50},"tags":["a",1.0]},"special_request":"1.00"}]'::jsonb,
      v_round, 'self_delivery', '', v_lat, v_lon,
      'T3d', '0900000000', 'cash_on_delivery', '', NULL, 0.0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1N');
    v_n3 := v_r->>'order_number';
    ASSERT v_n3 IS NOT NULL, 'T3d create failed';
    v_r := public.create_order_with_items_i(
      '[{"product_id":"prod-1","quantity":1,"options":{"discount":1,"nested":{"x":2.5},"tags":["a",1.000]},"special_request":"1.00"}]'::jsonb,
      v_round, 'self_delivery', '', v_lat, v_lon,
      'T3d', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1N');
    ASSERT (v_r->>'order_number') = v_n3, 'T3d nested numeric-scale variants must replay (R1)';
    ASSERT v_r->>'replay' = 'true', 'T3d replay marker';
    ASSERT pg_temp.c_orders() = v_mark + 1, 'T3d replay must not create order';
    -- T3e: nested business value / array order / string digits เปลี่ยน → conflict ตามสัญญา
    BEGIN
      PERFORM public.create_order_with_items_i(
        '[{"product_id":"prod-1","quantity":1,"options":{"discount":1.5,"nested":{"x":2.5},"tags":["a",1]},"special_request":"1.00"}]'::jsonb,
        v_round, 'self_delivery', '', v_lat, v_lon,
        'T3d', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1N');
      RAISE EXCEPTION 'T3e expected conflict (nested discount change)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T3e nested value: ' || SQLERRM;
    END;
    BEGIN
      PERFORM public.create_order_with_items_i(
        '[{"product_id":"prod-1","quantity":1,"options":{"discount":1,"nested":{"x":2.5},"tags":[1.0,"a"]},"special_request":"1.00"}]'::jsonb,
        v_round, 'self_delivery', '', v_lat, v_lon,
        'T3d', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1N');
      RAISE EXCEPTION 'T3e expected conflict (array order change)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T3e array order: ' || SQLERRM;
    END;
    BEGIN
      PERFORM public.create_order_with_items_i(
        '[{"product_id":"prod-1","quantity":1,"options":{"discount":1,"nested":{"x":2.5},"tags":["a",1]},"special_request":"1.0"}]'::jsonb,
        v_round, 'self_delivery', '', v_lat, v_lon,
        'T3d', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, NULL, NULL, NULL, NULL, 'CK-R1N');
      RAISE EXCEPTION 'T3e expected conflict (string digits must not be canonicalized)';
    EXCEPTION WHEN raise_exception THEN
      ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T3e string digits: ' || SQLERRM;
    END;
    ASSERT pg_temp.c_orders() = v_mark + 1, 'T3e conflicts must not create orders';
  END;
END $$;

\echo 'CONTRACT 124: ALL ASSERTIONS PASSED (T1-T13 + W5C + remediation 2026-10-14)'

ROLLBACK;
