// ============================================
// Bite Me Baby — Talk to Bite: pure logic helpers
// ============================================
// Pure, deterministic helpers that drive the unified "Talk to Bite" AI-Waiter
// experience WITHOUT touching business state. They only translate real data
// (catalog rows, a customer's real order) into presentation drafts. The actual
// cart mutation funnels through the canonical `cartStore.addItem` path — this
// module holds no write authority (mirror of the EXECUTE_ADD_TO_CART boundary).
// ============================================

import type { Product, MascotPose } from '@/types'

// ---------------------------------------------------------------------------
// Bite state system (unified — one source of truth across Homepage, Floating
// Bite and the Conversation UI). Maps to the mascot poses already shipped.
// ---------------------------------------------------------------------------

export const BITE_STATES = [
  'WELCOME',
  'IDLE',
  'LISTENING',
  'THINKING',
  'SPEAKING',
  'RECOMMENDING',
  'ORDER_DRAFT',
  'ORDER_CONFIRM',
  'SUCCESS',
  'ERROR',
  'GOODBYE',
] as const

export type BiteState = (typeof BITE_STATES)[number]

export function isBiteState(v: unknown): v is BiteState {
  return typeof v === 'string' && (BITE_STATES as readonly string[]).includes(v)
}

/** Thai status label shown in the Talk-to-Bite header (drives subtitle text). */
export function chatStatusLabel(state: BiteState): string {
  switch (state) {
    case 'WELCOME':
      return 'ยินดีต้อนรับครับ'
    case 'LISTENING':
      return 'กำลังฟัง... พูดได้เลยครับ'
    case 'THINKING':
      return 'กำลังคิดให้ครับ'
    case 'SPEAKING':
      return 'กำลังพูด...'
    case 'RECOMMENDING':
      return 'กำลังเลือกเมนูจากของจริงวันนี้ครับ'
    case 'ORDER_DRAFT':
      return 'นี่คือรายการที่จะสั่ง ตรวจทานก่อนได้ครับ'
    case 'ORDER_CONFIRM':
      return 'รอคุณยืนยันหลังจ่ายเงินจริงครับ'
    case 'SUCCESS':
      return 'เรียบร้อยครับ'
    case 'ERROR':
      return 'ขอโทษด้วยครับ เกิดข้อผิดพลาด'
    case 'GOODBYE':
      return 'ขอบคุณครับ ไว้เจอกันใหม่'
    default:
      return 'พร้อมช่วยคุณแล้วครับ'
  }
}

/** Map a Bite state to the closest shipped mascot pose (assets reuse — no new art). */
export function bitePoseForState(state: BiteState): MascotPose {
  switch (state) {
    case 'LISTENING':
      return 'waiting'
    case 'THINKING':
    case 'RECOMMENDING':
      return 'thinking'
    case 'SPEAKING':
      return 'recommend'
    case 'ORDER_DRAFT':
      return 'shopping'
    case 'ORDER_CONFIRM':
      return 'pointing'
    case 'SUCCESS':
      return 'success'
    case 'ERROR':
      return 'sad'
    case 'GOODBYE':
      return 'bye'
    case 'WELCOME':
    case 'IDLE':
    default:
      return 'ready'
  }
}

// ---------------------------------------------------------------------------
// Menu recommendation — pick from REAL, available catalog rows deterministically.
// ---------------------------------------------------------------------------

/**
 * Pick up to `count` sellable products from the real catalog deterministically.
 * Featured products sort first; ties break on localeCompare(name) so the result
 * is stable for tests and identical across renders. Never fabricates a dish.
 */
// Canonical eligibility — BMB_SAME_DAY_PRE_ORDER_REGRESSION_MATRIX.md §3.1 (OD-3 / OD-5):
//   sameDayEligible(p)  = p.available_same_day  ?? !p.is_preorder
//   preorderEligible(p) = p.available_preorder ??  p.is_preorder
export function sameDayEligible(p: Product): boolean {
  return p.available_same_day ?? !p.is_preorder
}

