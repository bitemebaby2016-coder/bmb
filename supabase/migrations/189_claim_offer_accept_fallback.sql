-- ============================================
-- Bite Me Baby — Migration 189: CLAIM FALLBACK = ACCEPT (ไรเดอร์ "รับงานไม่ได้")
-- Task: R72 (Owner 2026-11-05 ค่ำ: "ไรเดอร์รับงานไม่ได้") — หลักฐาน m163:143-148:
--   เมื่อแอดมินกด "มอบหมาย" (assign_driver → assignment 'assigned') แล้วไรเดอร์
--   กด "รับงานประกาศ" (claim_dispatch_offer) = เด้ง ERR_OFFER_NOT_AVAILABLE ทันที
--   (guard เดิมกัน "มี assignment อยู่ก่อน" ทุกกรณี รวมกรณีที่ assignment เป็นของตัวเอง)
--   = ไรเดอร์กดรับงานไม่ได้จริงตามที่ Owner รายงาน
-- Fix: ถ้า assignment 'assigned' เป็นของไรเดอร์คนนี้ → ทำงานเท่ากับ
--   driver_accept_assignment (accepted + step-sync ready_for_dispatch→dispatched)
--   และคืน ok — กรณีของคนอื่นยัง ERR_OFFER_NOT_AVAILABLE เหมือนเดิม (กันซ้ำจอง)
-- REVERSIBLE: CREATE OR REPLACE — คืน m163 ได้จากไฟล์ 163 · IDEMPOTENT
-- ============================================
BEGIN;

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
  v_order_status_txt := v_order_status::text;

  -- R72: แอดมินมอบหมายไรเดอร์คนนี้ไว้แล้ว (assignment 'assigned' ของตัวเอง) →
  -- ปุ่ม "รับงานประกาศ" ต้องทำงานเท่ากับ "รับงาน" (เดิมเด้ง ERR_OFFER_NOT_AVAILABLE = รับงานไม่ได้)
  SELECT status INTO v_asg_status FROM public.delivery_assignments
   WHERE order_number = p_order_number AND driver_id = v_drv.id;
  IF v_asg_status = 'assigned' THEN
    UPDATE public.delivery_assignments
       SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW()), updated_at = NOW()
     WHERE order_number = p_order_number AND driver_id = v_drv.id AND status = 'assigned';
    UPDATE public.drivers SET status = 'busy', last_seen_at = NOW(), updated_at = NOW() WHERE id = v_drv.id;
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
                                         'driver_id', v_drv.id, 'source', 'claim_dispatch_offer_assigned_fallback')
      );
    END IF;
    PERFORM public.append_audit_log('delivery_assigned', 'delivery', p_order_number,
      'rider accepted assigned job via claim button', jsonb_build_object('driver_id', v_drv.id, 'source', 'claim_assigned_fallback'));
    RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'driver_id', v_drv.id, 'status', 'accepted', 'via', 'assigned_fallback');
  END IF;
  -- atomic claim — แถว offer เดียว/ออเดอร์; ใครมาก่อนได้ก่อน
  UPDATE public.dispatch_offers
     SET status = 'claimed', claimed_by_driver_id = v_drv.id, claimed_at = NOW(), updated_at = NOW()
   WHERE order_number = p_order_number AND status = 'offered'
  RETURNING id INTO v_offer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_OFFER_NOT_AVAILABLE'; -- ถูกจองไปแล้ว / ไม่มีประกาศ / แอดมินยกเลิก
  END IF;

  -- ถ้ามี assignment active ของ "คนอื่น" อยู่ก่อน = รับไม่ได้ (rollback ทั้ง tx)
  SELECT status INTO v_asg_status FROM public.delivery_assignments WHERE order_number = p_order_number;
  IF v_asg_status IN ('assigned', 'accepted', 'picked_up', 'in_transit') THEN
    RAISE EXCEPTION 'ERR_OFFER_NOT_AVAILABLE';
  END IF;

  SELECT COALESCE(o.branch_id, public.resolve_home_branch_id()) INTO v_branch
    FROM public.orders o WHERE o.order_number = p_order_number;
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'ERR_BRANCH_UNAVAILABLE';
  END IF;

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
REVOKE ALL ON FUNCTION public.claim_dispatch_offer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_dispatch_offer(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.claim_dispatch_offer(text) IS
  'R72: รับงานประกาศ = claim atomic · ถ้าแอดมินมอบหมายเราไว้แล้ว (assignment assigned ของตัวเอง) = ทำงานเท่า accept (กันปุ่มรับงานใช้ไม่ได้)';

COMMIT;
-- ========== END OF MIGRATION 189 ==========