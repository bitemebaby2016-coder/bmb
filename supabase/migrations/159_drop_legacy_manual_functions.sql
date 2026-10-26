-- ============================================
-- 159 — DROP legacy manual-era functions 6 ตัว (L-10 / W-1 plan ส่วนที่เหลือ)
-- ============================================
-- คำสั่ง Owner 2026-10-26 (ผ่าน ask ในแชทนี้): "ปลดออกทั้ง 6 — เตรียม migration DROP
-- ให้เรียบร้อย (ยังไม่ apply จนกว่าท่านจะยืนยันรอบสุดท้าย)"
--
-- หลักฐานที่ทำให้ปลดได้ (e2e/w1-parity-2026-10-26.json · D3):
--   - ทั้ง 6 ตัวมีใน production อย่างเดียว (manual-era) · ไม่มีใน repo migrations
--   - grep src/ = 0 caller ทั้ง 6 ตัว
--   - triggers parity MATCH 35=35 → ไม่มี trigger ใน production อ้างฟังก์ชันเหล่านี้
--     (ไม่งั้นรายการ trigger จะต่างกัน) → DROP ไม่ต้องใช้ CASCADE
--   - signatures เอามาจาก pg_get_function_identity_arguments ใน parity จริง (ไม่ได้เดา)
--
-- หมายเหตุ:
--   - CI (contract-tests.yml ใช้ for f in supabase/migrations/*.sql) จะ apply ไฟล์นี้
--     บน ephemeral DB — DROP IF EXISTS = no-op บน fresh DB (ฟังก์ชันไม่มีอยู่แล้ว) → ปลอดภัย
--   - production apply = รอ Owner ยืนยันรอบสุดท้ายเท่านั้น (ห้าม apply โดย AI)
--   - ถ้า production มี dependency ที่ไม่คาดคิด → DROP จะ error ให้เห็นตอน apply (fail-safe ไม่เงียบ)
-- ============================================

-- trigger function (result=trigger) · 0 args
DROP FUNCTION IF EXISTS public.auto_approve_order();

-- args (identity): p_order_total numeric → types only (gotcha §6.1: ห้ามใส่ชื่อ parameter)
DROP FUNCTION IF EXISTS public.calculate_loyalty_points(numeric);

-- args (identity): p_product_id uuid
DROP FUNCTION IF EXISTS public.check_product_availability(uuid);

-- args (identity): p_order_number text, p_reason text
DROP FUNCTION IF EXISTS public.mark_payment_failed(text, text);

-- 0 args
DROP FUNCTION IF EXISTS public.update_order_status();

-- 0 args
DROP FUNCTION IF EXISTS public.validate_order_before_submit();