export function preorderEligible(p: Product): boolean {
  return p.available_preorder ?? p.is_preorder
}

/** 'SAME_DAY' | 'PRE_ORDER' ตามสิทธิ์จริง · `null` = ไม่มีสิทธิ์ทั้งสองโหมด → ห้าม offer ในพื้นที่สั่งซื้อ (OD-3) */
export function deriveOrderMode(p: Product): 'SAME_DAY' | 'PRE_ORDER' | null {
  if (preorderEligible(p) && !sameDayEligible(p)) return 'PRE_ORDER'
  if (sameDayEligible(p)) return 'SAME_DAY'
  return null
}

export function pickTopAvailable(products: Product[], count = 3): Product[] {
  // Phase 1 (RC-2 / OD-3 / OD-5): ไม่ใช่แค่กรอง — ต้องมีสิทธิ์อย่างน้อยหนึ่งโหมดด้วย
  // — สินค้าไร้สิทธิ์ทั้งสองโหมดจะถูก server reject ตอน checkout (ERR_PRODUCT_MODE_NOT_ALLOWED)
  const sellable = (products || []).filter(
    (p) => p.is_available && !p.archived && deriveOrderMode(p) !== null,
  )
  const sorted = [...sellable].sort((a, b) => {
    if (!!a.is_featured !== !!b.is_featured) return a.is_featured ? -1 : 1
    return a.name.localeCompare(b.name, 'th')
  })
  return sorted.slice(0, Math.max(0, count))
}

// ---------------------------------------------------------------------------
// Real-based trend ranking (audit gap: "Recommendation → เพิ่ม real-based
// ('คนซื้ออะไรช่วงนี้') จากออเดอร์จริง") — เรียงตามจำนวนขายจาก menu_sales_stats
// (m192 · orders จริง · ไม่มี PII/ไม่มียอดเงิน) · tie-break = featured → ชื่อ
// (pattern เดิม) · ไม่มีข้อมูลขาย = fallback pickTopAvailable (ไม่ปลอมข้อมูล)
// ---------------------------------------------------------------------------
export interface SalesStat {
  product_id: string
  sold_count: number
}

export function pickTrendingProducts(
  products: Product[],
  sales: SalesStat[] | null | undefined,
  count = 3,
): Product[] {
  if (!Array.isArray(sales) || sales.length === 0) return pickTopAvailable(products, count)
  const soldBy = new Map<string, number>()
  for (const s of sales) {
    if (!s || !s.product_id) continue
    soldBy.set(String(s.product_id), (soldBy.get(String(s.product_id)) || 0) + (Number(s.sold_count) || 0))
  }
  const sellable = (products || []).filter(
    (p) => p.is_available && !p.archived && deriveOrderMode(p) !== null,
  )
  const ranked = [...sellable].sort((a, b) => {
    const d = (soldBy.get(b.id) || 0) - (soldBy.get(a.id) || 0)
    if (d !== 0) return d
    if (!!a.is_featured !== !!b.is_featured) return a.is_featured ? -1 : 1
    return a.name.localeCompare(b.name, 'th')
  })
  return ranked.slice(0, Math.max(0, count))
}

// ---------------------------------------------------------------------------
// Order-again draft — translate a REAL past order into a cart draft using the
// CURRENT catalog (price + availability authority). No fabricated items.
// ---------------------------------------------------------------------------

export interface OrderLikeItem {
  product_id?: string
  product_name?: string
  quantity?: number
  /** Real customizations ที่บันทึกไว้ใน order_items.customizations (jsonb) ของออเดอร์จริง */
  customizations?: Record<string, any>
  /** Real note ที่ลูกค้าเคยสั่งไว้ (order_items.note) */
  note?: string
  /** Real special request ของบรรทัดเดิม (order_items.special_request) */
  special_request?: string
}

export interface OrderLike {
  items?: OrderLikeItem[]
}

