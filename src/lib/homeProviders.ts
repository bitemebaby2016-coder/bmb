// ============================================
// Bite Me Baby — Home View Model providers (UI v5)
// ============================================
// UI Components ← Home View Model / Data Contract ← Mock Provider (CURRENT)
//                                                  ← Real Provider (FUTURE: Admin/DB/Storage)
//
// Rule (governing): NO business content hard-coded inside components. This layer is the
// ONLY place that maps real product/review rows → Home contracts, and where temporary
// MOCK values (stock badges, ratings, promotions, store status) live until real data
// arrives. Swapping Mock → Real later = edit THIS file only.
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

function availabilityOf(p: Product): AvailabilityState {
  if (!p.is_available) return 'sold_out'
  return 'available'
}

function toHomeProduct(p: Product, cat?: ProductCategory, mode: 'same-day' | 'pre-order' = 'same-day'): HomeProduct {
  // migration 012 real columns win; MOCK_* overlays removed.
  const stock = p.stock ?? 0
  const rating = Number(p.rating) ?? 0
  const reviewCount = Number(p.review_count) ?? 0
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
    rating,
    reviewCount,
    cta: mode === 'pre-order' ? '📅 จองล่วงหน้า' : '🛒 เพิ่มลงตะกร้า',
    scheduledDate: p.scheduled_date,
  }
}

/** Map real products → HomeProduct, split into same-day and pre-order carousels. */
export function getHomeProducts(
  products: Product[],
  categories: ProductCategory[],
): { sameDay: HomeProduct[]; preOrder: HomeProduct[] } {
  const catMap = new Map((categories || []).map((c) => [c.id, c]))
  const sameDay: HomeProduct[] = []
  const preOrder: HomeProduct[] = []
  for (const p of products || []) {
    const cat = catMap.get(p.category_id)
    if (p.available_preorder ?? p.is_preorder) {
      if (p.is_featured || preOrder.length < 6) preOrder.push(toHomeProduct(p, cat, 'pre-order'))
    } else if (p.is_available) {
      if (p.is_featured || sameDay.length < 6) sameDay.push(toHomeProduct(p, cat, 'same-day'))
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
/** Promotions strip — MOCK (data-driven; real = admin promotions later). */
export function getHomePromotions(): HomePromotion[] {
  return [
    {
      id: 'promo-welcome10',
      title: 'ลูกค้าใหม่ ลด 10%',
      description: 'ใช้โค้ด WELCOME10 ตั้งแต่ออเดอร์แรก',
      coupon: 'WELCOME10',
      cta: 'ใช้เลย',
    },
    {
      id: 'promo-freeship200',
      title: 'ส่งฟรี ฿200+',
      description: 'ภายในรัศมี 5 กม. รอบจัดส่งปกติ',
      cta: 'สั่งเลย',
    },
  ]
}

/** Store / delivery status — MOCK deterministic (hour-based). Real = delivery_rounds later. */
export function getStoreStatus(now: Date = new Date()): StoreStatus {
  const hour = now.getHours()
  // Spec canonical: Morning 06-09 (cutoff 08:00), Midday 11-14 (cutoff 10:30), Evening 17-20 (cutoff 16:00)
  if (hour >= 6 && hour < 9) {
    return { isOpen: true, state: 'open', currentRoundLabel: 'รอบเช้า', cutoff: '08:00', deliveryWindowLabel: 'ส่ง 06:00–09:00', capacityPct: 60, message: 'เปิดรับออเดอร์รอบเช้า' }
  }
  if (hour >= 9 && hour < 11) {
    return { isOpen: true, state: 'same_day_closed', currentRoundLabel: 'รอบเช้า', cutoff: '08:00', deliveryWindowLabel: 'ส่ง 06:00–09:00', capacityPct: 40, message: 'รอบเช้าปิดรับออเดอร์แล้ว' }
  }
  if (hour >= 11 && hour < 14) {
    return { isOpen: true, state: 'open', currentRoundLabel: 'รอบกลางวัน', cutoff: '10:30', deliveryWindowLabel: 'ส่ง 11:00–14:00', capacityPct: 70, message: 'เปิดรับออเดอร์รอบกลางวัน' }
  }
  if (hour >= 14 && hour < 17) {
    return { isOpen: true, state: 'same_day_closed', currentRoundLabel: 'รอบกลางวัน', cutoff: '10:30', deliveryWindowLabel: 'ส่ง 11:00–14:00', capacityPct: 50, message: 'รอบกลางวันปิดรับออเดอร์แล้ว' }
  }
  if (hour >= 17 && hour < 20) {
    return { isOpen: true, state: 'open', currentRoundLabel: 'รอบเย็น', cutoff: '16:00', deliveryWindowLabel: 'ส่ง 17:00–20:00', capacityPct: 80, message: 'เปิดรับออเดอร์รอบเย็น' }
  }
  return { isOpen: false, state: 'closed', message: 'ร้านปิด — กลับมาใหม่รุ่งเช้าจ้า 🌙' }
}

/** Derive StoreStatus from real delivery_rounds rows when available; fallback = mock. */
export function getStoreStatusFromRounds(rounds: Array<{
  status?: string
  display_name?: string
  cutoff_time?: string
  delivery_start?: string
  delivery_end?: string
  max_capacity?: number
  current_count?: number
}>, now: Date = new Date()): StoreStatus {
  const open = (rounds || []).filter((r) => r.status === 'open')
  if (open.length === 0) return getStoreStatus(now)
  const hour = now.getHours()
  const current = open.find((r) => {
    const end = Number((r.delivery_end || '00').split(':')[0])
    const start = Number((r.delivery_start || '00').split(':')[0])
    return hour >= start && hour < end
  }) || open[0]
  return {
    isOpen: true,
    state: 'open',
    currentRoundLabel: current.display_name || 'ปัจจุบัน',
    cutoff: current.cutoff_time,
    deliveryWindowLabel: `ส่ง ${current.delivery_start}–${current.delivery_end}`,
    capacityPct: Number(current.max_capacity) > 0
      ? Math.min(100, Math.round((Number(current.current_count || 0) / Number(current.max_capacity)) * 100))
      : undefined,
    message: `เปิดรับออเดอร์${current.display_name ? ' ' + current.display_name : ''}`,
  }
}

/** Map real promotions rows → HomePromotion; fallback = mock list when empty/no active. */
export function getHomePromotionsFromRows(rows: Array<{
  id?: string
  name?: string
  description?: string
  code?: string
  is_active?: boolean
}>): HomePromotion[] {
  const active = (rows || []).filter((r) => r.is_active !== false).slice(0, 6)
  if (active.length > 0) {
    return active.map((r) => ({
      id: r.id || `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: r.name || 'โปรโมชั่น',
      description: r.description || '',
      coupon: r.code || undefined,
      cta: 'ใช้เลย',
    }))
  }
  return getHomePromotions()
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
      { id: 'home-menu', label: '🍱 เมนูวันนี้', icon: '🍱', to: '/menu', mascotPose: 'pointing' },
      { id: 'home-preorder', label: '📅 สั่งล่วงหน้า', icon: '📅', to: '/menu' },
      { id: 'home-bite', label: '🤖 ให้ Bite แนะนำ', icon: '🤖', to: '/ai-chat' },
      { id: 'home-orders', label: '📦 ดูออเดอร์', icon: '📦', to: '/orders' },
    ],
  }
}