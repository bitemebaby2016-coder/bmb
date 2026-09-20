import { Link } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { showToast } from '@/components/ui/ToastContainer'
import { MascotBadge } from '@/components/MascotBadge'
import { resolveAddOnLines, addOnTotalFor } from '@/lib/addonDisplay'

export function CartPage() {
  const { items, subtotal, discount, deliveryFee, total, updateQuantity, removeItem, clearCart } = useCartStore()

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

  function handleApplyCoupon() {
    showToast('ระบบคำนวณโปรโมชั่น', 'info')
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
        {items.map((item) => (
          <div key={item.product.id} className="card flex gap-4">
            <img src={item.product.image_url || '/placeholder.png'} alt={item.product.name} className="w-24 h-24 rounded-xl object-cover" />
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
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  className="w-8 h-8 rounded-full bg-brand-bg text-brand-accent font-bold hover:bg-brand-primary hover:text-white transition-colors"
                >
                  -
                </button>
                <span className="font-bold text-brand-accent w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  className="w-8 h-8 rounded-full bg-brand-bg text-brand-accent font-bold hover:bg-brand-primary hover:text-white transition-colors"
                >
                  +
                </button>
                <button
                  onClick={() => removeItem(item.product.id)}
                  className="ml-auto text-brand-danger text-sm hover:underline"
                >
                  ลบ
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon Section */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-3">🎟️ คูปอง/โปรโมชั่น</h3>
        <div className="flex gap-2">
          <input type="text" placeholder="ใส่รหัสคูปอง" className="input flex-1" />
          <button onClick={handleApplyCoupon} className="btn btn-outline">
            ใช้โค้ด
          </button>
        </div>
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
        
        <Link to="/checkout" data-testid="go-checkout" className="btn btn-primary w-full text-lg">
          ยืนยันสั่งซื้อ →
        </Link>
      </div>
    </div>
  )
}