-- ============================================================
-- 152_menu_schedule_execute_revoke.sql — contract 039 G7 (defense-in-depth)
-- Owner sign-off 2026-10-25 (§6: security/schema change ผ่านอนุมัติแล้ว)
-- ============================================================
-- ที่มา (หลักฐานจาก contract 039 G7 + probe corpus ทั้งหมด): ไม่มี REVOKE/GRANT ใด ๆ
-- บน set_menu_schedule/publish_menu_schedule ใน migration history ทุกไฟล์ → default
-- PUBLIC EXECUTE = anon เรียกได้ (ภายในฟังก์ชันมี is_admin() gate คุมอยู่แล้ว — G2 ผ่าน
-- = ไม่ใช่ช่องเปิดเขียน แต่ขาดชั้น defense-in-depth ที่สัญญาเรียกร้อง)
-- รูปแบบเดียวกับ 039 เอง (get_menu_for_date/enforce_*): REVOKE PUBLIC+anon → GRANT authenticated
-- Idempotent (REVOKE/GRANT ซ้ำได้) · Rollback: GRANT EXECUTE ... TO PUBLIC, anon ตามเดิม
-- FIX 2026-10-25: หัวไฟล์รอบแรกเขียน // (คอมเมนต์แบบ JS) → psql ปฏิเสธ = apply production
-- รอบแรกพังด้วย syntax error near "//" — เขียนใหม่เป็น -- ทั้งหมด + apply ซ้ำ
-- ============================================================
BEGIN;

REVOKE EXECUTE ON FUNCTION public.set_menu_schedule(date, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.publish_menu_schedule(date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_menu_schedule(date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_menu_schedule(date, boolean) TO authenticated;

COMMIT;