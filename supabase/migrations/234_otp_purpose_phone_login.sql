-- ============================================
-- Bite Me Baby Migration 234 — otp_challenges.purpose รับ 'phone_login' (R131)
-- ============================================
-- ต้นตอ (ยืนยันด้วย probe จริง 2026-11-28):
--   R130 เพิ่ม purpose 'phone_login' ใน EF otp-send / otp-verify แต่ CHECK ของ m122
--   รับแค่ ('quick_login','guest_checkout') → การ insert otp_challenges ชน 23514
--   check_violation → otp-send คืน 503 ERR_OTP_STORE_FAILED → UI ขึ้น
--   "ส่งรหัส OTP ไม่สำเร็จ" และไม่แสดงช่องกรอก OTP (phoneOtpSent ไม่เป็น true)
--
-- วิธีแก้: drop + create CHECK ให้รับครบ 3 ค่า
--   * คง RLS (deny-all สำหรับ anon/authenticated) · REVOKE · index ของ m122 ไว้ทั้งหมด
--   * ไม่เปลี่ยนโครงสร้างอื่น · OTP ยังเป็น hash-only · consumed_at ยังใช้ครั้งเดียว (กัน replay)
--   * ขอบเขต Owner §1.2 ไม่ขยาย: OTP ยืนยัน "การควบคุมเบอร์" เท่านั้น
-- ============================================

BEGIN;

ALTER TABLE public.otp_challenges
  DROP CONSTRAINT IF EXISTS otp_challenges_purpose_check;

ALTER TABLE public.otp_challenges
  ADD CONSTRAINT otp_challenges_purpose_check
  CHECK (purpose IN ('quick_login', 'guest_checkout', 'phone_login'));

NOTIFY pgrst, 'reload schema';

COMMIT;