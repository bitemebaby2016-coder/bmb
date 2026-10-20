-- ============================================
-- Bite Me Baby — Migration 132: Rider E2E closure (POD persistence + rider push + decline/cancel)
-- Date: 2026-10-20 · Owner task: RIDER E2E PRODUCTION CLOSURE (A2/A3/A4)
--
-- WHY (audit 2026-10-20, ห้ามอ้าง POD ถ้ายังอยู่แค่ client state):
--   1. A3 — รูป POD เคยอยู่ใน client state แล้วหาย (RiderPWA data URL) —
--      แอดมินไม่มีทางเห็นรูปส่งมอบจริง → เพิ่ม storage bucket ส่วนตัว
--      `pod-photos` + คอลัมน์อ้างอิง object + RPC บันทึกฝั่งเซิร์ฟเวอร์
--   2. A2 — ระบบ push ทั้งหมดผูกกับ customers เท่านั้น (115) → ไรเดอร์
--      ไม่เคยได้รับ push เมื่อถูกมอบหมายงาน → เพิ่ม audience ฝั่ง driver
--      โดย identity มาจาก JWT (auth.uid() → drivers.user_id) เท่านั้น
--   3. A4 — ไม่มีทางปฏิเสธ/ยกเลิกงาน (มีแค่ค่า 'cancelled' ใน CHECK แต่ไม่มี
--      ใครเขียน) → เพิ่ม driver_decline_assignment / admin_cancel_assignment
--      + trigger ปิดงานค้างเมื่อออเดอร์ cancelled/failed (เก็บประวัติไว้)
--
-- DESIGN (server-authoritative, ตามแบบ 041/115/119/120):
--   * identity = JWT ONLY — ไม่มีการเชื่อ phone/driver_id จาก client
--   * bucket `pod-photos` = PRIVATE; path = '<driver_id>/<order_number>-<ts>.jpg';
--     storage policy บังคับโฟลเดอร์แรก = driver id ของผู้เรียก (กันอัปโหลดมั่ว)
--   * driver 'delivered' ต้องมี proof_of_delivery_path แล้ว (ERR_POD_REQUIRED) —
--     admin override (116) ยังใช้ได้กรณีฉุกเฉิน (audited ตามเดิม)
--   * push_subscriptions หนึ่ง endpoint = หนึ่ง audience (customer | driver);
--     register ใหม่สลับ audience ให้เอง (device เดียวใช้ได้ทั้งสองบทบาทแบบสลับ)
--   * decline/cancel เก็บเหตุผล + actor + timestamp + audit_logs เสมอ;
--     แถว assignment ไม่ถูกลบ (ประวัติไม่หาย) — assign ใหม่ผ่าน ON CONFLICT
--     ของ assign_driver ที่ reset ฟิลด์ทำงาน/ปฏิเสธ/ยกเลิกทั้งหมด
-- ============================================

-- ============================================
-- 1. delivery_assignments — POD + decline/cancel fields (additive)
-- ============================================
ALTER TABLE public.delivery_assignments
  ADD COLUMN IF NOT EXISTS proof_of_delivery_url   TEXT,
  ADD COLUMN IF NOT EXISTS proof_of_delivery_path  TEXT,
  ADD COLUMN IF NOT EXISTS pod_captured_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pod_latitude            NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS pod_longitude           NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS decline_reason          TEXT,
  ADD COLUMN IF NOT EXISTS declined_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason           TEXT,
  -- A2: idempotency marker ของ push แจ้งไรเดอร์ (worker claim แล้วตั้งค่า — กันยิงซ้ำ)
  ADD COLUMN IF NOT EXISTS rider_pushed_at         TIMESTAMPTZ;

COMMENT ON COLUMN public.delivery_assignments.proof_of_delivery_path IS
  'Storage object path in private bucket pod-photos (''<driver_id>/<file>''). Written ONLY via driver_attach_pod.';
