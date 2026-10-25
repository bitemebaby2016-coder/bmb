-- ============================================
-- BMB — PROPOSED migration (Wave 1) — NOT EXECUTED
-- สถานะ: ❌ SUPERSEDED / REDUNDANT (สอบแล้ว 2026-10-25 · D7 reconciliation)
--   ผลสอบ: client ปัจจุบันไม่มี direct `from('profiles')` เลย (grep = 0 hits) —
--   authStore ใช้ RPC public.is_admin() (SECURITY DEFINER) เป็น authority ตาม
--   ระบบ role 146/147 · การเพิ่ม GRANT SELECT ให้ authenticated ทุกคนโดยไม่มี
--   consumer = เพิ่ม attack surface เปล่า ๆ → ไม่สร้าง migration ต่อ
--   (ถ้าอนาคตมีหน้าที่ต้อง direct-select profiles ค่อยเสนอพร้อม RLS policy กำกับ)
-- (เดิม) เหตุผล: production ขาด table-level GRANT SELECT บน public.profiles ให้ authenticated
--   → client SELECT ตอบ 42501 "permission denied for table profiles"
--   (ยืนยันสด 2026-09-27 ด้วย JWT ของ qa-admin)
-- ผลที่ทำงานแทนชั่วคราว: src/store/authStore.ts fallback ไป RPC public.is_admin()
--   (SECURITY DEFINER — DB ยังเป็น authority)
-- ถ้ารัน migration นี้แล้ว direct select จะกลับมาใช้ได้ โดย client code ไม่ต้องแก้
-- ============================================

GRANT SELECT ON public.profiles TO authenticated;
