// ============================================
// Bite Me Baby — Home Page "/shop" (UI v5 + Food Theater stage)
// Information Architecture (shorter + scan-able):
//   [1 Bite Food Theater (AI waiter stage × menu theater)] -> [2 Store/Delivery Status]
//   -> [2b Search + heading chips] -> [3 เมนูยอดนิยม (admin-curated spotlight)]
//   -> [4 หัวข้อเมนู rows — ตัวเดียวกับ /menu ครบทุกเมนู ไม่มีตัวซ้อน]
//   -> [5 Social Proof Review Carousel] -> [6 Promotions / Social]
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
// R21 Phase 3: โหลดหน้าแรกไม่สำเร็จต้องฟ้อง (ห้ามโชว์เหมือน "ไม่มีสินค้าเลย")
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'
import {
  getHomeReviews,
  getStoreStatusFromRounds,
  getHomePromotionsFromRows,
} from '@/lib/homeProviders'
import { publishDeliveryRounds } from '@/lib/storeStatus'
import { StoreStatusStrip } from '@/components/home/StoreStatusStrip'
import { FloatingAdBanners, type FloatingBannerPromo } from '@/components/home/FloatingAdBanners'
import { HorizontalCarousel } from '@/components/home/HorizontalCarousel'
import { HomeProductCard } from '@/components/home/HomeProductCard'
import { PromotionStrip } from '@/components/home/PromotionStrip'
import { VerifiedReviewsSection } from '@/components/home/VerifiedReviewsSection'
import { ReviewCarouselSection } from '@/components/home/ReviewCarouselSection'
import { ReviewGallerySection } from '@/components/home/ReviewGallerySection'
import { CategorySections } from '@/components/home/CategorySections'
import { FloatingCart, StickyCartBar } from '@/components/home/FloatingCart'
import { runOrderBuilder } from '@/lib/orderEntry'
import { deriveOrderMode } from '@/lib/talkToBite'
import { getProductScheduleMap, type ProductScheduleMap } from '@/lib/productSchedule'
import { headingChips } from '@/lib/catalogStructure'
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
import type { VerifiedCustomerReview, Product, ProductCategory, SameDayOrderPayload, PreOrderPayload, HomeReview } from '@/types'
import { preOrderEntryPath, saleModeOfCategory, withPreOrderTab } from '@/lib/catalogStructure'
import { scrollToSectionOrTop } from '@/lib/scrollTo'
import { hoursToMs } from '@/lib/shopHoursLogic'

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
  const [rounds, setRounds] = useState<any[]>([])
  const [promoRows, setPromoRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  // Owner (2026-10-25): แบนเนอร์ CTA พรีออเดอร์ (homePreOrderTitle) แสดง "เฉพาะตอนเปิดแท็บ
  // 📅 พรีออเดอร์" เท่านั้น — แท็บ/หน้าอื่นไม่ต้องแสดง (แก้ในไฟล์เดิม ไม่สร้างชิ้นงานใหม่)
  const [homeTab, setHomeTab] = useState<'all' | 'sameday' | 'preorder' | 'category'>('all')
  // CAT-04: verified customer reviews on homepage
  const [verifiedReviews, setVerifiedReviews] = useState<any[]>([])
  // "เมนูยอดนิยม" + ข้อความบนหน้า — แอดมินแก้ได้ที่หน้าแอดมิน (business_settings, ไม่ต้อง deploy)
  const [popularCfg, setPopularCfg] = useState<HomePopularConfig>(DEFAULT_HOME_POPULAR)
  const [siteCopy, setSiteCopy] = useState<SiteCopy>(DEFAULT_SITE_COPY)
  // R34: กติกาชวนเพื่อนจริงจากแอดมิน (referral_policy) — null = ยังไม่โหลด/อ่านไม่ได้ → ไม่โชว์จำนวนเงินปลอม
  const [referral, setReferral] = useState<{ enabled: boolean; referrer: number; friend: number } | null>(null)
  // วันจัดส่งจริงจาก menu_schedule (UX fix 2026-10-15 — ไม่ใช้ products.scheduled_date)
  const [scheduleMap, setScheduleMap] = useState<ProductScheduleMap>({})
  // SYNC (Owner 2026-10-26 "ต้องซิงค์ค่าที่แอดมินตั้งจริง"): เวลาเปิด/ปิด + ปุ่มเปิด/ปิด
  // อ่านจาก business_settings (แอดมินแก้ได้ที่หน้าแอดมิน ไม่ต้อง deploy)
  const [shopHours, setShopHours] = useState<{ open: string; close: string } | null>(null)
  const [operatingHours, setOperatingHours] = useState<Record<string, boolean> | null>(null)
  // R21 Phase 3: โหลดล้มเหลว ≠ ร้านไม่มีเมนู + key สำหรับกด "ลองใหม่"
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function loadData() {
      setLoadError('')
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
        publishDeliveryRounds(rounds) // มาสคอตทุกหน้าใช้สถานะเปิด/ปิดเดียวกับแถบร้าน
        setPromoRows(promos)
        // ค่าตั้งเว็บ (เมนูยอดนิยม/ข้อความ) — โหลดแบบไม่ขวางการวาดหน้า (fire-and-forget)
        // ถ้าอ่านไม่สำเร็จ/ค้าง หน้ายังแสดงได้ตามค่า default เสมอ
        void (async () => {
          try {
            const { getBusinessSettings } = await import('@/lib/bmbAdminApi_settings')
            const settings = await getBusinessSettings()
            const rp = settings?.['referral_policy'] as { enabled?: boolean; referrer_reward_baht?: number; friend_reward_baht?: number } | undefined
      if (rp && typeof rp === 'object') {
        // R34: การ์ดชวนเพื่อนใช้กติกาจริงจากแอดมิน (business_settings.referral_policy — anon อ่านได้)
        setReferral({ enabled: rp.enabled !== false, referrer: Number(rp.referrer_reward_baht) || 0, friend: Number(rp.friend_reward_baht) || 0 })
      }
      setPopularCfg(parseHomePopularConfig(settings?.[HOME_POPULAR_KEY]))
            setSiteCopy(parseSiteCopy(settings?.[SITE_COPY_KEY]))
            // SYNC: เวลาเปิด/ปิด (hours) + ปุ่มเปิด/ปิด (operating_hours) — แอดมินคนเดียวกับที่ตั้งค่าจริง
            const sh = settings?.hours as { open?: string; close?: string } | undefined
            if (sh && typeof sh.open === 'string' && typeof sh.close === 'string') {
              setShopHours({ open: sh.open, close: sh.close })
            }
            setOperatingHours((settings?.operating_hours ?? null) as Record<string, boolean> | null)
          } catch { /* ใช้ค่า default ต่อไป */ }
        })()
        // ปฏิทินมุมการ์ด: วันจัดส่งจริงจาก menu_schedule (fire-and-forget — ไม่ขวางหน้า)
        void getProductScheduleMap().then(setScheduleMap).catch(() => setScheduleMap({}))
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
        setLoadError('โหลดหน้าแรกไม่สำเร็จ — ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วกด "ลองใหม่"')
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
  }, [reloadKey])

  const reviews = getHomeReviews(products)
  const promotions = getHomePromotionsFromRows(promoRows)

  // "เมนูยอดนิยม" — คัดจากทุกหมวด (รวมเมนูจองล่วงหน้า) แล้วสลับโชว์ตามรอบเวลา
  // R34: ส่ง scheduleMap ด้วย — เมนูพรีออเดอร์ที่ยังไม่ลงปฏิทินรอบถัดไป = ไม่โชว์ในช่องนี้
  const popularCatMap = new Map(categories.map((c) => [c.id, c]))
  const popularAll = resolvePopularItems(products, categories, popularCfg, undefined, scheduleMap)
    .map((p) => toPopularHomeProduct(p, popularCatMap.get(p.category_id), scheduleMap))
  // ปุ่มกรองหัวข้อเมนู — กติกาเดียวกับแถวหัวข้อด้านล่าง (หัวข้อว่าง = ซ่อน)
  // Owner (2026-10-25): หมวดโหมดขาย = ความหมายเดียวกับแท็บ 🛵 ส่งวันนี้ / 📅 พรีออเดอร์
  // ("มันคืออันเดียวกัน") → ไม่โชว์ซ้ำในแถวแท็บ — เซกชันโหมดด้านล่างรับผิดชอบเอง
  const chips = headingChips(categories, products).filter((c) => saleModeOfCategory(c) === 'auto')

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
  const storeStatus = getStoreStatusFromRounds(rounds, new Date(), {
    shopHoursMs: hoursToMs(shopHours),
    operatingHours,
    hoursClose: shopHours?.close,
  })

  const handleSameDay = (payload: SameDayOrderPayload) => {
    // Owner 2026-10-26: ทุกปุ่มสั่งซื้อของร้านผ่านเส้นทางเดียว runOrderBuilder (@/lib/orderEntry)
    // หน้าหนึ่ง ๆ เหลือแค่เลือกข้อความ toast (presentation) — ไม่มีสำเนา logic ก๊อปปี้อีกต่อไป
    runOrderBuilder({
      productId: payload.productId,
      products,
      mode: 'SAME_DAY',
      addItem,
      toast: showToast,
      navigate,
      notFound: 'ไม่พบเมนูที่ต้องการค่ะ',
      // Phase 2 (RC-3): แจ้งผลตามจริง — ห้ามบอก "Added" เมื่อ addItem ไม่ได้เพิ่มจริง
      blockedToast: () => ({
        message: 'เพิ่มไม่ได้ในตอนนี้ — สินค้าอาจปิดขายอยู่ กรุณาลองใหม่ครับ',
        type: 'info',
      }),
      onAdded: (result) => {
        // Grab / 7-Eleven style upsell: toppings + recommended companions.
        const extras = [
          result.addOns.length > 0 ? 'เพิ่มท็อปปิ้งแล้ว' : '',
          result.recommended.length > 0 ? `แนะนำเพิ่มอีก ${result.recommended.length} อย่าง` : '',
        ].filter(Boolean).join(' · ')
        showToast(`เพิ่ม ${result.product.name} ลงตะกร้าแล้ว${extras ? ' — ' + extras : ''}`, 'success')
      },
    })
  }

  const handlePreOrder = (payload: PreOrderPayload) => {
    // ✅ Phase 3B: PRE_ORDER flows through the canonical cart → /checkout?mode=pre-order.
    // Date + round + address + payment are chosen there; the SERVER (RPC
    // create_order_with_items, migration 025) is the only creation authority.
    // R5c: ไม่มีป๊อปอัปล้างตะกร้า/สลับโหมดแล้ว — สินค้าทั่วไปติดรอบพรีออเดอร์ในออเดอร์เดียว
    // L-8 (N-4 #8 · Owner 2026-10-26): pre-order-only ที่ยังไม่ลงปฏิทิน/เลยรอบ → ห้ามเข้า builder
    const preProduct = products.find((p) => p.id === payload.productId)
    if (preProduct && deriveOrderMode(preProduct) === 'PRE_ORDER' && !scheduleMap[preProduct.id]) {
      showToast('เมนูนี้ยังไม่ลงปฏิทินรอบถัดไป — ยังจองไม่ได้', 'warning')
      return
    }
    runOrderBuilder({
      productId: payload.productId,
      products,
      mode: 'PRE_ORDER',
      addItem,
      toast: showToast,
      navigate,
      notFound: 'ไม่พบเมนูที่ต้องการค่ะ',
      blockedToast: (res) => ({
        message:
          res === 'context_blocked'
            ? 'เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่ครับ'
            : 'เพิ่มไม่ได้ในตอนนี้ — สินค้าอาจปิดขายอยู่ กรุณาลองใหม่ครับ',
        type: 'warning',
      }),
      onAdded: () => {
        // Owner 2026-10-27: อย่าเพิ่งส่งไปเช็คเอาท์ — เพิ่มเมนูอื่น/สั่งทันทีเข้ารอบเดียวกันต่อได้
        showToast(
          'เพิ่มลงตะกร้าแล้ว — เพิ่มเมนูอื่น/สั่งทันทีเข้ารอบเดียวกันได้อีก แล้วไปที่ตะกร้าเพื่อเช็คเอาท์ (วันจัดส่งถูกกำหนดโดยเมนูรอบพิเศษของแอดมิน)',
          'info',
        )
      },
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
    // L-8 (N-4 #8): pre-order-only ที่ยังไม่ลงปฏิทิน → ห้ามกดจากปุ่มรีวิวด้วย (ทุกจุดเท่ากัน)
    if (isPre && !scheduleMap[product.id]) {
      showToast('เมนูนี้ยังไม่ลงปฏิทินรอบถัดไป — ยังจองไม่ได้', 'warning')
      return
    }
    // OD-4 / RC-3 contract เดียวกับปุ่มสั่งซื้อปุ่มอื่น: ต้องเช็ค AddToCartResult
    // ก่อนบอกผู้ใช้ว่า "เพิ่มแล้ว" และก่อน navigate (เดิมบรรทัดนี้ไม่เช็คผลเลย)
    const res = addItem(product, 1, {}, isPre ? 'PRE_ORDER' : 'SAME_DAY')
    if (res !== 'added') {
      showToast(
        res === 'context_blocked'
          ? 'เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่ครับ'
          : 'สินค้านี้ยังไม่เปิดให้สั่งในขณะนี้ค่ะ',
        'warning',
      )
      return
    }
    showToast('เพิ่มลงตะกร้าแล้ว!', 'success')
    navigate(isPre ? '/checkout?mode=pre-order' : '/cart')
  }

  const popularItems = filteredPopular.map((item) => (
    <HomeProductCard key={item.id} item={item} mode="auto" onSameDay={handleSameDay} onPreOrder={handlePreOrder} />
  ))

  // Feature B (Owner 2026-10-25): sections ส่งวันนี้ + พรีออเดอร์ (ลำดับ 2-3 ของหน้าแรก)
  const catById = new Map(categories.map((c) => [c.id, c] as const))
  const toShowcaseCard = (p: Product) => toPopularHomeProduct(p, catById.get(p.category_id), scheduleMap)
  // Owner (2026-10-25): หมวดโหมดขาย (ส่งวันนี้/Same Day · จองล่วงหน้า/พรีออเดอร์) = ความหมาย
  // เดียวกับเซกชัน/แท็บโหมด → หัวข้อซ้ำถูกถอด (CategorySections กรองออก) และ "สินค้าของหมวดนั้น
  // ถูกย้ายเข้า showcase โหมด" โดยหมวดตัวเองเรียงมาก่อน slice(8) — ไม่มีเมนูหายจากหน้าแรก
  const aliasModeOf = (p: Product) => {
    const c = catById.get(p.category_id)
    return c ? saleModeOfCategory(c) : 'auto'
  }
  const sellable = (p: Product) => p.is_available && !p.archived
  const dedupe = (rows: Product[]) => rows.filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i)
  const sameDayShowcase = dedupe([
    ...products.filter((p) => sellable(p) && aliasModeOf(p) === 'same_day'),
    ...products.filter((p) => sellable(p) && aliasModeOf(p) === 'auto' && (p.available_same_day ?? !p.is_preorder)),
  ])
    .slice(0, 8)
    .map(toShowcaseCard)
  const preOrderShowcase = dedupe([
    ...products.filter((p) => sellable(p) && aliasModeOf(p) === 'pre_order'),
    ...products.filter((p) => sellable(p) && aliasModeOf(p) === 'auto' && !!scheduleMap[p.id]),
  ])
    // R35 (Owner): เมนูพรีออเดอร์ "วันใกล้วันปัจจุบัน" ขึ้นโชว์ก่อน — เรียงวันจัดส่ง (ใกล้ก่อน) · ยังไม่มีป้ายวัน = ท้ายแถว
    .sort((a, b) => {
      const da = scheduleMap[a.id] ?? ''
      const db = scheduleMap[b.id] ?? ''
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return da.localeCompare(db)
    })
    .slice(0, 8)
    .map(toShowcaseCard)

  // Rule 12.3 (Owner 2026-10-25): แท็บลิงก์ = smooth-scroll ไป section ที่ทำงาน
  // L-3 (N-4 #3 · Owner 2026-10-26): ถ้า section เป้าหมายไม่มีจริง → fallback
  // เลื่อนขึ้นด้านบนของหน้า — "ห้ามจิ้มแล้วนิ่ง"
  const scrollToSection = (id: string) => scrollToSectionOrTop(id)

  // R34 (Owner): หัวข้อเซกชันโหมดหน้าแรก = ชื่อ+ไอคอนหมวดจากแอดมิน (ที่เดียวกับ /menu) — แอดมินแก้ชื่อหมวด = สองหน้าเปลี่ยนพร้อมกัน
  const modeSectionTitle = (mode: ReturnType<typeof saleModeOfCategory>, fallback: string): string => {
    const c = categories.find((x) => saleModeOfCategory(x) === mode)
    return c ? `${c.icon ? c.icon + ' ' : ''}${c.name}` : fallback
  }
  const sameDaySectionTitle = modeSectionTitle('same_day', '电动车 ส่งวันนี้')
  const preOrderSectionTitle = modeSectionTitle('pre_order', '📅 พรีออเดอร์')

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
    <div id="home-sec-top" className="max-w-7xl mx-auto px-4 py-6 pb-28 bg-organic min-h-screen">
      {/* SEO: Visually hidden H1 with primary keywords */}
      <h1 className="sr-only">Bite Me Baby — สั่งอาหารจัดส่งเมืองจันทบุรี AI แนะนำเมนู 24/7</h1>

      {loadError && (
        <div className="mb-4">
          <LoadErrorBanner message={loadError} onRetry={() => setReloadKey((n) => n + 1)} testId="home-load-error" />
        </div>
      )}

      {/* 1. BITE FOOD THEATER — food-first stage (replaces the duplicated Bite landing; the
          full-screen landing lives at "/", the conversation engine stays in TalkToBite) */}
      <Suspense fallback={null}>
        <FoodTheater products={products} schedule={scheduleMap} onCustomize={handleSameDay} onPreOrder={handlePreOrder} />
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
              placeholder="ค้นหาเมนู... (เช่น ก๋วยเตี๋ยวลุยสวน, ปลาต้มผักกาดดองเสฉวน)"
              className="search-input w-full pl-10 pr-4 py-3 rounded-xl border border-brand-border bg-white text-brand-accent placeholder-brand-muted"
              aria-label="ค้นหาเมนู"
            />
          </div>
        </div>
        <div className="category-chips flex gap-2 overflow-x-auto pb-2 mt-3" role="group" aria-label="แท็บลิงก์หมวดหมู่เมนู">
            {/* Feature B (Owner 2026-10-25): แท็บแนวนอน = ลิงก์ smooth-scroll ตามลำดับที่กำหนด */}
            <button
              type="button"
              data-testid="home-tab-all"
              onClick={() => { setHomeTab('all'); scrollToSection('home-sec-top') }}
              className="category-chip whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors bg-white text-brand-accent border border-brand-border"
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              data-testid="home-tab-sameday"
              onClick={() => { setHomeTab('sameday'); scrollToSection('home-sec-sameday') }}
              className="category-chip whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors bg-white text-brand-accent border border-brand-border"
            >
              {sameDaySectionTitle}
            </button>
            <button
              type="button"
              data-testid="home-tab-preorder"
              onClick={() => { setHomeTab('preorder'); scrollToSection('home-sec-preorder') }}
              className="category-chip whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors bg-white text-brand-accent border border-brand-border"
            >
              {preOrderSectionTitle}
            </button>
            {chips.map((cat) => (
              <button
                key={cat.id}
                type="button"
                data-testid={`home-tab-cat-${cat.id}`}
                onClick={() => { setHomeTab('category'); scrollToSection(`home-cat-${cat.id}`) }}
                className="category-chip whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors bg-white text-brand-accent border border-brand-border"
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
      </section>

      {/* 2c. Floating ad banners — max 2 overlay cards, dismissible per promo (sessionStorage, D03) */}
      <FloatingAdBanners promos={bannerPromos} notice={siteCopy.adNotice} />

      {/* 2d. เดิม = แบนเนอร์ CTA พรีออเดอร์ลอยเหนือหน้า — Owner (2026-10-25): ย้ายไปแสดง
          "เฉพาะตอนเปิดแท็บ 📅 พรีออเดอร์" ในหมวดพรีออเดอร์ (ด้านล่าง) — แท็บ/หน้าอื่นไม่แสดง */}
      {/* 3. เมนูแนะนำ (แนะนำ/ยอดนิยม) — ลำดับ 1 ของเมนู (Feature B 2026-10-25) */}
      <section id="home-sec-recommended" className="mb-10 scroll-mt-20" aria-labelledby="home-popular-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="home-popular-heading" className="text-xl font-display font-bold text-brand-accent">
            🔥 {popularCfg.title}
          </h2>
          <Link to="/menu" className="text-sm text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
        </div>
        <h3 className="sr-only">{popularCfg.title}</h3>
        <HorizontalCarousel items={popularItems} aria-label={`${popularCfg.title} เลื่อนได้`} />
      </section>

      {/* 4. ส่งวันนี้ (Feature B: ลำดับ 2) — เมนูสั่งวันนี้ */}
      <section id="home-sec-sameday" className="mb-10 scroll-mt-20" aria-labelledby="home-sameday-heading">
        <h2 id="home-sameday-heading" className="text-xl font-display font-bold text-brand-accent mb-2">{sameDaySectionTitle}</h2>
        {sameDayShowcase.length > 0 ? (
          <HorizontalCarousel
            items={sameDayShowcase.map((item) => (
              <HomeProductCard key={item.id} item={item} mode="auto" onSameDay={handleSameDay} onPreOrder={handlePreOrder} />
            ))}
            aria-label="เมนูส่งวันนี้ เลื่อนได้"
          />
        ) : (
          <p className="text-sm text-brand-muted">ยังไม่มีเมนูส่งวันนี้</p>
        )}
      </section>

      {/* 5. พรีออเดอร์ (Feature B: ลำดับ 3) — เมนูจองล่วงหน้า (ผูกปฏิทินแอดมิน) */}
      <section id="home-sec-preorder" className="mb-10 scroll-mt-20" aria-labelledby="home-preorder-heading">
        <h2 id="home-preorder-heading" className="text-xl font-display font-bold text-brand-accent mb-2">{preOrderSectionTitle}</h2>
        {/* Owner (2026-10-25): CTA พรีออเดอร์ (Directive §8 เดิม — workflow preOrderEntryPath เดียวกัน
            + หัวข้อแก้ได้ในแอดมิน homePreOrderTitle) — แสดงเฉพาะตอนเปิดแท็บ "📅 พรีออเดอร์" เท่านั้น */}
        {homeTab === 'preorder' && (
          <div className="rounded-2xl border border-brand-border bg-white p-4 flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 id="home-preorder-entry-heading" className="font-bold text-brand-accent">📅 {siteCopy.homePreOrderTitle}</h3>
              <p className="text-sm text-brand-muted">เลือกวันและรอบจัดส่งล่วงหน้าตามรอบที่ร้านเปิดรับ</p>
            </div>
            <Link to={withPreOrderTab(preOrderEntryPath(categories))} data-testid="home-preorder-entry" className="btn btn-primary">
              เลือกเมนูจองล่วงหน้า →
            </Link>
          </div>
        )}
        {preOrderShowcase.length > 0 ? (
          <HorizontalCarousel
            items={preOrderShowcase.map((item) => (
              <HomeProductCard key={item.id} item={item} mode="auto" onSameDay={handleSameDay} onPreOrder={handlePreOrder} />
            ))}
            aria-label="เมนูพรีออเดอร์ เลื่อนได้"
          />
        ) : (
          <p className="text-sm text-brand-muted">ยังไม่มีเมนูพรีออเดอร์ — แอดมินเพิ่มได้จากตารางเมนูรอบพิเศษ</p>
        )}
      </section>

      {/* 4. หัวข้อเมนู — ตัวจัดกลุ่มเดียวกับ /menu (buildHeadingGroups) — ครบทุกเมนู
          ไม่มีตัวซ้อน: เมนูจองล่วงหน้าแสดงในหัวข้อของตัวเอง + ปุ่ม 📅 ต่อการ์ด
          (แยกแท็บจองล่วงหน้าอยู่ที่ /menu ตามเดิม) */}
      <CategorySections products={products} categories={categories} schedule={scheduleMap} onSameDay={handleSameDay} onPreOrder={handlePreOrder} />

      {/* 6. Social Proof Review Carousel */}
      <ReviewCarouselSection reviews={reviews} products={products} onReviewCta={handleReviewCta} />

      {/* 6b. Real customer review photo gallery (lazy) — R34: mount ของจริง 32 ใบ (เดิมมี comment แต่ไม่ได้ render) */}
      <ReviewGallerySection />
      {/* CAT-04: Verified Customer Reviews Section */}
        <VerifiedReviewsSection reviews={verifiedReviews} products={products} />

      {/* 7. Promotions + Shared social action */}
      <PromotionStrip promotions={promotions} />
      {/* R34 (Owner): การ์ดชวนเพื่อน = กติกาจริงจากแอดมิน — ปิดนโยบาย = ไม่โชว์ · ยังโหลดไม่ถึง = ไม่โชว์เงินปลอม */}
      {referral?.enabled && (
        <Link
          to="/share"
          className="share-card card flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl" aria-hidden="true">👥</span>
            <div className="min-w-0">
              <p className="font-bold text-brand-accent">
                {referral && referral.referrer > 0 && referral.referrer === referral.friend
                  ? `ชวนเพื่อน รับคูปองคนละ ฿${referral.friend}`
                  : referral && referral.referrer > 0 && referral.friend > 0
                    ? `ชวนเพื่อน คุณได้ ฿${referral.referrer} · เพื่อนได้ ฿${referral.friend}`
                    : 'ชวนเพื่อน รับคูปอง'}
              </p>
              <p className="text-sm text-brand-muted truncate">แชร์ให้เพื่อนสั่ง — เงื่อนไขตามที่ร้านกำหนด</p>
            </div>
          </div>
          <span className="text-brand-primary font-medium whitespace-nowrap">ไปที่หน้าแชร์ →</span>
        </Link>
      )}

      <FloatingCart />
      <StickyCartBar />
    </div>
  )
}

