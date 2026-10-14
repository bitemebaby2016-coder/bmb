// ============================================
// Bite Me Baby — Home Page "/shop" (UI v5 + Food Theater stage)
// Information Architecture (shorter + scan-able):
//   [1 Bite Food Theater (AI waiter stage × menu theater)] -> [2 Store/Delivery Status]
//   -> [3 Same-day Carousel] -> [4 Pre-order Carousel]
//   -> [5 Drinks Carousel (mockup)] -> [5b Snacks Carousel (mockup)]
//   -> [6 Social Proof Review Carousel]
//   -> [7 Promotions / Social]
// + FloatingCart. No low-stock dashboard, no long vertical grids.
// Business flows preserved: add-to-cart (cartStore), pre-order (createPreOrder),
// review deep-link (cart/checkout by mode).
// The full-screen Bite landing lives at "/" (TalkToBiteHomePage) — no duplicate here.
// ============================================

import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState, lazy, Suspense } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import {
  getHomeProducts,
  getHomeReviews,
  getStoreStatusFromRounds,
  getHomePromotionsFromRows,
} from '@/lib/homeProviders'
import { StoreStatusStrip } from '@/components/home/StoreStatusStrip'
import { FloatingAdBanners, type FloatingBannerPromo } from '@/components/home/FloatingAdBanners'
import { HorizontalCarousel } from '@/components/home/HorizontalCarousel'
import { HomeProductCard } from '@/components/home/HomeProductCard'
import { PromotionStrip } from '@/components/home/PromotionStrip'
import { BranchAwareProductCard } from '@/components/home/BranchAwareProductCard'
import { VerifiedReviewsSection } from '@/components/home/VerifiedReviewsSection'
import { ReviewCarouselSection } from '@/components/home/ReviewCarouselSection'
import { CategorySections } from '@/components/home/CategorySections'
import { FloatingCart, StickyCartBar } from '@/components/home/FloatingCart'
import { useOrderBuilderStore } from '@/store/orderBuilderStore'
import { useBrandContextStore } from '@/store/resolvedBrandStore'
import { filterProductsByBranch } from '@/lib/homeProviders'
import { deriveOrderMode } from '@/lib/talkToBite'
import {
  DEFAULT_HOME_POPULAR,
  DEFAULT_SITE_COPY,
  HOME_POPULAR_KEY,
  SITE_COPY_KEY,
  parseHomePopularConfig,
  parseSiteCopy,
  resolvePopularItems,
  toPopularHomeProduct,
  type HomePopularConfig,
  type SiteCopy,
} from '@/lib/homePopular'
import type { VerifiedCustomerReview, Product, ProductCategory, MenuSection, SameDayOrderPayload, PreOrderPayload, HomeReview } from '@/types'

// ⚡ The Food Theater stage is code-split (aiServerMemory chain); it renders
// real catalog picks + canonical cart actions as the first section of /shop.
const FoodTheater = lazy(() => import('@/components/theater/FoodTheater').then((m) => ({ default: m.FoodTheater })))

/** PRE_ORDER lead/date policy is DB-driven (order_policy) — no client hardcode.
 * The date is chosen in /checkout?mode=pre-order (server validates lead time). */

