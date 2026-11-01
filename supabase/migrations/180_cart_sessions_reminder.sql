-- ============================================
-- Bite Me Baby — Migration 180: cart_sessions (abandoned-cart source) + reminder_days (R49 · 2026-11-01)
-- ============================================
-- Owner R49 DoD: "Background Jobs — เตือน Pre-order (ตามกฎแอดมิน ปรับได้ ./1 วัน) และ Abandoned Cart
--   ให้ใช้ cron/queue ประมวลผล (ไม่กระทบ API หลัก)"
-- ① cart_sessions = server-side snapshot เล็ก ๆ ของตะกร้า (telemetry เท่านั้น — ไม่แตะราคา/ออเดอร์)
--    client sync (src/lib/cartSessionSync) → EF notification-dispatcher builder abandoned_cart
--    15-30 นาที → enqueue outbox (idempotent) — เหตุผลที่ต้องมีตาราง: ตะกร้าจริงอยู่ localStorage
-- ② order_policy.reminder_days = จำนวนวันก่อนรอบส่งที่เตือนพรีออเดอร์ (แอดมินปรับได้ · default 1)
-- ADDITIVE ONLY · re-run ปลอดภัย

CREATE TABLE IF NOT EXISTS public.cart_sessions (
  id            TEXT PRIMARY KEY,               -- client-generated id (เก็บใน localStorage รายเครื่อง)
  customer_id   TEXT REFERENCES public.customers(id) ON DELETE CASCADE, -- NULL = guest (ไม่ยิงแจ้งเตือน)
  items_count   INTEGER NOT NULL DEFAULT 0,
  total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'notified', 'converted', 'skipped_guest')),
  notified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cart_sessions_abandoned_idx
  ON public.cart_sessions (updated_at)
  WHERE status = 'active' AND items_count > 0;

-- RLS: เขียนได้เฉพาะแถวตัวเอง (เท่านั้นที่อ่านได้) · admin อ่านทั้งหมด · ห้าม anon SELECT
ALTER TABLE public.cart_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cart_sessions_deny_anon ON public.cart_sessions;
CREATE POLICY cart_sessions_deny_anon ON public.cart_sessions FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS cart_sessions_insert_own ON public.cart_sessions;
CREATE POLICY cart_sessions_insert_own ON public.cart_sessions
  FOR INSERT TO authenticated
  WITH CHECK (customer_id IS NULL OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS cart_sessions_update_own ON public.cart_sessions;
CREATE POLICY cart_sessions_update_own ON public.cart_sessions
  FOR UPDATE TO authenticated
  USING (customer_id IS NULL OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()))
  WITH CHECK (customer_id IS NULL OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS cart_sessions_admin_all ON public.cart_sessions;
CREATE POLICY cart_sessions_admin_all ON public.cart_sessions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ② reminder_days = วันก่อนรอบส่งสำหรับเตือนพรีออเดอร์ (แก้ผ่าน admin order_policy — ใส่ถ้ายังไม่มี)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'order_policy')
     AND NOT EXISTS (SELECT 1 FROM public.business_settings
                      WHERE key = 'order_policy' AND (value ? 'reminder_days')) THEN
    UPDATE public.business_settings
       SET value = jsonb_set(value, '{reminder_days}', '1'::jsonb, true), updated_at = NOW()
     WHERE key = 'order_policy';
  END IF;
END $$;