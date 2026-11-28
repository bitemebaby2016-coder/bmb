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

/** IMG: มาตรฐานภาพเมนู (Studio) หลังลบพื้นหลัง — canvas 1024×1024 + margin เท่ากัน · webp โปร่งใส ≤500KB */
export const STUDIO_PAD_SIZE = 1024
export const STUDIO_MARGIN_RATIO = 0.06 // margin รอบด้านละ 6% ของ canvas
export const ALPHA_WEBP_QUALITY = 0.85 // ~alphaQuality 90 (Canvas ไม่มี alphaQuality แยก → ใช้ quality เดียว)
export const ALPHA_WEBP_MAX_BYTES = 500 * 1024

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
  // กฎใหม่ (Owner): ถ้าไม่ใช้มาสคอต = ต้องไม่ใช้ทั้งมาสคอตและลายน้ำ (คืนภาพเดิม ไม่วาดโลโก้/ข้อความ)
  if (mascotChoice === 'none') return srcUrl
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

// ============================================
// IMG: Studio (เมนูอาหาร) — JSON payload + post-processing (ลบพื้นหลัง → trim → resize/pad → webp โปร่งใส)
// ============================================

/** JSON payload มาตรฐานสำหรับสร้างภาพเมนู — ดึงจาก subject/note แล้วจับคู่ texture ตามหมวดอาหาร */
export interface StudioPayload {
  menu_name: string
  category: string
  container_type: string
  texture_keywords: string[]
}

/** ตารางจับคู่หมวดอาหาร → container + texture keywords (ห้ามตีความว่าเป็นร้านขนมหวาน — ดูจากชื่อเมนู) */
const TEXTURE_BY_CATEGORY: Array<{ re: RegExp; category: string; container: string; textures: string[] }> = [
  { re: /ทอด|กรอบ|เฟรนช์ฟราย|tempura|fried|crispy|katsu|หมูทอด|ไก่ทอด|ปีกไก่|นักเก็ต/i, category: 'ของทอด', container: 'จานกระเบื้อง/ตะกร้าสแตนเลส', textures: ['crispy golden crust', 'crunchy texture', 'freshly fried', 'steam rising'] },
  { re: /เย็น|น้ำแข็ง|สมูทตี้|บิงซู|ชาไทย|กาแฟเย็น|โกโก้เย็น|cold|iced|smoothie|shake|มะม่วง|ทับทิม/i, category: 'เครื่องดื่มเย็น', container: 'แก้วใสมีหลอด/ฝาปิด', textures: ['frosty condensation', 'refreshing', 'ice cubes', 'condensation droplets'] },
  { re: /เบเกอรี่|ขนมปัง|เค้ก|ครัวซองต์|บิสกิต|คุกกี้|แดริ|พาย|bread|cake|croissant|cookie|bakery|pie|muffin/i, category: 'เบเกอรี่', container: 'จานพาสเทล/กระดาษไขมัน', textures: ['flaky buttery layers', 'soft crumb', 'golden baked crust', 'delicate glaze'] },
  { re: /สลัด|ผักสด|ผลไม้สด|salad|greens|fresh herbs|ผัก/i, category: 'สลัด', container: 'ชามพาสเทล/จานไม้', textures: ['fresh crisp greens', 'vibrant colors', 'dewy freshness', 'light dressing sheen'] },
  { re: /ข้าว|ผัด|ราด|ข้าวมัน|ข้าวผัด|ข้าวหน้า|rice|nasi|กะหล่ำ|หมูกรอบ/i, category: 'ข้าวหน้าต่างๆ', container: 'จานร้อน/ชามกระเบื้อง', textures: ['fluffy steamed rice', 'glossy sauce', 'gentle steam', 'savory glaze'] },
]

/** สร้าง StudioPayload จาก subject (ชื่อเมนู) + note — จับคู่หมวด/คอนเทนเนอร์/texture อัตโนมัติ */
export function buildStudioPayload(subject: string, note = ''): StudioPayload {
  const menu_name = subject.trim()
  const hay = `${menu_name} ${note}`.trim()
  const hit = TEXTURE_BY_CATEGORY.find((c) => c.re.test(hay))
  if (hit) return { menu_name, category: hit.category, container_type: hit.container, texture_keywords: hit.textures }
  return { menu_name, category: 'ทั่วไป', container_type: 'จานเดี่ยว/จานพาสเทล', texture_keywords: ['appetizing', 'fresh', 'detailed', 'studio lit'] }
}

