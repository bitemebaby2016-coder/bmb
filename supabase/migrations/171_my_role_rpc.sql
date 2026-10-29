-- ============================================
-- BMB — 171_my_role_rpc.sql (R21 · เฟส 1 A7)
-- --------------------------------------------
-- ปัญหา: fallback `is_admin()` คืนค่า boolean → client map true → 'admin'
--         ทำให้บทบาทจริง (owner/manager/staff/...) ถูกแปลงเป็น 'admin'
--         (adminRoute ใช้ isAdminCapableRole จึงยังผ่าน แต่ UI ตัดสินสิทธิ์
--         ระดับบทบาทเช่น per-role nav คลาดเคลื่อน)
-- แก้: RPC `my_role()` คืน "ชื่อบทบาทจริง" จาก profiles.role ของ auth.uid()
--   * SECURITY DEFINER = อ่าน profiles ได้แม้ table-level GRANT ไม่ครบ
--     (ข้อจำกัดเดิมของ F-02 Wave 1 ที่ทำให้ต้องใช้ is_admin)
--   * SET search_path = public กัน search_path hijack (กฏ A10)
--   * คืน NULL เมื่อไม่มีสิทธิ์/ไม่ได้ล็อกอิน (ต่างจาก error — client แยกได้)
--   * ปิด anon ทุกคน — เรียกได้เฉพาะ authenticated
-- re-run ปลอดภัย: CREATE OR REPLACE
-- ============================================

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

comment on function public.my_role() is
  'R21 A7: คืนชื่อบทบาทจริงของผู้เรียก (profiles.role) — แก้ปัญหา is_admin boolean ที่ map true→admin ทำให้ owner/manager ถูกแปลงเป็น admin';
