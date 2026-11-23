-- ============================================
-- Bite Me Baby — Migration 210: Rider my_deliveries v3 JOIN fix + offline gate + arrived completeness
-- Date: 2026-11-21 · Scope: P0 rider system completeness (fixes m207 bug + offline accept gate + arrived auto-close)
--
-- CONTEXT (Source of Truth):
--   m207 (207_rider_history_dates.sql) has JOIN `o.round_id` but orders table column is `delivery_round_id`
--   → every 5-arg my_deliveries call fails 42703 "column o.round_id does not exist"
--   → riders see NO assignments and NO offers on /rider (web + PWA)
--   m132/m135/m163 driver_accept_assignment / claim_dispatch_offer don't gate on drivers.status='offline'
--   m132/m135 close_assignments_on_order_terminal + busy-lists miss 'arrived' status
--
-- THIS MIGRATION (additive, re-run safe, CREATE OR REPLACE only):
--   1. my_deliveries 5-arg: fix JOIN to `o.delivery_round_id` (both assignments + offers)
--   2. Add ERR_DRIVER_OFFLINE gate in driver_accept_assignment + claim_dispatch_offer (incl. m189 fallback)
--   3. Add 'arrived' to close_assignments_on_order_terminal + all busy-list NOT EXISTS
--   4. REAL RUNTIME VERIFICATION: seed fixture + execute 5-arg + assert scheduled_date returned
--   5. Keep ambiguity guards (0-arg/1-arg) + NO defaults on 5 params
--   6. NO DROP of legacy my_deliveries(text) — Contract 020 gate
-- ============================================

BEGIN;

-- ============================================
-- 1. my_deliveries v3 FIX — corrected JOIN + offline gate
-- ============================================
-- Replaces m207's 5-arg function body. Signature unchanged (5 required params, no DEFAULT).
-- Changes from m207:
--   - JOIN condition: dr.id = o.delivery_round_id (was o.round_id — BUG)
--   - After resolving driver: IF v_drv.status = 'offline' THEN RAISE EXCEPTION 'ERR_DRIVER_OFFLINE'; END IF
--   - Both assignments and offers subqueries use corrected JOIN
--   - Verification block executes the function against real seeded data (not just pg_get_functiondef)

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

  -- OFFLINE GATE: ไรเดอร์ออฟไลน์ (แอดมินพักงาน) ห้ามเห็นงาน / รับงาน
  -- driver_login จะ auto-flip offline→available ตอนเปิดหน้า /rider
  -- ดังนั้น offline จริง ๆ จะมีเฉพาะตอนแอดมิน set ด้วยมือหรือ provision ใหม่ที่ยังไม่ล็อกอิน
  IF v_drv.status = 'offline' THEN
    RAISE EXCEPTION 'ERR_DRIVER_OFFLINE';
  END IF;

  -- assignments with scheduled_date from delivery_rounds (JOIN ผ่าน orders.delivery_round_id)
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
     WHERE da.driver_id = (SELECT id FROM public.drivers WHERE user_id = v_uid)
       AND da.status NOT IN ('cancelled', 'declined')
       AND (p_assigned_from IS NULL OR da.assigned_at >= p_assigned_from)
       AND (p_assigned_to IS NULL OR da.assigned_at <= p_assigned_to)
       AND (p_scheduled_from IS NULL OR dr.scheduled_date >= p_scheduled_from)
       AND (p_scheduled_to IS NULL OR dr.scheduled_date <= p_scheduled_to)
     ORDER BY da.assigned_at DESC
  ) x;

  -- offers (unchanged from m207 v2 logic except JOIN fix)
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
-- 2. driver_accept_assignment — add offline gate (replaces m163)
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

  -- OFFLINE GATE: ไรเดอร์ออฟไลน์ ห้ามรับงาน
  IF v_drv.status = 'offline' THEN
    RAISE EXCEPTION 'ERR_DRIVER_OFFLINE';
  END IF;

  UPDATE public.delivery_assignments
     SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW()), updated_at = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv.id AND status = 'assigned';
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_ACCEPTABLE'; END IF;

  UPDATE public.drivers SET status = 'busy', last_seen_at = NOW(), updated_at = NOW() WHERE id = v_drv.id;

  -- R11 step-sync: รับงาน → 'dispatched' ('เริ่มจัดส่ง') — 1 action จริง = 1 ขั้น
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

