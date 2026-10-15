-- ============================================
-- Bite Me Baby Migration 125: driver home_branch_id / assignment branch_id repair
-- Date: 2026-10-14 · Baseline: m124 deployed
--
-- BUG (owner report 2026-10-14 — "เพิ่มไดร์เวอร์ไม่ได้"):
--   Migration 087 enforced NOT NULL on drivers.home_branch_id and
--   delivery_assignments.branch_id, but the three dispatch RPCs were never
--   updated:
--     · upsert_driver — INSERT omits home_branch_id  → 23502 on every add
--     · assign_driver — INSERT omits branch_id       → 23502 at hand-off
--     · driver_login  — defensive: backfill if a legacy row is ever unlinked
-- FIX (behavior-preserving):
--   + resolve_home_branch_id(): สาขาหลัก (branches.is_default) → สาขาแรกของ
--     tenant → สร้างสาขา main ให้ถ้ายังไม่มี (แบบ m084) — single source ของ
--     ทั้ง 3 ฟังก์ชัน
--   + SET DEFAULT บนคอลัมน์ NOT NULL ทั้งสอง (defense in depth แบบ m103)
--   + 3 RPCs เติมค่าสาขาอัตโนมัติ; assign_driver ใช้ home_branch_id ของ
--     ไรเดอร์ก่อน แล้วค่อย fallback ไปสาขาหลัก
-- UNCHANGED: signatures, guard model (ERR_NOT_AUTHENTICATED / ERR_FORBIDDEN),
--   error codes, return shapes, ON CONFLICT (phone)/(order_number) semantics
-- VERIFY: e2e/contracts_125_driver_home_branch.sql (BEGIN…ROLLBACK, ไม่เขียน
--   ข้อมูลค้าง) + live probe add/delete test driver
-- ============================================

BEGIN;

-- ============================================
-- 1. Branch resolver — สาขาหลัก → สาขาแรก → สร้างใหม่ (m084 pattern)
-- ============================================
CREATE OR REPLACE FUNCTION public.resolve_home_branch_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant TEXT;
  v_branch TEXT;
BEGIN
  v_tenant := public.default_tenant_id();
  IF v_tenant IS NULL THEN
    RETURN NULL;
  END IF;

  -- สาขาหลักของ tenant ก่อน
  SELECT id INTO v_branch
    FROM public.branches
   WHERE tenant_id = v_tenant AND is_default = true
   LIMIT 1;

  -- ไม่มีสาขาหลัก → สาขาแรกที่มี
  IF v_branch IS NULL THEN
    SELECT id INTO v_branch
      FROM public.branches
     WHERE tenant_id = v_tenant
     ORDER BY created_at ASC, id ASC
     LIMIT 1;
  END IF;

  -- ยังไม่มีสาขาเลย → สร้างสาขา main (แบบ m084)
  IF v_branch IS NULL THEN
    INSERT INTO public.branches (
      id, tenant_id, code, name, slug,
      address_line1, city, province, country,
      latitude, longitude, service_radius_km, is_default
    ) VALUES (
      'branch-' || v_tenant || '-main',
      v_tenant, 'main', 'Main Branch', 'main',
      'Default Address', 'Bangkok', 'Bangkok', 'TH',
      10.7016, 102.1429, 5.00, true
    )
    ON CONFLICT (tenant_id, code) DO UPDATE SET id = EXCLUDED.id
    RETURNING id INTO v_branch;
  END IF;

  RETURN v_branch;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_home_branch_id() FROM PUBLIC, anon;

-- ============================================
-- 2. Column defaults (defense in depth — client/UX paths ที่ยังไม่ผ่าน RPC)
-- ============================================
ALTER TABLE public.drivers
  ALTER COLUMN home_branch_id SET DEFAULT public.resolve_home_branch_id();
ALTER TABLE public.delivery_assignments
  ALTER COLUMN branch_id SET DEFAULT public.resolve_home_branch_id();

-- ============================================
-- 3. upsert_driver — เติม home_branch_id อัตโนมัติ (สาเหตุหลักของบั๊ก)
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_driver(
  p_name text,
  p_phone text,
  p_vehicle_label text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_id  text;
  v_branch text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF p_name IS NULL OR trim(p_name) = '' OR p_phone IS NULL OR trim(p_phone) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;

  v_branch := public.resolve_home_branch_id();
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'ERR_BRANCH_UNAVAILABLE';
  END IF;

  v_id := 'drv-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 4);
  INSERT INTO public.drivers (id, name, phone, vehicle_label, status, home_branch_id, created_at, updated_at)
  VALUES (v_id, trim(p_name), trim(p_phone), COALESCE(p_vehicle_label, ''), 'offline', v_branch, NOW(), NOW())
  ON CONFLICT (phone) DO UPDATE
    SET name = EXCLUDED.name, vehicle_label = EXCLUDED.vehicle_label,
        home_branch_id = COALESCE(public.drivers.home_branch_id, EXCLUDED.home_branch_id),
        updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'driver_id', v_id, 'phone', trim(p_phone), 'home_branch_id', v_branch);
END;
$$;

-- ============================================
-- 4. assign_driver — เติม branch_id ของงานส่ง (บั๊กตอนมอบหมายงาน)
--    สาขา = home_branch_id ของไรเดอร์คนนั้น → fallback สาขาหลัก
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

  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status, branch_id, assigned_at, notes, created_at, updated_at)
  VALUES (
    'das-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 4),
    p_order_number, p_driver_id, 'assigned', v_branch, NOW(), 'assigned by admin', NOW(), NOW()
  )
  ON CONFLICT (order_number) DO UPDATE
    SET driver_id = EXCLUDED.driver_id, status = 'assigned', branch_id = EXCLUDED.branch_id, assigned_at = NOW(),
        accepted_at = NULL, picked_up_at = NULL, in_transit_at = NULL, delivered_at = NULL,
        updated_at = NOW();

  UPDATE public.drivers SET status = 'busy', updated_at = NOW() WHERE id = p_driver_id;

  PERFORM public.append_audit_log('delivery_assigned', 'delivery', p_order_number, 'delivery assigned to driver ' || p_driver_id, jsonb_build_object('driver_id', p_driver_id, 'branch_id', v_branch));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'driver_id', p_driver_id, 'status', 'assigned', 'branch_id', v_branch);
END;
$$;

-- ============================================
-- 5. driver_login (m041 JWT-bound) — backfill กันข้อมูลเก่าหลุด (defensive)
--    ฟังก์ชันนี้ไม่มี INSERT แล้ว (admin provisioning เท่านั้น) — เติมเฉพาะ
--    แถวเก่าที่ home_branch_id ยังว่าง ถ้าเงื่อนไข NOT NULL ถูกคลายในอนาคต
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_login(
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
  v_branch text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;

  -- Identity = JWT ONLY. Phone/name/driver_id from the client are NOT trusted.
  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_NOT_A_DRIVER: no driver record is linked to this account (admin provisioning required)';
  END IF;

  v_branch := COALESCE(v_drv.home_branch_id, public.resolve_home_branch_id());

  UPDATE public.drivers
     SET status = CASE WHEN status = 'busy' THEN 'busy' ELSE 'available' END,
         home_branch_id = COALESCE(home_branch_id, v_branch),
         last_seen_at = NOW(), updated_at = NOW()
   WHERE id = v_drv.id
   RETURNING * INTO v_drv;

  RETURN jsonb_build_object('ok', true, 'driver', to_jsonb(v_drv));
END;
$$;

COMMIT;
