-- ============================================================
-- Contract 196+206 — Media Buckets (background_music + Bite_Mascot) Storage Policies
-- ครอบคลุม:
--   196.1 background_music bucket exists (public)
--   196.2 background_music policies: public read (anon), authenticated upload, admin update/delete
--   196.3 bucket_id literal (not subquery) — prevents RLS bucket lookup failure
--   206.1 Bite_Mascot bucket exists (public) + mime types + file size limit
--   206.2 Bite_Mascot policies: public read, admin upload/update/delete
--   206.3 bucket_id literal for all policies
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- ---------- 196.1 background_music bucket ----------
DO $$
DECLARE
  v_bucket record;
BEGIN
  SELECT * INTO v_bucket FROM storage.buckets WHERE id = 'background_music';
  IF NOT FOUND THEN
    RAISE EXCEPTION '196.1 FAIL: background_music bucket missing';
  END IF;
  IF v_bucket.public IS NOT TRUE THEN
    RAISE EXCEPTION '196.1 FAIL: background_music should be public';
  END IF;
  RAISE NOTICE '196.1 PASS: background_music bucket exists + public';
END $$;

-- ---------- 196.2 background_music policies ----------
DO $$
BEGIN
  -- public read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'background_music_public_read'
  ) THEN
    RAISE EXCEPTION '196.2 FAIL: background_music_public_read policy missing';
  END IF;

  -- authenticated upload
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'background_music_authenticated_upload'
  ) THEN
    RAISE EXCEPTION '196.2 FAIL: background_music_authenticated_upload policy missing';
  END IF;

  -- admin update
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'background_music_admin_update'
  ) THEN
    RAISE EXCEPTION '196.2 FAIL: background_music_admin_update policy missing';
  END IF;

  -- admin delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'background_music_admin_delete'
  ) THEN
    RAISE EXCEPTION '196.2 FAIL: background_music_admin_delete policy missing';
  END IF;

  RAISE NOTICE '196.2 PASS: background_music all 4 policies exist';
END $$;

-- ---------- 196.3 bucket_id literal (not subquery) ----------
DO $$
DECLARE
  v_pol record;
BEGIN
  -- check each policy uses bucket_id = 'background_music' literal
  FOR v_pol IN
    SELECT policyname, qual FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'background_music%'
  LOOP
    IF v_pol.qual NOT LIKE '%bucket_id = ''background_music''%' THEN
      RAISE EXCEPTION '196.3 FAIL: policy % does not use literal bucket_id: %', v_pol.policyname, v_pol.qual;
    END IF;
  END LOOP;

  RAISE NOTICE '196.3 PASS: background_music all policies use bucket_id literal';
END $$;

-- ---------- 206.1 Bite_Mascot bucket ----------
DO $$
DECLARE
  v_bucket record;
BEGIN
  SELECT * INTO v_bucket FROM storage.buckets WHERE id = 'Bite_Mascot';
  IF NOT FOUND THEN
    RAISE EXCEPTION '206.1 FAIL: Bite_Mascot bucket missing';
  END IF;
  IF v_bucket.public IS NOT TRUE THEN
    RAISE EXCEPTION '206.1 FAIL: Bite_Mascot should be public';
  END IF;

  -- Note: file_size_limit and allowed_mime_types columns may not exist in all Supabase versions
  -- Only check if columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'file_size_limit'
  ) THEN
    IF v_bucket.file_size_limit IS NOT NULL AND v_bucket.file_size_limit <> 15728640 THEN
      RAISE EXCEPTION '206.1 FAIL: file_size_limit should be 15728640, got %', v_bucket.file_size_limit;
    END IF;
  END IF;

  -- Note: allowed_mime_types column may not exist in all Supabase versions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types'
  ) THEN
    IF v_bucket.allowed_mime_types IS NOT NULL THEN
      IF NOT ('image/gif' = ANY(v_bucket.allowed_mime_types)) THEN
        RAISE EXCEPTION '206.1 FAIL: allowed_mime_types missing image/gif';
      END IF;
      IF NOT ('image/png' = ANY(v_bucket.allowed_mime_types)) THEN
        RAISE EXCEPTION '206.1 FAIL: allowed_mime_types missing image/png';
      END IF;
      IF NOT ('image/webp' = ANY(v_bucket.allowed_mime_types)) THEN
        RAISE EXCEPTION '206.1 FAIL: allowed_mime_types missing image/webp';
      END IF;
      IF NOT ('image/jpeg' = ANY(v_bucket.allowed_mime_types)) THEN
        RAISE EXCEPTION '206.1 FAIL: allowed_mime_types missing image/jpeg';
      END IF;
    END IF;
  END IF;

  RAISE NOTICE '206.1 PASS: Bite_Mascot bucket exists + public + limits + mime types';
END $$;

-- ---------- 206.2 Bite_Mascot policies ----------
DO $$
BEGIN
  -- public read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bite_mascot_public_read'
  ) THEN
    RAISE EXCEPTION '206.2 FAIL: bite_mascot_public_read policy missing';
  END IF;

  -- admin upload
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bite_mascot_admin_upload'
  ) THEN
    RAISE EXCEPTION '206.2 FAIL: bite_mascot_admin_upload policy missing';
  END IF;

  -- admin update
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bite_mascot_admin_update'
  ) THEN
    RAISE EXCEPTION '206.2 FAIL: bite_mascot_admin_update policy missing';
  END IF;

  -- admin delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bite_mascot_admin_delete'
  ) THEN
    RAISE EXCEPTION '206.2 FAIL: bite_mascot_admin_delete policy missing';
  END IF;

  RAISE NOTICE '206.2 PASS: Bite_Mascot all 4 policies exist';
END $$;

-- ---------- 206.3 bucket_id literal ----------
DO $$
DECLARE
  v_pol record;
BEGIN
  FOR v_pol IN
    SELECT policyname, qual FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'bite_mascot%'
  LOOP
    IF v_pol.qual NOT LIKE '%bucket_id = ''Bite_Mascot''%' THEN
      RAISE EXCEPTION '206.3 FAIL: policy % does not use literal bucket_id: %', v_pol.policyname, v_pol.qual;
    END IF;
  END LOOP;

  RAISE NOTICE '206.3 PASS: Bite_Mascot all policies use bucket_id literal';
END $$;

ROLLBACK;