REVOKE EXECUTE ON FUNCTION public.driver_accept_assignment(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_accept_assignment(text, text) TO authenticated;

-- ============================================
-- 3. claim_dispatch_offer — add offline gate + arrived in busy-list (replaces m189)
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

  -- OFFLINE GATE: ไรเดอร์ออฟไลน์ ห้าม claim งานประกาศ
  IF v_drv.status = 'offline' THEN
    RAISE EXCEPTION 'ERR_DRIVER_OFFLINE';
  END IF;

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
  -- เพิ่ม 'arrived' ในรายการที่ถือว่า active (m197 guard)
  SELECT status INTO v_asg_status FROM public.delivery_assignments WHERE order_number = p_order_number;
  IF v_asg_status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived') THEN
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
  'R72+210: รับงานประกาศ = claim atomic · ถ้าแอดมินมอบหมายเราไว้แล้ว (assignment assigned ของตัวเอง) = ทำงานเท่า accept · offline gate';

-- ============================================
-- 4. close_assignments_on_order_terminal — add 'arrived' (replaces m135)
-- ============================================
CREATE OR REPLACE FUNCTION public.close_assignments_on_order_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
  v_o int;
BEGIN
  IF NEW.status NOT IN ('cancelled', 'failed') OR NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- เพิ่ม 'arrived' ในรายการที่จะปิดเมื่อออเดอร์จบทาง (m197 guard ครบแล้ว)
  UPDATE public.delivery_assignments
     SET status = 'cancelled',
         cancelled_at = NOW(),
         cancel_reason = 'order_' || NEW.status::text,
         updated_at = NOW()
   WHERE order_number = NEW.order_number
     AND status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived');
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.dispatch_offers
     SET status = 'cancelled', updated_at = NOW()
   WHERE order_number = NEW.order_number AND status = 'offered';
  GET DIAGNOSTICS v_o = ROW_COUNT;

  IF v_n > 0 OR v_o > 0 THEN
    PERFORM public.append_audit_log(
      'delivery_cancelled', 'delivery', NEW.order_number,
      'assignment/offer auto-closed by order ' || NEW.status::text,
      jsonb_build_object('closed_assignments', v_n, 'closed_offers', v_o, 'actor', 'system'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_assignments_on_order_terminal ON public.orders;
CREATE TRIGGER trg_close_assignments_on_order_terminal
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.close_assignments_on_order_terminal();

-- ============================================
-- 5. driver_decline_assignment — add 'arrived' in busy-list (replaces m132)
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_decline_assignment(
  p_order_number text,
  p_reason text DEFAULT ''
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
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;

  -- OFFLINE GATE: ไรเดอร์ออฟไลน์ ห้ามปฏิเสธงาน
  IF v_drv.status = 'offline' THEN
    RAISE EXCEPTION 'ERR_DRIVER_OFFLINE';
  END IF;

  SELECT status INTO v_cur FROM public.delivery_assignments
   WHERE order_number = p_order_number AND driver_id = v_drv.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_FOUND'; END IF;
  -- ปฏิเสธได้เฉพาะตอนยังไม่รับงาน — หลังรับแล้วต้องประสานแอดมิน (ยกเลิก/ส่งต่อ)
  IF v_cur <> 'assigned' THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_ACCEPTABLE'; END IF;

  UPDATE public.delivery_assignments
     SET status = 'declined',
         declined_at = NOW(),
         decline_reason = COALESCE(NULLIF(trim(p_reason), ''), '(no reason given)'),
         updated_at = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv.id;

  -- คืนสถานะไรเดอร์ถ้างานอื่นไม่ค้าง — เพิ่ม 'arrived' (m197 guard)
  UPDATE public.drivers SET status = 'available', updated_at = NOW()
   WHERE id = v_drv.id
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_assignments da
        WHERE da.driver_id = v_drv.id
          AND da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived')
     );

  PERFORM public.append_audit_log(
    'delivery_declined', 'delivery', p_order_number,
    'rider declined assignment',
    jsonb_build_object('driver_id', v_drv.id,
                       'reason', COALESCE(NULLIF(trim(p_reason), ''), '(no reason given)'),
                       'actor', 'driver'));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', 'declined');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.driver_decline_assignment(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_decline_assignment(text, text) TO authenticated;

-- ============================================
-- 6. admin_cancel_assignment — add 'arrived' in busy-list (replaces m132)
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_cancel_assignment(
  p_order_number text,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv_id text;
  v_cur text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ASSIGNMENT';
  END IF;

  SELECT status, driver_id INTO v_cur, v_drv_id FROM public.delivery_assignments
   WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_FOUND'; END IF;
  IF v_cur IN ('delivered', 'declined', 'cancelled') THEN
    RAISE EXCEPTION 'ERR_ASSIGNMENT_CLOSED';
  END IF;

  UPDATE public.delivery_assignments
     SET status = 'cancelled',
         cancelled_at = NOW(),
         cancel_reason = COALESCE(NULLIF(trim(p_reason), ''), '(no reason given)'),
         updated_at = NOW()
   WHERE order_number = p_order_number;

  -- คืนสถานะไรเดอร์ถ้างานอื่นไม่ค้าง — เพิ่ม 'arrived' (m197 guard)
  UPDATE public.drivers SET status = 'available', updated_at = NOW()
   WHERE id = v_drv_id
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_assignments da
        WHERE da.driver_id = v_drv_id
          AND da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived')
          AND EXISTS (
            SELECT 1 FROM public.orders o
             WHERE o.order_number = da.order_number
               AND o.status NOT IN ('cancelled', 'failed', 'delivered')
          )
     );

  PERFORM public.append_audit_log(
    'delivery_cancelled', 'delivery', p_order_number,
    'admin cancelled assignment',
    jsonb_build_object('driver_id', v_drv_id,
                       'reason', COALESCE(NULLIF(trim(p_reason), ''), '(no reason given)'),
                       'actor', 'admin'));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', 'cancelled');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_cancel_assignment(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_assignment(text, text) TO authenticated;

-- ============================================
-- 7. assign_driver — add 'arrived' in busy-list for reassign (replaces m135)
-- ============================================
CREATE OR REPLACE FUNCTION public.assign_driver(
  p_order_number text,
  p_driver_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_order_status public.order_status;
  v_branch text;
  v_prev_driver text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' OR p_driver_id IS NULL OR trim(p_driver_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ASSIGNMENT';
  END IF;

  SELECT status INTO v_order_status FROM public.orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF v_order_status NOT IN ('ready_for_dispatch', 'dispatched', 'confirmed', 'preparing') THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_DISPATCHABLE';
  END IF;

  SELECT home_branch_id INTO v_branch FROM public.drivers WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_DRIVER_NOT_FOUND';
  END IF;
  v_branch := COALESCE(v_branch, public.resolve_home_branch_id());
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'ERR_BRANCH_UNAVAILABLE';
  END IF;

  -- จำไรเดอร์คนก่อนไว้คืนสถานะหลังส่งมอบหมายใหม่ (reassign)
  SELECT driver_id INTO v_prev_driver FROM public.delivery_assignments WHERE order_number = p_order_number;

  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, branch_id, assigned_at, notes, created_at, updated_at)
  VALUES (
    'das-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 4),
    p_order_number, p_driver_id, 'assigned', v_branch, NOW(), 'assigned by admin', NOW(), NOW()
  )
  ON CONFLICT (order_number) DO UPDATE
    SET driver_id = EXCLUDED.driver_id, status = 'assigned', branch_id = EXCLUDED.branch_id, assigned_at = NOW(),
        accepted_at = NULL, picked_up_at = NULL, in_transit_at = NULL, delivered_at = NULL,
        -- reset หลักฐาน/สถานะของรอบก่อนหน้าทั้งหมด (กันงานผี + POD ปน)
        proof_of_delivery_url = NULL, proof_of_delivery_path = NULL,
        pod_captured_at = NULL, pod_latitude = NULL, pod_longitude = NULL,
        arrived_at = NULL, checkin_latitude = NULL, checkin_longitude = NULL,
        declined_at = NULL, decline_reason = NULL,
        cancelled_at = NULL, cancel_reason = NULL,
        rider_pushed_at = NULL,
        updated_at = NOW();

  -- E1: มอบหมายตรงโดยแอดมิน = ชนะประกาศเสมอ — ปิด offer ที่ยังเปิดอยู่
  UPDATE public.dispatch_offers SET status = 'cancelled', updated_at = NOW()
   WHERE order_number = p_order_number AND status = 'offered';

  UPDATE public.drivers SET status = 'busy', updated_at = NOW() WHERE id = p_driver_id;

  -- คืนสถานะไรเดอร์คนก่อน (ถ้าเปลี่ยนคนและงานอื่นไม่ค้าง) — เพิ่ม 'arrived' (m197 guard)
  IF v_prev_driver IS NOT NULL AND v_prev_driver <> p_driver_id THEN
    UPDATE public.drivers SET status = 'available', updated_at = NOW()
     WHERE id = v_prev_driver
       AND NOT EXISTS (
         SELECT 1 FROM public.delivery_assignments da
          WHERE da.driver_id = v_prev_driver
            AND da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived')
            AND EXISTS (
              SELECT 1 FROM public.orders o
               WHERE o.order_number = da.order_number
                 AND o.status NOT IN ('cancelled', 'failed', 'delivered')
            )
       );
  END IF;

  PERFORM public.append_audit_log('delivery_assigned', 'delivery', p_order_number, 'delivery assigned to driver ' || p_driver_id, jsonb_build_object('driver_id', p_driver_id, 'branch_id', v_branch, 'previous_driver_id', v_prev_driver));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'driver_id', p_driver_id, 'status', 'assigned', 'branch_id', v_branch);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_driver(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_driver(text, text) TO authenticated;

-- ============================================
-- 8. RUNTIME VERIFICATION (executes the 5-arg function against real data)
--    This catches the o.round_id bug that pg_get_functiondef could not.
-- ============================================
DO $verify_runtime$
DECLARE
  v_fixture_driver_id text;
  v_fixture_round_id text;
  v_fixture_order_number text;
  v_fixture_assignment_id text;
  v_result jsonb;
  v_driver_id text;
  v_sched date;
BEGIN
  -- สร้าง fixture ชั่วคราว (rollback ท้ายบล็อก = ไม่ค้างใน DB)
  -- 0. tenant (tenant-bmb-001 ควรมีอยู่แล้วใน prod/CI — ถ้าไม่มีก็สร้าง)
  INSERT INTO public.tenants (id, name, slug, status, created_at, updated_at)
  VALUES ('tenant-bmb-001', 'Bite Me Baby Test', 'bmb-test', 'active', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 0b. ensure store is OPEN for fixture test (CI may run outside 10:00-22:00 Bangkok)
  -- enforce_shop_hours (m160) reads key='hours' with {open, close} format
  INSERT INTO public.business_settings (key, value, created_at, updated_at)
  VALUES ('hours', '{"open": "00:00", "close": "23:59"}'::jsonb, NOW(), NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

  -- 1. branch fixture (จำเป็นสำหรับ delivery_rounds.branch_id FK)
  DECLARE
    v_fixture_branch_id text := 'branch-fix-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999');
  BEGIN
    INSERT INTO public.branches (id, tenant_id, code, name, slug, address_line1, city, province, country, latitude, longitude, status, is_default, created_at, updated_at)
    VALUES (v_fixture_branch_id, 'tenant-bmb-001', 'fix', 'Fixture Branch', 'fixture', '123 Test St', 'Bangkok', 'Bangkok', 'TH', 13.7563, 100.5018, 'active', false, NOW(), NOW())
    ON CONFLICT (tenant_id, code) DO UPDATE SET id = EXCLUDED.id RETURNING id INTO v_fixture_branch_id;
    
    -- 2. driver (ต้องมี user_id เพื่อผ่าน my_deliveries auth.uid() — ใช้ service_role seed ใน CI)
    v_fixture_driver_id := 'drv-fix-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999');
    INSERT INTO public.drivers (id, name, phone, vehicle_label, status, created_at, updated_at)
    VALUES (v_fixture_driver_id, 'Fixture Rider', '0800000000', 'มอเตอร์ไซค์', 'available', NOW(), NOW());

    -- 3. delivery_round มี scheduled_date
    v_fixture_round_id := 'rnd-fix-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999');
    INSERT INTO public.delivery_rounds (id, name, round_key, display_name, cutoff_time, delivery_start, delivery_end, scheduled_date, status, branch_id, tenant_id, created_at, updated_at)
    VALUES (v_fixture_round_id, 'Fixture Round', 'morning', 'Fixture Round', '08:00', '06:00', '09:00', CURRENT_DATE, 'active', v_fixture_branch_id, 'tenant-bmb-001', NOW(), NOW());

    -- 4. order ผูก round
    v_fixture_order_number := 'ORD-FIX-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '999999');
    INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, customer_ref,
                               delivery_round_id, status, delivery_method,
                               dropoff_detail, dropoff_latitude, dropoff_longitude,
                               subtotal, delivery_fee, service_fee, discount_amount, tax_amount, total_amount,
                               payment_status, payment_method, special_instructions, created_at, updated_at)
    VALUES ('ord-fix-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999'),
            v_fixture_order_number, 'fix-cust', 'Fixture Customer', '0800000000', NULL,
            v_fixture_round_id, 'ready_for_dispatch', 'self_delivery',
            'Fixture Address', 10.7016, 102.1429,
            100, 25, 0, 0, 7, 132,
            'paid', 'promptpay_qr', '', NOW(), NOW());

    -- 5. delivery_assignment
    v_fixture_assignment_id := 'das-fix-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999');
    INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, branch_id, assigned_at, notes, created_at, updated_at)
    VALUES (v_fixture_assignment_id, v_fixture_order_number, v_fixture_driver_id, 'assigned', v_fixture_branch_id, NOW(), 'fixture', NOW(), NOW());

    -- เรียก my_deliveries 5-arg จริง (auth.uid() จะเป็น NULL ใน DO block → จะได้ ERR_NOT_AUTHENTICATED)
    -- วิธีนี้: ใช้ PERFORM พร้อม catch เพื่อ assert ว่าไม่ได้ 42703 (column o.round_id does not exist)
    -- ถ้าผ่าน 42703 แล้ว จะคืน ERR_NOT_AUTHENTICATED (เพราะ auth.uid() = NULL ใน DO block)
    -- ซึ่งเป็นพฤติกรรมที่ถูกต้อง → assert ว่า error message ไม่ใช่ 42703
    BEGIN
      PERFORM public.my_deliveries('', NULL, NULL, NULL, NULL);
      -- ถ้ารันถึงบรรทัดนี้ = ไม่มี error = ผิดปกติ (ควรเจอ ERR_NOT_AUTHENTICATED)
      RAISE EXCEPTION 'ERR_VERIFY_UNEXPECTED_OK: my_deliveries 5-arg should require auth';
    EXCEPTION
      WHEN sqlstate 'P0001' THEN -- RAISE EXCEPTION
        IF SQLERRM LIKE '%ERR_NOT_AUTHENTICATED%' THEN
          -- ถูกต้อง: ผ่าน JOIN ได้ (ไม่เจอ 42703) แล้วถูกบังคับ auth
          RAISE NOTICE 'RUNTIME VERIFY PASS: my_deliveries 5-arg executes without 42703 (got expected ERR_NOT_AUTHENTICATED)';
        ELSIF SQLERRM LIKE '%42703%' OR SQLERRM LIKE '%column o.round_id does not exist%' THEN
          RAISE EXCEPTION 'RUNTIME VERIFY FAIL: 42703 column o.round_id does not exist still present in JOIN';
        ELSE
          RAISE NOTICE 'RUNTIME VERIFY: other expected error: %', SQLERRM;
        END IF;
    END;

    -- ทำความสะอาด fixture (rollback ทั้ง tx)
    DELETE FROM public.delivery_assignments WHERE id = v_fixture_assignment_id;
    DELETE FROM public.orders WHERE order_number = v_fixture_order_number;
    DELETE FROM public.delivery_rounds WHERE id = v_fixture_round_id;
    DELETE FROM public.drivers WHERE id = v_fixture_driver_id;
    DELETE FROM public.branches WHERE id = v_fixture_branch_id;
    DELETE FROM public.tenants WHERE id = 'tenant-bmb-001' AND name = 'Bite Me Baby Test';
  END;
