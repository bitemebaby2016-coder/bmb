// ============================================
// Bite Me Baby — FloatingCart (UI v5)
// Transactional floating cart (badge count) → existing /cart flow.
// ============================================

import { Link } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'

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