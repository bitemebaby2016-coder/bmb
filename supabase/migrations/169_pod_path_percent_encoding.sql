-- ============================================
-- R19 (2026-10-29): FIX CI contract 138-139 (G7) — driver_path_folder ต้องทน %XX
-- (REGRESSION จาก 166 · พิสูจน์จาก Contract Tests #188–#197 แดงติดกัน 10 รอบ)
-- ============================================
-- WHY:
--   166 เปลี่ยน policy helper pod_path_is_driver ให้เทียบด้วย driver_path_folder
--   (strip อักขระนอก [A-Za-z0-9_-]) แต่**ไม่ decode URL-encoding ก่อน strip** →
--     folder 'drv-%20c139-60bc' (storage-js encodeURIComponent — พิสูจน์ใน 139 header)
--       → strip '%' ทิ้ง → 'drv-20c139-60bc'
--     drivers.id 'drv- c139-60bc'
--       → strip space → 'drv-c139-60bc'   ≠ กัน → WITH CHECK ตาย = RLS บล็อก INSERT
--   ผลกระทบจริง: rider ที่ id มี space/# (production probe R13) ส่งรูป POD เป็น
--   path แบบ %20/%23-encoded = upload ไม่ผ่าน → ERR_POD_REQUIRED วงจรอัตโนมัติพังagain
--   + e2e/contracts_138_139.sql G7 ล้ม (psql:286 RLS violation บน storage.objects)
-- FIX (แก้ที่ชั้น path เท่านั้น — ไม่แตะ PK/FK/policy ชื่อเดิม):
--   driver_path_folder = "ตัด %XX run ออกก่อน" แล้วค่อย strip อักขระ
--     (เทียบเท่า decode-then-strip สำหรับอักขระที่ strip อยู่แล้ว = space/#/ไทย ·
--      ฝั่ง id จริงไม่มี '%' อยู่แล้ว → ทั้งสองฝั่งค่าตรงกันเสมอ)
--   pod_path_is_driver ออกซ้ำด้วย signature/attribute เดิม (policy 139 อ้างชื่อนี้ —
--     G6 ยัง assert เหมือนเดิม · GRANT/REVOKE ไม่หายเพราะ CREATE OR REPLACE)
-- re-run ปลอดภัย (CREATE OR REPLACE ทั้งคู่)
-- ============================================

-- 1. path folder sanitize — decode %XX ก่อน strip (ครบทุกฝั่งที่ 166 เสียบไว้:
--    client folder · attach check · storage policy)
CREATE OR REPLACE FUNCTION public.driver_path_folder(p_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
           regexp_replace(coalesce(p_id, ''), '(%[0-9A-Fa-f]{2})+', '', 'g'),
           '[^A-Za-z0-9_-]', '', 'g')
$$;

COMMENT ON FUNCTION public.driver_path_folder(text) IS
  'R19 (169): sanitize driver folder for POD path layer — drops %XX percent-encoding runs FIRST (storage-js encodeURIComponent), then strips anything outside [A-Za-z0-9_-]. Regression fix for 166 (contract 138-139 G7).';

-- 2. policy helper ตัวเดิม (ชื่อ/signature/SECURITY DEFINER/STABLE เหมือน 166) —
--    เรียก driver_path_folder ตัวใหม่ตอน evaluate (SQL body parse ใหม่ทุก call)
CREATE OR REPLACE FUNCTION public.pod_path_is_driver(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.current_driver_id() IS NOT NULL
     AND public.driver_path_folder(split_part(coalesce(p_name, ''), '/', 1))
         = public.driver_path_folder(public.current_driver_id());
$function$;

COMMENT ON FUNCTION public.pod_path_is_driver(text) IS
  'D-02 (139) + R13 (166) + R19 (169): true when the object first path segment is the caller driver id — tolerant of raw, %20-encoded and sanitized forms.';