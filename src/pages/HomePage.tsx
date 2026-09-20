// ============================================
// Bite Me Baby â€” Home Page (UI v5)
// Information Architecture (shorter + scan-able):
//   [1 Bite Conversational Hero] -> [2 Store/Delivery Status]
//   -> [3 Same-day Carousel] -> [4 Pre-order Carousel]
//   -> [5 Drinks Carousel (mockup)] -> [5b Snacks Carousel (mockup)]
//   -> [6 Social Proof Review Carousel]
//   -> [7 Promotions / Social]
// + FloatingCart. No low-stock dashboard, no long vertical grids.
// Business flows preserved: add-to-cart (cartStore), pre-order (createPreOrder),
// review deep-link (cart/checkout by mode).
// ============================================

import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import { createPreOrder } from '@/lib/preOrderService'
import {
  getHomeProducts,
  getHomeReviews,
  getBiteMessage,
  getStoreStatusFromRounds,
  getHomePromotionsFromRows,
  getBitePose,
} from '@/lib/homeProviders'
import { BiteHero } from '@/components/home/BiteHero'
import { StoreStatusStrip } from '@/components/home/StoreStatusStrip'
import { HomeBanner, type HomeBannerPromo } from '@/components/home/HomeBanner'
import { HorizontalCarousel } from '@/components/home/HorizontalCarousel'
import { HomeProductCard } from '@/components/home/HomeProductCard'
import { ReviewCarouselSection } from '@/components/home/ReviewCarouselSection'
import { PromotionStrip } from '@/components/home/PromotionStrip'
import { DrinksSection } from '@/components/home/DrinksSection'
import { SnacksSection } from '@/components/home/SnacksSection'
import { FloatingCart } from '@/components/home/FloatingCart'
import { useOrderBuilderStore } from '@/store/orderBuilderStore'
import type {
  Product,
  ProductCategory,
  SameDayOrderPayload,
  PreOrderPayload,
  HomeReview,
} from '@/types'

