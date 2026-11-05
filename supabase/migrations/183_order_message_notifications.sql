-- ============================================
-- Bite Me Baby — Migration 183: ORDER MESSAGE NOTIFICATIONS (แจ้งเตือนข้อความแชต)
-- Task: R70 (Owner 2026-11-05): "ระบบแชทระหว่าง แอดมิน ลูกค้า ไรเด้อร์ ไม่สมบูรณ์ …
--       ไม่มีแจ้งเตือนข้อความ ทำให้สมบูรณ์ตามเหมาะสม"
-- Status: PREPARED — apply ผ่าน e2e/_r70Apply183.cjs (ledger 183)
--
-- ปัญหาที่แก้ (หลักฐาน e2e/_r70_probe.json):
--   m182 เขียนแจ้งเตือนผ่าน enqueue_notification (outbox 'msg-') ตรง = ไม่มีแถว
--   `notifications` = กระดิ่งลูกค้า/แอดมินเงียบสนิททุกฝั่ง และไม่มีฝั่ง "แอดมิน/ไรเดอร์
--   ได้รับแจ้งเมื่อลูกค้าส่ง" เลย — ผู้ใช้จึงรู้สึกว่าแชต "ไม่มีกล่องโต้ตอบ/ไม่มีแจ้งเตือน"
--
-- Design (เชื่อมระบบเดิม ไม่เขียน outbox/dispatcher ใหม่ — pattern m161):
--   1) แอดมิน/ไรเดอร์ → ลูกค้า: INSERT notifications (BEST-EFFORT) แถว customer-owned
--      → กระดิ่งลูกค้า + แอดมินเห็นผ่าน is_admin (เดิม) + dispatcher builder
--      buildFromNotifications enqueue 'ntf-' → push/messenger ตาม flags เดิม (ทางเดียว ไม่ยิงซ้ำ)
--   2) ลูกค้า/ไรเดอร์ → แอดมิน: INSERT notifications แบบ customer_id/user_id = NULL
--      → RLS เห็นเฉพาะ is_admin (กระดิ่งแอดมิน) · builder ข้าม (.not customer_id is null)
--      = ไม่มี push/echo ผิดฝั่งเข้าลูกค้า
--   3) ตาราง order_messages / กฎ RLS / send validation = เหมือน m182 ทุกบรรทัด
-- REVERSIBLE: DROP FUNCTION 1 ตัว (คืน m182 เดิมได้จากไฟล์ 182) · IDEMPOTENT: รันซ้ำได้
-- ============================================
BEGIN;

-- ---------- 0) แถวแจ้งแอดมินไม่ผูก customer (กัน echo เข้ากระดิ่งลูกค้า) ----------
ALTER TABLE public.notifications ALTER COLUMN customer_id DROP NOT NULL;

-- ---------- 1) send_order_message v2 — เขียนเหมือน m182 + แจ้งผ่าน notifications เดิม ----------
CREATE OR REPLACE FUNCTION public.send_order_message(
  p_order_number text,
  p_body text,
  p_sender_role text DEFAULT 'customer'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := coalesce(p_sender_role, 'customer');
  v_customer_id text;
  v_driver text := NULL;
  v_id text;
  v_preview text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR length(trim(p_order_number)) = 0 THEN RAISE EXCEPTION 'ERR_MISSING_ORDER'; END IF;
  IF p_body IS NULL OR length(btrim(p_body)) = 0 THEN RAISE EXCEPTION 'ERR_EMPTY_MESSAGE'; END IF;
  IF length(btrim(p_body)) > 2000 THEN RAISE EXCEPTION 'ERR_MESSAGE_TOO_LONG'; END IF;
  IF v_role NOT IN ('customer', 'rider', 'admin') THEN RAISE EXCEPTION 'ERR_INVALID_ROLE'; END IF;

  SELECT o.customer_id INTO v_customer_id
    FROM public.orders o WHERE o.order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  IF v_role = 'admin' THEN
    IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  ELSIF v_role = 'rider' THEN
    v_driver := public.current_driver_id();
    IF v_driver IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.delivery_assignments da
      WHERE da.order_number = p_order_number AND da.driver_id = v_driver
    ) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  ELSE
    IF NOT public.owns_order_msg(p_order_number) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  END IF;

  -- id รูปแบบแก้แล้ว (m173 lesson): bigint::text ห้าม to_char '99999999999'
  v_id := 'omsg-' || ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint::text)
              || '-' || substr(md5(random()::text), 1, 4);
  INSERT INTO public.order_messages (id, order_number, sender_role, sender_id, driver_id, body)
  VALUES (v_id, p_order_number, v_role, v_uid, v_driver, btrim(p_body));

  v_preview := '#' || p_order_number || ' — ' || left(btrim(p_body), 200);

  -- แจ้งลูกค้าเมื่อแอดมิน/ไรเดอร์ส่ง — แถว customer-owned (กระดิ่งลูกค้า + transport
  -- ผ่าน dispatcher builder 'ntf-' เดิม = push/messenger ตาม flags · ไม่เขียน outbox เอง)
  -- BEST-EFFORT (m161 pattern): ข้อความต้องไม่ล้มเพราะการแจ้งเตือน
  IF v_role IN ('admin', 'rider') AND v_customer_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)
      VALUES ('msgn-' || v_id, v_customer_id, NULL,
              '💬 ข้อความใหม่จากร้าน', v_preview,
              false, 'ORDER_MESSAGE', 'Operational', NOW());
    EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN
      NULL;
    END;
  END IF;

  -- แจ้งแอดมินเมื่อลูกค้า/ไรเดอร์ส่ง — customer_id/user_id = NULL → RLS เห็นเฉพาะ
  -- is_admin (กระดิ่งแอดมินเท่านั้น) · builder ข้ามแถว customer_id NULL = ไม่ push ผิดฝั่ง
  IF v_role IN ('customer', 'rider') THEN
    BEGIN
      INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)
      VALUES ('msgn-' || v_id, NULL, NULL,
              '💬 ข้อความใหม่จาก' || CASE WHEN v_role = 'rider' THEN 'ไรเดอร์' ELSE 'ลูกค้า' END,
              v_preview,
              false, 'ORDER_MESSAGE', 'Operational', NOW());
    EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'order_number', p_order_number);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.send_order_message(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_order_message(text, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.send_order_message(text, text, text) IS
  'R51/R70: จุดเขียนเดียวของ order_messages — validate role จริง + แจ้งข้อความผ่านตาราง notifications เดิม (m161 pattern · กระดิ่ง+push ครบทุกฝั่ง)';

COMMIT;
-- ========== END OF MIGRATION 183 ==========
