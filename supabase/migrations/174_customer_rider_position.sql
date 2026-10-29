-- ============================================
-- 174 — R21f (Owner 2026-10-29): ตำแหน่งไรเดอร์สำหรับหน้าลูกค้า (/track/:orderNumber)
-- ============================================
-- ปัญหา: ลูกค้าไม่มีทางเห็นตำแหน่งคนส่ง — delivery_assignments/drivers อ่านผ่าน
--   RLS admin/driver เท่านั้น · anon อ่าน orders ปิดอยู่ (050) → ต้องมี RPC กลาง
--   ที่อนุญาตเฉพาะ "เจ้าของออเดอร์จริง" (orders.customer_ref = auth.uid()) หรือ admin
-- กติกาความเป็นส่วนตัว:
--   * คืน NULL = ไม่ใช่เจ้าของ/ไม่มีข้อมูล (ไม่บอกว่าออเดอร์มีอยู่จริง — ไม่ enumerate)
--   * ไม่เปิดให้ anon (guest path ยืนยันด้วย phone RPC อยู่แล้ว — ไม่ยื่นพิกัดให้)
--   * SECURITY DEFINER + search_path pinned · GRANT แค่ authenticated
-- คอลัมน์จริง (probe e2e/r21fSchemaProbe.json):
--   delivery_assignments(order_number, driver_id, status, created_at, …)
--   drivers(id, current_latitude, current_longitude, last_seen_at, updated_at)
-- re-run ปลอดภัย (CREATE OR REPLACE)
-- ============================================

CREATE OR REPLACE FUNCTION public.order_rider_position(p_order_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_owner_ref  uuid;
  v_driver     text;
  v_lat        numeric;
  v_lng        numeric;
  v_seen       timestamptz;
BEGIN
  IF p_order_number IS NULL OR btrim(p_order_number) = '' THEN
    return NULL;
  END IF;

  SELECT customer_ref INTO v_owner_ref
    FROM public.orders
   WHERE order_number = p_order_number;

  -- ไม่พบ/ไม่ใช่ของตัวเอง/ยังไม่ล็อกอิน → NULL เงียบ ๆ (ไม่ enumerate)
  IF v_owner_ref IS NULL THEN
    return NULL;
  END IF;
  IF NOT public.is_admin() AND (v_uid IS NULL OR v_owner_ref <> v_uid) THEN
    return NULL;
  END IF;

  -- assignment ล่าสุดที่มีคนส่ง (ยังไม่ยกเลิก) → driver
  SELECT da.driver_id INTO v_driver
    FROM public.delivery_assignments da
   WHERE da.order_number = p_order_number
     AND da.driver_id IS NOT NULL
     AND COALESCE(da.status, '') <> 'cancelled'
   ORDER BY da.created_at DESC
   LIMIT 1;
  IF v_driver IS NULL THEN
    return NULL;
  END IF;

  SELECT d.current_latitude, d.current_longitude, COALESCE(d.last_seen_at, d.updated_at)
    INTO v_lat, v_lng, v_seen
    FROM public.drivers d
   WHERE d.id = v_driver;
  IF v_lat IS NULL OR v_lng IS NULL THEN
    return NULL;
  END IF;

  return jsonb_build_object(
    'latitude',  v_lat,
    'longitude', v_lng,
    'updated_at', v_seen,
    'driver_id', v_driver
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.order_rider_position(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_rider_position(text) TO authenticated;
