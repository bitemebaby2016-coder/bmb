-- ============================================
-- Bite Me Baby — Migration 139: POD storage policy repair (D-02 · P0-2)
-- Date: 2026-10-23
-- ============================================
-- WHY (evidence 2026-10-23 · docs/BMB_RECOVERY_PLAN_2026-10-23.md D-02):
--   `pod_photos_driver_upload` (132:94-101) ใช้ scalar subquery กับ public.drivers
--   ใน WITH CHECK — ชนิดเดียวกับที่ 119 เองบันทึกไว้ว่า "scalar subquery … is hidden
--   by RLS and breaks WITH CHECK" (132 เลี่ยงเฉพาะ subquery บน storage.buckets
--   แต่ subquery ฝั่ง drivers ยังอยู่) → ผลลัพธ์ใน policy context เป็น NULL/ไม่ตรง
--   → ทุก INSERT โดน "new row violates row-level security policy" — หลักฐานชี้ขาด:
--   pod-photos มี object 0 ชิ้นตลอดกาล ขณะที่ payment-slips (133:57-66 เทียบ
--   auth.uid() ตรง ไม่มี subquery) อัปโหลดผ่านจริง · ตัวซ้ำเติม: drivers.id มี
--   space + storage-js encodeURIComponent ทุก segment → ชื่อ object อาจเป็น
--   'drv-%20…' ขณะ policy เทียบ 'drv- …'
--   และ policy ฝั่งอ่าน (pod_photos_admin_or_owner_read/update/delete) ก็ใช้
--   subquery เข้า profiles/drivers แบบเดียวกัน — เปลี่ยนเป็น helper ทั้งหมด
--
-- WHAT (trusted helper pattern — เดียวกับ is_admin() ที่ 133 ใช้แล้วผ่านจริง):
--   1. current_driver_id() — SECURITY DEFINER: drivers.id ของ auth.uid()
--      (bypass RLS — ไม่มี subquery ใน policy expression อีก)
--   2. pod_path_is_driver(name) — SECURITY DEFINER: โฟลเดอร์แรกของ object =
--      driver id ของผู้เรียก (ทน encoding: เทียบทั้งแบบ decoded และ %20-encoded)
--   3. policy ใหม่ทั้ง 4 ตัวบน storage.objects ของ bucket pod-photos:
--      upload = เจ้าของโฟลเดอร์เท่านั้น · read = admin หรือเจ้าของ
--      update/delete = admin เท่านั้น (ไรเดอร์ลบหลักฐานไม่ได้)
--   4. ไม่มีการ rename drivers.id / ย้าย object ใน production (ต้องรายงาน
--      ผลกระทบและขอ Owner approve ก่อนเสมอ) — normalize ที่ path เทียบเท่านั้น
-- ============================================

BEGIN;

-- --------------------------------------------
-- 1. Trusted helpers (SECURITY DEFINER — RLS ของ drivers ไม่บัง)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.current_driver_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.pod_path_is_driver(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_driver_id() IS NOT NULL
     AND replace(split_part(coalesce(p_name, ''), '/', 1), '%20', ' ')
         = public.current_driver_id();
$$;

REVOKE EXECUTE ON FUNCTION public.current_driver_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_driver_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pod_path_is_driver(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pod_path_is_driver(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.current_driver_id IS
  'D-02 (migration 139): trusted driver identity for storage policies — SECURITY DEFINER so RLS on public.drivers cannot NULL the result (lesson 119/132).';
COMMENT ON FUNCTION public.pod_path_is_driver IS
  'D-02 (migration 139): true when the object first path segment is the caller driver id (raw or URL-encoded %20 form).';

-- --------------------------------------------
-- 2. Storage policies — NO scalar subqueries (lesson 119/132)
-- --------------------------------------------
DROP POLICY IF EXISTS pod_photos_driver_upload ON storage.objects;
CREATE POLICY pod_photos_driver_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pod-photos'
    AND public.pod_path_is_driver(name)
  );

DROP POLICY IF EXISTS pod_photos_admin_or_owner_read ON storage.objects;
CREATE POLICY pod_photos_admin_or_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND (public.is_admin() OR public.pod_path_is_driver(name))
  );

DROP POLICY IF EXISTS pod_photos_admin_update ON storage.objects;
CREATE POLICY pod_photos_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS pod_photos_admin_delete ON storage.objects;
CREATE POLICY pod_photos_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND public.is_admin()
  );

COMMIT;