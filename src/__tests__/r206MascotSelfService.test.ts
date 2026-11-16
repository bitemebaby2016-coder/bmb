// ============================================
// Bite Me Baby — R206 Mascot Self-Service ใช้งานได้จริง (2026-11-15)
// บั๊กจริงจากภาพจอ Owner:
//   ① bucket `Bite_Mascot` (Owner สร้างเอง + อัปโหลด Bite_main.gif) ไม่มี policies ในโค้ด
//   ② MascotSettingsPage บันทึกแล้วไม่มี preview/feedback — save ล้มเหลวก็เงียบ
//   ③ mascot โหลด URL ไม่ได้ = silent-fallback กลับรูปเดิม (ไม่มีทางรู้สาเหตุ)
//   ④ badge ที่ mount อยู่ไม่รู้ว่า override เปลี่ยน (ต้องรีเฟรชหน้าเอง)
// กติกา lock:
//   1) migration 206 ต้องสร้าง bucket + 4 policies (public read · admin-only write)
//   2) service: MASCOT_BUCKET/validate/upload/list + event live refresh
//   3) UI: preview + error state + save feedback + อัปโหลด + ล้างค่า
//   4) badge ทั้งสอง (MascotBadge/BiteMascot) ต้องฟัง event
// ============================================
import { describe, it, expect } from 'vitest'
import serviceSrc from '../lib/mascotService.ts?raw'
import badgeSrc from '../components/MascotBadge.tsx?raw'
import biteMascotSrc from '../components/ai/BiteMascot.tsx?raw'
import pageSrc from '../pages/admin/MascotSettingsPage.tsx?raw'
import appSrc from '../App.tsx?raw'
import migrationSrc from '../../supabase/migrations/206_mascot_bucket_selfservice.sql?raw'

describe('R206 · mascotService — bucket จริง + upload + live refresh event', () => {
  it('MASCOT_BUCKET = `Bite_Mascot` (bucket ที่ Owner ใช้จริง)', () => {
    expect(serviceSrc).toContain("export const MASCOT_BUCKET = 'Bite_Mascot'")
  })

  it('validateMascotFile: รองรับ GIF/PNG/WebP/JPG + จำกัด 15MB (GIF แอนิเมตใหญ่ได้)', () => {
    expect(serviceSrc).toContain("export function validateMascotFile(file: File)")
    expect(serviceSrc).toContain("'image/gif'")
    expect(serviceSrc).toContain('MASCOT_MAX_BYTES = 15 * 1024 * 1024')
  })

  it('uploadMascotAsset: อัปโหลดเข้า MASCOT_BUCKET ตรง + ZERO-FAKE (error → null + log)', () => {
    expect(serviceSrc).toMatch(/export async function uploadMascotAsset[\s\S]{0,600}?from\(MASCOT_BUCKET\)\.upload/)
    expect(serviceSrc).toMatch(/uploadMascotAsset[\s\S]{0,900}?getPublicUrl/)
    expect(serviceSrc).toContain("console.error('[mascot] upload error:'")
  })

  it('listMascotBucketFiles: อ่านไฟล์ใน bucket สำหรับ quick-pick (timeout-safe)', () => {
    expect(serviceSrc).toContain('export async function listMascotBucketFiles')
    expect(serviceSrc).toMatch(/listMascotBucketFiles[\s\S]{0,700}?from\(MASCOT_BUCKET\)\.list/)
  })

  it('notifyMascotOverridesChanged: dispatch event จริง (jsdom)', async () => {
    const mod = await import('../lib/mascotService')
    let fired = 0
    const handler = () => { fired += 1 }
    window.addEventListener(mod.MASCOT_OVERRIDES_CHANGED_EVENT, handler)
    mod.notifyMascotOverridesChanged()
    window.removeEventListener(mod.MASCOT_OVERRIDES_CHANGED_EVENT, handler)
    expect(fired).toBe(1)
    expect(mod.MASCOT_OVERRIDES_CHANGED_EVENT).toBe('bmb:mascot-overrides-changed')
  })

  it('export เดิมครบ (R67 contract ไม่แตก): loadMascotOverrides(force) + invalidate + getOverrideUrl', () => {
    expect(serviceSrc).toContain('export async function loadMascotOverrides(force = false)')
    expect(serviceSrc).toContain('export function invalidateMascotOverrides')
    expect(serviceSrc).toContain('export function getOverrideUrl')
  })
})

