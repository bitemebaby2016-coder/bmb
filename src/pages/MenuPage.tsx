// ============================================
// Bite Me Baby — Menu Page (v2: FoodMenuCard + Product[])
// @see docs/COMPONENT_SPEC_UI.md v1.1 spec
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Product, ProductCategory, SameDayOrderPayload, PreOrderPayload, AvailabilityState, OrderMode } from '@/types'
import { getProducts, getCategories } from '@/lib/bmbAdminApi_products'
import { useCartStore } from '@/store/cartStore'
import { showToast } from '@/components/ui/ToastContainer'
import { FoodMenuCard } from '@/components/FoodMenuCard'

const CATEGORY_ICONS = { all: '\uD83D\uDF3D', dish: '\uD83C\uDF5C', rice: '\uD83C\uDF5A', curry: '\uD83C\uDF5B', drink: '\uD83E\uDD64', dessert: '\uD83C\uDF70' }

export function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => { setProducts(getProducts()); setCategories(getCategories()) }, [])

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || String(p.category_id).includes(selectedCategory.slice(0, 3))
    return matchCat && p.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleSameDay = (payload: SameDayOrderPayload) => {
    console.log('[Log#same-day]', payload)
    // Find the actual product by ID from our products list
    const product = products.find(p => p.id === payload.productId)
    if (product) {
      addItem(product, payload.quantity)
    } else {
      showToast('ไม่พบเมนูนี้', 'error')
    }
    showToast('สั่งเลยวันนี้ — เพิ่มลงตะกร้าแล้ว!', 'success')
  }

  const handlePreOrder = (payload: PreOrderPayload) => {
    console.log('[Log#pre-order]', payload)
    showToast('จองล่วงหน้าสำเร็จ!', 'success')
  }

  const availableCats = categories.filter((c) => c.is_active)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 bg-brand-bg min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-brand-accent mb-4">เมนูอาหาร</h1>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map((product) => {
          const cat = categories.find((c) => c.id === product.category_id)
          return (
            <FoodMenuCard key={product.id} product={product} category={cat} mode="same-day" availability={product.is_available ? 'available' : 'sold_out'} onSameDayOrder={handleSameDay} onPreOrder={handlePreOrder} />
          )
        })}
      </div>
      {filtered.length === 0 && <div className="text-center py-16"><div className="text-6xl mb-4">🔍</div><h3 className="text-xl font-display font-bold text-brand-accent mb-2">ไม่พบเมนู</h3><p className="text-brand-muted">ลองเปลี่ยนคำค้นหาหรือหมวดหมู่</p></div>}
    </div>
  )
}