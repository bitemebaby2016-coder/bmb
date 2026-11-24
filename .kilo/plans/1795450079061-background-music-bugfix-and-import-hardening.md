# แผนแก้บั๊ก Background Music + เสริมความน่าเชื่อถือการนำเข้า URL ภายนอก

## สถานะปัจจุบัน (จากโค้ดจริง)
- ✅ Bucket `background_music` มีไฟล์เพลงเตรียมไว้แล้วใน Dashboard
- ✅ `backgroundMusic.ts` — validation, compression (Opus 128kbps mono ≤2MB), upload, list, delete
- ✅ `ambientMusic.ts` — `createAudioFileEngine` + `AmbientMusicManager` singleton
- ✅ `AmbientMusicToggle.tsx` — ปุ่ม ♪/⏸ ซ้ายมือ, slider เสียง, ducking ผ่าน `onVoiceActivity`
- ✅ `BackgroundMusicSettingsPage.tsx` — Admin UI: list + preview + upload + **import external URL** (fetch → compress → upload)
- ✅ Migration 103 — storage policies (public read, admin write)

## บั๊กหลักที่ยังไม่ได้แก้

| # | ปัญหา | ตำแหน่ง | ผลกระทบ |
|---|-------|---------|---------|
| 1 | `toggle()` ตั้ง `playing = true` ทันที ไม่รอ engine เริ่มเล่นจริง | `ambientMusic.ts:83-101` | UI แสดง "กำลังเล่น" (⏸) แต่ไม่มีเสียง |
| 2 | Engine `start()` ไม่คืนผลสำเร็จ/ล้มเหลวให้ manager | `ambientMusic.ts:226-234` | Manager ไม่รู้ว่าเล่นจริงหรือไม่ |
| 3 | ไม่มีการเช็ค master flag `business_settings.ambient_music.enabled` | `ambientMusic.ts` | แอดมินปิดในหน้า settings แต่มูสิกก็ยังเล่นได้ |
| 4 | Bucket ว่าง / list error → engine `isPlaying = false` ภายใน แต่ manager ไม่รู้ | `ambientMusic.ts:208-214` | ค้างสถานะ playing ตลอด |
| 5 | นำเข้า URL: `fetch()` ล้มเหลวจาก CORS / 404 / ไม่ใช่ audio → error message ไม่ชัดเจน | `BackgroundMusicSettingsPage.tsx:109-128` | แอดมินนำเข้าไม่ได้ ไม่รู้สาเหตุ |
| 6 | ไม่มี progress/loading indicator ระหว่าง fetch+compress+upload URL ภายนอก | `BackgroundMusicSettingsPage.tsx` | UX แย่ คิดว่าค้าง |

---

## แผน 3 เฟส (เรียงลำดับความสำคัญ)

### 🔴 เฟส 1: แก้บั๊กหลัก — State Sync + Master Gate (Critical Path)

#### 1.1 ให้ `engine.start()` คืน `Promise<boolean>` ว่าเริ่มเล่นจริงหรือไม่
**ไฟล์:** `src/lib/ambientMusic.ts`

```typescript
// บรรทัด 18-25: แก้ interface
export interface AmbientEngine {
  start(volume: number): Promise<boolean>   // ← เปลี่ยนจาก void
  setVolume(volume: number, rampSeconds?: number): void
  stop(): void
}
```

```typescript
// บรรทัด 226-235: แก้ createAudioFileEngine.start
start(volume: number): Promise<boolean> {
  currentVolume = volume
  isPlaying = true
  return ensureQueue().then(() => {
    const url = pickNextUrl()
    if (url && isPlaying) {
      playUrl(url)
      return true
    }
    isPlaying = false
    return false
  })
}
```

#### 1.2 ให้ `AmbientMusicManager.toggle()` รอผลจาก engine ก่อนตั้ง `playing`
**ไฟล์:** `src/lib/ambientMusic.ts` บรรทัด 83-101

```typescript
async toggle(): Promise<boolean> {
  // 1) ตรวจ master flag ก่อน (เพิ่มใหม่)
  try {
    const { data } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'ambient_music')
      .maybeSingle()
    const enabled = typeof data?.value === 'object' && data.value.enabled === true
    if (!enabled) { this.emit(); return false }
  } catch { /* ไม่บล็อก */ }

  if (this.playing) { this.stopMusic(); return false }

  try {
    if (!this.engine) this.engine = this.engineFactory()
    const started = await this.engine.start(this.volume)  // ← await จริง
    if (!started) { this.emit(); return false }           // ← เริ่มไม่จริง → false
    this.playing = true
    this.emit()
    return true
  } catch {
    this.playing = false; this.ducked = false; this.emit()
    return false
  }
}
```

