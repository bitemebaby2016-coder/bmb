# Fix Background Music RLS Upload Policy

## Problem

Admin users cannot upload background music files to Supabase storage bucket `background_music` — error: `new row violates row-level security policy`.

**Root cause:** Migration 196 INSERT policy (line 37-40) checks `auth.role() = 'authenticated'`:
```sql
CREATE POLICY background_music_authenticated_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'background_music' 
    AND auth.role() = 'authenticated'   -- ← FAILS for admin users
  );
```

When admin logs in, their JWT `role` claim = `'admin'` (not `'authenticated'`) → policy rejects INSERT.

UPDATE/DELETE policies work because they query `public.profiles.role` instead of JWT claim.

---

## Migration History Context

- Migration 196 applied to production (renamed from 103 conflict)
- `DROP POLICY IF EXISTS` makes it idempotent — safe to re-run with fixes
- Bucket `background_music` exists, public read works (files already in bucket play)

---

## Solution

**Fix the INSERT policy to accept both JWT roles: `authenticated` OR `admin`**

```sql
WITH CHECK (
  bucket_id = 'background_music' 
  AND (auth.role() = 'authenticated' OR auth.role() = 'admin')
)
```

Alternative (simpler): Remove `auth.role()` check entirely since `TO authenticated` already restricts to authenticated users:

```sql
WITH CHECK (bucket_id = 'background_music')
```

---

## Plan

### 1. Update Migration 196 (idempotent)
- Edit `supabase/migrations/196_background_music_bucket_policies.sql`
- Change INSERT policy `WITH CHECK` clause (lines 37-40)
- Keep all other policies unchanged

### 2. Apply to Production
- Owner runs updated migration 196 in Supabase SQL Editor (production)
- Migration is idempotent — `DROP POLICY IF EXISTS` handles re-apply cleanly

### 3. Verify Fix
- Login as admin → Admin Settings → Music tab
- Upload a test audio file → should succeed (no RLS error)
- Network tab: storage.upload request returns 200
- File appears in bucket list, preview plays

### 4. Regression Check
- Regular authenticated user (non-admin) upload → should still work
- Public read (audio playback on homepage) → unchanged
- Admin UPDATE/DELETE → unchanged

---

## Files to Modify

- `supabase/migrations/196_background_music_bucket_policies.sql` — lines 37-40 only

---

## Validation Steps

1. **Before fix:** Admin upload → RLS error
2. **After migration re-run:** Admin upload → success (200)
3. **Non-admin upload:** Still works (policy `TO authenticated` covers both)
4. **Audio playback:** Homepage ♪ button plays files from bucket → works

---

## Risk Assessment

- **Low risk:** Single policy change, idempotent migration, no schema changes
- **Rollback:** Re-run original migration 196 (git history) if needed
- **No downtime:** Storage policies apply immediately, no app restart needed

---

## Open Questions

None — fix is straightforward policy adjustment.