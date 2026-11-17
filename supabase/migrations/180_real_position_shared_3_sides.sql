-- ============================================
-- 180 — R46 (Owner 2026-11-17): ระบบพิกัดจริงร่วมกันของผู้ใช้ทั้ง 3 ฝั่ง
-- ============================================
-- คำสั่ง Owner: "ดูระบบลิ้งขนส่งแล้วใช้จากตำแหน่งจริงที่ร่วมกันของผู้ใช้ทั้ง 3 แบบให้ถูกต้องจริง
--   อย่าฮาร์ดโค้ดทุกตำแหน่ง ไรเดอร์อยู่จันทบุรี" + ยืนยันไรเดอร์ "พลอย ในไทยโกฯ" =
--   ข้อมูลทดสอบที่ AI สร้าง ไม่ใช่ของจริง → "ยกเลิกใช้ ลบทิ้งไปเลย"
--
-- หลักฐานก่อนหน้า (ตรวจแล้ว):
--   * พิกัด กทม. (13.713, 100.4365) ไม่มีในโค้ด/seed/migration ทั้งระบบ = ข้อมูล heartbeat
--     ค้างใน drivers.current_* ของไรเดอร์ทดสอบ → โชว์บนแผนที่แอดมิน + หน้า /track ราวกับ live
--   * audit ระบบ: ไม่มีพิกัดฮาร์ดโค้ดเหลือใน production code — ครัวจาก config/DB เดียว
--     (kitchenLocation.ts), ไรเดอร์จาก GPS จริง (heartbeat 136), ลูกค้าจาก RPC m174
--
-- แก้ 2 ข้อ:
--   1) ลบไรเดอร์ทดสอบ "พลอย ในไทยโกฯ" — FK ON DELETE CASCADE (m020:457, m135:40, m136:13)
--      ลบ delivery_assignments + driver_location_history ของไรเดอร์นี้ตามไปด้วย → ไม่มีข้อมูลค้าง
--      Guard: ห้ามลบถ้ามีงานกำลังส่งจริง (accepted/picked_up/in_transit/arrived) — กันลบพลาด
--   2) list_drivers(): กรองตาม tenant (pattern เดียวกับ m125: v_tenant := public.default_tenant_id())
--      เดิม m037 SELECT จาก drivers ทั้งตารางไม่กรอง tenant → Dispatch โชว์ไรเดอร์ข้ามแบรนด์ได้
--      + คืน last_seen_at เพิ่ม → UI ตัดสิน "ตำแหน่งเก่า" ได้ ไม่แสดงพิกัดค้างราวกับ live
-- re-run ปลอดภัย (DELETE ซ้ำ = 0 แถว · CREATE OR REPLACE)
-- ============================================

-- 1) ลบไรเดอร์ทดสอบ (Owner ยืนยัน 2026-11-17) — guard งานกำลังส่งจริง
DO $cleanup$
DECLARE
  v_deleted int := 0;
BEGIN
  DELETE FROM public.drivers d
   WHERE d.name IN ('พลอย ในไทยโกฯ', 'พลอย (ไทยโกฯ)', 'พลอย (ทดสอบ)', 'พลอย (AI test)', 'พลอย test')
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_assignments da
        WHERE da.driver_id = d.id
          AND da.status IN ('accepted', 'picked_up', 'in_transit', 'arrived')
     );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'R46 CLEANUP: ลบไรเดอร์ทดสอบ AI = % คน', v_deleted;
END;
$cleanup$;

-- 2) list_drivers() v2 — tenant filter + last_seen_at (สัญญาเดิมคงไว้: jsonb {ok, drivers, count})
--    key เดิมครบ (id, driver_name, phone_number, status, max_capacity, current_latitude,
--    current_longitude, active_assignments, last_active) + เพิ่ม last_seen_at
CREATE OR REPLACE FUNCTION public.list_drivers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tenant text;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  -- R46: scope ตาม tenant ของ deployment (pattern m125) — ห้ามคืนไรเดอร์ข้ามแบรนด์
  v_tenant := public.default_tenant_id();

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'driver_name', r.driver_name, 'phone_number', r.phone_number,
           'status', r.status, 'max_capacity', r.max_capacity,
           'current_latitude', r.current_latitude, 'current_longitude', r.current_longitude,
           'last_seen_at', r.last_seen_at,
           'active_assignments', r.active_assignments, 'last_active', r.last_active)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT d.id, d.name AS driver_name, d.phone AS phone_number, d.status,
             NULL::integer AS max_capacity,
             d.current_latitude, d.current_longitude, d.last_seen_at,
             COUNT(da.id)::int AS active_assignments,
             MAX(da.assigned_at) AS last_active
        FROM public.drivers d
        LEFT JOIN public.delivery_assignments da
               ON da.driver_id = d.id
              AND da.status IN ('assigned', 'accepted', 'in_transit')
       WHERE d.tenant_id = v_tenant
        GROUP BY d.id, d.name, d.phone, d.status,
                 d.current_latitude, d.current_longitude, d.last_seen_at
        ORDER BY d.name
    ) r;

  RETURN jsonb_build_object('ok', true, 'drivers', v_result, 'count', jsonb_array_length(v_result));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_drivers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_drivers() TO authenticated;

-- 3) VERIFICATION — list_drivers ต้องมี tenant filter + last_seen_at (ล้ม migration ถ้าไม่ครบ)
DO $verify$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef('public.list_drivers()'::regprocedure) INTO v_src;
  IF v_src NOT LIKE '%d.tenant_id = v_tenant%' THEN
    RAISE EXCEPTION 'ERR_VERIFY_LIST_DRIVERS_TENANT: list_drivers ต้องกรอง tenant';
  END IF;
  IF v_src NOT LIKE '%last_seen_at%' THEN
    RAISE EXCEPTION 'ERR_VERIFY_LIST_DRIVERS_SEEN: list_drivers ต้องคืน last_seen_at';
  END IF;
  RAISE NOTICE 'R46 VERIFY: list_drivers tenant filter + last_seen_at OK';
END;
$verify$;
