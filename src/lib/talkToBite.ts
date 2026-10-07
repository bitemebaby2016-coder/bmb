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
export function pickTopAvailable(products: Product[], count = 3): Product[] {
  const sellable = (products || []).filter((p) => p.is_available && !p.archived)
  const sorted = [...sellable].sort((a, b) => {
    if (!!a.is_featured !== !!b.is_featured) return a.is_featured ? -1 : 1
    return a.name.localeCompare(b.name, 'th')
  })
  return sorted.slice(0, Math.max(0, count))
}

// ---------------------------------------------------------------------------
// Order-again draft — translate a REAL past order into a cart draft using the
// CURRENT catalog (price + availability authority). No fabricated items.
// ---------------------------------------------------------------------------

export interface OrderLikeItem {
  product_id?: string
  product_name?: string
  quantity?: number
}

export interface OrderLike {
  items?: OrderLikeItem[]
}

export interface DraftLine {
  product: Product
  quantity: number
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
      draft.push({ product, quantity })
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

export interface OrderIntent {
  /** Wants "order like before / again / same as yesterday". */
  likeBefore: boolean
  /** Raw "change FROM ... " token (fuzzy). */
  modifyFrom?: string
  /** Raw " ... TO ..." token (fuzzy). */
  modifyTo?: string
}

const LIKE_BEFORE_RE =
  /(เหมือนเดิม|เหมือนครั้งก่อน|เหมือนครั้งที่แล้ว|เหมือนเมื่อวาน|สั่งเหมือนเดิม|สั่งเหมือน|เอาเหมือนเดิม|เอาเหมือนเมื่อวาน|ของเมื่อวาน|เมื่อวาน|ครั้งก่อน|ครั้งล่าสุด|ล่าสุด|สั่งซ้ำ|เอาเดิม|อีกครั้ง)/

export function parseOrderIntent(text: string): OrderIntent {
  const t = String(text || '').toLowerCase()
  const likeBefore = LIKE_BEFORE_RE.test(t)
  // change X -> Y  (Thai has no spaces between words; capture before/after "เป็น")
  const m = t.match(/เปลี่ยน\s*([^*\n]*?)\s*(?:เป็น|มาเป็น|แทนที่ด้วย|ด้วย)\s*([^*\n]*)/)
  const intent: OrderIntent = { likeBefore }
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
  'สวัสดีครับ ผม Bite พนักงานเสิร์ฟของ Bite Me Baby 🍊 วันนี้อยากกินอะไรดีครับ?',
  'ยินดีต้อนรับครับ ผม Bite จาก Bite Me Baby 🍊 จะให้ช่วยเลือกเมนู หรือจะสั่งเลยก็ได้ครับ',
  'สวัสดีครับ ผม Bite พร้อมแนะนำเมนูของจริงวันนี้ให้เลยครับ 🍊',
  'สวัสดีครับ! ผม Bite ของ Bite Me Baby 🍊 วันนี้มีของอร่อย ๆ อยากให้เลือกไหมครับ?',
  'สวัสดีครับ ผม Bite พนักงานเสิร์ฟ AI ของ Bite Me Baby 🙂 จะสั่งเลยหรือให้ช่วยเลือกก็ได้ครับ',
  'สวัสดีครับ ผม Bite 🍊 วันนี้อยากลองอะไรใหม่ ๆ ไหมครับ มีของอร่อยเพียบเลยครับ',
  'สวัสดีครับ Bite อยู่ตรงนี้แล้วพร้อมเสิร์ฟครับ 🙂 วันนี้รับอะไรดีครับ?',
] as const

const RETURNING_BASES = [
  'กลับมาแล้วนะครับ 😎 วันนี้เอาเหมือนเดิม หรือลองอะไรใหม่ดีครับ?',
  'Hey! กลับมาแล้ว 😎 ให้เอาของเดิมเลยไหมครับ หรืออยากลองของใหม่?',
  'ยินดีต้อนรับกลับครับ 🙌 วันนี้ Bite เตรียมของอร่อยไว้ให้แล้ว จะเอาอะไรดีครับ?',
  'กลับมาอีกแล้ว 🍊 วันนี้อยากให้ Bite เลือกให้ หรือสั่งเหมือนเดิมครับ?',
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