export interface DraftLine {
  product: Product
  quantity: number
  /** Human-readable customization attached to this line (e.g. "ไม่เผ็ด、เพิ่มไข่"). */
  note?: string
  /** Canonical customization map persisted into order_items.customizations (jsonb). */
  customizations?: Record<string, any>
}

export interface UnavailableLine {
  name: string
  requested: number
}

export interface OrderAgainResult {
  draft: DraftLine[]
  unavailable: UnavailableLine[]
  total: number
  count: number
}

/**
 * Given one real past order and the current sellable catalog, build a draft of
 * only the items that STILL exist and are still available today. Items that are
 * gone/sold out are reported separately (never silently dropped nor invented).
 */
export function resolveOrderAgainFromOrder(
  order: OrderLike,
  catalog: Product[],
): OrderAgainResult {
  const byId = new Map<string, Product>()
  for (const p of catalog || []) {
    if (!byId.has(p.id)) byId.set(p.id, p)
  }

  const draft: DraftLine[] = []
  const unavailable: UnavailableLine[] = []
  let total = 0

  for (const item of order?.items || []) {
    const quantity = Math.max(1, Number(item?.quantity) || 1)
    const name = item?.product_name || 'รายการ'
    const product = item?.product_id ? byId.get(item.product_id) : undefined
    if (product && product.is_available && !product.archived) {
      // R73f: พก customizations/หมายเหตุ ของบรรทัดเดิมต่อเข้า draft ด้วย
      // (audit gap: "Order-again เอาเฉพาะ product+qty → ต่อ customizations เก่าเข้า draft line")
      const carriedCfg =
        item?.customizations && typeof item.customizations === 'object' && Object.keys(item.customizations).length > 0
          ? item.customizations
          : undefined
      const carriedNote = String(item?.note || item?.special_request || '').trim() || undefined
      draft.push({ product, quantity, customizations: carriedCfg, note: carriedNote })
      total += (Number(product.price) || 0) * quantity
    } else {
      unavailable.push({ name, requested: quantity })
    }
  }

  return {
    draft,
    unavailable,
    total,
    count: draft.reduce((sum, d) => sum + d.quantity, 0),
  }
}

/** Display subtotal of a draft given the current (authoritative) prices. */
export function sumDraftTotal(draft: DraftLine[]): number {
  return (draft || []).reduce((sum, d) => sum + (Number(d.product.price) || 0) * d.quantity, 0)
}

// ---------------------------------------------------------------------------
// NL order intent — understand free-text like "เอาของเมื่อวาน แต่เปลี่ยนน้ำเป็นชาเขียว".
// Deterministic + testable heuristic. Falls back to ignore (normal chat) when
// there is no clear signal; the actual cart mutation still flows through the
// canonical cart path. No AI/network here.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// NL customization flags → item note ("ไม่เผ็ด", "เพิ่มไข่", "ไม่น้ำแข็ง"…).
// These attach a human-readable note AND a canonical `customizations` map to a
// draft line. The map flows into the REAL cart item (order_items.customizations
// jsonb) via the existing canonical add path — no fake notes ever.
// ---------------------------------------------------------------------------

export interface Customizer {
  /** Canonical key persisted into customizations (extra_egg, spicy, no_ice…). */
  key: string
  value: string | boolean | string[]
  /** Human-readable Thai note shown on the draft line. */
  note: string
}

// Thai "เพิ่ม X / ไม่ X" phrases map to a plain free-text note — the literal thing
// the user asked for. No fabricated ingredient list. (Thai-word block: \u0E00-\u0E7F.)
function matchThaiWord(text: string, prefix: string): string | null {
  const m = String(text || '').match(new RegExp(`${prefix}\\s*([\\u0E00-\\u0E7F]{2,})`))
  return m ? m[1] : null
}

