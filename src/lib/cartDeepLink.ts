// ============================================
// Bite Me Baby — Cart deep-link (?cart=) — R27 (Owner 2026-10-30)
// ============================================
// ลิงก์ที่ AI โซเชียลแนบเมื่อสรุปออเดอร์ (คอมเมนต์/ข้อความ):
//   https://biteme-baby.com/shop?cart=<b64url(JSON {v:1,items:[{id,q}]})>
// เปิดหน้าเว็บ → Layout เติมรายการลงตะกร้า → เช็คเอาท์ต่อหรือเพิ่มเมนูเองได้
// - mirror ของ encodeCartParam ใน
//   supabase/functions/_shared/socialOrderIntake.ts (round-trip test คุมทั้งคู่)
// - ไม่มีราคา/ข้อมูลส่วนตัวในลิงก์ — ราคา server ยึดใหม่ตอนสร้างออเดอร์เสมอ
// ============================================

export const CART_PARAM_MAX_ITEMS = 30
export const CART_PARAM_MAX_QTY = 50

export interface CartDeepItem {
  id: string
  q: number
}

export interface CartDeepItemV2 {
  id: string
  q: number
  /** customizations เดิมของบรรทัดตะกร้า (addOns) — ไม่มีราคา/PII */
  mods?: Record<string, any>
  /** line_mode: 1 = PRE_ORDER, 0/undefined = SAME_DAY */
  lm?: 0 | 1
}

