-- ============================================
-- Bite Me Baby — 136: Driver location history (E3 — live tracking + เส้นทางย้อนหลัง)
-- ============================================
-- Owner (2026-10-22): "ให้แอดมินเห็นไรเดอร์วิ่งจริง ๆ บนแผนที่ระหว่างส่ง +
-- เก็บประวัติเส้นทางไว้ดูย้อนหลังตอนจบงานได้"
--   driver_update_location (rider JWT) = heartbeat: อัปเดตตำแหน่งปัจจุบันบน
--   drivers + append ประวัติ (ผูก order ที่กำลังส่งถ้ามี) — ของเดิมที่ต่อ:
--   drivers.current_latitude/longitude (020), my_deliveries, RLS แบบ 132/135
-- ============================================

CREATE TABLE IF NOT EXISTS public.driver_location_history (
  id          TEXT PRIMARY KEY,
  driver_id   TEXT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  order_number TEXT REFERENCES public.orders(order_number) ON DELETE SET NULL,
  latitude    NUMERIC(10,7) NOT NULL,
  longitude   NUMERIC(10,7) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loc_history_order ON public.driver_location_history (order_number, recorded_at);
CREATE INDEX IF NOT EXISTS idx_loc_history_driver ON public.driver_location_history (driver_id, recorded_at);

ALTER TABLE public.driver_location_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loc_history_deny_anon ON public.driver_location_history;
CREATE POLICY loc_history_deny_anon ON public.driver_location_history FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS loc_history_auth_read ON public.driver_location_history;
CREATE POLICY loc_history_auth_read ON public.driver_location_history FOR SELECT TO authenticated USING (true);
-- เขียนได้เฉพาะผ่าน driver_update_location (SECURITY DEFINER) — ไม่มี INSERT policy

-- ============================================
-- driver_update_location (rider) — GPS heartbeat ทุก ~30 วิจากหน้า /rider
--   1) อัปเดตตำแหน่งปัจจุบัน (drivers.current_latitude/longitude/last_seen_at)
--   2) append ประวัติ (ผูกออเดอร์ที่กำลังส่งอยู่ถ้ามี — ดูย้อนหลังตอนจบงาน)
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_update_location(
  p_latitude numeric,
  p_longitude numeric,
  p_order_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
  v_order text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude < -90 OR p_latitude > 90 OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;

  -- ผูกกับงานที่กำลังส่ง (active) เท่านั้น — ไม่เก็บประวัติผีหลังงานปิด
  IF p_order_number IS NOT NULL THEN
    SELECT order_number INTO v_order FROM public.delivery_assignments
     WHERE order_number = p_order_number AND driver_id = v_drv.id
       AND status IN ('assigned', 'accepted', 'picked_up', 'in_transit');
  END IF;

  UPDATE public.drivers
     SET current_latitude = p_latitude,
         current_longitude = p_longitude,
         last_seen_at = NOW(), updated_at = NOW()
   WHERE id = v_drv.id;

  INSERT INTO public.driver_location_history (id, driver_id, order_number, latitude, longitude, recorded_at)
  VALUES (
    'loc-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 4),
    v_drv.id, v_order, p_latitude, p_longitude, NOW()
  );

  RETURN jsonb_build_object('ok', true, 'driver_id', v_drv.id, 'order_number', v_order);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.driver_update_location(numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_update_location(numeric, numeric, text) TO authenticated;