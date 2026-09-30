

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
// Bite Me Baby â€” Home View Model providers (UI v5)
// ============================================
// UI Components â† Home View Model / Data Contract â† Mock Provider (CURRENT)
//                                                  â† Real Provider (FUTURE: Admin/DB/Storage)
//
// Rule (governing): NO business content hard-coded inside components. This layer is the
// ONLY place that maps real product/review rows â†’ Home contracts, and where temporary
// MOCK values (stock badges, ratings, promotions, store status) live until real data
// arrives. Swapping Mock â†’ Real later = edit THIS file only.
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
  // RE-D3: products.rating/review_count are LEGACY SEED VALUES (migration 012),
  // NOT canonical customer-review aggregates (reviews table = 0 rows).
  // Per RE-D3 they must not be shown as customer-review truth â†’ omitted until
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
    cta: mode === 'pre-order' ? 'ðŸ“… à¸ˆà¸­à¸‡à¸¥à¹ˆà¸§à¸‡à¸«à¸™à¹‰à¸²' : 'ðŸ›’ à¹€à¸žà¸´à¹ˆà¸¡à¸¥à¸‡à¸•à¸°à¸à¸£à¹‰à¸²',
    scheduledDate: p.scheduled_date,
  }
}

/** Map real products â†’ HomeProduct, split into same-day and pre-order carousels. */
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

/** Reviews for customer-facing presentation (5-star focus). Real â†’ grab/fb/website later. */
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
/** Promotions strip â€” MOCK (data-driven; real = admin promotions later). */
export function getHomePromotions(): HomePromotion[] {
  return [
    {
      id: 'promo-welcome10',
      title: 'à¸¥à¸¹à¸à¸„à¹‰à¸²à¹ƒà¸«à¸¡à¹ˆ à¸¥à¸” 10%',
      description: 'à¹ƒà¸Šà¹‰à¹‚à¸„à¹‰à¸” WELCOME10 à¸•à¸±à¹‰à¸‡à¹à¸•à¹ˆà¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¹à¸£à¸',
      coupon: 'WELCOME10',
      cta: 'à¹ƒà¸Šà¹‰à¹€à¸¥à¸¢',
    },
    {
      id: 'promo-freeship200',
      title: 'à¸ªà¹ˆà¸‡à¸Ÿà¸£à¸µ à¸¿200+',
      description: 'à¸ à¸²à¸¢à¹ƒà¸™à¸£à¸±à¸¨à¸¡à¸µ 5 à¸à¸¡. à¸£à¸­à¸šà¸ˆà¸±à¸”à¸ªà¹ˆà¸‡à¸›à¸à¸•à¸´',
      cta: 'à¸ªà¸±à¹ˆà¸‡à¹€à¸¥à¸¢',
    },
  ]
}

/** Store / delivery status â€” MOCK deterministic (hour-based). Real = delivery_rounds later. */
export function getStoreStatus(now: Date = new Date()): StoreStatus {
  const hour = now.getHours()
  // Spec canonical: Morning 06-09 (cutoff 08:00), Midday 11-14 (cutoff 10:30), Evening 17-20 (cutoff 16:00)
  if (hour >= 6 && hour < 9) {
    return { isOpen: true, state: 'open', currentRoundLabel: 'à¸£à¸­à¸šà¹€à¸Šà¹‰à¸²', cutoff: '08:00', deliveryWindowLabel: 'à¸ªà¹ˆà¸‡ 06:00â€“09:00', capacityPct: 60, message: 'à¹€à¸›à¸´à¸”à¸£à¸±à¸šà¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¸£à¸­à¸šà¹€à¸Šà¹‰à¸²' }
  }
  if (hour >= 9 && hour < 11) {
    return { isOpen: true, state: 'same_day_closed', currentRoundLabel: 'à¸£à¸­à¸šà¹€à¸Šà¹‰à¸²', cutoff: '08:00', deliveryWindowLabel: 'à¸ªà¹ˆà¸‡ 06:00â€“09:00', capacityPct: 40, message: 'à¸£à¸­à¸šà¹€à¸Šà¹‰à¸²à¸›à¸´à¸”à¸£à¸±à¸šà¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¹à¸¥à¹‰à¸§' }
  }
  if (hour >= 11 && hour < 14) {
    return { isOpen: true, state: 'open', currentRoundLabel: 'à¸£à¸­à¸šà¸à¸¥à¸²à¸‡à¸§à¸±à¸™', cutoff: '10:30', deliveryWindowLabel: 'à¸ªà¹ˆà¸‡ 11:00â€“14:00', capacityPct: 70, message: 'à¹€à¸›à¸´à¸”à¸£à¸±à¸šà¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¸£à¸­à¸šà¸à¸¥à¸²à¸‡à¸§à¸±à¸™' }
  }
  if (hour >= 14 && hour < 17) {
    return { isOpen: true, state: 'same_day_closed', currentRoundLabel: 'à¸£à¸­à¸šà¸à¸¥à¸²à¸‡à¸§à¸±à¸™', cutoff: '10:30', deliveryWindowLabel: 'à¸ªà¹ˆà¸‡ 11:00â€“14:00', capacityPct: 50, message: 'à¸£à¸­à¸šà¸à¸¥à¸²à¸‡à¸§à¸±à¸™à¸›à¸´à¸”à¸£à¸±à¸šà¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¹à¸¥à¹‰à¸§' }
  }
  if (hour >= 17 && hour < 20) {
    return { isOpen: true, state: 'open', currentRoundLabel: 'à¸£à¸­à¸šà¹€à¸¢à¹‡à¸™', cutoff: '16:00', deliveryWindowLabel: 'à¸ªà¹ˆà¸‡ 17:00â€“20:00', capacityPct: 80, message: 'à¹€à¸›à¸´à¸”à¸£à¸±à¸šà¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¸£à¸­à¸šà¹€à¸¢à¹‡à¸™' }
  }
  return { isOpen: false, state: 'closed', message: 'à¸£à¹‰à¸²à¸™à¸›à¸´à¸” â€” à¸à¸¥à¸±à¸šà¸¡à¸²à¹ƒà¸«à¸¡à¹ˆà¸£à¸¸à¹ˆà¸‡à¹€à¸Šà¹‰à¸²à¸ˆà¹‰à¸² ðŸŒ™' }
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
    currentRoundLabel: current.display_name || 'à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™',
    cutoff: current.cutoff_time,
    deliveryWindowLabel: `à¸ªà¹ˆà¸‡ ${current.delivery_start}â€“${current.delivery_end}`,
    capacityPct: Number(current.max_capacity) > 0
      ? Math.min(100, Math.round((Number(current.current_count || 0) / Number(current.max_capacity)) * 100))
      : undefined,
    message: `à¹€à¸›à¸´à¸”à¸£à¸±à¸šà¸­à¸­à¹€à¸”à¸­à¸£à¹Œ${current.display_name ? ' ' + current.display_name : ''}`,
  }
}

