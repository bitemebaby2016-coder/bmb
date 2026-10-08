// ============================================
// Bite Me Baby — Theater recommendation reasons (pure presentation logic)
// ============================================
// Computes a REASON LABEL for a Bite food recommendation from REAL signals
// only (customer memory favorite categories, current cart contents, product
// metadata). Never fabricates promotions, sales counts, or availability —
// presentation layer with zero business authority (mirror of talkToBite.ts).
// ============================================

import type { Product } from '@/types'

export interface TheaterReason {
  icon: string
  label: string
}

export interface TheaterReasonContext {
  /** Verified favorite category ids from server memory (aiServerMemory). */
  favoriteCats: string[]
  /** category_id values of products already in the canonical cart. */
  cartCategoryIds: string[]
  /** Clock injection for deterministic tests (default = now). */
  now?: Date
}

/** A product is "new" when created within this window (real created_at only). */
const NEW_ITEM_DAYS = 14
/** Fast prep threshold — drives the ⏱️ label from prep_minutes. */
const FAST_PREP_MINUTES = 10

/**
 * Pick the FIRST matching reason (priority order below), or null when no real
 * signal supports a label — an honest card shows no chip rather than a fake one.
 *
 * Priority: ❤️ favorite → 🍗 pairs with cart → ✨ new → ⏱️ fast → 🔥 featured
 */
export function recommendReason(
  product: Product,
  ctx: TheaterReasonContext,
): TheaterReason | null {
  if (!product) return null

  // ❤️ ของโปรด — product sits in a verified favorite category.
  if (product.category_id && ctx.favoriteCats.includes(product.category_id)) {
    return { icon: '❤️', label: 'ของโปรด' }
  }

  // 🍗 เข้าคู่กับในตะกร้า — same category as something already in the cart.
  if (product.category_id && ctx.cartCategoryIds.includes(product.category_id)) {
    return { icon: '🍗', label: 'เข้าคู่กับในตะกร้า' }
  }

  // ✨ เมนูใหม่ — real created_at within the window (invalid/empty date = skip).
  const created = Date.parse(product.created_at ?? '')
  if (!Number.isNaN(created)) {
    const now = ctx.now ?? new Date()
    const ageDays = (now.getTime() - created) / 86_400_000
    if (ageDays >= 0 && ageDays <= NEW_ITEM_DAYS) {
      return { icon: '✨', label: 'เมนูใหม่' }
    }
  }

  // ⏱️ ทำเร็ว — prep time at or under the fast threshold.
  const prep = Number(product.prep_minutes)
  if (Number.isFinite(prep) && prep > 0 && prep <= FAST_PREP_MINUTES) {
    return { icon: '⏱️', label: 'ทำเร็ว' }
  }

  // 🔥 ขายดีวันนี้ — admin-featured (same proxy handleBestSellers already uses).
  if (product.is_featured) {
    return { icon: '🔥', label: 'ขายดีวันนี้' }
  }

  return null
}
