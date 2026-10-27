-- ============================================
-- Bite Me Baby — Migration 163: rider real-step status sync + arrival check-in + geofence close
-- Date: 2026-10-27 · R11 (Owner ทดสอบจริง 2026-10-27)
--
-- WHY (evidence — Owner ทดสอบ production 2026-10-27):
--   1. กดรับงาน (driver_accept_assignment 041 / claim_dispatch_offer 135) ไม่แตะ
--      orders.status เลย → ออเดอร์ค้าง 'ready_for_dispatch' ("ยังพร้อมจัดส่งอยู่")
--      และ trigger 161 ไม่ยิง = แอดมิน/ลูกค้าไม่เห็นอะไรเปลี่ยน (DB PO-20261027-379)
--   2. ไม่มีขั้น "ถึงปลายทาง" ที่เชื่อมกับ action จริง — ปุ่มตรวจพิกัดเป็นแค่ GPS
--      ฝั่งเครื่อง สถานะลูกค้าไม่วิ่งถึง 'arrived'
--   3. "ปิดวงจร" ต้องกดโดยแอดมิน (admin_advance 116) เพราะ flow ไรเดอร์ปิดเอง
--      ไม่ครบ — Owner สั่ง: ครบเงื่อนไข (ในพื้นที่ + มีรูป) แล้วปิดวงจรอัตโนมัติ
--
-- DESIGN (ตามกติกาเดิม — ไม่สร้าง state machine ที่สอง):
--   action ไรเดอร์ → สถานะออเดอร์ (หนึ่ง action = หนึ่งขั้น ตาม 030 allow-list):
--     กดรับงาน          → dispatched   ('เริ่มจัดส่ง')   [เฉพาะ ready_for_dispatch]
--     รับอาหารแล้ว       → dispatched   (เดิม 036 — idempotent)
--     กำลังเดินทาง       → in_transit   (เดิม 036)
--     เช็คพิกัดในรัศมี   → arrived      ('ถึงปลายทาง')  [driver_checkin_arrival + geofence 300 ม.]
--     ยืนยันส่ง + รูป   → delivered    ('ส่งสำเร็จ')    [เดิม 132 + geofence ฝั่ง server]
--   ทุก hop ผ่าน order_transition_allowed (030) + trusted GUC (036) — allow-list ไม่เปลี่ยน
--   ทุก hop = UPDATE 1 ครั้ง → trigger 161 ยิงแจ้งเตือนทีละขั้น (ลูกค้า + แอดมิน)
--   delivered เดิมปิดวงจรครบแล้ว (order+assignment+driver released) — ทางไรเดอร์วิ่งครบ
--   → แอดมินไม่ต้องกดปิดวงจรซ้ำ (116 เหลือเป็น override)
--
-- AFFECTED: driver_accept_assignment, claim_dispatch_offer, driver_update_delivery_status
--   (+ geofence), driver_checkin_arrival (ใหม่), delivery_assignments (+arrived/checkin cols)
-- SECURITY: identity = JWT เท่านั้น (F-06) · ไม่มี grant ใหม่แก่ anon ·
--   geofence = haversine_km (020) · EXECUTE authenticated เท่านั้น
-- ROLLBACK / SAFE: CREATE OR REPLACE + ADD COLUMN IF NOT EXISTS — re-run ได้ ·
--   ของเดิมที่ต้องคืน = 041/135/132 body เดิม (ก่อน R11)
-- DEPENDENCIES: 020 (haversine_km) · 030 (allow-list) · 036 (trusted GUC) ·
--   041 · 132 · 135 · 161 (notify trigger — ยิงเองจาก UPDATE)
-- PRODUCTION VERIFICATION: e2e/contracts_163_rider_step_sync.sql (BEGIN..ROLLBACK)
-- ============================================

BEGIN;

-- ============================================
-- 1. delivery_assignments — หลักฐาน check-in (arrived) ฝั่งเซิร์ฟเวอร์
-- ============================================
ALTER TABLE public.delivery_assignments
  ADD COLUMN IF NOT EXISTS arrived_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_latitude   NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS checkin_longitude  NUMERIC(10,7);

