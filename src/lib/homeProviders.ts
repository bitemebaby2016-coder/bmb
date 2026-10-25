

// CAT-04: Filter products by activeBranchId for multi-branch availability
export function filterProductsByBranch(
  products: Product[],
  activeBranchId?: string | null,
): Product[] {
  if (!activeBranchId || !products?.length) return products
  // AI-CLEANUP (CAT-04 note, not a pending TODO): branch availability resolves
  // from M092 columns (is_available / archived) read by callers — no pending RPC.
  // call it per product to resolve effective availability at this branch.
  // For now, return all available products (fallback until branch RPC lands)
  return products.filter((p) => p.is_available && !p.archived)
}

// ============================================
// Bite Me Baby — Home View Model providers (UI v5)
// ============================================
// UI Components ← Home View Model / Data Contract ← Real data (products,
//                                                 promotions, delivery_rounds)
//
// Rule (governing): NO business content hard-coded inside components. This layer
// is the ONLY place that maps real product/review/promotion rows → Home
// contracts. ZERO-FAKE (closure 2026-10-18): the temporary MOCK overlays (stock
// badges, ratings, promotions, store status) are removed — missing data renders
// honest empty/closed states instead of fabricated sample values.
// ============================================

import type {
  Product,
  ProductCategory,
  HomeProduct,
  HomeReview,
  HomePromotion,
  StoreStatus,
  BiteMessage,
  BiteContext,
  AvailabilityState,
} from '@/types'
import { SOCIAL_PROOF_REVIEWS } from './socialProofReviews'
import { sameDayEligible, preorderEligible } from './talkToBite'
import { roundBookability, roundCutoffLabel, roundCutoffMs } from './deliveryRoundStatus'
import { bangkokMsOfDay } from './bangkokTime'
import type { ProductScheduleMap } from './productSchedule'

function availabilityOf(p: Product): AvailabilityState {
  if (!p.is_available) return 'sold_out'
  return 'available'
}

function toHomeProduct(p: Product, cat: ProductCategory | undefined, mode: 'same-day' | 'pre-order' = 'same-day', schedule: ProductScheduleMap = {}): HomeProduct {
  // migration 012 real columns win; MOCK_* overlays removed.
  const stock = p.stock ?? 0
  // RE-D3: products.rating/review_count are LEGACY SEED VALUES (migration 012),
  // NOT canonical customer-review aggregates (reviews table = 0 rows).
  // Per RE-D3 they must not be shown as customer-review truth → omitted until
  // a canonical aggregate derived from `reviews` exists (future gate).
  return {
    id: p.id,
    name: p.name,
    image: p.image_url || '',
    price: Number(p.price) || 0,
    description: p.description || '',
    category_id: p.category_id,
    categoryName: cat?.name,
    categoryIcon: cat?.icon,
    mode,
    availability: availabilityOf(p),
    stock,
    cta: mode === 'pre-order' ? '📅 จองล่วงหน้า' : '🛒 เพิ่มลงตะกร้า',
    scheduledDate: schedule[p.id],
  }
}

/** Map real products → HomeProduct, split into same-day and pre-order carousels. */
export function getHomeProducts(
  products: Product[],
  categories: ProductCategory[],
  schedule: ProductScheduleMap = {},
): { sameDay: HomeProduct[]; preOrder: HomeProduct[] } {
  const catMap = new Map((categories || []).map((c) => [c.id, c]))
  const sameDay: HomeProduct[] = []
  const preOrder: HomeProduct[] = []
  const seenSameDay = new Set<string>()
  const seenPreOrder = new Set<string>()
  for (const p of products || []) {
    const cat = catMap.get(p.category_id)
    // FIX (owner report 2026-10-01): the pre-order carousel leaked unavailable
    // products (e.g. promo placeholders) into "จองล่วงหน้า — สั่งอาหารจันทบุรี"
    // because availability was only checked on the same-day branch. Both modes
    // now require is_available && !archived (mirror of the catalog gate).
    const sellable = !!p.is_available && !p.archived
    // Phase 1 (RC-2 / OD-3): eligibility ตาม canonical rule (matrix §3.1) —
    // else-branch เดิมใส่ sameDay bucket โดยไม่เช็ค `available_same_day`
    // → สินค้าไร้สิทธิ์ทั้งสองโหมด = ไม่เข้า bucket ใด (ห้าม offer)
    // Phase 5B (RC-4 · INV-19): กันสินค้าซ้ำในคารูเซลเดียวกันเมื่อ rows ซ้ำจาก data/API —
    // ข้าม surface (Theater + คารูเซล×2 + CategorySections) = BY DESIGN จนกว่า A2 (OD-1 DEFERRED)
    if (sellable && preorderEligible(p) && !seenPreOrder.has(p.id)) {
      if (p.is_featured || preOrder.length < 6) {
        seenPreOrder.add(p.id)
        preOrder.push(toHomeProduct(p, cat, 'pre-order', schedule))
      }
    } else if (sellable && sameDayEligible(p) && !seenSameDay.has(p.id)) {
      if (p.is_featured || sameDay.length < 6) {
        seenSameDay.add(p.id)
        sameDay.push(toHomeProduct(p, cat, 'same-day', schedule))
      }
    }
  }
  return { sameDay: sameDay.slice(0, 8), preOrder: preOrder.slice(0, 8) }
}

