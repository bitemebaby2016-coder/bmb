-- ============================================
-- R13 (Owner สั่ง 2026-10-28 · จบลูปไรเดอร์ + ปิดวงจรอัตโนมัติ):
-- 1) POD path-layer sanitize — drivers.id จริงใน production มี space/#
--    ('drv- ###########-60bc' พิสูจน์ด้วย hex) → upload ไป pod-photos
--    ถูกตัดที่ '#' ใน URL = รูปไม่เคยเข้า bucket (นับ = 0) → delivered
--    ไม่เคยถึง (ERR_POD_REQUIRED) → assignment ค้าง / driver ค้าง busy
--    แก้เฉพาะ "ชั้น path" (client folder · attach check · storage policy)
--    ด้วยฟังก์ชันเดียวกัน — ไม่แตะ PK/FK (role นี้ไม่ใช่ superuser ·
--    FK ไม่ deferrable · id เดิมยังอยู่ในตารางอ้างอิงทั้งหมด)
-- 2) driver_checkin_arrival: อัปเดต delivery_assignments.status = 'arrived'
--    (เดิมเขียนเฉพาะ arrived_at/checkin_* → เครื่องไรเดอร์ยังโชว์
--    "กำลังเดินทาง" ตลอด = ที่ Owner เห็น) + self-heal แถวค้าง
-- re-run ปลอดภัย (CREATE OR REPLACE + UPDATE มีเงื่อนไข)
-- ============================================

-- 0. constraint: เพิ่ม 'arrived' ในสถานะ assignment
--    (เดิม CHECK ไม่มี → 163 จึงเขียนได้แค่ arrived_at/checkin_* — ที่มาของ
--     "เครื่องไรเดอร์ยังค้างกำลังเดินทาง" · apply รอบแรกถูก rollback ตรงนี้)
ALTER TABLE public.delivery_assignments
  DROP CONSTRAINT IF EXISTS delivery_assignments_status_check,
  ADD CONSTRAINT delivery_assignments_status_check
  CHECK ((status = ANY (ARRAY['assigned'::text, 'accepted'::text, 'picked_up'::text,
                              'in_transit'::text, 'arrived'::text, 'delivered'::text,
                              'declined'::text, 'cancelled'::text])));

