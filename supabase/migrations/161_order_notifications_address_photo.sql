-- ============================================
-- 161 — R10 (Owner 2026-10-27): order lifecycle notifications + address photo
-- ============================================
-- 1) orders_notify_hook(): ทุกออเดอร์/ทุกสถานะต้องมีแจ้งเตือน (เดิมไม่มีที่ไหนเขียน
--    notifications เลย = กระดิ่งลูกค้า/แอดมินเงียบ — ทั้งที่ RLS admin อ่านได้ทุกแถว)
--    · AFTER INSERT = ORDER_CREATED · AFTER UPDATE = ORDER_* ตามสถานะ + PAYMENT_CONFIRMED
--    · ลูกค้าเป็นเจ้าของแถว · แอดมินเห็นทั้งหมดผ่าน notifications_own_read (is_admin)
--    · เคารพ notification_prefs (ปิด Transactional = ไม่แทรก)
-- 2) orders.address_photo_url + attach_address_photo() — รูปที่อยู่ลูกค้า (R10 #3)
-- 3) bucket address-photos (private) + policy เขียนได้เฉพาะโฟลเดอร์ตัวเอง
-- ============================================

CREATE OR REPLACE FUNCTION public.orders_notify_hook() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_cust text;
  v_user uuid;
  v_title text;
  v_type text;
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
      IF COALESCE(NEW.payment_status, '') IS NOT DISTINCT FROM COALESCE(OLD.payment_status, '')
         OR COALESCE(NEW.payment_status, '') <> 'paid' THEN
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

  IF v_cust IS NULL OR v_cust = '' THEN RETURN NULL; END IF;

  SELECT COALESCE((channels->>'Transactional')::boolean, true) INTO v_enabled
    FROM public.notification_prefs WHERE customer_id = v_cust;
  IF NOT COALESCE(v_enabled, true) THEN RETURN NULL; END IF;

  v_id := 'notif-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
          || '-' || substr(md5(random()::text), 1, 5);
  INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)
  VALUES (v_id, v_cust, v_user, v_title, v_msg, false, v_type, 'Transactional', NOW());
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

-- ---------- 2) address photo (R10 #3) ----------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address_photo_url text;

CREATE OR REPLACE FUNCTION public.attach_address_photo(p_order_number text, p_url text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid;
  v_owner text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' OR p_url IS NULL
     OR trim(p_url) = '' OR length(p_url) > 500 THEN
    RAISE EXCEPTION 'ERR_INVALID_INPUT';
  END IF;
  SELECT customer_id INTO v_owner FROM public.orders WHERE order_number = p_order_number;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF v_owner <> v_uid::text AND NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  UPDATE public.orders SET address_photo_url = p_url, updated_at = NOW()
   WHERE order_number = p_order_number;
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number);
END;
$$;
GRANT EXECUTE ON FUNCTION public.attach_address_photo(text, text) TO authenticated, service_role;

-- ---------- 3) storage bucket for address photos ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('address-photos', 'address-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS address_photos_owner_insert ON storage.objects;
CREATE POLICY address_photos_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'address-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS address_photos_owner_read ON storage.objects;
CREATE POLICY address_photos_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'address-photos'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));