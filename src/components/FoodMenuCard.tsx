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
  /** L-4: แท็บโหมดที่การ์ดอยู่จริงบน /menu — pre-order tab ต้องโชว์ปุ่มจอง
   *  (ทั้งเมนูปฏิทิน + สินค้าทั่วไป ride-along) ไม่ใช่ปุ่ม "สั่งเลยวันนี้" */
  tab?: 'same-day' | 'pre-order'
  availability: AvailabilityState
  onSameDayOrder: (p: SameDayOrderPayload) => void
  onPreOrder: (p: PreOrderPayload) => void
  /** วันจัดส่งจริงจาก menu_schedule (ผ่าน productSchedule) — ไม่ใช้ products.scheduled_date */
  scheduledDate?: string
  /** Owner 2026-10-19: พรีออเดอร์ที่เลยวัน/เกินรอบไปแล้ว → แสตมป์ out of stock + ปิดปุ่มจอง */
  preorderExpired?: boolean
}

const AVAIL = {
  available: 'พร้อมขาย',
  limited: 'เหลือจำกัด',
  sold_out: 'ขายหมดแล้ว',
  temporarily_unavailable: 'ขายหมดชั่วคราว — กลับมาใหม่เร็ว ๆ นี้',
  store_closed: 'ร้านปิด',
  delivery_unavailable: 'ส่งไม่ถึงตอนนี้'
} as const

export function FoodMenuCard({ product, category, availability, onSameDayOrder, onPreOrder, scheduledDate, preorderExpired = false }: FoodMenuCardProps) {
  const imageUrl = product.image_url ?? ''
  const avail = availability as keyof typeof AVAIL
  const isAvail = availability === 'available' || availability === 'limited'
  const name = product.name ?? 'เมนูยังไม่มีชื่อ'
  const desc = product.description ?? ''
  const price = Number(product.price) ?? 0
  const prep = Number(product.prep_minutes) ?? 15
  // Owner 2026-10-27 (ตัวตนสินค้า = "เมนูตาราง"): พรีออเดอร์กับเมนูตาราง = อันเดียวกัน —
  // การ์ดมี "ป้ายปฏิทิน" (scheduledDate จาก menu_schedule) = เมนูพรีออเดอร์ → ปุ่มจอง
  // ไม่มีป้าย = เมนู "สั่งทันที" ทุกแท็บ (ส่งวันนี้ทันทีในเวลาเปิดร้าน · ถ้าในตะกร้ามี
  // พรีออเดอร์อยู่แล้วจะเข้ารอบเดียวกันอัตโนมัติ — deriveCartMode ใน cartStore)
  // (ยกเลิก L-4 เดิมที่ซ่อนปุ่มสั่งวันนี้ในแท็บจองล่วงหน้า — Owner สั่งให้มีปุ่ม
  //  "สั่งทันที" สำหรับเมนูที่ไม่ใช่พรีออเดอร์เสมอ)

  const handleSameDay = () => {
    if (!isAvail) return
    onSameDayOrder({ productId: product.id, quantity: 1, timestamp: new Date().toISOString(), availabilitySnapshot: { isAvailable: true, engineState: availability, source: 'live_availability_engine', snapshotAt: new Date().toISOString() } })
  }

  const handlePreOrder = () => {
    onPreOrder({ productId: product.id, quantity: 1, deliveryRoundId: '', scheduledDate: '' })
  }

  // FIX (Owner 2026-10-25 "เฟรมกรอบของเมนูยังไม่หาย"): ถอด border ของการ์ด — คง shadow + rounded เดิม
  return (
    <div className="fmc-card group flex flex-col bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 ease-out">
      
      {/* TOP: กรอบรูปสี่เหลี่ยม (4:3 เต็มใบ) — เหมือนหน้าหลัก */}
      <div className="fmc-img-wrap">
        
        {/* ป้ายหมวดหมู่บนรูป */}
        {category && (
          <div className="fmc-chip fmc-chip-cat">
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </div>
        )}

        {/* ป้ายสถานะบนรูป — รวมแสตมป์พรีออเดอร์เลยวัน (Owner 2026-10-19) */}
        {(!isAvail || preorderExpired) && (
          <div className="fmc-chip fmc-chip-status">
            <MascotBadge pose="empty" size="sm" alt="น้อง Bite — เมนูนี้ขายหมดแล้ว" loading="eager" />
            <span>{preorderExpired ? 'หมดเวลาจอง (Out of stock)' : AVAIL[avail]}</span>
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

        {/* ป้ายปฏิทินมุมรูป — วันจัดส่งจริงจาก menu_schedule (hover/แตะ ขึ้นปฏิทิน) */}
        {scheduledDate && (
          <ScheduleDateBadge date={scheduledDate} />
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
      {/* BOTTOM SECTION: Action Buttons — Owner 2026-10-27
          มีป้ายปฏิทิน (เมนูตาราง) = "📅 จองล่วงหน้า" · ไม่มีป้าย = "⚡ สั่งทันที"
          Clear margin-top, no overlap */}
      {/* ============================================ */}
      <div className="w-full px-5 pb-5 flex flex-col gap-2">
        {scheduledDate ? (
          <button
            onClick={handlePreOrder} data-testid="pre-order-btn"
            disabled={preorderExpired}
            className={`w-full border-2 text-brand-primary rounded-xl py-3 font-semibold text-sm transition-all duration-200 ${preorderExpired ? 'btn-locked' : 'border-brand-primary/40 hover:bg-brand-primary/10 active:bg-brand-primary/20'}`}
          >
            {preorderExpired ? '📅 หมดเวลาจอง (Out of stock)' : '📅 จองล่วงหน้า'}
          </button>
        ) : isAvail ? (
          <>
            <button
              onClick={handleSameDay} data-testid="same-day-order"
              className="w-full rounded-xl py-3 font-semibold text-sm bg-brand-primary hover:bg-brand-primary-dark active:bg-brand-primary-dark text-white transition-all duration-200 shadow-md"
            >
              ⚡ สั่งทันที
            </button>
            <p className="text-xs text-brand-muted text-center" data-testid="ride-along-hint">
              ส่งวันนี้ทันทีในเวลาเปิดร้าน · ถ้ามีพรีออเดอร์ในตะกร้าจะเข้ารอบเดียวกันอัตโนมัติ
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}