COMMENT ON COLUMN public.delivery_assignments.proof_of_delivery_url IS
  'Display reference for admin UI (path or signed URL) — the authoritative object is proof_of_delivery_path.';

-- status CHECK: add 'declined' (reassignment target must be visible to admin)
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT conname INTO v_con
    FROM pg_constraint
   WHERE conrelid = 'public.delivery_assignments'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%status%assigned%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.delivery_assignments DROP CONSTRAINT %I', v_con);
  END IF;
  ALTER TABLE public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_status_check
    CHECK (status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'declined', 'cancelled'));
END $$;

-- ============================================
-- 2. Storage bucket pod-photos (PRIVATE) + role-scoped policies
--    Policy pattern from 119 (bucket_id literal — scalar subquery on
--    storage.buckets is hidden by RLS and breaks WITH CHECK).
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('pod-photos', 'pod-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- limit/mime constraints: ตั้งเมื่อคอลัมน์มีจริง (storage ของ Supabase มี,
-- prelude stub ของ CI อาจไม่มี — เขียนแบบ defensive ให้ replay ผ่านทั้งคู่)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'file_size_limit') THEN
    UPDATE storage.buckets SET file_size_limit = 5242880 WHERE id = 'pod-photos';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types') THEN
    UPDATE storage.buckets
       SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
     WHERE id = 'pod-photos';
  END IF;
END $$;

-- upload: only into the caller's own driver folder (first path segment = driver id)
DROP POLICY IF EXISTS pod_photos_driver_upload ON storage.objects;
CREATE POLICY pod_photos_driver_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pod-photos'
    AND split_part(name, '/', 1) = (
          SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid()
        )
  );

-- read: admin (profiles self-read subquery, proven in 119) OR the owning driver
DROP POLICY IF EXISTS pod_photos_admin_or_owner_read ON storage.objects;
CREATE POLICY pod_photos_admin_or_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND (
      (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
      OR split_part(name, '/', 1) = (
           SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid()
         )
    )
  );

-- update/delete: admin only (audit integrity — a rider cannot erase evidence)
DROP POLICY IF EXISTS pod_photos_admin_update ON storage.objects;
CREATE POLICY pod_photos_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS pod_photos_admin_delete ON storage.objects;
CREATE POLICY pod_photos_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
  );

