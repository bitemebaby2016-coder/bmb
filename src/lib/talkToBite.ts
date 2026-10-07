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