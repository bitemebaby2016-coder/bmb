-- ============================================
-- Bite Me Baby — 135: Dispatch Offers (E1 — โมเดล "ประกาศ-รับงาน")
-- ============================================
-- Owner D4 Q2 (2026-10-22): "เลือกไรเดอร์ก่อน (แอดมิน assign ได้) และไรเดอร์
-- กดรับเองได้ด้วย" — dispatch 1 งาน → ประกาศ+push ไรเดอร์ทุกคนที่ลงทะเบียน/ผูก
-- บัญชีแล้ว → คนแรกที่กด "รับงาน" = จองงานคนเดียว (สถานะเปลี่ยนจริงตอนรับงาน) ·
-- แอดมินจะเลือก/มอบหมายเองก็ได้ (assign_driver เดิม = ชนะประกาศเสมอ)
--
-- Race-safety ของ "คนแรกได้คนเดียว":
--   claim_dispatch_offer = UPDATE ... WHERE status='offered' (atomic ใน 1 tx) —
--   แถวเดียว/ออเดอร์ (UNIQUE order_number) → คนแรก commit สำเร็จ คนที่เหลือได้
--   ERR_OFFER_NOT_AVAILABLE · ถ้าแอดมิน assign ตรงระหว่างทาง แถว assignment
--   ที่ active อยู่ก่อน = claim ถูกปฏิเสธ (rollback ทั้ง tx ไม่ทิ้ง offer ครึ่ง ๆ)
--
-- ของเดิมที่ต่อ (ห้ามสร้างซ้ำ): assign_driver (020/125/132), driver_accept_assignment
-- (041), my_deliveries (132), close_assignments_on_order_terminal (132),
-- push audience driver (132 register_push_subscription + claim_push_driver_targets)
-- ============================================

