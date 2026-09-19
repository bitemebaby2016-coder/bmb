-- ============================================
-- Bite Me Baby — Migration 011: Storage policies for `bmb-images` + media_assets re-assert
-- Date: 2026-09-19 (Phase C-D items C-6/C-7)
--
-- Context:
--   - storage bucket `bmb-images` already exists on the project (checked 2026-09-19,
--     public=true, created 2026-09-15).
--   - `media_assets` RLS already exists (public read + admin manage, migration 008).
--   - The bucket needs storage.objects policies so the Admin Media Library can
--     upload/list/delete via Supabase Storage (bmbAdminApi_media.ts).
--
-- ROLE: OWNER applies this in the Supabase SQL Editor (dev has no DB password).
-- IDEMPOTENT: safe to re-run.
-- ============================================

BEGIN;

-- ============================================
-- 1. storage.objects policies for bmb-images
-- ============================================
-- Public read: anyone may READ (site assets served to all visitors).
DROP POLICY IF EXISTS bmb_images_public_read ON storage.objects;
CREATE POLICY bmb_images_public_read ON storage.objects
  FOR SELECT
  USING ((SELECT id FROM storage.buckets WHERE name = 'bmb-images') = bucket_id);

-- Authenticated upload: any signed-in user may INSERT (admin UI enforces role; keeps
-- customer images (reviews) possible later without extra grants).
DROP POLICY IF EXISTS bmb_images_authenticated_upload ON storage.objects;
CREATE POLICY bmb_images_authenticated_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT id FROM storage.buckets WHERE name = 'bmb-images') = bucket_id
    AND auth.role() = 'authenticated'
  );

-- Admin manage: UPDATE/DELETE only for profiles.role='admin'.
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

-- ============================================
-- 2. media_assets RLS re-assert (already set in 008; kept here for idempotent safety)
-- ============================================
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_assets_public_read ON media_assets;
CREATE POLICY media_assets_public_read ON media_assets
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS media_assets_admin ON media_assets;
CREATE POLICY media_assets_admin ON media_assets
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

COMMIT;

-- ============================================
-- END OF MIGRATION 011
-- ============================================