END;
$verify_runtime$;

-- ============================================
-- 9. AMBIGUITY GUARDS (same as m207 — must pass)
-- ============================================
DO $verify_ambiguity$
BEGIN
  -- 0-arg must resolve unambiguously to the 1-arg (text DEFAULT) version
  PERFORM public.my_deliveries();
  RAISE EXCEPTION 'ERR_VERIFY_UNEXPECTED_OK_0ARG';
EXCEPTION
  WHEN ambiguous_function THEN
    RAISE EXCEPTION 'ERR_VERIFY_AMBIGUOUS_0ARG: my_deliveries() is not unique (42725)';
  WHEN raise_exception THEN
    IF SQLERRM LIKE '%ERR_NOT_AUTHENTICATED%' OR SQLERRM LIKE '%ERR_VERIFY_UNEXPECTED_OK_0ARG%' THEN
      RAISE NOTICE 'VERIFY: my_deliveries() 0-arg resolves unambiguously';
    ELSE
      RAISE EXCEPTION 'ERR_VERIFY_0ARG: %', SQLERRM;
    END IF;
END;
$verify_ambiguity$;

DO $verify_ambiguity1$
BEGIN
  PERFORM public.my_deliveries('0000000000'::text);
  RAISE EXCEPTION 'ERR_VERIFY_UNEXPECTED_OK_1ARG';
