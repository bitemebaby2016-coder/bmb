// ============================================
// Bite Me Baby — AI Studio Tab (Image Generation + Album Management only)
// Post creation moved to ContentTab, Floating Ad moved to ContentTab
// ============================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { compressToWebLimits, PRODUCT_IMAGE_MAX_SIDE } from '@/lib/bmbAdminApi_media'
import { flashTo } from '@/lib/uiFlash'

export type GenQa = { ok: boolean; warn?: string; w: number; h: number }
export const KIND_PRESETS_KEYS = ['menu', 'promo', 'festival'] as const
export const MENU_ASPECTS = [1, 4 / 3, 3 / 4]

export async function checkGenQuality(url: string, kind: string): Promise<GenQa> {
  try {
    const res = await fetch(url)
    if (!res.ok) return { ok: true, w: 0, h: 0 }
    const bmp = await createImageBitmap(await res.blob())
    const w = bmp.width; const h = bmp.height; bmp.close?.()
    if (Math.min(w, h) < 512) return { ok: false, w, h, warn: `ความละเอียด ${w}×${h} ต่ำเกินไป` }
    if (kind === 'menu') {
      const ar = w / h
      const fits = MENU_ASPECTS.some((t) => Math.abs(ar - t) / t <= 0.12)
      if (!fits) return { ok: false, w, h, warn: `สัดส่วน ${w}×${h} ไม่ตรงกรอบเมนู (1:1 หรือ 4:3) — เบี้ยว/ขนาดไม่ตรง` }
    }
    return { ok: true, w, h }
  } catch { return { ok: true, w: 0, h: 0 } }
}

export function autoMascotForKind(kind: string): string {
  if (kind === 'menu') return 'bite_menu'
  if (kind === 'festival') return 'bite_award'
  return 'bite_recommend'
}

export interface AiStudioTabProps { }