// ---------------------------------------------------------------------------
// Canonical customization vocabulary (audit 2026-10-07 gap: "ตาราง canonical
// keys ↔ Thai (extra_egg/spicy/mild/hot/no_ice) แบบที่ kitchenControl คาด
// {extra_egg:true, spicy:'Mild'}") — เฉพาะวลีที่มีหลักฐานค่าในระบบ (คีย์ใน
// talkToBite/kitchenControl.test + ระดับ Mild/Hot ใน audit) เท่านั้น
// วลีอื่น fallback เป็น note เท่าที่ผู้ใช้พิมพ์จริงตามเดิม (ไม่ invent)
// ---------------------------------------------------------------------------
interface VocabRule {
  re: RegExp
  key: string
  value: string | boolean
  note: string
}

// ลำดับสำคัญ: วลีเฉพาะต้องมาก่อนวลีกว้างเสมอ (เช่น "เผ็ดน้อย" ก่อน "เผ็ด")
// โดยแต่ละ rule จะ strip วลีที่จับได้ทิ้งก่อนถึง rule ถัดไป
const VOCAB_RULES: VocabRule[] = [
  { re: /เพิ่ม\s*ไข่|ไข่\s*เพิ่ม/g, key: 'extra_egg', value: true, note: 'เพิ่มไข่' },
  { re: /เผ็ด\s*น้อย|ไม่ค่อย\s*เผ็ด/g, key: 'spicy', value: 'Mild', note: 'เผ็ดน้อย' },
  { re: /ไม่\s*เผ็ด/g, key: 'spicy', value: 'None', note: 'ไม่เผ็ด' },
  { re: /เผ็ด\s*มาก|เผ็ด\s*จัด|เผ็ดๆ/g, key: 'spicy', value: 'Hot', note: 'เผ็ด' },
  { re: /ไม่\s*(?:ใส่)?\s*น้ำแข็ง/g, key: 'no_ice', value: true, note: 'ไม่น้ำแข็ง' },
  { re: /เผ็ด/g, key: 'spicy', value: 'Hot', note: 'เผ็ด' },
]

/**
 * Scan free-text Thai for "customize my dish" flags. Returns deduplicated
 * customizers (``note`` map key) in the order they appear. Each phrase is a
 * REAL request from the user (e.g. "เพิ่มไข่", "ไม่เผ็ด", "ไม่ใส่หอม") — kept
 * verbatim, never invented. Falls back to an empty list when none are present.
 */
export function extractCustomizers(text: string): Customizer[] {
  const out: Customizer[] = []
  const seen = new Set<string>()
  const push = (key: string, value: string | boolean, note: string) => {
    if (seen.has(note)) return
    seen.add(note)
    out.push({ key, value, note })
  }
  // 1) canonical vocabulary ก่อน (เฉพาะวลีที่มีตารางค่ารองรับ) — strip วลีที่จับได้ทิ้ง
  let rest = String(text || '')
  for (const rule of VOCAB_RULES) {
    rest = rest.replace(rule.re, () => {
      push(rule.key, rule.value, rule.note)
      return ' '
    })
  }
  // 2) generic fallback (เดิม): "เพิ่ม X / ไม่ใส่ X / ไม่ X" → note ตามที่ผู้ใช้พิมพ์จริง
  //    (เฉพาะก่อนกว้าง + strip ที่จับแล้ว — กัน "ไม่ใส่ X" หลุดเข้าทั้ง 2 branch = 2 โน้ต)
  const add = matchThaiWord(rest, 'เพิ่ม')
  if (add) push('note', `เพิ่ม ${add}`, `เพิ่ม ${add}`)
  rest = rest.replace(/เพิ่ม\s*[\u0E00-\u0E7F]{2,}/, ' ')
  const omit = matchThaiWord(rest, 'ไม่ใส่')
  if (omit) push('note', `ไม่ใส่ ${omit}`, `ไม่ใส่ ${omit}`)
  rest = rest.replace(/ไม่ใส่\s*[\u0E00-\u0E7F]{2,}/, ' ')
  const none = matchThaiWord(rest, 'ไม่')
  if (none) push('note', `ไม่ ${none}`, `ไม่ ${none}`)
  return out
}

