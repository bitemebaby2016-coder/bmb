// ============================================
// Bite Me Baby — AI Studio Tab (merged Studio + AI tabs)
// ============================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'
import { listContentApprovals, reviewContent, type ContentApprovalRow } from '@/lib/contentApproval'
import { autoScheduleApprovedPosts } from '@/lib/marketingAutoSchedule'
import { flashTo } from '@/lib/uiFlash'
import { getBusinessSettings, setBusinessSetting } from '@/lib/bmbAdminApi_settings'
import { compressToWebLimits, PRODUCT_IMAGE_MAX_SIDE } from '@/lib/bmbAdminApi_media'
import { PostForm, PostFormImperativeHandle } from './PostForm'

// R44: URL ภาพที่ AI สร้าง (bmb-images/ai-generated/) — กติกา "มีภาพเจน = ใช้ภาพเจนรูปเดียว"
const isGenImage = (u: string) => u.includes('/ai-generated/')

// R47: เลือกมาสคอตลายน้ำอัตโนมัติตามประเภทภาพที่เจน
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

export interface AiStudioTabProps {
  postFormRef: React.RefObject<PostFormImperativeHandle>
  postTitle: string
  postBodyText: string
  postContentType: 'post' | 'promotion' | 'banner' | 'announcement'
  postImages: string[]
  setPostTitle: (v: string) => void
  setPostBodyText: (v: string) => void
  setPostContentType: (v: 'post' | 'promotion' | 'banner' | 'announcement') => void
  setPostImages: React.Dispatch<React.SetStateAction<string[]>>
  postSaving: boolean
  onCreatePost: () => void
}

