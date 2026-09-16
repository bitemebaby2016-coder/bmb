import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { showToast } from '@/components/ui/ToastContainer'
import { createOrder, type OrderForm } from '@/lib/bmbAdminApi_orders'
import { writeAuditLog } from '@/lib/auditLog'

export function CheckoutPage() {
  const navigate = useNavigate()
  const { items, subtotal, discount, deliveryFee, total, clearCart } = useCartStore()
  const customer = useAuthStore((s) => s.customer)
  const [selectedRound, setSelectedRound] = useState('morning')
  const [deliveryAddress, setDeliveryAddress] = useState({
    latitude: 10.7016,
    longitude: 102.1429,
    detail: ''
  })
  const [paymentMethod, setPaymentMethod] = useState<'promptpay_qr' | 'cash_on_delivery'>('promptpay_qr')
  const [isProcessing, setIsProcessing] = useState(false)

  async function handlePlaceOrder() {
    if (!deliveryAddress.detail) {
      showToast('กรุณาใส่ที่อยู่จัดส่ง', 'warning')
      return
    }

    setIsProcessing(true)

    // Create real order with items from cart
    const orderItems = items.map(item => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.product.price,
    }))

    const today = new Date()
    const orderData: OrderForm = {
      id: `ord-${Date.now()}`,
      order_number: `BMB-${today.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`,
      customer_id: customer?.id || 'guest',
      customer_name: customer?.name || 'Guest',
      customer_phone: customer?.phone || '',
      delivery_round_id: selectedRound,
      status: 'pending',
      total_amount: total,
      delivery_fee: deliveryFee,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'promptpay_qr' ? 'pending' : 'pending',
      delivery_address: deliveryAddress.detail,
      dropoff_latitude: deliveryAddress.latitude,
      dropoff_longitude: deliveryAddress.longitude,
      items: orderItems,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const order = await createOrder(orderData)
    if (!order) {
      showToast('สร้างออเดอร์ล้มเหลว กรุณาลองใหม่', 'error')
      setIsProcessing(false)
      return
    }

    // Audit log: order created
    writeAuditLog({
      action: 'order_create',
      entity_type: 'order',
      entity_id: order.order_number,
      description: `ออเดอร์ใหม่ #${order.order_number} โดย ${customer?.name || customer?.email || 'Guest'} รวม ${total.toFixed(2)} บาท`,
      metadata: { itemCount: items.length, totalAmount: total, paymentMethod: paymentMethod }
    })

    showToast(`สั่งซื้อสำเร็จ! เลขที่ ${order.order_number}`, 'success')
    
    clearCart()
    navigate(`/track/${order.order_number}`)
    setIsProcessing(false)
  }

  if (items.length === 0) {
    navigate('/cart')
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">💳 ชำระเงิน</h1>

      {/* Delivery Round Selection */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">🕐 เลือกรอบจัดส่ง</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'morning', name: 'รอบเช้า', time: '6:00-9:00', cutoff: '08:00', icon: '🌅' },
            { key: 'midday', name: 'รอบกลางวัน', time: '11:00-14:00', cutoff: '10:30', icon: '☀️' },
            { key: 'evening', name: 'รอบเย็น', time: '17:00-20:00', cutoff: '16:00', icon: '' },
          ].map((round) => (
            <button
              key={round.key}
              onClick={() => setSelectedRound(round.key)}
              className={`p-4 rounded-xl text-center transition-all ${
                selectedRound === round.key
                  ? 'bg-brand-primary text-white border-2 border-brand-primary'
                  : 'bg-brand-bg border-2 border-brand-border hover:border-brand-primary'
              }`}
            >
              <div className="text-2xl mb-1">{round.icon}</div>
              <div className="font-bold text-sm">{round.name}</div>
              <div className="text-xs opacity-80">{round.time}</div>
              <div className="text-xs mt-1">ปิดรับ {round.cutoff}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Delivery Address */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4"> ที่อยู่จัดส่ง</h3>
        <input
          type="text"
          placeholder="ใส่ที่อยู่จัดส่ง (ถนน, เลขที่บ้าน, หมู่ที่)"
          value={deliveryAddress.detail}
          onChange={(e) => setDeliveryAddress({ ...deliveryAddress, detail: e.target.value })}
          className="input mb-3"
        />
        <div className="text-sm text-brand-muted">
          📐 รัศมีจัดส่ง: 5 กม. จากตัวเมืองจันทบุรี<br />
          💰 ค่าส่ง: 30 บาท (ฟรีถ้าซื้อครบ 200 บาท)
        </div>
      </div>

      {/* Payment Method */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">💳 วิธีการชำระเงิน</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-brand-border cursor-pointer hover:border-brand-primary transition-colors">
            <input
              type="radio"
              name="payment"
              value="promptpay_qr"
              checked={paymentMethod === 'promptpay_qr'}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-5 h-5"
            />
            <div>
              <div className="font-medium">QR PromptPay</div>
              <div className="text-sm text-brand-muted">สแกนจ่ายได้เลย</div>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-brand-border cursor-pointer hover:border-brand-primary transition-colors">
            <input
              type="radio"
              name="payment"
              value="cash_on_delivery"
              checked={paymentMethod === 'cash_on_delivery'}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-5 h-5"
            />
            <div>
              <div className="font-medium">เงินสดตอนรับของ</div>
              <div className="text-sm text-brand-muted">จ่ายตอนรับของ</div>
            </div>
          </label>
        </div>
      </div>

      {/* Order Summary */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4"> สรุปออเดอร์</h3>
        <div className="space-y-2 mb-4">
          {items.map((item) => (
            <div key={item.product.id} className="flex justify-between text-sm">
              <span>{item.product.name} x{item.quantity}</span>
              <span>{item.subtotal.toFixed(2)} บาท</span>
            </div>
          ))}
        </div>
        <div className="border-t border-brand-border pt-4 space-y-2">
          <div className="flex justify-between">
            <span>สินค้า</span>
            <span>{subtotal.toFixed(2)} บาท</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>ส่วนลด</span>
              <span>-{discount.toFixed(2)} บาท</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>ค่าจัดส่ง</span>
            <span>{deliveryFee.toFixed(2)} บาท</span>
          </div>
          <div className="flex justify-between text-xl font-bold pt-2 border-t border-brand-border">
            <span>รวมทั้งหมด</span>
            <span className="text-brand-primary">{total.toFixed(2)} บาท</span>
          </div>
        </div>
      </div>

      {/* Place Order Button */}
      <button onClick={handlePlaceOrder} disabled={isProcessing} className="btn btn-primary w-full text-lg py-4">
        {isProcessing ? '⏳ กำลังยืนยัน...' : '✅ ยืนยันสั่งซื้อ'}
      </button>
    </div>
  )
}