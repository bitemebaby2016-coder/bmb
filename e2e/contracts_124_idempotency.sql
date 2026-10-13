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
--   T11 definitions                → wrapper มี p_client_submit_key · ตัวเดิมยัง 14 args
-- ============================================================
BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'ph1-124-a@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('b2222222-2222-2222-2222-222222222222', 'ph1-124-b@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date;
UPDATE public.products SET is_available = true, available_same_day = true WHERE id = 'prod-1';

DO $$
DECLARE
  v_base_orders int;
  v_r jsonb;
  v_n1 text;
  v_n2 text;
  v_ok text;
  v_round text := (SELECT id FROM public.delivery_rounds
                    WHERE scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date
                      AND status = 'active' LIMIT 1);
  v_items jsonb := '[{"product_id":"prod-1","quantity":1,"options":{},"special_request":null}]'::jsonb;
  v_items2 jsonb := '[{"product_id":"prod-1","quantity":2,"options":{},"special_request":null}]'::jsonb;
BEGIN
  ASSERT v_round IS NOT NULL, 'fixture: active SAME_DAY round missing';
  v_base_orders := (SELECT count(*) FROM public.orders);
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

  -- T1: first request with key → exactly one order
  v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', NULL, NULL,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, 'CK-T1');
  ASSERT (v_r->>'ok')::boolean, 'T1 expected ok';
  v_n1 := v_r->>'order_number';
  ASSERT v_n1 IS NOT NULL, 'T1 order_number missing';
  ASSERT (SELECT count(*) FROM public.orders) = v_base_orders + 1, 'T1 must create exactly one order';
  ASSERT (SELECT count(*) FROM public.order_submissions WHERE client_submit_key = 'CK-T1') = 1, 'T1 submission row';

  -- T2: same key + same payload → same order, no new order
  v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', NULL, NULL,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, 'CK-T1');
  ASSERT (v_r->>'order_number') = v_n1, 'T2 replay must return the SAME order_number';
  ASSERT (SELECT count(*) FROM public.orders) = v_base_orders + 1, 'T2 must not create a second order';
  ASSERT (SELECT count(*) FROM public.order_submissions) = 1, 'T2 submission count unchanged';

  -- T3: same key + changed payload → rejected
  BEGIN
    PERFORM public.create_order_with_items_i(v_items2, v_round, 'self_delivery', '', NULL, NULL,
      'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, 'CK-T1');
    RAISE EXCEPTION 'T3 expected idempotency conflict';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T3 got: ' || SQLERRM;
  END;
  ASSERT (SELECT count(*) FROM public.orders) = v_base_orders + 1, 'T3 must not create order';

  -- T4: same key + different ownership → rejected (no data of the other party)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  BEGIN
    PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', NULL, NULL,
      'Other', '0999999999', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, 'CK-T1');
    RAISE EXCEPTION 'T4 expected idempotency conflict';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_IDEMPOTENCY_CONFLICT%', 'T4 got: ' || SQLERRM;
    ASSERT SQLERRM NOT LIKE '%' || v_n1 || '%', 'T4 leaked the other order number';
  END;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', false);

  -- T5: different keys → independent orders
  v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', NULL, NULL,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, 'CK-T5');
  ASSERT (v_r->>'ok')::boolean AND (v_r->>'order_number') <> v_n1, 'T5 must create a distinct order';
  ASSERT (SELECT count(*) FROM public.orders) = v_base_orders + 2, 'T5 order count';

  -- T6: legacy caller (original function, no key) → compatibility contract unchanged
  v_r := public.create_order_with_items(v_items, v_round, 'self_delivery', '', NULL, NULL,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL);
  ASSERT (v_r->>'ok')::boolean, 'T6 legacy call failed';
  ASSERT (SELECT count(*) FROM public.orders) = v_base_orders + 3, 'T6 legacy order count';
  ASSERT (SELECT count(*) FROM public.order_submissions) = 2, 'T6 legacy must not write submissions';

  -- T7: failed transaction with key → nothing persisted → safe retry → exactly once
  UPDATE public.products SET is_available = false WHERE id = 'prod-1';
  BEGIN
    PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', NULL, NULL,
      'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, 'CK-T7');
    RAISE EXCEPTION 'T7 expected product unavailable';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_PRODUCT_UNAVAILABLE%', 'T7 got: ' || SQLERRM;
  END;
  ASSERT (SELECT count(*) FROM public.order_submissions WHERE client_submit_key = 'CK-T7') = 0,
    'T7 failed txn must leave no partial submission row';
  ASSERT (SELECT count(*) FROM public.orders) = v_base_orders + 3, 'T7 failed txn must leave no order';
  UPDATE public.products SET is_available = true WHERE id = 'prod-1';
  v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', NULL, NULL,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, 'CK-T7');
  ASSERT (v_r->>'ok')::boolean, 'T7 retry failed';
  v_n2 := v_r->>'order_number';
  ASSERT (SELECT count(*) FROM public.orders) = v_base_orders + 4, 'T7 retry must create exactly one order';
  v_r := public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', NULL, NULL,
    'QA', '0900000000', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, 'CK-T7');
  ASSERT (v_r->>'order_number') = v_n2, 'T7 replay number';
  ASSERT (SELECT count(*) FROM public.orders) = v_base_orders + 4, 'T7 replay must not create order';

  -- T8: duplicate retry cannot double payment intents — replay source is the SAME
  -- order_number (client สร้าง intent ต่อ order_number ใหม่เท่านั้น; ไม่มี order ที่สอง
  -- = ไม่มีฐานสร้าง intent ซ้ำ) และ result เก็บฉบับเต็ม
  ASSERT (SELECT result->>'order_number' FROM public.order_submissions WHERE client_submit_key = 'CK-T1') = v_n1,
    'T8 stored replay result mismatch';
  ASSERT (SELECT count(*) FROM public.orders WHERE customer_phone = '0900000000') = 4,
    'T8 unexpected order count for phone';

  -- T9: order_number uniqueness index ยังคงอยู่
  ASSERT (SELECT count(*) FROM pg_indexes
           WHERE tablename = 'orders' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%order_number%') >= 1,
    'T9 order_number UNIQUE index missing';

  -- T10: unauthorized replay (other user, same key) → conflict, ไม่ leak
  PERFORM set_config('request.jwt.claims',
    '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
  BEGIN
    PERFORM public.create_order_with_items_i(v_items, v_round, 'self_delivery', '', NULL, NULL,
      'Other', '0999999999', 'cash_on_delivery', '', NULL, 0, 'SAME_DAY', NULL, 'CK-T1');
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
             AND pg_get_function_identity_arguments(p.oid) NOT LIKE '%p_client_submit_key%') = 1,
    'T11 original signature must stay key-less (14 args)';
END $$;

ROLLBACK;
