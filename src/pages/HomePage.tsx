// ============================================
// Bite Me Baby — Home Page (UI v5)
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
import { FloatingAdBanners, type FloatingBannerPromo } from '@/components/home/FloatingAdBanners'
import { HorizontalCarousel } from '@/components/home/HorizontalCarousel'
import { HomeProductCard } from '@/components/home/HomeProductCard'
import { ReviewCarouselSection } from '@/components/home/ReviewCarouselSection'
import { ReviewGallerySection } from '@/components/home/ReviewGallerySection'
import { PromotionStrip } from '@/components/home/PromotionStrip'
import { DrinksSection } from '@/components/home/DrinksSection'
import { SnacksSection } from '@/components/home/SnacksSection'
import { FloatingCart, StickyCartBar } from '@/components/home/FloatingCart'
import { useOrderBuilderStore } from '@/store/orderBuilderStore'
import type {
  Product,
  ProductCategory,
  SameDayOrderPayload,
  PreOrderPayload,
  HomeReview,
} from '@/types'

/** PRE_ORDER lead/date policy is DB-driven (order_policy) — no client hardcode.
 * The date is chosen in /checkout?mode=pre-order (server validates lead time). */

export function HomePage() {
  const addItem = useCartStore((s) => s.addItem)
  const navigate = useNavigate()
  const customer = useAuthStore((s) => s.customer)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [rounds, setRounds] = useState<any[]>([])
  const [promoRows, setPromoRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

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

  // Filter products by search query and category
  const filteredSameDay = sameDay.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !activeCategory || item.category_id === activeCategory
    return matchesSearch && matchesCategory
  })
  const filteredPreOrder = preOrder.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !activeCategory || item.category_id === activeCategory
    return matchesSearch && matchesCategory
  })
  const bannerPromos: FloatingBannerPromo[] = (promoRows || [])
    .filter((r) => r.is_banner === true && r.is_active !== false)
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .map((r) => ({
      id: String(r.id),
      title: String(r.name || 'Promotion'),
      description: String(r.description || ''),
      coupon: r.code,
      image: r.banner_image,
    }))
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

  const handlePreOrder = (payload: PreOrderPayload) => {
    const product = products.find((p) => p.id === payload.productId)
    if (!product) {
      showToast('Item not found', 'error')
      return
    }
    // ✅ Phase 3B: PRE_ORDER flows through the canonical cart → /checkout?mode=pre-order.
    // Date + round + address + payment are chosen there; the SERVER (RPC
    // create_order_with_items, migration 025) is the only creation authority.
    useOrderBuilderStore.getState().openBuilder(product, products, (result) => {
      const customizations: Record<string, any> = {}
      if (result.addOns.length > 0) {
        customizations['addOns'] = result.addOns.map((a) => ({ addonId: a.addonId, selections: a.selections, note: a.note ?? '' }))
      }
      addItem(result.product, result.quantity, customizations, 'PRE_ORDER')
      for (const rec of result.recommended) addItem(rec, 1, {}, 'PRE_ORDER')
      showToast('เลือกวันที่/รอบ/ที่อยู่ แล้วชำระเงินเพื่อยืนยันการจอง', 'info')
      navigate('/checkout?mode=pre-order')
    })
  }

  const handleReviewCta = (review: HomeReview) => {
    const product = products.find((p) => p.id === (review.relatedProduct?.id ?? review.relatedProductName ?? ''))
    // ✅ Phase 3B: canonical mode columns drive the deep link (alias fallback).
    const isPre = !!(product && (product.available_preorder ?? product.is_preorder))
    if (product) {
      addItem(product, 1, {}, isPre ? 'PRE_ORDER' : 'SAME_DAY')
      showToast('เพิ่มลงตะกร้าแล้ว!', 'success')
    }
    navigate(isPre ? '/checkout?mode=pre-order' : '/cart')
  }

  const sameDayItems = filteredSameDay.map((item) => (
    <HomeProductCard key={item.id} item={item} onSameDay={handleSameDay} onPreOrder={handlePreOrder} />
  ))
  const preOrderItems = filteredPreOrder.map((item) => (
    <HomeProductCard key={item.id} item={item} onSameDay={handleSameDay} onPreOrder={handlePreOrder} />
  ))

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 min-h-screen flex items-center justify-center">
        <div className="text-center text-brand-muted">
          <div className="text-4xl mb-3 animate-float" role="img" aria-hidden="true">🐻</div>
          <p>กำลังเตรียมเมนูให้จ้า…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-28 bg-organic min-h-screen">
      {/* SEO: Visually hidden H1 with primary keywords */}
      <h1 className="sr-only">Bite Me Baby — สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม. AI แนะนำเมนู 24/7</h1>
      
      {/* 1. Bite Conversational Hero */}
      <BiteHero message={biteMessage} pose={getBitePose(storeStatus.state)} />

      {/* 2. Store / Delivery Status — compact strip (replaces the 3-round grid) */}
      <StoreStatusStrip status={storeStatus} />

      {/* 2b. Search & Category Filter Bar */}
      <section className="mb-6" aria-labelledby="home-search-heading">
        <h2 id="home-search-heading" className="sr-only">ค้นหาและกรองเมนู</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <label htmlFor="home-search" className="sr-only">ค้นหาเมนู</label>
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="home-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเมนู... (เช่น ไข่เจียว, ผัดไทย)"
              className="search-input w-full pl-10 pr-4 py-3 rounded-xl border border-brand-border bg-white text-brand-accent placeholder-brand-muted"
              aria-label="ค้นหาเมนู"
            />
          </div>
        </div>
        {categories.length > 0 && (
          <div className="category-chips flex gap-2 overflow-x-auto pb-2 mt-3" role="group" aria-label="กรองตามหมวดหมู่">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`category-chip whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${!activeCategory ? 'bg-brand-primary text-white' : 'bg-white text-brand-accent border border-brand-border'}`}
              aria-pressed={!activeCategory}
            >
              ทั้งหมด
            </button>
            {categories
              .filter((c) => c.is_active)
              .map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className={`category-chip whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === cat.id ? 'bg-brand-primary text-white' : 'bg-white text-brand-accent border border-brand-border'}`}
                  aria-pressed={activeCategory === cat.id}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
          </div>
        )}
      </section>

      {/* 2c. Floating ad banners — max 2 overlay cards, dismissible per promo (localStorage) */}
      <FloatingAdBanners promos={bannerPromos} />
      {/* 3. Same-day Menu — horizontal carousel */}
      <section className="mb-10 scroll-mt-20" aria-labelledby="home-sameday-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="home-sameday-heading" className="text-xl font-display font-bold text-brand-accent">
            🔥 เมนูวันนี้ — สั่งอาหารจัดส่งจันทบุรี ได้เลย
          </h2>
          <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
        </div>
        <h3 className="sr-only">เมนูวันนี้</h3>
        <HorizontalCarousel items={sameDayItems} aria-label="เมนูวันนี้ เลื่อนได้" />
      </section>

      {/* 4. Pre-order Menu — horizontal carousel */}
      {preOrder.length > 0 && (
        <section className="mb-10 scroll-mt-20" aria-labelledby="home-preorder-heading">
          <div className="flex items-center justify-between mb-2">
            <h2 id="home-preorder-heading" className="text-xl font-display font-bold text-brand-accent">
              📅 จองล่วงหน้า — สั่งอาหารจันทบุรี เตรียมพร้อมส่ง
            </h2>
            <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
          </div>
          <h3 className="sr-only">เมนูล่วงหน้า</h3>
          <HorizontalCarousel items={preOrderItems} aria-label="เมนูจองล่วงหน้า เลื่อนได้" />
        </section>
      )}

      {/* 5. Drinks Menu — mockup carousel (owner edits src/lib/drinksMenu.ts) */}
      <DrinksSection />

      {/* 5b. Snacks — mockup carousel (owner edits src/lib/snacksMenu.ts) */}
      <SnacksSection />

      {/* 6. Social Proof Review Carousel */}
      <ReviewCarouselSection reviews={reviews} products={products} onReviewCta={handleReviewCta} />

      {/* 6b. Real customer review photo gallery (lazy) */}
      <ReviewGallerySection />

      {/* 7. Promotions + Shared social action */}
      <PromotionStrip promotions={promotions} />
      <Link
        to="/share"
        className="share-card card flex items-center justify-between gap-3 px-4 py-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl" aria-hidden="true">👥</span>
          <div className="min-w-0">
            <p className="font-bold text-brand-accent">ชวนเพื่อน รับคูปองคนละ ฿30</p>
            <p className="text-sm text-brand-muted truncate">แชร์ให้เพื่อนสั่ง — เพื่อนและคุณได้คูปอง</p>
          </div>
        </div>
        <span className="text-brand-primary font-medium whitespace-nowrap">ไปที่หน้าแชร์ →</span>
      </Link>

      <FloatingCart />
      <StickyCartBar />
    </div>
  )
}
