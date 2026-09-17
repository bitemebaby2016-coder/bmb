// ============================================
// Bite Me Baby — Home Page (v4.0: 2.5D/3D Hybrid Glassmorphism)
// Section Layout Flow:
//   [1 Hero Mascot] -> [2 Delivery Rounds] -> [3 Social Proof Review Feed]
//   -> [4 Same-Day Menu] -> [5 Pre-Order Menu] -> [6 Promotions/Viral]
// @see docs/COMPONENT_SPEC_UI.md §12 CustomerReviewCard + Glassmorphism Spec
// ============================================

import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { useEffect, useState } from 'react'
import { FoodMenuCard } from '@/components/FoodMenuCard'
import { CustomerReviewCard } from '@/components/CustomerReviewCard'
import { MascotBadge } from '@/components/MascotBadge'
import { LazyVideo } from '@/components/LazyVideo'
import { getSocialProofReviews, MENU_HIGHLIGHT_CLIPS } from '@/lib/socialProofReviews'
import { showToast } from '@/components/ui/ToastContainer'
import { createPreOrder } from '@/lib/preOrderService'
import type { Product, ProductCategory, SameDayOrderPayload, PreOrderPayload, AvailabilityState, OrderMode, SocialProofReview } from '@/types'

/** Default pre-order schedule = today + 3 days (YYYY-MM-DD), used when the
 *  product has no `scheduled_date` and the UI did not pick a date yet. */
