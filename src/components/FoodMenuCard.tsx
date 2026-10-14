// ============================================
// Bite Me Baby — FoodMenuCard v4.0 (กรอบสี่เหลี่ยมเหมือนหน้าหลัก)
// Layout: Normal Document Flow (Vertical Flexbox)
// ✅ กรอบรูปเมนูเป็นสี่เหลี่ยม (4:3 เต็มใบ) เหมือนการ์ดหน้าหลัก
// ✅ hover รูปเมนูลอยเหนือกรอบ (ดู .fmc-card ใน index.css)
// ✅ เมนูจองล่วงหน้ามีป้ายปฏิทินมุมรูป — hover เห็นวันจัดส่งจริง
// ============================================

import type { Product, ProductCategory, SameDayOrderPayload, PreOrderPayload, AvailabilityState, OrderMode } from '@/types'
import { MascotBadge } from '@/components/MascotBadge'
import { ScheduleDateBadge } from '@/components/home/ScheduleDateBadge'

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
  temporarily_unavailable: 'ขายหมดชั่วคราว — กลับมาใหม่เร็ว ๆ นี้',
  store_closed: 'ร้านปิด',
  delivery_unavailable: 'ส่งไม่ถึงตอนนี้'
} as const

export function FoodMenuCard({ product, category, mode, availability, onSameDayOrder, onPreOrder }: FoodMenuCardProps) {
  const imageUrl = product.image_url ?? ''
  const avail = availability as keyof typeof AVAIL
  const isAvail = availability === 'available' || availability === 'limited'
  const name = product.name ?? 'เมนูยังไม่มีชื่อ'
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
    <div className="fmc-card group flex flex-col bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 ease-out border border-orange-50">
      
      {/* TOP: กรอบรูปสี่เหลี่ยม (4:3 เต็มใบ) — เหมือนหน้าหลัก */}
      <div className="fmc-img-wrap">
        
        {/* ป้ายหมวดหมู่บนรูป */}
        {category && (
          <div className="fmc-chip fmc-chip-cat">
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </div>
        )}

        {/* ป้ายสถานะบนรูป */}
        {!isAvail && (
          <div className="fmc-chip fmc-chip-status">
            <MascotBadge pose="empty" size="sm" alt="น้อง Bite — เมนูนี้ขายหมดแล้ว" loading="eager" />
            <span>{AVAIL[avail]}</span>
          </div>
        )}

        {/* กรอบรูปสี่เหลี่ยม */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`ภาพอาหาร ${name}`}
            className="fmc-img"
            loading="lazy"
          />
        ) : (
          <span className="img-fallback" role="img" aria-label={`ภาพอาหาร ${name}`} />
        )}

        {/* ป้ายปฏิทินมุมรูป — วันจัดส่งจริงของเมนูจองล่วงหน้า (hover ขึ้นปฏิทิน) */}
        {(product.available_preorder ?? product.is_preorder) && product.scheduled_date && (
          <ScheduleDateBadge date={product.scheduled_date} />
        )}
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
          <span className="fmc-prep-pill text-xs px-2 py-1 rounded-full">
            ⏱ เตรียม {prep} นาที
          </span>
        </div>
      </div>

      {/* ============================================ */}
      {/* BOTTOM SECTION: Action Buttons */}
      {/* Clear margin-top, no overlap */}
      {/* ============================================ */}
      <div className="w-full px-5 pb-5 flex flex-col gap-2">
        
        {/* Same-day Order Button — canonical availability (migration 023) */}
        {(product.available_same_day ?? !product.is_preorder) && isAvail && (
          <button 
            onClick={handleSameDay} data-testid="same-day-order" 
            disabled={!isAvail}
            className="w-full rounded-xl py-3 font-semibold text-sm bg-brand-primary hover:bg-brand-primary-dark active:bg-brand-primary-dark text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
          >
            🛒 สั่งเลยวันนี้
          </button>
        )}

        {/* Pre-order Button — only when the product is actually preorder-orderable */}
        {(product.available_preorder ?? product.is_preorder) && (
          <button 
            onClick={handlePreOrder} data-testid="pre-order-btn" 
            className="w-full border-2 border-brand-primary/40 text-brand-primary rounded-xl py-3 font-semibold text-sm hover:bg-brand-primary/10 active:bg-brand-primary/20 transition-all duration-200"
          >
            📅 จองล่วงหน้า
          </button>
        )}
      </div>
    </div>
  )
}