function toB64Url(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const bin = atob(padded + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** ฝังรายการเป็นพารามิเตอร์ URL (รายการว่าง = คืน '') — v1: ใช้ฝั่ง server/social (mirror socialOrderIntake) */
export function encodeCartParam(items: Array<{ id: string; q: number }>): string {
  const clean = items
    .filter((i) => i && typeof i.id === 'string' && i.id.length > 0)
    .slice(0, CART_PARAM_MAX_ITEMS)
    .map((i) => ({ id: i.id, q: Math.max(1, Math.min(CART_PARAM_MAX_QTY, Math.trunc(Number(i.q)) || 1)) }))
  if (clean.length === 0) return ''
  return toB64Url(JSON.stringify({ v: 1, items: clean }))
}

/** v2: เข้ารหัสตะกร้าสดจาก cartStore (พา mods + lm) — pure, ไม่มี I/O
 *  caps: 30 items, 50 qty/item, payload b64url ≤ 1800 chars
 *  เกิน → ตัด mods ก่อน (droppedMods) แล้วค่อยตัดบรรทัด (truncated)
 */
export interface LiveCartEncodeResult {
  encoded: string
  droppedMods: boolean
  truncated: boolean
}

const LIVE_CART_MAX_PAYLOAD_CHARS = 1800

function tryEncodeV2(items: Array<{ id: string; q: number; mods?: Record<string, any>; lm?: 0 | 1 }>): string {
  const clean = items
    .filter((i) => i && typeof i.id === 'string' && i.id.length > 0)
    .slice(0, CART_PARAM_MAX_ITEMS)
    .map((i) => ({
      id: i.id,
      q: Math.max(1, Math.min(CART_PARAM_MAX_QTY, Math.trunc(Number(i.q)) || 1)),
      ...(i.mods && Object.keys(i.mods).length > 0 ? { mods: i.mods } : {}),
      ...(i.lm === 1 ? { lm: 1 } : {}),
    }))
  if (clean.length === 0) return ''
  return toB64Url(JSON.stringify({ v: 2, items: clean }))
}

export function encodeLiveCartParam(
  lines: Array<{ id: string; quantity: number; customizations?: Record<string, any>; line_mode?: 'SAME_DAY' | 'PRE_ORDER' }>,
): LiveCartEncodeResult {
  const baseItems = lines
    .filter((l) => l && typeof l.id === 'string' && l.id.length > 0)
    .map((l): { id: string; q: number; mods?: Record<string, any>; lm?: 0 | 1 } => ({
      id: l.id,
      q: Math.max(1, Math.min(CART_PARAM_MAX_QTY, Math.trunc(Number(l.quantity)) || 1)),
      mods: l.customizations && Object.keys(l.customizations).length > 0 ? l.customizations : undefined,
      lm: l.line_mode === 'PRE_ORDER' ? 1 : undefined,
    }))

  // ลอง encode ครั้งแรก (เต็ม mods)
  let enc = tryEncodeV2(baseItems)
  let droppedMods = false
  let truncated = false

  // ถ้า payload ใหญ่เกิน → ตัด mods ออกทั้งหมด แล้ว encode ใหม่
  if (enc.length > LIVE_CART_MAX_PAYLOAD_CHARS) {
    droppedMods = true
    const noModsItems = baseItems.map(({ mods, ...rest }) => rest)
    enc = tryEncodeV2(noModsItems)
  }

  // ถ้ายังเกิน → ตัดบรรทัดทีละอันจากท้าย (เก็บบรรทัดแรกสุด 30 อยู่แล้ว แต่ double-check)
  while (enc.length > LIVE_CART_MAX_PAYLOAD_CHARS && baseItems.length > 1) {
    truncated = true
    baseItems.pop()
    enc = tryEncodeV2(baseItems.map(({ mods, ...rest }) => rest))
  }

  return { encoded: enc, droppedMods, truncated }
}

/** ถอดพารามิเตอร์ → รายการที่ validate แล้ว (รองรับ v1 และ v2)
 *  v1: {id, q} — เดิม
 *  v2: {id, q, mods?, lm?} — mods = customizations (addOns), lm = 1:PRE_ORDER/0:SAME_DAY
 *  ผิดรูป/บูม = null — ห้ามเดาของเอง
 */
export function decodeCartParam(raw: string | null | undefined): (CartDeepItem | CartDeepItemV2)[] | null {
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(fromB64Url(raw)) as { v?: unknown; items?: unknown }
    if (!parsed || !Array.isArray(parsed.items)) return null
    const version = Number(parsed.v)
    if (version !== 1 && version !== 2) return null
    const out: (CartDeepItem | CartDeepItemV2)[] = []
    for (const it of parsed.items as unknown[]) {
      if (out.length >= CART_PARAM_MAX_ITEMS) break
      if (!it || typeof it !== 'object') return null
      const id = (it as { id?: unknown }).id
      const q = Number((it as { q?: unknown }).q)
      if (typeof id !== 'string' || !id || !Number.isFinite(q)) return null
      const cleanQ = Math.max(1, Math.min(CART_PARAM_MAX_QTY, Math.trunc(q) || 1))
      if (version === 1) {
        out.push({ id, q: cleanQ })
      } else {
        const mods = (it as { mods?: unknown }).mods
        const lm = (it as { lm?: unknown }).lm
        out.push({
          id,
          q: cleanQ,
          ...(mods && typeof mods === 'object' && mods !== null ? { mods: mods as Record<string, any> } : {}),
          ...(lm === 1 ? { lm: 1 as const } : {}),
        })
      }
    }
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

/**
 * R101-fix (Owner 2026-11-15 · A-4 live FAIL "คัดลอกลิงก์จากปุ่มสีส้ม → Chrome ไม่มีตะกร้า
 * แต่ใน WebView ของเฟซมีสินค้า"): WebView decode/restore ผ่านทั้งคู่ = decode ถูกแล้ว —
 * ค่า `?cart=` (b64url: A-Za-z0-9_-) ที่ปกติปลอดภัยใน URL อาจ **ถูก re-encode มั่ว**
 * ระหว่าง copy/paste ข้าม WebView→address bar (`%2D` → `%252D` double-encode)
 * → helper นี้ถอดชั้น `%` พิเศษได้ best-effort (ค่าปกติไม่มี `%` = ไม่ถูกแตะเลย)
 * คืนรายการ + raw ที่ "สะอาด" (เก็บต่อเป็น snapshot/คัดลอกได้)
 * รองรับ v1 และ v2
 */
export function normalizeCartParam(
  raw: string | null | undefined,
): { items: (CartDeepItem | CartDeepItemV2)[]; raw: string } | null {
  if (!raw || typeof raw !== 'string') return null
  const direct = decodeCartParam(raw)
  if (direct) return { items: direct, raw }
  // ถอด % ได้หลายชั้น (re-encode ซ้ำ = %252D double-encode) — จำกัด 3 ชั้นกันวน
  let cur = raw
  for (let i = 0; i < 3 && cur.includes('%'); i++) {
    try {
      const dec = decodeURIComponent(cur)
      if (dec === cur) break
      const items = decodeCartParam(dec)
      if (items) return { items, raw: dec }
      cur = dec
    } catch { /* ไม่ใช่ encoded ที่ถอดได้ = null ตามเดิม */ break }
  }
  return null
}

/** สร้าง URL เต็มของร้าน (Origin ฝั่งโซเชียลเขียนตายตัว = biteme-baby.com) */
export function cartShareUrl(items: Array<{ id: string; q: number }>, origin = 'https://biteme-baby.com'): string {
  const enc = encodeCartParam(items)
  return enc ? `${origin}/shop?cart=${enc}` : `${origin}/shop`
}

/** ดึงค่า `cart` จาก query string เต็ม (`?cart=...`)
 *  ⚠️ R61: ถ้าได้ "ค่า" มาแล้ว (เช่น `searchParams.get('cart')`) ต้องใช้ `decodeCartParam(value)` ตรง ๆ —
 *  ห้ามส่งค่าเปล่า ๆ เข้าฟังก์ชันนี้ (มันจะทำ `?`+value แล้วหาคีย์ `cart` ไม่เจอ = null เสมอ) */
export function readCartParam(search: string): (CartDeepItem | CartDeepItemV2)[] | null {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
    return decodeCartParam(params.get('cart'))
  } catch {
    return null
  }
}