-- ============================================
-- 1. dispatch_offers — ประกาศงาน 1 แถว/ออเดอร์ (UNIQUE order_number)
-- ============================================
CREATE TABLE IF NOT EXISTS public.dispatch_offers (
  id                   TEXT PRIMARY KEY,
  order_number         TEXT NOT NULL UNIQUE REFERENCES public.orders(order_number) ON DELETE CASCADE,
  branch_id            TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'offered'
                       CHECK (status IN ('offered', 'claimed', 'cancelled')),
  claimed_by_driver_id TEXT REFERENCES public.drivers(id) ON DELETE SET NULL,
  claimed_at           TIMESTAMPTZ,
  rider_pushed_at      TIMESTAMPTZ,
  created_by           uuid,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- การ "ไม่รับงานประกาศ" = ต่อคน (คนอื่นยังเห็น/รับได้) — เก็บเป็นคู่ offer×driver
CREATE TABLE IF NOT EXISTS public.dispatch_offer_declines (
  offer_id   TEXT NOT NULL REFERENCES public.dispatch_offers(id) ON DELETE CASCADE,
  driver_id  TEXT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (offer_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_offers_status ON public.dispatch_offers (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_offers_driver ON public.dispatch_offers (claimed_by_driver_id);

ALTER TABLE public.dispatch_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_offer_declines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispatch_offers_deny_anon ON public.dispatch_offers;
CREATE POLICY dispatch_offers_deny_anon ON public.dispatch_offers FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS dispatch_offers_auth_read ON public.dispatch_offers;
CREATE POLICY dispatch_offers_auth_read ON public.dispatch_offers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS dispatch_offers_admin_write ON public.dispatch_offers;
CREATE POLICY dispatch_offers_admin_write ON public.dispatch_offers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS offer_declines_deny_anon ON public.dispatch_offer_declines;
CREATE POLICY offer_declines_deny_anon ON public.dispatch_offer_declines FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS offer_declines_auth_read ON public.dispatch_offer_declines;
CREATE POLICY offer_declines_auth_read ON public.dispatch_offer_declines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS offer_declines_admin_write ON public.dispatch_offer_declines;
CREATE POLICY offer_declines_admin_write ON public.dispatch_offer_declines
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- tenant_id — DEFAULT เดียวกับทุกตาราง tenancy (m103 `default_tenant_id()`)
ALTER TABLE public.dispatch_offers ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.dispatch_offers ALTER COLUMN tenant_id SET DEFAULT public.default_tenant_id();
UPDATE public.dispatch_offers SET tenant_id = public.default_tenant_id() WHERE tenant_id IS NULL;
ALTER TABLE public.dispatch_offers ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================
-- 2. dispatch_order (admin) — "ส่งออกงาน (Dispatch)" = ประกาศงาน 1 แถว/ออเดอร์
--    ทุก offer รอบใหม่เริ่ม status='offered' + เคลียร์ claim/push/decline ของรอบก่อน
-- ============================================
CREATE OR REPLACE FUNCTION public.dispatch_order(
  p_order_number text
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
  v_offer_id text;
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

  SELECT status INTO v_order_status FROM public.orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF v_order_status NOT IN ('ready_for_dispatch', 'dispatched', 'confirmed', 'preparing') THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_DISPATCHABLE';
  END IF;

  SELECT COALESCE(o.branch_id, public.resolve_home_branch_id()) INTO v_branch
    FROM public.orders o WHERE o.order_number = p_order_number;
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'ERR_BRANCH_UNAVAILABLE';
  END IF;

  INSERT INTO public.dispatch_offers (id, order_number, branch_id, status, created_by, created_at, updated_at)
  VALUES (
    'dsp-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 4),
    p_order_number, v_branch, 'offered', v_uid, NOW(), NOW()
  )
  ON CONFLICT (order_number) DO UPDATE
    SET status = 'offered', claimed_by_driver_id = NULL, claimed_at = NULL,
        rider_pushed_at = NULL, branch_id = EXCLUDED.branch_id, updated_at = NOW()
  RETURNING id INTO v_offer_id;

  -- รอบประกาศใหม่ = ทุกคนเห็นอีกครั้ง (เคลียร์ประวัติการปฏิเสธของรอบก่อน)
  DELETE FROM public.dispatch_offer_declines WHERE offer_id = v_offer_id;

  PERFORM public.append_audit_log('delivery_dispatched', 'delivery', p_order_number,
    'dispatch offer announced (rider claim open)', jsonb_build_object('offer_id', v_offer_id, 'branch_id', v_branch));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'offer_id', v_offer_id, 'status', 'offered');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispatch_order(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_order(text) TO authenticated;

-- ============================================
-- 3. claim_dispatch_offer (rider) — "รับงาน" = จองคนเดียว + สถานะเปลี่ยนจริง
--    Atomic: UPDATE ... WHERE status='offered' (1 tx) → คนแรก commit สำเร็จ
--    คนที่เหลือได้ ERR_OFFER_NOT_AVAILABLE · claim = accept ในตัว (assignment
--    เกิดเป็น status='accepted' ทันที — การรับงานคือตัว trigger สถานะ)
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
        declined_at = NULL, decline_reason = NULL,
        cancelled_at = NULL, cancel_reason = NULL,
        rider_pushed_at = NULL, updated_at = NOW();

  UPDATE public.drivers SET status = 'busy', last_seen_at = NOW(), updated_at = NOW() WHERE id = v_drv.id;

  PERFORM public.append_audit_log('delivery_assigned', 'delivery', p_order_number,
    'rider claimed dispatch offer', jsonb_build_object('driver_id', v_drv.id, 'offer_id', v_offer_id, 'branch_id', v_branch, 'source', 'rider_claim'));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'driver_id', v_drv.id, 'status', 'accepted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_dispatch_offer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_dispatch_offer(text) TO authenticated;

-- ============================================
-- 4. driver_decline_offer (rider) — "ไม่รับงานประกาศ" = ต่อคนเท่านั้น
--    (คนอื่นยังเห็น/รับได้จนกว่าจะมีคน claim หรือแอดมินยกเลิก)
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_decline_offer(
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
  v_offer_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  SELECT id INTO v_offer_id FROM public.dispatch_offers
   WHERE order_number = p_order_number AND status = 'offered';
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_OFFER_NOT_AVAILABLE'; END IF;

  INSERT INTO public.dispatch_offer_declines (offer_id, driver_id)
  VALUES (v_offer_id, v_drv.id)
  ON CONFLICT (offer_id, driver_id) DO NOTHING;

  PERFORM public.append_audit_log('delivery_declined', 'delivery', p_order_number,
    'rider declined dispatch offer', jsonb_build_object('driver_id', v_drv.id, 'offer_id', v_offer_id));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', 'declined');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.driver_decline_offer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_decline_offer(text) TO authenticated;

-- ============================================
-- 5. cancel_dispatch_offer (admin) — ยกเลิกประกาศ (งานกลับสู่การมอบหมายปกติ)
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_dispatch_offer(
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
  v_offer_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  UPDATE public.dispatch_offers
     SET status = 'cancelled', updated_at = NOW()
   WHERE order_number = p_order_number AND status = 'offered'
  RETURNING id INTO v_offer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_OFFER_NOT_AVAILABLE';
  END IF;

  PERFORM public.append_audit_log('delivery_cancelled', 'delivery', p_order_number,
    'dispatch offer cancelled', jsonb_build_object('offer_id', v_offer_id, 'reason', COALESCE(p_reason, '')));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', 'cancelled');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_dispatch_offer(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_dispatch_offer(text, text) TO authenticated;

-- ============================================
-- 6. my_deliveries (135) — เดิมทุกบรรทัด + คืน `offers` เพิ่ม:
--    งานประกาศที่ยังว่าง (status='offered') และฉันยังไม่ได้กด "ไม่รับ"
--    → หน้า /rider โชว์ "งานใหม่ (รับ/ปฏิเสธ)" จากชุดเดียวกับงานของฉัน
-- ============================================
CREATE OR REPLACE FUNCTION public.my_deliveries(p_driver_phone text DEFAULT NULL)
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

  SELECT jsonb_agg(x) INTO v_rows FROM (
    SELECT da.order_number, da.status AS assignment_status, da.assigned_at, da.accepted_at,
           da.proof_of_delivery_path, da.pod_captured_at,
           o.dropoff_detail, o.dropoff_latitude, o.dropoff_longitude,
           o.status AS order_status, o.total_amount, o.payment_status,
           o.payment_method,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity)), '[]'::jsonb)
              FROM public.order_items oi WHERE oi.order_id = o.id) AS items
      FROM public.delivery_assignments da
      JOIN public.orders o ON o.order_number = da.order_number
     WHERE da.driver_id = v_drv.id
       AND da.status NOT IN ('cancelled', 'declined')
     ORDER BY da.assigned_at DESC
  ) x;

  SELECT jsonb_agg(y) INTO v_offers FROM (
    SELECT do2.order_number, 'offered'::text AS assignment_status, do2.created_at AS assigned_at,
           NULL::timestamptz AS accepted_at,
           NULL::text AS proof_of_delivery_path, NULL::timestamptz AS pod_captured_at,
           o.dropoff_detail, o.dropoff_latitude, o.dropoff_longitude,
           o.status AS order_status, o.total_amount, o.payment_status,
           o.payment_method,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity)), '[]'::jsonb)
              FROM public.order_items oi WHERE oi.order_id = o.id) AS items
      FROM public.dispatch_offers do2
      JOIN public.orders o ON o.order_number = do2.order_number
     WHERE do2.status = 'offered'
       AND o.status NOT IN ('cancelled', 'failed', 'delivered')
       AND NOT EXISTS (
         SELECT 1 FROM public.dispatch_offer_declines d
          WHERE d.offer_id = do2.id AND d.driver_id = v_drv.id
       )
     ORDER BY do2.created_at DESC
  ) y;

  RETURN jsonb_build_object('ok', true, 'driver', to_jsonb(v_drv),
                            'assignments', COALESCE(v_rows, '[]'::jsonb),
                            'offers', COALESCE(v_offers, '[]'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_deliveries(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_deliveries(text) TO authenticated;

-- ============================================
-- 7. assign_driver (135) — เนื้อ 132 เดิมทั้งหมด + บรรทัดเดียว:
--    แอดมินมอบหมายตรง = "เลือกไรเดอร์ก่อน" ชนะประกาศเสมอ → ปิด offer ที่ยังเปิด
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
        declined_at = NULL, decline_reason = NULL,
        cancelled_at = NULL, cancel_reason = NULL,
        rider_pushed_at = NULL,
        updated_at = NOW();

  -- E1: มอบหมายตรงโดยแอดมิน = ชนะประกาศเสมอ — ปิด offer ที่ยังเปิดอยู่
  UPDATE public.dispatch_offers SET status = 'cancelled', updated_at = NOW()
   WHERE order_number = p_order_number AND status = 'offered';

  UPDATE public.drivers SET status = 'busy', updated_at = NOW() WHERE id = p_driver_id;

  -- คืนสถานะไรเดอร์คนก่อน (ถ้าเปลี่ยนคนและงานอื่นไม่ค้าง)
  IF v_prev_driver IS NOT NULL AND v_prev_driver <> p_driver_id THEN
    UPDATE public.drivers SET status = 'available', updated_at = NOW()
     WHERE id = v_prev_driver
       AND NOT EXISTS (
         SELECT 1 FROM public.delivery_assignments da
          WHERE da.driver_id = v_prev_driver
            AND da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit')
       );
  END IF;

  PERFORM public.append_audit_log('delivery_assigned', 'delivery', p_order_number, 'delivery assigned to driver ' || p_driver_id, jsonb_build_object('driver_id', p_driver_id, 'branch_id', v_branch, 'previous_driver_id', v_prev_driver));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'driver_id', p_driver_id, 'status', 'assigned', 'branch_id', v_branch);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_driver(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_driver(text, text) TO authenticated;

-- ============================================
-- 8. close_assignments_on_order_terminal (135) — เดิมทุกบรรทัด + ปิด offer ค้างด้วย
--    (ออเดอร์จบทาง = ประกาศต้องปิดตาม ไม่ค้างให้ไรเดอร์กดรับงานผี)
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

  UPDATE public.delivery_assignments
     SET status = 'cancelled',
         cancelled_at = NOW(),
         cancel_reason = 'order_' || NEW.status::text,
         updated_at = NOW()
   WHERE order_number = NEW.order_number
     AND status IN ('assigned', 'accepted', 'picked_up', 'in_transit');
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