-- ============================================
-- R12 (Owner approval 2026-10-28): "anon ให้เห็นทั้งหมดตั้งแต่แรก
-- ทุกคนเห็นค่าจริงที่ admin ตั้ง อนุมัติ" — customers/guests must see the
-- REAL business settings from the first load (social_links/LINE, hours,
-- operating_hours, marketing, policies …) instead of hardcoded fallbacks.
-- Replaces the 5-key whitelist policy from migrations 077/088; SELECT is now
-- open to anon+authenticated on the whole table. Writes are unchanged:
-- admin/branch-admin only (business_settings_branch_admin_manage stays, plus
-- the anon write-denial policy).
-- ============================================
DROP POLICY IF EXISTS business_settings_public_read ON public.business_settings;

CREATE POLICY business_settings_public_read ON public.business_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON POLICY business_settings_public_read ON public.business_settings IS
  'R12 (2026-10-28): ทุกคน (anon+authenticated) เห็น business_settings ทั้งหมดแบบอ่านอย่างเดียว';