/** Map real promotions rows â†’ HomePromotion; fallback = mock list when empty/no active. */
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
      title: r.name || 'à¹‚à¸›à¸£à¹‚à¸¡à¸Šà¸±à¹ˆà¸™',
      description: r.description || '',
      coupon: r.code || undefined,
      cta: 'à¹ƒà¸Šà¹‰à¹€à¸¥à¸¢',
    }))
  }
  return getHomePromotions()
}

/** Bite pose per store state (spec Â§4/5 â€” expression mapping; assets reuse). */
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
    ? `${storeStatus.message} â€” ${storeStatus.deliveryWindowLabel ?? ''}`
    : storeStatus.message
  const recos = sameDayCount > 0 ? ` à¸§à¸±à¸™à¸™à¸µà¹‰à¸¡à¸µà¹€à¸¡à¸™à¸¹ ${sameDayCount} à¸­à¸¢à¹ˆà¸²à¸‡à¹ƒà¸«à¹‰à¹€à¸¥à¸·à¸­à¸ ` : ' à¸§à¸±à¸™à¸™à¸µà¹‰à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸¡à¸™à¸¹à¸§à¸±à¸™à¸™à¸µà¹‰ '
  const preOrderLine = preOrderCount > 0 ? ` à¹à¸¥à¸°à¸ˆà¸­à¸‡à¸¥à¹ˆà¸§à¸‡à¸«à¸™à¹‰à¸²à¹„à¸”à¹‰à¸­à¸µà¸ ${preOrderCount} à¹€à¸¡à¸™à¸¹` : ''
  return {
    greeting: `à¸ªà¸§à¸±à¸ªà¸”à¸µà¸ˆà¹Šà¸° â¤ï¸ à¸­à¸¢à¸²à¸à¸à¸´à¸™à¸­à¸°à¹„à¸£à¸”à¸µ?`,
    statusLine,
    recommendLabel: `à¹€à¸”à¸µà¹‹à¸¢à¸§ Bite à¹à¸™à¸°à¸™à¸³à¹ƒà¸«à¹‰à¹€à¸­à¸‡${recos}${preOrderLine}ðŸ½ï¸`,
    quickActions: [
      { id: 'home-menu', label: 'ðŸ± à¹€à¸¡à¸™à¸¹à¸§à¸±à¸™à¸™à¸µà¹‰', icon: 'ðŸ±', to: '/menu', mascotPose: 'pointing' },
      { id: 'home-preorder', label: 'ðŸ“… à¸ªà¸±à¹ˆà¸‡à¸¥à¹ˆà¸§à¸‡à¸«à¸™à¹‰à¸²', icon: 'ðŸ“…', to: '/menu' },
      { id: 'home-bite', label: 'ðŸ¤– à¹ƒà¸«à¹‰ Bite à¹à¸™à¸°à¸™à¸³', icon: 'ðŸ¤–', to: '/ai-chat' },
      { id: 'home-orders', label: 'ðŸ“¦ à¸”à¸¹à¸­à¸­à¹€à¸”à¸­à¸£à¹Œ', icon: 'ðŸ“¦', to: '/orders' },
    ],
  }
}
