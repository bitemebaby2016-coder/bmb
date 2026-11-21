-- ============================================
-- Bite Me Baby — Migration 211: my_deliveries v3 RETURN fix (to_jsonb subquery bug)
-- Date: 2026-11-21 · Scope: P0 — fix m210's RETURN that fails at runtime
--
-- BUG (จาก CI-replay จริง + Contract 210):
--   m210 RETURN: jsonb_build_object('ok', true, 'driver', to_jsonb((SELECT * FROM public.drivers WHERE user_id = v_uid)), ...)
--   → ERROR 42601/22006-style "subquery must return only one column" — SELECT * ใน scalar subquery
--     ผล: my_deliveries 5-arg พังทุกครั้งที่เรียกใต้ JWT ไรเดอร์ (auth ผ่าน) — verify block ของ m210
--         จับไม่ได้เพราะมันเดินถึงแค่ ERR_NOT_AUTHENTICATED (auth.uid() = NULL ใน DO block) ไม่ถึง RETURN
--
-- FIX: CREATE OR REPLACE 5-arg เท่านั้น — RETURN ใช้ to_jsonb(v_drv) (row variable) · เนื้อที่เหลือเหมือน m210
-- GATE: no defaults on 5 params · ห้ามแตะ legacy my_deliveries(text) · offline gate + delivery_round_id JOIN คงเดิม
-- VERIFY (แก้จุดอ่อนของ m210): รันจริง "จนถึง RETURN" — set_config('request.jwt.claims') ให้ auth.uid() ได้
--   driver ที่มี user_id (CI: fixture ที่ seed ใน tx · prod: ไรเดอร์จริง read-only) → ต้องได้ ok=true + assignments
-- ============================================

BEGIN;

DROP FUNCTION IF EXISTS public.my_deliveries(text, timestamptz, timestamptz, date, date);

