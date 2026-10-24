-- ============================================================
-- Migration 146 — Role foundation (Owner sign-off P1-P3 + missing/partial ทั้งหมด)
-- Owner directive 2026-10-24: "P1-p3 อนุมัติ signoff · งาน missing ทำให้หมด ·
--   งาน partial ทำให้สมบูรณ์ทั้งระบบ · จะรอทดสอบบนโปรดักชั่นจริงเท่านั้น"
-- Scope ตาม docs/BMB_ROLE_PERMISSION_AI_AUDIT_2026-10-24.md §7 (signed off):
--   146a) profiles_role_check = 13 ค่า (โมเดลเดิม 1 ระบบ ไม่สร้างตาราง/ระบบใหม่)
--   146b) predicates: is_admin(+owner) · is_staff(+pos) · is_owner/is_kitchen/
--         is_inventory/is_finance/is_marketing/is_pos/is_auditor/is_support/
--         is_developer/is_rider (ทุกตัว = profiles.role เป็นแหล่งเดียว)
--   146c) set_user_role RPC (admin gate · promote เป็น owner ต้องเป็น owner เอง
--         · ห้ามเปลี่ยน role ตัวเอง · audit ทุกครั้ง)
--   146d) rider backfill (profiles ของ linked drivers → 'rider') + trigger
--         drivers_promote_rider ตอน link user_id (ทำให้ rider สมบูรณ์ #6/P3)
-- สัญญาทดสอบ: e2e/contracts_146.sql (+ 147 สำหรับ access matrix)
-- Rollback: apply ใหม่ 129/006/041 (constraint + predicates กลับ 3-ค่าเดิม)
-- ============================================================

BEGIN;

-- ============================================
-- 146a) ขยาย role CHECK — 13 ค่าบนคอลัมน์เดิม (production มี customer×4 admin×1)
-- ============================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'customer', 'staff', 'admin', 'owner', 'auditor', 'support', 'developer',
  'kitchen', 'inventory', 'finance', 'marketing', 'pos', 'rider'
));

-- ============================================
-- 146b) Authority predicates — แหล่งความจริงเดียว = profiles.role
--   is_admin  = admin|owner (owner เป็น superset ของ admin ทุก policy เดิม)
--   is_staff  = admin|owner|staff|pos + is_active (เสริมแค่ pos — legacy ไม่เปลี่ยน)
--   ที่เหลือ = specialist รายตัว (policy เฉพาะทางเขียนใน 147)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND role IN ('admin', 'owner', 'staff', 'pos') AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_kitchen() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'kitchen' AND is_active = true);$$;
CREATE OR REPLACE FUNCTION public.is_inventory() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'inventory' AND is_active = true);$$;
CREATE OR REPLACE FUNCTION public.is_finance() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'finance' AND is_active = true);$$;
CREATE OR REPLACE FUNCTION public.is_marketing() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'marketing' AND is_active = true);$$;
CREATE OR REPLACE FUNCTION public.is_pos() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pos' AND is_active = true);$$;
CREATE OR REPLACE FUNCTION public.is_auditor() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'auditor' AND is_active = true);$$;
CREATE OR REPLACE FUNCTION public.is_support() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'support' AND is_active = true);$$;
CREATE OR REPLACE FUNCTION public.is_developer() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'developer' AND is_active = true);$$;
CREATE OR REPLACE FUNCTION public.is_rider() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'rider' AND is_active = true);$$;

REVOKE EXECUTE ON FUNCTION public.is_owner() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_kitchen() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_inventory() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_finance() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_marketing() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_pos() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_auditor() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_support() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_developer() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_rider() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_owner(), public.is_kitchen(), public.is_inventory(),
  public.is_finance(), public.is_marketing(), public.is_pos(), public.is_auditor(),
  public.is_support(), public.is_developer(), public.is_rider() TO authenticated;

-- ============================================
-- 146c) set_user_role — ทางการเดียวในการเปลี่ยน role (ทุกวันนี้ไม่มี UI/RPC)
--   gate: caller ต้อง is_admin() · promote → 'owner' ต้องเป็น owner เอง
--   · ห้ามเปลี่ยน role ตัวเอง (กัน self-lock/self-escalate) · audit ทุกครั้ง
-- ============================================
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old text;
  v_target_active boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_role NOT IN ('customer','staff','admin','owner','auditor','support','developer',
                    'kitchen','inventory','finance','marketing','pos','rider') THEN
    RAISE EXCEPTION 'ERR_ROLE_INVALID: %', p_role;
  END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION 'ERR_ROLE_SELF'; END IF;
  IF p_role = 'owner' AND NOT public.is_owner() THEN RAISE EXCEPTION 'ERR_FORBIDDEN_OWNER_ONLY'; END IF;

  SELECT role, is_active INTO v_old, v_target_active FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_USER_NOT_FOUND'; END IF;

  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;

  PERFORM public.append_audit_log(
    p_action := 'role_change', p_entity_type := 'profile', p_entity_id := p_user_id::text,
    p_description := 'role ' || COALESCE(v_old, '?') || ' -> ' || p_role,
    p_metadata := jsonb_build_object('from', v_old, 'to', p_role, 'target_active', v_target_active));
  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'from', v_old, 'to', p_role);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

-- ============================================
-- 146d) rider สมบูรณ์ (#6/P3): backfill linked drivers + trigger ตอน link user
--   (production ตอนนี้ linked_drivers=1, profiles role=customer → โดน backfill)
-- ============================================
UPDATE public.profiles p
   SET role = 'rider'
  FROM public.drivers d
 WHERE d.user_id = p.id
   AND p.role IN ('customer', 'staff')
   AND p.is_active = true;

CREATE OR REPLACE FUNCTION public.drivers_promote_rider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
       SET role = 'rider'
     WHERE id = NEW.user_id
       AND role IN ('customer', 'staff')
       AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.drivers_promote_rider() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS drivers_promote_rider ON public.drivers;
CREATE TRIGGER drivers_promote_rider
  AFTER INSERT OR UPDATE OF user_id ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.drivers_promote_rider();

COMMIT;