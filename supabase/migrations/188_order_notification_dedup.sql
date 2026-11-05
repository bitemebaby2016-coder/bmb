-- ============================================
-- Bite Me Baby — Migration 188: ORDER NOTIFICATION DEDUP (แจ้งเตือนออเดอร์ซ้ำ 2 เท่า)
-- Task: R72 (Owner 2026-11-05 ค่ำ: "แจ้งเตือนมีซ้ำ …") — หลักฐาน e2e/_r72_probe.cjs:
--   เหตุการณ์สถานะเดียวกันถูกเขียน 2 แถวจาก 2 ตัวเขียน:
--     ① m161 orders_notify_hook (trigger realtime · id 'notif-<ts>-<rand>')
--     ② automation-worker runNotificationDispatch (cron · id 'evt-ord-<order>-<status>')
--   → กระดิ่งลูกค้า/แอดมินเห็นซ้ำทุกเหตุการณ์ ("รับสินค้าแล้ว" ×2 ...)
-- Design: ให้ trigger ใช้ id เดียวกับ worker เป๊ะ ('evt-ord-<order>-<status>) +
--   INSERT ... ON CONFLICT (id) DO NOTHING → ใครมาก่อนได้แถวเดียว ไม่ซ้ำอีกเลย
--   (worker notifyOnce dedup ด้วย id เดิมอยู่แล้ว · แถว payment แยก namespace
--    'evt-pay-<order>-<status>' ไม่มีคู่ใน worker = คงพฤติกรรมเดิม)
-- REVERSIBLE: CREATE OR REPLACE — คืน m161 ได้จากไฟล์ 161 · IDEMPOTENT
-- ============================================
BEGIN;

CREATE OR REPLACE FUNCTION public.orders_notify_hook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cust text;
  v_user uuid;
  v_type text;
  v_title text;
  v_msg text;
  v_enabled boolean;
  v_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_cust := NEW.customer_id;
    v_user := NEW.customer_ref;
    v_type := 'ORDER_CREATED';
    v_title := 'รับออเดอร์แล้ว';
    v_msg := 'มีออเดอร์เข้ามา — เลขที่ #' || NEW.order_number || ' · ขอบคุณที่สั่ง Bite Me Baby';
  ELSE
    IF TG_ARGV[0] = 'payment' THEN
      IF COALESCE(NEW.payment_status::text, '') IS NOT DISTINCT FROM COALESCE(OLD.payment_status::text, '')
         OR COALESCE(NEW.payment_status::text, '') <> 'paid' THEN
        RETURN NULL;
      END IF;
      v_type := 'PAYMENT_CONFIRMED';
      v_title := 'ยืนยันการชำระเงินแล้ว';
      v_msg := 'ได้รับการชำระเงินของ #' || NEW.order_number || ' แล้ว';
    ELSE
      IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
      v_type := CASE NEW.status::text
        WHEN 'pending'            THEN 'ORDER_CREATED'
        WHEN 'confirmed'          THEN 'ORDER_CONFIRMED'
        WHEN 'preparing'          THEN 'ORDER_PREPARING'
        WHEN 'ready_for_dispatch' THEN 'ORDER_READY'
        WHEN 'dispatched'         THEN 'ORDER_DISPATCHED'
        WHEN 'in_transit'         THEN 'ORDER_IN_TRANSIT'
        WHEN 'arrived'            THEN 'ORDER_ARRIVED'
        WHEN 'delivered'          THEN 'ORDER_DELIVERED'
        WHEN 'cancelled'          THEN 'ORDER_CANCELLED'
        WHEN 'failed'             THEN 'ORDER_FAILED'
        ELSE 'ORDER_UPDATED'
      END;
      v_title := CASE v_type
        WHEN 'ORDER_CONFIRMED'  THEN 'ยืนยันออเดอร์แล้ว'
        WHEN 'ORDER_PREPARING'  THEN 'กำลังเตรียมอาหาร'
        WHEN 'ORDER_READY'      THEN 'อาหารพร้อมแล้ว'
        WHEN 'ORDER_DISPATCHED' THEN 'ออกส่งแล้ว'
        WHEN 'ORDER_IN_TRANSIT' THEN 'กำลังเดินทาง'
        WHEN 'ORDER_ARRIVED'    THEN 'ถึงปลายทางแล้ว'
        WHEN 'ORDER_DELIVERED'  THEN 'จัดส่งสำเร็จ'
        WHEN 'ORDER_CANCELLED'  THEN 'ออเดอร์ถูกยกเลิก'
        WHEN 'ORDER_FAILED'     THEN 'ออเดอร์ไม่สำเร็จ'
        ELSE 'อัปเดตสถานะออเดอร์'
      END;
      v_msg := '#' || NEW.order_number || ' — ' || v_title;
    END IF;
    v_cust := NEW.customer_id;
    v_user := NEW.customer_ref;
  END IF;

  SELECT COALESCE((channels->>'Transactional')::boolean, true) INTO v_enabled
    FROM public.notification_prefs WHERE customer_id = v_cust;
  IF NOT COALESCE(v_enabled, true) THEN RETURN NULL; END IF;

  -- R72: id แบบ deterministic ตรงกับ automation-worker (`evt-ord-<order>-<status>`) —
  -- trigger realtime กับ worker cron เขียนชน id เดียวกัน = เหลือแถวเดียว (ON CONFLICT ด้านล่าง)
  v_id := CASE
    WHEN TG_OP = 'INSERT' THEN 'evt-ord-' || NEW.order_number || '-' || NEW.status::text
    WHEN TG_ARGV[0] = 'payment' THEN 'evt-pay-' || NEW.order_number || '-' || NEW.payment_status::text
    ELSE 'evt-ord-' || NEW.order_number || '-' || NEW.status::text
  END;

  BEGIN
    INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)
    VALUES (v_id, v_cust, v_user, v_title, v_msg, false, v_type, 'Transactional', NOW())
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN
    NULL;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_notify_insert ON public.orders;
CREATE TRIGGER trg_orders_notify_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_notify_hook();

DROP TRIGGER IF EXISTS trg_orders_notify_status ON public.orders;
CREATE TRIGGER trg_orders_notify_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_notify_hook('status');

DROP TRIGGER IF EXISTS trg_orders_notify_payment ON public.orders;
CREATE TRIGGER trg_orders_notify_payment
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_notify_hook('payment');

COMMIT;
-- ========== END OF MIGRATION 188 ==========