/** Default pre-order schedule = today + 3 days (YYYY-MM-DD) when no date chosen yet. */
function defaultPreorderDate(): string {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export function HomePage() {
  const addItem = useCartStore((s) => s.addItem)
  const navigate = useNavigate()
  const customer = useAuthStore((s) => s.customer)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [rounds, setRounds] = useState<any[]>([])
  const [promoRows, setPromoRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        // PERF: supabase chunks load only after first paint (kept off critical path).
        const { getProducts, getCategories } = await import('@/lib/bmbAdminApi_products')
        const { getDeliveryRoundsAdmin } = await import('@/lib/bmbAdminApi_rounds')
        const { getPromotionsAdmin } = await import('@/lib/bmbAdminApi_promotions')
        const [rows, cats, rounds, promos] = await Promise.all([
          getProducts(),
          getCategories(),
          getDeliveryRoundsAdmin(),
          getPromotionsAdmin(),
        ])
        setProducts(rows)
        setCategories(cats)
        setRounds(rounds)
        setPromoRows(promos)
      } catch (err) {
        console.error('[HomePage] Load error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const { sameDay, preOrder } = getHomeProducts(products, categories)
  const reviews = getHomeReviews(products)
  const promotions = getHomePromotionsFromRows(promoRows)
  const bannerRow = (promoRows || []).find((r) => r.is_banner && r.is_active !== false)
  const bannerPromo: HomeBannerPromo | null = bannerRow
    ? {
        id: String(bannerRow.id),
        title: String(bannerRow.name || 'Promotion'),
        description: String(bannerRow.description || ''),
        coupon: bannerRow.code,
        image: bannerRow.banner_image,
      }
    : null
  const storeStatus = getStoreStatusFromRounds(rounds)
  const biteMessage = getBiteMessage({
    storeStatus,
    sameDayCount: sameDay.length,
    preOrderCount: preOrder.length,
  })

  const handleSameDay = (payload: SameDayOrderPayload) => {
    const product = products.find((p) => p.id === payload.productId)
    if (!product) {
      showToast('Item not found', 'error')
      return
    }
    // Grab / 7-Eleven style upsell: toppings + recommended companions.
    useOrderBuilderStore.getState().openBuilder(product, products, (result) => {
      const customizations: Record<string, any> = {}
      if (result.addOns.length > 0) {
        customizations['addOns'] = result.addOns.map((a) => ({ addonId: a.addonId, selections: a.selections, note: a.note ?? '' }))
      }
      addItem(result.product, result.quantity, customizations)
      for (const rec of result.recommended) {
        addItem(rec, 1)
      }
      showToast('Added: ' + result.product.name + (result.addOns.length > 0 ? ' (+toppings)' : '') + (result.recommended.length > 0 ? ' +' + result.recommended.length + ' recommended' : ''), 'success')
    })
  }

  const handlePreOrder = async (payload: PreOrderPayload) => {
    const product = products.find((p) => p.id === payload.productId)
    if (!product) {
      showToast('Item not found', 'error')
      return
    }
    const scheduleTarget = payload.scheduledDate || product.scheduled_date || defaultPreorderDate()
    const preOrderRow = await createPreOrder({
      customer_id: customer?.id || 'guest',
      customer_name: customer?.name || 'Guest',
      customer_phone: customer?.phone || '',
      product_id: product.id,
      product_name: product.name,
      quantity: payload.quantity,
      unit_price: Number(product.price) || 0,
      total_amount: (Number(product.price) || 0) * payload.quantity,
      delivery_round_id: payload.deliveryRoundId || product.delivery_round_id || 'round-1',
      scheduled_date: scheduleTarget,
      delivery_latitude: 10.7016,
      delivery_longitude: 102.1429,
      delivery_address: '',
      status: 'pending',
      special_instructions: '',
    })

    if (!preOrderRow) {
      showToast('à¸ªà¸£à¹‰à¸²à¸‡ pre-order à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ', 'error')
      return
    }
    showToast(`à¸ˆà¸­à¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆ! à¹€à¸¥à¸‚à¸—à¸µà¹ˆ ${preOrderRow.order_number} â€” ${product.name} à¸ˆà¸°à¸ªà¹ˆà¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆ ${scheduleTarget}`, 'success')
    navigate(`/track/${preOrderRow.order_number}`)
  }

  const handleReviewCta = (review: HomeReview) => {
    const product = products.find((p) => p.id === (review.relatedProduct?.id ?? review.relatedProductName ?? ''))
    const mode = product?.is_preorder ? 'pre-order' : 'same-day'
    if (product) {
      addItem(product, 1)
      showToast('à¹€à¸žà¸´à¹ˆà¸¡à¸¥à¸‡à¸•à¸°à¸à¸£à¹‰à¸²à¹à¸¥à¹‰à¸§!', 'success')
    }
    navigate(mode === 'pre-order' ? '/checkout?mode=pre-order' : '/cart?mode=same-day')
  }

  const sameDayItems = sameDay.map((item) => (
    <HomeProductCard key={item.id} item={item} onSameDay={handleSameDay} onPreOrder={handlePreOrder} />
  ))
  const preOrderItems = preOrder.map((item) => (
    <HomeProductCard key={item.id} item={item} onSameDay={handleSameDay} onPreOrder={handlePreOrder} />
  ))

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 min-h-screen flex items-center justify-center">
        <div className="text-center text-brand-muted">
          <div className="text-4xl mb-3 animate-float" role="img" aria-hidden="true">ðŸ»</div>
          <p>à¸à¸³à¸¥à¸±à¸‡à¹€à¸•à¸£à¸µà¸¢à¸¡à¹€à¸¡à¸™à¸¹à¹ƒà¸«à¹‰à¸ˆà¹‰à¸²â€¦</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-28 bg-organic min-h-screen">
{/* 1. Bite Conversational Hero */}
      <BiteHero message={biteMessage} pose={getBitePose(storeStatus.state)} />

      {/* 2. Store / Delivery Status â€” compact strip (replaces the 3-round grid) */}
      <StoreStatusStrip status={storeStatus} />

{/* 2b. Promotional banner — admin flags a promotion; customer can dismiss */}
      <HomeBanner promo={bannerPromo} />
      {/* 3. Same-day Menu â€” horizontal carousel */}
      <section className="mb-10 scroll-mt-20" aria-labelledby="home-sameday-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="home-sameday-heading" className="text-xl font-display font-bold text-brand-accent">
            ðŸ”¥ à¹€à¸¡à¸™à¸¹à¸§à¸±à¸™à¸™à¸µà¹‰
          </h2>
          <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">à¸”à¸¹à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” â†’</Link>
        </div>
        <HorizontalCarousel items={sameDayItems} aria-label="à¹€à¸¡à¸™à¸¹à¸§à¸±à¸™à¸™à¸µà¹‰ à¹€à¸¥à¸·à¹ˆà¸­à¸™à¹„à¸”à¹‰" />
      </section>

      {/* 4. Pre-order Menu â€” horizontal carousel */}
      {preOrder.length > 0 && (
        <section className="mb-10 scroll-mt-20" aria-labelledby="home-preorder-heading">
          <div className="flex items-center justify-between mb-2">
            <h2 id="home-preorder-heading" className="text-xl font-display font-bold text-brand-accent">
              ðŸ“… à¸ˆà¸­à¸‡à¸¥à¹ˆà¸§à¸‡à¸«à¸™à¹‰à¸²
            </h2>
            <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">à¸”à¸¹à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” â†’</Link>
          </div>
          <HorizontalCarousel items={preOrderItems} aria-label="à¹€à¸¡à¸™à¸¹à¸ˆà¸­à¸‡à¸¥à¹ˆà¸§à¸‡à¸«à¸™à¹‰à¸² à¹€à¸¥à¸·à¹ˆà¸­à¸™à¹„à¸”à¹‰" />
        </section>
      )}

      {/* 5. Drinks Menu â€” mockup carousel (owner edits src/lib/drinksMenu.ts) */}
      <DrinksSection />

      {/* 5b. Snacks â€” mockup carousel (owner edits src/lib/snacksMenu.ts) */}
      <SnacksSection />

      {/* 6. Social Proof Review Carousel */}
      <ReviewCarouselSection reviews={reviews} products={products} onReviewCta={handleReviewCta} />

      {/* 7. Promotions + Shared social action */}
      <PromotionStrip promotions={promotions} />
      <Link
        to="/share"
        className="share-card card flex items-center justify-between gap-3 px-4 py-3"
        aria-label="à¸Šà¸§à¸™à¹€à¸žà¸·à¹ˆà¸­à¸™à¸£à¸±à¸šà¸„à¸¹à¸›à¸­à¸‡"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl" aria-hidden="true">ðŸ‘¥</span>
          <div className="min-w-0">
            <p className="font-bold text-brand-accent">à¸Šà¸§à¸™à¹€à¸žà¸·à¹ˆà¸­à¸™ à¸£à¸±à¸šà¸„à¸¹à¸›à¸­à¸‡à¸„à¸™à¸¥à¸° à¸¿30</p>
            <p className="text-sm text-brand-muted truncate">à¹à¸Šà¸£à¹Œà¹ƒà¸«à¹‰à¹€à¸žà¸·à¹ˆà¸­à¸™à¸ªà¸±à¹ˆà¸‡ â€” à¹€à¸žà¸·à¹ˆà¸­à¸™à¹à¸¥à¸°à¸„à¸¸à¸“à¹„à¸”à¹‰à¸„à¸¹à¸›à¸­à¸‡</p>
          </div>
        </div>
        <span className="text-brand-primary font-medium whitespace-nowrap">à¹„à¸›à¸—à¸µà¹ˆà¸«à¸™à¹‰à¸²à¹à¸Šà¸£à¹Œ â†’</span>
      </Link>

      <FloatingCart />
    </div>
  )
}
