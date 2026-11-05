-- ============================================
-- Bite Me Baby — Migration 187: ORDER MESSAGE v3 — FIX rider-send crash + notify rider
-- Task: R71 (Owner 2026-11-05 หลังทดสอบ live: "ฝั่งไดร์เวอร์ไม่มีแจ้งเตือน ไม่มีหน้าต่างแชท
--       โต้ตอบไม่ได้ ทำให้ถูกต้อง · กระดิ่งเตือนจริง")
-- Status: PREPARED — apply ผ่าน e2e/_r71Apply187.cjs (ledger 187)
--
-- บั๊กที่แก้ (พิสูจน์แล้ว: notifications.id เป็น PRIMARY KEY):
--   1) m183 เขียนแถวลูกค้าและแถวแอดมินด้วย id เดียวกัน 'msgn-'||v_id →
--      เมื่อ "ไรเดอร์ส่ง" ต้องเขียนทั้งสองแถว = unique violation ตัวที่สอง →
--      โดน EXCEPTION ชั้นนอก → ROLLBACK ทั้งก้อน (รวม order_messages) =
--      "ไรเดอร์โต้ตอบไม่ได้" จริงตามที่ Owner รายงาน (ลูกค้า/แอดมินส่งได้เพราะเขียนแถวเดียว)
--   2) ไม่มีแถวรอรับของไรเดอร์เลย = ไรเดอร์ไม่มีแจ้งเตือนเมื่อแอดมิน/ลูกค้าส่งข้อความ
--
-- v3 (ไฟล์นี้):
--   - id แถวแจ้งแยกตามผู้รับ: 'msgn-'||v_id||'-c' (ลูกค้า) / '-a' (แอดมิน) / '-r' (ไรเดอร์)
--     = ห้ามชนกัน ทั้งระหว่างกันและกับแถวเก่า m183 (ที่ไม่มี suffix)
--   - แจ้งไรเดอร์ (แถว user_id = drivers.user_id ของงานล่าสุดที่ยังไม่ cancel/decline):
--     RLS notifications_own_read (user_id = auth.uid()) → กระดิ่ง /rider เห็นเฉพาะของตัวเอง
--   - ผู้ส่งไรเดอร์ = ชื่อใน title "จากไรเดอร์" (เดิมรวมว่า "จากร้าน")
--   - BEST-EFFORT ทุกแถว (m161 pattern) — ข้อความต้องไม่ล้มเพราะการแจ้งเตือน
--   - แถวลูกค้า (customer_id ไม่ NULL) ยังเข้า dispatcher 'ntf-' → push เดิม ·
--     แถวแอดมิน/ไรเดอร์ (customer_id NULL) = กระดิ่ง in-app เท่านั้นตามดีไซน์
-- REVERSIBLE: CREATE OR REPLACE — คืน m183 ได้จากไฟล์ 183 · IDEMPOTENT: รันซ้ำได้
-- ============================================
BEGIN;

ALTER TABLE public.notifications ALTER COLUMN customer_id DROP NOT NULL;

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
  v_rider_uid uuid := NULL;
  v_id text;
  v_preview text;
  v_from text;
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

  -- ผู้รับฝั่งไรเดอร์ = ไรเดอร์ของงานล่าสุดที่ยังไม่ cancel/decline (อาจไม่มี = NULL)
  SELECT d.user_id INTO v_rider_uid
    FROM public.delivery_assignments da
    JOIN public.drivers d ON d.id = da.driver_id
   WHERE da.order_number = p_order_number
     AND COALESCE(da.status, '') NOT IN ('cancelled', 'declined')
   ORDER BY da.assigned_at DESC
   LIMIT 1;

  v_id := 'omsg-' || ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint::text)
              || '-' || substr(md5(random()::text), 1, 4);
  INSERT INTO public.order_messages (id, order_number, sender_role, sender_id, driver_id, body)
  VALUES (v_id, p_order_number, v_role, v_uid, v_driver, btrim(p_body));

  v_preview := '#' || p_order_number || ' — ' || left(btrim(p_body), 200);
  v_from := CASE v_role WHEN 'rider' THEN 'ไรเดอร์' WHEN 'admin' THEN 'ร้าน' ELSE 'ลูกค้า' END;

  -- แจ้งลูกค้าเมื่อแอดมิน/ไรเดอร์ส่ง — แถว customer-owned (กระดิ่งลูกค้า + push ผ่าน
  -- dispatcher 'ntf-' เดิม) — id suffix '-c' (m183 ใช้ id ซ้ำจนไรเดอร์ส่งพัง — ห้ามกลับไปใช้แบบเดิม)
  IF v_role IN ('admin', 'rider') AND v_customer_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)
      VALUES ('msgn-' || v_id || '-c', v_customer_id, NULL,
              '💬 ข้อความใหม่จาก' || v_from, v_preview,
              false, 'ORDER_MESSAGE', 'Operational', NOW());
    EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN
      NULL;
    END;
  END IF;

  -- แจ้งแอดมินเมื่อลูกค้า/ไรเดอร์ส่ง — customer_id/user_id = NULL → RLS เห็นเฉพาะ is_admin
  IF v_role IN ('customer', 'rider') THEN
    BEGIN
      INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)
      VALUES ('msgn-' || v_id || '-a', NULL, NULL,
              '💬 ข้อความใหม่จาก' || v_from, v_preview,
              false, 'ORDER_MESSAGE', 'Operational', NOW());
    EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN
      NULL;
    END;
  END IF;

  -- แจ้งไรเดอร์เมื่อแอดมิน/ลูกค้าส่ง — แถว user_id = ไรเดอร์ของงาน (RLS own = กระดิ่ง /rider)
  IF v_role IN ('admin', 'customer') AND v_rider_uid IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)
      VALUES ('msgn-' || v_id || '-r', NULL, v_rider_uid,
              '💬 ข้อความใหม่จาก' || v_from, v_preview,
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
  'R51/R70/R71: จุดเขียนเดียวของ order_messages — validate role จริง + แจ้งผ่าน notifications ครบทุกผู้รับ (ลูกค้า/แอดมิน/ไรเดอร์ · id แยก suffix กันชน) · BEST-EFFORT';

COMMIT;
-- ========== END OF MIGRATION 187 ==========