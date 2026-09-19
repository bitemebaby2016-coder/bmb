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

// ============================================
// TEMPORARY MOCK OVERLAYS (until real data flows from Admin/DB)
// keyed by product id — remove when stock/rating/review_count live in products.
// ============================================
const MOCK_STOCK: Record<string, number> = {
  'prod-1': 8,
  'prod-2': 12,
  'prod-3': 3,
  'prod-4': 20,
}
const MOCK_BADGE: Record<string, string> = {
  'prod-1': '🔥 ขายดี',
  'prod-3': '฿ ลดพิเศษ',
}
const MOCK_RATING: Record<string, { rating: number; reviewCount: number }> = {
  'prod-1': { rating: 5, reviewCount: 42 },
  'prod-2': { rating: 4.8, reviewCount: 31 },
  'prod-3': { rating: 4.6, reviewCount: 18 },
  'prod-4': { rating: 4.9, reviewCount: 57 },
  'prod-5': { rating: 5, reviewCount: 12 },
  'prod-6': { rating: 5, reviewCount: 9 },
}

function availabilityOf(p: Product): AvailabilityState {
  if (!p.is_available) return 'sold_out'
  return 'available'
}

function toHomeProduct(p: Product, cat?: ProductCategory, mode: 'same-day' | 'pre-order' = 'same-day'): HomeProduct {
  const overlay = MOCK_RATING[p.id] || { rating: 5, reviewCount: 0 }
  const stock = MOCK_STOCK[p.id]
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
    badge: MOCK_BADGE[p.id],
    rating: overlay.rating,
    reviewCount: overlay.reviewCount,
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
    if (p.is_preorder) {
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
  if (hour >= 6 && hour < 10) {
    return { isOpen: true, state: 'open', currentRoundLabel: 'รอบเช้า', cutoff: '08:00', deliveryWindowLabel: 'ส่ง 6:00–9:00', capacityPct: 60, message: 'เปิดรับออเดอร์รอบเช้า' }
  }
  if (hour >= 10 && hour < 11) {
    return { isOpen: true, state: 'same_day_closed', currentRoundLabel: 'รอบกลางวัน', cutoff: '10:30', deliveryWindowLabel: 'ส่ง 11:00–14:00', capacityPct: 40, message: 'รอบกลางวัน เปิดรับออเดอร์ 10:30' }
  }
  if (hour >= 11 && hour < 15) {
    return { isOpen: true, state: 'open', currentRoundLabel: 'รอบกลางวัน', cutoff: '10:30', deliveryWindowLabel: 'ส่ง 11:00–14:00', capacityPct: 70, message: 'เปิดรับออเดอร์รอบกลางวัน' }
  }
  if (hour >= 16 && hour < 17) {
    return { isOpen: true, state: 'same_day_closed', currentRoundLabel: 'รอบเย็น', cutoff: '16:00', deliveryWindowLabel: 'ส่ง 17:00–20:00', capacityPct: 50, message: 'รอบเย็น เปิดรับออเดอร์ 16:00' }
  }
  if (hour >= 17 && hour < 21) {
    return { isOpen: true, state: 'open', currentRoundLabel: 'รอบเย็น', cutoff: '16:00', deliveryWindowLabel: 'ส่ง 17:00–20:00', capacityPct: 80, message: 'เปิดรับออเดอร์รอบเย็น' }
  }
  return { isOpen: false, state: 'closed', message: 'ร้านปิด — กลับมาใหม่รุ่งเช้าจ้า 🌙' }
}

/** Bite conversational message factory (context-aware, data-driven). */
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
      { id: 'home-orders', label: '📦 ดูออเดอร์', icon: '📦', to: '/profile' },
    ],
  }
}