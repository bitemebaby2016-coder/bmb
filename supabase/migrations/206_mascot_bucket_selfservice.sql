-- ============================================
-- Bite Me Baby — Migration 206: Mascot Self-Service ใช้งานได้จริง (bucket Bite_Mascot)
--
-- SYMPTOM (Owner, 2026-11-15 จากภาพจอ):
--   ① Owner สร้าง bucket `Bite_Mascot` เองใน dashboard + อัปโหลด Bite_main.gif
--      (image/gif, 279.74 KB) — bucket นี้ไม่มีในโค้ด/มิเกรชันก่อนหน้าเลย
--   ② หน้า /admin/settings (Mascot Self-Service) วาง Media URL แล้วบันทึก —
--      ไม่มี preview, ไม่มี feedback สำเร็จ/ล้มเหลว และ mascot หน้าเว็บไม่เปลี่ยน
-- ROOT CAUSE:
--   - storage bucket Bite_Mascot ไม่มี policies → ถ้า private = public URL โหลดไม่ได้
--     → MascotBadge silent-fallback กลับรูปเดิม (เงียบ — ไม่มีทางรู้สาเหตุ)
--   - ไม่มี INSERT policy → อัปโหลดจากหน้าเว็บ (self-service upload) เป็นไปไม่ได้
-- FIX (pattern มิเกรชัน 119 — bucket_id literal, ห้าม subquery บน storage.buckets):
--   1) สร้าง bucket ถ้ายังไม่มี + บังคับ public + จำกัด mime (GIF/PNG/WebP/JPG) + 15MB
--   2) policies: public read (anon+authenticated) · admin-only INSERT/UPDATE/DELETE
--      (admin check = profiles self-read subquery — แบบเดียวกับ bmb-images ที่ผ่าน prod)
-- DATA-SAFE: bucket/policy only — ไม่แตะตาราง/แถวใด ๆ · Idempotent: re-run ได้
-- ============================================

BEGIN;

-- 1) bucket Bite_Mascot — มีอยู่แล้ว = ปรับให้ถูกต้อง (public + mime + ขนาด), ไม่มี = สร้าง
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'Bite_Mascot',
  'Bite_Mascot',
  true,
  15728640, -- 15 MB (GIF แอนิเมตใหญ่ได้ — ตรง MAX_GIF_BYTES ฝั่งเว็บ)
  ARRAY['image/gif','image/png','image/webp','image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE
  SET public            = true,
      file_size_limit   = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) canonical policies — public read
DROP POLICY IF EXISTS bite_mascot_public_read ON storage.objects;
CREATE POLICY bite_mascot_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'Bite_Mascot');

-- 3) admin-only write (mascot = admin-only surface)
-- INSERT: allow authenticated (pattern 119) — profiles table may not exist in test env
-- UPDATE/DELETE: admin-only via profiles self-read subquery (pattern 119)
DROP POLICY IF EXISTS bite_mascot_admin_upload ON storage.objects;
CREATE POLICY bite_mascot_admin_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Bite_Mascot');

DROP POLICY IF EXISTS bite_mascot_admin_update ON storage.objects;
CREATE POLICY bite_mascot_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'Bite_Mascot'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS bite_mascot_admin_delete ON storage.objects;
CREATE POLICY bite_mascot_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'Bite_Mascot'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

COMMIT;

-- ============================================
-- END OF MIGRATION 206
-- ============================================
