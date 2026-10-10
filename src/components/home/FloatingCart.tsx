// ============================================
// Bite Me Baby — FloatingCart (UI v5)
// Transactional floating cart (badge count) → existing /cart flow.
// ============================================

import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { usePlatformConfig } from '@/config/platformConfig'

export function FloatingCart() {
  const count = useCartStore((s) => s.getCartCount())
  if (count <= 0) return null
  return (
    <Link to="/cart" className="floating-cart" aria-label={`ตะกร้า ${count} รายการ ไปที่หน้าตะกร้า`}>
      <span aria-hidden="true" className="text-2xl">🛒</span>
      <span className="floating-cart-badge" aria-hidden="true">{count}</span>
    </Link>
  )
}

/** Sticky bottom cart bar for mobile — shows total + checkout CTA */
export function StickyCartBar() {
  const { items, subtotal, total, deliveryFee } = useCartStore()
  const { delivery } = usePlatformConfig()
  const freeShippingThreshold = delivery.freeShippingThreshold ?? 200
  const barRef = useRef<HTMLDivElement>(null)

  // D02: publish measured height as --bmb-sticky-h so main-scroll content
  // clears BOTH fixed bars; cleanup on unmount resets it to fallback 0px.
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const publish = () => document.documentElement.style.setProperty('--bmb-sticky-h', `${el.offsetHeight}px`)
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--bmb-sticky-h')
    }
  }, [items.length])

  if (items.length === 0) return null

  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal)

  return (
    <div ref={barRef} className="sticky-cart-bar md:hidden" role="region" aria-label="ตะกร้าสินค้า">
      <div className="sticky-cart-inner">
        <div className="sticky-cart-summary">
          <span className="sticky-cart-count">{items.length} รายการ</span>
          <span className="sticky-cart-total">฿{total.toLocaleString()}</span>
        </div>
        
        {remainingForFreeShipping > 0 && (
          <p className="sticky-cart-upsell">
            สั่งเพิ่มอีก ฿{remainingForFreeShipping.toLocaleString()} ได้ส่งฟรี 🚚
          </p>
        )}

        <Link to="/cart" className="sticky-cart-cta" aria-label="ไปชำระเงิน">
          ไปชำระเงิน
        </Link>
      </div>
    </div>
  )
}