// ============================================
// Bite Me Baby — AI Image Studio (shared single source)
// ============================================
// รวมตรรกะเจนภาพ/ลายน้ำ/บีบขนาดที่เคยอยู่ใน AdminMarketing.tsx และ ContentTab.tsx ซ้ำกัน
// หน้าเดียวต่อค่า (platformConfigBootstrap) — ฟังก์ชันเดียวใช้ร่วมกันทั้ง 2 หน้า
// R47: ลายน้ำโลโก้จริง + มาสคอตอัตโนมัติ (หรือ `none` = ไม่วาดมาสคอต)
// IMG: เจน/เก็บสูงสุด 1024×1024 · .webp · บีบอัตโนมัติ ≤300KB · ลบต้นฉบับก่อน watermark
// ============================================

import { supabase } from '@/lib/supabase'
import { getOverrideUrl } from '@/lib/mascotService'

/** หมวดภาพที่ AI Studio เจนได้ (4 หมวด — menu ผูกกับ Floating Ad, studio ไม่ผูก) */
export type GenKind = 'menu' | 'promo' | 'festival' | 'studio'

export const KIND_PRESETS_KEYS: readonly GenKind[] = ['menu', 'promo', 'festival', 'studio']
export const AI_ALBUM_KINDS: readonly GenKind[] = ['menu', 'promo', 'festival', 'studio']

/** ขนาด/คุณภาพภาพที่เจน (IMG-1: สูงสุด 1024×1024 · webp ≤300KB) */
export const GEN_MAX_SIDE = 1024
export const GEN_MAX_BYTES = 300 * 1024
export const GEN_QUALITY = 0.82

/** ขนาดกรอบเมนูที่ใช้ได้จริง = 1:1 หรือ 4:3 (tolerance 12%) · ความละเอียดขั้นต่ำ 512px */
export const MENU_ASPECTS = [1, 4 / 3, 3 / 4]

export type GenQa = { ok: boolean; warn?: string; w: number; h: number }

/** R55: ตรวจคุณภาพภาพเจนก่อนใช้ — เบี้ยว/ขนาดไม่ตรง = ห้ามใช้แทนอัตโนมัติ */
export async function checkGenQuality(url: string, kind: string): Promise<GenQa> {
  try {
    const res = await fetch(url)
    if (!res.ok) return { ok: true, w: 0, h: 0 }
    const bmp = await createImageBitmap(await res.blob())
    const w = bmp.width
    const h = bmp.height
    bmp.close?.()
    if (Math.min(w, h) < 512) return { ok: false, w, h, warn: `ความละเอียด ${w}×${h} ต่ำเกินไป` }
    if (kind === 'menu' || kind === 'studio') {
      const ar = w / h
      const fits = MENU_ASPECTS.some((t) => Math.abs(ar - t) / t <= 0.12)
      if (!fits) return { ok: false, w, h, warn: `สัดส่วน ${w}×${h} ไม่ตรงกรอบเมนู (1:1 หรือ 4:3) — เบี้ยว/ขนาดไม่ตรง` }
    }
    return { ok: true, w, h }
  } catch {
    return { ok: true, w: 0, h: 0 }
  }
}

/** เลือกมาสคอตลายน้ำอัตโนมัติตามประเภทภาพ */
export function autoMascotForKind(kind: string): string {
  if (kind === 'menu' || kind === 'studio') return 'menu'
  if (kind === 'festival') return 'award'
  return 'recommend'
}

/** R58: เลือกภาพเจน "ด้านการตลาด/โปรโมชั่น (ไม่ใช่รูปเมนู)" จาก image_urls/URL เดียว */
export function pickMarketingAiImage(images: unknown): string {
  const list = Array.isArray(images)
    ? images
    : typeof images === 'string' && images.trim()
      ? [images]
      : []
  const ok = list.filter((u): u is string =>
    typeof u === 'string' &&
    u.includes('/ai-generated/') &&
    !u.includes('/ai-generated/menu/') &&
    !u.includes('/_disabled/'),
  )
  return ok[ok.length - 1] || ''
}

/** มาสคอตสำหรับลายน้ำ — `none` = ไม่วาดมาสคอต */
export const WM_MASCOTS: Array<{ key: string; label: string }> = [
  { key: 'auto', label: '🤖 อัตโนมัติ (เลือกตามประเภทภาพ — จำไว้ใช้ทุกครั้ง)' },
  { key: 'none', label: '🚫 ไม่ใช้มาสคอต' },
  { key: 'bite_recommend', label: '👉 น้อง Bite แนะนำ' },
  { key: 'bite_menu', label: '🍽️ น้อง Bite นำเสนอเมนู' },
  { key: 'bite_eating', label: '😋 น้อง Bite ทานของอร่อย' },
  { key: 'bite_cooking', label: '👨‍🍳 น้อง Bite ทีมครัว' },
  { key: 'bite_award', label: '🏆 น้อง Bite ฉลองรางวัล' },
]

export async function fetchBitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await createImageBitmap(await res.blob())
  } catch { return null }
}