/** Attach customizers to a target line (or the first line); returns a new draft. */
export function attachCustomizersToDraft(
  draft: DraftLine[],
  customizers: Customizer[],
  targetProductId?: string,
): DraftLine[] {
  if (!customizers || customizers.length === 0) return draft
  if (!draft || draft.length === 0) return draft
  if (targetProductId && !draft.some((d) => d.product.id === targetProductId)) targetProductId = undefined
  const target = (targetProductId ? draft.find((d) => d.product.id === targetProductId) : undefined) ?? draft[0]
  const cfg: Record<string, any> = { ...(target.customizations ?? {}) }
  const notes: string[] = target.note ? [target.note] : []
  for (const c of customizers) {
    // ค่าใหม่แทนที่ค่าเดิมของ key เดียวกัน (เช่น "เผ็ดน้อย" → "เผ็ด" = ระดับล่าสุดชนะ)
    // — ไม่ต่อเป็น array: level/flag ต้องมีค่าเดียวเสมอ (ค่าหลายชิ้น = มากับ c.value อยู่แล้ว)
    cfg[c.key] = c.value
    if (!notes.includes(c.note)) notes.push(c.note)
  }
  const note = notes.join('、')
  return draft.map((d) => (d === target ? { ...d, customizations: cfg, note: note || d.note } : d))
}

// ---------------------------------------------------------------------------
// Contextual in-app help (audit gap: "User Guide & Onboarding → contextual help")
// deterministic · ตอบจากเนื้อหาคู่มือ/หน้าเว็บจริงเท่านั้น (ไม่เดา) · ทำงานออฟไลน์
// ก่อน LLM เสมอ (ไม่ต้องรอ network) · คำถามนอกตาราง = ผ่านไปให้ LLM ตามเดิม
// ---------------------------------------------------------------------------
export interface HelpTopic {
  /** คำสำคัญ (ไทย) ที่ใช้จับคำถาม — ตรงคำเดียวก็พอ */
  keys: string[]
  title: string
  answer: string
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    keys: ['สั่งยังไง', 'วิธีสั่ง', 'สั่งอาหารยังไง', 'สั่งซื้อยังไง'],
    title: 'วิธีสั่งอาหาร',
    answer:
      'วิธีสั่งครับ: ① กด "เมนูทั้งหมด" หรือพิมพ์ชื่อเมนูที่อยากได้ ② กดปุ่ม 🛒 บนเมนูเพื่อเพิ่มลงตะกร้า ③ เปิดตะกร้า ตรวจรายการ แล้วกดยืนยัน ④ เลือกรับเองที่ร้าน/จัดส่ง แล้วชำระตามวิธีที่แสดงครับ 🍊',
  },
  {
    keys: ['ติดตามออเดอร์', 'เช็กสถานะ', 'ออเดอร์ถึงไหน', 'ตามออเดอร์'],
    title: 'ติดตามออเดอร์',
    answer:
      'ติดตามได้ 2 ทางครับ: ① พิมพ์เลขออเดอร์ (เช่น BMB-20261106-123) ในแชทนี้ ② เปิดหน้าติดตามออเดอร์ (/track) แล้วใส่เลขกับเบอร์โทรครับ',
  },
  {
    keys: ['คูปอง', 'ส่วนลด', 'โค้ดส่วนลด'],
    title: 'คูปอง/ส่วนลด',
    answer:
      'ใส่โค้ดส่วนลดในช่อง "โค้ดส่วนลด" ตอนอยู่ที่ตะกร้าก่อนยืนยันออเดอร์ครับ ถ้าโค้ดหมดอายุหรือยังไม่ถึงวัน ระบบจะแจ้งสถานะให้ทราบตรง ๆ ครับ 🏷️',
  },
  {
    keys: ['แต้ม', 'สมาชิก', 'สะสมแต้ม'],
    title: 'แต้มสมาชิก',
    answer: 'แต้มสะสมจะเพิ่มจากออเดอร์ที่สำเร็จครับ ดูแต้มและประวัติได้ที่หน้าบัญชีของคุณครับ ⭐',
  },
  {
    keys: ['เพิ่มสินค้า', 'สินค้าใหม่', 'แก้เมนู'],
    title: 'เพิ่ม/แก้เมนู (แอดมิน)',
    answer:
      'สำหรับแอดมิน: เปิดแถบแอดมิน (/admin) → หน้าจัดการเมนู → เพิ่มหรือแก้ไขสินค้าแล้วกดบันทึก เมนูจะขึ้นหน้าเว็บตามเวลาที่ตั้งไว้ครับ',
  },
  {
    keys: ['สต็อก', 'วัตถุดิบ', 'ของใกล้หมด'],
    title: 'สต็อก/วัตถุดิบ',
    answer:
      'ดูสต็อกและวัตถุดิบได้ที่หน้าคลังในแถบแอดมิน (/admin) ครับ ระบบหักสต๊อกอัตโนมัติเมื่อยืนยันออเดอร์ และมีแจ้งเตือนเมื่อของใกล้หมดครับ 📦',
  },
]

