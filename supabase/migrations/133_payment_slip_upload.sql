-- ============================================
-- Bite Me Baby — Migration 133: Payment slip upload (PromptPay manual transfer)
-- Date: 2026-10-20
-- ============================================
-- Problem (Owner QA 2026-10-20):
--   ลูกค้าโอนเงินผ่าน PromptPay QR แล้วมีแค่ช่องกรอก "เลขธุรกรรม" — ไม่มีปุ่ม
--   แนบรูปสลิป → แอดมินไม่มีหลักฐานให้ตรวจก่อนกดยืนยัน (confirm_offline_payment)
--
-- Fix (vertical slice — หลักฐานภาพยึดตาม pattern เดียวกับ POD ของไรเดอร์ 132):
--   * storage bucket `payment-slips` = PRIVATE; path = '<user_id>/<order_number>-<ts>.<ext>';
--     storage policy บังคับโฟลเดอร์แรก = auth.uid() ของผู้เรียก (กันอ้างไฟล์คนอื่น)
--   * payment_intents.slip_path / slip_uploaded_at = ที่อยู่ object + เวลาที่แนบ
--   * RPC submit_payment_slip(p_order_number, p_slip_path) — SECURITY DEFINER
--     · ต้องเป็นเจ้าของออเดอร์ (orders.customer_ref = auth.uid()) เท่านั้น
--     · p_slip_path ต้องอยู่ใต้โฟลเดอร์ของผู้เรียกเอง
--     · intent ที่ 'pending' → 'processing' (ส่งหลักฐานแล้ว, รอแอดมินตรวจ)
--       — state machine เดิม (008 B.4/B.5) ไม่เปลี่ยน: แอดมินยังต้องกด
--       confirm_offline_payment เพื่อให้ order → paid เท่านั้น
-- ============================================

-- 1. payment_intents — slip evidence columns
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS slip_path text,
  ADD COLUMN IF NOT EXISTS slip_uploaded_at timestamptz;

COMMENT ON COLUMN public.payment_intents.slip_path IS
  'Storage object path in private bucket payment-slips (''<user_id>/<file>''). Written ONLY via submit_payment_slip / direct storage upload by the owning customer.';
COMMENT ON COLUMN public.payment_intents.slip_uploaded_at IS
  'When the customer attached the transfer slip evidence.';

-- 2. Storage bucket payment-slips (PRIVATE) + role-scoped policies
--    Policy pattern from 119/132 (bucket_id literal — scalar subquery on
--    storage.buckets is hidden by RLS and breaks WITH CHECK).
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-slips', 'payment-slips', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'file_size_limit'
  ) THEN
    UPDATE storage.buckets SET file_size_limit = 5242880 WHERE id = 'payment-slips';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types'
  ) THEN
    UPDATE storage.buckets
       SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
     WHERE id = 'payment-slips';
  END IF;
END $$;

-- upload: authenticated ใส่ได้เฉพาะโฟลเดอร์ตัวเองเท่านั้น
DROP POLICY IF EXISTS payment_slips_customer_upload ON storage.objects;
CREATE POLICY payment_slips_customer_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-slips'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- read: แอดมินเห็นทุกใบ / ลูกค้าเห็นเฉพาะของตัวเอง
DROP POLICY IF EXISTS payment_slips_admin_or_owner_read ON storage.objects;
CREATE POLICY payment_slips_admin_or_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-slips'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- 3. submit_payment_slip — customer attaches transfer slip evidence
--    pending → processing (หลักฐานส่งแล้ว) — แอดมินยังคงเป็นผู้ยืนยันคนเดียว
CREATE OR REPLACE FUNCTION public.submit_payment_slip(
  p_order_number text,
  p_slip_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_slip text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;
  v_slip := trim(p_slip_path);
  IF v_slip = '' THEN RAISE EXCEPTION 'ERR_MISSING_SLIP'; END IF;
  -- path ต้องอยู่ใต้โฟลเดอร์ของผู้เรียกเท่านั้น (กันอ้างไฟล์คนอื่น/พาธมั่ว)
  IF v_slip NOT LIKE v_uid::text || '/%' THEN
    RAISE EXCEPTION 'ERR_SLIP_PATH_FORBIDDEN';
  END IF;

  UPDATE public.payment_intents
     SET slip_path        = v_slip,
         slip_uploaded_at = NOW(),
         status           = CASE WHEN status = 'pending' THEN 'processing' ELSE status END,
         updated_at       = NOW()
   WHERE order_number = p_order_number
     AND method = 'promptpay_qr'
     AND status IN ('pending', 'processing')
     AND EXISTS (
       SELECT 1 FROM public.orders o
        WHERE o.order_number = p_order_number AND o.customer_ref = v_uid
     );

  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NO_PENDING_PROMPTPAY'; END IF;

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'slip_path', v_slip);
END;
$$;

-- 4. Grants — customer-only; never anon/Public
REVOKE EXECUTE ON FUNCTION public.submit_payment_slip FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_slip TO authenticated;