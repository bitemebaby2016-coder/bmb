import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { MascotBadge } from '@/components/MascotBadge'
import { resolveAddOnLines, addOnTotalFor } from '@/lib/addonDisplay'
import { getProductScheduleMap, type ProductScheduleMap } from '@/lib/productSchedule'

export function CartPage() {
  const { items, subtotal, discount, deliveryFee, total, updateQuantity, removeItem, clearCart } = useCartStore()
  // L-8 (N-4 #8 · Owner 2026-10-26): บรรทัดจองล่วงหน้าที่ "ยังไม่ลงปฏิทิน/เลยรอบ" →
  // การ์ดบรรทัด = สีเทา + ปุ่ม +/- ปิด · ปุ่ม "ยืนยันสั่งซื้อ" กดไม่ได้จนกว่าจะลบออก
  // (server 142 reject เหมือนเดิม — ที่นี่บล็อกที่ UI ก่อนถึง checkout)
  const [scheduleMap, setScheduleMap] = useState<ProductScheduleMap>({})
  const [scheduleLoaded, setScheduleLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    void getProductScheduleMap()
      .then((m) => { if (alive) { setScheduleMap(m); setScheduleLoaded(true) } })
      .catch(() => { if (alive) setScheduleLoaded(true) })
    return () => { alive = false }
  }, [])
  // pre-order-only (preorder-eligible + ไม่ same-day) = ต้องมีป้ายปฏิทินเอง — ไม่มีใน map = ตายแล้ว
  // สินค้าทั่วไป/dual ที่เข้ารอบ = ride-along (ไม่ผูกป้ายตัวเอง) → ไม่นับเป็นบรรทัดค้าง
  const isStalePreOrderLine = (item: { line_mode?: string; product: { id: string; available_preorder?: boolean; available_same_day?: boolean; is_preorder: boolean } }) => {
    if ((item.line_mode ?? 'SAME_DAY') !== 'PRE_ORDER') return false
    const preorderOnly = (item.product.available_preorder ?? item.product.is_preorder) && !(item.product.available_same_day ?? !item.product.is_preorder)
    return preorderOnly && !scheduleMap[item.product.id]
  }
  const hasStalePreOrder = scheduleLoaded && items.some(isStalePreOrderLine)

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        {/* Mascot pose=`empty` — empty cart state (Mascot Pose Map §18) */}
        <MascotBadge
          pose="empty"
          size="lg"
          alt="Bite the mascot looks sad - your cart is empty"
          className="mx-auto mb-2"
          loading="eager"
        />
        <h2 className="text-2xl font-bold text-brand-accent mb-2">ตะกร้าว่าง</h2>
        <p className="text-brand-muted mb-6">ยังไม่มีสินค้าในตะกร้า</p>
        <Link to="/menu" className="btn btn-primary">
          🍽️ ดูเมนู
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🛒 ตะกร้า</h1>
        <button onClick={clearCart} className="text-brand-danger text-sm hover:underline">
          ล้างตะกร้า
        </button>
      </div>

      {/* Cart Items */}
      <div className="space-y-4 mb-6">
        {items.map((item) => {
          const stale = scheduleLoaded && isStalePreOrderLine(item)
          return (
          <div key={item.__line_key ?? item.product.id} className={`card flex gap-4${stale ? ' btn-locked opacity-70' : ''}`} data-testid={stale ? 'cart-line-stale' : undefined}>
            <img src={item.product.image_url || '/placeholder.svg'} alt={item.product.name} className="w-24 h-24 rounded-xl object-cover" />
            <div className="flex-1">
              <h3 className="font-bold text-brand-accent">{item.product.name}</h3>
              <p className="text-brand-primary font-bold">฿{Number(item.product.price)} x {item.quantity} = ฿{item.subtotal.toFixed(2)}</p>

              {/* Toppings / Add-ons the customer picked — clear & easy to read for kitchen staff */}
              {resolveAddOnLines(item.product, item.customizations).length > 0 && (
                <ul className="mt-1 space-y-0.5 text-sm text-brand-muted" data-testid="cart-addons">
                  {resolveAddOnLines(item.product, item.customizations).map((line) => (
                    <li key={line.groupName}>
                      ➕ <span className="font-medium text-brand-accent">{line.groupName}</span>
                      {line.selections.length > 0 && <span>: {line.selections.join(', ')}</span>}
                      {line.note && <span> · "{line.note.trim()}"</span>}
                      {line.linePrice > 0 && <span className="text-brand-primary">  +฿{line.linePrice}</span>}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.__line_key)}
                  disabled={stale}
                  className="w-8 h-8 rounded-full bg-brand-bg text-brand-accent font-bold hover:bg-brand-primary hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-bg disabled:hover:text-brand-accent"
                >
                  -
                </button>
                <span className="font-bold text-brand-accent w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.__line_key)}
                  disabled={stale}
                  className="w-8 h-8 rounded-full bg-brand-bg text-brand-accent font-bold hover:bg-brand-primary hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-bg disabled:hover:text-brand-accent"
                >
                  +
                </button>
                <button
                  onClick={() => removeItem(item.product.id, item.__line_key)}
                  className="ml-auto text-brand-danger text-sm hover:underline"
                >
                  ลบ
                </button>
              </div>
            </div>
          </div>
          )
        })}
      </div>
      {hasStalePreOrder && (
        <div className="mb-6 p-4 rounded-xl border-2 border-brand-border bg-brand-bg text-sm text-brand-muted" role="alert" data-testid="cart-stale-warning">
          ⚠️ มีเมนูจองล่วงหน้าที่ยังไม่ลงปฏิทินรอบถัดไป/เลยรอบแล้ว (รายการสีเทา) —
          <strong className="text-brand-accent"> ลบรายการนั้นออก</strong> จึงจะสั่งซื้อต่อได้
        </div>
      )}

      {/* M2: coupon UI รวมเป็น CouponBox component เดียว — ใช้ร่วมกับ CheckoutPage */}
      {/* R10 (Owner 2026-10-27): คูปองใช้ที่หน้าเช็คเอาท์อย่างเดียว — กล่องเลือกโค้ด (popup)
          อยู่ที่ CheckoutPage เท่านั้น ที่นี่โชว์ทางไปต่อ */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-2">🎟️ คูปอง/โปรโมชั่น</h3>
        <p className="text-sm text-brand-muted">เลือกใช้โค้ดส่วนลดได้ที่หน้าชำระเงิน — แตะกล่องคูปองแล้วเลือกโค้ดที่ใช้ได้ตอนนี้ (เติมอัตโนมัติ)</p>
      </div>

      {/* Summary */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">💰 สรุปราคา</h3>
        <div className="space-y-2 mb-4">
          <div className="flex justify-between">
            <span className="text-brand-muted">สินค้า</span>
            <span className="font-medium">{subtotal.toFixed(2)} บาท</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>ส่วนลด</span>
              <span>-{discount.toFixed(2)} บาท</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-brand-muted">ค่าจัดส่ง</span>
            <span className="font-medium">{deliveryFee.toFixed(2)} บาท</span>
          </div>
          <div className="border-t border-brand-border pt-2 flex justify-between text-xl font-bold">
            <span>รวมทั้งหมด</span>
            <span className="text-brand-primary">{total.toFixed(2)} บาท</span>
          </div>
        </div>
        
        <Link to="/checkout" data-testid="go-checkout" aria-disabled={hasStalePreOrder} onClick={(e) => { if (hasStalePreOrder) e.preventDefault() }} className={`btn btn-primary w-full text-lg${hasStalePreOrder ? ' btn-locked' : ''}`}>
          ยืนยันสั่งซื้อ →
        </Link>
      </div>
    </div>
  )
}