# แผนงาน: แก้ Mascot Badge (F-1) + แทนที่ Background Music ระบบใหม่

## สรุป
1. **แก้ Mascot Badge** (`.section-float-mascot`) — ตัดขอบ/หลุดกรอบตอน animate
2. **Background Music** — ลบ WebAudio synthetic engine ทั้งหมด, ใช้ไฟล์จาก bucket `background_music` เล่นสุ่ม (shuffle queue) พร้อม Admin UI

---

## 1. Mascot Badge Fix (F-1)

### ปัญหา
`.section-float-mascot` ใน `index.css:1173-1182` มี `border-radius: 50%` + `animation: floatLogo` (rotate ±6deg + scale 1.05) → ภาพ 34×34 ถูก crop วงกลม แล้วหมุน/ขยายในวงกลม → หัว/ขา/แขนหาย

### แก้ไข
**A. `src/index.css:1173-1182` (`.section-float-mascot`):**
- ลบ `border-radius: 50%;`
- เปลี่ยน `animation: floatLogo 4.5s ease-in-out infinite;` → `animation: float 3s ease-in-out infinite;`

**B. หัวข้อทุกจุดที่มี badge (7 จุด) — กันข้อความยาวบีบ badge หลุดขอบจอ:**
ใส่ `min-w-0` บน `<h2 className="flex ...">` และ `truncate` บน `<span>` ข้อความหัวข้อ:
- `HomePage.tsx:521` (Popular), `:533` (SameDay), `:551` (Preorder)
- `ReviewPage.tsx:191`, `:226`
- `MenuPage.tsx:342`
- `CategorySections.tsx:178`
- `PromotionStrip.tsx:20`
- `VerifiedReviewsSection.tsx:80`
- `ReviewCarouselSection.tsx:137` → **OK แล้ว** (มี truncate+min-w-0 อยู่แล้ว)

---

## 2. Background Music — แทนที่ระบบเก่าทั้งหมด

### Bucket
- `background_music` (ชื่อจริงใน Dashboard) — Public read (anon SELECT), Admin write (RLS)

### ไฟล์ใหม่/แก้ไข

| ไฟล์ | Action |
|---|---|
| `src/lib/backgroundMusic.ts` | **Create ใหม่** — lib หลัก |
| `src/lib/ambientMusic.ts` | **Rewrite** — ลบ synthetic, ใช้ `createAudioFileEngine` |
| `src/components/audio/AmbientMusicToggle.tsx` | Edit: ใช้ engine interface เดิม |
| `src/components/admin/AdminHubs.tsx` | Edit: เพิ่มแท็บ `music` ใน SettingsHub |
| `src/pages/admin/BackgroundMusicSettingsPage.tsx` | **Create ใหม่** (Admin UI) |
| `supabase/migrations/2xx_background_music_bucket.sql` | **Create ใหม่** (storage policies) |
| `src/__tests__/backgroundMusic.test.ts` | **Create ใหม่** |
| `src/__tests__/ambientMusic.test.ts` | **Rewrite ใหม่ทั้งไฟล์** |
| `src/__tests__/rXXBackgroundMusicAdmin.test.ts` | **Create ใหม่** |

### lib/backgroundMusic.ts (สร้างใหม่)
```typescript
// listBackgroundMusicFiles() — supabase.storage.from('background_music').list('')
// validateMusicFile(file) — accept audio/*, max 20MB raw
// compressAudioForMusic(file) — MediaRecorder opus 128kbps mono ≤2MB, fallback original
// uploadBackgroundMusicAsset(file) — validate → compress → upload → public URL
// deleteBackgroundMusicAsset(path) — storage.remove + cleanup
```

### lib/ambientMusic.ts (เขียนใหม่)
- ลบ `createWebAudioAmbient()`, `CHORDS_HZ`, `CHORD_MS`, `FADE_SEC`
- เพิ่ม `createAudioFileEngine(getUrls)` implements `AmbientEngine`:
  - `start(volume)`: fetch list → shuffle queue → `new Audio(url)` → loop → play()
  - `setVolume(v)`: `audio.volume = v`
  - `stop()`: `audio.pause()`, `audio.src = ''`
  - `ended` handler → next random (shuffle queue, ใช้หมดก่อนวน)
- `getAmbientMusic()` factory ใช้ `createAudioFileEngine(() => listBackgroundMusicFiles().then(f => f.map(x => x.url)))`
- Bucket ว่าง / error → `toggle()` คืน `false` (ไม่เล่น, ไม่ fallback synthetic)

### Admin UI: BackgroundMusicSettingsPage.tsx
Pattern `MascotSettingsPage`:
- Bucket file list + `<audio controls>` preview
- File upload (accept="audio/*") + drag-drop + auto-compress
- Paste external URL → fetch → compress → upload
- Enable toggle (`business_settings.ambient_music.enabled`)
- Mode info (playlist only, no synthetic)

### Migration
`supabase/migrations/2xx_background_music_bucket.sql`:
```sql
-- Bucket `background_music` (Owner สร้างใน Dashboard เอง)
-- Policy: Public read (anon SELECT), Admin write (authenticated + is_admin)
```

---

## การทดสอบ (Gates)
1. `npm run lint` — 0 error
2. `npm run test` — ทุก test ผ่าน (รวม test ใหม่)
3. `npm run build` — build สำเร็จ

---

## Rollout
1. Owner สร้าง bucket `background_music` ใน Dashboard (Public bucket)
2. Merge → CI pass
3. Deploy → Owner เข้า `/admin/settings?tab=music` → อัปโหลดเพลง 3-5 เพลง → เปิด Enable
4. Live test: กด ♪ → เล่นสุ่ม → Bite พูด → ลดเสียง → จบ → คืนเสียง → เพลงถัดไปสุ่มต่อ