-- ============================================
-- Bite Me Baby — Migration 183: promotions.banner_mascot (R61)
-- Date: 2026-11-03
--
-- Purpose (Owner 2026-11-03 — ฟีเจอร์ /admin/promotions):
--   แอดมินสร้างโปรโมชั่นแล้ว "ประกอบ" ภาพเองได้:
--     banner_image  = ภาพแนบ (อัปโหลดจากเครื่อง หรือเลือกจากคลังภาพ AI)
--     banner_mascot = มาสคอต (อัปโหลดจากเครื่อง หรือเลือกจากคลังภาพ หรือมาสคอตมาตรฐาน 4 ท่า)
--   FloatingAdBanners นำค่าทั้งสองไปแสดง/ประกอบมุมรูปตามที่แอดมินเลือก
--   (ไม่มีค่า = คงพฤติกรรมเดิม: มาสคอตสลับตามลำดับโพส)
--
-- Idempotent: safe to re-run.
-- Applied on production via: node e2e/r61Apply183.cjs (Management API + ledger record)
-- ============================================

ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS banner_mascot TEXT;

COMMENT ON COLUMN public.promotions.banner_mascot IS
  'R61: URL รูปมาสคอตที่แอดมินเลือกเอง (เครื่อง/คลังภาพ AI/มาตรฐาน) — ว่าง = FloatingAdBanners ใช้มาสคอตสลับตามลำดับโพส';
