// ============================================
// Bite Me Baby — FoodMenuCard v3.0 (Fixed Layout)
// Layout: Normal Document Flow (Vertical Flexbox)
// ✅ No overflow-visible, no negative margin, no absolute positioning
// ✅ Clear spacing between sections (Image → Info → Buttons)
// ============================================

import type { Product, ProductCategory, SameDayOrderPayload, PreOrderPayload, AvailabilityState, OrderMode } from '@/types'

interface FoodMenuCardProps {
  product: Product
  category?: ProductCategory
  mode: OrderMode
  availability: AvailabilityState
  onSameDayOrder: (p: SameDayOrderPayload) => void
  onPreOrder: (p: PreOrderPayload) => void
}

const AVAIL = {
  available: 'พร้อมขาย',
  limited: 'เหลือจำกัด',
  sold_out: 'ขายหมดแล้ว',
  temporarily_unavailable: 'ขายหมดชั่วคราว — กลับมาใหม่เรวๆ นี้',
  store_closed: 'ร้านปิด',
  delivery_unavailable: 'ส่งไม่ถึงตอนนี้'
} as const

export function FoodMenuCard({ product, category, mode, availability, onSameDayOrder, onPreOrder }: FoodMenuCardProps) {
  const imageUrl = product.image_url ?? ''
  const avail = availability as keyof typeof AVAIL
  const isAvail = availability === 'available' || availability === 'limited'
  const name = product.name ?? 'Unnamed Product'
  const desc = product.description ?? ''
  const price = Number(product.price) ?? 0
  const prep = Number(product.prep_minutes) ?? 15

  const handleSameDay = () => {
    if (!isAvail) return
    onSameDayOrder({ productId: product.id, quantity: 1, timestamp: new Date().toISOString(), availabilitySnapshot: { isAvailable: true, engineState: availability, source: 'live_availability_engine', snapshotAt: new Date().toISOString() } })
  }

  const handlePreOrder = () => {
    onPreOrder({ productId: product.id, quantity: 1, deliveryRoundId: '', scheduledDate: '' })
  }

  return (
    <div className="group flex flex-col items-center bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 ease-out overflow-hidden border border-orange-50">
      
      {/* ============================================ */}
      {/* TOP SECTION: 3D Food Image Container */}
      {/* Clear padding/margin, no overflow, no absolute */}
      {/* ============================================ */}
      <div className="w-full bg-gradient-to-b from-orange-50 to-white py-6 px-4 flex flex-col items-center">
        
        {/* Category Badge (Inline, not absolute) */}
        {category && (
          <div className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-brand-primary text-white mb-3">
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </div>
        )}

        {/* Status Pill (Inline, not absolute) */}
        {!isAvail && (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 mb-3">
            {AVAIL[avail]}
          </div>
        )}

        {/* 3D Food Image Container (Fixed size, centered) */}
        <div className="relative w-48 h-48 mx-auto mb-4 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 ease-out">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={`ภาพอาหาร ${name}`} 
              className="w-full h-full object-contain rounded-full shadow-lg"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-6xl shadow-lg">
              🍽️
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* MIDDLE SECTION: Menu Info (Name, Desc, Price) */}
      {/* Normal document flow, clear spacing */}
      {/* ============================================ */}
      <div className="w-full px-5 py-4 flex flex-col items-center gap-3">
        
        {/* Name */}
        <h3 className="font-bold text-lg text-brand-accent text-center leading-tight">
          {name}
        </h3>

        {/* Description */}
        {desc && (
          <p className="text-sm text-brand-muted text-center line-clamp-2">
            {desc}
          </p>
        )}

        {/* Price + Prep Time */}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-2xl font-bold text-brand-primary">
            {price.toLocaleString('th-TH')} บาท
          </span>
          <span className="text-xs text-brand-muted bg-orange-50 px-2 py-1 rounded-full">
            ⏱ {prep} min
          </span>
        </div>
      </div>

      {/* ============================================ */}
      {/* BOTTOM SECTION: Action Buttons */}
      {/* Clear margin-top, no overlap */}
      {/* ============================================ */}
      <div className="w-full px-5 pb-5 flex flex-col gap-2">
        
        {/* Same-day Order Button */}
        {mode === 'same-day' && isAvail && (
          <button 
            onClick={handleSameDay} 
            disabled={!isAvail}
            className="w-full rounded-xl py-3 font-semibold text-sm bg-brand-primary hover:bg-brand-primary-dark active:bg-brand-primary-dark text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
          >
            🛒 สั่งเลยวันนี้
          </button>
        )}

        {/* Pre-order Button */}
        <button 
          onClick={handlePreOrder} 
          className="w-full border-2 border-brand-primary/40 text-brand-primary rounded-xl py-3 font-semibold text-sm hover:bg-brand-primary/10 active:bg-brand-primary/20 transition-all duration-200"
        >
          📅 จองล่วงหน้า
        </button>
      </div>
    </div>
  )
}