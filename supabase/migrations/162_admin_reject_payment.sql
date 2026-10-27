-- ============================================
-- 162 — R10 (Owner 2026-10-27): admin manual payment rejection
-- ============================================
-- "ต้องมีปุ่มที่ปฏิเสธโดยมือแอดมิน เผื่อสลิปไม่ถูกหรือเงินไม่เข้า"
-- · เฉพาะแอดมิน · คืน payment_status = 'failed' + audit log
-- · หน้า SlipReviewPanel (ตรวจสลิป/ยืนยันชำระ) = ปุ่ม "ปฏิเสธสลิป" คู่กับยืนยัน
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_reject_payment(p_order_number text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid;
  v_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_INVALID_INPUT';
  END IF;

  SELECT status INTO v_status FROM public.orders WHERE order_number = p_order_number FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF v_status IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'ERR_ORDER_CLOSED: cannot reject payment on a closed order';
  END IF;

  -- enum payment_status = pending|paid|refund|partially_refunded (ไม่มี 'failed'):
  -- "ปฏิเสธสลิป/เงินไม่เข้า" = ยังไม่ถือว่าชำระ → กลับเป็น pending + audit บันทึกเหตุผล
  UPDATE public.orders SET payment_status = 'pending', updated_at = NOW()
   WHERE order_number = p_order_number;

  PERFORM public.append_audit_log('payment_rejected', 'order', p_order_number,
    'admin rejected payment: ' || COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'no reason given'),
    jsonb_build_object('payment_status', 'pending', 'admin', v_uid));

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'payment_status', 'pending');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reject_payment(text, text) TO authenticated, service_role;

-- คู่กับ attach_address_photo (161): ไรเดอร์ที่รับงานนี้อยู่ (หรือแอดมิน) ดึง path
-- รูปที่อยู่ลูกค้าไปแสดงบนหน้างานได้
CREATE OR REPLACE FUNCTION public.get_address_photo(p_order_number text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid;
  v_path text;
  v_is_driver boolean := false;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_INVALID_INPUT';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.delivery_assignments da
     JOIN public.drivers d ON d.id = da.driver_id
     WHERE da.order_number = p_order_number AND d.user_id = v_uid
  ) INTO v_is_driver;

  IF NOT v_is_driver AND NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  SELECT address_photo_url INTO v_path FROM public.orders WHERE order_number = p_order_number;
  RETURN v_path; -- NULL = ลูกค้าไม่ได้แนบรูป (ไม่ใช่ error)
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_address_photo(text) TO authenticated, service_role;
