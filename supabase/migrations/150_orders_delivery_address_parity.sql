-- ============================================================
-- 150_orders_delivery_address_parity.sql — WAVE 5B schema parity (D7 2026-10-25)
-- ============================================================
-- ที่มา: ยกระดับจาก PROPOSED_wave5_orders_delivery_address.sql (เดิม = PROPOSAL)
-- เหตุผล (fresh-DB gap ที่พิสูจน์แล้ว):
--   ไม่มี migration 001-123 ไฟล์ใด CREATE/ALTER orders.delivery_address —
--   001:251 / 003:75 / 004:458 มี delivery_address เฉพาะใน pre_orders ·
--   แต่ 035:158 สร้าง trigger `UPDATE OF order_mode, dropoff_detail, delivery_address
--   ON public.orders` + 035:148/230/239 อ้าง o.delivery_address →
--   Production รอดเพราะมีคอลัมน์นี้จาก manual-era drift (schema drift จริง)
--   * app อ่านคอลัมน์นี้: src/lib/bmbAdminApi_orders.ts:71 + DeliveryManagement.ts:220
--   * เส้นทางเขียนปัจจุบัน (118/114/089) เขียนที่อยู่ลง dropoff_detail —
--     คอลัมน์นี้ = legacy/manual-era ที่ยังถูกอ่านอยู่
--
-- Idempotent: no-op บน Production ที่มีคอลัมน์อยู่แล้ว (ADD COLUMN IF NOT EXISTS)
-- Data impact: ไม่แตะแถวเดิม (metadata-only บน PG11+) · แถวเดิมคงค่าตามเดิม
-- Fresh chain: CI ยังใช้ shim 035 (authoring-order) ต่อไป — ไฟล์นี้ทำให้ chain มี
--   ตัวแทนของ drift ใน migration history อย่างเป็นทางการ (ไม่ rewrite history เดิม)
-- Rollback: DROP COLUMN คืน schema ได้ แต่ข้อมูล manual-era จะหาย — แนะนำคงไว้
--   (dump คอลัมน์ก่อนเสมอถ้าจำเป็นต้อง rollback)
-- Production apply = ขั้นตอนแยก authorize เสมอ (precheck/backup/maintenance window)
-- ============================================================

BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';

COMMENT ON COLUMN public.orders.delivery_address IS
  'Legacy manual-era address column (schema parity fix WAVE 5B / migration 150). Canonical written address = dropoff_detail (create_order_with_items maps p_delivery_address -> dropoff_detail). This column is displayed by admin DeliveryManagement and asserted by 035-era trigger history.';

COMMIT;