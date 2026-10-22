-- ============================================
-- Bite Me Baby — SQL Contract: Migration 136 driver location history (E3)
-- Date: 2026-10-22 · ONE transaction, ROLLBACK at the end — zero persisted data.
-- Proves:
--   G1  driver_update_location (rider) = อัปเดต drivers position + append ประวัติ
--   G2  ผูก order เฉพาะ assignment ที่ยัง active (งานปิดแล้ว = ไม่เก็บประวัติผี)
--   G3  non-driver ยิงไม่ได้ (ERR_NOT_A_DRIVER) · anon ไม่มี EXECUTE
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('81616161-6161-6161-6161-616161616161', 'c136-rider@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('82626262-6262-6262-6262-626262626262', 'c136-cust@bmb.test',  'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, created_at, updated_at)
VALUES
  ('81616161-6161-6161-6161-616161616161', 'customer', now(), now()),
  ('82626262-6262-6262-6262-626262626262', 'customer', now(), now())
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.driver_location_history, public.drivers, public.delivery_assignments TO authenticated;

INSERT INTO public.drivers (id, name, phone, status, created_at, updated_at)
VALUES ('drv-136-a', 'C136 Rider', '0955555555', 'available', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
UPDATE public.drivers SET user_id = '81616161-6161-6161-6161-616161616161' WHERE id = 'drv-136-a';

-- ============================================
-- G1+G2. heartbeat + ผูกงานเฉพาะที่ active
-- ============================================
DO $$ DECLARE
  v_n int; v_lat numeric; v_order text;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"81616161-6161-6161-6161-616161616161","role":"authenticated"}', false);

  -- G1: ไม่มีออเดอร์ = อัปเดตตำแหน่ง + ประวัติ (order_number NULL)
  PERFORM public.driver_update_location(12.6157, 102.0981, NULL);
  SELECT current_latitude INTO v_lat FROM public.drivers WHERE id = 'drv-136-a';
  IF v_lat IS NULL OR abs(v_lat - 12.6157) > 0.0001 THEN RAISE EXCEPTION 'FAIL G1 drivers position not updated'; END IF;
  SELECT COUNT(*) INTO v_n FROM public.driver_location_history WHERE driver_id = 'drv-136-a';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL G1 history row missing (got %)', v_n; END IF;

  -- G2: order_number ที่ไม่ใช่งานของฉัน/ไม่ active = ไม่ผูก (กันประวัติผี)
  PERFORM public.driver_update_location(12.6158, 102.0982, 'BMB-NO-SUCH');
  SELECT order_number INTO v_order FROM public.driver_location_history
   WHERE driver_id = 'drv-136-a' ORDER BY recorded_at DESC LIMIT 1;
  IF v_order IS NOT NULL THEN RAISE EXCEPTION 'FAIL G2 must not bind inactive/foreign order'; END IF;
  RAISE NOTICE 'PASS G1+G2 location heartbeat + active-order binding';
END $$;

-- ============================================
-- G3. security — non-driver ยิงไม่ได้ · anon ไม่มี EXECUTE
-- ============================================
DO $$ DECLARE v_ok boolean;
BEGIN
  IF has_function_privilege('anon', 'public.driver_update_location(numeric,numeric,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL G3 anon must not execute driver_update_location';
  END IF;
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"82626262-6262-6262-6262-626262626262","role":"authenticated"}', false);
  BEGIN
    PERFORM public.driver_update_location(12.6, 102.1, NULL);
    RAISE EXCEPTION 'FAIL G3 non-driver heartbeat must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NOT_A_DRIVER%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS G3 actor guards hold';
END $$;

ROLLBACK;