export function AiStudioTab({
  postFormRef,
  postTitle,
  postBodyText,
  postContentType,
  postImages,
  setPostTitle,
  setPostBodyText,
  setPostContentType,
  setPostImages,
  postSaving,
  onCreatePost,
}: AiStudioTabProps) {
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

  const loadAiAlbum = useCallback(async () => {
    try {
      const s = supabase.storage.from('bmb-images')
      const out: AiAlbumItem[] = []
      for (const kind of AI_ALBUM_KINDS) {
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
  }, [])

  useEffect(() => { void loadAiAlbum() }, [loadAiAlbum])

  const visibleAiAlbum = aiAlbum.filter((a) => (aiAlbumTab === 'all' ? !a.disabled : aiAlbumTab === 'disabled' ? a.disabled : aiAlbumTab === 'legacy' ? a.kind === 'legacy' : a.kind === aiAlbumTab))

  const [floatingAdImage, setFloatingAdImage] = useState('')
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.from('business_settings').select('value').eq('key', 'floating_ad_image').maybeSingle()
        const v = (data as { value?: unknown } | null)?.value
        if (typeof v === 'string') setFloatingAdImage(v)
      } catch { /* เงียบ */ }
    })()
  }, [])

  async function toggleFloatingAd(url: string) {
    try {
      const next = floatingAdImage === url ? '' : url
      const ok = await setBusinessSetting('floating_ad_image', next)
      if (!ok) throw new Error('save failed')
      setFloatingAdImage(next)
      showToast(next ? 'ตั้งภาพนี้เป็นโฆษณาลอย (Floating Ad) แล้ว — จะโชว์พร้อมน้อง Bite ประกอบบนรูปที่หน้าแรก' : 'เลิกใช้ภาพนี้เป็นโฆษณาลอยแล้ว (กลับเป็นมาสคอตตามเดิม)', 'success')
      flashTo('mk-ai-album')
    } catch (err) {
      showToast('บันทึกโฆษณาลอยไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 100), 'error')
    }
  }

  async function handleGenerateImage() {
    const subject = genSubject.trim() || postTitle.trim()
    if (!subject) { showToast('ใส่โจทย์/หัวข้อ (ช่องภาพ หรือหัวข้อโพสต์) ก่อนสร้างภาพ', 'error'); return }
    const note = [genNote.trim(), postBodyText.trim().slice(0, 160)].filter(Boolean).join(' · ')
    const reference = postImages.length > 0 ? postImages[postImages.length - 1] : undefined
    if (genKind === 'menu' && !reference) {
      showToast('ยังไม่มีรูปเมนูตัวอย่างในชุดภาพ — จิ้มเมนูใน Planner หรือ browse ไฟล์เพื่อใช้เป็นต้นแบบไดคัท (ไม่แนบก็เจนจากโจทย์ข้อความได้)', 'info')
    }
    setGenBusy(true)
    setGenStatus({ phase: 'running' })
    flashTo('mk-gen-status')
    try {
      const { data, error } = await supabase.functions.invoke('image-gen', {
        body: { kind: genKind, style: genStyle, subject, note, reference_image_url: reference },
      })
      if (error || !data?.ok) {
        let detail = data?.error || error?.message || 'ERR_IMAGE_GEN_FAILED'
        const ctx = (error as unknown as { context?: Response } | null)?.context
        if (ctx && typeof ctx.text === 'function') {
          try {
            const raw = await ctx.text()
            if (raw) {
              try { const b = JSON.parse(raw) as { error?: string; detail?: string }; const d = `${b?.error ?? ''} ${b?.detail ?? ''}`.trim(); if (d) detail = d } catch { detail = `${detail} | ${raw.slice(0, 180)}` }
            }
          } catch { /* คง message เดิม */ }
        }
        setGenStatus({ phase: 'fail', detail })
        flashTo('mk-gen-status')
        showToast('สร้างภาพไม่สำเร็จ: ' + detail, 'error')
      } else {
        const wmUrl = await applyBrandWatermark(data.url, genKind, wmMascot)
        if (wmUrl !== data.url) {
          try {
            const marker = '/object/public/bmb-images/'
            if (data.url.includes(marker)) {
              const p = data.url.slice(data.url.indexOf(marker) + marker.length).split('?')[0]
              await supabase.storage.from('bmb-images').remove([decodeURIComponent(p)])
            }
          } catch { /* ลบต้นฉบับไม่ได้ = ไม่เป็นไร */ }
        }
        const qa = await checkGenQuality(wmUrl, genKind)
        setGenStatus({ phase: 'ok', url: wmUrl, model: data.model, qa })
        await loadAiAlbum()
        flashTo('mk-gen-status')
        showToast(
          qa.ok
            ? '✅ สร้างภาพสำเร็จ + ประกบลายน้ำแล้ว — อยู่ในอัลบั้มตามหมวด (ไม่แนบเข้าชุดอัตโนนัติ · กด "ใช้" เองเมื่อต้องการ)'
            : `⚠️ สร้างภาพสำเร็จ แต่ ${qa.warn} — ระบบไม่เลือกใช้แทนให้อัตโนมัติ (ตรวจดูก่อน แล้วกด "ใช้" เองถ้า OK)`,
          qa.ok ? 'success' : 'warning',
        )
      }
    } catch (e) {
      const msg = String(e).slice(0, 160)
      setGenStatus({ phase: 'fail', detail: msg })
      flashTo('mk-gen-status')
      showToast('สร้างภาพไม่สำเร็จ: ' + msg, 'error')
    } finally { setGenBusy(false) }
  }

  const [browseBusy, setBrowseBusy] = useState(false)
  const browseRef = useRef<HTMLInputElement | null>(null)

  async function handleBrowseImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('เลือกไฟล์รูปภาพเท่านั้น (jpg/png/webp)', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { showToast('ไฟล์ต้องไม่เกิน 10MB', 'error'); return }
    setBrowseBusy(true)
    try {
      const sized = await compressToWebLimits(file)
      const safe = (sized.name || 'image.png').replace(/[^\w.-]+/g, '_').slice(-60)
      const path = `marketing/browse-${Date.now()}-${safe}`
      const { error } = await supabase.storage.from('bmb-images').upload(path, sized, { contentType: sized.type, upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('bmb-images').getPublicUrl(path)
      const url = data?.publicUrl
      if (!url) throw new Error('no public url')
      setPostImages((prev: string[]) => [...prev, url])
      showToast(sized !== file ? `แนบรูปจากไฟล์ + ลดขนาดอัตโนมัติ (กว้างสุด ${PRODUCT_IMAGE_MAX_SIDE}px) เข้าชุดภาพของโพสต์แล้ว` : 'แนบรูปจากไฟล์เข้าชุดภาพของโพสต์แล้ว — ใช้ร่วมกับภาพ AI/แคตตาลอกได้เลย', 'success')
      flashTo('mk-images-strip')
    } catch (err) { showToast('อัปโหลดรูปไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 120), 'error') }
    finally { setBrowseBusy(false) }
  }

  function pickAiImage(url: string) {
    setPostImages([url])
    flashTo('mk-images-strip')
    showToast('เลือกภาพนี้เป็นรูปโพสต์แล้ว (แทนรูปเดิม — โพสต์ใช้ทีละรูป)', 'success')
  }

  async function handleRemoveImage(url: string) {
    setPostImages((prev: string[]) => prev.filter((x: string) => x !== url))
    const marker = '/object/public/bmb-images/'
    if (!url.includes(marker)) { showToast('ลบรูปออกจากชุดภาพแล้ว (ไฟล์นี้ไม่ได้อยู่บนคลังภาพของเรา — ไม่มีไฟล์ต้องลบ)', 'info'); return }
    try {
      const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length).split('?')[0])
      const { error } = await supabase.storage.from('bmb-images').remove([path])
      if (error) throw error
      if (path.startsWith('ai-generated/')) await loadAiAlbum()
      showToast('ลบรูปออกจากชุดภาพ + ลบไฟล์จริงจากคลังภาพแล้ว', 'success')
    } catch (err) { showToast('เอาออกจากชุดภาพแล้ว แต่ลบไฟล์ไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 100), 'warning') }
  }

  async function toggleAiImage(item: AiAlbumItem) {
    try {
      const s = supabase.storage.from('bmb-images')
      const to = item.disabled ? `ai-generated/${item.kind}/${item.name}` : `ai-generated/_disabled/${item.kind}/${item.name}`
      const { error } = await s.move(item.path, to)
      if (error) throw error
      await loadAiAlbum()
      showToast(item.disabled ? 'เปิดใช้งานภาพนี้กลับแล้ว' : 'ปิดภาพนี้แล้ว — ไม่ให้ระบบนำไปใช้กับงานใด ๆ (กด "เปิด" ได้ทุกเมื่อ)', 'success')
    } catch (err) { showToast('สลับสถานะภาพไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 100), 'error') }
  }

  async function deleteAiImage(item: AiAlbumItem) {
    try {
      const { error } = await supabase.storage.from('bmb-images').remove([item.path])
      if (error) throw error
      setPostImages((prev: string[]) => prev.filter((x: string) => x !== item.url))
      await loadAiAlbum()
      showToast('ลบรูปออกจากอัลบั้ม + ลบไฟล์จริงจากคลังภาพแล้ว', 'success')
    } catch (err) { showToast('ลบรูปไม่สำเร็จ: ' + String((err as Error)?.message || err).slice(0, 100), 'error') }
  }

  const WM_MASCOTS: Array<{ key: string; label: string }> = [
    { key: 'auto', label: '🤖 อัตโนมัติ (เลือกตามประเภทภาพ — จำไว้ใช้ทุกครั้ง)' },
    { key: 'bite_recommend', label: '👉 น้อง Bite แนะนำ' },
    { key: 'bite_menu', label: '🍽️ น้อง Bite นำเสนอเมนู' },
    { key: 'bite_eating', label: '😋 น้อง Bite ทานของอร่อย' },
    { key: 'bite_cooking', label: '👨‍🍳 น้อง Bite ทีมครัว' },
    { key: 'bite_award', label: '🏆 น้อง Bite ฉลองรางวัล' },
  ]

  async function fetchBitmap(url: string): Promise<ImageBitmap | null> {
    try { const res = await fetch(url); if (!res.ok) return null; return await createImageBitmap(await res.blob()) } catch { return null }
  }

  async function applyBrandWatermark(srcUrl: string, kind: string, mascotChoice: string): Promise<string> {
    try {
      const mascotKey = mascotChoice === 'auto' ? autoMascotForKind(kind) : mascotChoice
      const [img, logo, mascot] = await Promise.all([fetchBitmap(srcUrl), fetchBitmap('/Logo_Sticker_Circle.webp'), fetchBitmap(`/assets/mascot/${mascotKey}.webp`)])
      if (!img) return srcUrl
      const w = img.width, h = img.height
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d'); if (!ctx) return srcUrl
      ctx.drawImage(img, 0, 0)
      const minSide = Math.min(w, h)
      const pad = Math.round(minSide * 0.03)
      const pillH = Math.round(minSide * 0.13)
      const pillW = Math.round(pillH * 4.6)
      const px = w - pad - pillW; const py = h - pad - pillH
      ctx.save(); ctx.globalAlpha = 0.88; ctx.fillStyle = '#FFFFFF'
      if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === 'function') {
        ctx.beginPath(); (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(px, py, pillW, pillH, pillH / 2); ctx.fill()
      } else { ctx.fillRect(px, py, pillW, pillH) }
      ctx.globalAlpha = 1
      const logoSize = Math.round(pillH * 0.78)
      if (logo) ctx.drawImage(logo, px + pillH * 0.11, py + (pillH - logoSize) / 2, logoSize, logoSize)
      ctx.fillStyle = '#92400E'; ctx.font = `bold ${Math.round(pillH * 0.42)}px Quicksand, sans-serif`; ctx.textBaseline = 'middle'
      ctx.fillText('Bite Me Baby', px + logoSize + pillH * 0.3, py + pillH * 0.54)
      if (mascot) {
        const mH = Math.round(pillH * 1.7); const mW = Math.round(mascot.width * (mH / mascot.height))
        ctx.drawImage(mascot, px + pillW - mW - pillH * 0.15, py - mH + pillH * 0.35, mW, mH)
      }
      ctx.restore()
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) return srcUrl
      const wmFile = new File([blob], `wm-${Date.now().toString(36)}.png`, { type: 'image/png', lastModified: Date.now() })
      const sized = await compressToWebLimits(wmFile)
      const path = `ai-generated/${(KIND_PRESETS_KEYS as readonly string[]).includes(kind) ? kind : 'menu'}/wm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}${sized.name.endsWith('.jpg') ? '.jpg' : '.png'}`
      const { error } = await supabase.storage.from('bmb-images').upload(path, sized, { contentType: sized.type, upsert: false })
      if (error) return srcUrl
      return supabase.storage.from('bmb-images').getPublicUrl(path).data.publicUrl
    } catch { return srcUrl }
  }

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
          <button className="btn btn-primary" disabled={genBusy} onClick={() => void handleGenerateImage()} data-testid="mk-generate-image">
            {genBusy ? '⏳ กำลังสร้าง…' : '✨ สร้างภาพ'}
          </button>
          <button className="btn btn-outline" disabled={browseBusy} onClick={() => browseRef.current?.click()} data-testid="mk-browse-image">
            {browseBusy ? '⏳ กำลังอัปโหลด…' : '📁 เลือกไฟล์รูปเมนูจากเครื่อง'}
          </button>
          <input ref={browseRef} type="file" accept="image/*" className="hidden" data-testid="mk-browse-input" onChange={(e) => void handleBrowseImage(e)} />
        </div>
        <p className="text-xs text-brand-muted mt-2">รูปเมนู = ภาพจริงจากแคตตาลอก (จิ้มเมนูใน Planner) หรือ <b>ไฟล์จากเครื่อง (browse)</b> — แนบไว้แล้วใช้เป็น<b>ต้นแบบไดคัท</b>ตอนเจนภาพเมนูได้ · <b>เจนได้แม้ไม่มีภาพตัวอย่าง</b> (ระบบใช้รายละเอียดหัวข้อ/เนื้อหาโพสต์เป็นโจทย์) · ภาพที่เจน<b>ไม่ถูกแนบ/เลือกใช้อัตโนมัติ</b> — กด "ใช้" เองจากอัลบั้ม · ทุกภาพถูก<b>ประกบลายน้ำแบรนด์</b> (โลโก้จริง + มาสคอต) อัตโนมัติ</p>

        {/* R40: ตัวแสดงสถานะการเจน + พรีวิวผลลัพธ์ */}
        {genStatus.phase !== 'idle' && (
          <div className={`mt-3 rounded-xl border p-3 text-sm ${genStatus.phase === 'fail' ? 'border-red-400 bg-red-50 text-red-700' : genStatus.phase === 'ok' ? 'border-green-400 bg-green-50 text-green-700' : 'border-brand-border bg-brand-surface'}`} data-testid="mk-gen-status" role="status">
            {genStatus.phase === 'running' && <span>⏳ <b>กำลังสร้างภาพ…</b> (วนโมเดลตามลำดับ — อาจใช้ 10–40 วินาที) · โจทย์: {genSubject.trim() || postTitle.trim() || '—'} · ภาพอ้างอิง: {postImages.length ? 'มี (ภาพล่าสุดในชุด)' : 'ไม่มี'}</span>}
            {genStatus.phase === 'ok' && <span>✅ <b>สร้างสำเร็จ</b>{genStatus.model ? ` · โมเดล ${genStatus.model}` : ''} — บันทึกอัลบั้มตามหมวด + ไม่แนบเข้าชุดอัตโนมัติ{genStatus.qa && genStatus.qa.w ? ` · ขนาด ${genStatus.qa.w}×${genStatus.qa.h}px` : ''}</span>}
            {genStatus.phase === 'ok' && genStatus.qa && !genStatus.qa.ok && <span className="block mt-1 text-amber-700" data-testid="mk-gen-qa-warn">⚠️ {genStatus.qa.warn} — <b>ระบบไม่เลือกใช้แทนให้อัตโนมัติ</b> ตรวจภาพก่อน แล้วกด "ใช้" เองถ้าผ่าน</span>}
            {genStatus.phase === 'fail' && <span>❌ <b>สร้างไม่สำเร็จ:</b> {genStatus.detail}</span>}
          </div>
        )}
        {genStatus.phase === 'ok' && genStatus.url && (
          <div className="mt-3 flex items-start gap-3" data-testid="mk-gen-result">
            <img src={genStatus.url} alt="ภาพที่เพิ่งสร้าง" className="w-40 h-40 object-cover rounded-xl border border-brand-border" />
            <div className="text-xs text-brand-muted"><b>พรีวิวผลลัพธ์ล่าสุด</b> — อยู่ในชุดภาพ (ด้านล่าง) + อัลบั้ม ai-generated แล้ว ใช้กับโพสต์ได้เลย<br /><a href={genStatus.url} target="_blank" rel="noreferrer" className="underline">เปิดไฟล์เต็ม</a></div>
          </div>
        )}
        {postImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3" data-testid="mk-images-strip">
            {postImages.map((u) => (
              <span key={u} className="relative inline-block">
                <img src={u} alt="generated" className="w-24 h-24 object-cover rounded-lg border border-brand-border" />
                <button type="button" aria-label="ลบรูปนี้" title="ลบรูปนี้ — ออกจากชุดภาพ + ลบไฟล์จริงจากคลัง (ถ้าเป็นไฟล์ของเรา)" data-testid={`mk-img-del-${postImages.indexOf(u)}`} onClick={() => void handleRemoveImage(u)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-primary text-white text-xs leading-none btn p-0">✕</button>
              </span>
            ))}
            {postImages.some(isGenImage) && postImages.length > 1 && <p className="w-full text-xs text-brand-accent" data-testid="mk-images-gen-only">มีภาพเจนในชุด — ตอนสร้างโพสต์จะใช้ภาพเจน 1 รูปเท่านั้น (รูปต้นแบบ/รูปอื่นจะไม่ถูกแนบคู่กัน)</p>}
          </div>
        )}
        {/* R40: อัลบั้มภาพ AI · R55: แยกตามหมวด (tabs) + ปุ่มต่อรูป = ใช้ / ปิด-เปิด / ลบ */}
        <div className="mt-3" data-testid="mk-ai-album">
          <p className="text-xs font-semibold text-brand-accent mb-1">🗂️ อัลบั้มภาพที่ AI สร้าง (<code>{`bmb-images/ai-generated/<หมวด>/`}</code>) — เลือกหมวด แล้วกดปุ่มบนรูปได้เอง</p>
          <div className="flex flex-wrap gap-1 mb-2" data-testid="mk-ai-album-tabs">
            {(['all', 'menu', 'promo', 'festival', 'disabled', 'legacy'] as Array<'all' | 'menu' | 'promo' | 'festival' | 'disabled' | 'legacy'>).map((k) => {
              const labels: Record<string, string> = { all: '🟢 ใช้งานได้', menu: '🍽️ เมนู', promo: '📣 โปรโมต', festival: '🎉 เทศกาล', disabled: '⚪ ปิดใช้งาน', legacy: '📁 รุ่นก่อน' }
              return <button key={k} type="button" onClick={() => setAiAlbumTab(k)} className={`px-2 py-1 rounded-lg text-xs font-medium border ${aiAlbumTab === k ? 'bg-brand-primary text-white border-brand-primary' : 'bg-brand-surface border-brand-border text-brand-accent'}`} data-testid={`mk-ai-tab-${k}`}>{labels[k]}</button>
            })}
          </div>
          {visibleAiAlbum.length === 0 ? <p className="text-xs text-brand-muted">ยังไม่มีภาพในหมวดนี้ — สร้างภาพสำเร็จจะขึ้นทันทีในหมวดที่เลือกเจน</p> : (
            <div className="flex flex-wrap gap-2" data-testid="mk-ai-album-grid">
              {visibleAiAlbum.map((a) => (
                <div key={a.path} className={`relative w-24 rounded-lg border overflow-hidden ${a.disabled ? 'opacity-50 border-brand-border' : 'border-brand-border'}`} data-testid={`mk-ai-item-${a.name}`}>
                  <img src={a.url} alt={a.name} className="w-full h-20 object-cover" />
                  <div className="flex text-[9px] leading-none">
                    <button type="button" className="flex-1 bg-brand-primary text-white py-1" onClick={() => pickAiImage(a.url)} data-testid={`mk-ai-pick-${a.name}`} title="ใช้รูปนี้เป็นภาพโพสต์">ใช้</button>
                    <button type="button" className="flex-1 bg-amber-500 text-white py-1" onClick={() => void toggleAiImage(a)} data-testid={`mk-ai-toggle-${a.name}`} title={a.disabled ? 'เปิดใช้งานรูปนี้อีกครั้ง' : 'ปิดรูปนี้ — ไม่ให้ระบบนำไปใช้'}>{a.disabled ? 'เปิด' : 'ปิด'}</button>
                    <button type="button" className="flex-1 bg-red-500 text-white py-1" onClick={() => void deleteAiImage(a)} data-testid={`mk-ai-del-${a.name}`} title="ลบรูปนี้ออกจากอัลบั้ม (ลบไฟล์จริง)">ลบ</button>
                  </div>
                  {(a.kind === 'promo' || a.kind === 'festival') && !a.disabled && (
                    <button type="button" className={`w-full text-[9px] py-1 ${floatingAdImage === a.url ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'}`} onClick={() => void toggleFloatingAd(a.url)} data-testid={`mk-ai-floatad-${a.name}`} title="ใช้รูปนี้เป็นโฆษณาลอย (แทนมาสคอต) — กดอีกครั้งเพื่อเลิกใช้">{floatingAdImage === a.url ? '✓ เป็นโฆษณาลอย' : '📌 ตั้งเป็นโฆษณาลอย'}</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PostForm merged inline */}
      <div className="mt-4 pt-3 border-t border-brand-border" data-testid="mk-studio-merged">
        <PostForm
          ref={postFormRef}
          title={postTitle}
          setTitle={setPostTitle}
          bodyText={postBodyText}
          setBodyText={setPostBodyText}
          contentType={postContentType}
          setContentType={setPostContentType}
          images={postImages}
          setImages={setPostImages}
          saving={postSaving}
          onSubmit={onCreatePost}
        />
      </div>
    </div>
  )
}