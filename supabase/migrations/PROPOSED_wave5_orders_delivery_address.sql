-- ============================================================
-- PROPOSED_wave5_orders_delivery_address.sql — WAVE 5B (สถานะ: ✅ ยกระดับเป็น
-- migration 150_orders_delivery_address_parity.sql แล้ว (D7 2026-10-25) — เนื้อ SQL
-- idempotent เดิมยกไปทั้งก้อน + header เงื่อนไข/rollback → ห้ามใช้ไฟล์นี้ซ้ำ)
--
-- ปัญหา (fresh-DB gap ที่พิสูจน์แล้ว):
--   ไม่มี migration 001-123 ไฟล์ใด CREATE/ALTER orders.delivery_address —
--   001:251 / 003:75 / 004:458 มี delivery_address เฉพาะใน pre_orders ·
--   แต่ 035:158 สร้าง trigger `UPDATE OF order_mode, dropoff_detail, delivery_address
--   ON public.orders` + 035:148/230/239 ฟังก์ชัน/query อ้าง o.delivery_address →
--   chain ใหม่ล้มที่ 035 (CI ต้องใช้ shim ช่วย) · Production รอดเพราะมีคอลัมน์นี้
--   จาก manual-era drift (ไม่มี migration สร้าง = schema drift จริง)
--
--   ผลกระทบปัจจุบัน:
--   * app อ่านคอลัมน์นี้: `src/lib/bmbAdminApi_orders.ts:71` (AdminOrder.delivery_address)
--     และ `src/pages/.../DeliveryManagement.tsx:220` แสดง `o.delivery_address || '—'`
--   * เส้นทางเขียนปัจจุบัน (118/114/089) เขียนที่อยู่ลง `dropoff_detail`
--     (`p_delivery_address → dropoff_detail`) — ไม่มีโค้ดเขียน delivery_address ตรง ๆ
--     → คอลัมน์นี้คือ legacy/manual-era ที่ยังถูกอ่านอยู่
--
-- Exact SQL (idempotent — no-op บน Production ที่มีคอลัมน์อยู่แล้ว):
BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';

COMMENT ON COLUMN public.orders.delivery_address IS
  'Legacy manual-era address column (schema parity fix WAVE 5B). Canonical written address = dropoff_detail (create_order_with_items maps p_delivery_address -> dropoff_detail). This column is displayed by admin DeliveryManagement and asserted by 035-era trigger history.';

COMMIT;

-- Preconditions (ตรวจก่อน apply บน Production):
--   1. read-only: SELECT data_type, column_default, is_nullable FROM information_schema.columns
--      WHERE table_name='orders' AND column_name='delivery_address';
--      ต้องได้ text / "''::text" / YES — ถ้า Production มี type/default ต่างจากนี้
--      ให้แก้สคริปต์ให้ตรงกับ Production ก่อน (ห้าม apply แบบเดา)
--   2. backup: pg_dump --table=public.orders (หรือ snapshot) ก่อน apply ทุกครั้ง
--   3. รันใน maintenance window ต่ำ traffic (DDL บน orders = ACCESS EXCLUSIVE lock สั้น ๆ
--      แต่ตาราง orders คือ hot path)
--
-- Dependencies:
--   * หลัง apply บน Production + fresh chain → เอา shim `orders.delivery_address` ออก
--     จาก .github/workflows/contract-tests.yml (บล็อก shim 035) ได้ — ปิด drift ฝั่ง CI
--   * 035/037 (trigger validate_pre_order_delivery) — 037 repair ใช้ dropoff_detail แล้ว
--     ไม่ต้องแก้เพิ่ม
--   * ไม่แตะ migration history 001-123 (ห้ามแก้ไฟล์เดิม)
--
-- Rollback limitations:
--   * `ALTER TABLE public.orders DROP COLUMN delivery_address;` คืน schema ได้
--     แต่ข้อมูลในคอลัมน์ (Production มีจริงจาก manual era) จะหายถาวร —
--     แนะนำ "คงคอลัมน์ไว้" มากกว่า rollback · ถ้าจำเป็นต้อง rollback ให้ dump
--     คอลัมน์นี้ออกมาก่อนเสมอ
--   * บน fresh DB (ไม่มีข้อมูล) rollback ปลอดภัย 100%
--
-- Data impact:
--   * ไม่มีการเขียน/แก้ไขแถวเดิม — ADD COLUMN IF NOT EXISTS DEFAULT '' =
--     เติมค่าว่างให้แถวเดิมแบบ metadata-only (PG11+) ไม่ rewrite ตาราง
--   * แถว Production เดิมค้างค่าตามเดิมทุกประการ
--
-- OPTIONAL (ต้องได้ Owner ตัดสินใจก่อน — ห้ามเปิดโดยไม่ขอ):
--   backfill จากคอลัมน์ที่เขียนจริง (dropoff_detail) เข้า delivery_address
--   ให้หน้า DeliveryManagement แสดงที่อยู่ของออเดอร์ยุค RPC:
--     UPDATE public.orders
--        SET delivery_address = dropoff_detail
--      WHERE COALESCE(delivery_address, '') = ''
--        AND COALESCE(dropoff_detail, '') <> '';
--   ผลกระทบ: เขียนทับค่าว่างเท่านั้น · ย้อนกลับได้เฉพาะที่ backup · ไม่ทำโดยอัตโนมัติ
--
-- Test plan (isolated ก่อนเสมอ):
--   1. fresh DB (container) 001-123 โดยไม่มี shim delivery_address → ต้องเขียวทั้ง chain
--   2. contract 123 + 124 + cleanup + concurrency ต้องเขียวเท่าเดิม (ไม่แตะพฤติกรรม)
--   3. apply ซ้ำบน DB ที่มีคอลัมน์แล้ว → ต้อง no-op (IF NOT EXISTS)
--   4. บน Production: apply แล้ว SELECT column = 1 แถว metadata · ไม่มี data diff
--
-- ============================================================