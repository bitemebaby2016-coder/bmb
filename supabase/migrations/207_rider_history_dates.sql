-- ============================================
-- 181 — R48 (Owner 2026-11-17): Rider history tabs — scheduled_date + filter params
-- ============================================
-- Owner: "งานของไรเดอร์ให้แสดงเฉพาะวันปัจจุบัน วันที่ผ่านไปแล้วสร้างแท็บเก็บไว้เป็นเดือนไว้ดูย้อนหลัง"
--       "mอบหมายงานล่วงหน้าได้ จอย delivery_rounds.scheduled_date ใน RPC ด้วย ต้องการทำได้ทั้งคู่"
--
-- ⚠️ CI พิสูจน์แล้ว (run 44086503471 · repro ท้องถิ่น 2026-11-17 2 รอบ):
--   * overload 2 ตัวที่คลุมกัน ((text) เดิม + 5-arg all-defaulted) → call
--     `my_deliveries()` และ `my_deliveries('เบอร์')` = "function is not unique" (42725)
--     → Contract 135 (0-arg ×5) + Contract 020 (1-arg) ล้มทั้งคู่
--   * PG กฎ: หลัง param ที่มี DEFAULT ต้องมี DEFAULT ตามทั้งหมด →
--     "p_driver_phone DEFAULT + 4 ตัว required" = apply fail ทันที
--   → ทางเดียวที่ผ่านทุกเงื่อนไข = **5 params required หมด (ไม่มี DEFAULT เลย)**:
--     0-arg/1-arg → 5-arg invalid → resolve ที่ (text) ตัวเดียว unique (legacy ไม่พัง)
--     new callers ส่ง named args ครบ 5 ตัว (p_driver_phone ถูก IGNORE — JWT WINS F-06,
--     ส่ง '' เท่านั้นเพื่อ wire-compat เหมือน driver_update_delivery_status)
--
-- แก้ RPC my_deliveries v3:
--   1. เพิ่ม scheduled_date (จาก delivery_rounds.scheduled_date) ใน JSON ที่คืน
--   2. filter params (บังคับส่งครบ 5 ตัว — ส่ง NULL = ไม่กรอง):
--      p_assigned_from, p_assigned_to      : กรอง assigned_at (timestamptz)
--      p_scheduled_from, p_scheduled_to    : กรอง scheduled_date (date)
--   3. ส่ง NULL ครบ = คืนทุกงานเหมือนเดิม
--   4. JOIN delivery_rounds ผ่าน orders.round_id → scheduled_date (date)
-- re-run ปลอดภัย (DROP 5-arg เก่าก่อน — กรณี prod apply ตัว all-defaulted ไปแล้ว;
-- ห้ามแตะ (text) เพราะ Contract 020 gate ต้องมี signature นี้)
-- ============================================

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

  -- assignments with scheduled_date from delivery_rounds
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
      LEFT JOIN public.delivery_rounds dr ON dr.id = o.round_id
     WHERE da.driver_id = (SELECT id FROM public.drivers WHERE user_id = v_uid)
       AND da.status NOT IN ('cancelled', 'declined')
       AND (p_assigned_from IS NULL OR da.assigned_at >= p_assigned_from)
       AND (p_assigned_to IS NULL OR da.assigned_at <= p_assigned_to)
       AND (p_scheduled_from IS NULL OR dr.scheduled_date >= p_scheduled_from)
       AND (p_scheduled_to IS NULL OR dr.scheduled_date <= p_scheduled_to)
     ORDER BY da.assigned_at DESC
  ) x;

  -- offers (unchanged from v2)
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
      LEFT JOIN public.delivery_rounds dr ON dr.id = o.round_id
     WHERE do2.status = 'offered'
       AND o.status NOT IN ('cancelled', 'failed', 'delivered')
       AND NOT EXISTS (
         SELECT 1 FROM public.dispatch_offer_declines d
          WHERE d.offer_id = do2.id AND d.driver_id = (SELECT id FROM public.drivers WHERE user_id = v_uid)
       )
     ORDER BY do2.created_at DESC
  ) y;

  RETURN jsonb_build_object('ok', true, 'driver', to_jsonb((SELECT * FROM public.drivers WHERE user_id = v_uid)),
                            'assignments', COALESCE(v_rows, '[]'::jsonb),
                            'offers', COALESCE(v_offers, '[]'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_deliveries(text, timestamptz, timestamptz, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_deliveries(text, timestamptz, timestamptz, date, date) TO authenticated;

-- ============================================
-- VERIFICATION
-- ============================================
DO $verify$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef('public.my_deliveries(text, timestamptz, timestamptz, date, date)'::regprocedure) INTO v_src;
  IF v_src NOT LIKE '%scheduled_date%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: scheduled_date missing in my_deliveries';
  END IF;
  IF v_src NOT LIKE '%p_assigned_from%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: p_assigned_from missing';
  END IF;
  IF v_src NOT LIKE '%p_scheduled_from%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: p_scheduled_from missing';
  END IF;
  IF v_src NOT LIKE '%delivery_rounds dr ON dr.id = o.round_id%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: JOIN delivery_rounds missing';
  END IF;
  -- ทุก param ต้องไม่มี DEFAULT (กัน overload ambiguity — CI พิสูจน์แล้ว 42725)
  IF v_src ~ 'p_driver_phone text DEFAULT' THEN
    RAISE EXCEPTION 'ERR_VERIFY: p_driver_phone ห้ามมี DEFAULT (กัน ambiguous กับ my_deliveries(text))';
  END IF;
  IF v_src ~ 'p_assigned_from timestamptz DEFAULT' THEN
    RAISE EXCEPTION 'ERR_VERIFY: p_assigned_from ห้ามมี DEFAULT (กัน ambiguous กับ my_deliveries(text))';
  END IF;
  RAISE NOTICE 'R48 VERIFY: my_deliveries v3 OK (scheduled_date + filters)';
END;
$verify$;

-- กัน overload ambiguity แบบ runtime (CI Contract 135/020 ล้มด้วย 42725 มาก่อน):
-- call 0-arg และ 1-arg ต้อง resolve ได้โดยไม่ "not unique" —
-- ในบริบทนี้ (psql postgres superuser) auth.uid() = NULL → คาดหวัง ERR_NOT_AUTHENTICATED (P0001)
DO $verify_call$
BEGIN
  PERFORM public.my_deliveries();
  RAISE EXCEPTION 'ERR_VERIFY_UNEXPECTED_OK_0ARG';
EXCEPTION
  WHEN ambiguous_function THEN
    RAISE EXCEPTION 'ERR_VERIFY_AMBIGUOUS_0ARG: my_deliveries() is not unique (42725)';
  WHEN raise_exception THEN
    IF SQLERRM LIKE '%ERR_NOT_AUTHENTICATED%' OR SQLERRM LIKE '%ERR_VERIFY_UNEXPECTED_OK_0ARG%' THEN
      RAISE NOTICE 'R48 VERIFY: my_deliveries() 0-arg resolves unambiguously';
    ELSE
      RAISE EXCEPTION 'ERR_VERIFY_0ARG: %', SQLERRM;
    END IF;
END;
$verify_call$;

DO $verify_call1$
BEGIN
  PERFORM public.my_deliveries('0000000000'::text);
  RAISE EXCEPTION 'ERR_VERIFY_UNEXPECTED_OK_1ARG';
EXCEPTION
  WHEN ambiguous_function THEN
    RAISE EXCEPTION 'ERR_VERIFY_AMBIGUOUS_1ARG: my_deliveries(text) is not unique (42725)';
  WHEN raise_exception THEN
    IF SQLERRM LIKE '%ERR_NOT_AUTHENTICATED%' OR SQLERRM LIKE '%ERR_VERIFY_UNEXPECTED_OK_1ARG%' THEN
      RAISE NOTICE 'R48 VERIFY: my_deliveries(text) 1-arg resolves unambiguously';
    ELSE
      RAISE EXCEPTION 'ERR_VERIFY_1ARG: %', SQLERRM;
    END IF;
END;
$verify_call1$;