describe('R206 · validateMascotFile — พฤติกรรมจริง (unit)', () => {
  it('GIF ปกติผ่าน', async () => {
    const mod = await import('../lib/mascotService')
    const file = new File([new Uint8Array(1024)], 'bite_main.gif', { type: 'image/gif' })
    expect(mod.validateMascotFile(file).ok).toBe(true)
  })

  it('ไฟล์เกิน 15MB ถูกปฏิเสธพร้อมสาเหตุ', async () => {
    const mod = await import('../lib/mascotService')
    const big = new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'big.gif', { type: 'image/gif' })
    const v = mod.validateMascotFile(big)
    expect(v.ok).toBe(false)
    expect(v.error).toContain('ERR_INVALID_SIZE')
  })

  it('ไฟล์ไม่ใช่รูป (เช่น mp4) ถูกปฏิเสธพร้อมสาเหตุ', async () => {
    const mod = await import('../lib/mascotService')
    const file = new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' })
    const v = mod.validateMascotFile(file)
    expect(v.ok).toBe(false)
    expect(v.error).toContain('ERR_INVALID_MIME')
  })
})

describe('R206 · MascotBadge + BiteMascot — ฟัง event เปลี่ยนรูปทันทีใน session เดิม', () => {
  it('MascotBadge: addEventListener + removeEventListener ตาม event ของ service', () => {
    expect(badgeSrc).toContain('MASCOT_OVERRIDES_CHANGED_EVENT')
    expect(badgeSrc).toMatch(/window\.addEventListener\(MASCOT_OVERRIDES_CHANGED_EVENT, onChanged\)/)
    expect(badgeSrc).toMatch(/window\.removeEventListener\(MASCOT_OVERRIDES_CHANGED_EVENT, onChanged\)/)
    // reload แบบ force หลัง event + คืนค่าเริ่มต้นเมื่อ override ถูกล้าง
    expect(badgeSrc).toMatch(/onChanged = \(\) => \{[\s\S]{0,300}?loadMascotOverrides\(true\)/)
    expect(badgeSrc).toMatch(/setSrc\(o \?\? POSE_ASSETS\[effectivePose\]\.src\)/)
  })

  it('BiteMascot: ฟัง event เดียวกัน (mascot ลอยหน้าร้านเปลี่ยนด้วย)', () => {
    expect(biteMascotSrc).toContain('MASCOT_OVERRIDES_CHANGED_EVENT')
    expect(biteMascotSrc).toMatch(/window\.addEventListener\(MASCOT_OVERRIDES_CHANGED_EVENT, onChanged\)/)
    expect(biteMascotSrc).toMatch(/loadMascotOverrides\(true\)/)
  })
})

describe('R206 · MascotSettingsPage — preview + feedback + upload + clear (ไม่เงียบอีก)', () => {
  it('preview ต่อ role: มี img พร้อม onLoad/onError → โหลดไม่ได้ = แสดงสาเหตุ (ไม่ silent)', () => {
    expect(pageSrc).toContain('data-testid={`mascot-preview-${role}`}')
    expect(pageSrc).toContain('data-testid={`mascot-preview-img-${role}`}')
    expect(pageSrc).toMatch(/onError=\{\(\) => setPreview/)
    expect(pageSrc).toContain('data-testid={`mascot-preview-error-${role}`}')
    expect(pageSrc).toContain('ตรวจว่า bucket เป็น public และ URL ชี้ไฟล์จริง')
  })

  it('save feedback จริง: ใช้ผล boolean ของ upsertMascotOverride — สำเร็จ/ล้มเหลวแจ้งชัด', () => {
    expect(pageSrc).toMatch(/const ok = await upsertMascotOverride/)
    expect(pageSrc).toContain("kind: 'ok', text: '✅ บันทึกแล้ว")
    expect(pageSrc).toContain("kind: 'error', text: '❌ บันทึกไม่สำเร็จ")
    expect(pageSrc).toContain('data-testid={`mascot-msg-${role}`}')
  })

  it('อัปโหลดเข้า bucket ตรง: file input (image/gif รวมอยู่) → uploadMascotAsset → เติม URL อัตโนมัติ', () => {
    expect(pageSrc).toContain('data-testid={`mascot-file-${role}`}')
    expect(pageSrc).toContain('accept="image/gif,image/png,image/webp,image/jpeg"')
    expect(pageSrc).toMatch(/await uploadMascotAsset\(file\)/)
    expect(pageSrc).toMatch(/uploadMascotAsset\(file\)[\s\S]{0,300}?อัปโหลดไม่สำเร็จ/)
  })

  it('ล้างค่ากลับค่าเริ่มต้น (ปุ่ม ↩) — แสดงเมื่อ role นั้นมี override อยู่', () => {
    expect(pageSrc).toContain('data-testid={`mascot-clear-${role}`}')
    expect(pageSrc).toMatch(/overrides\.some\(\(o\) => o\.role_name === role && o\.media_url\?\.length > 0\)/)
  })

  it('บันทึกแล้ว: invalidateMascotOverrides() (R52 lock) + notifyMascotOverridesChanged() (R206 live)', () => {
    expect(pageSrc).toContain('invalidateMascotOverrides()')
    expect(pageSrc).toContain('notifyMascotOverridesChanged()')
  })

  it('R52 testids เดิมครบ — ไม่ถอยกลับ', () => {
    expect(pageSrc).toContain('data-testid="mascot-refresh"')
    expect(pageSrc).toContain('data-testid={`mascot-url-${role}`}')
    expect(pageSrc).toContain('data-testid={`mascot-alt-${role}`}')
    expect(pageSrc).toContain('data-testid={`mascot-save-${role}`}')
  })

  it('quick-pick ไฟล์ใน bucket + ข้อความบอก bucket จริง (เลิกชี้ bmb-images)', () => {
    expect(pageSrc).toContain('listMascotBucketFiles()')
    expect(pageSrc).toContain('data-testid="mascot-bucket-files"')
    expect(pageSrc).toContain('{MASCOT_BUCKET}')
    expect(pageSrc).not.toContain('bmb-images')
  })
})

describe('R207 · จอโหลด (LoadingSpinner ใน App.tsx) — ถอด mascot ภาพนิ่งออก (Owner 2026-11-16)', () => {
  it('จอโหลดไม่มี MascotBadge/animate-bounce อีก — ภาพนิ่งเด้งแล้วสลับเป็นรูปแอดมิน = ผิดตา', () => {
    // สัญญา = ไม่มี import/การใช้จริงใน App.tsx (การอ้างชื่อในคอมเมนต์ไม่นับ)
    expect(appSrc).not.toMatch(/import \{ MascotBadge/)
    expect(appSrc).not.toMatch(/<MascotBadge/)
    expect(appSrc).not.toContain('animate-bounce')
  })

  it('จอโหลดเหลือ spinner + ข้อความเดิม (shopRoute lock อ้างคำว่า "กำลัง" ยังอยู่)', () => {
    expect(appSrc).toMatch(/LoadingSpinner\(\) \{[\s\S]{0,500}?animate-spin[\s\S]{0,300}?น้อง Bite กำลังจัดเตรียมของ…/)
  })

  it('mascot ทุกตัวแสดงหลังโหลดเสร็จเท่านั้น — import ถูกถอดจาก App.tsx (ไม่มี unused)', () => {
    expect(appSrc).not.toContain("import { MascotBadge }")
  })
})

describe('R206 · migration 206 — bucket Bite_Mascot + policies (contract)', () => {
  it('bucket: public + จำกัด mime (GIF อยู่ในรายการ) + ≤15MB + idempotent (ON CONFLICT)', () => {
    expect(migrationSrc).toContain("'Bite_Mascot'")
    expect(migrationSrc).toMatch(/INSERT INTO storage\.buckets/)
    expect(migrationSrc).toMatch(/ON CONFLICT \(id\) DO UPDATE/)
    expect(migrationSrc).toMatch(/public\s*=\s*true/)
    expect(migrationSrc).toContain("'image/gif'")
    expect(migrationSrc).toContain('15728640')
  })

  it('policies ครบ 4 แบบ 119 (bucket_id literal — ห้าม subquery บน storage.buckets): public read + admin-only write', () => {
    expect(migrationSrc).toContain('DROP POLICY IF EXISTS bite_mascot_public_read ON storage.objects;')
    expect(migrationSrc).toMatch(/CREATE POLICY bite_mascot_public_read ON storage\.objects[\s\S]{0,200}?USING \(bucket_id = 'Bite_Mascot'\)/)
    for (const p of ['bite_mascot_admin_upload', 'bite_mascot_admin_update', 'bite_mascot_admin_delete']) {
      expect(migrationSrc).toContain(`DROP POLICY IF EXISTS ${p} ON storage.objects;`)
      expect(migrationSrc).toContain(`CREATE POLICY ${p} ON storage.objects`)
    }
    // admin-only = profiles.role = 'admin' (pattern 119 ที่ผ่าน prod)
    expect(migrationSrc.match(/\(SELECT role FROM public\.profiles WHERE id = auth\.uid\(\)\) = 'admin'/g)?.length).toBe(3)
    expect(migrationSrc).not.toMatch(/SELECT id FROM storage\.buckets/)
  })
})
