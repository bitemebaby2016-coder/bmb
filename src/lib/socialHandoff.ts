// ============================================
// Bite Me Baby — Social Handoff Context (R91 · Owner 2026-11-11)
// ============================================
// "บริบทจากเฟซบุ๊กต้องต่อเข้า Bite AI ของเว็บให้เหมือนกันและต่อเนื่อง"
//
// หลักการ: ลูกค้าคุยกับ Bite บน Facebook/Messenger → AI แนบลิงก์ /shop?cart=...
// → ลูกค้ากดเข้าเว็บ → Layout เติมตะกร้า และ **บันทึกว่าลูกค้ามาจากโซเชียล**
// (sessionStorage, จบแท็บแล้วล้าง) → TalkToBite รวมบริบทนี้เข้า runtimeContext
// ทุกข้อความ = Bite บนเว็บรู้รายการที่คุย/สรุปไว้ก่อนหน้า ต่อสนทนาทันที ไม่ถามซ้ำ
//
// สุจริตข้อมูล: เก็บเฉพาะ id/จำนวนที่มากับลิงก์ (เดียวกับ ?cart= — ไม่มีราคา/PII)
// ชื่อเมนูแสดงเมื่อ match กับ cart store จริงเท่านั้น (ห้ามมโนชื่อ)
// ============================================

export const SOCIAL_HANDOFF_KEY = 'bmb:social-handoff'

export type SocialSource = 'facebook' | 'messenger' | 'other'

export interface SocialHandoff {
  source: 'facebook' | 'messenger'
  ids: Array<{ id: string; q: number }>
  at: number
}

/** Pure — จำแนกแหล่งที่มา จาก referrer + UA ผสมกัน (FB/Messenger in-app → web)
 *  Messenger UA มี token `FB_IAB/MESSENGER`; แอปเฟซธรรมดาเป็น FBAN/FBAV */
export function detectSocialSource(referrer: string): SocialSource {
  const r = (referrer || '').toLowerCase()
  // ลำดับสำคัญ: ตรวจ messenger ก่อน — UA Messenger มีทั้ง FBAV/FB_IAB และ MESSENGER
  if (r.includes('messenger') || r.includes('fb.me')) return 'messenger'
  if (r.includes('facebook') || r.includes('fb.com') || r.includes('fb4a') || r.includes('fb_iab') || r.includes('fban') || r.includes('fbav')) return 'facebook'
  return 'other'
}

/** บันทึก handoff (เฉพาะเมื่อมาจากโซเชียล) — storage พัง = เงียบ ไม่บล็อก flow */
export function saveSocialHandoff(source: SocialSource, ids: Array<{ id: string; q: number }>): void {
  if (source === 'other' || ids.length === 0) return
  try {
    sessionStorage.setItem(SOCIAL_HANDOFF_KEY, JSON.stringify({ source, ids, at: Date.now() } satisfies SocialHandoff))
  } catch { /* บล็อก/โหมดส่วนตั — ไม่มี handoff = AI ใช้บริบทปกติ */ }
}

export function readSocialHandoff(): SocialHandoff | null {
  try {
    const raw = sessionStorage.getItem(SOCIAL_HANDOFF_KEY)
    if (!raw) return null
    const h = JSON.parse(raw) as SocialHandoff
    if (!h || (h.source !== 'facebook' && h.source !== 'messenger') || !Array.isArray(h.ids)) return null
    return h
  } catch {
    return null
  }
}

/**
 * Pure — สร้างประโยคบริบทต่อสนทนาให้ TalkToBite ยัดเข้า runtimeContext
 * `cartItems` = ของจริงจาก cart store (Layout เติมไว้จากลิงก์เดียวกัน) — ใช้ยืนยันชื่อเมนู
 * คืน '' เมื่อไม่มี handoff (บริบทเว็บปกติ ไม่ inject อะไรเลย)
 */
export function buildSocialHandoffContext(
  cartItems: Array<{ product: { id: string; name: string }; quantity: number }>,
  handoff: SocialHandoff | null = readSocialHandoff(),
): string {
  if (!handoff) return ''
  const label = handoff.source === 'messenger' ? 'Messenger' : 'Facebook'
  const names = handoff.ids
    .map((h) => {
      const match = cartItems.find((c) => c.product.id === h.id)
      if (!match) return null
      const q = h.q > 1 ? h.q : match.quantity
      return `${match.product.name} x${q}`
    })
    .filter((n): n is string => !!n)
  const itemLine = names.length > 0 ? `รายการที่สรุปคุยกันไว้: ${names.join(', ')} (อยู่ในตะกร้าแล้ว)` : 'ลูกค้าตามลิงก์สรุปตะกร้าที่ระบบส่งไว้ในแชทเข้ามา'
  return [
    `ต้นทาง: ลูกค้าเพิ่งคุยกับ Bite บน${label} แล้วกดลิงก์ต่อเข้าเว็บ`,
    itemLine,
    `ให้ต่อบทสนทนาจาก${label}ทันที (เช่น "ต่อจากที่คุยกันใน${label}นะครับ") — ห้ามทำเหมือนเพิ่งคุยกันครั้งแรก`,
    'ห้ามถามเมนู/จำนวนที่สรุปแล้วซ้ำ · ชวนตรวจรายการในตะกร้าและชำระเงินต่อได้เลย',
  ].join(' | ')
}