#### 1.3 Import `supabase` ใน `ambientMusic.ts`
เพิ่มบรรทัดบนสุด:
```typescript
import { supabase } from './supabase'
```

#### 1.4 UI: แสดงสถานะ "ไม่มีเพลงใน bucket" แทน "กำลังเล่น" เฉย
**ไฟล์:** `src/components/audio/AmbientMusicToggle.tsx`

```tsx
// เพิ่ม state
const [emptyBucket, setEmptyBucket] = useState(false)

// ใน useEffect ฟัง MUSIC_EVENT
useEffect(() => {
  const onMusic = () => {
    const s = manager.getState()
    setState(s)
    // ถ้า playing แต่ไม่มีไฟล์ (engine เริ่มไม่ได้) → emptyBucket = true
    if (s.playing && !s.volume) setEmptyBucket(true)
    else setEmptyBucket(false)
  }
  window.addEventListener(MUSIC_EVENT, onMusic)
  onMusic()
  return () => window.removeEventListener(MUSIC_EVENT, onMusic)
}, [manager])

// ใน JSX: ถ้า emptyBucket ให้แสดงข้อความเตือน แทน slider
{state.playing && !emptyBucket && ( ... slider ... )}
{emptyBucket && (
  <span className="text-[10px] text-red-500" data-testid="ambient-music-empty">
    ไม่มีเพลงใน bucket — โปรดอัปโหลดในแอดมิน
  </span>
)}
```

---

### 🟠 เฟส 2: เสริมความน่าเชื่อถือการนำเข้า URL ภายนอก

#### 2.1 จัดการ CORS / non-audio / 404 ให้ชัดเจน
**ไฟล์:** `src/pages/admin/BackgroundMusicSettingsPage.tsx` ฟังก์ชัน `onImportUrl`

```tsx
async function onImportUrl() {
  const url = externalUrl.trim()
  if (!url) { showToast('วาง URL ก่อน', 'error'); return }
  
  setImportingUrl(true)
  setStatus(p => ({ ...p, [url]: { kind: 'idle', text: '⏳ กำลังดาวน์โหลด…' } }))
  
  try {
    const res = await fetch(url, { mode: 'cors' })  // ← explicit cors
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('audio/')) {
      throw new Error(`MIME ไม่ใช่เสียง: ${contentType}`)
    }
    
    setStatus(p => ({ ...p, [url]: { kind: 'idle', text: '📦 กำลังบีบอัด…' } }))
    const blob = await res.blob()
    const file = new File([blob], url.split('/').pop() || 'music.webm', { type: contentType })
    
    await onFileUpload(file)
    setExternalUrl('')
    showToast('✅ นำเข้า URL สำเร็จ', 'success')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ข้อผิดพลาดไม่ทราบสาเหตุ'
    showToast(`❌ นำเข้าไม่สำเร็จ: ${msg}`, 'error')
    setStatus(p => ({ ...p, [url]: { kind: 'error', text: msg } }))
  } finally {
    setImportingUrl(false)
  }
}
```

#### 2.2 เพิ่ม progress indicator ระหว่าง fetch+compress
**ไฟล์:** `src/pages/admin/BackgroundMusicSettingsPage.tsx` JSX ส่วน URL Import

```tsx
<div className="flex gap-2">
  <input ... />
  <button ... onClick={() => void onImportUrl()}>
    {importingUrl ? (
      <span className="flex items-center gap-1">
        <span className="animate-spin">⏳</span> กำลังนำเข้า…
      </span>
    ) : '📥 นำเข้า'}
  </button>
</div>
{importingUrl && (
  <div className="text-[11px] text-brand-muted animate-pulse">
    กำลังดาวน์โหลด → บีบอัด (Opus 128kbps) → อัปโหลดเข้า bucket…
  </div>
)}
```

#### 2.3 รองรับ presigned URL / private bucket (ถ้าจำเป็น)
เพิ่ม option ใช้ `supabase.storage.from(MUSIC_BUCKET).createSignedUploadUrl()` สำหรับไฟล์ใหญ่ แต่ bucket ปัจจุบันเป็น public → optional

---

### 🟡 เฟส 3: ทดสอบ + Regression Guards

