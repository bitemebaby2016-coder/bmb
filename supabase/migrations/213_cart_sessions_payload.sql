-- ============================================
-- Bite Me Baby — Migration 213: cart_sessions payload (server-side cart sync · R103 · 2026-11-24)
-- ============================================
-- ต่อยอด m180 (telemetry เท่านั้น) — R103 (Owner: "เตรียมทำ Server-side cart sync ต่อให้สมบูรณ์"):
--   ① payload JSONB = เนื้อตะกร้าจริง (รูปเดียวกับ localStorage bmb-cart-v1 ·
--      serializeCart ใน src/lib/cartPersistence.ts): {v, savedAt, order_mode, couponCode,
--      referralCode, items:[{productId, quantity, customizations, mode}]}
--      — ไม่มีราคา/ยอดรวม/สถานะจ่ายเงิน (server re-derive ตอนสร้างออเดอร์ เสมอ · RPC 025)
--   ② RLS SELECT เพิ่มให้ "เจ้าของตัวเอง" — เดิม m180 authenticated เขียนได้อ่านไม่ได้
--      (มีแต่ admin) → restore ข้ามเครื่องอ่านตะกร้าตัวเองไม่ได้
-- กติกา sync (client):
--   * ล็อกอินเท่านั้น (guest คง R63 — ไม่ยิง · ข้ามเครื่องด้วย deep-link ?cart= R102)
--   * id deterministic = 'csa-' || customers.id → 1 แถว/1 ลูกค้า · อัปเดตจากเครื่องไหนก็แถวเดิม
--   * restore เฉพาะเมื่อ local ว่าง (local มีของ = local ชนะ — ไม่ surprise merge)
-- ADDITIVE ONLY · re-run ปลอดภัย
-- ============================================

ALTER TABLE public.cart_sessions
  ADD COLUMN IF NOT EXISTS payload JSONB;

-- เจ้าของอ่านตัวเองได้ (mirror เงื่อนไข insert_own/update_own ของ m180 เป๊ะ)
DROP POLICY IF EXISTS cart_sessions_select_own ON public.cart_sessions;
CREATE POLICY cart_sessions_select_own ON public.cart_sessions
  FOR SELECT TO authenticated
  USING (customer_id IS NULL OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));