export function matchHelpTopic(text: string): HelpTopic | null {
  const t = String(text || '').toLowerCase()
  if (!t) return null
  for (const topic of HELP_TOPICS) {
    if (topic.keys.some((k) => t.includes(k.toLowerCase()))) return topic
  }
  return null
}

// ---------------------------------------------------------------------------

export interface OrderIntent {
  /** Wants "order like before / again / same as yesterday". */
  likeBefore: boolean
  /** Wants to cancel an existing order. */
  cancelOrder?: boolean
  /** Wants to modify an existing order. */
  modifyOrder?: boolean
  /** Raw "change FROM ... " token (fuzzy). */
  modifyFrom?: string
  /** Raw " ... TO ..." token (fuzzy). */
  modifyTo?: string
  /** "Customize my dish" flags ("ไม่เผ็ด", "เพิ่มไข่"…). */
  customizers: Customizer[]
}

const LIKE_BEFORE_RE =
  /(เหมือนเดิม|เหมือนครั้งก่อน|เหมือนครั้งที่แล้ว|เหมือนเมื่อวาน|สั่งเหมือนเดิม|สั่งเหมือน|เอาเหมือนเดิม|เอาเหมือนเมื่อวาน|ของเมื่อวาน|เมื่อวาน|ครั้งก่อน|ครั้งล่าสุด|ล่าสุด|สั่งซ้ำ|เอาเดิม|อีกครั้ง)/

const CANCEL_ORDER_RE =
  /(ยกเลิก\s*(?:ออเดอร์|order|สั่ง|ของ)?|cancel\s*order|ยกเลิก\s*(?:ที่|หมายเลข)?\s*\d+|ยกเลิก\s*เลข\s*\d+)/i

const MODIFY_ORDER_RE =
  /(แก้ไข\s*(?:ออเดอร์|order|สั่ง|ของ)?|modify\s*order|แก้\s*(?:ออเดอร์|order)|เปลี่ยน\s*(?:ออเดอร์|order))/i

export function parseOrderIntent(text: string): OrderIntent {
  const t = String(text || '').toLowerCase()
  const likeBefore = LIKE_BEFORE_RE.test(t)
  const cancelOrder = CANCEL_ORDER_RE.test(t)
  const modifyOrder = MODIFY_ORDER_RE.test(t)
  // change X -> Y  (Thai has no spaces between words; capture before/after "เป็น")
  const m = t.match(/เปลี่ยน\s*([^*\n]*?)\s*(?:เป็น|มาเป็น|แทนที่ด้วย|ด้วย)\s*([^*\n]*)/)
  const intent: OrderIntent = { likeBefore, cancelOrder, modifyOrder, customizers: extractCustomizers(text) }
  if (m && m[1] && m[2]) {
    const fromToken = m[1].trim()
    const toToken = m[2].trim()
    if (fromToken && toToken) {
      intent.modifyFrom = fromToken
      intent.modifyTo = toToken
    }
  }
  return intent
}

