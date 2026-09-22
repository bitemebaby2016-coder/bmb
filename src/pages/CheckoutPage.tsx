// ============================================
// Bite Me Baby — Checkout (Phase 3B · ONE canonical order path)
// ============================================
// SAME_DAY and PRE_ORDER both create the order through RPC
// `create_order_with_items` (migration 025 v3 — p_order_mode/p_scheduled_date).
// Server authority kept intact: round status/cutoff/capacity, product mode
// gate, prices, promotion, delivery fee/tier. Client-side numbers are
// DISPLAY ONLY. Round ids come from the DB (`round-YYYYMMDD-<key>`, 024) —
// the hardcoded morning/round-1 mapping is gone.
// ============================================

import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { showToast } from '@/components/ui/ToastContainer'
import { createOrder, type OrderInput } from '@/lib/bmbAdminApi_orders'
import { createPaymentIntent } from '@/lib/paymentGateway'
import { writeAuditLog } from '@/lib/auditLog'
import { useLocationStore } from '@/store/locationStore'
import { getGpsLocation } from '@/lib/locationLogin'
import { resolveAddOnLines } from '@/lib/addonDisplay'
import { DistanceChecker } from '@/components/delivery/DistanceChecker'
import { listRoundsForDate, type DeliveryRoundRow } from '@/lib/bmbAdminApi_rounds'
import { fetchServerDeliveryFee } from '@/lib/deliveryFeeApi'
import { getBusinessSettings } from '@/lib/bmbAdminApi_settings'
import type { OrderMode } from '@/config/platformConfig'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { items, subtotal, discount, deliveryFee, total, clearCart, order_mode } = useCartStore()
  const customer = useAuthStore((s) => s.customer)
  const justPlaced = useRef(false)

  // ✅ Deep link ?mode=pre-order wins; otherwise the cart's locked mode decides.
  const orderMode: OrderMode =
    searchParams.get('mode') === 'pre-order' ? 'PRE_ORDER' : (order_mode ?? 'SAME_DAY')
  const today = todayStr()
  const minDate = orderMode === 'PRE_ORDER' ? addDays(today, 1) : today

  const [scheduledDate, setScheduledDate] = useState(orderMode === 'PRE_ORDER' ? addDays(today, 1) : today)
  const [rounds, setRounds] = useState<DeliveryRoundRow[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState('')
  const [serverFee, setServerFee] = useState<number | null>(null)
  const [feeSource, setFeeSource] = useState<'server' | 'local-mirror' | null>(null)
  const [leadDays, setLeadDays] = useState(1) // DISPLAY ONLY — server policy enforces the real lead
  const [couponCode, setCouponCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'promptpay_qr' | 'cash_on_delivery'>('promptpay_qr')
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    const saved = useLocationStore.getState().location
    return {
      latitude: saved?.latitude ?? 10.7016,
      longitude: saved?.longitude ?? 102.1429,
      detail: saved?.addressDetail ?? '',
    }
  })
  const [locating, setLocating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // 007/025: order creation is authenticated-only → guests are redirected.
  useEffect(() => {
    if (!customer && !justPlaced.current) {
      showToast('กรุณาเข้าสู่ระบบก่อนสั่งซื้อ', 'info')
      navigate('/login')
    }
  }, [customer, navigate])

  // ✅ Canonical rounds for the selected date (deterministic ids, DB authority).
  useEffect(() => {
    let active = true
    void (async () => {
      const list = await listRoundsForDate(scheduledDate)
      if (!active) return
      setRounds(list)
      setSelectedRoundId((prev) => (list.some((r) => r.id === prev) ? prev : (list[0]?.id ?? '')))
    })()
    return () => { active = false }
  }, [scheduledDate])

  // ✅ Server-authoritative delivery fee display (DEL-01 / migration 020 RPC).
  useEffect(() => {
    let active = true
    void (async () => {
      const q = await fetchServerDeliveryFee({
        dropoffLatitude: deliveryAddress.latitude,
        dropoffLongitude: deliveryAddress.longitude,
        deliveryMethod: 'self_delivery',
        itemsCount: Math.max(1, items.reduce((s, i) => s + i.quantity, 0)),
      })
      if (!active) return
      setServerFee(q.delivery_fee)
      setFeeSource(q.source)
      // DISPLAY ONLY — the server re-derives the fee again inside the create RPC.
      useCartStore.getState().setDeliveryFee(q.delivery_fee)
    })()
    return () => { active = false }
  }, [deliveryAddress.latitude, deliveryAddress.longitude, items])

  // order_policy display values (lead days for the PRE_ORDER date picker).
  useEffect(() => {
    void (async () => {
      const s = await getBusinessSettings()
      const policy = (s?.order_policy ?? {}) as Record<string, any>
      if (policy.pre_order_lead_days != null) setLeadDays(Number(policy.pre_order_lead_days) || 1)
    })()
  }, [])

  // Keep the PRE_ORDER date inside the allowed window (server re-validates).
  useEffect(() => {
    if (orderMode === 'PRE_ORDER' && scheduledDate < addDays(today, leadDays)) {
      setScheduledDate(addDays(today, leadDays))
    }
  }, [orderMode, scheduledDate, leadDays, today])

  async function handleUseGps() {
    setLocating(true)
    try {
      const loc = await getGpsLocation()
      useLocationStore.getState().setLocation({
        latitude: loc.latitude,
        longitude: loc.longitude,
        addressDetail: deliveryAddress.detail,
        source: loc.source,
      })
      setDeliveryAddress((a) => ({ ...a, latitude: loc.latitude, longitude: loc.longitude }))
      showToast('Location set via GPS', 'success')
    } catch {
      showToast('GPS not available — please type your address', 'error')
    } finally {
      setLocating(false)
    }
  }

  async function handlePlaceOrder() {
    if (!customer) {
      showToast('กรุณาเข้าสู่ระบบก่อนสั่งซื้อ', 'info')
      navigate('/login')
      return
    }
    if (items.length === 0) return
    if (!selectedRoundId) {
      showToast('กรุณาเลือกรอบการจัดส่ง', 'error')
      return
    }
    if (orderMode === 'PRE_ORDER' && scheduledDate < addDays(today, leadDays)) {
      showToast(`จองล่วงหน้าต้องเลือกวันที่อย่างน้อย ${leadDays} วันข้างหน้า`, 'error')
      return
    }

    setIsProcessing(true)
    // ✅ ONE canonical creation RPC for BOTH modes (migration 025 v3).
    // The payload carries NO price/fee/total — the server derives everything.
    const orderInput: OrderInput = {
      items: items.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        options: item.customizations,
      })),
      delivery_round_id: selectedRoundId,
      delivery_method: 'self_delivery',
      delivery_address: deliveryAddress.detail,
      dropoff_latitude: deliveryAddress.latitude,
      dropoff_longitude: deliveryAddress.longitude,
      customer_name: customer?.name || 'Guest',
      customer_phone: customer?.phone || '',
      payment_method: paymentMethod,
      promotion_code: couponCode.trim() || undefined,
      order_mode: orderMode,
      scheduled_date: orderMode === 'PRE_ORDER' ? scheduledDate : undefined,
    }

    // Server-authoritative: mode gate / cutoff / capacity / pricing inside the RPC.
    const order = await createOrder(orderInput)
    if (!order) {
      showToast('สร้างออเดอร์ล้มเหลว กรุณาลองใหม่', 'error')
      setIsProcessing(false)
      return
    }

    // Payment intent created at checkout (server amount; validated again by 008).
    try {
      await createPaymentIntent(order.order_number, order.total_amount, paymentMethod, {
        providerId: 'self_delivery',
        providerName: 'Bite Me Baby (self delivery)',
      })
    } catch (e) {
      console.warn('[Checkout] Payment intent creation failed (non-critical):', e)
    }

    writeAuditLog({
      action: 'order_create',
      entity_type: 'order',
      entity_id: order.order_number,
      description: `ออเดอร์ใหม่ #${order.order_number} โดย ${customer?.name || customer?.email || 'Guest'} รวม ${order.total_amount.toFixed(2)} บาท (${orderMode})`,
      metadata: {
        itemCount: items.length,
        totalAmount: order.total_amount,
        paymentMethod: paymentMethod,
        orderMode,
        scheduledDate: orderMode === 'PRE_ORDER' ? scheduledDate : today,
        deliveryRoundId: selectedRoundId,
      },
    })

    showToast(`สั่งซื้อสำเร็จ! เลขที่ ${order.order_number}`, 'success')
    useNotificationStore.getState().triggerEvent('order_placed', {
      orderNumber: order.order_number,
      userId: customer?.id || '',
      totalAmount: order.total_amount,
      itemCount: items.length,
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

      {/* Mode banner — ONE canonical checkout, mode decides date/round UX */}
      <div className={`mb-6 border-2 p-4 rounded-xl ${orderMode === 'PRE_ORDER' ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
        <h3 className="font-bold text-brand-accent mb-1">
          {orderMode === 'PRE_ORDER' ? '📅 สั่งซื้อแบบจองล่วงหน้า (Pre-order)' : '🔥 สั่งซื้อวันนี้ (Same-day)'}
        </h3>
        {orderMode === 'PRE_ORDER' ? (
          <p className="text-sm text-blue-700">เลือกวันที่และรอบจัดส่งล่วงหน้า — ระบบเซิร์ฟเวอร์ตรวจ lead time ({leadDays} วัน) และความจุรอบให้อีกครั้ง</p>
        ) : (
          <p className="text-sm text-orange-700">รอบที่เปิดรับวันนี้ — เซิร์ฟเวอร์ตรวจ cutoff (เวลาไทย) และความจุรอบให้อีกครั้ง</p>
        )}
      </div>

      {/* ✅ PRE_ORDER: scheduled date picker (server enforces lead time) */}
      {orderMode === 'PRE_ORDER' && (
        <div className="card mb-6">
          <h3 className="font-bold text-brand-accent mb-4">📅 วันที่ต้องการรับอาหาร</h3>
          <input
            type="date"
            data-testid="preorder-date"
            min={minDate}
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="input mb-2"
          />
          <p className="text-xs text-brand-muted">จองล่วงหน้าได้ตั้งแต่ {minDate} เป็นต้นไป (lead time {leadDays} วัน)</p>
        </div>
      )}

      {/* ✅ Round picker — ACTIVE rounds only (the create RPC rejects the rest) */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">🚚 รอบการจัดส่ง</h3>
        {rounds.length === 0 ? (
          <p className="text-sm text-brand-muted" data-testid="no-rounds">
            ยังไม่มีรอบที่เปิดรับสำหรับวันที่เลือก — ลองเลือกวันอื่น
          </p>
        ) : (
          <div className="space-y-3">
            {rounds.map((r) => {
              const remaining = Math.max(0, Number(r.max_capacity) - Number(r.current_count))
              return (
                <label key={r.id} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${selectedRoundId === r.id ? 'border-brand-primary bg-orange-50' : 'border-brand-border hover:border-brand-primary/50'}`}>
                  <input
                    type="radio"
                    name="round"
                    value={r.id}
                    checked={selectedRoundId === r.id}
                    onChange={() => setSelectedRoundId(r.id)}
                    className="w-5 h-5 mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.display_name || r.round_key || r.id}</div>
                    <div className="text-xs text-brand-muted">
                      ส่ง {String(r.delivery_start).slice(0, 5)}–{String(r.delivery_end).slice(0, 5)} · สั่งได้ถึง {String(r.cutoff_time).slice(0, 5)} · เหลือ {remaining} ที่
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Delivery Address */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">📍 ที่อยู่จัดส่ง</h3>
        <input
          type="text"
          data-testid="checkout-address"
          placeholder="ใส่ที่อยู่จัดส่ง (ถนน, เลขที่บ้าน, หมู่ที่)"
          value={deliveryAddress.detail}
          onChange={(e) => setDeliveryAddress({ ...deliveryAddress, detail: e.target.value })}
          className="input mb-3"
        />
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <button type="button" disabled={locating} onClick={handleUseGps} className="btn btn-outline text-sm">
            {locating ? 'Locating...' : '📍 Use my location (GPS)'}
          </button>
          <span className="text-xs text-brand-muted">
            current point: ({deliveryAddress.latitude.toFixed(4)}, {deliveryAddress.longitude.toFixed(4)})
          </span>
        </div>
      </div>

      {/* Two-Tier routing estimation (debounced) — display-only informational panel */}
      <div className="mb-6">
        <DistanceChecker
          destination={{ latitude: deliveryAddress.latitude, longitude: deliveryAddress.longitude }}
        />
      </div>

      {/* Delivery method — server decides tier/fee; client shows the quote */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">🛵 ช่องทางจัดส่ง</h3>
        <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-brand-primary bg-orange-50">
          <div className="flex-1">
            <div className="font-medium">Bite Me Baby Delivery (ระบบเลือกช่องทางให้)</div>
            <div className="text-xs text-brand-muted">
              เซิร์ฟเวอร์คำนวณระยะทาง ช่องทาง และค่าส่งจริงตอนสร้างออเดอร์ (ลูกค้าไม่ส่งค่าส่งเอง)
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-brand-primary" data-testid="server-fee">
              {serverFee != null ? `${Number(serverFee).toFixed(2)} ฿` : '—'}
            </div>
            <div className="text-[10px] text-brand-muted">{feeSource === 'server' ? 'คำนวณจากเซิร์ฟเวอร์' : 'ประมาณการ'}</div>
          </div>
        </div>
      </div>

      {/* ชำระเงิน */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">💳 ชำระเงิน</h3>
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

      {/* Coupon (server-authoritative promotion) */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-3">🎟️ คูปอง/โปรโมชั่น</h3>
        <div className="flex gap-2">
          <input
            type="text"
            data-testid="coupon-input"
            placeholder="ใส่รหัสคูปอง"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            className="input flex-1"
          />
        </div>
        <p className="text-xs text-brand-muted mt-2">ระบบตรวจและหักส่วนลดจริงที่เซิร์ฟเวอร์ตอนสร้างออเดอร์</p>
      </div>

      {/* Order Summary — client estimate is DISPLAY ONLY */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">สรุปออเดอร์</h3>
        <div className="space-y-2 mb-4">
          {items.map((item) => (
            <div key={item.product.id} className="flex justify-between text-sm">
              <div className="min-w-0 flex-1">
                <span>{item.product.name} × {item.quantity}</span>
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
          {discount > 0 && (<div className="flex justify-between text-green-600"><span>ส่วนลด (ประมาณการ)</span><span>-{discount.toFixed(2)} บาท</span></div>)}
          <div className="flex justify-between"><span>ค่าจัดส่ง (ประมาณการ)</span><span>{deliveryFee.toFixed(2)} บาท</span></div>
          <div className="flex justify-between text-xl font-bold pt-2 border-t border-brand-border"><span>รวมทั้งหมด</span><span className="text-brand-primary">{total.toFixed(2)} บาท</span></div>
          <p className="text-xs text-brand-muted">ยอดสุทธิคำนวณใหม่จากระบบตอนยืนยัน (ราคา/ส่วนลด/ค่าส่งเป็นสิทธิ์ของเซิร์ฟเวอร์)</p>
        </div>
      </div>

      <button
        onClick={handlePlaceOrder}
        data-testid="place-order"
        disabled={isProcessing || !selectedRoundId}
        className="btn btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? '⏳ กำลังยืนยัน...' : !selectedRoundId ? '⚠️ เลือกรอบจัดส่งก่อน' : `✅ ยืนยันสั่งซื้อ${orderMode === 'PRE_ORDER' ? ' (จองล่วงหน้า)' : ''}`}
      </button>
    </div>
  )
}
