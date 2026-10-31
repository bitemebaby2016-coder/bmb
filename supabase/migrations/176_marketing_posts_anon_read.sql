-- ============================================
-- Bite Me Baby — 176: marketing_posts — anon อ่านเฉพาะโพสต์ที่เผยแพร่แล้ว
-- (R38 · Owner 2026-10-31: "ทดสอบสร้างโพสและโต้ตอบ ดึงเข้าเว็บ")
-- ============================================
-- เดิม 137: deny_anon (USING false) + ไม่มี GRANT SELECT → PostgREST 42501
--   (พิสูจน์แล้วด้วย e2e/r38_anon_posts_probe.cjs: "permission denied for table marketing_posts")
-- เปลี่ยนเป็น: GRANT SELECT + policy กรอง status='published' เท่านั้น
--   → draft/pending_approval/approved/scheduled/failed = anon เห็น 0 แถว (RLS)
--   → หน้าแรก (MarketingFeedSection) ดึงขึ้นโชว์ได้จริง · widget ซ่อนตัวเงียบถ้ายังไม่ apply
-- ไม่แตะ policy ของ authenticated/marketing/admin (137/147 คงเดิม)
-- Reversible: DROP marketing_posts_anon_published + คืน deny_anon เดิม + REVOKE
-- ============================================

BEGIN;

GRANT SELECT ON public.marketing_posts TO anon;

DROP POLICY IF EXISTS marketing_posts_deny_anon ON public.marketing_posts;
DROP POLICY IF EXISTS marketing_posts_anon_published ON public.marketing_posts;
CREATE POLICY marketing_posts_anon_published ON public.marketing_posts
  FOR SELECT TO anon
  USING (status = 'published');

COMMIT;
-- ============================================
-- END OF MIGRATION 176
-- ============================================