export interface OrderModify {
  draft: DraftLine[]
  unavailable: UnavailableLine[]
  total: number
  count: number
  /** The line that was swapped out (if a match was found). */
  replacedFrom?: string
  /** The product added in its place. */
  replacedTo?: string
}

/**
 * Base an order draft on a REAL past order (like "สั่งเหมือนเดิม"), then if a
 * modification was requested, swap the matching line for the requested product
 * from the real catalog. Best-effort fuzzy matching; unmatched parts are kept as
 * the normal order-again draft (never invented).
 */
export function applyOrderModify(
  order: OrderLike,
  catalog: Product[],
  intent: { modifyFrom?: string; modifyTo?: string },
): OrderModify {
  const base = resolveOrderAgainFromOrder(order, catalog)
  if (!intent.modifyFrom || !intent.modifyTo) {
    return { ...base }
  }
  const fromT = intent.modifyFrom.toLowerCase()
  const toT = intent.modifyTo.toLowerCase()

  // Line to swap out — match against the order-again draft / the real past order.
  const dropped = base.draft.find((d) => {
    const name = d.product.name.toLowerCase()
    if (fromT && (name.includes(fromT) || fromT.includes(name))) return true
    return (order?.items || []).some(
      (o) => o.product_id === d.product.id && String(o.product_name || '').toLowerCase().includes(fromT),
    )
  })

  // Product to add — match against the real catalog by name.
  const addProduct = (catalog || []).find(
    (p) => p.is_available && !p.archived && (p.name.toLowerCase().includes(toT) || toT.includes(p.name.toLowerCase())),
  )

  const qty = dropped?.quantity ?? 1
  const draft = base.draft.filter((d) => d !== dropped)
  const replacedFrom = dropped?.product.name
  if (addProduct) {
    draft.push({ product: addProduct, quantity: qty })
  }
  const replacedTo = addProduct?.name

  return {
    draft,
    unavailable: base.unavailable,
    total: sumDraftTotal(draft),
    count: draft.reduce((sum, d) => sum + d.quantity, 0),
    ...(replacedFrom ? { replacedFrom } : {}),
    ...(replacedTo ? { replacedTo } : {}),
  }
}

// ---------------------------------------------------------------------------
// Talk-to-Bite greeting — deterministic 7-day rotation, personalised ONLY with
// VERIFIED data (customer name / favorite category from server memory).
// The AI never fabricates a name or a dish; with no verified identity we fall
// back to a friendly generic greeting. Images are never generated here (product
// imagery comes exclusively from the admin catalog `image_url`).
// ---------------------------------------------------------------------------

const GREETING_BASES = [
  'สวัสดีครับ ผมBite พนักงานเสิร์ฟของBite Me Baby 🍊 วันนี้อยากกินอะไรดีครับ?',
  'ยินดีต้อนรับครับ ผมBiteจากBite Me Baby 🍊 จะให้ช่วยเลือกเมนู หรือจะสั่งเลยก็ได้ครับ',
  'สวัสดีครับ ผมBiteพร้อมแนะนำเมนูของจริงวันนี้ให้เลยครับ 🍊',
  'สวัสดีครับ! ผมBiteของBite Me Baby 🍊 วันนี้มีของอร่อย ๆ อยากให้เลือกไหมครับ?',
  'สวัสดีครับ ผมBite พนักงานเสิร์ฟ AI ของBite Me Baby 🙂 จะสั่งเลยหรือให้ช่วยเลือกก็ได้ครับ',
  'สวัสดีครับ ผมBite 🍊 วันนี้อยากลองอะไรใหม่ ๆ ไหมครับ มีของอร่อยเพียบเลยครับ',
  'สวัสดีครับ Biteอยู่ตรงนี้แล้วพร้อมเสิร์ฟครับ 🙂 วันนี้รับอะไรดีครับ?',
] as const

