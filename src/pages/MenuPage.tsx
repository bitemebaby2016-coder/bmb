// ============================================
// Bite Me Baby — Menu Page (v2: FoodMenuCard + Product[])
// @see docs/COMPONENT_SPEC_UI.md v1.1 spec
// ============================================

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Product, ProductCategory, SameDayOrderPayload, PreOrderPayload, AvailabilityState, OrderMode, DeliveryRound } from '@/types'
import { getProducts, getCategories, getDeliveryRounds } from '@/lib/bmbAdminApi_products'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { showToast } from '@/components/ui/ToastContainer'
import { FoodMenuCard } from '@/components/FoodMenuCard'
import { MascotBadge } from '@/components/MascotBadge'
import { createPreOrder } from '@/lib/preOrderService'
import { useOrderBuilderStore } from '@/store/orderBuilderStore'
/** Default pre-order schedule = today + 3 days (YYYY-MM-DD). */
function defaultPreorderDate(): string {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

const CATEGORY_ICONS = { all: '\uD83D\uDF3D', dish: '\uD83C\uDF5C', rice: '\uD83C\uDF5A', curry: '\uD83C\uDF5B', drink: '\uD83E\uDD64', dessert: '\uD83C\uDF70' }

export function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [menuTab, setMenuTab] = useState<'same-day' | 'pre-order'>('same-day') // ✓ v3.1: Tab switch
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [deliveryRounds, setDeliveryRounds] = useState<DeliveryRound[]>([]) // ✓ v3.1: Delivery rounds
  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => {
    async function loadData() {
      try {
        const [products, cats, rounds] = await Promise.all([getProducts(), getCategories(), getDeliveryRounds()])
        setProducts(products)
        setCategories(cats)
        setDeliveryRounds(rounds)
      } catch (err) {
        console.error('[MenuPage] Load error:', err)
      }
    }
    loadData()
  }, [])

  // ✓ v3.1: Filter by tab (same-day vs pre-order)
  const filtered = products.filter((p) => {
    if (menuTab === 'same-day' && p.is_preorder) return false
    if (menuTab === 'pre-order' && !p.is_preorder) return false
    const matchCat = selectedCategory === 'all' || String(p.category_id).includes(selectedCategory.slice(0, 3))
    return matchCat && p.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleSameDay = (payload: SameDayOrderPayload) => {
    console.log('[Log#same-day]', payload)
    const product = products.find(p => p.id === payload.productId)
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
      for (const rec of result.recommended) addItem(rec, 1)
      showToast('Added: ' + result.product.name + (result.addOns.length > 0 ? ' (+toppings)' : '') + (result.recommended.length > 0 ? ' +' + result.recommended.length + ' recommended' : ''), 'success')
    })
  }

  const navigate = useNavigate()
  const customer = useAuthStore((s) => s.customer)

  // ✓ Closure 2026-09-17: Pre-order creates a REAL order (pre_orders table via
  // createPreOrder — Supabase + localStorage fallback), NOT just a toast.
  const handlePreOrder = async (payload: PreOrderPayload) => {
    console.log('[Log#pre-order]', payload)
    const product = products.find(p => p.id === payload.productId)
    if (!product) {
      showToast('ไม่พบเมนูนี้', 'error')
      return
    }
    const round = deliveryRounds.find(r => r.id === payload.deliveryRoundId)
    const scheduleTarget = payload.scheduledDate || product.scheduled_date || defaultPreorderDate()

    const preOrder = await createPreOrder({
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

    if (!preOrder) {
      showToast('สร้าง pre-order ล้มเหลว กรุาลองใหม่', 'error')
      return
    }

    showToast(`จองสำเร็จ! เลขที่ ${preOrder.order_number} — จะส่งวันที่ ${scheduleTarget} (${round?.display_name || ''})`, 'success')
    navigate(`/track/${preOrder.order_number}`)
  }

  const availableCats = categories.filter((c) => c.is_active)
  const sameDayCount = products.filter(p => !p.is_preorder && p.is_available).length
  const preOrderCount = products.filter(p => p.is_preorder).length

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
          {availableCats.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.slug)} className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${selectedCategory === cat.slug ? 'bg-brand-primary text-white shadow-md' : 'bg-white text-brand-accent hover:bg-orange-50'}`}>{cat.icon} {cat.name}</button>
          ))}
        </div>
      </div>

      {/* ✓ v3.1: Pre-order info banner */}
      {menuTab === 'pre-order' && (
        <div className="mb-6 bg-blue-50 border-2 border-blue-200 p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <h3 className="font-bold text-blue-900 mb-1">จองล่วงหน้า (Pre-order)</h3>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map((product) => {
          const cat = categories.find((c) => c.id === product.category_id)
          // ✓ v3.1: Use correct mode based on product.is_preorder
          const mode: OrderMode = product.is_preorder ? 'pre-order' : 'same-day'
          return (
            <FoodMenuCard
              key={product.id}
              product={product}
              category={cat}
              mode={mode}
              availability={product.is_available ? 'available' : 'sold_out'}
              onSameDayOrder={handleSameDay}
              onPreOrder={handlePreOrder}
            />
          )
        })}
      </div>
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
