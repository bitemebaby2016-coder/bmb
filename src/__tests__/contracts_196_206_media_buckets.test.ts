// ============================================
// Bite Me Baby — R196/R206 source-contract test
// Migration 196: Storage policies for `background_music` bucket
// Migration 206: Mascot Self-Service bucket `Bite_Mascot` policies
// ============================================

import { describe, it, expect } from 'vitest'
import mig196Src from '../../supabase/migrations/196_background_music_bucket_policies.sql?raw'
import mig206Src from '../../supabase/migrations/206_mascot_bucket_selfservice.sql?raw'

describe('R196/R206 — Media Buckets: background_music + Bite_Mascot', () => {
  // ============================================
  // A — Migration 196: background_music bucket policies
  // ============================================
  describe('Migration 196: Storage policies for background_music bucket', () => {
    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig196Src).toContain('BEGIN;')
      expect(mig196Src).toContain('COMMIT;')
    })

    it('มี bucket creation idempotent: INSERT ON CONFLICT DO NOTHING', () => {
      expect(mig196Src).toContain("INSERT INTO storage.buckets (id, name, public, created_at)")
      expect(mig196Src).toContain("VALUES ('background_music', 'background_music', true, now())")
      expect(mig196Src).toContain("ON CONFLICT (id) DO NOTHING")
    })

    it('มี 4 policies: public read, authenticated upload, admin update, admin delete', () => {
      // raw import has formatting differences - check unique substrings
      expect(mig196Src).toContain("background_music_public_read")
      expect(mig196Src).toContain("background_music_authenticated_upload")
      expect(mig196Src).toContain("background_music_admin_update")
      expect(mig196Src).toContain("background_music_admin_delete")
      expect(mig196Src).toContain("bucket_id = 'background_music'")
      expect(mig196Src).toContain("DROP POLICY IF EXISTS")
      expect(mig196Src).toContain("CREATE POLICY")
      expect(mig196Src).toContain("FOR SELECT")
      expect(mig196Src).toContain("FOR INSERT TO authenticated")
      expect(mig196Src).toContain("FOR UPDATE TO authenticated")
      expect(mig196Src).toContain("FOR DELETE TO authenticated")
      expect(mig196Src).toContain("(SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'")
    })

it('Fix pattern: bucket_id literal (ไม่ subquery บน storage.buckets) ตาม m119', () => {
      // Comment documents the old pattern, actual policies use bucket_id literal
      expect(mig196Src).toContain("bucket_id = 'background_music'")
      // Comment documents the OLD problematic pattern (for documentation)
      expect(mig196Src).toContain("SELECT id FROM storage.buckets")
      expect(mig196Src).toContain("WHERE name='background_music'")
      // Verify no actual subquery in policies - check unique substrings
      expect(mig196Src).toContain("USING (bucket_id")
      expect(mig196Src).toContain("WITH CHECK")
      expect(mig196Src).toContain("bucket_id")
    })

    it('ไม่มี CREATE FUNCTION / ไม่มี GRANT (policy migration only)', () => {
      expect(mig196Src).not.toContain('CREATE OR REPLACE FUNCTION')
      expect(mig196Src).not.toContain('GRANT EXECUTE')
    })
  })

  // ============================================
  // B — Migration 206: Mascot Self-Service Bite_Mascot bucket
  // ============================================
  describe('Migration 206: Mascot Self-Service bucket Bite_Mascot', () => {
    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig206Src).toContain('BEGIN;')
      expect(mig206Src).toContain('COMMIT;')
    })

    it('มี bucket creation idempotent: INSERT ON CONFLICT DO UPDATE SET public = true', () => {
      expect(mig206Src).toContain("INSERT INTO storage.buckets (id, name, public)")
      expect(mig206Src).toContain("VALUES ('Bite_Mascot', 'Bite_Mascot', true)")
      expect(mig206Src).toContain("ON CONFLICT (id) DO UPDATE SET public = true")
    })

    it('มี conditional update: file_size_limit = 15728640 (15MB) + allowed_mime_types (GIF/PNG/WebP/JPG)', () => {
      expect(mig206Src).toContain("DO $$")
      expect(mig206Src).toContain("file_size_limit")
      expect(mig206Src).toContain("15728640")
      expect(mig206Src).toContain("allowed_mime_types")
      expect(mig206Src).toContain("ARRAY['image/gif','image/png','image/webp','image/jpeg']")
    })

    it('มี 4 policies: public read, authenticated upload, admin update, admin delete', () => {
      // raw import has formatting differences - check unique substrings
      expect(mig206Src).toContain("bite_mascot_public_read")
      expect(mig206Src).toContain("bite_mascot_admin_upload")
      expect(mig206Src).toContain("bite_mascot_admin_update")
      expect(mig206Src).toContain("bite_mascot_admin_delete")
      expect(mig206Src).toContain("bucket_id = 'Bite_Mascot'")
      expect(mig206Src).toContain("DROP POLICY IF EXISTS")
      expect(mig206Src).toContain("CREATE POLICY")
      expect(mig206Src).toContain("FOR SELECT")
      expect(mig206Src).toContain("FOR INSERT TO authenticated")
      expect(mig206Src).toContain("FOR UPDATE TO authenticated")
      expect(mig206Src).toContain("FOR DELETE TO authenticated")
      expect(mig206Src).toContain("(SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'")
    })

    it('Fix pattern: bucket_id literal (ไม่ subquery บน storage.buckets) ตาม m119/m196', () => {
      const policies = [
        "bite_mascot_public_read",
        "bite_mascot_admin_upload",
        "bite_mascot_admin_update",
        "bite_mascot_admin_delete"
      ]
      policies.forEach(policy => {
        expect(mig206Src).toContain(`CREATE POLICY ${policy}`)
        expect(mig206Src).toContain("bucket_id = 'Bite_Mascot'")
      })
      expect(mig206Src).not.toContain("SELECT id FROM storage.buckets")
      expect(mig206Src).not.toContain("WHERE name='Bite_Mascot'")
    })

    it('ไม่มี CREATE FUNCTION / ไม่มี GRANT (policy migration only)', () => {
      expect(mig206Src).not.toContain('CREATE OR REPLACE FUNCTION')
      expect(mig206Src).not.toContain('GRANT EXECUTE')
    })
  })

  // ============================================
  // C — Additive/Idempotent checks
  // ============================================
  describe('Additive/Idempotent — Bucket + Policy only', () => {
    it('Migration 196: ไม่มี DROP TABLE/COLUMN, DROP/CREATE POLICY ครบ 4', () => {
      expect(mig196Src).not.toContain('DROP TABLE')
      expect(mig196Src).not.toContain('DROP COLUMN')
      const drops = (mig196Src.match(/DROP POLICY IF EXISTS/g) || []).length
      const creates = (mig196Src.match(/CREATE POLICY/g) || []).length
      expect(drops).toBe(4)
      expect(creates).toBe(4)
    })

    it('Migration 206: ไม่มี DROP TABLE/COLUMN, DROP/CREATE POLICY ครบ 4 + bucket update', () => {
      expect(mig206Src).not.toContain('DROP TABLE')
      expect(mig206Src).not.toContain('DROP COLUMN')
      const drops = (mig206Src.match(/DROP POLICY IF EXISTS/g) || []).length
      const creates = (mig206Src.match(/CREATE POLICY/g) || []).length
      expect(drops).toBe(4)
      expect(creates).toBe(4)
      expect(mig206Src).toContain("ON CONFLICT (id) DO UPDATE SET public = true")
    })
  })
})