-- ============================================
-- 3. driver_attach_pod — server-authorized POD record (A3)
--    บันทึก object reference ของรูปที่อัปโหลดแล้ว (storage upload เกิดขึ้นก่อน
--    ผ่าน storage policy ที่บังคับโฟลเดอร์ของตน) — เซิร์ฟเวอร์ตรวจ:
--    identity (JWT) · งานเป็นของตน · งานยังไม่ปิด · path อยู่ในโฟลเดอร์ตน
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_attach_pod(
  p_order_number text,
  p_object_path text,
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

  -- path must live in the caller's own driver folder: '<driver_id>/<file>'
  IF split_part(p_object_path, '/', 1) <> v_drv.id THEN
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
-- 4. driver_decline_assignment (A4) — 'assigned' เท่านั้น → 'declined'
--    งานคืนสู่แอดมินมอบหมายใหม่ (assign_driver ON CONFLICT reset สถานะเอง)
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

  -- คืนสถานะไรเดอร์ถ้างานอื่นไม่ค้าง
  UPDATE public.drivers SET status = 'available', updated_at = NOW()
   WHERE id = v_drv.id
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_assignments da
        WHERE da.driver_id = v_drv.id
          AND da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit')
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

-- ============================================
-- 5. admin_cancel_assignment (A4) — แอดมินปิดงานค้าง
--    แถว assignment ไม่ถูกลบ → ประวัติ/audit ไม่หาย
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

  -- คืนสถานะไรเดอร์ถ้างานอื่นไม่ค้าง
  UPDATE public.drivers SET status = 'available', updated_at = NOW()
   WHERE id = v_drv_id
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_assignments da
        WHERE da.driver_id = v_drv_id
          AND da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit')
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

-- ============================================
-- 6. assign_driver (CREATE OR REPLACE จาก 125) — เพิ่มการ reset ฟิลด์
--    POD/decline/cancel เมื่อมอบหมายงานเดิมซ้ำ (ON CONFLICT) — กันหลักฐาน
--    เก่าของงานก่อนหน้าปนกับงานใหม่ และคืนสถานะไรเดอร์คนเดิมถ้างานไม่ค้าง
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

-- ============================================
-- 7. my_deliveries (CREATE OR REPLACE จาก 041) — กรองงานที่ปิดแล้ว
--    (declined/cancelled ไม่ใช่งานของไรเดอร์อีกต่อไป) + เปิดเผยสถานะ POD
--    ให้ UI แสดง "ส่งพร้อมรูปแล้ว" ได้ตรงจริง (signature เดิมทุกตัวอักษร)
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

  RETURN jsonb_build_object('ok', true, 'driver', to_jsonb(v_drv), 'assignments', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

-- ============================================
-- 8. ออเดอร์จบทาง (cancelled/failed) → ปิด assignment ที่ยัง active อัตโนมัติ
--    เก็บแถวเดิมไว้ (ไม่ลบ) + ติดเหตุผล — ประวัติไม่หาย (A4)
-- ============================================
CREATE OR REPLACE FUNCTION public.close_assignments_on_order_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
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

  IF v_n > 0 THEN
    PERFORM public.append_audit_log(
      'delivery_cancelled', 'delivery', NEW.order_number,
      'assignment auto-closed by order ' || NEW.status::text,
      jsonb_build_object('closed_rows', v_n, 'actor', 'system'));
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
-- 9. driver_update_delivery_status (CREATE OR REPLACE จาก 041) — เนื้อเดิมทั้งหมด
--    ยกเว้นเพิ่ม gate เดียว: 'delivered' ต้องมี proof_of_delivery_path แล้ว
--    (A3: ห้ามปิดงานโดยอ้างรูปที่ยังอยู่แค่ client state — ถ้า upload ไม่ผ่าน
--    ให้แก้เครือข่ายแล้วลองใหม่ หรือให้แอดมินใช้ทาง override 116 ซึ่ง audited)
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
-- 10. Push audience ฝั่งไรเดอร์ (A2) — หนึ่ง endpoint = หนึ่ง audience
--     (customer | driver); register ใหม่สลับ audience ให้เอง (device เดียว
--     ใช้ได้ทั้งสองบทบาทแบบสลับ ไม่เกิดแถวซ้ำ — endpoint UNIQUE เดิม)
--     identity มาจาก JWT เท่านั้น: auth.uid() → customers.id / drivers.user_id
-- ============================================
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS driver_id TEXT REFERENCES public.drivers(id) ON DELETE CASCADE,
  ALTER COLUMN customer_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.push_subscriptions'::regclass
       AND conname = 'push_subscriptions_audience_check'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_audience_check
      CHECK (num_nonnulls(customer_id, driver_id) = 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS push_subscriptions_driver_idx
  ON public.push_subscriptions (driver_id);

-- register: ขยาย signature เดิม (4 arg) → + p_audience ('auto'|'customer'|'driver')
DROP FUNCTION IF EXISTS public.register_push_subscription(text, text, text, text);
CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint    text,
  p_p256dh      text,
  p_auth_secret text,
  p_user_agent  text DEFAULT NULL,
  p_audience    text DEFAULT 'auto'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_customer_id text;
  v_driver_id text;
  v_my_customer_id text;
  v_my_driver_id text;
  v_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_endpoint IS NULL OR length(trim(p_endpoint)) < 20
     OR p_p256dh IS NULL OR p_auth_secret IS NULL THEN
    RAISE EXCEPTION 'ERR_SUBSCRIPTION_INVALID';
  END IF;
  IF p_audience NOT IN ('auto', 'customer', 'driver') THEN
    RAISE EXCEPTION 'ERR_SUBSCRIPTION_INVALID';
  END IF;

  -- identity = JWT ONLY: auth.uid() → customers.id / drivers.user_id (subquery ตรงแบบ 115)
  SELECT c.id INTO v_my_customer_id FROM public.customers c WHERE c.user_id = v_uid;
  SELECT d.id INTO v_my_driver_id FROM public.drivers d WHERE d.user_id = v_uid;
  v_customer_id := v_my_customer_id;
  v_driver_id := v_my_driver_id;

  IF p_audience = 'customer' THEN
    IF v_customer_id IS NULL THEN RAISE EXCEPTION 'ERR_NO_CUSTOMER_PROFILE'; END IF;
    v_driver_id := NULL;
  ELSIF p_audience = 'driver' THEN
    IF v_driver_id IS NULL THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;
    v_customer_id := NULL;
  ELSE
    -- auto: customer มาก่อน (พฤติกรรมเดิมของ 115); ไม่มีลูกค้าแต่เป็นไรเดอร์ → driver
    IF v_customer_id IS NULL AND v_driver_id IS NULL THEN
      RAISE EXCEPTION 'ERR_NO_CUSTOMER_PROFILE';
    END IF;
    IF v_customer_id IS NOT NULL THEN v_driver_id := NULL; END IF;
  END IF;

  SELECT id INTO v_id FROM public.push_subscriptions
   WHERE endpoint = p_endpoint
     AND (customer_id = v_my_customer_id OR driver_id = v_my_driver_id); -- เจ้าของเท่านั้น (กัน hijack endpoint)
  IF FOUND THEN
    UPDATE public.push_subscriptions
       SET customer_id = v_customer_id,
           driver_id = v_driver_id,
           p256dh = p_p256dh,
           auth_secret = p_auth_secret,
           user_agent = COALESCE(p_user_agent, user_agent),
           failure_count = 0,
           last_failure_at = NULL,
           updated_at = NOW()
     WHERE endpoint = p_endpoint;
  ELSE
    v_id := 'push-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 6);
    INSERT INTO public.push_subscriptions
      (id, customer_id, driver_id, endpoint, p256dh, auth_secret, user_agent, created_at, updated_at)
    VALUES
      (v_id, v_customer_id, v_driver_id, p_endpoint, p_p256dh, p_auth_secret, p_user_agent, NOW(), NOW());
  END IF;

  RETURN jsonb_build_object('id', v_id, 'ok', true,
                            'audience', CASE WHEN v_driver_id IS NOT NULL THEN 'driver' ELSE 'customer' END);
END;
$$;

-- unregister: แถว customer/driver ของผู้เรียก · คง semantics 115:
--   ไม่ส่ง id/endpoint = ลบทุกอุปกรณ์ของตน + ปิด push pref ของลูกค้า
CREATE OR REPLACE FUNCTION public.unregister_push_subscription(
  p_subscription_id text DEFAULT NULL,
  p_endpoint        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_customer_id text;
  v_driver_id text;
  v_removed int := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT c.id INTO v_customer_id FROM public.customers c WHERE c.user_id = v_uid;
  SELECT d.id INTO v_driver_id FROM public.drivers d WHERE d.user_id = v_uid;

  IF p_subscription_id IS NULL AND p_endpoint IS NULL THEN
    -- legacy semantics (115): ไม่ระบุ target = ปิด push ทุกอุปกรณ์ของฉัน
    DELETE FROM public.push_subscriptions
     WHERE (v_customer_id IS NOT NULL AND customer_id = v_customer_id)
        OR (v_driver_id IS NOT NULL AND driver_id = v_driver_id);
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    IF v_customer_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE customer_id = v_customer_id) THEN
      UPDATE public.notification_prefs
         SET push_enabled = FALSE, updated_at = NOW()
       WHERE customer_id = v_customer_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'removed', v_removed);
  END IF;

  DELETE FROM public.push_subscriptions
   WHERE ((p_subscription_id IS NOT NULL AND id = p_subscription_id)
       OR (p_endpoint IS NOT NULL AND endpoint = p_endpoint))
     AND (
       (v_customer_id IS NOT NULL AND customer_id = v_customer_id)
       OR (v_driver_id IS NOT NULL AND driver_id = v_driver_id)
     );
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- Last endpoint gone -> the customer no longer wants push (115 behavior kept)
  IF v_customer_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE customer_id = v_customer_id) THEN
    UPDATE public.notification_prefs
       SET push_enabled = FALSE, updated_at = NOW()
     WHERE customer_id = v_customer_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'removed', v_removed);