export function HomePage() {
  const addItem = useCartStore((s) => s.addItem)
  const navigate = useNavigate()
  const customer = useAuthStore((s) => s.customer)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  // B-fix (owner 2026-10-01): กลุ่มเมนู (menu_sections) — ให้ผลกับหน้าแรกเหมือนหน้าเมนู
  const [sections, setSections] = useState<MenuSection[]>([])
  const [rounds, setRounds] = useState<any[]>([])
  const [promoRows, setPromoRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  // CAT-04: verified customer reviews on homepage
  const [verifiedReviews, setVerifiedReviews] = useState<any[]>([])
  // "เมนูยอดนิยม" + ข้อความบนหน้า — แอดมินแก้ได้ที่หน้าแอดมิน (business_settings, ไม่ต้อง deploy)
  const [popularCfg, setPopularCfg] = useState<HomePopularConfig>(DEFAULT_HOME_POPULAR)
  const [siteCopy, setSiteCopy] = useState<SiteCopy>(DEFAULT_SITE_COPY)

  useEffect(() => {
    async function loadData() {
      try {
        // PERF: supabase chunks load only after first paint (kept off critical path).
        const { getProducts, getCategories, getSections } = await import('@/lib/bmbAdminApi_products')
        const { getDeliveryRoundsAdmin } = await import('@/lib/bmbAdminApi_rounds')
        const { getPromotionsAdmin } = await import('@/lib/bmbAdminApi_promotions')
        const [rows, cats, rounds, promos, secs] = await Promise.all([
          getProducts(),
          getCategories(),
          getDeliveryRoundsAdmin(),
          getPromotionsAdmin(),
          getSections().catch(() => []), // B-fix: กลุ่มเมนู — ถ้าโหลดไม่ได้แสดงแบบไม่มีกลุ่ม
        ])
        setProducts(rows)
        setCategories(cats)
        setRounds(rounds)
        setPromoRows(promos)
        setSections(secs)
        // ค่าตั้งเว็บ (เมนูยอดนิยม/ข้อความ) — โหลดแบบไม่ขวางการวาดหน้า (fire-and-forget)
        // ถ้าอ่านไม่สำเร็จ/ค้าง หน้ายังแสดงได้ตามค่า default เสมอ
        void (async () => {
          try {
            const { getBusinessSettings } = await import('@/lib/bmbAdminApi_settings')
            const settings = await getBusinessSettings()
            setPopularCfg(parseHomePopularConfig(settings?.[HOME_POPULAR_KEY]))
            setSiteCopy(parseSiteCopy(settings?.[SITE_COPY_KEY]))
          } catch { /* ใช้ค่า default ต่อไป */ }
        })()
        // CAT-04: Load verified reviews for all products
        const { getVerifiedReviewsForProducts } = await import('@/lib/reviewApi')
        const allProductIds = rows.map((r: any) => r.id)
        if (allProductIds.length > 0) {
          try {
            const verified = await getVerifiedReviewsForProducts(allProductIds.slice(0, 50), 50)
            setVerifiedReviews(verified)
          } catch(e) { console.warn('[HomePage] Verified reviews load failed:', e) }
        }
      } catch (err) {
        console.error('[HomePage] Load error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
    // P0 WS3: multi-tab/session freshness — refetch the live catalog whenever
    // this tab becomes visible again (Admin menu changes reflect without a
    // reload; each tab updates on its own next navigation/focus).
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadData()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const { sameDay, preOrder } = getHomeProducts(products, categories)
  const reviews = getHomeReviews(products)
  const promotions = getHomePromotionsFromRows(promoRows)

  // "เมนูยอดนิยม" — คัดจากทุกกลุ่ม/ทุกหมวด (รวมเมนูจองล่วงหน้า) แล้วสลับโชว์ตามรอบเวลา
  const popularCatMap = new Map(categories.map((c) => [c.id, c]))
  const popularAll = resolvePopularItems(products, categories, popularCfg)
    .map((p) => toPopularHomeProduct(p, popularCatMap.get(p.category_id)))

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
  const filteredPopular = popularAll.filter((item) => {
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

  const handleSameDay = (payload: SameDayOrderPayload) => {
    const product = products.find((p) => p.id === payload.productId)
    if (!product) {
      showToast('ไม่พบเมนูที่ต้องการค่ะ', 'error')
      return
    }
    // Grab / 7-Eleven style upsell: toppings + recommended companions.
    useOrderBuilderStore.getState().openBuilder(product, products, (result) => {
      const customizations: Record<string, any> = {}
      if (result.addOns.length > 0) {
        customizations['addOns'] = result.addOns.map((a) => ({ addonId: a.addonId, selections: a.selections, note: a.note ?? '' }))
      }
      // Phase 2 (RC-3): แจ้งผลตามจริง — ห้ามบอก "Added" เมื่อต้องยืนยันโหมดก่อน (OD-4)
      const res = addItem(result.product, result.quantity, customizations)
      if (res !== 'added') {
        showToast('ตะกร้ามีสินค้าอีกโหมดอยู่ — กรุณายืนยันการเปลี่ยนโหมดก่อนค่ะ', 'info')
        return
      }
      for (const rec of result.recommended) {
        addItem(rec, 1)
      }
      const extras = [
        result.addOns.length > 0 ? 'เพิ่มท็อปปิ้งแล้ว' : '',
        result.recommended.length > 0 ? `แนะนำเพิ่มอีก ${result.recommended.length} อย่าง` : '',
      ].filter(Boolean).join(' · ')
      showToast(`เพิ่ม ${result.product.name} ลงตะกร้าแล้ว${extras ? ' — ' + extras : ''}`, 'success')
    })
  }

  const handlePreOrder = (payload: PreOrderPayload) => {
    const product = products.find((p) => p.id === payload.productId)
    if (!product) {
      showToast('ไม่พบเมนูที่ต้องการค่ะ', 'error')
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
      // Phase 2 (RC-3 · OD-4): ต้องเช็ค AddToCartResult ก่อน navigate —
      // 'needs_confirmation' = ตะกร้าล็อกโหมดอื่นอยู่ → ห้ามสลับเงียบ ๆ ให้
      // CartIsolationModal ยืนยันตามกลไกเดิม แล้วค่อยสั่งต่อ (ห้าม navigate)
      const res = addItem(result.product, result.quantity, customizations, 'PRE_ORDER')
      if (res === 'needs_confirmation') {
        showToast('ตะกร้ามีสินค้าอีกโหมดอยู่ — กรุณายืนยันการเปลี่ยนโหมดก่อนสั่งค่ะ', 'info')
        return
      }
      if (res === 'context_blocked') {
        showToast('เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่ครับ', 'warning')
        return
      }
      for (const rec of result.recommended) addItem(rec, 1, {}, 'PRE_ORDER')
      showToast('เลือกวันที่/รอบ/ที่อยู่ แล้วชำระเงินเพื่อยืนยันการจอง', 'info')
      navigate('/checkout?mode=pre-order')
    })
  }

  const handleReviewCta = (review: HomeReview) => {
    const product = products.find((p) => p.id === (review.relatedProduct?.id ?? review.relatedProductName ?? ''))
    if (!product) {
      navigate('/cart')
      return
    }
    // Phase 1 (OD-3): canonical derive (matrix §3.1) — ไร้สิทธิ์ทั้งสองโหมด = ห้ามเพิ่ม/เสนอ
    // (เดิม fallback เป็น SAME_DAY แล้วถูก server reject ตอน checkout)
    const mode = deriveOrderMode(product)
    if (!mode) {
      showToast('สินค้านี้ยังไม่เปิดให้สั่งในขณะนี้ค่ะ', 'warning')
      return
    }
    const isPre = mode === 'PRE_ORDER'
    addItem(product, 1, {}, isPre ? 'PRE_ORDER' : 'SAME_DAY')
    showToast('เพิ่มลงตะกร้าแล้ว!', 'success')
    navigate(isPre ? '/checkout?mode=pre-order' : '/cart')
  }

  const popularItems = filteredPopular.map((item) => (
    <HomeProductCard key={item.id} item={item} mode="auto" onSameDay={handleSameDay} onPreOrder={handlePreOrder} />
  ))
  const sameDayItems = filteredSameDay.map((item) => (
    <HomeProductCard key={item.id} item={item} mode="same_day" onSameDay={handleSameDay} onPreOrder={handlePreOrder} />
  ))
  const preOrderItems = filteredPreOrder.map((item) => (
    <HomeProductCard key={item.id} item={item} mode="pre_order" onSameDay={handleSameDay} onPreOrder={handlePreOrder} />
  ))

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 min-h-screen flex items-center justify-center">
        <div className="text-center text-brand-muted">
          <img
            src="/assets/mascot/bite_cooking.webp"
            alt="น้อง Bite กำลังเตรียมเมนู"
            width={72}
            height={72}
            className="mx-auto mb-3 animate-float"
            style={{ objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/mascot_Bite_Main.webp' }}
          />
          <p>กำลังเตรียมเมนูให้จ้า…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-28 bg-organic min-h-screen">
      {/* SEO: Visually hidden H1 with primary keywords */}
      <h1 className="sr-only">Bite Me Baby — สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม. AI แนะนำเมนู 24/7</h1>
      
      {/* 1. BITE FOOD THEATER — food-first stage (replaces the duplicated Bite landing; the
          full-screen landing lives at "/", the conversation engine stays in TalkToBite) */}
      <Suspense fallback={null}>
        <FoodTheater products={products} onCustomize={handleSameDay} onPreOrder={handlePreOrder} />
      </Suspense>

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

      {/* 2c. Floating ad banners — max 2 overlay cards, dismissible per promo (sessionStorage, D03) */}
      <FloatingAdBanners promos={bannerPromos} notice={siteCopy.adNotice} />
      {/* 3. เมนูยอดนิยม — สลับโชว์จากทุกกลุ่มเมนู (รวมเมนูจองล่วงหน้า) */}
      <section className="mb-10 scroll-mt-20" aria-labelledby="home-popular-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="home-popular-heading" className="text-xl font-display font-bold text-brand-accent">
            🔥 {popularCfg.title}
          </h2>
          <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
        </div>
        <h3 className="sr-only">{popularCfg.title}</h3>
        <HorizontalCarousel items={popularItems} aria-label={`${popularCfg.title} เลื่อนได้`} />
      </section>

      {/* 3b. Same-day Menu — horizontal carousel */}
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
              📅 {siteCopy.homePreOrderTitle}
            </h2>
            <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
          </div>
          <h3 className="sr-only">เมนูล่วงหน้า</h3>
          <HorizontalCarousel items={preOrderItems} aria-label="เมนูจองล่วงหน้า เลื่อนได้" />
        </section>
      )}

      {/* 5. Category carousels — DB-driven: แสดงทุกหมวดที่แอดมินสร้าง (จานเดียว/เครื่องดื่ม/ของทานเล่น/ผลไม้/สินค้าสำเร็จรูป) ซิงก์จริง */}
      <CategorySections products={products} categories={categories} sections={sections} onSameDay={handleSameDay} onPreOrder={handlePreOrder} />

      {/* 6. Social Proof Review Carousel */}
      <ReviewCarouselSection reviews={reviews} products={products} onReviewCta={handleReviewCta} />

      {/* 6b. Real customer review photo gallery (lazy) */}
      {/* CAT-04: Verified Customer Reviews Section */}
        <VerifiedReviewsSection reviews={verifiedReviews} products={products} />

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

