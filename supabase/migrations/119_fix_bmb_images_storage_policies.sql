-- ============================================
-- Bite Me Baby — Migration 119: fix bmb-images storage INSERT (admin "เพิ่มรูปไม่ได้")
--
-- SYMPTOM (Owner, 2026-10-07): admin อัปโหลดรูปสินค้าไม่ได้ทุกหน้า
--   /admin/products + /admin/media → toast "อัปโหลดไม่สำเร็จ: ERR_UPLOAD_FAILED
--   (ตรวจ storage policy / การล็อกอิน admin)"
-- ROOT CAUSE (probe e2e/adminMediaProbe.cjs, live 2026-10-07):
--   supabase.storage.from('bmb-images').upload() →
--   "new row violates row-level security policy"
--   Policies used a scalar subquery on storage.buckets:
--     (SELECT id FROM storage.buckets WHERE name='bmb-images') = bucket_id
--   RLS on storage.buckets hides the row from `authenticated` → subquery → NULL
--   → NULL = bucket_id → NULL → WITH CHECK fails → 42501.
--   (media_assets RLS itself is FINE — insert with tenant_id passes.)
-- FIX: reference the bucket id literal (canonical Supabase pattern); keep
--   admin-only UPDATE/DELETE via the profiles self-read subquery (works —
--   profiles self-read is allowed).
-- DATA-SAFE: policy-only change; no rows touched; existing objects unaffected.
-- Idempotent: DROP POLICY IF EXISTS + CREATE.
-- ============================================

-- public read (bucket is public)
DROP POLICY IF EXISTS bmb_images_public_read ON storage.objects;
CREATE POLICY bmb_images_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'bmb-images');

-- authenticated can upload (admin UI gates the role; also review photos later)
DROP POLICY IF EXISTS bmb_images_authenticated_upload ON storage.objects;
CREATE POLICY bmb_images_authenticated_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bmb-images');

-- admin-only update/delete (profiles self-read is RLS-allowed → subquery OK)
DROP POLICY IF EXISTS bmb_images_admin_update ON storage.objects;
CREATE POLICY bmb_images_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bmb-images'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS bmb_images_admin_delete ON storage.objects;
CREATE POLICY bmb_images_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'bmb-images'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