END;
$$;

-- list: รวมทั้งแถว customer และ driver ของผู้เรียก (ไม่คืน endpoint tokens)
CREATE OR REPLACE FUNCTION public.list_my_push_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_customer_id text;
  v_driver_id text;
  v_rows jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT c.id INTO v_customer_id FROM public.customers c WHERE c.user_id = v_uid;
  SELECT d.id INTO v_driver_id FROM public.drivers d WHERE d.user_id = v_uid;

  SELECT jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at,
                                      'last_success_at', last_success_at, 'user_agent', user_agent))
    INTO v_rows
    FROM (
      SELECT id, created_at, last_success_at, user_agent
        FROM public.push_subscriptions
       WHERE (v_customer_id IS NOT NULL AND customer_id = v_customer_id)
          OR (v_driver_id IS NOT NULL AND driver_id = v_driver_id)
       ORDER BY created_at DESC
    ) s;

  RETURN jsonb_build_object('subscriptions', v_rows);
END;
$$;

-- claim ฝั่ง driver (service_role ONLY — push-send เรียกเท่านั้น)
CREATE OR REPLACE FUNCTION public.claim_push_driver_targets(
  p_driver_id text,
  p_limit     integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF p_driver_id IS NULL THEN
    RAISE EXCEPTION 'ERR_INVALID_DRIVER';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', id, 'endpoint', endpoint,
           'p256dh', p256dh, 'auth_secret', auth_secret
         )), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT id, endpoint, p256dh, auth_secret
        FROM public.push_subscriptions
       WHERE driver_id = p_driver_id
         AND failure_count < 10
       ORDER BY updated_at DESC
       LIMIT GREATEST(1, LEAST(50, p_limit))
    ) s;

  RETURN jsonb_build_object('ok', true, 'targets', v_rows);
