// ============================================
// Bite Me Baby — Menu Page (v2: FoodMenuCard + Product[])
// @see docs/COMPONENT_SPEC_UI.md v1.1 spec
// ============================================

import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Product, ProductCategory, SameDayOrderPayload, PreOrderPayload, AvailabilityState, OrderMode, DeliveryRound } from '@/types'
import { getProducts, getCategories, getDeliveryRounds } from '@/lib/bmbAdminApi_products'
import { buildHeadingGroups, headingChips, menuTabItems } from '@/lib/catalogStructure'
import { getProductScheduleMap, type ProductScheduleMap } from '@/lib/productSchedule'
import { useCartStore } from '@/store/cartStore'
import { showToast } from '@/components/ui/ToastContainer'
import { FoodMenuCard } from '@/components/FoodMenuCard'
import { MascotBadge } from '@/components/MascotBadge'
import { runOrderBuilder } from '@/lib/orderEntry'
import { deriveOrderMode } from '@/lib/talkToBite'
import { scrollMainToTop } from '@/lib/scrollTo'

const CATEGORY_ICONS = { all: '\uD83D\uDF3D', dish: '\uD83C\uDF5C', rice: '\uD83C\uDF5A', curry: '\uD83C\uDF5B', drink: '\uD83E\uDD64', dessert: '\uD83C\uDF70' }

