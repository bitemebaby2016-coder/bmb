-- ============================================
-- Bite Me Baby — SQL Contract: Migration 146 (role foundation)
-- Owner sign-off 2026-10-24: P1-P3 + missing/partial ทั้งหมด · ONE transaction, ROLLBACK
-- Proves:
--   G1 predicates ราย role · G2 set_user_role gates · G3 role CHECK ครบ 13 ค่า
--   G4 rider trigger (link user_id -> profile = 'rider')
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000c14601', 'c146-owner@example.com'),
  ('00000000-0000-4000-8000-000000c14602', 'c146-admin@example.com'),
  ('00000000-0000-4000-8000-000000c14603', 'c146-kitchen@example.com'),
  ('00000000-0000-4000-8000-000000c14604', 'c146-inventory@example.com'),
  ('00000000-0000-4000-8000-000000c14605', 'c146-finance@example.com'),
  ('00000000-0000-4000-8000-000000c14606', 'c146-marketing@example.com'),
  ('00000000-0000-4000-8000-000000c14607', 'c146-pos@example.com'),
  ('00000000-0000-4000-8000-000000c14608', 'c146-support@example.com'),
  ('00000000-0000-4000-8000-000000c14609', 'c146-auditor@example.com'),
  ('00000000-0000-4000-8000-000000c14610', 'c146-developer@example.com'),
  ('00000000-0000-4000-8000-000000c14611', 'c146-rider@example.com'),
  ('00000000-0000-4000-8000-000000c14612', 'c146-customer@example.com'),
  ('00000000-0000-4000-8000-000000c14613', 'c146-staff@example.com'),
  ('00000000-0000-4000-8000-000000c14614', 'c146-linkme@example.com');

UPDATE profiles SET role='owner'     WHERE id = '00000000-0000-4000-8000-000000c14601';
UPDATE profiles SET role='admin'     WHERE id = '00000000-0000-4000-8000-000000c14602';
UPDATE profiles SET role='kitchen'   WHERE id = '00000000-0000-4000-8000-000000c14603';
UPDATE profiles SET role='inventory' WHERE id = '00000000-0000-4000-8000-000000c14604';
UPDATE profiles SET role='finance'   WHERE id = '00000000-0000-4000-8000-000000c14605';
UPDATE profiles SET role='marketing' WHERE id = '00000000-0000-4000-8000-000000c14606';
UPDATE profiles SET role='pos'       WHERE id = '00000000-0000-4000-8000-000000c14607';
UPDATE profiles SET role='support'   WHERE id = '00000000-0000-4000-8000-000000c14608';
UPDATE profiles SET role='auditor'   WHERE id = '00000000-0000-4000-8000-000000c14609';
UPDATE profiles SET role='developer' WHERE id = '00000000-0000-4000-8000-000000c14610';
UPDATE profiles SET role='rider'     WHERE id = '00000000-0000-4000-8000-000000c14611';
UPDATE profiles SET role='staff'     WHERE id = '00000000-0000-4000-8000-000000c14613';

DO $$
BEGIN
  -- G1a: owner = admin-superset + staff-family
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14601","role":"authenticated"}', false);
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'G1 FAIL: owner must satisfy is_admin()'; END IF;
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'G1 FAIL: is_owner() for owner'; END IF;
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'G1 FAIL: owner in staff-family'; END IF;

  -- G1b: admin unchanged
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14602","role":"authenticated"}', false);
  IF NOT public.is_admin() OR public.is_owner() THEN RAISE EXCEPTION 'G1 FAIL: admin is_admin=true is_owner=false'; END IF;

  -- G1c: kitchen = specialist, NOT admin/staff
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14603","role":"authenticated"}', false);
  IF NOT public.is_kitchen() OR public.is_admin() OR public.is_staff() THEN RAISE EXCEPTION 'G1 FAIL: kitchen predicate set'; END IF;

  -- G1d: pos = staff-family (legacy POS parity)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14607","role":"authenticated"}', false);
  IF NOT public.is_pos() OR NOT public.is_staff() THEN RAISE EXCEPTION 'G1 FAIL: pos must satisfy is_pos + is_staff'; END IF;

  -- G1e: inventory/finance/marketing
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14604","role":"authenticated"}', false);
  IF NOT public.is_inventory() OR public.is_staff() THEN RAISE EXCEPTION 'G1 FAIL: inventory predicate'; END IF;
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14605","role":"authenticated"}', false);
  IF NOT public.is_finance() OR public.is_staff() THEN RAISE EXCEPTION 'G1 FAIL: finance predicate'; END IF;
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14606","role":"authenticated"}', false);
  IF NOT public.is_marketing() OR public.is_staff() THEN RAISE EXCEPTION 'G1 FAIL: marketing predicate'; END IF;

  -- G1f: support/auditor/developer/rider — แยกจาก is_staff (อ่านอย่างเดียว/riders เท่านั้น)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14608","role":"authenticated"}', false);
  IF NOT public.is_support() OR public.is_staff() OR public.is_admin() THEN RAISE EXCEPTION 'G1 FAIL: support predicate'; END IF;
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14609","role":"authenticated"}', false);
  IF NOT public.is_auditor() OR public.is_staff() OR public.is_admin() THEN RAISE EXCEPTION 'G1 FAIL: auditor predicate'; END IF;
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14610","role":"authenticated"}', false);
  IF NOT public.is_developer() OR public.is_staff() OR public.is_admin() THEN RAISE EXCEPTION 'G1 FAIL: developer predicate'; END IF;
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14611","role":"authenticated"}', false);
  IF NOT public.is_rider() OR public.is_staff() THEN RAISE EXCEPTION 'G1 FAIL: rider predicate'; END IF;

  -- G1g: plain customer ไม่ผ่าน predicate แอดมินใด ๆ
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14612","role":"authenticated"}', false);
  IF public.is_admin() OR public.is_staff() OR public.is_kitchen() OR public.is_auditor()
     OR public.is_support() OR public.is_developer() OR public.is_rider() THEN
    RAISE EXCEPTION 'G1 FAIL: customer must fail every privileged predicate';
  END IF;
  RAISE NOTICE 'G1 PASS';
