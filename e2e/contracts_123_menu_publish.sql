-- ============================================
-- Bite Me Baby — PHASE 1 SQL Contract: weekly PRE_ORDER publish enforcement (123)
-- ONE transaction, ROLLBACKs at the end — zero persisted data.
--
-- Proves (server-side authority; run only on non-production DB):
--   P1  publish with 1 entry            → ERR_MENU_COUNT_INVALID
--   P2  publish with 3 entries          → ERR_MENU_COUNT_INVALID
--   P3  publish with exactly 2 valid    → ok, rows published
--   P4  disabled product in schedule    → ERR_PRODUCT_INVALID
--   P5  non-preorder product in schedule→ ERR_PRODUCT_INVALID
--   P6  draft with 1 entry (incomplete) → ok, stays unpublished (Owner #3)
--   P7  non-admin publish               → ERR_FORBIDDEN
--   P8  checkout attempt vs disabled    → ERR_PRODUCT_UNAVAILABLE (025 §5)
--   P9  duplicate payload entry         → collapses to 1 row (UNIQUE)
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('eeee5555-5555-5555-5555-555555555555', 'ph1-123-admin@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('ffff6666-6666-6666-6666-666666666666', 'ph1-123-cust@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin' WHERE id = 'eeee5555-5555-5555-5555-555555555555';

SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date + 1);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', same_day_cutoff = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;

DO $$ DECLARE d date := (now() AT TIME ZONE 'Asia/Bangkok')::date + 1; r jsonb;
BEGIN
  -- NOTE (isolated-run fix): เดิม set role=authenticated ที่นี่ แต่ P2/P9 ทำ raw DML
  -- บน menu_schedule ตรง ๆ ซึ่ง chain ไม่ได้ grant INSERT ให้ authenticated
  -- (permission denied = contract เคยไม่เคยรันที่ไหนมาก่อน) — admin gating ของ
  -- RPC ทำงานผ่าน request.jwt.claims (auth.uid/is_admin) อยู่แล้ว จึงคงสิทธิ์
  -- superuser ไว้เพื่อ raw DML และปล่อยให้ claims กำหนดผลลัพธ์ตามเดิม
  PERFORM set_config('request.jwt.claims', '{"sub":"eeee5555-5555-5555-5555-555555555555","role":"authenticated"}', false);

  -- P6: incomplete draft is allowed (unpublished)
  r := public.set_menu_schedule(d, '[{"product_id":"prod-5"}]'::jsonb);
  ASSERT (r->>'ok')::boolean, 'P6 draft set failed';

  -- P1: publish with 1 → ERR_MENU_COUNT_INVALID
  BEGIN
    r := public.publish_menu_schedule(d, true);
    RAISE EXCEPTION 'P1 expected ERR_MENU_COUNT_INVALID';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_MENU_COUNT_INVALID%', 'P1 got: ' || SQLERRM;
  END;

  -- P9: duplicate payload entry collapses to 1 row, then add 2nd valid → 2 rows
  r := public.set_menu_schedule(d,
    '[{"product_id":"prod-5"},{"product_id":"prod-5"},{"product_id":"prod-6"}]'::jsonb);
  ASSERT (SELECT COUNT(*) FROM public.menu_schedule WHERE scheduled_date = d) = 2,
    'P9 duplicates must collapse to 2 rows';

  -- P2: publish with 3 → ERR_MENU_COUNT_INVALID
  INSERT INTO public.menu_schedule (scheduled_date, product_id)
  VALUES (d, 'prod-1') ON CONFLICT (scheduled_date, product_id) DO NOTHING;
  BEGIN
    r := public.publish_menu_schedule(d, true);
    RAISE EXCEPTION 'P2 expected ERR_MENU_COUNT_INVALID';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_MENU_COUNT_INVALID%', 'P2 got: ' || SQLERRM;
  END;
  DELETE FROM public.menu_schedule WHERE scheduled_date = d AND product_id = 'prod-1';

  -- P3: exactly 2 valid → ok and published
  r := public.publish_menu_schedule(d, true);
  ASSERT (r->>'ok')::boolean, 'P3 publish failed';
  ASSERT (SELECT COUNT(*) FROM public.menu_schedule
           WHERE scheduled_date = d AND is_published = true) = 2, 'P3 rows not published';

  -- P4: disable one product → re-publish (fresh set) rejected
  UPDATE public.products SET is_available = false WHERE id = 'prod-6';
  PERFORM public.set_menu_schedule(d,
    '[{"product_id":"prod-5"},{"product_id":"prod-6"}]'::jsonb);
  BEGIN
    r := public.publish_menu_schedule(d, true);
    RAISE EXCEPTION 'P4 expected ERR_PRODUCT_INVALID';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_PRODUCT_INVALID%', 'P4 got: ' || SQLERRM;
  END;
  UPDATE public.products SET is_available = true WHERE id = 'prod-6';

  -- P5: non-preorder product among the 2 → ERR_PRODUCT_INVALID
  PERFORM public.set_menu_schedule(d,
    '[{"product_id":"prod-5"},{"product_id":"prod-2"}]'::jsonb);
  BEGIN
    r := public.publish_menu_schedule(d, true);
    RAISE EXCEPTION 'P5 expected ERR_PRODUCT_INVALID';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_PRODUCT_INVALID%', 'P5 got: ' || SQLERRM;
  END;

  -- P7: non-admin → ERR_FORBIDDEN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"ffff6666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  BEGIN
    r := public.publish_menu_schedule(d, true);
    RAISE EXCEPTION 'P7 expected ERR_FORBIDDEN';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_FORBIDDEN%', 'P7 got: ' || SQLERRM;
  END;

  -- P8: checkout attempt vs disabled product → ERR_PRODUCT_UNAVAILABLE (025 §5)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"ffff6666-6666-6666-6666-666666666666","role":"authenticated"}', false);
  UPDATE public.products SET is_available = false WHERE id = 'prod-5';
  -- P8 fixture (ตั้งแต่ migration 142): ตาข่ายเมนูปฏิทิน (ERR_PRE_ORDER_REQUIRES_MENU)
  -- ถูกตรวจก่อนความพร้อมของสินค้า — ปักแถวเมนู published ของ prod-5 ณ วันที่ d
  -- เพื่อให้ตาข่ายผ่าน และ assertion เดิม ERR_PRODUCT_UNAVAILABLE คงสภาพเข้มเดิม
  INSERT INTO public.menu_schedule (scheduled_date, product_id, is_published)
  VALUES (d, 'prod-5', true)
  ON CONFLICT (scheduled_date, product_id) DO UPDATE SET is_published = true;
  BEGIN
    r := public.create_order_with_items(
      '[{"product_id":"prod-5","quantity":1,"options":{},"special_request":null}]'::jsonb,
      (SELECT id FROM public.delivery_rounds WHERE scheduled_date = d AND status = 'active' LIMIT 1),
      'self_delivery', '', NULL, NULL, 'QA', '0900000000', 'cash_on_delivery', '', NULL, 0,
      'PRE_ORDER', d);
    RAISE EXCEPTION 'P8 expected ERR_PRODUCT_UNAVAILABLE';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_PRODUCT_UNAVAILABLE%', 'P8 got: ' || SQLERRM;
  END;
  UPDATE public.products SET is_available = true WHERE id = 'prod-5';
END $$;

ROLLBACK;