export function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [menuTab, setMenuTab] = useState<'same-day' | 'pre-order'>('same-day') // ✓ v3.1: Tab switch
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [deliveryRounds, setDeliveryRounds] = useState<DeliveryRound[]>([]) // ✓ v3.1: Delivery rounds
  // วันจัดส่งจริงจาก menu_schedule (UX fix 2026-10-15 — ไม่ใช้ products.scheduled_date)
  const [scheduleMap, setScheduleMap] = useState<ProductScheduleMap>({})
  const addItem = useCartStore((s) => s.addItem)
  // ลิงก์ตรงจากฟุตเตอร์/ปุ่มแชร์: /menu?category=<slug หรือ id> → กรองหัวข้อเมนูให้ทันที
  const [searchParams, setSearchParams] = useSearchParams()

  function pickCategory(catId: string) {
    setSelectedCategory(catId)
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (catId === 'all') p.delete('category')
      else p.set('category', catId)
      return p
    }, { replace: true })
    // L-3: เลือกหัวข้อแล้วเลื่อนขึ้นบนเห็นหัวข้อ/รายการใหม่ (ไม่งั้นค้างมุมเก่า = นิ่ง)
    scrollMainToTop()
  }

  // ✓ Owner 2026-10-18: แท็บโหมด = มุมมองของ "ทั้งหมด" — กดแท็บแล้วออกจากหัวข้อที่เลือก
  // ไม่ให้สองตัวกรองแย่งกัน (หัวข้อ = แหล่งความจริงของรายการในหมวด)
  function switchTab(t: 'same-day' | 'pre-order') {
    setMenuTab(t)
    setSelectedCategory('all')
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.delete('category')
      p.set('tab', t)
      return p
    }, { replace: true })
    // L-3: สลับแท็บแล้วเลื่อนขึ้นบนเห็นรายการโหมดใหม่ทันที
    scrollMainToTop()
  }

  useEffect(() => {
    const want = searchParams.get('category')
    if (!want || categories.length === 0) return
    const cat = categories.find((c) => c.id === want) ?? categories.find((c) => c.slug === want)
    if (cat && cat.id !== selectedCategory) setSelectedCategory(cat.id)
  }, [categories])

  // ✓ Deep-link ?tab=pre-order (ปุ่มจองล่วงหน้า Footer/Home — Directive §8):
  // เข้า /menu แล้วต้องเปิด "แท็บจองล่วงหน้า" ให้ทันที ไม่ใช่ค้างที่แท็บวันนี้
  useEffect(() => {
    const wantTab = searchParams.get('tab')
    if (wantTab === 'pre-order' || wantTab === 'same-day') setMenuTab(wantTab)
  }, [searchParams])

  // ✓ R10 (Owner 2026-10-27): คูปองใช้ที่หน้าเช็คเอาท์อย่างเดียว — deep-link ?code=X
  // ไม่ apply จากนอกหน้าชำระเงินอีก (เดิม apply แล้วค้าง "ยังไม่เข้าเงื่อนไข") —
  // บอกทางไปเลือกโค้ดที่หน้าชำระเงินแทน
  useEffect(() => {
    const code = (searchParams.get('code') || '').trim()
    if (!code) return
    showToast(`โค้ด ${code} — เลือกใช้ได้ที่หน้าชำระเงิน (แตะกล่องคูปองแล้วเลือกจากรายการ)`, 'info')
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.delete('code')
      return p
    }, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    async function loadData() {
      try {
        const [products, cats, rounds] = await Promise.all([getProducts(), getCategories(), getDeliveryRounds()])
        setProducts(products)
        setCategories(cats)
        setDeliveryRounds(rounds)
        // ปฏิทินมุมการ์ด: วันจัดส่งจริงจาก menu_schedule (fire-and-forget — ไม่ขวางหน้า)
        void getProductScheduleMap().then(setScheduleMap).catch(() => setScheduleMap({}))
      } catch (err) {
        console.error('[MenuPage] Load error:', err)
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

  // ✓ v3.1: Filter by tab — canonical mode columns (migration 023), alias fallback
  // หัวข้อเมนู: เทียบด้วย category id ตรง ๆ (ค่าเดิมเทียบ slug slice ทำให้กดกรองแล้วเมนูหาย)
  // ✓ Owner 2026-10-18: เลือกหัวข้อไหน = โชว์ครบทุกจานในหัวข้อนั้น — แท็บโหมดกรองเฉพาะมุม
  // "ทั้งหมด" เท่านั้น (เดิมกรองซ้อนสองชั้น ทำให้กดหัวข้อ "จองล่วงหน้า / พรีออเดอร์"
  // แล้วเจอของไม่ครบ = งานซ้ำสองระบบแย่งกันกรอง)
  const filtered = products.filter((p) => {
    const isCalendar = !!scheduleMap[p.id] // Owner 2026-10-27: พรีออเดอร์ = เมนูตาราง (menu_schedule)
    const matchCat = selectedCategory === 'all' || String(p.category_id) === selectedCategory
    if (!matchCat) return false
    if (selectedCategory === 'all') {
      // แท็บโหมด = มุมมอง "ทั้งหมด" เท่านั้น (Owner 2026-10-18) — พรีออเดอร์ = เฉพาะ
      // เมนูปฏิทิน (ตรงกับหน้าเมนูตารางแอดมิน) · แท็บวันนี้ = เมนูสั่งทันทีที่เหลือ
      if (menuTab === 'same-day' && isCalendar) return false
      if (menuTab === 'pre-order' && !isCalendar) return false
    }
    return !p.archived && p.name.toLowerCase().includes(searchQuery.toLowerCase())
  })
  // แท็บจองล่วงหน้า: เรียงเมนูปฏิทินตามวันจัดส่ง (ใกล้ก่อน) — คงไว้ให้เสถียร
  const ordered = menuTab === 'pre-order'
    ? [...filtered].sort((a, b) => Number(!!scheduleMap[b.id]) - Number(!!scheduleMap[a.id]))
    : filtered

  const navigate = useNavigate()

  // Owner 2026-10-26: ปุ่ม "สั่งเลย / จองล่วงหน้า" ทุกปุ่มผ่านเส้นทางเดียว `runOrderBuilder`
  // (@/lib/orderEntry) — เดิมหน้านี้เก็บสำเนา logic เดียวกับ HomePage คนละชุด แก้ทีละที่แล้วพลาดบ่อย
  const handleSameDay = (payload: SameDayOrderPayload) => {
    console.log('[Log#same-day]', payload)
    runOrderBuilder({
      productId: payload.productId,
      products,
      mode: 'SAME_DAY',
      addItem,
      toast: showToast,
      navigate,
      notFound: 'ไม่พบเมนูที่ต้องการค่ะ',
      // P0 2026-10-14: เช็ค AddToCartResult ก่อน (แบบ HomePage RC-3/OD-4) —
      // ห้าม toast "Added" ทั้งที่ addItem ไม่ได้เพิ่มอะไร (blocked/context_blocked)
      blockedToast: (res) => ({
        message:
          res === 'context_blocked'
            ? 'เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่อีกครั้ง'
            : 'เพิ่มสินค้านี้ไม่ได้ในตอนนี้ — สินค้าอาจปิดขายอยู่',
        type: 'info',
      }),
      onAdded: (result) => {
        // Grab / 7-Eleven style upsell: toppings + recommended companions.
        showToast('Added: ' + result.product.name + (result.addOns.length > 0 ? ' (+toppings)' : '') + (result.recommended.length > 0 ? ' +' + result.recommended.length + ' recommended' : ''), 'success')
      },
    })
  }

  // ✓ Closure 2026-09-17: Pre-order flows through the canonical cart → /checkout?mode=pre-order
  // (ไม่มีการ insert ตาราง pre_orders จากหน้าเมนูเอง)
  const handlePreOrder = (payload: PreOrderPayload) => {
    console.log('[Log#pre-order]', payload)
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
      notFound: 'ไม่พบเมนูนี้',
      // P0 2026-10-14: เช็คผลก่อน navigate — ถ้าไม่ได้เพิ่มจริงห้ามส่งไป checkout
      // ทั้งที่ตะกร้าไม่มีสินค้า (ปุ่มกดแล้วไม่มีอะไรเข้าตะกร้า = อาการที่ Owner เจอ)
      blockedToast: (res) => ({
        message:
          res === 'context_blocked'
            ? 'เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่อีกครั้ง'
            : 'เพิ่มสินค้านี้ไม่ได้ในตอนนี้ — สินค้าอาจปิดขายอยู่',
        type: 'info',
      }),
      onAdded: () => {
        // Owner 2026-10-27: อย่าเพิ่งส่งไปเช็คเอาท์ — เพิ่มเมนูอื่น/สั่งทันทีเข้ารอบเดียวกันต่อได้
        showToast('เพิ่มลงตะกร้าแล้ว — เพิ่มเมนูอื่น/สั่งทันทีเข้ารอบเดียวกันได้อีก แล้วไปที่ตะกร้าเพื่อเช็คเอาท์ (วันจัดส่งถูกกำหนดโดยเมนูรอบพิเศษของแอดมิน)', 'info')
      },
    })
  }

  // ปุ่มกรองหัวข้อเมนู — L-4 (N-4 #4 · Owner 2026-10-26): "แสดงครบทุกหัวข้อ"
  // → chips โชว์ทุกหัวข้อที่มีสินค้า รวมหมวดโหมดขาย (ที่ render เป็น section ด้านล่างด้วย)
  // ให้แถวบนกระโดดได้ครบทุก section — เดิมกรองเฉพาะ auto ทำให้หัวข้อหมวดโหมดหายจากแถบบน
  // (L-7: ลำดับ = displayRank → ส่งวันนี้ → จองล่วงหน้า → สุขภาพ → ...)
  const chips = headingChips(categories, products)
  // ✅ Phase 3B: canonical mode columns (migration 023) — alias fallback kept.
  // L-4: ป้ายตัวเลขบนแท็บ = จำนวนที่แท็บนั้น "แสดงจริง" (สูตรเดียวกับ list)
  // Owner 2026-10-27: นับด้วย menu_schedule เดียวกับ list — พรีออเดอร์ = เมนูตาราง
  // (ปิดจุด "บางหน้าบอก 2 บางหน้าบอก 20")
  const sameDayCount = menuTabItems(products, 'same-day', searchQuery, scheduleMap).length
  const preOrderCount = menuTabItems(products, 'pre-order', searchQuery, scheduleMap).length

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 bg-brand-bg min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-brand-accent mb-4">เมนูอาหาร</h1>

        {/* ✓ v3.1: Tab switch (Same-day / Pre-order) */}
        <div className="flex gap-2 mb-4 bg-white p-1 rounded-xl">
          <button
            onClick={() => switchTab('same-day')}
            data-testid="same-day-tab"
            className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${menuTab === 'same-day' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-accent hover:bg-orange-50'}`}
          >
            🍽️ วันนี้ ({sameDayCount})
          </button>
          <button
            onClick={() => switchTab('pre-order')}
            data-testid="pre-order-tab"
            className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${menuTab === 'pre-order' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-accent hover:bg-orange-50'}`}
          >
            📅 จองล่วงหน้า ({preOrderCount})
          </button>
        </div>

        <div className="relative mb-4">
          <input type="text" placeholder="ค้นเมนู..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white focus:border-brand-primary outline-none transition-all" />
          <svg className="absolute left-3 top-3 w-5 h-5 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button onClick={() => pickCategory('all')} className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${selectedCategory === 'all' ? 'bg-brand-primary text-white shadow-md' : 'bg-white text-brand-accent hover:bg-orange-50'}`}>🜽 ทั้งหมด</button>
          {chips.map((cat) => (
            <button key={cat.id} onClick={() => pickCategory(cat.id)} className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${selectedCategory === cat.id ? 'bg-brand-primary text-white shadow-md' : 'bg-white text-brand-accent hover:bg-orange-50'}`}>{cat.icon} {cat.name}</button>
          ))}
        </div>
      </div>

      {/* ✓ v3.1: Pre-order info banner */}
      {menuTab === 'pre-order' && (
        <div className="mb-6 bg-blue-50 border-2 border-blue-200 p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <h3 className="font-bold text-blue-900 mb-1">จองล่วงหน้า (เมนูรอบพิเศษ)</h3>
              <p className="text-sm text-blue-700">เมนูจากปฏิทินรอบพิเศษของแอดมิน — วันจัดส่งถูกกำหนดตามป้ายมุมเมนู (เลือกเฉพาะรอบจัดส่ง) ไม่มีพรีออเดอร์วันอิสระ</p>
              {deliveryRounds.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {deliveryRounds.map((round) => (
                    <span key={round.id} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{round.display_name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ระบบหัวข้อเมนูเดียว (2026-10-17): หัวข้อ (หมวดหมู่) → การ์ด — ครบทุกเมนู
          ไม่มีชั้นซ้อน จัดกลุ่มด้วย buildHeadingGroups ตัวเดียวกับหน้าแรก */}
      {buildHeadingGroups(ordered, categories).map(({ category, products: catProducts }, gi) => (
        <section key={category.id} className="mb-8" aria-labelledby={`catsec-${gi}`}>
          <div className="mb-6">
            <h3 id={`catsec-${gi}`} className="font-semibold text-brand-accent mb-2">{category.icon ? `${category.icon} ` : ''}{category.name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {catProducts.map((product) => {
                // Owner 2026-10-27: ปุ่มของการ์ดตัดสินจาก "ป้ายปฏิทิน" (scheduledDate)
                // — ไม่มีป้าย = เมนูสั่งทันที (เข้ารอบพรีออเดอร์อัตโนมัติเมื่อตะกร้ามีพรี)
                const schedDate = scheduleMap[product.id]
                const mode: OrderMode = schedDate ? 'pre-order' : 'same-day'
                const preorderExpired = Boolean(
                  (product.available_preorder ?? product.is_preorder) &&
                  schedDate && schedDate < new Date().toLocaleDateString('en-CA'),
                )
                return (
                  <FoodMenuCard
                    key={product.id}
                    product={product}
                    category={category}
                    mode={mode}
                    tab={menuTab}
                    availability={product.is_available ? 'available' : 'sold_out'}
                    scheduledDate={schedDate}
                    preorderExpired={preorderExpired}
                    onSameDayOrder={handleSameDay}
                    onPreOrder={handlePreOrder}
                  />
                )
              })}
            </div>
          </div>
        </section>
      ))}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-display font-bold text-brand-accent mb-2">ไม่พบเมนู</h3>
          <p className="text-brand-muted">ลองเปลี่ยนคำค้นหาหรือหมวดหมู่</p>
        </div>
      )}
    </div>
  )
}
