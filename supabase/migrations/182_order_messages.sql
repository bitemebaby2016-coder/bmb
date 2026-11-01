-- ============================================
-- Bite Me Baby — Migration 182: ORDER MESSAGES (แชต ลูกค้า ↔ ไรเดอร์ ↔ แอดมิน)
-- Task: R51 (Owner 2026-11-01): "สร้างช่องทางติดต่อทางข้อความระหว่าง ลูกค้า ไรเด้อร์
--       และแอดมินร้าน สำหรับลูกค้าและไรเด้อร์นั้น ๆ ของเว็บเองด้วย
--       เชื่อมต่อกับระบบเดิม ห้ามเปลี่ยนโลจิกหรือสร้างซ้ำ"
-- Status: PREPARED — ยัง NOT APPLIED บน production (รอคำสั่ง Owner · ledger ปัจจุบัน 181)
--
-- Design (ไม่แตะ order engine / notification engine เดิมแม้แต่บรรทัดเดียว):
--   1) public.order_messages — thread รายออเดอร์ (คีย์ = order_number ของ orders กลาง)
--      อ่านผ่าน RLS เฉพาะ: เจ้าของออเดอร์ / ไรเดอร์ที่ผูกงานนั้น / แอดมิน
--   2) send_order_message (SECURITY DEFINER) = จุดเขียนเดียว — validate role จริงฝั่ง server
--      direct INSERT = ถูกบล็อก (ไม่มี INSERT policy) → client ห้ามมี logic ซ้ำ
--   3) แจ้งลูกค้าเมื่อแอดมิน/ไรเดอร์ส่ง = REUSE enqueue_notification (m179) event_key
--      'msg-<id>' (UNIQUE = idempotent) — ไม่เขียน outbox/dispatcher ใหม่
--   4) realtime = ไม่ใช้ (W4C: realtime-js = stub โดย design) → client poll 10 วิ
-- REVERSIBLE: DROP FUNCTION 3 ตัว + DROP TABLE · IDEMPOTENT: รันซ้ำได้ทั้งไฟล์
-- ============================================
BEGIN;

-- ---------- 1. Trusted helpers (SECURITY DEFINER — pattern เดียวกับ is_admin/current_driver_id) ----------
CREATE OR REPLACE FUNCTION public.owns_order_msg(p_order_number text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- orders.customer_ref = auth uid (ตรง) · orders.customer_id = customers.id (m179 pattern)
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.order_number = p_order_number
      AND (
        o.customer_ref = auth.uid()
        OR o.customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid())
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.owns_order_msg(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_order_msg(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.drives_order_msg(p_order_number text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_driver_id() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.delivery_assignments da
       WHERE da.order_number = p_order_number
         AND da.driver_id = public.current_driver_id()
     )
$$;
REVOKE EXECUTE ON FUNCTION public.drives_order_msg(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drives_order_msg(text) TO authenticated, service_role;

-- ---------- 2. ตารางข้อความ ----------
CREATE TABLE IF NOT EXISTS public.order_messages (
  id           text PRIMARY KEY,
  order_number text NOT NULL,
  sender_role  text NOT NULL CHECK (sender_role IN ('customer', 'rider', 'admin')),
  sender_id    uuid NULL,
  driver_id    text NULL,
  body         text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_messages_order ON public.order_messages (order_number, created_at);
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_messages FROM anon;

DROP POLICY IF EXISTS order_messages_select ON public.order_messages;
CREATE POLICY order_messages_select ON public.order_messages
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.owns_order_msg(order_number)
    OR public.drives_order_msg(order_number)
  );
-- ไม่มี INSERT/UPDATE/DELETE policy = direct write ถูกบล็อกทุก role (เขียนผ่าน RPC เท่านั้น)

-- ---------- 3. send_order_message — จุดเขียนเดียว (validate + notify ผ่านระบบเดิม) ----------
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

  -- เชื่อมระบบเดิม (m179): แจ้งลูกค้าเมื่อแอดมิน/ไรเดอร์ส่ง — REUSE enqueue_notification
  -- (event_key UNIQUE = idempotent · failure ไม่กระทบข้อความ — RPC นั้นมี EXCEPTION handler แล้ว)
  IF v_role IN ('admin', 'rider') THEN
    PERFORM public.enqueue_notification(
      'msg-' || v_id,
      v_customer_id,
      'Operational',
      '💬 ข้อความใหม่จากร้าน',
      left(btrim(p_body), 200),
      '/orders'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'order_number', p_order_number);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.send_order_message(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_order_message(text, text, text) TO authenticated, service_role;

COMMENT ON TABLE public.order_messages IS
  'R51: แชตออเดอร์ ลูกค้า↔ไรเดอร์↔แอดมิน (poll-based · write ผ่าน send_order_message เท่านั้น)';
COMMENT ON FUNCTION public.send_order_message(text, text, text) IS
  'R51: จุดเขียนเดียวของ order_messages — validate role จริง + notify ลูกค้าผ่าน enqueue_notification (m179)';

COMMIT;
-- ========== END OF MIGRATION 182 ==========