-- 1.1 path folder sanitize — ทุกฝั่งเทียบด้วยค่านี้ (ทน id สกปรกในอนาคต)
CREATE OR REPLACE FUNCTION public.driver_path_folder(p_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT regexp_replace(coalesce(p_id, ''), '[^A-Za-z0-9_-]', '', 'g') $$;

-- 1.2 storage policy ของ pod-photos — เทียบ folder (sanitize แล้ว) กับ id จริง
CREATE OR REPLACE FUNCTION public.pod_path_is_driver(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.current_driver_id() IS NOT NULL
     AND public.driver_path_folder(split_part(coalesce(p_name, ''), '/', 1))
         = public.driver_path_folder(public.current_driver_id());
$function$;

-- 1.3 driver_attach_pod — folder ต้องเป็นของตน (sanitize เท่ากันทุกฝั่ง)
CREATE OR REPLACE FUNCTION public.driver_attach_pod(
  p_order_number text,
  p_object_path text,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
  v_cur text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;
  IF p_object_path IS NULL OR trim(p_object_path) = '' THEN
    RAISE EXCEPTION 'ERR_POD_MISSING';
  END IF;

  -- path must live in the caller's own driver folder (sanitize เท่ากัน — R13)
  IF public.driver_path_folder(split_part(p_object_path, '/', 1))
     <> public.driver_path_folder(v_drv.id) THEN
    RAISE EXCEPTION 'ERR_POD_PATH_FORBIDDEN';
  END IF;

  SELECT status INTO v_cur FROM public.delivery_assignments
   WHERE order_number = p_order_number AND driver_id = v_drv.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_FOUND'; END IF;
  IF v_cur IN ('delivered', 'declined', 'cancelled') THEN
    RAISE EXCEPTION 'ERR_ASSIGNMENT_CLOSED';
  END IF;

  UPDATE public.delivery_assignments
     SET proof_of_delivery_path = p_object_path,
         proof_of_delivery_url  = p_object_path,
         pod_captured_at = NOW(),
         pod_latitude = p_latitude,
         pod_longitude = p_longitude,
         updated_at = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv.id;

  PERFORM public.append_audit_log(
    'pod_attached', 'delivery', p_order_number,
    'rider attached POD photo',
    jsonb_build_object('driver_id', v_drv.id, 'object_path', p_object_path,
                       'latitude', p_latitude, 'longitude', p_longitude));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number,
                            'proof_of_delivery_path', p_object_path);
END;
$$;

-- ============================================
-- 2. driver_checkin_arrival (163 body) + assignment.status = 'arrived'
--    — forward-only walk ของ order เดิมทุกอย่าง เปลี่ยนแค่ UPDATE assignments
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_checkin_arrival(
  p_order_number text,
  p_latitude numeric,
  p_longitude numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
  v_asg_status text;
  v_drop_lat numeric;
  v_drop_lng numeric;
  v_dist_km numeric;
  v_order_status text;
  v_hop_from text;
  v_hop_to text;
  v_hops int := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RAISE EXCEPTION 'ERR_GEOFENCE_UNVERIFIABLE';
  END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  SELECT status INTO v_asg_status FROM public.delivery_assignments
   WHERE order_number = p_order_number AND driver_id = v_drv.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_FOUND'; END IF;
  IF v_asg_status = 'delivered' THEN RAISE EXCEPTION 'ERR_ALREADY_DELIVERED'; END IF;
  IF v_asg_status IN ('declined', 'cancelled') THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_CLOSED'; END IF;
  IF v_asg_status = 'assigned' THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_ACCEPTABLE'; END IF;

  -- geofence: ต้องอยู่ในรัศมี 300 ม. ของจุดส่ง ("ในพื้นที่" = เงื่อนไขปิดงานตามกฏ)
  SELECT dropoff_latitude, dropoff_longitude INTO v_drop_lat, v_drop_lng
    FROM public.orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF v_drop_lat IS NULL OR v_drop_lng IS NULL THEN
    RAISE EXCEPTION 'ERR_GEOFENCE_UNVERIFIABLE'; -- ออเดอร์ไม่มีพิกัดปลายทาง ยืนยันไม่ได้
  END IF;
  v_dist_km := public.haversine_km(p_latitude, p_longitude, v_drop_lat, v_drop_lng);
  IF v_dist_km > 0.3 THEN
    RAISE EXCEPTION 'ERR_GEOFENCE: % km from dropoff (max 0.3)', round(v_dist_km::numeric, 3);
  END IF;

  -- step-sync → 'arrived' (forward-only walk แบบ 036 — ทุก hop audited + trigger 161)
  SELECT status INTO v_order_status FROM public.orders
   WHERE order_number = p_order_number FOR UPDATE;
  IF v_order_status NOT IN ('cancelled', 'failed', 'delivered') AND v_order_status <> 'arrived' THEN
    PERFORM set_config('app.delivery_sync_order', p_order_number, true);
    v_hop_from := v_order_status;
    WHILE v_hop_from <> 'arrived' LOOP
      v_hop_to := CASE v_hop_from
                    WHEN 'ready_for_dispatch' THEN 'dispatched'
                    WHEN 'dispatched'         THEN 'in_transit'
                    WHEN 'in_transit'         THEN 'arrived'
                  END;
      IF v_hop_to IS NULL
         OR NOT public.order_transition_allowed(v_hop_from, v_hop_to, true, false) THEN
        RAISE EXCEPTION 'ERR_DELIVERY_SYNC_BLOCKED: order % cannot advance % -> % (target arrived)',
          p_order_number, v_hop_from, v_hop_to;
      END IF;

      UPDATE public.orders SET status = v_hop_to::public.order_status, updated_at = NOW()
       WHERE order_number = p_order_number;

      PERFORM public.append_audit_log(
        p_action := 'order_status_change',
        p_entity_type := 'order',
        p_entity_id := p_order_number,
        p_description := 'delivery sync ' || v_hop_from || ' -> ' || v_hop_to || ' (driver ' || v_drv.id || ')',
        p_metadata := jsonb_build_object('from', v_hop_from, 'to', v_hop_to,
                                         'driver_id', v_drv.id, 'source', 'driver_checkin_arrival')
      );
      v_hops := v_hops + 1;
      v_hop_from := v_hop_to;
    END LOOP;
  END IF;

  -- บันทึกหลักฐาน check-in (idempotent — กดซ้ำไม่เขียนทับเวลาเดิม)
  -- R13: status ต้องตามเป็น 'arrived' ด้วย (เดิมค้าง in_transit → เครื่องไรเดอร์โชว์
  -- "กำลังเดินทาง" ตลอด + ป้ายแอดมินไม่ตรง — Owner 2026-10-28)
  UPDATE public.delivery_assignments
     SET arrived_at        = COALESCE(arrived_at, NOW()),
         checkin_latitude  = COALESCE(checkin_latitude, p_latitude),
         checkin_longitude = COALESCE(checkin_longitude, p_longitude),
         status            = CASE WHEN status IN ('accepted', 'picked_up', 'in_transit')
                                  THEN 'arrived' ELSE status END,
         updated_at        = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv.id;

  UPDATE public.drivers
     SET current_latitude = p_latitude, current_longitude = p_longitude,
         last_seen_at = NOW(), updated_at = NOW(), status = 'busy'
   WHERE id = v_drv.id;

  PERFORM public.append_audit_log('delivery_checkin', 'delivery', p_order_number,
    'rider check-in within geofence', jsonb_build_object(
      'driver_id', v_drv.id, 'latitude', p_latitude, 'longitude', p_longitude,
      'distance_km', round(v_dist_km::numeric, 4), 'hops', v_hops, 'source', 'driver_checkin_arrival'));

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number,
                            'status', 'arrived', 'distance_km', round(v_dist_km::numeric, 4));
END;
$$;

-- ============================================
-- 3. self-heal แถวค้าง (checkin แล้วแต่ status ยังไม่ arrived — รอบ retest ที่ผ่านมา)
-- ============================================
UPDATE public.delivery_assignments
   SET status = 'arrived', updated_at = NOW()
 WHERE arrived_at IS NOT NULL
   AND status IN ('accepted', 'picked_up', 'in_transit');