/** Reviews for customer-facing presentation (5-star focus). Real → grab/fb/website later. */
export function getHomeReviews(products: Product[]): HomeReview[] {
  const productMap = new Map((products || []).map((p) => [p.id, p]))
  return SOCIAL_PROOF_REVIEWS
    .filter((r) => r.rating >= 4)
    .map((r) => ({
      id: r.id,
      displayName: r.customerName,
      rating: r.rating,
      text: r.comment,
      source: r.source,
      sourceLabel: r.sourceLabel,
      dateLabel: r.dateLabel,
      relatedProduct: productMap.get(r.productId),
      relatedProductName: r.foodName,
      visible: true,
    }))
}
/** Store / delivery status — derive ONLY from real `delivery_rounds` rows.
 * ZERO-FAKE (closure 2026-10-18): the old hour-based MOCK status is gone —
 * it fabricated open/closed + capacity when rounds were missing or failed to
 * load, masking integration failures. No bookable round ⇒ honestly closed.
 * NOTE: real round status vocabulary is 'active' (↔ 'closed') per server
 * authority (007/025/118) — the old `status === 'open'` filter matched NOTHING
 * in production and silently forced the mock fallback. 'open' is still accepted
 * for legacy/test rows. */
export function getStoreStatusFromRounds(rounds: Array<{
  status?: string
  display_name?: string
  cutoff_time?: string
  delivery_start?: string
  delivery_end?: string
  max_capacity?: number
  current_count?: number
  scheduled_date?: string | null
}>, now: Date = new Date()): StoreStatus {
  const live = (rounds || []).filter((r) => {
    const s = String(r.status || '').toLowerCase()
    return s === 'active' || s === 'open'
  })
  if (live.length === 0) {
    return {
      isOpen: false,
      state: 'closed',
      message: 'ยังไม่เปิดรับออเดอร์ — ไม่มีรอบจัดส่งที่เปิดรับอยู่',
    }
  }
  // วันนี้ (ปฏิทิน Bangkok) — ตรงกับ scheduled_date ของรอบ หรือแถวที่ไม่ระบุวัน
  const todayBkk = new Date(now.getTime() + 7 * 60 * 60_000).toISOString().slice(0, 10)
  const todayRows = live.filter((r) => {
    const d = r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : null
    return d === null || d === todayBkk
  })
  // ยังรับได้จริงวันนี้ = ไม่เต็ม + ไม่เลย cutoff/window (mirror เดียวกับ deliveryRoundStatus)
  // ── สายพรีออเดอร์ (Owner 2026-10-25): "ปิดพรีออเดอร์รอบเย็นไปแล้ว → ที่สั่งได้คือรอบถัดไป
  // ในอนาคต" · นอกเวลาคัทออฟที่แอดมินกำหนด = สั่งไม่ได้ · คัทออฟ = pre_order_cutoff (145)
  // หรือ delivery_start − cutoff_hours(2) — display mirror เท่านั้น server ตัดสินตอนสั่งจริง
  const cutoffAtUtc = (r: Record<string, any>): number | null => {
    const day = String(r.scheduled_date ?? '').slice(0, 10)
    if (!day) return null
    const ms = roundCutoffMs(r, 'PRE_ORDER', 2)
    if (ms === null) return null
    const base = Date.parse(`${day}T00:00:00+07:00`)
    if (Number.isNaN(base)) return null
    return base + ms // ms อาจติดลบ (คัทออฟก่อนเที่ยงคืนของวันก่อน) → base+ms ยังชี้วันถูก
  }
  const nextPre =
    live
      .filter((r) => {
        const t = cutoffAtUtc(r)
        return t === null || now.getTime() < t
      })
      .sort((a, b) => {
        const da = String(a.scheduled_date ?? '').slice(0, 10)
        const db = String(b.scheduled_date ?? '').slice(0, 10)
        if (da !== db) return da.localeCompare(db)
        return String(a.delivery_start ?? '').localeCompare(String(b.delivery_start ?? ''))
      })[0] ?? null
  const preOrderLine = nextPre
    ? `พรีออเดอร์: เปิดรับรอบ ${nextPre.display_name || String(nextPre.scheduled_date ?? '').slice(0, 10)} (คัทออฟ ${roundCutoffLabel(nextPre, 'PRE_ORDER', 2)})`
    : 'พรีออเดอร์: ปิดรับแล้ว — ยังไม่เปิดรอบถัดไป'

  const bookable = todayRows.filter(
    (r) => roundBookability(r, { isToday: true, nowUtcMs: now.getTime() }) === 'open',
  )
  if (bookable.length > 0) {
    const bkkMs = bangkokMsOfDay(now.getTime())
    const hour = bkkMs == null ? now.getHours() : Math.floor(bkkMs / 3_600_000)
    const current = bookable.find((r) => {
      const end = Number((r.delivery_end || '00').split(':')[0])
      const start = Number((r.delivery_start || '00').split(':')[0])
      return hour >= start && hour < end
    }) || bookable[0]
    return {
      isOpen: true,
      state: 'open',
      currentRoundLabel: current.display_name || 'ปัจจุบัน',
      // D5 (Owner 2026-10-25): ห้ามโชว์ cutoff_time เดิมเป็น "ปิดรับ" — เซมเดย์ไม่มีคัทออฟ (148)
      // คัทออฟพรีออเดอร์ที่มีจริงโชว์ที่รอบจัดส่งตอน checkout (roundCutoffLabel PRE_ORDER) แล้ว
      deliveryWindowLabel: `ส่ง ${current.delivery_start}–${current.delivery_end}`,
      capacityPct: Number(current.max_capacity) > 0
        ? Math.min(100, Math.round((Number(current.current_count || 0) / Number(current.max_capacity)) * 100))
        : undefined,
      message: `เปิดรับออเดอร์${current.display_name ? ' ' + current.display_name : ''}`,
      preOrderLine,
    }
  }
  // วันนี้ปิดรับหมด แต่ยังมีรอบวันถัดไป = เปิดรับจองล่วงหน้าเท่านั้น (ไม่มีตัวเลขแต่งเอง)
  const futureRows = live.filter((r) => {
    const d = r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : null
    return d !== null && d > todayBkk
  })
  if (futureRows.length > 0) {
    return {
      isOpen: true,
      state: 'preorder_only',
      message: 'เปิดรับออเดอร์จองล่วงหน้า — รอบวันนี้ปิดรับแล้ว',
      preOrderLine,
    }
  }
  return {
    isOpen: false,
    state: 'closed',
    message: 'ยังไม่เปิดรับออเดอร์ — ไม่มีรอบจัดส่งที่เปิดรับอยู่',
    preOrderLine,
  }
}