function defaultPreorderDate(): string {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}
export function HomePage() {
  const addItem = useCartStore((s) => s.addItem)
  const cartCount = useCartStore((s) => s.getCartCount())
  const navigate = useNavigate() // ✅ v4.0: Deep Link CTA (Social Proof Review Feed)
  const [products, setProducts] = useState<Product[]>([])
  const [sameDayFeatured, setSameDayFeatured] = useState<Product[]>([])
  const [preOrderFeatured, setPreOrderFeatured] = useState<Product[]>([]) // ✅ v3.1: Pre-order featured
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const socialReviews = getSocialProofReviews() // ✅ v4.0: Social Proof Review Feed (curated Facebook/GrabFood)

  useEffect(() => {
    async function loadData() {
      try {
        // ⚡ PERF (2026-09-17): dynamic import — supabase chunk loads only after
        // the landing page renders its first paint (kept off critical path).
        const { getProducts, getCategories } = await import('@/lib/bmbAdminApi_products')
        const [products, cats] = await Promise.all([getProducts(), getCategories()])
        // ✅ v3.1: Separate same-day and pre-order featured products
        const sameDayFeatured = products.filter((p: Product) => p.is_featured && !p.is_preorder && p.is_available).slice(0, 4)
        const preOrderFeatured = products.filter((p: Product) => p.is_featured && p.is_preorder).slice(0, 4)
        setProducts(products) // ✅ v4.0: ใช้ map review.productId → Product (รูปเมนู WebP จริง)
        setSameDayFeatured(sameDayFeatured)
        setPreOrderFeatured(preOrderFeatured)
        setCategories(cats)
        
        const alerts = useInventoryStore.getState().getActiveAlerts()
        setLowStockAlerts(alerts.slice(0, 3))
      } catch (err) {
        console.error('[HomePage] Load error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSameDay = (payload: SameDayOrderPayload) => {
    console.log('[Log#same-day]', payload)
    // Find product from full products list
    const product = products.find(p => p.id === payload.productId)
    if (product) {
      addItem(product, payload.quantity)
      showToast('เพิ่มลงตะกร้าแล้ว!', 'success')
    }
  }

  const customer = useAuthStore((s) => s.customer)

  // ✅ Closure 2026-09-17: Pre-order creates a REAL order (pre_orders table via
  // createPreOrder — Supabase + localStorage fallback), NOT just a toast.
  // Products still use mockup placeholders while real food photos are produced.
  const handlePreOrder = async (payload: PreOrderPayload) => {
    console.log('[Log#pre-order]', payload)
    const product = products.find(p => p.id === payload.productId)
    if (!product) {
      showToast('ไม่พบเมนูนี้', 'error')
      return
    }

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

    showToast(`จองสำเร็จ! เลขที่ ${preOrder.order_number} — ${product.name} จะส่งวันที่ ${scheduleTarget}`, 'success')
    navigate(`/track/${preOrder.order_number}`)
  }

  // ✅ v4.0: Social Proof CTA — Deep Link ตรงเข้า Cart/Checkout ตาม Mode (same-day / pre-order)
  const handleReviewCta = (review: SocialProofReview) => {
    const product = products.find((p) => p.id === review.productId)
    const mode: OrderMode = product?.is_preorder ? 'pre-order' : 'same-day'
    if (product) {
      addItem(product, 1)
      showToast('เพิ่มลงตะกร้าแล้ว!', 'success')
    }
    navigate(mode === 'pre-order' ? '/checkout?mode=pre-order' : '/cart?mode=same-day')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 bg-organic min-h-screen">
      {/* Hero Banner with Mascot */}
      <div className="hero-section mb-8">
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
              🍽️ Bite Me Baby
            </h1>
            <p className="text-lg mb-2 text-brand-accent font-medium">สั่งอาหารจัดส่ง</p>
            <p className="text-sm text-brand-muted mb-4">เมืองจันทบุรี • รัศมี 5 กม.</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 relative">
{/* Mascot pose=`pointing` — points at the primary CTA (Mascot Pose Map §18) */}
              <MascotBadge
                pose="pointing"
                size="sm"
                alt="Bite the mascot pointing at the order menu button"
                className="mascot-point-cta"
                loading="eager"
              />
              <Link to="/menu" data-testid="home-menu-cta" className="btn btn-primary">
                <span className="text-xl">🍽️</span> ดูเมนู
              </Link>
              <Link to="/random-menu" className="btn btn-outline">
                <span className="text-xl">🎲</span> สุ่มเมนู
              </Link>
            </div>
          </div>
          
          {/* Mascot Image — MascotBadge pose=greeting */}
          <div className="w-48 h-48 flex-shrink-0 animate-float">
            <MascotBadge
              pose="greeting"
              size="fluid"
              alt="Bite Me Baby Mascot — น้อง Bite ทักทาย"
              className="w-full h-full object-contain drop-shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Delivery Rounds */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center cursor-pointer hover:scale-105 transition-transform">
          <MascotBadge pose="running" size="sm" alt="น้อง Bite วิ่งส่งของ รอบเช้า" className="mx-auto mb-2" />
          <h3 className="font-bold text-brand-accent">รอบเช้า</h3>
          <p className="text-sm text-brand-muted">ส่ง 6:00-9:00</p>
          <p className="text-xs text-brand-primary mt-1">ปิดรับ 08:00</p>
        </div>
        <div className="card text-center cursor-pointer hover:scale-105 transition-transform">
          <MascotBadge pose="running" size="sm" alt="น้อง Bite วิ่งส่งของ รอบกลางวัน" className="mx-auto mb-2" />
          <h3 className="font-bold text-brand-accent">รอบกลางวัน</h3>
          <p className="text-sm text-brand-muted">ส่ง 11:00-14:00</p>
          <p className="text-xs text-brand-primary mt-1">ปิดรับ 10:30</p>
        </div>
        <div className="card text-center cursor-pointer hover:scale-105 transition-transform">
          <MascotBadge pose="running" size="sm" alt="น้อง Bite วิ่งส่งของ รอบเย็น" className="mx-auto mb-2" />
          <h3 className="font-bold text-brand-accent">รอบเยน</h3>
          <p className="text-sm text-brand-muted">ส่ง 17:00-20:00</p>
          <p className="text-xs text-brand-primary mt-1">ปิดรับ 16:00</p>
        </div>
      </div>

      {/* ================================================ */}
      {/* 3. Social Proof Review Feed (UI v4.0) */}
      {/* ตำแหน่ง: ต่อจาก Delivery Rounds ก่อน Same-Day Menu */}
      <section className="mb-10 scroll-mt-20" aria-labelledby="social-proof-heading">
        <div className="flex items-center justify-between mb-2">
          <h2
            id="social-proof-heading"
            className="text-2xl font-display font-bold text-brand-accent flex items-center gap-2"
          >
            ⭐ รีวิวจากลูกค้าจริง
          </h2>
          <Link to="/reviews" className="text-brand-primary font-medium hover:underline">รีวิวทั้งหมด →</Link>
        </div>
        <p className="text-sm text-brand-muted mb-5">
          จาก Facebook &amp; GrabFood — ลูกค้าบอกต่อโดยตรง • ภาพเมนูจริง (ไม่ใช้วิดีโอ เพื่อความเร็วบนมือถือ)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {socialReviews.map((review) => {
            const product = products.find((p) => p.id === review.productId)
            const mode: OrderMode = product?.is_preorder ? 'pre-order' : 'same-day'
            return (
              <CustomerReviewCard
                key={review.id}
                review={review}
                product={product}
                mode={mode}
                deepLinkTo={mode === 'pre-order' ? '/checkout?mode=pre-order' : '/cart?mode=same-day'}
                ctaLabel={product ? (mode === 'pre-order' ? '📅 จองเมนูนี้' : '🛒 สั่งเมนูนี้') : '🍽️ ดูเมนู'}
                onCta={() => handleReviewCta(review)}
              />
            )
          })}
        </div>
      </section>

      {/* ================================================ */}
      {/* 4. Same-Day Menu (เมนูวันนี้) + Menu Highlight  */}
      {/* ================================================ */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-display font-bold text-brand-accent">🔥 เมนูวันนี้ (Same-day)</h2>
            <MascotBadge pose="thumbsup" size="sm" alt="น้อง Bite การันตีเมนูแนะนำ" />
          </div>
          <Link to="/menu" className="text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
        </div>

        {/* Menu Highlight — Short Video ≤ 2 คลิป (Lazy Streaming เมื่อ scroll ถึง) */}
        {MENU_HIGHLIGHT_CLIPS.length > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MENU_HIGHLIGHT_CLIPS.slice(0, 2).map((clip) => (
                <div key={clip.id} className="card p-3">
                  <h3 className="font-bold text-brand-accent mb-1 text-lg">{clip.title}</h3>
                  {clip.subtitle && <p className="text-sm text-brand-muted mb-3">{clip.subtitle}</p>}
                  <LazyVideo src={clip.videoUrl} poster={clip.posterUrl} title={clip.title} />
                </div>
              ))}
            </div>
          </div>
        )}

        {sameDayFeatured.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sameDayFeatured.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id)
              return (
                <FoodMenuCard
                  key={p.id}
                  product={p}
                  category={cat}
                  mode="same-day"
                  availability={p.is_available ? 'available' : 'sold_out'}
                  onSameDayOrder={handleSameDay}
                  onPreOrder={handlePreOrder}
                />
              )
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-brand-muted">
            ไม่พบเมนูวันนี้ — กรุณากลับมาใหม่เร็ว ๆ นี้
          </div>
        )}
      </div>

      {/* ================================================ */}
      {/* 5. Pre-Order Menu (เมนูโหวต / จองล่วงหน้า)       */}
      {/* ================================================ */}
      {preOrderFeatured.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-display font-bold text-brand-accent">📅 เมนูจองล่วงหน้า (Pre-order)</h2>
            <Link to="/menu" className="text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {preOrderFeatured.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id)
              return (
                <FoodMenuCard
                  key={p.id}
                  product={p}
                  category={cat}
                  mode="pre-order"
                  availability={p.is_available ? 'available' : 'sold_out'}
                  onSameDayOrder={handleSameDay}
                  onPreOrder={handlePreOrder}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockAlerts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-brand-accent">⚠️ แจ้งเตือนสต็อก</h2>
            <Link to="/admin/inventory" className="text-brand-primary font-medium hover:underline">จัดการ →</Link>
          </div>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <p className="text-yellow-800 font-medium mb-2">วัตถุดิบใกล้หมด:</p>
            <ul className="space-y-1">
              {lowStockAlerts.map((alert) => (
                <li key={alert.id} className="text-sm text-yellow-700">
                  ⚠️ {alert.ingredient_name} (เหลือ {alert.current_stock} {alert.ingredient_name.includes('กก') ? 'กก' : 'หน่วย'})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Promotions */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-brand-accent">🎟️ โปรโมชั่นวันนี้</h2>
          <Link to="/promotions" className="text-brand-primary font-medium hover:underline">ดูทั้งหมด →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-brand-primary">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <h3 className="font-bold text-brand-accent">ลูกค้าใหม่ ลด 10%</h3>
                <p className="text-sm text-brand-muted">ใช้โค้ด WELCOME10</p>
              </div>
            </div>
          </div>
          <div className="card bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚚</span>
              <div>
                <h3 className="font-bold text-brand-accent">ส่งฟรีเมื่อ orderครบ ฿200</h3>
                <p className="text-sm text-brand-muted">ภายในรัศมี 5 กม.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link to="/vote" className="card text-center hover:scale-105 transition-transform">
          <div className="text-3xl mb-2">🗳️</div>
          <h3 className="font-bold text-brand-accent">โหวตเมนู</h3>
          <p className="text-sm text-brand-muted">ช่วยเลือกเมนูใหม่</p>
        </Link>
        <Link to="/random-menu" className="card text-center hover:scale-105 transition-transform">
          <MascotBadge pose="thinking" size="sm" alt="น้อง Bite ครุ่นคิด คิดไม่ออก?" className="mx-auto mb-2" />
          <h3 className="font-bold text-brand-accent">คิดไม่ออก?</h3>
          <p className="text-sm text-brand-muted">สุ่มเมนูให้เลย</p>
        </Link>
      </div>

      {/* Share & Viral */}
      <div className="card bg-brand-bg">
        <div className="text-center">
          <h2 className="text-xl font-bold text-brand-accent mb-2">📢 แชรเพื่อน รับแต้ม!</h2>
          <p className="text-brand-muted mb-4">เชิญเพื่อนสั่งอาหาร เชิญและเพื่อนได้คูปองคนละ ฿30</p>
          <Link to="/share" className="btn btn-primary">
            👥เชิญเพื่อน
          </Link>
        </div>
      </div>
    </div>
  )
}