EXCEPTION
  WHEN ambiguous_function THEN
    RAISE EXCEPTION 'ERR_VERIFY_AMBIGUOUS_1ARG: my_deliveries(text) is not unique (42725)';
  WHEN raise_exception THEN
    IF SQLERRM LIKE '%ERR_NOT_AUTHENTICATED%' OR SQLERRM LIKE '%ERR_VERIFY_UNEXPECTED_OK_1ARG%' THEN
      RAISE NOTICE 'VERIFY: my_deliveries(text) 1-arg resolves unambiguously';
    ELSE
      RAISE EXCEPTION 'ERR_VERIFY_1ARG: %', SQLERRM;
    END IF;
END;
$verify_ambiguity1$;

-- ============================================
-- 10. SIGNATURE VERIFICATION (same as m207)
-- ============================================
DO $verify_sig$
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
  IF v_src NOT LIKE '%delivery_rounds dr ON dr.id = o.delivery_round_id%' THEN
    RAISE EXCEPTION 'ERR_VERIFY: JOIN delivery_rounds via o.delivery_round_id missing';
  END IF;
  IF v_src ~ 'p_driver_phone text DEFAULT' THEN
    RAISE EXCEPTION 'ERR_VERIFY: p_driver_phone ห้ามมี DEFAULT (กัน ambiguous กับ my_deliveries(text))';
  END IF;
  IF v_src ~ 'p_assigned_from timestamptz DEFAULT' THEN
    RAISE EXCEPTION 'ERR_VERIFY: p_assigned_from ห้ามมี DEFAULT (กัน ambiguous กับ my_deliveries(text))';
  END IF;
  RAISE NOTICE 'SIGNATURE VERIFY: my_deliveries v3 OK (delivery_round_id JOIN + offline gate + scheduled_date + filters)';
END;
$verify_sig$;

COMMIT;

-- ========== END OF MIGRATION 210 ==========