#### 3.1 Unit Tests ใหม่
**ไฟล์:** `src/__tests__/ambientMusic.bugfix.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAmbientMusic, resetAmbientMusicForTests } from '@/lib/ambientMusic'

describe('AmbientMusicManager — state sync', () => {
  beforeEach(() => { resetAmbientMusicForTests() })
  
  it('toggle() คืน false ถ้า bucket ว่าง (engine.start() = false)', async () => {
    const mgr = getAmbientMusic()
    // mock engineFactory ให้คืน engine ที่ start() resolve false
    const result = await mgr.toggle()
    expect(result).toBe(false)
    expect(mgr.getState().playing).toBe(false)
  })
  
  it('toggle() ตรวจ business_settings.enabled = false → false', async () => {
    // mock supabase.from(...).select(...) คืน enabled: false
    const mgr = getAmbientMusic()
    const result = await mgr.toggle()
    expect(result).toBe(false)
  })
})
```

#### 3.2 E2E Test (Playwright) — critical path
**ไฟล์:** `tests/e2e/background-music.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('Background music: toggle plays when files exist + enabled', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  
  const toggle = page.locator('[data-testid="ambient-music-toggle"]')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  
  await toggle.click()
  // รอ state sync
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  
  // ตรวจว่าไม่มี error state
  await expect(page.locator('[data-testid="ambient-music-empty"]')).not.toBeVisible()
})
```

#### 3.3 Lint + Typecheck Gates
```bash
npm run lint
npm run typecheck
npm test -- ambientMusic backgroundMusic
npm run build
```

---

## ข้อกำหนดฝั่งแอดมิน (No-code)

| รายการ | สถานะ | หมายเหตุ |
|--------|-------|----------|
| Migration 103 applied | ✅ (มีไฟล์) | รันใน Supabase SQL Editor หากยังไม่ได้ |
| Bucket `background_music` มีไฟล์ ≥ 1 | ✅ (Dashboard) | ตรวจใน Storage → Files |
| `business_settings` มีแถว `ambient_music` enabled=true | ❌ ต้องเพิ่ม | รัน SQL: `INSERT INTO business_settings (key, value) VALUES ('ambient_music', '{"enabled": true}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;` |
| Bucket CORS อนุญาต `biteme-baby.com` | ❓ ตรวจสอบ | Storage → Settings → CORS |

---

## Rollout Checklist

1. **Merge** → CI pass (lint + test + build)
2. **Deploy** staging
3. **Owner**: เข้า `/admin/settings?tab=music` → ตรวจว่า Enable checkbox = ON
4. **Live test**: กด ♪ ซ้ายมือ → ได้ยินเสียง → Bite พูด → เสียงลด → จบ → คืนเสียง → เพลงถัดไปสุ่ม
5. **Edge case**: ปิด Enable ในแอดมิน → กด ♪ → ต้องไม่เล่น (คืน false)

---

## ไฟล์ที่ต้องแก้ (สรุป)

| Phase | Files |
|-------|-------|
| 1 | `src/lib/ambientMusic.ts` (interface + manager.toggle + import supabase) |
| 1 | `src/components/audio/AmbientMusicToggle.tsx` (empty bucket UI) |
| 2 | `src/pages/admin/BackgroundMusicSettingsPage.tsx` (onImportUrl hardening + progress UI) |
| 3 | `src/__tests__/ambientMusic.bugfix.test.ts` (new) |
| 3 | `tests/e2e/background-music.spec.ts` (new) |

---

## ขอบเขตนอกเหนือจากแผนนี้ (Out of Scope)
- เพลง synthesize/WebAudio เดิม (ลบไปแล้วในแผนเก่า)
- Multi-bucket / per-branch playlist
- Background music scheduling (เวลาเปิด/ปิดอัตโนมัติ)
- Analytics การเล่นเพลง

---

## คำถามก่อนเริ่ม implement (ถ้ามี)

1. **Master gate**: ต้องการให้ `toggle()` อ่าน `business_settings` ทุกครั้งที่กด (real-time) หรือ cache ไว้ใน manager?
   - แนะนำ: **อ่านทุกครั้ง** (network call เบา, real-time, ไม่ต้อง invalidate cache)

2. **Empty bucket UI**: ต้องการให้ปุ่ม ♪ แสดง tooltip "ไม่มีเพลง" ตลอด หรือเฉพาะตอนพยายามเล่น?
   - แนะนำ: **เฉพาะตอนพยายามเล่น** (state `emptyBucket = true` หลัง `toggle()` คืน false)

3. **External URL import**: รองรับ YouTube / SoundCloud / streaming URL หรือแค่ direct audio file?
   - ปัจจุบัน: **direct audio file only** (fetch → blob). Streaming ต้องใช้ yt-dlp/ffmpeg ฝั่ง Edge Function → out of scope

ตอบคำถามเหล่านี้เสร็จ ผมจะ finalize plan แล้ว `plan_exit`