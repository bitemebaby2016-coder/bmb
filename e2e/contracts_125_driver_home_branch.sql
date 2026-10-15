-- ============================================================
-- Bite Me Baby — SQL Contract: driver home_branch_id repair (125)
-- ONE transaction, ROLLBACKs at the end — zero persisted data.
-- รันบน isolated/CI DB เท่านั้น (ห้าม production)
-- Matrix:
--   T1  upsert_driver (new)        → ok + home_branch_id อัตโนมัติ (NOT NULL)
--   T2  upsert_driver (same phone) → UPDATE ตัวเดิม ไม่สร้างแถวใหม่
--   T3  upsert_driver (empty info) → ERR_MISSING_DRIVER_INFO
--   T4  resolve_home_branch_id    → ได้สาขาที่มีจริง (is_default ก่อน)
--   T5  driver_login (no JWT)      → ERR_NOT_AUTHENTICATED (guard เดิมอยู่ครบ)
--   T6  assign_driver (no order)   → ERR_ORDER_NOT_FOUND (guard เดิมอยู่ครบ)
--   T7  assign_driver (happy)      → delivery_assignments.branch_id ไม่ว่าง
--   T8  assign_driver (re-assign)  → branch_id ถูกเติมซ้ำตอน ON CONFLICT
--   T9  column defaults            → home_branch_id/branch_id มี default จริง
-- ============================================================
BEGIN;
RESET ROLE;

CREATE FUNCTION pg_temp.c_drv(ph text) RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT count(*) FROM public.drivers WHERE phone = $1 $$;
CREATE FUNCTION pg_temp.c_asg(o text) RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT count(*) FROM public.delivery_assignments WHERE order_number = $1 $$;

DO $$
DECLARE
  v_r jsonb;
  v_id text;
  v_branch text;
  v_order text := 'QA-125-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()), '999999999');
  v_order_status public.order_status;
  v_def text;
BEGIN
  -- server-side context: claims ต้องคง NULL (ห้าม set_config NULL → กลายเป็น '')
  ASSERT current_setting('request.jwt.claims', true) IS NULL, 'fixture: claims must start NULL';

  -- T4: resolver ต้องได้สาขาจริง (หรือสร้างได้) — ตรวจก่อนใช้ใน T1
  v_branch := public.resolve_home_branch_id();
  ASSERT v_branch IS NOT NULL, 'T4 resolve_home_branch_id must not be null';
  ASSERT EXISTS (SELECT 1 FROM public.branches WHERE id = v_branch), 'T4 resolved branch must exist';

  -- T1: upsert_driver ต้องสำเร็จ + เติม home_branch_id อัตโนมัติ
  v_r := public.upsert_driver('QA125 Driver', '0990001251', 'qa-vehicle');
  ASSERT v_r->>'ok' = 'true', 'T1 expected ok, got: ' || v_r::text;
  v_id := v_r->>'driver_id';
  ASSERT v_id IS NOT NULL, 'T1 driver_id missing';
  ASSERT (SELECT home_branch_id FROM public.drivers WHERE id = v_id) IS NOT NULL,
    'T1 home_branch_id must be auto-filled (23502 regression)';
  ASSERT (SELECT home_branch_id FROM public.drivers WHERE id = v_id) = v_branch,
    'T1 home_branch_id must equal resolved branch';

  -- T2: same phone → update same row, no duplicate
  v_r := public.upsert_driver('QA125 Driver Renamed', '0990001251', 'qa-vehicle-2');
  ASSERT v_r->>'driver_id' = v_id, 'T2 must update the same driver row';
  ASSERT pg_temp.c_drv('0990001251') = 1, 'T2 must not duplicate by phone';
  ASSERT (SELECT name FROM public.drivers WHERE id = v_id) = 'QA125 Driver Renamed', 'T2 name must be updated';

  -- T3: missing info guard ยังอยู่
  BEGIN
    PERFORM public.upsert_driver('', '0990001252', '');
    RAISE EXCEPTION 'T3 expected ERR_MISSING_DRIVER_INFO';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_MISSING_DRIVER_INFO%', 'T3 got: ' || SQLERRM;
  END;

  -- T6: assign_driver ยัง guard ตาม order status เดิม
  BEGIN
    PERFORM public.assign_driver('NO-SUCH-ORDER-125', v_id);
    RAISE EXCEPTION 'T6 expected ERR_ORDER_NOT_FOUND';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_ORDER_NOT_FOUND%', 'T6 got: ' || SQLERRM;
  END;

  -- T7: assign happy path — สร้าง order fixture แล้วมอบหมายงาน
  INSERT INTO public.orders (id, order_number, status, customer_name, customer_phone, total_amount, created_at, updated_at)
  VALUES ('ord-' || v_order, v_order, 'confirmed', 'QA125', '0990001251', 100, NOW(), NOW())
  ON CONFLICT (order_number) DO NOTHING;
  SELECT status INTO v_order_status FROM public.orders WHERE order_number = v_order;
  ASSERT v_order_status IN ('confirmed', 'preparing', 'ready_for_dispatch', 'dispatched'),
    'T7 fixture order must be dispatchable, got: ' || v_order_status;

  v_r := public.assign_driver(v_order, v_id);
  ASSERT v_r->>'ok' = 'true', 'T7 expected ok, got: ' || v_r::text;
  ASSERT pg_temp.c_asg(v_order) = 1, 'T7 assignment row must exist';
  ASSERT (SELECT branch_id FROM public.delivery_assignments WHERE order_number = v_order) IS NOT NULL,
    'T7 assignment branch_id must be auto-filled (23502 regression)';
  ASSERT (SELECT branch_id FROM public.delivery_assignments WHERE order_number = v_order) =
         (SELECT home_branch_id FROM public.drivers WHERE id = v_id),
    'T7 assignment branch must follow the driver home branch';

  -- T8: re-assign (ON CONFLICT) — branch_id ยังถูกเติม
  v_r := public.assign_driver(v_order, v_id);
  ASSERT v_r->>'ok' = 'true', 'T8 re-assign expected ok, got: ' || v_r::text;
  ASSERT pg_temp.c_asg(v_order) = 1, 'T8 must not duplicate assignment';
  ASSERT (SELECT branch_id FROM public.delivery_assignments WHERE order_number = v_order) IS NOT NULL,
    'T8 re-assign branch_id must stay filled';

  -- T5: unauthenticated guard ยังอยู่ (HTTP context — claims ถูก set โดย middleware)
  --     ทดสอบท้ายสุดเพราะ set_config ค่าว่างทำให้ claims ไม่ใช่ NULL แล้ว (ห้ามย้อนกลับ)
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM public.driver_login();
    RAISE EXCEPTION 'T5 expected ERR_NOT_AUTHENTICATED';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%ERR_NOT_AUTHENTICATED%', 'T5 got: ' || SQLERRM;
  END;

  -- T9: column defaults ต้องมีจริง (defense in depth แบบ m103)
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'home_branch_id';
  ASSERT v_def LIKE '%resolve_home_branch_id%', 'T9 drivers.home_branch_id default missing: ' || COALESCE(v_def, '(null)');
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'delivery_assignments' AND column_name = 'branch_id';
  ASSERT v_def LIKE '%resolve_home_branch_id%', 'T9 delivery_assignments.branch_id default missing: ' || COALESCE(v_def, '(null)');
END $$;

-- (ผ่านแล้วถ้า query นี้รันจบ — HTTP 2xx = ผ่านทุก assertion)
SELECT 'CONTRACT 125: ALL ASSERTIONS PASSED (T1-T9)' AS result;

ROLLBACK;
