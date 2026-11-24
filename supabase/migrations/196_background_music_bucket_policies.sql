-- ============================================
-- Bite Me Baby — Migration 196: Storage policies for `background_music` bucket
-- Date: 2026-11-24
-- Context:
--   - storage bucket `background_music` (public bucket)
--   - Admin Background Music Settings (BackgroundMusicSettingsPage.tsx) needs:
--     * Public read (anon SELECT) for runtime audio playback
--     * Admin write (authenticated INSERT/UPDATE/DELETE) for upload/manage
--   - Runtime plays audio files directly via public URLs from this bucket
-- ROLE: OWNER applies this in the Supabase SQL Editor
-- IDEMPOTENT: safe to re-run. Creates bucket if missing (CI/production).
-- ROOT CAUSE FIX (2026-11-24, same bug as m119):
--   เดิมใช้ subquery `(SELECT id FROM storage.buckets WHERE name='background_music') = bucket_id`
--   RLS ของ storage.buckets ซ่อนแถว bucket จาก anon/authenticated → subquery = NULL
--   → NULL = bucket_id = NULL → policy fail ทุกข้อ → list ว่าง + upload 42501
--   แก้เป็น bucket_id literal (canonical Supabase pattern จาก m119) ทั้ง 4 policies
-- ============================================

BEGIN;

-- ============================================
-- 0. Ensure bucket exists (idempotent)
-- ============================================
INSERT INTO storage.buckets (id, name, public, created_at)
VALUES ('background_music', 'background_music', true, now())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 1. storage.objects policies for background_music
-- ============================================

-- Public read: anyone may READ (runtime audio playback for all visitors)
DROP POLICY IF EXISTS background_music_public_read ON storage.objects;
CREATE POLICY background_music_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'background_music');

-- Authenticated upload: any signed-in user may INSERT (admin UI enforces role)
DROP POLICY IF EXISTS background_music_authenticated_upload ON storage.objects;
CREATE POLICY background_music_authenticated_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'background_music'
  );

-- Admin update: UPDATE only for profiles.role='admin'
DROP POLICY IF EXISTS background_music_admin_update ON storage.objects;
CREATE POLICY background_music_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'background_music'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admin delete: DELETE only for profiles.role='admin'
DROP POLICY IF EXISTS background_music_admin_delete ON storage.objects;
CREATE POLICY background_music_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'background_music'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

COMMIT;

-- ============================================
-- END OF MIGRATION 196
-- ============================================