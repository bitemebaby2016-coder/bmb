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

/** ฝังรายการเป็นพารามิเตอร์ URL (รายการว่าง = คืน '') */
export function encodeCartParam(items: Array<{ id: string; q: number }>): string {
  const clean = items
    .filter((i) => i && typeof i.id === 'string' && i.id.length > 0)
    .slice(0, CART_PARAM_MAX_ITEMS)
    .map((i) => ({ id: i.id, q: Math.max(1, Math.min(CART_PARAM_MAX_QTY, Math.trunc(Number(i.q)) || 1)) }))
  if (clean.length === 0) return ''
  return toB64Url(JSON.stringify({ v: 1, items: clean }))
}

/** ถอดพารามิเตอร์ → รายการที่ validate แล้ว (บูม/ผิดรูป = null — ห้ามเดาของเอง) */
export function decodeCartParam(raw: string | null | undefined): CartDeepItem[] | null {
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(fromB64Url(raw)) as { v?: unknown; items?: unknown }
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items)) return null
    const out: CartDeepItem[] = []
    for (const it of parsed.items as unknown[]) {
      if (out.length >= CART_PARAM_MAX_ITEMS) break
      if (!it || typeof it !== 'object') return null
      const id = (it as { id?: unknown }).id
      const q = Number((it as { q?: unknown }).q)
      if (typeof id !== 'string' || !id || !Number.isFinite(q)) return null
      out.push({ id, q: Math.max(1, Math.min(CART_PARAM_MAX_QTY, Math.trunc(q) || 1)) })
    }
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

/** สร้าง URL เต็มของร้าน (Origin ฝั่งโซเชียลเขียนตายตัว = biteme-baby.com) */
export function cartShareUrl(items: Array<{ id: string; q: number }>, origin = 'https://biteme-baby.com'): string {
  const enc = encodeCartParam(items)
  return enc ? `${origin}/shop?cart=${enc}` : `${origin}/shop`
}

/** ดึงค่า `cart` จาก query string (/Layout ใช้ตัดค่าแล้ว strip ออกจาก address bar) */
export function readCartParam(search: string): CartDeepItem[] | null {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
    return decodeCartParam(params.get('cart'))
  } catch {
    return null
  }
}
