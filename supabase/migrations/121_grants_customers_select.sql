-- ============================================
-- Bite Me Baby Migration 121: authenticated SELECT grant on `customers`
-- ============================================
-- Symptom ( anticipated — handoff §11 P1#5 ): `restoreProfileAddress()`
--   (src/store/authStore.ts, เพิ่มใน 5cc693a) อ่าน `customers.default_address_detail`
--   ของตัวเองหลัง login เพื่อเติมข้อความที่อยู่ให้ลูกค้าเก่า
--   ถ้า ACL ไม่มี table-level SELECT สำหรับ role `authenticated`
--   PostgREST คืน 42501 "permission denied for table customers"
--   -> ฟังก์ชัน fail เงียบ (best-effort) -> ลูกค้าเก่ายังต้องกรอกที่อยู่เองทุกครั้ง
-- Root cause (แบบเดียวกับ migration 033/102 — ACL drift):
--   RLS `customers_own_read` (migr 006) มีอยู่จริงและเป็นตัวกรองแถว (USING user_id = auth.uid())
--   แต่ table-level GRANT สำหรับ `authenticated` ไม่ได้ถูกออกบน production
--   (migr 005 GRANT ALL ON ALL TABLES ครอบคลุมเฉพาะตารางที่มี ณ ตอนนั้น,
--    migr 102 grant 6 ตารางแต่ไม่มี `customers`)
-- Fix: idempotent GRANT (รูปแบบเดียวกับ 097/100/101/102) — RLS ยังคงเป็นผู้มีอำนาจ
--   การเปิด ACL นี้ "ไม่" ทำให้คนอื่นอ่านข้อมูลลูกค้าได้ เพราะ policy
--   customers_own_read ยังจำกัดเฉพาะแถวของตัวเอง (หรือ is_admin())
-- ============================================
-- หมายเหตุความปลอดภัยที่ตั้งใจ "ไม่" ทำใน migration นี้:
--   * ไม่แตะ `orders` / anon read — migration 050 เพิกถอนไปแล้วโดยเจตนา
--     (guest track ต้องใช้ RPC track_order(order_number, phone) เท่านั้น)
--   * ไม่เพิ่มคอลัมน์ provenance — ยังไม่มี Owner approve (handoff §11 P2#4)
--   * ไม่คืนค่าพิกัด default_* ฝั่ง client — ดูข้อจำกัดใน handoff §3.3
-- ============================================

BEGIN;

GRANT SELECT ON public.customers TO authenticated;

-- Verification: authenticated grant ต้องมีครบ (ต้องไม่ missing เลย)
DO $$
DECLARE v_missing int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM (VALUES ('customers')) AS t(name)
  WHERE EXISTS (
    SELECT 1 FROM information_schema.tables it
    WHERE it.table_schema = 'public' AND it.table_name = t.name)
    AND NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public' AND g.table_name = t.name
      AND g.grantee = 'authenticated' AND g.privilege_type = 'SELECT');
  RAISE NOTICE 'authenticated grant audit (customers) — missing: %', v_missing;
  IF v_missing > 0 THEN RAISE EXCEPTION 'ERR_AUTH_GRANT_MISSING_CUSTOMERS'; END IF;
END $$;

COMMIT;