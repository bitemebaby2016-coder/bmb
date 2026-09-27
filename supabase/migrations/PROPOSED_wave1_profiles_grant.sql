-- ============================================
-- BMB — PROPOSED migration (Wave 1) — NOT EXECUTED
-- สถานะ: PROPOSED (รอ Owner รันผ่าน SQL Editor / supabase db push)
-- เหตุผล: production ขาด table-level GRANT SELECT บน public.profiles ให้ authenticated
--   → client SELECT ตอบ 42501 "permission denied for table profiles"
--   (ยืนยันสด 2026-09-27 ด้วย JWT ของ qa-admin)
-- ผลที่ทำงานแทนชั่วคราว: src/store/authStore.ts fallback ไป RPC public.is_admin()
--   (SECURITY DEFINER — DB ยังเป็น authority)
-- ถ้ารัน migration นี้แล้ว direct select จะกลับมาใช้ได้ โดย client code ไม่ต้องแก้
-- ============================================

GRANT SELECT ON public.profiles TO authenticated;
