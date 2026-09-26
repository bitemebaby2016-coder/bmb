// ============================================
// Bite Me Baby — FloatingCart (UI v5)
// Transactional floating cart (badge count) → existing /cart flow.
// ============================================

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

  if (items.length === 0) return null

  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal)

  return (
    <div className="sticky-cart-bar md:hidden" role="region" aria-label="ตะกร้าสินค้า">
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