/** ลบไฟล์จริงบนคลัง bmb-images จาก public URL (ignore ถ้าไม่ใช่คลังเรา/ลบไม่สำเร็จ) */
export async function removeGeneratedByUrl(url: string): Promise<void> {
  try {
    const marker = '/object/public/bmb-images/'
    if (!url || !url.includes(marker)) return
    const p = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length).split('?')[0])
    await supabase.storage.from('bmb-images').remove([p])
  } catch { /* ลบไม่ได้ = ไม่เป็นไร (มีปุ่มลบในอัลบั้มอยู่แล้ว) */ }
}

/** ตัดขอบโปร่งใสส่วนเกินรอบอาหาร (trim) — หา alpha bbox แล้ว crop ให้แน่นที่สุด */
export async function trimTransparent(src: ImageBitmap, alphaThreshold = 8): Promise<ImageBitmap> {
  const w = src.width, h = src.height
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return src
  ctx.drawImage(src, 0, 0)
  let data: ImageData
  try { data = ctx.getImageData(0, 0, w, h) } catch { return src }
  const px = data.data
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return src // โปร่งใสทั้งหมด = คงภาพเดิม
  const cw = maxX - minX + 1, ch = maxY - minY + 1
  if (cw === w && ch === h) return src
  const out = document.createElement('canvas')
  out.width = cw; out.height = ch
  const octx = out.getContext('2d')
  if (!octx) return src
  octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch)
  return await createImageBitmap(out)
}

/** จัดกึ่งกลางบน canvas ใส่ (โปร่งใส) ขนาดมาตรฐาน + margin เท่ากันรอบ 4 ด้าน (คงสัดส่วน ไม่บิด) */
export async function resizeAndPad(src: ImageBitmap, size = STUDIO_PAD_SIZE, marginRatio = STUDIO_MARGIN_RATIO): Promise<ImageBitmap> {
  const inner = Math.max(1, Math.round(size * (1 - marginRatio * 2)))
  const scale = inner / Math.max(src.width, src.height)
  const dw = Math.max(1, Math.round(src.width * scale))
  const dh = Math.max(1, Math.round(src.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.clearRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh)
  return await createImageBitmap(canvas)
}

/** แปลงเป็น webp โปร่งใส (quality เริ่ม 0.85 แล้วลดจนถึง ≤ maxBytes) — คืน File พร้อม alpha */
export async function toAlphaWebp(src: ImageBitmap, maxBytes = ALPHA_WEBP_MAX_BYTES, quality = ALPHA_WEBP_QUALITY): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = src.width; canvas.height = src.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.drawImage(src, 0, 0)
  const enc = (q: number): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/webp', q))
  let q = quality
  let blob = await enc(q)
  while (blob && blob.size > maxBytes && q > 0.4) {
    q -= 0.1
    blob = await enc(q)
  }
  if (!blob) throw new Error('encode_failed')
  return new File([blob], `studio-${Date.now().toString(36)}.webp`, { type: 'image/webp', lastModified: Date.now() })
}

/** Post-process ภาพพื้นหลังโปร่งใสจาก BEN2: trim → resize/pad 1024 → webp โปร่งใส → อัปโหลดทับโฟลเดอร์ studio */
export async function finalizeStudioImage(transparentUrl: string): Promise<string> {
  const bmp = await fetchBitmap(transparentUrl)
  if (!bmp) return transparentUrl
  try {
    const trimmed = await trimTransparent(bmp)
    const padded = await resizeAndPad(trimmed)
    const file = await toAlphaWebp(padded)
    const path = `ai-generated/studio/studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.webp`
    const { error } = await supabase.storage.from('bmb-images').upload(path, file, { contentType: file.type, upsert: false })
    if (error) return transparentUrl
    return supabase.storage.from('bmb-images').getPublicUrl(path).data.publicUrl
  } finally {
    bmp.close?.()
  }
}