const RETURNING_BASES = [
  'กลับมาแล้วนะครับ 😎 วันนี้เอาเหมือนเดิม หรือลองอะไรใหม่ดีครับ?',
  'Hey! กลับมาแล้ว 😎 ให้เอาของเดิมเลยไหมครับ หรืออยากลองของใหม่?',
  'ยินดีต้อนรับกลับครับ 🙌 วันนี้Biteเตรียมของอร่อยไว้ให้แล้ว จะเอาอะไรดีครับ?',
  'กลับมาอีกแล้ว 🍊 วันนี้อยากให้Biteเลือกให้ หรือสั่งเหมือนเดิมครับ?',
  'สวัสดีครับ คุณกลับมาแล้วนะ 😎 ให้ผมดูออเดอร์ที่แล้วมาให้ไหมครับ?',
  'ยินดีที่ได้เจออีกครั้งครับ 🍊 วันนี้มีโปรน่าสนใจด้วย อยากฟังไหมครับ?',
  'กลับมาแล้วครับ 😎 ครั้งก่อนลองมาแล้ว ครั้งนี้อยากลองอะไรใหม่ ๆ ไหมครับ?',
] as const

export interface BiteGreetingOptions {
  /** 0..6 — which of the 7 rotating greetings to use (pass `getGreetingIndex()`). */
  /** Return-shopper flavour — only when we have VERIFIED evidence they ordered before. */
  returning?: boolean
  index?: number
  /** VERIFIED display name. An email-like value is silently ignored. */
  name?: string | null
  /** VERIFIED favorite category (from authoritative customer memory). */
  favoriteCategory?: string | null
}

/** Day-based rotation: a stable 0..6 index that advances daily (7 distinct greetings). */
export function getGreetingIndex(date: Date = new Date()): number {
  const day = Math.floor(date.getTime() / 86_400_000)
  return ((day % 7) + 7) % 7
}

/** Build the 7-day rotating greeting, personalised ONLY with verified data. */
export function buildBiteGreeting({
  index = getGreetingIndex(),
  name,
  favoriteCategory,
  returning = false,
}: BiteGreetingOptions = {}): string {
  const normalized = ((index % 7) + 7) % 7
  let base: string = (returning ? RETURNING_BASES : GREETING_BASES)[normalized]
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const usableName = cleanName && !cleanName.includes('@') ? cleanName : null
  if (usableName) {
    // Strip any leading greeting so we don't double-greet, then prefix the name.
    base = base.replace(/^(สวัสดีครับ|ยินดีต้อนรับครับ|ยินดีต้อนรับกลับครับ|ยินดีที่ได้เจออีกครั้งครับ|กลับมาแล้ว|กลับมาอีกแล้ว)\s*/, '')
    base = `สวัสดีครับคุณ${usableName} 🙌 ${base}`
  }
  if (favoriteCategory) {
    base += ` เห็นว่าคุณชอบ ${favoriteCategory} อยากให้เน้นเมนูหมวดนั้นไหมครับ? 🍊`
  }
  return base
}

/**
 * Pick up to `count` sellable products, nudging toward the customer's VERIFIED
 * favorite categories first, then featured, then name (deterministic, real data).
 */
export function pickFavoriteProducts(products: Product[], favoriteCategories: string[], count = 3): Product[] {
  const sellable = (products || []).filter((p) => p.is_available && !p.archived)
  const favs = new Set((favoriteCategories || []).map((c) => String(c).trim()).filter(Boolean))
  const score = (p: Product): number => {
    const cat = String(p.category_id || '')
    if (favs.size > 0 && favs.has(cat)) return 3
    if (p.is_featured) return 2
    return 1
  }
  const sorted = [...sellable].sort((a, b) => {
    const s = score(b) - score(a)
    if (s !== 0) return s
    return a.name.localeCompare(b.name, 'th')
  })
  return sorted.slice(0, Math.max(0, count))
}
