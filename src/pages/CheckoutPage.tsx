import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { storeConversationMessage, getMemorySummary, updateCustomerMemory } from '@/lib/aiMemory'
import { showToast } from '@/components/ui/ToastContainer'
import { createOrder, type OrderForm, type OrderInput } from '@/lib/bmbAdminApi_orders'
import { createPaymentIntent } from '@/lib/paymentGateway'
import { writeAuditLog } from '@/lib/auditLog'
import { getBestProvider, calculateProviderCost, type DeliveryProvider } from '@/lib/externalProviders'
import { useLocationStore } from '@/store/locationStore'
import { getGpsLocation } from '@/lib/locationLogin'
import { resolveAddOnLines } from '@/lib/addonDisplay'
import { DistanceChecker } from '@/components/delivery/DistanceChecker'

export function CheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams() // ✅ v4.0: Deep Link — ?mode= (same-day/pre-order) & ?round=
  const { items, subtotal, discount, deliveryFee, total, clearCart } = useCartStore()
  const customer = useAuthStore((s) => s.customer)
  const [selectedRound, setSelectedRound] = useState(searchParams.get('round') || 'morning')
  const deepLinkMode: 'same-day' | 'pre-order' = searchParams.get('mode') === 'pre-order' ? 'pre-order' : 'same-day'
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    const saved = useLocationStore.getState().location
    return {
      latitude: saved?.latitude ?? 10.7016,
      longitude: saved?.longitude ?? 102.1429,
      detail: saved?.addressDetail ?? '',
    }
  })
  const [locating, setLocating] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'promptpay_qr' | 'cash_on_delivery'>('promptpay_qr')
  const [selectedProvider, setSelectedProvider] = useState<DeliveryProvider | null>(null)
  const [providerCost, setProviderCost] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  // ✅ E2E fix (2026-09-17): mark that the user just placed an order so the
  // empty-cart render guard below does not bounce them back to /cart before the
  // router navigates to /payment/:orderNumber (react-router nav is async).
  const justPlaced = useRef(false)

  // GAP CLOSURE: Calculate best provider based on delivery address
  useEffect(() => {
    if (deliveryAddress.detail.length > 5) {
      const result = getBestProvider({
        dropoff_latitude: deliveryAddress.latitude,
        dropoff_longitude: deliveryAddress.longitude,
        items_count: items.length,
        estimated_weight: items.reduce((sum, item) => sum + item.product.price * 0.1, 0)
      })
      if (result) {
        setSelectedProvider(result.provider)
        setProviderCost(result.cost)
      } else {
        setSelectedProvider(null)
        setProviderCost(0)
      }
    }
  }, [deliveryAddress.latitude, deliveryAddress.longitude, deliveryAddress.detail, items.length])

  // Recalculate total when provider changes
  useEffect(() => {
    if (selectedProvider) {
      const newTotal = Math.max(0, subtotal - discount + providerCost)
      useCartStore.setState({ deliveryFee: providerCost, total: newTotal })
    }
  }, [selectedProvider, providerCost])

  async function handlePlaceOrder() {
    // 007: create_order_with_items is authenticated-only → a guest cannot place an
    // order server-side. Redirect to login instead of failing silently at the RPC.
    if (!customer) {
      showToast('กรุณาเข้าสู่ระบบก่อนสั่งอาหาร', 'warning')
      navigate('/login', { state: { from: '/checkout' } })
      return
    }
    if (!deliveryAddress.detail) {
      showToast('กรุาใส่ที่อย่จัดส่ง', 'warning')
      return
    }
    if (!selectedProvider) {
      showToast('ไม่พบผ้ให้บริการจัดส่งในบริเวนี้', 'error')
      return
    }

    setIsProcessing(true)


    // P0-4: client sends INPUT ONLY (product_id/quantity/options).
    // NO price / unit_price / subtotal / discount / delivery_fee / total_amount.
    const orderInput: OrderInput = {
      items: items.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        options: item.customizations,
      })),
      delivery_round_id: ({ morning: 'round-1', midday: 'round-2', evening: 'round-3' } as Record<string, string>)[selectedRound] || selectedRound,
      delivery_method: selectedProvider.type as any,
      delivery_address: deliveryAddress.detail,
      dropoff_latitude: deliveryAddress.latitude,
      dropoff_longitude: deliveryAddress.longitude,
      customer_name: customer?.name || 'Guest',
      customer_phone: customer?.phone || '',
      payment_method: paymentMethod,
      distance_km: 0,
    }

    // Server-authoritative: RPC computes prices/discount/delivery/total from DB.
    const order = await createOrder(orderInput)
    if (!order) {
      showToast('สร้างออเดอรล้มเหลว กรุาลองใหม่', 'error')
      setIsProcessing(false)
      return
    }

