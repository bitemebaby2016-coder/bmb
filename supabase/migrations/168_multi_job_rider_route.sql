-- ============================================
-- 168 (R16 · Owner 2026-10-28 "ไรเดอร์ Bite Drive รับงานส่งได้มากกว่า 1 เพราะพรีออเดอร์
--   ออกนอกเดียวส่งหลายที่ และต้องคำนวณเส้นทางและจุดส่งให้ด้วย"):
-- multi-job rider — server มี guard งานซ้ำอยู่แล้ว (accept/assign/claim ไม่เช็ค busy)
--   bug เดียวที่ขัด = driver_update_delivery_status ตอน delivered → available "ไม่ตรวจงานค้าง"
--   → แก้: คืน available เฉพาะเมื่อไรเดอร์ "ไม่มีงานค้าง" เท่านั้น (คง busy ถ้างานอื่นค้าง)
-- route/จุดส่งคำนวณฝั่งเครื่องไรเดอร์ (client: src/lib/deliveryPlan.ts — ไม่แตะ server)
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

  -- GPS/position อัปเดตเสมอ (ไม่แตะ status ตรงนี้ — แยก statement ล่างเพื่อเงื่อนไขงานค้าง)
  UPDATE public.drivers
     SET current_latitude = COALESCE(p_latitude, current_latitude),
         current_longitude = COALESCE(p_longitude, current_longitude),
         last_seen_at = NOW(), updated_at = NOW()
   WHERE id = v_drv.id;

  -- R16 (multi-job): delivered = คืน 'available' เฉพาะเมื่อ "ไม่มีงานค้าง" เท่านั้น —
  -- งานอื่นของไรเดอร์คนเดียวกันที่ยัง assigned/accepted/picked_up/in_transit/arrived
  -- = คง 'busy' (พรีออเดอร์รอบเดียวส่งหลายที่ถืองานได้หลายใบพร้อมกัน)
  -- ขั้นอื่น (picked_up/in_transit) = 'busy' เหมือนเดิม
  UPDATE public.drivers
     SET status = CASE WHEN p_status = 'delivered' THEN 'available' ELSE 'busy' END,
         updated_at = NOW()
   WHERE id = v_drv.id
     AND (
       p_status <> 'delivered'
       OR NOT EXISTS (
         SELECT 1 FROM public.delivery_assignments da
          WHERE da.driver_id = v_drv.id
            AND da.order_number <> p_order_number
            AND da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived')
       )
     );

  PERFORM public.append_audit_log('delivery_status_change', 'delivery', p_order_number, 'rider set ' || p_status, jsonb_build_object('status', p_status, 'driver', v_drv.id));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', p_status);
END;
$$;

-- ACL เท่า baseline (authenticated เท่านั้น ไม่มี PUBLIC/anon — ตรง 163)
REVOKE EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) TO authenticated;