-- ============================================
-- Bite Me Baby — Migration 057: CAT-03 canonical storage security (bmb-images)
--
-- AUDIT FINDING (2026-09-29, read-only): storage.objects carries 4 dashboard-
-- generated policies "Allow Full Access uvi74e_0..3" granting SELECT+INSERT+
-- UPDATE+DELETE TO PUBLIC on ALL buckets — anonymous write/delete exposure.
--
-- FIX (per migration 011 canonical contract, already in repo):
--   public SELECT (bucket public) + authenticated INSERT (admin UI gates role;
--   kept per 011 for future customer review images) + admin-only UPDATE/DELETE.
-- DATA-SAFE: policy-only change; no rows touched; existing objects unaffected.
-- media_assets RLS already canonical (admin manage / public read) — untouched.
-- ============================================

-- 1) remove the over-broad dashboard policies
DROP POLICY IF EXISTS "Allow Full Access uvi74e_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow Full Access uvi74e_1" ON storage.objects;
DROP POLICY IF EXISTS "Allow Full Access uvi74e_2" ON storage.objects;
DROP POLICY IF EXISTS "Allow Full Access uvi74e_3" ON storage.objects;

-- 2) canonical policies (mirrors migration 011 §1, idempotent)
DROP POLICY IF EXISTS bmb_images_public_read ON storage.objects;
CREATE POLICY bmb_images_public_read ON storage.objects
  FOR SELECT
  USING ((SELECT id FROM storage.buckets WHERE name = 'bmb-images') = bucket_id);

DROP POLICY IF EXISTS bmb_images_authenticated_upload ON storage.objects;
CREATE POLICY bmb_images_authenticated_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT id FROM storage.buckets WHERE name = 'bmb-images') = bucket_id
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS bmb_images_admin_update ON storage.objects;
CREATE POLICY bmb_images_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    (SELECT id FROM storage.buckets WHERE name = 'bmb-images') = bucket_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS bmb_images_admin_delete ON storage.objects;
CREATE POLICY bmb_images_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    (SELECT id FROM storage.buckets WHERE name = 'bmb-images') = bucket_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