// Payment Intent — created at checkout so the Payment step can confirm it
    // (PromptPay TXN / COD). Stored in payment_intents (Supabase + localStorage).
    try {
      await createPaymentIntent(
        order.order_number,
        order.total_amount,
        paymentMethod,
        { providerId: selectedProvider.id, providerName: selectedProvider.name }
      )
    } catch (e) {
      console.warn('[Checkout] Payment intent creation failed (non-critical):', e)
    }
    // GAP CLOSURE: Request provider delivery for non-self-delivery
    if (selectedProvider.type !== 'self_delivery') {
      try {
        const { requestProviderDelivery } = await import('@/lib/externalProviders')
        await requestProviderDelivery(selectedProvider.id, {
          provider_id: selectedProvider.id,
          order_number: order.order_number,
          pickup_latitude: 10.7016,
          pickup_longitude: 102.1429,
          dropoff_latitude: deliveryAddress.latitude,
          dropoff_longitude: deliveryAddress.longitude,
          dropoff_detail: deliveryAddress.detail,
          items_count: items.length,
          total_weight: items.reduce((sum, item) => sum + item.product.price * 0.1, 0),
          status: 'requested',
          estimated_delivery_time: selectedProvider.estimated_time_minutes,
          actual_delivery_time: null,
        })
      } catch (e) {
        console.warn('[Checkout] Provider delivery request failed (non-critical):', e)
      }
    }

    writeAuditLog({
      action: 'order_create',
      entity_type: 'order',
      entity_id: order.order_number,
      description: `ออเดอรใหม่ #${order.order_number} ดย ${customer?.name || customer?.email || 'Guest'} รวม ${order.total_amount.toFixed(2)} บาท (ผ้ให้บริการ: ${selectedProvider.name})`,
      metadata: { 
        itemCount: items.length, 
        totalAmount: order.total_amount, 
        paymentMethod: paymentMethod,
        deliveryProvider: selectedProvider.id,
        deliveryProviderName: selectedProvider.name,
        deliveryCost: providerCost
      }
    })

    showToast(`สั่งื้อสำเรจ! เลขที่ ${order.order_number}`, 'success')
    
    useNotificationStore.getState().triggerEvent('order_placed', {
      orderNumber: order.order_number,
      userId: customer?.id || '',
      totalAmount: order.total_amount,
      itemCount: items.length,
      deliveryProvider: selectedProvider.name,
    })
    
    navigate(`/payment/${order.order_number}`)
    justPlaced.current = true
    clearCart()
    setIsProcessing(false)
  }

  if (items.length === 0) {
    if (!justPlaced.current) {
      navigate('/cart')
    }
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🛒 Checkout</h1>
        <Link to="/cart" className="btn btn-outline">← กลับตะกร้า</Link>
      </div>

      {/* ✅ v4.0: Deep Link จาก Social Proof CTA (CustomerReviewCard) */}
      {deepLinkMode === 'pre-order' && (
        <div className="mb-6 bg-blue-50 border-2 border-blue-200 p-4 rounded-xl">
          <h3 className="font-bold text-blue-900 mb-1">📅 Deep Link — Checkout แบบ Pre-order</h3>
          <p className="text-sm text-blue-700">คุณมาจากรีวิวลูกค้าจริง — เลือก Delivery Round ถัดไปเพื่อจองเมนูนี้ล่วงหน้า</p>
        </div>
      )}

      {/* Delivery Address */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">📍 ที่อย่จัดส่ง</h3>
        <input
          type="text"
          data-testid="checkout-address"
          placeholder="ใส่ที่อย่จัดส่ง (ถนน, เลขที่บ้าน, หม่ที่)"
          value={deliveryAddress.detail}
          onChange={(e) => setDeliveryAddress({ ...deliveryAddress, detail: e.target.value })}
          className="input mb-3"
        />
<div className="flex items-center gap-2 flex-wrap mb-2">
          <button
            type="button"
            disabled={locating}
            onClick={async () => {
              setLocating(true)
              try {
                const loc = await getGpsLocation()
                useLocationStore.getState().setLocation({
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  addressDetail: deliveryAddress.detail,
                  source: loc.source,
                })
                setDeliveryAddress({ ...deliveryAddress, latitude: loc.latitude, longitude: loc.longitude })
                showToast('Location set via GPS', 'success')
              } catch {
                showToast('GPS not available — please type your address', 'error')
              } finally {
                setLocating(false)
              }
            }}
            className="btn btn-outline text-sm"
          >
            {locating ? 'Locating...' : '📍 Use my location (GPS)'}
          </button>
          <span className="text-xs text-brand-muted">
            current point: ({deliveryAddress.latitude.toFixed(4)}, {deliveryAddress.longitude.toFixed(4)})
          </span>
        </div>
        <div className="text-sm text-brand-muted">
          📐 รัศมีจัดส่ง: 5 กม. จากตัวเมืองจันทบุรี
        </div>
      </div>

      {/* Two-Tier routing estimation (debounced) — additive informational panel */}
      <div className="mb-6">
        <DistanceChecker
          destination={{ latitude: deliveryAddress.latitude, longitude: deliveryAddress.longitude }}
        />
      </div>

      {/* GAP CLOSURE: Delivery Provider Selection */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">🛵 เลือกผ้ให้บริการจัดส่ง</h3>
        {deliveryAddress.detail.length > 5 ? (
          selectedProvider ? (
            <div className="space-y-2">
              <label data-testid="provider-option" className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${'border-brand-primary bg-brand-bg'}`}>
                <div className="w-5 h-5 rounded-full border-2 border-brand-primary flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-brand-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {selectedProvider.name}
                    <span className="text-xs bg-brand-border px-2 py-0.5 rounded-full">{selectedProvider.rating}⭐</span>
                  </div>
                  <div className="text-sm text-brand-muted">
                    ⏱️ ประมา {selectedProvider.estimated_time_minutes} นาที • 📍 รัศมี {selectedProvider.coverage_area.radius_km} กม.
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-brand-primary">{providerCost.toFixed(0)} บาท</div>
                </div>
              </label>
            </div>
          ) : (
            <div className="text-center py-4 text-brand-muted">
              🔍 กำลังค้นหาผ้ให้บริการในบริเวนี้...
            </div>
          )
        ) : (
          <div className="text-center py-4 text-brand-muted">
            ⚠️ กรุาใส่ที่อย่จัดส่งเพื่อเลือกผ้ให้บริการ
          </div>
        )}
        <div className="rounded-lg bg-brand-bg border border-brand-border p-3 mt-2 text-xs text-brand-muted">
          🛵 Bite Drive = the store&apos;s own fleet (self-delivery). Grab / LINE MAN / FoodPanda
          = external partners — sandbox/mock pricing until the store gets their live API keys.
        </div>
      </div>

      {/* Payment Method */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">💳 วิีการชำระเงิน</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-brand-border cursor-pointer hover:border-brand-primary transition-colors">
            <input type="radio" name="payment" value="promptpay_qr" checked={paymentMethod === 'promptpay_qr'} onChange={(e) => setPaymentMethod(e.target.value as any)} className="w-5 h-5" />
            <div>
              <div className="font-medium">QR PromptPay</div>
              <div className="text-sm text-brand-muted">สแกนจ่ายได้เลย</div>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-brand-border cursor-pointer hover:border-brand-primary transition-colors">
            <input type="radio" name="payment" value="cash_on_delivery" checked={paymentMethod === 'cash_on_delivery'} onChange={(e) => setPaymentMethod(e.target.value as any)} className="w-5 h-5" />
            <div>
              <div className="font-medium">เงินสดตอนรับของ</div>
              <div className="text-sm text-brand-muted">จ่ายตอนรับของ</div>
            </div>
          </label>
        </div>
      </div>

      {/* Order Summary */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">สรุปออเดอร</h3>
        <div className="space-y-2 mb-4">
          {items.map((item) => (
            <div key={item.product.id} className="flex justify-between text-sm">
              <div className="min-w-0 flex-1">
                <span>{item.product.name} × {item.quantity}</span>
                {/* Toppings/Add-ons visible under the item — kitchen-readable */}
                {resolveAddOnLines(item.product, item.customizations).length > 0 && (
                  <ul className="mt-0.5 text-xs text-brand-muted" data-testid="co-addons">
                    {resolveAddOnLines(item.product, item.customizations).map((line) => (
                      <li key={line.groupName}>
                        ➕ {line.groupName}
                        {line.selections.length > 0 && <span>: {line.selections.join(', ')}</span>}
                        {line.note && <span> · "{line.note.trim()}"</span>}
                        {line.linePrice > 0 && <span className="text-brand-primary">  +฿{line.linePrice}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span>{item.subtotal.toFixed(2)} ฿</span>
            </div>
          ))}
        </div>
        <div className="border-t border-brand-border pt-4 space-y-2">
          <div className="flex justify-between"><span>สินค้า</span><span>{subtotal.toFixed(2)} บาท</span></div>
          {discount > 0 && (<div className="flex justify-between text-green-600"><span>ส่วนลด</span><span>-{discount.toFixed(2)} บาท</span></div>)}
          <div className="flex justify-between"><span>ค่าจัดส่ง ({selectedProvider?.name || '-'})</span><span>{(selectedProvider ? providerCost : deliveryFee).toFixed(2)} บาท</span></div>
          <div className="flex justify-between text-xl font-bold pt-2 border-t border-brand-border"><span>รวมทั้งหมด</span><span className="text-brand-primary">{total.toFixed(2)} บาท</span></div>
        </div>
      </div>

      <button onClick={handlePlaceOrder} data-testid="place-order" disabled={isProcessing || !selectedProvider} className="btn btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed">
        {isProcessing ? '⏳ กำลังยืนยัน...' : !selectedProvider ? '⚠️ เลือกผ้ให้บริการจัดส่งก่อน' : '✅ ยืนยันสั่งื้อ'}
      </button>
    </div>
  )
}