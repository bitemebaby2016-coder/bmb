// ============================================
// Bite Me Baby — R182/R183/R187/R188 source-contract test
// Migration 182: ORDER MESSAGES (chat table + RPC send_order_message v1)
// Migration 183: ORDER MESSAGE NOTIFICATIONS (v2 - customer/admin via notifications table)
// Migration 187: ORDER MESSAGE v3 - FIX rider-send crash + notify rider (id suffix -c/-a/-r)
// Migration 188: ORDER NOTIFICATION DEDUP (trigger id = worker id 'evt-ord-<order>-<status>' + ON CONFLICT DO NOTHING)
// ============================================

import { describe, it, expect } from 'vitest'
import mig182Src from '../../supabase/migrations/182_order_messages.sql?raw'
import mig183Src from '../../supabase/migrations/183_order_message_notifications.sql?raw'
import mig187Src from '../../supabase/migrations/187_order_message_rider_notifications.sql?raw'
import mig188Src from '../../supabase/migrations/188_order_notification_dedup.sql?raw'

describe('R182/R183/R187/R188 — Order Messages + Notifications + DEDUP', () => {
  // ============================================
  // A — Migration 182: Order Messages v1
  // ============================================
  describe('Migration 182: Order Messages v1 (R51)', () => {
    it('มี owns_order_msg(text) RETURNS boolean SECURITY DEFINER', () => {
      expect(mig182Src).toContain('CREATE OR REPLACE FUNCTION public.owns_order_msg(p_order_number text)')
      expect(mig182Src).toContain('RETURNS boolean')
      expect(mig182Src).toContain('LANGUAGE sql STABLE SECURITY DEFINER')
      expect(mig182Src).toContain('SET search_path = public')
    })

    it('owns_order_msg ตรวจสอบ customer_ref หรือ customer_id ผ่าน customers table', () => {
      expect(mig182Src).toMatch(/SELECT auth\.uid\(\) IS NOT NULL AND EXISTS \([\s\S]*?SELECT 1 FROM public\.orders o[\s\S]*?WHERE o\.order_number = p_order_number[\s\S]*?AND \([\s\S]*?o\.customer_ref = auth\.uid\(\)[\s\S]*?OR o\.customer_id IN \(SELECT c\.id FROM public\.customers c WHERE c\.user_id = auth\.uid\(\)\)/)
    })

    it('มี drives_order_msg(text) RETURNS boolean SECURITY DEFINER', () => {
      expect(mig182Src).toContain('CREATE OR REPLACE FUNCTION public.drives_order_msg(p_order_number text)')
      expect(mig182Src).toContain('RETURNS boolean')
      expect(mig182Src).toContain('public.current_driver_id()')
      expect(mig182Src).toContain('delivery_assignments da')
      expect(mig182Src).toContain('da.driver_id = public.current_driver_id()')
    })

    it('GRANT: REVOKE FROM PUBLIC, anon + GRANT TO authenticated, service_role', () => {
      expect(mig182Src).toContain('REVOKE EXECUTE ON FUNCTION public.owns_order_msg(text) FROM PUBLIC, anon')
      expect(mig182Src).toContain('GRANT EXECUTE ON FUNCTION public.owns_order_msg(text) TO authenticated, service_role')
      expect(mig182Src).toContain('REVOKE EXECUTE ON FUNCTION public.drives_order_msg(text) FROM PUBLIC, anon')
      expect(mig182Src).toContain('GRANT EXECUTE ON FUNCTION public.drives_order_msg(text) TO authenticated, service_role')
    })

    it('มี CREATE TABLE IF NOT EXISTS order_messages พร้อม column ครบ', () => {
      expect(mig182Src).toContain('CREATE TABLE IF NOT EXISTS public.order_messages')
      expect(mig182Src).toContain('id           text PRIMARY KEY')
      expect(mig182Src).toContain('order_number text NOT NULL')
      expect(mig182Src).toContain("sender_role  text NOT NULL CHECK (sender_role IN ('customer', 'rider', 'admin'))")
      expect(mig182Src).toContain('sender_id    uuid NULL')
      expect(mig182Src).toContain('driver_id    text NULL')
      expect(mig182Src).toContain('body         text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000)')
      expect(mig182Src).toContain('created_at   timestamptz NOT NULL DEFAULT now()')
    })

    it('มี index idx_order_messages_order (order_number, created_at)', () => {
      expect(mig182Src).toContain('CREATE INDEX IF NOT EXISTS idx_order_messages_order ON public.order_messages (order_number, created_at)')
    })

    it('มี RLS: ALTER TABLE ENABLE + REVOKE ALL FROM anon + SELECT policy (admin OR owns OR drives)', () => {
      expect(mig182Src).toContain('ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY')
      expect(mig182Src).toContain('REVOKE ALL ON public.order_messages FROM anon')
      expect(mig182Src).toContain('DROP POLICY IF EXISTS order_messages_select ON public.order_messages')
      expect(mig182Src).toMatch(/CREATE POLICY order_messages_select ON public\.order_messages[\s\S]*?FOR SELECT TO authenticated/)
      expect(mig182Src).toMatch(/USING \([\s\S]*?public\.is_admin\(\)[\s\S]*?OR public\.owns_order_msg\(order_number\)[\s\S]*?OR public\.drives_order_msg\(order_number\)/)
    })

    it('ไม่มี INSERT/UPDATE/DELETE policy = direct write ถูกบล็อก', () => {
      expect(mig182Src).not.toContain('CREATE POLICY.*INSERT')
      expect(mig182Src).not.toContain('CREATE POLICY.*UPDATE')
      expect(mig182Src).not.toContain('CREATE POLICY.*DELETE')
    })

    it('มี send_order_message(text, text, text) RETURNS jsonb SECURITY DEFINER', () => {
      expect(mig182Src).toContain('CREATE OR REPLACE FUNCTION public.send_order_message(')
      expect(mig182Src).toContain('p_order_number text')
      expect(mig182Src).toContain('p_body text')
      expect(mig182Src).toContain("p_sender_role text DEFAULT 'customer'")
      expect(mig182Src).toContain('RETURNS jsonb')
      expect(mig182Src).toContain('LANGUAGE plpgsql SECURITY DEFINER SET search_path = public')
    })

    it('send_order_message: validation ครบ (auth, order_number, body length 1-2000, sender_role enum)', () => {
      expect(mig182Src).toContain("IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'")
      expect(mig182Src).toContain("IF p_order_number IS NULL OR length(trim(p_order_number)) = 0 THEN RAISE EXCEPTION 'ERR_MISSING_ORDER'")
      expect(mig182Src).toContain("IF p_body IS NULL OR length(btrim(p_body)) = 0 THEN RAISE EXCEPTION 'ERR_EMPTY_MESSAGE'")
      expect(mig182Src).toContain("IF length(btrim(p_body)) > 2000 THEN RAISE EXCEPTION 'ERR_MESSAGE_TOO_LONG'")
      expect(mig182Src).toContain("IF v_role NOT IN ('customer', 'rider', 'admin') THEN RAISE EXCEPTION 'ERR_INVALID_ROLE'")
    })

    it('send_order_message: role validation — admin ต้อง is_admin, rider ต้อง drives_order_msg, customer ต้อง owns_order_msg', () => {
      expect(mig182Src).toContain("IF v_role = 'admin' THEN")
      expect(mig182Src).toContain("IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'")
      expect(mig182Src).toContain("ELSIF v_role = 'rider' THEN")
      expect(mig182Src).toContain("v_driver := public.current_driver_id()")
      expect(mig182Src).toMatch(/NOT EXISTS \([\s\S]*?SELECT 1 FROM public\.delivery_assignments da[\s\S]*?WHERE da\.order_number = p_order_number AND da\.driver_id = v_driver/)
      expect(mig182Src).toContain("IF NOT public.owns_order_msg(p_order_number) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'")
    })

    it('send_order_message: INSERT order_messages ด้วย id = omsg-<epoch_ms>-<random4>', () => {
      expect(mig182Src).toContain("v_id := 'omsg-' || ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint::text)")
      expect(mig182Src).toContain("|| '-' || substr(md5(random()::text), 1, 4)")
      expect(mig182Src).toContain("INSERT INTO public.order_messages (id, order_number, sender_role, sender_id, driver_id, body)")
    })

    it('send_order_message: REUSE enqueue_notification (m179) event_key = msg-<id> เมื่อ admin/rider ส่ง', () => {
      expect(mig182Src).toContain("IF v_role IN ('admin', 'rider') THEN")
      expect(mig182Src).toContain("PERFORM public.enqueue_notification(")
      expect(mig182Src).toContain("'msg-' || v_id")
      expect(mig182Src).toContain("'Operational'")
      expect(mig182Src).toContain("left(btrim(p_body), 200)")
      expect(mig182Src).toContain("'/orders'")
    })

    it('send_order_message: EXCEPTION WHEN OTHERS RETURN jsonb ok=false', () => {
      expect(mig182Src).toContain('EXCEPTION WHEN OTHERS THEN')
      expect(mig182Src).toContain("RETURN jsonb_build_object('ok', false, 'error', SQLERRM)")
    })

    it('send_order_message GRANT: REVOKE FROM PUBLIC, anon + GRANT TO authenticated, service_role', () => {
      expect(mig182Src).toContain("REVOKE ALL ON FUNCTION public.send_order_message(text, text, text) FROM PUBLIC, anon")
      expect(mig182Src).toContain("GRANT EXECUTE ON FUNCTION public.send_order_message(text, text, text) TO authenticated, service_role")
    })
  })

  // ============================================
  // B — Migration 183: Order Message Notifications v2
  // ============================================
  describe('Migration 183: Order Message Notifications v2 (R70)', () => {
    it('มี ALTER TABLE notifications ALTER COLUMN customer_id DROP NOT NULL', () => {
      expect(mig183Src).toContain('ALTER TABLE public.notifications ALTER COLUMN customer_id DROP NOT NULL')
    })

    it('send_order_message v2: INSERT notifications แถวลูกค้า (customer_id != NULL) + admin/ไรเดอร์ (customer_id NULL)', () => {
      expect(mig183Src).toContain("IF v_role IN ('admin', 'rider') AND v_customer_id IS NOT NULL THEN")
      expect(mig183Src).toContain("INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)")
      expect(mig183Src).toContain("VALUES ('msgn-' || v_id, v_customer_id, NULL")
      expect(mig183Src).toContain("'💬 ข้อความใหม่จากร้าน'")

      expect(mig183Src).toContain("IF v_role IN ('customer', 'rider') THEN")
      expect(mig183Src).toContain("VALUES ('msgn-' || v_id, NULL, NULL")
      expect(mig183Src).toContain("'💬 ข้อความใหม่จาก' || CASE WHEN v_role = 'rider' THEN 'ไรเดอร์' ELSE 'ลูกค้า' END")
    })

    it('BEST-EFFORT: INSERT notifications wrapped ใน BEGIN/EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN NULL', () => {
      expect(mig183Src).toContain('BEGIN')
      expect(mig183Src).toContain('EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN')
      expect(mig183Src).toContain('NULL;')
    })

    it('send_order_message v2 GRANT: REVOKE FROM PUBLIC, anon + GRANT TO authenticated, service_role', () => {
      expect(mig183Src).toContain("REVOKE ALL ON FUNCTION public.send_order_message(text, text, text) FROM PUBLIC, anon")
      expect(mig183Src).toContain("GRANT EXECUTE ON FUNCTION public.send_order_message(text, text, text) TO authenticated, service_role")
    })
  })

  // ============================================
  // C — Migration 187: Order Message v3 (FIX rider crash + notify rider)
  // ============================================
  describe('Migration 187: Order Message v3 - FIX rider crash + notify rider (R71)', () => {
    it('มี ALTER TABLE notifications ALTER COLUMN customer_id DROP NOT NULL', () => {
      expect(mig187Src).toContain('ALTER TABLE public.notifications ALTER COLUMN customer_id DROP NOT NULL')
    })

    it('send_order_message v3: query v_rider_uid จาก delivery_assignments + drivers (latest active assignment)', () => {
      expect(mig187Src).toContain("SELECT d.user_id INTO v_rider_uid")
      expect(mig187Src).toContain("FROM public.delivery_assignments da")
      expect(mig187Src).toContain("JOIN public.drivers d ON d.id = da.driver_id")
      expect(mig187Src).toContain("WHERE da.order_number = p_order_number")
      expect(mig187Src).toContain("COALESCE(da.status, '') NOT IN ('cancelled', 'declined')")
      expect(mig187Src).toContain("ORDER BY da.assigned_at DESC")
      expect(mig187Src).toContain("LIMIT 1")
    })

    it('id suffix แยกตามผู้รับ: -c (ลูกค้า), -a (แอดมิน), -r (ไรเดอร์) กันชน unique key', () => {
      expect(mig187Src).toContain("'msgn-' || v_id || '-c'") // customer
      expect(mig187Src).toContain("'msgn-' || v_id || '-a'") // admin
      expect(mig187Src).toContain("'msgn-' || v_id || '-r'") // rider
    })

    it('แจ้งไรเดอร์: INSERT notifications user_id = v_rider_uid (RLS own_read = กระดิ่ง /rider)', () => {
      expect(mig187Src).toContain("IF v_role IN ('admin', 'customer') AND v_rider_uid IS NOT NULL THEN")
      expect(mig187Src).toContain("VALUES ('msgn-' || v_id || '-r', NULL, v_rider_uid")
      expect(mig187Src).toContain("'💬 ข้อความใหม่จาก' || v_from")
    })

    it('แจ้งลูกค้า: customer_id = v_customer_id (กระดิ่ง + push ผ่าน dispatcher ntf-)', () => {
      expect(mig187Src).toContain("IF v_role IN ('admin', 'rider') AND v_customer_id IS NOT NULL THEN")
      expect(mig187Src).toContain("VALUES ('msgn-' || v_id || '-c', v_customer_id, NULL")
    })

    it('แจ้งแอดมิน: customer_id NULL + user_id NULL (RLS admin_read = กระดิ่งแอดมิน)', () => {
      expect(mig187Src).toContain("IF v_role IN ('customer', 'rider') THEN")
      expect(mig187Src).toContain("VALUES ('msgn-' || v_id || '-a', NULL, NULL")
    })

    it('v_from แสดงชื่อผู้ส่ง: rider=ไรเดอร์, admin=ร้าน, customer=ลูกค้า', () => {
      expect(mig187Src).toContain("v_from := CASE v_role WHEN 'rider' THEN 'ไรเดอร์' WHEN 'admin' THEN 'ร้าน' ELSE 'ลูกค้า' END")
    })

    it('BEST-EFFORT ทุกแถว: BEGIN/EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN NULL', () => {
      expect(mig187Src).toContain('BEGIN')
      expect(mig187Src).toContain('EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN')
      expect(mig187Src).toContain('NULL;')
    })

    it('send_order_message v3 GRANT: REVOKE FROM PUBLIC, anon + GRANT TO authenticated, service_role', () => {
      expect(mig187Src).toContain("REVOKE ALL ON FUNCTION public.send_order_message(text, text, text) FROM PUBLIC, anon")
      expect(mig187Src).toContain("GRANT EXECUTE ON FUNCTION public.send_order_message(text, text, text) TO authenticated, service_role")
    })
  })

  // ============================================
  // D — Migration 188: Order Notification DEDUP
  // ============================================
  describe('Migration 188: Order Notification DEDUP (R72)', () => {
    it('มี CREATE OR REPLACE FUNCTION orders_notify_hook() RETURNS TRIGGER', () => {
      expect(mig188Src).toContain('CREATE OR REPLACE FUNCTION public.orders_notify_hook()')
      expect(mig188Src).toContain('RETURNS TRIGGER')
      expect(mig188Src).toContain('LANGUAGE plpgsql')
      expect(mig188Src).toContain('SECURITY DEFINER')
      expect(mig188Src).toContain('SET search_path = public')
    })

    it('id deterministic = evt-ord-<order>-<status> / evt-pay-<order>-<payment_status> (ตรง worker)', () => {
      expect(mig188Src).toContain("v_id := CASE")
      expect(mig188Src).toContain("WHEN TG_OP = 'INSERT' THEN 'evt-ord-' || NEW.order_number || '-' || NEW.status::text")
      expect(mig188Src).toContain("WHEN TG_ARGV[0] = 'payment' THEN 'evt-pay-' || NEW.order_number || '-' || NEW.payment_status::text")
      expect(mig188Src).toContain("ELSE 'evt-ord-' || NEW.order_number || '-' || NEW.status::text")
    })

    it('INSERT notifications ON CONFLICT (id) DO NOTHING (dedup กับ worker)', () => {
      expect(mig188Src).toContain('INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)')
      expect(mig188Src).toContain('VALUES (v_id, v_cust, v_user, v_title, v_msg, false, v_type, \'Transactional\', NOW())')
      expect(mig188Src).toContain('ON CONFLICT (id) DO NOTHING')
    })

    it('BEST-EFFORT: EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN NULL', () => {
      expect(mig188Src).toContain('EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN')
      expect(mig188Src).toContain('NULL;')
    })

    it('status mapping ครบ: pending→ORDER_CREATED, confirmed→ORDER_CONFIRMED, preparing→ORDER_PREPARING, ready_for_dispatch→ORDER_READY, dispatched→ORDER_DISPATCHED, in_transit→ORDER_IN_TRANSIT, arrived→ORDER_ARRIVED, delivered→ORDER_DELIVERED, cancelled→ORDER_CANCELLED, failed→ORDER_FAILED', () => {
      expect(mig188Src).toContain("WHEN 'pending'            THEN 'ORDER_CREATED'")
      expect(mig188Src).toContain("WHEN 'confirmed'          THEN 'ORDER_CONFIRMED'")
      expect(mig188Src).toContain("WHEN 'preparing'          THEN 'ORDER_PREPARING'")
      expect(mig188Src).toContain("WHEN 'ready_for_dispatch' THEN 'ORDER_READY'")
      expect(mig188Src).toContain("WHEN 'dispatched'         THEN 'ORDER_DISPATCHED'")
      expect(mig188Src).toContain("WHEN 'in_transit'         THEN 'ORDER_IN_TRANSIT'")
      expect(mig188Src).toContain("WHEN 'arrived'            THEN 'ORDER_ARRIVED'")
      expect(mig188Src).toContain("WHEN 'delivered'          THEN 'ORDER_DELIVERED'")
      expect(mig188Src).toContain("WHEN 'cancelled'          THEN 'ORDER_CANCELLED'")
      expect(mig188Src).toContain("WHEN 'failed'             THEN 'ORDER_FAILED'")
    })

    it('title mapping ครบตาม status', () => {
      expect(mig188Src).toContain("WHEN 'ORDER_CONFIRMED'  THEN 'ยืนยันออเดอร์แล้ว'")
      expect(mig188Src).toContain("WHEN 'ORDER_PREPARING'  THEN 'กำลังเตรียมอาหาร'")
      expect(mig188Src).toContain("WHEN 'ORDER_READY'      THEN 'อาหารพร้อมแล้ว'")
      expect(mig188Src).toContain("WHEN 'ORDER_DISPATCHED' THEN 'ออกส่งแล้ว'")
      expect(mig188Src).toContain("WHEN 'ORDER_IN_TRANSIT' THEN 'กำลังเดินทาง'")
      expect(mig188Src).toContain("WHEN 'ORDER_ARRIVED'    THEN 'ถึงปลายทางแล้ว'")
      expect(mig188Src).toContain("WHEN 'ORDER_DELIVERED'  THEN 'จัดส่งสำเร็จ'")
      expect(mig188Src).toContain("WHEN 'ORDER_CANCELLED'  THEN 'ออเดอร์ถูกยกเลิก'")
      expect(mig188Src).toContain("WHEN 'ORDER_FAILED'     THEN 'ออเดอร์ไม่สำเร็จ'")
    })

    it('มี TRIGGER: trg_orders_notify_insert (AFTER INSERT), trg_orders_notify_status (AFTER UPDATE OF status), trg_orders_notify_payment (AFTER UPDATE OF payment_status)', () => {
      expect(mig188Src).toContain("DROP TRIGGER IF EXISTS trg_orders_notify_insert ON public.orders")
      expect(mig188Src).toMatch(/CREATE TRIGGER trg_orders_notify_insert[\s\S]*?AFTER INSERT ON public\.orders[\s\S]*?FOR EACH ROW EXECUTE FUNCTION public\.orders_notify_hook\(\)/)
      expect(mig188Src).toContain("DROP TRIGGER IF EXISTS trg_orders_notify_status ON public.orders")
      expect(mig188Src).toMatch(/CREATE TRIGGER trg_orders_notify_status[\s\S]*?AFTER UPDATE OF status ON public\.orders[\s\S]*?FOR EACH ROW EXECUTE FUNCTION public\.orders_notify_hook\('status'\)/)
      expect(mig188Src).toContain("DROP TRIGGER IF EXISTS trg_orders_notify_payment ON public.orders")
      expect(mig188Src).toMatch(/CREATE TRIGGER trg_orders_notify_payment[\s\S]*?AFTER UPDATE OF payment_status ON public\.orders[\s\S]*?FOR EACH ROW EXECUTE FUNCTION public\.orders_notify_hook\('payment'\)/)
    })

    it('BEGIN/COMMIT transaction wrapper', () => {
      expect(mig188Src).toContain('BEGIN;')
      expect(mig188Src).toContain('COMMIT;')
    })
  })

  // ============================================
  // E — Additive/Idempotent checks
  // ============================================
  describe('Additive/Idempotent — ไม่มี DROP TABLE/COLUMN, CREATE OR REPLACE ครบ', () => {
    it('Migration 182: ไม่มี DROP TABLE/DROP COLUMN ในโค้ดจริง, CREATE OR REPLACE ฟังก์ชันครบ', () => {
      // ตรวจสอบเฉพาะในส่วนโค้ดจริง (หลัง BEGIN; และก่อน COMMENT/END)
      const codeSection = mig182Src.substring(mig182Src.indexOf('BEGIN;'))
      expect(codeSection).not.toContain('DROP TABLE')
      expect(codeSection).not.toContain('DROP COLUMN')
      expect(mig182Src).toContain('CREATE OR REPLACE FUNCTION public.owns_order_msg')
      expect(mig182Src).toContain('CREATE OR REPLACE FUNCTION public.drives_order_msg')
      expect(mig182Src).toContain('CREATE OR REPLACE FUNCTION public.send_order_message')
    })

    it('Migration 183: CREATE OR REPLACE send_order_message v2', () => {
      expect(mig183Src).toContain('CREATE OR REPLACE FUNCTION public.send_order_message')
      expect(mig183Src).not.toContain('DROP TABLE')
      expect(mig183Src).not.toContain('DROP COLUMN')
    })

    it('Migration 187: CREATE OR REPLACE send_order_message v3', () => {
      expect(mig187Src).toContain('CREATE OR REPLACE FUNCTION public.send_order_message')
      expect(mig187Src).not.toContain('DROP TABLE')
      expect(mig187Src).not.toContain('DROP COLUMN')
    })

    it('Migration 188: CREATE OR REPLACE orders_notify_hook + DROP/CREATE TRIGGER', () => {
      expect(mig188Src).toContain('CREATE OR REPLACE FUNCTION public.orders_notify_hook')
      expect(mig188Src).not.toContain('DROP TABLE')
      expect(mig188Src).not.toContain('DROP COLUMN')
      expect(mig188Src).toContain('DROP TRIGGER IF EXISTS trg_orders_notify_insert')
      expect(mig188Src).toContain('CREATE TRIGGER trg_orders_notify_insert')
      expect(mig188Src).toContain('DROP TRIGGER IF EXISTS trg_orders_notify_status')
      expect(mig188Src).toContain('CREATE TRIGGER trg_orders_notify_status')
      expect(mig188Src).toContain('DROP TRIGGER IF EXISTS trg_orders_notify_payment')
      expect(mig188Src).toContain('CREATE TRIGGER trg_orders_notify_payment')
    })
  })
})