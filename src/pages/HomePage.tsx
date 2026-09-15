// ============================================
// Bite Me Baby — Home Page (v3: Real API Data)
// @see docs/COMPONENT_SPEC_UI.md v1.1 spec
// ============================================

import { Link } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { useEffect, useState } from 'react'
import { getProducts, getCategories } from '@/lib/bmbAdminApi_products'
import { FoodMenuCard } from '@/components/FoodMenuCard'
import { showToast } from '@/components/ui/ToastContainer'
import type { Product, ProductCategory, SameDayOrderPayload, PreOrderPayload, AvailabilityState, OrderMode } from '@/types'

export function HomePage() {
  const addItem = useCartStore((s) => s.addItem)
  const cartCount = useCartStore((s) => s.getCartCount())
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [sameDayFeatured, setSameDayFeatured] = useState<Product[]>([])
  const [preOrderFeatured, setPreOrderFeatured] = useState<Product[]>([]) // ✅ v3.1: Pre-order featured
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch products and categories from API
    const products = getProducts()
    const cats = getCategories()
    // ✅ v3.1: Separate same-day and pre-order featured products
    const sameDayFeatured = products.filter(p => p.is_featured && !p.is_preorder && p.is_available).slice(0, 4)
    const preOrderFeatured = products.filter(p => p.is_featured && p.is_preorder).slice(0, 4)
    const featured = [...sameDayFeatured, ...preOrderFeatured].slice(0, 6)
    setFeaturedProducts(featured)
    setSameDayFeatured(sameDayFeatured)
    setPreOrderFeatured(preOrderFeatured)
    setCategories(cats)
    
    const alerts = useInventoryStore.getState().getActiveAlerts()
    setLowStockAlerts(alerts.slice(0, 3))
    setLoading(false)
  }, [])

  const handleSameDay = (payload: SameDayOrderPayload) => {
    console.log('[Log#same-day]', payload)
    // Find product from featuredProducts
    const product = featuredProducts.find(p => p.id === payload.productId)
    if (product) {
      addItem(product, payload.quantity)
      showToast('เพิ่มลงตะกร้าแล้ว!', 'success')
    }
  }

  const handlePreOrder = (payload: PreOrderPayload) => {
    console.log('[Log#pre-order]', payload)
    // ✅ v3.1: Find product and show scheduled date
    const product = featuredProducts.find(p => p.id === payload.productId)
    showToast(`จองสำเร็จ! ${product?.name || ''} จะส่งวันที่ ${payload.scheduledDate || '—'}`, 'success')
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
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <Link to="/menu" className="btn btn-primary">
                <span className="text-xl">🍽️</span> ดูเมนู
              </Link>
              <Link to="/random-menu" className="btn btn-outline">
                <span className="text-xl">🎲</span> สุ่มเมนู
              </Link>
            </div>
          </div>
          
          {/* Mascot Image */}
          <div className="w-48 h-48 flex-shrink-0 animate-float">
            <img 
              src="/mascot_Bite_Main.webp" 
              alt="Bite Me Baby Mascot" 
              className="w-full h-full object-contain drop-shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Delivery Rounds */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center cursor-pointer hover:scale-105 transition-transform">
          <div className="text-3xl mb-2">🌅</div>
          <h3 className="font-bold text-brand-accent">รอบเช้า</h3>
          <p className="text-sm text-brand-muted">ส่ง 6:00-9:00</p>
          <p className="text-xs text-brand-primary mt-1">ปิดรับ 08:00</p>
        </div>
        <div className="card text-center cursor-pointer hover:scale-105 transition-transform">
          <div className="text-3xl mb-2">☀️</div>
          <h3 className="font-bold text-brand-accent">รอบกลางวัน</h3>
          <p className="text-sm text-brand-muted">ส่ง 11:00-14:00</p>
          <p className="text-xs text-brand-primary mt-1">ปิดรับ 10:30</p>
        </div>
        <div className="card text-center cursor-pointer hover:scale-105 transition-transform">
          <div className="text-3xl mb-2">🌙</div>
          <h3 className="font-bold text-brand-accent">รอบเยน</h3>
          <p className="text-sm text-brand-muted">ส่ง 17:00-20:00</p>
          <p className="text-xs text-brand-primary mt-1">ปิดรับ 16:00</p>
        </div>
      </div>

      {/* Featured Products — Real API Data */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-display font-bold text-brand-accent">🔥 เมนแนะนำ</h2>
          <Link to="/menu" className="text-brand-primary font-medium hover:underline">ดทั้งหมด →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredProducts.map((p) => {
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
{/* ✅ v3.1: Featured Pre-order Products (โหวต/จองล่วงหน้า) */}
      {preOrderFeatured.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-display font-bold text-brand-accent">📅 เมนูโหวต (จองล่วงหน้า)</h2>
            <Link to="/menu" className="text-brand-primary font-medium hover:underline">ดทั้งหมด →</Link>
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
      </div>

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
          <div className="text-3xl mb-2">🎲</div>
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