END $$;

DO $$
DECLARE v_ok boolean; v_err text; v_role text;
BEGIN
  -- ===== G2: set_user_role gates =====
  -- 2a: admin promote customer -> kitchen ได้ + audit path รัน (definer)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14602","role":"authenticated"}', false);
  v_ok := (public.set_user_role('00000000-0000-4000-8000-000000c14612', 'kitchen')->>'ok')::boolean;
  SELECT role INTO v_role FROM profiles WHERE id = '00000000-0000-4000-8000-000000c14612';
  IF NOT v_ok OR v_role <> 'kitchen' THEN RAISE EXCEPTION 'G2 FAIL: admin promote kitchen (ok=% role=%)', v_ok, v_role; END IF;

  -- 2b: admin ให้ owner ไม่ได้ (owner-only)
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.set_user_role('00000000-0000-4000-8000-000000c14612', 'owner');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  IF v_ok OR v_err NOT LIKE 'ERR_FORBIDDEN_OWNER_ONLY%' THEN
    RAISE EXCEPTION 'G2 FAIL: owner-only promote (ok=% err=%)', v_ok, v_err;
  END IF;

  -- 2c: เปลี่ยน role ตัวเองไม่ได้
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.set_user_role('00000000-0000-4000-8000-000000c14602', 'kitchen');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  IF v_ok OR v_err NOT LIKE 'ERR_ROLE_SELF%' THEN
    RAISE EXCEPTION 'G2 FAIL: self-role guard (ok=% err=%)', v_ok, v_err;
  END IF;

  -- 2d: non-admin เรียกไม่ได้
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14612","role":"authenticated"}', false);
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.set_user_role('00000000-0000-4000-8000-000000c14613', 'kitchen');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  IF v_ok OR v_err NOT LIKE 'ERR_FORBIDDEN%' THEN
    RAISE EXCEPTION 'G2 FAIL: non-admin denied (ok=% err=%)', v_ok, v_err;
  END IF;

  -- 2e: owner promote เป็น owner ได้ (คนแรก/แต่งตั้งกันเอง)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14601","role":"authenticated"}', false);
  v_ok := (public.set_user_role('00000000-0000-4000-8000-000000c14612', 'owner')->>'ok')::boolean;
  SELECT role INTO v_role FROM profiles WHERE id = '00000000-0000-4000-8000-000000c14612';
  IF NOT v_ok OR v_role <> 'owner' THEN RAISE EXCEPTION 'G2 FAIL: owner promote owner'; END IF;

  -- 2f: role นอก whitelist
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c14602","role":"authenticated"}', false);
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.set_user_role('00000000-0000-4000-8000-000000c14612', 'superuser');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  IF v_ok OR v_err NOT LIKE 'ERR_ROLE_INVALID%' THEN
    RAISE EXCEPTION 'G2 FAIL: invalid role rejected (ok=% err=%)', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G2 PASS';
END $$;

DO $$
DECLARE r text; v_count integer;
BEGIN
  -- ===== G3: profiles_role_check รับครบ 13 ค่า =====
  FOREACH r IN ARRAY ARRAY['customer','staff','admin','owner','auditor','support','developer',
                           'kitchen','inventory','finance','marketing','pos','rider'] LOOP
    UPDATE profiles SET role = r WHERE id = '00000000-0000-4000-8000-000000c14612';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'G3 FAIL: cannot set role % (rows=%)', r, v_count; END IF;
  END LOOP;
  RAISE NOTICE 'G3 PASS (all 13 role values accepted)';
END $$;

DO $$
DECLARE v_role text;
BEGIN
  -- ===== G4: rider trigger — link drivers.user_id ทำให้ profile เป็น 'rider' =====
  INSERT INTO public.drivers (id, name, phone) VALUES ('drv-146', 'R146', '0991461460');
  UPDATE public.drivers SET user_id = '00000000-0000-4000-8000-000000c14614' WHERE id = 'drv-146';
  SELECT role INTO v_role FROM profiles WHERE id = '00000000-0000-4000-8000-000000c14614';
  IF v_role <> 'rider' THEN RAISE EXCEPTION 'G4 FAIL: linked profile must become rider (got %)', v_role; END IF;
  RAISE NOTICE 'G4 PASS (drivers_promote_rider fired)';
END $$;

ROLLBACK;