/** บีบภาพเจนให้เป็น .webp สูงสุด 1024px และ ≤300KB (ไม่ upscale เกิน 1024) */
export async function compressGeneratedToWeb(
  file: File,
  maxSide: number = GEN_MAX_SIDE,
  maxBytes: number = GEN_MAX_BYTES,
): Promise<File> {
  if (file.type.startsWith('audio/') || file.type.startsWith('video/')) return file
  if (file.type === 'image/gif') return file
  let bmp: ImageBitmap | null = null
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch { bmp = null }
  if (!bmp) return file
  try {
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bmp, 0, 0, w, h)
    const enc = (q: number, cw = w, ch = h): Promise<Blob | null> =>
      new Promise((resolve) => {
        if (cw !== w || ch !== h) {
          canvas.width = cw
          canvas.height = ch
          ctx.drawImage(bmp as ImageBitmap, 0, 0, cw, ch)
        }
        canvas.toBlob((b) => resolve(b), 'image/webp', q)
      })
    let quality = GEN_QUALITY
    let blob = await enc(quality)
    while (blob && blob.size > maxBytes && quality > 0.4) {
      quality -= 0.15
      blob = await enc(quality)
    }
    // ยังใหญ่ → ย่อสัดส่วนต่อ 75% แล้วบีบซ้ำ (ไม่เกิน 1024)
    if (blob && blob.size > maxBytes) {
      const w2 = Math.max(1, Math.round(w * 0.75))
      const h2 = Math.max(1, Math.round(h * 0.75))
      blob = await enc(0.6, w2, h2)
      if (blob && blob.size > maxBytes) blob = await enc(0.45, Math.round(w * 0.6), Math.round(h * 0.6))
    }
    if (!blob || blob.size > maxBytes) return file
    const base = file.name.replace(/\.[^.]+$/, '') || 'img'
    return new File([blob], `${base}-web.webp`, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    return file
  } finally {
    bmp.close?.()
  }
}

/** R47: ประกบลายน้ำแบรนด์ (โลโก้จริง + มาสคอต; mascotChoice='none' = ไม่วาดมาสคอต) → อัปไฟล์ webp ลงโฟลเดอร์หมวด */
export async function applyBrandWatermark(srcUrl: string, kind: string, mascotChoice: string): Promise<string> {
  try {
    const mascotKey = mascotChoice === 'auto' ? autoMascotForKind(kind) : mascotChoice
    const mascotUrl = mascotChoice === 'none' ? '' : getOverrideUrl(mascotKey)
    const [img, logo, mascot] = await Promise.all([
      fetchBitmap(srcUrl),
      fetchBitmap('/Logo_Sticker_Circle.webp'),
      mascotUrl ? fetchBitmap(mascotUrl) : Promise.resolve(null),
    ])
    if (!img) return srcUrl
    const w = img.width, h = img.height
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return srcUrl
    ctx.drawImage(img, 0, 0)
    const minSide = Math.min(w, h)
    const pad = Math.round(minSide * 0.03)
    const pillH = Math.round(minSide * 0.13)
    const pillW = Math.round(pillH * 4.6)
    const px = w - pad - pillW
    const py = h - pad - pillH
    ctx.save()
    ctx.globalAlpha = 0.88
    ctx.fillStyle = '#FFFFFF'
    if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === 'function') {
      ctx.beginPath()
      ;(ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(px, py, pillW, pillH, pillH / 2)
      ctx.fill()
    } else {
      ctx.fillRect(px, py, pillW, pillH)
    }
    ctx.globalAlpha = 1
    const logoSize = Math.round(pillH * 0.78)
    if (logo) ctx.drawImage(logo, px + pillH * 0.11, py + (pillH - logoSize) / 2, logoSize, logoSize)
    ctx.fillStyle = '#92400E'
    ctx.font = `bold ${Math.round(pillH * 0.42)}px Quicksand, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText('Bite Me Baby', px + logoSize + pillH * 0.3, py + pillH * 0.54)
    if (mascot) {
      const mH = Math.round(pillH * 1.7)
      const mW = Math.round(mascot.width * (mH / mascot.height))
      ctx.drawImage(mascot, px + pillW - mW - pillH * 0.15, py - mH + pillH * 0.35, mW, mH)
    }
    ctx.restore()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (!blob) return srcUrl
    const wmFile = new File([blob], `wm-${Date.now().toString(36)}.png`, { type: 'image/png', lastModified: Date.now() })
    const sized = await compressGeneratedToWeb(wmFile)
    const safeKind = (KIND_PRESETS_KEYS as readonly string[]).includes(kind) ? kind : 'menu'
    const path = `ai-generated/${safeKind}/wm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}${sized.name.endsWith('.jpg') ? '.jpg' : '.webp'}`
    const { error } = await supabase.storage.from('bmb-images').upload(path, sized, { contentType: sized.type, upsert: false })
    if (error) return srcUrl
    return supabase.storage.from('bmb-images').getPublicUrl(path).data.publicUrl
  } catch {
    return srcUrl
  }
}