-- ============================================
-- Bite Me Baby — Migration 194: payment_status += 'void'
-- Owner 2026-11-08 (RT-3.4 follow-up ของ D1): "ปิดให้จริง ถูกต้อง อย่างซื่อสัตย์"
-- ============================================
-- ปัญหา: cancel_order ตั้งแค่ orders.status='cancelled' ไม่แตะ payment_status
--   → ออเดอร์ยกเลิกแล้วยังค้าง payment_status='pending' ตลอดกาล
--   → pill "⏳ pending" ข้างแถวทั้งที่ไม่อยู่ในคิวไหน = ข้อมูลโกหกหน้า UI
-- ทางแก้สุจริต = มีสถานะปลายทาง 'void' (ยกเลิก ไม่เก็บเงิน) — ห้ามปิดเป็น
--   'paid' เพราะไม่มีเงินเข้าจริง
-- รองรับทั้ง 2 แบบ schema ที่อาจเจอจริง:
--   (1) คอลัมน์เป็น enum payment_status (001 fresh install)
--   (2) คอลัมน์เป็น TEXT + CHECK (035 fallback branch)
-- วิธีรัน: คัดลอกทั้งไฟล์ไปรันใน Supabase SQL Editor — รันไฟล์นี้ "คนละครั้ง"
--   กับ 195_close_payment_on_cancel.sql (ห้ามรวมสองไฟล์ในครั้งเดียว:
--   ค่า enum ใหม่ใช้ใน transaction เดียวกับ ALTER TYPE ไม่ได้)
-- ============================================

-- 1) แบบ enum — เพิ่มค่า 'void' (idempotent · ตาม pattern ของ 127)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders'
       AND column_name = 'payment_status' AND udt_name = 'payment_status'
  ) THEN
    BEGIN
      ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'void';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2) แบบ TEXT + CHECK (035 fallback) — ขยาย CHECK ให้รับ 'void'
--    (คงค่าเดิมทั้งหมด + เพิ่ม void, ชนิดคอลัมน์ไม่เปลี่ยน)
DO $$
DECLARE c RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders'
       AND column_name = 'payment_status' AND data_type = 'text'
  ) THEN
    FOR c IN
      SELECT conname FROM pg_constraint
       WHERE conrelid = 'public.orders'::regclass
         AND contype = 'c'
         AND pg_get_constraintdef(oid) ILIKE '%payment_status%'
    LOOP
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', c.conname);
      EXECUTE format(
        'ALTER TABLE public.orders ADD CONSTRAINT %I CHECK (payment_status IN (''pending'', ''paid'', ''refund'', ''partially_refunded'', ''void''))',
        c.conname
      );
    END LOOP;
  END IF;
END $$;

-- 3) audit — บันทึกว่ามีการขยาย vocabulary ทางการเงิน (ย้อนรอยได้)
SELECT public.append_audit_log(
  'schema_payment_status_void', 'order', 'payment_status',
  'migration 194: payment_status += void (cancelled orders with no capture close as void, not paid)',
  jsonb_build_object('migration', '194', 'by', 'sql-editor')
);
