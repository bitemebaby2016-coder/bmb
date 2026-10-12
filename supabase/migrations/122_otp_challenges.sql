-- ============================================
-- Bite Me Baby Migration 122 — OTP challenges (P0 security remediation)
-- ============================================
-- วัตถุประสงค์: ทำให้ Quick Login เลิกเป็น "single-factor phone = เข้าบัญชีได้"
--   โดยบังคับ OTP ก่อนออก session (Owner OD-1)
--
-- หลักการออกแบบ (สำคัญ):
--   * เก็บ **เฉพาะ hash** ของรหัส OTP — ห้ามเก็บ plaintext เด็ดขาด
--     (ถ้าตารางถูกอ่านได้ ผู้โจมตียังเอาโค้ดไปใช้ไม่ได้)
--   * ใช้ครั้งเดียว (consumed_at) — กัน replay
--   * จำกัดจำนวนครั้งที่ทาย (attempts) — กัน brute force
--   * มี expires_at — OTP ต้องหมดอายุ
--   * RLS เปิดแต่ไม่มี policy + REVOKE ทุกอย่างจาก anon/authenticated
--     -> อ่าน/เขียนตรงไม่ได้ทั้งหมด เข้าถึงได้ผ่าน SECURITY DEFINER เท่านั้น
--     (รูปแบบเดียวกับ track_order_attempts ใน migr 050)
--
-- ขอบเขต (Owner §1.2): OTP ยืนยัน "การควบคุมเบอร์โทร" เท่านั้น
--   * ห้ามใช้เป็นหลักฐานยืนยันการชำระเงิน
--   * ห้ามใช้เพื่อเข้าบัญชีเดิมโดยอัตโนมัตินอกเหนือจาก flow ที่อนุมัติไว้
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.otp_challenges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_digits  text NOT NULL,
  purpose       text NOT NULL CHECK (purpose IN ('quick_login', 'guest_checkout')),
  code_hash     text NOT NULL,
  code_salt     text NOT NULL,
  attempts      int  NOT NULL DEFAULT 0,
  consumed_at   timestamptz,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS เปิด แต่ไม่สร้าง policy เลย = deny-all สำหรับ anon/authenticated
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.otp_challenges FROM anon, authenticated;

-- ค้น challenge ล่าสุดของเบอร์+purpose (ฝั่ง SECURITY DEFINER เท่านั้น)
CREATE INDEX IF NOT EXISTS otp_challenges_phone_purpose_idx
  ON public.otp_challenges (phone_digits, purpose, created_at DESC);

-- กันตารางโตไม่จำกัด — เก็บย้อนหลังแค่ 24 ชั่วโมง (OTP หมดอายุไปนานแล้ว)
CREATE INDEX IF NOT EXISTS otp_challenges_created_idx
  ON public.otp_challenges (created_at);

COMMIT;