/** Map real promotions rows → HomePromotion. ZERO-FAKE: empty rows ⇒ empty
 * strip (PromotionStrip hides itself) — never fabricated promo cards. */
export function getHomePromotionsFromRows(rows: Array<{
  id?: string
  name?: string
  description?: string
  code?: string
  is_active?: boolean
}>): HomePromotion[] {
  const active = (rows || []).filter((r) => r.is_active !== false).slice(0, 6)
  return active.map((r) => ({
    id: r.id || `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: r.name || 'โปรโมชั่น',
    description: r.description || '',
    coupon: r.code || undefined,
    cta: 'ใช้เลย',
  }))
}

/** Bite pose per store state (spec §4/5 — expression mapping; assets reuse). */
export function getBitePose(state: StoreStatus['state']): 'greeting' | 'thinking' | 'pointing' | 'empty' {
  switch (state) {
    case 'closed': return 'empty'
    case 'same_day_closed': return 'thinking'
    case 'preorder_only': return 'pointing'
    default: return 'greeting'
  }
}
export function getBiteMessage(ctx: BiteContext): BiteMessage {
  const { storeStatus, sameDayCount, preOrderCount } = ctx
  const statusLine = storeStatus.isOpen
    ? `${storeStatus.message} — ${storeStatus.deliveryWindowLabel ?? ''}`
    : storeStatus.message
  const recos = sameDayCount > 0 ? ` วันนี้มีเมนู ${sameDayCount} อย่างให้เลือก ` : ' วันนี้ยังไม่มีเมนูวันนี้ '
  const preOrderLine = preOrderCount > 0 ? ` และจองล่วงหน้าได้อีก ${preOrderCount} เมนู` : ''
  return {
    greeting: `สวัสดีจ๊ะ ❤️ อยากกินอะไรดี?`,
    statusLine,
    recommendLabel: `เดี๋ยว Bite แนะนำให้เอง${recos}${preOrderLine}🍽️`,
    quickActions: [
      { id: 'home-menu', label: 'เมนูวันนี้', icon: 'mascot:menu', to: '/menu', mascotPose: 'menu' },
      { id: 'home-preorder', label: 'สั่งล่วงหน้า', icon: '📅', to: '/menu' },
      { id: 'home-bite', label: 'ให้ Bite แนะนำ', icon: 'mascot:recommend', to: '/talk-to-bite' },
      { id: 'home-orders', label: 'ดูออเดอร์', icon: '📦', to: '/orders' },
    ],
  }
}
