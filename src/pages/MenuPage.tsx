// ============================================
// Bite Me Baby — Menu Page (v2: FoodMenuCard + Product[])
// @see docs/COMPONENT_SPEC_UI.md v1.1 spec
// ============================================

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Product, ProductCategory, SameDayOrderPayload, PreOrderPayload, AvailabilityState, OrderMode, DeliveryRound } from '@/types'
import { getProducts, getCategories, getDeliveryRounds } from '@/lib/bmbAdminApi_products'
import { buildHeadingGroups, headingChips } from '@/lib/catalogStructure'
import { getProductScheduleMap, type ProductScheduleMap } from '@/lib/productSchedule'
import { useCartStore } from '@/store/cartStore'
import { showToast } from '@/components/ui/ToastContainer'
import { FoodMenuCard } from '@/components/FoodMenuCard'
import { MascotBadge } from '@/components/MascotBadge'
import { useOrderBuilderStore } from '@/store/orderBuilderStore'

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
  const filtered = products.filter((p) => {
    const isPre = p.available_preorder ?? p.is_preorder
    const isSame = p.available_same_day ?? !p.is_preorder
    if (menuTab === 'same-day' && !isSame) return false
    if (menuTab === 'pre-order' && !isPre) return false
    const matchCat = selectedCategory === 'all' || String(p.category_id) === selectedCategory
    return matchCat && !p.archived && p.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleSameDay = (payload: SameDayOrderPayload) => {
    console.log('[Log#same-day]', payload)
    const product = products.find(p => p.id === payload.productId)
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
      // P0 2026-10-14: เช็ค AddToCartResult ก่อน (แบบ HomePage RC-3/OD-4) —
      // ห้าม toast "Added" ทั้งที่ addItem ไม่ได้เพิ่มอะไร (blocked/needs_confirmation/context_blocked)
      const res = addItem(result.product, result.quantity, customizations)
      if (res !== 'added') {
        showToast(
          res === 'needs_confirmation'
            ? 'ตะกร้ามีสินค้าอีกโหมดอยู่ — กรุณายืนยันการเปลี่ยนโหมดก่อนค่ะ'
            : res === 'context_blocked'
              ? 'เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่อีกครั้ง'
              : 'เพิ่มสินค้านี้ไม่ได้ในโหมดนี้ — สินค้าอาจไม่เปิดขายในโหมดที่เลือก',
          'info',
        )
        return
      }
      for (const rec of result.recommended) addItem(rec, 1)
      showToast('Added: ' + result.product.name + (result.addOns.length > 0 ? ' (+toppings)' : '') + (result.recommended.length > 0 ? ' +' + result.recommended.length + ' recommended' : ''), 'success')
    })
  }

  const navigate = useNavigate()

  // ✓ Closure 2026-09-17: Pre-order creates a REAL order (pre_orders table via
  // createPreOrder — Supabase + localStorage fallback), NOT just a toast.
  const handlePreOrder = (payload: PreOrderPayload) => {
    console.log('[Log#pre-order]', payload)
    const product = products.find(p => p.id === payload.productId)
    if (!product) {
      showToast('ไม่พบเมนูนี้', 'error')
      return
    }
    // ✅ Phase 3B: PRE_ORDER no longer creates rows directly from product cards.
    // It flows through the canonical cart → /checkout?mode=pre-order, where the
    // customer picks date + round + address + payment and the SERVER (RPC
    // create_order_with_items, migration 025) remains the only authority.
    useOrderBuilderStore.getState().openBuilder(product, products, (result) => {
      const customizations: Record<string, any> = {}
      if (result.addOns.length > 0) {
        customizations['addOns'] = result.addOns.map((a) => ({ addonId: a.addonId, selections: a.selections, note: a.note ?? '' }))
      }
      // P0 2026-10-14: เช็คผลก่อน navigate — ถ้าไม่ได้เพิ่มจริงห้ามส่งไป checkout
      // ทั้งที่ตะกร้าไม่มีสินค้า (ปุ่มกดแล้วไม่มีอะไรเข้าตะกร้า = อาการที่ Owner เจอ)
      const res = addItem(result.product, result.quantity, customizations, 'PRE_ORDER')
      if (res !== 'added') {
        showToast(
          res === 'needs_confirmation'
            ? 'ตะกร้ามีสินค้าอีกโหมดอยู่ — กรุณายืนยันการเปลี่ยนโหมดก่อนค่ะ'
            : res === 'context_blocked'
              ? 'เพิ่มไม่ได้ในตอนนี้ กรุณาลองใหม่อีกครั้ง'
              : 'เพิ่มสินค้านี้ไม่ได้ในโหมดนี้ — สินค้าอาจไม่เปิดขายในโหมดที่เลือก',
          'info',
        )
        return
      }
      for (const rec of result.recommended) addItem(rec, 1, {}, 'PRE_ORDER')
      showToast('เลือกวันที่/รอบ/ที่อยู่ แล้วชำระเงินเพื่อยืนยันการจอง', 'info')
      navigate('/checkout?mode=pre-order')
    })
  }

  // ปุ่มกรองหัวข้อเมนู — กติกาเดียวกับหน้าแรก (หัวข้อว่าง = ซ่อน)
  const chips = headingChips(categories, products)
  // ✅ Phase 3B: canonical mode columns (migration 023) — alias fallback kept.
  const sameDayCount = products.filter(p => (p.available_same_day ?? !p.is_preorder) && p.is_available).length
  const preOrderCount = products.filter(p => (p.available_preorder ?? p.is_preorder)).length

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 bg-brand-bg min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-brand-accent mb-4">เมนูอาหาร</h1>

        {/* ✓ v3.1: Tab switch (Same-day / Pre-order) */}
        <div className="flex gap-2 mb-4 bg-white p-1 rounded-xl">
          <button
            onClick={() => setMenuTab('same-day')}
            data-testid="same-day-tab"
            className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${menuTab === 'same-day' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-accent hover:bg-orange-50'}`}
          >
            🍽️ วันนี้ ({sameDayCount})
          </button>
          <button
            onClick={() => setMenuTab('pre-order')}
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
          <button onClick={() => setSelectedCategory('all')} className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${selectedCategory === 'all' ? 'bg-brand-primary text-white shadow-md' : 'bg-white text-brand-accent hover:bg-orange-50'}`}>🜽 ทั้งหมด</button>
          {chips.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${selectedCategory === cat.id ? 'bg-brand-primary text-white shadow-md' : 'bg-white text-brand-accent hover:bg-orange-50'}`}>{cat.icon} {cat.name}</button>
          ))}
        </div>
      </div>

      {/* ✓ v3.1: Pre-order info banner */}
      {menuTab === 'pre-order' && (
        <div className="mb-6 bg-blue-50 border-2 border-blue-200 p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <h3 className="font-bold text-blue-900 mb-1">จองล่วงหน้า</h3>
              <p className="text-sm text-blue-700">เมนูที่โหวตแล้วจะส่งในรอบถัดไป — เลือกวันที่ต้องการรับอาหาร</p>
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
      {buildHeadingGroups(filtered, categories).map(({ category, products: catProducts }, gi) => (
        <section key={category.id} className="mb-8" aria-labelledby={`catsec-${gi}`}>
          <div className="mb-6">
            <h3 id={`catsec-${gi}`} className="font-semibold text-brand-accent mb-2">{category.icon ? `${category.icon} ` : ''}{category.name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {catProducts.map((product) => {
                // Phase 6 (RC-7 · INV-18): canonical fallback เหมือน L46-47 — ห้ามอ่าน alias
                // `is_preorder` ตรง ๆ (one-way mirror ของ migration 023 อาจค้างจาก canonical)
                const mode: OrderMode = (product.available_preorder ?? product.is_preorder) ? 'pre-order' : 'same-day'
                return (
                  <FoodMenuCard
                    key={product.id}
                    product={product}
                    category={category}
                    mode={mode}
                    availability={product.is_available ? 'available' : 'sold_out'}
                    scheduledDate={scheduleMap[product.id]}
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
