-- ============================================
-- Bite Me Baby — Migration 103: Storage policies for `background_music` bucket
-- Date: 2026-11-20
-- Context:
--   - storage bucket `background_music` created by Owner in Dashboard (public bucket)
--   - Admin Background Music Settings (BackgroundMusicSettingsPage.tsx) needs:
--     * Public read (anon SELECT) for runtime audio playback
--     * Admin write (authenticated INSERT/UPDATE/DELETE) for upload/manage
--   - Runtime plays audio files directly via public URLs from this bucket
-- ROLE: OWNER applies this in the Supabase SQL Editor
-- IDEMPOTENT: safe to re-run.
-- ============================================

BEGIN;

-- ============================================
-- 1. storage.objects policies for background_music
-- ============================================

-- Public read: anyone may READ (runtime audio playback for all visitors)
DROP POLICY IF EXISTS background_music_public_read ON storage.objects;
CREATE POLICY background_music_public_read ON storage.objects
  FOR SELECT
  USING ((SELECT id FROM storage.buckets WHERE name = 'background_music') = bucket_id);

-- Authenticated upload: any signed-in user may INSERT (admin UI enforces role)
DROP POLICY IF EXISTS background_music_authenticated_upload ON storage.objects;
CREATE POLICY background_music_authenticated_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT id FROM storage.buckets WHERE name = 'background_music') = bucket_id
    AND auth.role() = 'authenticated'
  );

-- Admin update: UPDATE only for profiles.role='admin'
DROP POLICY IF EXISTS background_music_admin_update ON storage.objects;
CREATE POLICY background_music_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    (SELECT id FROM storage.buckets WHERE name = 'background_music') = bucket_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admin delete: DELETE only for profiles.role='admin'
DROP POLICY IF EXISTS background_music_admin_delete ON storage.objects;
CREATE POLICY background_music_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    (SELECT id FROM storage.buckets WHERE name = 'background_music') = bucket_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================
-- 2. Bucket existence check (idempotent verification)
-- ============================================
DO $$
DECLARE v_bucket_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'background_music'
  ) INTO v_bucket_exists;
  RAISE NOTICE 'background_music bucket exists: %', v_bucket_exists;
  IF NOT v_bucket_exists THEN
    RAISE EXCEPTION 'ERR_BUCKET_NOT_FOUND: background_music bucket must be created in Dashboard first (Storage -> New bucket -> Public bucket)';
  END IF;
END $$;

COMMIT;

-- ============================================
-- END OF MIGRATION 103
-- ============================================