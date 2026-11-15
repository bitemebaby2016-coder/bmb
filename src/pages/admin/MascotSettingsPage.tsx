// ============================================
// Bite Me Baby — Admin Mascot Settings (ADM-07)
// Admin changes mascot art per role without changing code (mascot_overrides).
// R52: เพิ่ม testid สำหรับ test lock (mascot-refresh / mascot-alt-* / mascot-save-*)
// R206: ใช้งานได้จริง — เชื่อม bucket `Bite_Mascot` ตรง ๆ:
//   ① preview รูปต่อ role (โหลดไม่ได้ = แสดงสาเหตุ ไม่เงียบ)
//   ② save feedback สำเร็จ/ล้มเหลวจากผล RPC จริง
//   ③ ปุ่มอัปโหลดไฟล์ (GIF/PNG/WebP/JPG ≤15MB) เข้า bucket โดยตรง
//   ④ ล้างค่ากลับค่าเริ่มต้น + quick-pick ไฟล์ที่มีใน bucket
//   ⑤ badge หน้าเว็บเปลี่ยนทันทีใน session เดิม (event) — ไม่ต้อง deploy
// ============================================

import { useEffect, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import {
  getMascotOverrides,
  upsertMascotOverride,
  invalidateMascotOverrides,
  notifyMascotOverridesChanged,
  validateMascotFile,
  uploadMascotAsset,
  listMascotBucketFiles,
  MASCOT_BUCKET,
  MASCOT_ROLES,
  type MascotOverride,
  type MascotBucketFile,
} from '@/lib/mascotService'

type RoleStatus = { kind: 'idle' | 'ok' | 'error'; text: string }
type PreviewState = 'none' | 'loading' | 'ok' | 'error'

export function MascotSettingsPage() {
  const [overrides, setOverrides] = useState<MascotOverride[]>([])
  const [form, setForm] = useState<Record<string, { url: string; alt: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, RoleStatus>>({})
  const [preview, setPreview] = useState<Record<string, PreviewState>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [bucketFiles, setBucketFiles] = useState<MascotBucketFile[]>([])

  async function refresh() {
    const [list, files] = await Promise.all([getMascotOverrides(), listMascotBucketFiles()])
    setOverrides(list)
    setBucketFiles(files)
    const next: Record<string, { url: string; alt: string }> = {}
    const nextPreview: Record<string, PreviewState> = {}
    for (const role of MASCOT_ROLES) {
      const o = list.find((x) => x.role_name === role)
      next[role] = { url: o?.media_url ?? '', alt: o?.alt ?? '' }
      nextPreview[role] = o?.media_url ? 'loading' : 'none'
    }
    setForm(next)
    setPreview(nextPreview)
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function save(role: string) {
    setSaving(role)
    setStatus((p) => ({ ...p, [role]: { kind: 'idle', text: '' } }))
    const f = form[role]
    const ok = await upsertMascotOverride(role, f.url.trim(), f.alt.trim())
    if (ok) {
      invalidateMascotOverrides() // storefront จะดึงรูปใหม่ทันทีใน mount ถัดไป
      notifyMascotOverridesChanged() // R206: badge ที่แสดงอยู่เปลี่ยนทันที — ไม่ต้อง deploy
      setStatus((p) => ({ ...p, [role]: { kind: 'ok', text: '✅ บันทึกแล้ว — หน้าเว็บใช้รูปใหม่ทันที' } }))
    } else {
      setStatus((p) => ({ ...p, [role]: { kind: 'error', text: '❌ บันทึกไม่สำเร็จ — ต้องล็อกอินเป็นแอดมิน (ตรวจ RPC upsert_mascot_override)' } }))
    }
    setSaving(null)
    await refresh()
  }

  /** R206: ล้าง override ของ role → กลับไปใช้รูปค่าเริ่มต้นของระบบ */
  async function clearOverride(role: string) {
    setForm((p) => ({ ...p, [role]: { url: '', alt: p[role]?.alt ?? '' } }))
    setPreview((p) => ({ ...p, [role]: 'none' }))
    await save(role)
  }

  /** R206: อัปโหลดไฟล์เข้า bucket `Bite_Mascot` ตรง → เติม URL อัตโนมัติ */
  async function onFile(role: string, file?: File) {
    if (!file) return
    const v = validateMascotFile(file)
    if (!v.ok) {
      setStatus((p) => ({ ...p, [role]: { kind: 'error', text: `❌ ${v.error}` } }))
      return
    }
    setUploading(role)
    setStatus((p) => ({ ...p, [role]: { kind: 'idle', text: '' } }))
    const url = await uploadMascotAsset(file)
    setUploading(null)
    if (!url) {
      setStatus((p) => ({ ...p, [role]: { kind: 'error', text: `❌ อัปโหลดไม่สำเร็จ — ตรวจว่า bucket ${MASCOT_BUCKET} มี policy (migration 206) และล็อกอินเป็นแอดมิน` } }))
      return
    }
    setForm((p) => ({ ...p, [role]: { url, alt: p[role]?.alt ?? '' } }))
    setPreview((p) => ({ ...p, [role]: 'loading' }))
    setStatus((p) => ({ ...p, [role]: { kind: 'ok', text: '✅ อัปโหลดแล้ว — กด "💾 บันทึก" เพื่อใช้กับหน้าเว็บ' } }))
    await refresh()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-accent">🦖 Mascot Self-Service</h1>
        <button
          className="btn btn-outline text-sm"
          data-testid="mascot-refresh"
          aria-label="รีเฟชรายการมาสคอต"
          onClick={() => void refresh()}
        >
          🔄
        </button>
      </div>
      <p className="text-sm text-slate-500">
        เลือกไฟล์อัปโหลดเข้า bucket <code>{MASCOT_BUCKET}</code> โดยตรง หรือวาง Media URL (https://…) ก็ได้ —
        รองรับ GIF แอนิเมต/PNG/WebP/JPG (≤15MB) · บันทึกแล้วหน้าเว็บใช้รูปใหม่ทันที ไม่ต้องแก้ code
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MASCOT_ROLES.map((role) => {
          const url = form[role]?.url ?? ''
          return (
            <GlassCard key={role} className="p-4">
              <h3 className="font-bold text-slate-700 text-sm mb-2">🤖 {role}</h3>

              {/* R206: live preview — เห็นรูปจริง + error state ชี้สาเหตุ (ไม่ silent-fallback) */}
              <div
                className="mb-2 flex items-center justify-center rounded border bg-white/60 min-h-[96px] p-2"
                data-testid={`mascot-preview-${role}`}
              >
                {url ? (
                  <img
                    src={url}
                    alt={`มาสคอต ${role}`}
                    className="max-h-24 object-contain"
                    data-testid={`mascot-preview-img-${role}`}
                    onLoad={() => setPreview((p) => ({ ...p, [role]: 'ok' }))}
                    onError={() => setPreview((p) => ({ ...p, [role]: 'error' }))}
                  />
                ) : (
                  <span className="text-xs text-slate-400">ค่าเริ่มต้นของระบบ (ยังไม่ตั้ง override)</span>
                )}
              </div>
              {url && preview[role] === 'error' && (
                <p className="text-xs text-red-600 mb-2" data-testid={`mascot-preview-error-${role}`}>
                  ⚠ โหลดรูปจาก URL นี้ไม่ได้ — ตรวจว่า bucket เป็น public และ URL ชี้ไฟล์จริง
                </p>
              )}

              {/* R206: อัปโหลดไฟล์เข้า bucket ตรง */}
              <label className="btn btn-outline text-xs mb-2 cursor-pointer block text-center">
                {uploading === role ? '⏳ กำลังอัปโหลด…' : '📤 เลือกไฟล์อัปโหลด (GIF/รูป)'}
                <input
                  type="file"
                  accept="image/gif,image/png,image/webp,image/jpeg"
                  className="hidden"
                  data-testid={`mascot-file-${role}`}
                  disabled={uploading === role}
                  onChange={(e) => {
                    void onFile(role, e.target.files?.[0] ?? undefined)
                    e.currentTarget.value = ''
                  }}
                />
              </label>

              <input
                className="input mb-1 text-xs"
                placeholder="Media URL (https://…)"
                value={url}
                onChange={(e) => {
                  setForm((p) => ({ ...p, [role]: { ...(p[role] ?? { alt: '' }), url: e.target.value } }))
                  setPreview((p) => ({ ...p, [role]: e.target.value ? 'loading' : 'none' }))
                }}
                data-testid={`mascot-url-${role}`}
              />
              <input
                className="input mb-2 text-xs"
                placeholder="Alt text (optional)"
                value={form[role]?.alt ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, [role]: { ...(p[role] ?? { url: '' }), alt: e.target.value } }))}
                data-testid={`mascot-alt-${role}`}
              />

              <div className="flex gap-2">
                <button
                  className="btn btn-primary text-xs flex-1"
                  disabled={saving === role || uploading === role}
                  data-testid={`mascot-save-${role}`}
                  onClick={() => void save(role)}
                >
                  {saving === role ? 'บันทึก…' : '💾 บันทึก'}
                </button>
                {overrides.some((o) => o.role_name === role && o.media_url?.length > 0) && (
                  <button
                    className="btn btn-outline text-xs"
                    disabled={saving === role}
                    data-testid={`mascot-clear-${role}`}
                    title="ล้าง override — กลับไปใช้รูปค่าเริ่มต้นของระบบ"
                    onClick={() => void clearOverride(role)}
                  >
                    ↩ ค่าเริ่มต้น
                  </button>
                )}
              </div>

              {/* R206: save/upload feedback จริง (สำเร็จ = เขียว · ล้มเหลว = แดง พร้อมสาเหตุ) */}
              {status[role]?.kind === 'ok' && (
                <p className="text-xs text-green-700 mt-2" data-testid={`mascot-msg-${role}`}>{status[role].text}</p>
              )}
              {status[role]?.kind === 'error' && (
                <p className="text-xs text-red-600 mt-2" data-testid={`mascot-msg-${role}`}>{status[role].text}</p>
              )}
            </GlassCard>
          )
        })}
      </div>

      {/* R206: quick-pick ไฟล์ที่มีอยู่จริงใน bucket Bite_Mascot */}
      <GlassCard className="p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-2">🗂 ไฟล์ใน bucket <code>{MASCOT_BUCKET}</code> (ล่าสุดก่อน)</h3>
        {bucketFiles.length === 0 ? (
          <p className="text-xs text-slate-400" data-testid="mascot-bucket-empty">
            ยังอ่านรายการไม่ได้ หรือยังไม่มีไฟล์ — อัปโหลดจากการ์ดด้านบน หรือตรวจ policy ของ bucket (migration 206)
          </p>
        ) : (
          <ul className="space-y-1" data-testid="mascot-bucket-files">
            {bucketFiles.map((f) => (
              <li key={f.name} className="flex items-center gap-2 text-xs">
                <img src={f.url} alt={f.name} className="w-8 h-8 object-contain rounded bg-white/70" />
                <span className="truncate flex-1">{f.name}</span>
                <button
                  className="btn btn-outline text-xs py-0.5 px-2"
                  onClick={() => void navigator.clipboard?.writeText(f.url)}
                  title="คัดลอก URL"
                >
                  คัดลอก URL
                </button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  )
}