export function AiStudioTab(): React.ReactElement {
  const [genKind, setGenKind] = useState<'menu' | 'promo' | 'festival'>('promo')
  const [genStyle, setGenStyle] = useState<'realistic' | 'illustration' | 'poster'>('realistic')
  const [genSubject, setGenSubject] = useState('')
  const [genNote, setGenNote] = useState('')
  const [wmMascot, setWmMascot] = useState<string>(() => {
    try { return localStorage.getItem('bmb:wm-mascot') || 'auto' } catch { return 'auto' }
  })
  const [genBusy, setGenBusy] = useState(false)
  const [genStatus, setGenStatus] = useState<{ phase: 'idle' | 'running' | 'ok' | 'fail'; detail?: string; url?: string; model?: string; qa?: GenQa }>({ phase: 'idle' })

  const AI_ALBUM_KINDS = ['menu', 'promo', 'festival'] as const
  type AiAlbumItem = { name: string; url: string; path: string; kind: string; disabled: boolean }
  const [aiAlbum, setAiAlbum] = useState<AiAlbumItem[]>([])
  const [aiAlbumTab, setAiAlbumTab] = useState<'all' | 'menu' | 'promo' | 'festival' | 'disabled' | 'legacy'>('all')
  const [albumLoading, setAlbumLoading] = useState(false)

  const loadAiAlbum = useCallback(async () => {
    setAlbumLoading(true)
    try {
      const s = supabase.storage.from('bmb-images')
      const out: AiAlbumItem[] = []
      for (const kind of ['menu', 'promo', 'festival']) {
        for (const [dir, disabled] of [
          [`ai-generated/${kind}`, false],
          [`ai-generated/_disabled/${kind}`, true],
        ] as Array<[string, boolean]>) {
          const { data, error } = await s.list(dir, { limit: 60, sortBy: { column: 'created_at', order: 'desc' } })
          if (error || !data) continue
          for (const f of data) {
            if (!f.name || f.name.startsWith('.')) continue
            const p = `${dir}/${f.name}`
            out.push({ name: f.name, path: p, kind, disabled, url: s.getPublicUrl(p).data.publicUrl })
          }
        }
      }
      const { data: root } = await s.list('ai-generated', { limit: 60, sortBy: { column: 'created_at', order: 'desc' } })
      for (const f of root || []) {
        if (!f.name || f.name.startsWith('.') || f.id == null) continue
        const p = `ai-generated/${f.name}`
        out.push({ name: f.name, path: p, kind: 'legacy', disabled: false, url: s.getPublicUrl(p).data.publicUrl })
      }
      setAiAlbum(out)
    } catch { /* เงียบ */ }
    finally { setAlbumLoading(false) }
  }, [])

  useEffect(() => { void loadAiAlbum() }, [loadAiAlbum])

  const visibleAiAlbum = aiAlbum.filter((a) =>
    aiAlbumTab === 'all' ? !a.disabled :
    aiAlbumTab === 'disabled' ? a.disabled :
    aiAlbumTab === 'legacy' ? a.kind === 'legacy' :
    a.kind === aiAlbumTab
  )

  const WM_MASCOTS = [
    { key: 'auto', label: '🤖 อัตโนมัติ (เลือกตามประเภทภาพ — จำไว้ใช้ทุกครั้ง)' },
    { key: 'bite_recommend', label: '👉 น้อง Bite แนะนำ' },
    { key: 'bite_menu', label: '🍽️ น้อง Bite นำเสนอเมนู' },
    { key: 'bite_eating', label: '😋 น้อง Bite ทานของอร่อย' },
    { key: 'bite_cooking', label: '👨‍🍳 น้อง Bite ทีมครัว' },
    { key: 'bite_award', label: '🏆 น้อง Bite ฉลองรางวัล' },
  ]

  return (
    <div className="space-y-3">
      <div className="card">
        <h2 className="font-bold text-brand-accent mb-2">🎨 สร้างภาพโปรโมต (AI — E5/E6)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">ประเภทภาพ
            <select className="input w-full" value={genKind} onChange={(e) => setGenKind(e.target.value as typeof genKind)}>
              <option value="promo">ป้ายโปรโมต</option>
              <option value="festival">ภาพเทศกาล</option>
              <option value="menu">ภาพเมนู/อาหาร (ใช้รูปต้นแบบเป็นต้นแบบไดคัท)</option>
            </select>
          </label>
          <label className="text-sm">สไตล์ (E6 — 3 แนวจากโจทย์เดียวกัน)
            <select className="input w-full" value={genStyle} onChange={(e) => setGenStyle(e.target.value as typeof genStyle)}>
              <option value="realistic">ถ่ายสมจริง</option>
              <option value="illustration">ภาพประกอบ</option>
              <option value="poster">กราฟิกป้าย</option>
            </select>
          </label>
          <label className="text-sm">ชื่อสินค้า/หัวข้อ
            <input className="input w-full" value={genSubject} onChange={(e) => setGenSubject(e.target.value)} placeholder="เช่น บิงซูมะม่วง" />
          </label>
          <label className="text-sm">เพิ่มเติม (ไม่บังคับ)
            <input className="input w-full" value={genNote} onChange={(e) => setGenNote(e.target.value)} placeholder="เช่น โทนเหลืองทอง" />
          </label>
          <label className="text-sm">มาสคอตลายน้ำ (R47 — ทุกภาพเจน)
            <select className="input w-full" value={wmMascot} onChange={(e) => { setWmMascot(e.target.value); try { localStorage.setItem('bmb:wm-mascot', e.target.value); showToast('จำมาสคอตลายน้ำไว้ใช้กับทุกรูปที่เจนจากนี้แล้ว', 'success') } catch {} }} data-testid="mk-wm-mascot">
              {WM_MASCOTS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-primary" disabled={false} onClick={() => showToast('Image generation requires backend', 'info')} data-testid="mk-generate-image">
            ✨ สร้างภาพ
          </button>
        </div>
        <p className="text-xs text-brand-muted mt-2">รูปเมนู = ภาพจริงจากแคตตาลอก (จิ้มเมนูใน Planner) หรือ <b>ไฟล์จากเครื่อง (browse)</b> — แนบไว้แล้วใช้เป็น<b>ต้นแบบไดคัท</b>ตอนเจนภาพเมนูได้ · <b>เจนได้แม้ไม่มีภาพตัวอย่าง</b> (ระบบใช้รายละเอียดหัวข้อ/เนื้อหาโพสต์เป็นโจทย์) · ภาพที่เจน<b>ไม่ถูกแนบ/เลือกใช้อัตโนมัติ</b> — กด "ใช้" เองจากอัลบั้ม · ทุกภาพถูก<b>ประกบลายน้ำแบรนด์</b> (โลโก้จริง + มาสคอต) อัตโนมัติ</p>

        <div className="mt-3" data-testid="mk-ai-album">
          <p className="text-xs font-semibold text-brand-accent mb-1">🗂️ อัลบั้มภาพที่ AI สร้าง (<code>{`bmb-images/ai-generated/<หมวด>/`}</code>) — เลือกหมวด แล้วกดปุ่มบนรูปได้เอง</p>
          <div className="flex flex-wrap gap-1 mb-2" data-testid="mk-ai-album-tabs">
            {(['all', 'menu', 'promo', 'festival', 'disabled', 'legacy'] as const).map((k) => {
              const labels = { all: '🟢 ใช้งานได้', menu: '🍽️ เมนู', promo: '📣 โปรโมต', festival: '🎉 เทศกาล', disabled: '⚪ ปิดใช้งาน', legacy: '📁 รุ่นก่อน' }
              return <button key={k} type="button" onClick={() => {}} className={`px-2 py-1 rounded-lg text-xs font-medium border ${k === 'all' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-brand-surface border-brand-border text-brand-accent'}`} data-testid={`mk-ai-tab-${k}`}>{labels[k]}</button>
            })}
          </div>
          {visibleAiAlbum.length === 0 ? <p className="text-xs text-brand-muted">ยังไม่มีภาพในหมวดนี้ — สร้างภาพสำเร็จจะขึ้นทันทีในหมวดที่เลือกเจน</p> : (
            <div className="flex flex-wrap gap-2" data-testid="mk-ai-album-grid">
              {visibleAiAlbum.map((a) => (
                <div key={a.path} className={`relative w-24 rounded-lg border overflow-hidden ${a.disabled ? 'opacity-50 border-brand-border' : 'border-brand-border'}`} data-testid={`mk-ai-item-${a.name}`}>
                  <img src={a.url} alt={a.name} className="w-full h-20 object-cover" />
                  <div className="flex text-[9px] leading-none">
                    <button type="button" className="flex-1 bg-brand-primary text-white py-1" onClick={() => showToast('ใช้รูปนี้ได้ที่แท็บ "สร้างเนื้อหา"', 'info')} data-testid={`mk-ai-pick-${a.name}`} title="ใช้รูปนี้">ใช้</button>
                    <button type="button" className="flex-1 bg-amber-500 text-white py-1" data-testid={`mk-ai-toggle-${a.name}`} title={a.disabled ? 'เปิด' : 'ปิด'}>{a.disabled ? 'เปิด' : 'ปิด'}</button>
                    <button type="button" className="flex-1 bg-red-500 text-white py-1" data-testid={`mk-ai-del-${a.name}`} title="ลบ">ลบ</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}