-- ============================================
-- 2. driver_accept_assignment — รับงาน = 'เริ่มจัดส่ง' (ก้าวเดียว)
--    041 body เดิมทุกบรรทัด + step-sync: ready_for_dispatch → dispatched
--    (confirmed/preparing = ครัวยังไม่เสร็จ → รับงานได้แต่ไม่ข้ามสถานะ)
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_accept_assignment(
  p_order_number text,
  p_driver_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
  v_order_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  UPDATE public.delivery_assignments
     SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW()), updated_at = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv.id AND status = 'assigned';
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_ACCEPTABLE'; END IF;

  UPDATE public.drivers SET status = 'busy', last_seen_at = NOW(), updated_at = NOW() WHERE id = v_drv.id;

  -- R11 step-sync: รับงาน → 'dispatched' ('เริ่มจัดส่ง') — 1 action จริง = 1 ขั้น
  -- เฉพาะตอนอาหารพร้อมแล้ว — ถ้าครัวยังทำอยู่ ห้ามปลอมสถานะ (030 allow-list)
  SELECT status INTO v_order_status FROM public.orders
   WHERE order_number = p_order_number FOR UPDATE;
  IF v_order_status = 'ready_for_dispatch' THEN
    PERFORM set_config('app.delivery_sync_order', p_order_number, true);
    UPDATE public.orders SET status = 'dispatched', updated_at = NOW()
     WHERE order_number = p_order_number;
    PERFORM public.append_audit_log(
      p_action := 'order_status_change',
      p_entity_type := 'order',
      p_entity_id := p_order_number,
      p_description := 'delivery sync ready_for_dispatch -> dispatched (driver ' || v_drv.id || ')',
      p_metadata := jsonb_build_object('from', 'ready_for_dispatch', 'to', 'dispatched',
                                       'driver_id', v_drv.id, 'source', 'driver_accept_assignment')
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', 'accepted');
END;
$$;

-- ============================================
-- 3. claim_dispatch_offer — claim = accept ในตัว (135) → step-sync เดียวกัน
--    135 body เดิมทุกบรรทัด + reset arrived/checkin + sync
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_dispatch_offer(
  p_order_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
  v_order_status public.order_status;
  v_order_status_txt text;
  v_branch text;
  v_offer_id text;
  v_asg_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  SELECT status INTO v_order_status FROM public.orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF v_order_status NOT IN ('ready_for_dispatch', 'dispatched', 'confirmed', 'preparing') THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_DISPATCHABLE';
  END IF;

  -- atomic claim — แถว offer เดียว/ออเดอร์; ใครมาก่อนได้ก่อน
  UPDATE public.dispatch_offers
     SET status = 'claimed', claimed_by_driver_id = v_drv.id, claimed_at = NOW(), updated_at = NOW()
   WHERE order_number = p_order_number AND status = 'offered'
  RETURNING id INTO v_offer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_OFFER_NOT_AVAILABLE'; -- ถูกจองไปแล้ว / ไม่มีประกาศ / แอดมินยกเลิก
  END IF;

  -- ถ้ามี assignment active อยู่ก่อน (แอดมิน assign ตรงระหว่างประกาศ) = รับไม่ได้
  -- (rollback ทั้ง tx — offer กลับเป็น offered เดิม ไม่ทิ้งสถานะครึ่ง ๆ)
  SELECT status INTO v_asg_status FROM public.delivery_assignments WHERE order_number = p_order_number;
  IF v_asg_status IN ('assigned', 'accepted', 'picked_up', 'in_transit') THEN
    RAISE EXCEPTION 'ERR_OFFER_NOT_AVAILABLE';
  END IF;

  SELECT COALESCE(o.branch_id, public.resolve_home_branch_id()) INTO v_branch
    FROM public.orders o WHERE o.order_number = p_order_number;
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'ERR_BRANCH_UNAVAILABLE';
  END IF;

  -- claim = accept: assignment เกิดเป็น 'accepted' ทันที (reset ของรอบก่อนแบบ assign_driver)
  INSERT INTO public.delivery_assignments
    (id, order_number, driver_id, status, branch_id, assigned_at, accepted_at, notes, created_at, updated_at)
  VALUES (
    'das-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 4),
    p_order_number, v_drv.id, 'accepted', v_branch, NOW(), NOW(), 'claimed by rider', NOW(), NOW()
  )
  ON CONFLICT (order_number) DO UPDATE
    SET driver_id = EXCLUDED.driver_id, status = 'accepted', branch_id = EXCLUDED.branch_id,
        assigned_at = NOW(), accepted_at = NOW(),
        picked_up_at = NULL, in_transit_at = NULL, delivered_at = NULL,
        proof_of_delivery_url = NULL, proof_of_delivery_path = NULL,
        pod_captured_at = NULL, pod_latitude = NULL, pod_longitude = NULL,
        arrived_at = NULL, checkin_latitude = NULL, checkin_longitude = NULL,
        declined_at = NULL, decline_reason = NULL,
        cancelled_at = NULL, cancel_reason = NULL,
        rider_pushed_at = NULL, updated_at = NOW();

  UPDATE public.drivers SET status = 'busy', last_seen_at = NOW(), updated_at = NOW() WHERE id = v_drv.id;

  -- R11 step-sync (อ้างอิงข้อ 2): claim = accept → 'dispatched' เมื่ออาหารพร้อมแล้ว
  v_order_status_txt := v_order_status::text;
  IF v_order_status_txt = 'ready_for_dispatch' THEN
    PERFORM set_config('app.delivery_sync_order', p_order_number, true);
    UPDATE public.orders SET status = 'dispatched', updated_at = NOW()
     WHERE order_number = p_order_number;
    PERFORM public.append_audit_log(
      p_action := 'order_status_change',
      p_entity_type := 'order',
      p_entity_id := p_order_number,
      p_description := 'delivery sync ready_for_dispatch -> dispatched (driver ' || v_drv.id || ')',
      p_metadata := jsonb_build_object('from', 'ready_for_dispatch', 'to', 'dispatched',
                                       'driver_id', v_drv.id, 'source', 'claim_dispatch_offer')
    );
  END IF;

  PERFORM public.append_audit_log('delivery_assigned', 'delivery', p_order_number,
    'rider claimed dispatch offer', jsonb_build_object('driver_id', v_drv.id, 'offer_id', v_offer_id, 'branch_id', v_branch, 'source', 'rider_claim'));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'driver_id', v_drv.id, 'status', 'accepted');
END;
$$;

-- ============================================
-- 4. driver_checkin_arrival — "กดเช็คตำแหน่งในพื้นที่" → 'arrived' ('ถึงปลายทาง')
--    geofence 300 ม. ตรวจฝั่ง server จริง (ตาม role guide "เช็คอินในรัศมี 300 ม.")
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_checkin_arrival(
  p_order_number text,
  p_latitude numeric,
  p_longitude numeric
)
RETURNS jsonb
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
  UPDATE public.delivery_assignments
     SET arrived_at        = COALESCE(arrived_at, NOW()),
         checkin_latitude  = COALESCE(checkin_latitude, p_latitude),
         checkin_longitude = COALESCE(checkin_longitude, p_longitude),
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
-- 5. driver_update_delivery_status — 132 body เดิม + geofence ฝั่ง server ที่ delivered
--    (เงื่อนไข "ในพื้นที่มีรูป" = กติกาปิดวงจรของไรเดอร์ · ตรวจ geofence เมื่อยืนยันได้
--     เพื่อคง contract 020/036 ที่เรียกโดยไม่ส่ง coords)
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_update_delivery_status(
  p_order_number text,
  p_driver_phone text,
  p_status text,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
  v_cur text;
  v_pod_path text;
  v_order_status text;
  v_target text;
  v_hop_from text;
  v_hop_to text;
  v_drop_lat numeric;
  v_drop_lng numeric;
  v_dist_km numeric;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  IF p_status NOT IN ('picked_up', 'in_transit', 'delivered') THEN
    RAISE EXCEPTION 'ERR_INVALID_DELIVERY_STATUS';
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;

  -- F-06: identity = JWT ONLY (p_driver_phone is ignored — spoof-safe)
  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  SELECT status, proof_of_delivery_path INTO v_cur, v_pod_path
    FROM public.delivery_assignments
   WHERE order_number = p_order_number AND driver_id = v_drv.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_FOUND'; END IF;
  IF v_cur = 'delivered' THEN RAISE EXCEPTION 'ERR_ALREADY_DELIVERED'; END IF;
  IF v_cur IN ('declined', 'cancelled') THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_CLOSED'; END IF;

  -- A3: POD ต้องบันทึกแล้ว (driver_attach_pod) ก่อนยืนยันส่งสำเร็จ
  IF p_status = 'delivered' AND v_pod_path IS NULL THEN
    RAISE EXCEPTION 'ERR_POD_REQUIRED';
  END IF;

  -- R11: เงื่อนไข "ในพื้นที่" ที่ delivered — ตรวจเมื่อมีพิกัดทั้งสองฝั่งเท่านั้น
  IF p_status = 'delivered' AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT dropoff_latitude, dropoff_longitude INTO v_drop_lat, v_drop_lng
      FROM public.orders WHERE order_number = p_order_number;
    IF v_drop_lat IS NOT NULL AND v_drop_lng IS NOT NULL THEN
      v_dist_km := public.haversine_km(p_latitude, p_longitude, v_drop_lat, v_drop_lng);
      IF v_dist_km > 0.3 THEN
        RAISE EXCEPTION 'ERR_GEOFENCE: % km from dropoff (max 0.3)', round(v_dist_km::numeric, 3);
      END IF;
    END IF;
  END IF;

  -- M1-09: sync canonical orders.status (forward-only, allow-list validated)
  v_target := CASE p_status
                WHEN 'picked_up'  THEN 'dispatched'
                WHEN 'in_transit' THEN 'in_transit'
                WHEN 'delivered'  THEN 'delivered'
              END;

  SELECT status INTO v_order_status FROM public.orders
   WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  IF v_order_status NOT IN ('cancelled', 'failed', 'delivered') THEN
    PERFORM set_config('app.delivery_sync_order', p_order_number, true);

    v_hop_from := v_order_status;
    WHILE v_hop_from <> v_target LOOP
      v_hop_to := CASE v_hop_from
                    WHEN 'ready_for_dispatch' THEN 'dispatched'
                    WHEN 'dispatched'         THEN 'in_transit'
                    WHEN 'in_transit'         THEN 'arrived'
                    WHEN 'arrived'            THEN 'delivered'
                  END;
      IF v_hop_to IS NULL
         OR NOT public.order_transition_allowed(v_hop_from, v_hop_to, true, false) THEN
        RAISE EXCEPTION 'ERR_DELIVERY_SYNC_BLOCKED: order % cannot advance % -> % (target %)',
          p_order_number, v_hop_from, v_hop_to, v_target;
      END IF;

      UPDATE public.orders SET status = v_hop_to::public.order_status, updated_at = NOW()
       WHERE order_number = p_order_number;

      PERFORM public.append_audit_log(
        p_action := 'order_status_change',
        p_entity_type := 'order',
        p_entity_id := p_order_number,
        p_description := 'delivery sync ' || v_hop_from || ' -> ' || v_hop_to || ' (driver ' || v_drv.id || ')',
        p_metadata := jsonb_build_object('from', v_hop_from, 'to', v_hop_to,
                                         'driver_id', v_drv.id, 'source', 'driver_update_delivery_status')
      );

      v_hop_from := v_hop_to;
    END LOOP;
  END IF;

  UPDATE public.delivery_assignments
     SET status = p_status,
         picked_up_at  = CASE WHEN p_status = 'picked_up'  THEN COALESCE(picked_up_at, NOW())  ELSE picked_up_at END,
         in_transit_at = CASE WHEN p_status = 'in_transit' THEN COALESCE(in_transit_at, NOW()) ELSE in_transit_at END,
         delivered_at  = CASE WHEN p_status = 'delivered'  THEN COALESCE(delivered_at, NOW())  ELSE delivered_at END,
         updated_at = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv.id;

  UPDATE public.drivers
     SET current_latitude = COALESCE(p_latitude, current_latitude),
         current_longitude = COALESCE(p_longitude, current_longitude),
         last_seen_at = NOW(), updated_at = NOW(),
         status = CASE WHEN p_status = 'delivered' THEN 'available' ELSE 'busy' END
   WHERE id = v_drv.id;

  PERFORM public.append_audit_log('delivery_status_change', 'delivery', p_order_number, 'rider set ' || p_status, jsonb_build_object('status', p_status, 'driver', v_drv.id));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', p_status);
END;
$$;

-- ============================================
-- 6. Grants — ACL baseline เดิม (authenticated เท่านั้น ไม่มี PUBLIC/anon)
-- ============================================
REVOKE EXECUTE ON FUNCTION public.driver_accept_assignment(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_accept_assignment(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_dispatch_offer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_dispatch_offer(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_checkin_arrival(text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_checkin_arrival(text, numeric, numeric) TO authenticated;

COMMIT;

-- ============================================
-- END OF MIGRATION 163
-- ============================================