END;
$$;

-- RLS SELECT: อ่านได้ทั้งแถวตัวเองแบบ customer และ driver (ชื่อ policy เดิมของ 115)
DROP POLICY IF EXISTS push_subscriptions_customer_read ON public.push_subscriptions;
DROP POLICY IF EXISTS myPushSubscriptionsPolicy ON public.push_subscriptions;
CREATE POLICY push_subscriptions_customer_read ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR driver_id  IN (SELECT id FROM public.drivers   WHERE user_id = auth.uid())
  );

-- Grants — customer/driver-facing ให้ authenticated; claim ฝั่ง driver = service_role
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_subscription(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_push_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_driver_targets(text, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_push_driver_targets(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unregister_push_subscription(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.driver_attach_pod(text, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_decline_assignment(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_assignment(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_attach_pod(text, text, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_decline_assignment(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_assignment(text, text) FROM PUBLIC, anon;

-- ============================================
-- CONTRACT NOTES (132)
-- * identity ทุกฟังก์ชัน = JWT (auth.uid()) — ไม่มีจุดที่เชื่อ phone/driver_id
-- * delivery_assignments ไม่มีทางถูกลบจากฟังก์ชันเหล่านี้ (ประวัติคงอยู่)
-- * 'delivered' ฝั่งไรเดอร์ต้องมี POD แล้ว; admin override (116) ยังใช้ได้
-- * push_subscriptions: num_nonnulls(customer_id, driver_id) = 1 เสมอ
-- * bucket pod-photos = private; path ต้องขึ้นต้นด้วย driver id ของผู้เรียก
-- ============================================