CREATE OR REPLACE FUNCTION public.my_deliveries(
  p_driver_phone text,
  p_assigned_from timestamptz,
  p_assigned_to timestamptz,
  p_scheduled_from date,
  p_scheduled_to date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid;
  v_drv  public.drivers%ROWTYPE;
  v_rows jsonb;
  v_offers jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  -- OFFLINE GATE: ไรเดอร์ออฟไลน์ (แอดมินพักงาน) — ไม่เห็นงาน (m210 คงเดิม)
  IF v_drv.status = 'offline' THEN
    RAISE EXCEPTION 'ERR_DRIVER_OFFLINE';
  END IF;

  -- assignments: JOIN delivery_rounds ผ่าน orders.delivery_round_id (m210 fix คงเดิม)
  SELECT jsonb_agg(x) INTO v_rows FROM (
    SELECT da.order_number, da.status AS assignment_status, da.assigned_at, da.accepted_at,
           da.proof_of_delivery_path, da.pod_captured_at,
           o.dropoff_detail, o.dropoff_latitude, o.dropoff_longitude,
           o.status AS order_status, o.total_amount, o.payment_status,
           o.payment_method,
           dr.scheduled_date,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity)), '[]'::jsonb)
              FROM public.order_items oi WHERE oi.order_id = o.id) AS items
      FROM public.delivery_assignments da
      JOIN public.orders o ON o.order_number = da.order_number
      LEFT JOIN public.delivery_rounds dr ON dr.id = o.delivery_round_id
     WHERE da.driver_id = v_drv.id
       AND da.status NOT IN ('cancelled', 'declined')
       AND (p_assigned_from IS NULL OR da.assigned_at >= p_assigned_from)
       AND (p_assigned_to IS NULL OR da.assigned_at <= p_assigned_to)
       AND (p_scheduled_from IS NULL OR dr.scheduled_date >= p_scheduled_from)
       AND (p_scheduled_to IS NULL OR dr.scheduled_date <= p_scheduled_to)
     ORDER BY da.assigned_at DESC
  ) x;

  -- offers (m210 คงเดิม + JOIN ถูกแล้ว)
  SELECT jsonb_agg(y) INTO v_offers FROM (
    SELECT do2.order_number, 'offered'::text AS assignment_status, do2.created_at AS assigned_at,
           NULL::timestamptz AS accepted_at,
           NULL::text AS proof_of_delivery_path, NULL::timestamptz AS pod_captured_at,
           o.dropoff_detail, o.dropoff_latitude, o.dropoff_longitude,
           o.status AS order_status, o.total_amount, o.payment_status,
           o.payment_method,
           dr.scheduled_date,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity)), '[]'::jsonb)
              FROM public.order_items oi WHERE oi.order_id = o.id) AS items
      FROM public.dispatch_offers do2
      JOIN public.orders o ON o.order_number = do2.order_number
      LEFT JOIN public.delivery_rounds dr ON dr.id = o.delivery_round_id
     WHERE do2.status = 'offered'
       AND o.status NOT IN ('cancelled', 'failed', 'delivered')
       AND NOT EXISTS (
         SELECT 1 FROM public.dispatch_offer_declines d
          WHERE d.offer_id = do2.id AND d.driver_id = v_drv.id
       )
     ORDER BY do2.created_at DESC
  ) y;

  -- ★ RETURN FIX (บั๊ก m210): to_jsonb(row variable) — subquery SELECT * ต้องห้ามกลับมา
  RETURN jsonb_build_object('ok', true, 'driver', to_jsonb(v_drv),
                            'assignments', COALESCE(v_rows, '[]'::jsonb),
                            'offers', COALESCE(v_offers, '[]'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_deliveries(text, timestamptz, timestamptz, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_deliveries(text, timestamptz, timestamptz, date, date) TO authenticated;

-- ============================================
-- VERIFICATION A — ต้องรันจริง "จนถึง RETURN" (แก้จุดอ่อน verify ของ m210)
-- หา driver ที่มี user_id (CI: fixture seed โดย contract ก่อนหน้า/ใน tx เดียวกัน · prod: ไรเดอร์จริง read-only)
-- ตั้ง claims ชั่วคราว (is_local=true — หมดผลเมื่อจบ statement) → เรียก 5-arg → ต้องได้ ok=true
-- ============================================
DO $verify_return$
DECLARE
  v_uid uuid;
  v_res jsonb;
BEGIN
  SELECT user_id INTO v_uid FROM public.drivers
   WHERE user_id IS NOT NULL AND status <> 'offline' ORDER BY created_at LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE NOTICE 'VERIFY-A SKIP: ยังไม่มี driver ที่มี user_id + สถานะไม่ offline (รันหลัง seed แรกเท่านั้น)';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_res := public.my_deliveries('', NULL, NULL, NULL, NULL);

  IF (v_res->>'ok') <> 'true' THEN
    RAISE EXCEPTION 'VERIFY-A FAIL: my_deliveries ไม่คืน ok=true (RETURN ยังพัง?): %', v_res;
  END IF;
  IF (v_res->'driver'->>'id') IS NULL THEN
    RAISE EXCEPTION 'VERIFY-A FAIL: driver object หาย (to_jsonb ผิดรูป?)';
  END IF;
  RAISE NOTICE 'VERIFY-A PASS: my_deliveries 5-arg รันถึง RETURN จริง (ok=true, driver.id=%)',
    v_res->'driver'->>'id';

  -- ล้าง claims ชั่วคราวทันที (is_local=true หมดผลเมื่อจบ statement อยู่แล้ว — RESET กันเหลือ)
  PERFORM set_config('request.jwt.claims', '', true);
  RESET ROLE;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', '', true);
    RESET ROLE;
    RAISE; -- ตายเสมอถ้า RETURN ยังพัง — ห้ามกลืน
END;
$verify_return$;

-- ============================================
-- VERIFICATION B — signature + JOIN + offline gate ครบ (ตาม m210)
-- ============================================
DO $verify_sig$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef('public.my_deliveries(text, timestamptz, timestamptz, date, date)'::regprocedure) INTO v_src;
  IF v_src NOT LIKE '%scheduled_date%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: scheduled_date missing';
  END IF;
  IF v_src NOT LIKE '%dr.id = o.delivery_round_id%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: delivery_round_id JOIN missing';
  END IF;
  IF v_src LIKE '%dr.id = o.round_id%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: legacy o.round_id JOIN ยังติดค้าง';
  END IF;
  IF v_src NOT LIKE '%to_jsonb(v_drv)%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: RETURN ต้องใช้ to_jsonb(v_drv)';
  END IF;
  IF v_src LIKE '%to_jsonb((SELECT * FROM public.drivers%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: subquery SELECT * ใน RETURN ยังติดค้าง (บั๊ก m210)';
  END IF;
  IF v_src NOT LIKE '%ERR_DRIVER_OFFLINE%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: offline gate หาย';
  END IF;
  IF v_src ~ 'p_driver_phone text DEFAULT' THEN
    RAISE EXCEPTION 'ERR_VERIFY: ห้ามมี DEFAULT (กัน overload ambiguity)';
  END IF;
  RAISE NOTICE 'SIGNATURE VERIFY: my_deliveries v3-fixed OK (to_jsonb(v_drv) + offline gate + delivery_round_id JOIN)';
END;
$verify_sig$;

-- ============================================
-- VERIFICATION C — ambiguity guards (เดิม ตาม m207/m210)
-- ============================================
DO $verify_amb0$
BEGIN
  PERFORM public.my_deliveries();
EXCEPTION
  WHEN ambiguous_function THEN
    RAISE EXCEPTION 'ERR_VERIFY_AMBIGUOUS_0ARG: my_deliveries() is not unique (42725)';
  WHEN OTHERS THEN
    RAISE NOTICE 'VERIFY: my_deliveries() 0-arg resolves unambiguously';
END;
$verify_amb0$;

DO $verify_amb1$
BEGIN
  PERFORM public.my_deliveries('0000000000'::text);
EXCEPTION
  WHEN ambiguous_function THEN
    RAISE EXCEPTION 'ERR_VERIFY_AMBIGUOUS_1ARG: my_deliveries(text) is not unique (42725)';
  WHEN OTHERS THEN
    RAISE NOTICE 'VERIFY: my_deliveries(text) 1-arg resolves unambiguously';
END;
$verify_amb1$;

COMMIT;

-- ========== END OF MIGRATION 211 ==========