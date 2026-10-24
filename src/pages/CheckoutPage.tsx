// ============================================
// Bite Me Baby — Checkout (Phase 3B · ONE canonical order path)
// ============================================
// SAME_DAY and PRE_ORDER both create the order through RPC
// `create_order_with_items_i` (migration 025 v3 + 124 — p_order_mode/
// p_scheduled_date + p_client_submit_key double-submit protection).
// Server authority kept intact: round status/cutoff/capacity, product mode
// gate, prices, promotion, delivery fee/tier. Client-side numbers are
// DISPLAY ONLY. Round ids come from the DB (`round-YYYYMMDD-<key>`, 024) —
// the hardcoded morning/round-1 mapping is gone.
// ============================================

import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCartStore, deriveCartMode } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { showToast } from '@/components/ui/ToastContainer'
import { createOrder, orderInputFingerprint, type OrderInput, type OrderResult } from '@/lib/bmbAdminApi_orders'
import { SubmitKeyRing, describeIdempotencyError } from '@/lib/orderSubmitKey'
import { createPaymentIntent, getPaymentIntents } from '@/lib/paymentGateway'
import { writeAuditLog } from '@/lib/auditLog'
import { useLocationStore, isTrustedSource, deliveryPointStatus } from '@/store/locationStore'
// P2 (Owner OD-2 option A) — Guest Checkout: ยืนยันเบอร์ด้วย OTP แล้วออก session
import { sendGuestCheckoutOtp, createGuestCheckoutSession, describeGuestOtpError } from '@/lib/guestCheckout'
import { resolveAddOnLines } from '@/lib/addonDisplay'
import { DistanceChecker } from '@/components/delivery/DistanceChecker'
import { listRoundsForDate, type DeliveryRoundRow } from '@/lib/bmbAdminApi_rounds'
import { haversineDistanceKm } from '@/lib/deliveryRouter'
import { KITCHEN_POINT } from '@/config/kitchenLocation'
import { getPublishedScheduleForDate, mirrorPreOrderScheduleGate, checkModeEligibility, type MenuScheduleRow } from '@/lib/bmbMenuSchedule'
import { getProductScheduleMap, resolveMenuBoundDate, type ProductScheduleMap } from '@/lib/productSchedule'
import { fetchServerDeliveryFee, feeUiState, summaryFeeState } from '@/lib/deliveryFeeApi'
import { getBusinessSettings } from '@/lib/bmbAdminApi_settings'
import { resolvePublicBranch } from '@/lib/brandResolver'
import { getProducts } from '@/lib/bmbAdminApi_products'
import { revalidateWithCatalog, reportToToastMessage } from '@/lib/cartPersistence'
import { isBangkokCutoffPassed } from '@/lib/bangkokTime'
import { roundBookability, roundStatusLabel } from '@/lib/deliveryRoundStatus'
import { normalizePromoCode } from '@/lib/promotionClient'
import { CouponBox, revalidateCouponForSubmit } from '@/components/CouponBox'
import { getTrustedGpsLocation } from '@/lib/locationLogin'
import { DeliveryMapPicker } from '@/components/delivery/DeliveryMapPicker'
import type { OrderMode } from '@/config/platformConfig'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ✅ WAVE 5A (124) — B5/B10: NEVER a second payment intent for the same order.
// A REPLAYED submit (double-click / retry after timeout) returns the ORIGINAL
// order; the intent is only created when no intent exists yet (timeout gap).
// A read failure falls through to create — a missing intent blocks the
// customer's payment, an extra pending intent is reconcilable by the admin.
// A7(ก.) (2026-10-22): ทุกออเดอร์ต้องมี payment_intents ≥1 เสมอ — ถ้า RPC ตอบ
// failure ชัดเจน ให้ retry อีกหนึ่งครั้งก่อนยอมแพ้ (ห้ามแตะ logic เงินเอง —
// เรียก create_payment_intent_record ทาง createPaymentIntent เดิมเท่านั้น)
async function ensureReplaySafeIntent(
  orderNumber: string,
  amount: number,
  paymentMethod: Parameters<typeof createPaymentIntent>[2],
  replay: boolean,
  metadata: Record<string, any>,
): Promise<Awaited<ReturnType<typeof createPaymentIntent>> | null> {
  if (replay) {
    try {
      const existing = await getPaymentIntents({ orderNumber })
      if (existing.length > 0) return null // original attempt already recorded it
    } catch (e) {
      console.warn('[Checkout] replay intent check failed (creating to avoid unpaid gap):', e)
    }
  }
  const first = await createPaymentIntent(orderNumber, amount, paymentMethod, metadata)
  if (first && first.success === false) {
    console.warn('[Checkout] payment intent create reported failure — retrying once (A7 ก.):', first.error)
    return (await createPaymentIntent(orderNumber, amount, paymentMethod, metadata)) ?? first
  }
  return first
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const { items, subtotal, discount, total, clearCart, isHydrated, couponCode } = useCartStore()
  const customer = useAuthStore((s) => s.customer)
  const justPlaced = useRef(false)

  // ✅ R5c (Owner 2026-10-23): โหมดออเดอร์ = ผลจากเนื้อตะกร้า (ไม่มีปุ่มสลับโหมด/ป๊อปอัปล้างตะกร้า)
  // - มีเมนูจากปฏิทินแอดมิน (เพิ่มแบบ "จองล่วงหน้า") ≥ 1 ชิ้น → ทั้งตะกร้า = PRE_ORDER
  //   (สินค้าทั่วไปติดไปกับรอบพรีออเดอร์ในออเดอร์เดียว รับพร้อมกันที่รอบนั้น)
  // - ไม่มีเมนูปฏิทินในตะกร้า = สั่งวันนี้เท่านั้น (ไม่มีพรีออเดอร์วันอิสระ — deep link ?mode= ไม่เปลี่ยนโหมด)
  const orderMode: OrderMode = deriveCartMode(items) ?? 'SAME_DAY'
  const today = todayStr()

  // ✅ R5 (Owner 2026-10-23): วันจัดส่งของเมนูรอบพิเศษ "ถูกกำหนดโดยปฏิทินแอดมิน"
  // (ป้ายมุมเมนู = ProductScheduleMap) — ล็อกวันอัตโนมัติ ลูกค้าเลือกเฉพาะรอบจัดส่ง
  const [scheduleMap, setScheduleMap] = useState<ProductScheduleMap>({})
  useEffect(() => {
    let alive = true
    void getProductScheduleMap().then((m) => { if (alive) setScheduleMap(m) })
    return () => { alive = false }
  }, [])
  const menuBound = resolveMenuBoundDate(items.map((i) => ({ product_id: i.product.id })), scheduleMap)
  // R5c: วันจัดส่ง = วันเมนูจากป้ายปฏิทินเท่านั้น (ไม่มีช่องเลือกวันอิสระ)
  const scheduledDate = orderMode === 'PRE_ORDER' ? (menuBound.date ?? '') : today
  const [rounds, setRounds] = useState<DeliveryRoundRow[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState('')
  const [resolvedBranchId, setResolvedBranchId] = useState<string | null>(null) // TEN-07: resolve from round
  const [serverFee, setServerFee] = useState<number | null>(null)
  const [feeSource, setFeeSource] = useState<'server' | 'local-mirror' | 'error' | null>(null)
  const [leadDays, setLeadDays] = useState(1) // DISPLAY ONLY — server policy enforces the real lead
  const [paymentMethod, setPaymentMethod] = useState<'promptpay_qr' | 'cash_on_delivery' | 'credit_card'>('promptpay_qr')
  // ✅ 127 pickup fulfillment: 'delivery' (เดิม) | 'pickup' (รับที่ร้าน, ค่าส่ง 0)
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery')
  // CR-2 P0: delivery point = candidate until the customer confirms it.
  // Trusted prefill ONLY (saved provenance gps/manual); kitchen/IP never pre-fill.
  const [deliveryAddress, setDeliveryAddress] = useState<{
    latitude: number | null
    longitude: number | null
    detail: string
    source: '' | 'gps' | 'manual' | 'saved'
    provenance: '' | 'gps' | 'manual'
    confirmed: boolean
  }>(() => {
    const saved = useLocationStore.getState().location
    const savedProvenance = saved?.provenance ?? saved?.source
    const trusted = isTrustedSource(savedProvenance) && saved?.latitude !== 0 && saved?.longitude !== 0
    return {
      latitude: trusted ? saved.latitude : null,
      longitude: trusted ? saved.longitude : null,
      detail: saved?.addressDetail ?? '',
      source: trusted ? ('saved' as const) : ('' as const),
      // CR-2 correction: keep the ORIGINAL provenance of a saved point
      // (gps/manual) — it stays 'saved' for display and is never relabeled 'gps'.
      provenance: trusted && (savedProvenance === 'gps' || savedProvenance === 'manual') ? savedProvenance : '',
      confirmed: false, // saved point still needs an explicit confirmation
    }
  })
  const [locating, setLocating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [daySchedule, setDaySchedule] = useState<MenuScheduleRow[]>([]) // CAT-02: published schedule mirror for the selected date

  // ---- P2 (Owner OD-2 option A) — Guest Checkout ----
  // ลูกค้าใหม่สั่งได้โดย "ไม่ต้องสมัครสมาชิกเต็มรูปแบบ": ยืนยันเบอร์ด้วย OTP
  // แล้วระบบออก session ให้เรียก create_order_with_items (authenticated) ได้ตามเดิม
  // **ไม่แก้** RPC / Payment Authority / Order State Machine ใด ๆ
  const [gOtpSent, setGOtpSent] = useState(false)
  const [gOtpCode, setGOtpCode] = useState('')
  const [gPhone, setGPhone] = useState('')
  const [gName, setGName] = useState('')
  const [gSending, setGSending] = useState(false)
  const [gSubmitting, setGSubmitting] = useState(false)
  const [gError, setGError] = useState('')

  async function handleGuestSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (gSending) return
    setGError('')
    setGSending(true)
    const res = await sendGuestCheckoutOtp(gPhone)
    setGSending(false)
    if (!res.ok) {
      setGError(describeGuestOtpError(res.error))
      return
    }
    setGOtpSent(true)
    showToast('ส่งรหัสยืนยันทาง SMS แล้ว', 'success')
  }

  async function handleGuestVerify(e: React.FormEvent) {
    e.preventDefault()
    if (gSubmitting) return
    setGError('')
    setGSubmitting(true)
    const res = await createGuestCheckoutSession({
      phone: gPhone,
      otpCode: gOtpCode,
      name: gName,
      addressDetail: useLocationStore.getState().location?.addressDetail ?? '',
    })
    setGSubmitting(false)
    if (!res.ok) {
      setGError(describeGuestOtpError(res.error))
      return
    }
    showToast('ยืนยันตัวตนสำเร็จ — ดำเนินการสั่งซื้อต่อได้เลย', 'success')
    // หลัง setSession ใน createGuestCheckoutSession ตัว `customer` จะถูก
    // เติมโดย authStore.checkAuth -> component re-render เข้าสู่ฟอร์มสั่งซื้อปกติ
    void useAuthStore.getState().checkAuth()
  }

  // ✅ Canonical rounds for the selected date (deterministic ids, DB authority).
  // Owner 2026-10-17 "รอบส่งมั่ว": auto-select the FIRST still-bookable round —
  // rows past cutoff/delivery window show as disabled (display mirror only; the
  // create RPC remains the authority and re-checks everything at order time).
  useEffect(() => {
    if (!customer) return // guests are redirected above — skip fetch (no 401 noise)
    let active = true
    void (async () => {
      const list = await listRoundsForDate(scheduledDate)
      if (!active) return
      setRounds(list)
      setSelectedRoundId((prev) => {
        const isToday = scheduledDate === todayStr()
        const prevRow = list.find((r) => r.id === prev)
        if (prevRow && roundBookability(prevRow, { isToday }) === 'open') return prev
        // Owner 2026-10-19: same-day "จัดส่งทันที" — เลือกรอบที่เวลาปัจจุบันอยู่ใน
        // หน้าต่างจัดส่งก่อน (ส่งเลย) ถ้าไม่มีค่อยใช้รอบเปิดถัดไป (อัตโนมัติเสมอ)
        const now = new Date()
        const nowMin = now.getHours() * 60 + now.getMinutes()
        const inWindow = list.find((r) => {
          if (roundBookability(r, { isToday }) !== 'open') return false
          const [sh, sm] = String(r.delivery_start).slice(0, 5).split(':').map(Number)
          const [eh, em] = String(r.delivery_end).slice(0, 5).split(':').map(Number)
          return nowMin >= sh * 60 + sm && nowMin <= eh * 60 + em
        })
        if (inWindow) return inWindow.id
        return list.find((r) => roundBookability(r, { isToday }) === 'open')?.id ?? ''
      })
    })()
    return () => { active = false }
  }, [scheduledDate, customer])

  // ✅ CAT-02: canonical published menu schedule for the selected PRE_ORDER date.
  // DISPLAY MIRROR ONLY — server (trg_menu_gate, migration 039) re-decides at order time.
  useEffect(() => {
    if (!customer) { setDaySchedule([]); return } // guest redirect above — no fetch
    if (orderMode !== 'PRE_ORDER') { setDaySchedule([]); return }
    let active = true
    void (async () => {
      const rows = await getPublishedScheduleForDate(scheduledDate)
      if (!active) return
      setDaySchedule(rows)
    })()
    return () => { active = false }
  }, [orderMode, scheduledDate, customer])

  // ✅ Server-authoritative delivery fee display (DEL-01 / migration 020 RPC).
  // CR-2 P2: no silent zero fee — error quotes render as an explicit error state;
  // debounced + keyed on the item COUNT (not the items array identity) so
  // unrelated cart re-renders cannot spam the RPC.
  const itemCount = Math.max(1, items.reduce((s, i) => s + i.quantity, 0))
  const [feeRetry, setFeeRetry] = useState(0)
  const feeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!customer) return // guest redirect above — skip fee RPC (no 401 noise)
    if (fulfillment === 'pickup') {
      // ✅ 127 PICKUP POLICY: delivery_fee = 0 — no fee RPC, no address needed.
      setServerFee(0)
      setFeeSource('server')
      useCartStore.getState().setDeliveryFee(0)
      return
    }
    if (deliveryAddress.latitude == null || deliveryAddress.longitude == null) {
      // no candidate point yet — do NOT call the RPC (would only error)
      setServerFee(null)
      setFeeSource(null)
      return
    }
    let active = true
    if (feeTimerRef.current) clearTimeout(feeTimerRef.current)
    feeTimerRef.current = setTimeout(() => {
      void (async () => {
        // Owner 2026-10-20 "ค่าส่งต้องซิงค์กับที่แอดมินตั้ง": ส่งระยะที่ลูกค้าเห็น
        // (haversine จากจุดครัวเดียวกับที่แสดงบนแผนที่) เข้า RPC ด้วย — server จะใช้
        // เลขนี้เลือก zone ตรงกับ delivery_zones ที่แอดมินตั้ง ไม่หล่นสูตร legacy
        const q = await fetchServerDeliveryFee({
          dropoffLatitude: deliveryAddress.latitude,
          dropoffLongitude: deliveryAddress.longitude,
          deliveryMethod: 'self_delivery',
          itemsCount: itemCount,
          distanceKm: haversineDistanceKm(
            KITCHEN_POINT.latitude, KITCHEN_POINT.longitude,
            deliveryAddress.latitude as number, deliveryAddress.longitude as number,
          ),
        })
        if (!active) return
        setServerFee(q.delivery_fee)
        setFeeSource(q.source)
        // DISPLAY ONLY — the server re-derives the fee again inside the create RPC.
        if (q.delivery_fee != null) useCartStore.getState().setDeliveryFee(q.delivery_fee)
      })()
    }, 500)
    return () => {
      active = false
      if (feeTimerRef.current) clearTimeout(feeTimerRef.current)
    }
  }, [deliveryAddress.latitude, deliveryAddress.longitude, itemCount, customer, feeRetry, fulfillment])

  // order_policy display values (lead days for the PRE_ORDER date picker).
  useEffect(() => {
    void (async () => {
      const s = await getBusinessSettings()
      const policy = (s?.order_policy ?? {}) as Record<string, any>
      if (policy.pre_order_lead_days != null) setLeadDays(Number(policy.pre_order_lead_days) || 1)
    })()
  }, [])

  // CR-2 P0: TRUSTED GPS ONLY — no IP-geo, no kitchen fallback, honest toast.
  async function handleUseGps() {
    setLocating(true)
    try {
      const loc = await getTrustedGpsLocation()
      if (!loc) {
        showToast('📍 ไม่สามารถระบุตำแหน่งจาก GPS ได้ — กรุณาปักหมุดบนแผนที่หรือกรอกพิกัดเอง', 'error')
        return
      }
      setDeliveryAddress((a) => ({ ...a, latitude: loc.latitude, longitude: loc.longitude, source: 'gps', provenance: 'gps', confirmed: true }))
      showToast('📍 ตำแหน่งจาก GPS — ปรับหมุดบนแผนที่ได้ หรือกดสั่งซื้อได้เลย', 'success')
    } finally {
      setLocating(false)
    }
  }

  // CR-2 P1: candidate pin from the map / manual fallback — requires confirmation.
  function handleMapPick(lat: number, lng: number) {
    setDeliveryAddress((a) => ({ ...a, latitude: lat, longitude: lng, source: 'manual', provenance: 'manual', confirmed: false }))
  }

  function handleConfirmLocation() {
    // CR-2 correction: trust/confirmation is decided by deliveryPointStatus —
    // a saved point keeps its provenance ('saved' + gps/manual origin) and is
    // confirmed as-is; nothing is ever relabeled as 'gps' here.
    if (!deliveryPointStatus(deliveryAddress).confirmable) return
    setDeliveryAddress((a) => ({ ...a, confirmed: true }))
    showToast('✅ ยืนยันตำแหน่งจัดส่งแล้ว', 'success')
  }

  // TEN-07: Resolve branch_id from selected delivery_round for multi-branch routing
  useEffect(() => {
    if (!selectedRoundId || !customer) { setResolvedBranchId(null); return }
    const resolve = async () => {
      const branch = await resolvePublicBranch({ urlParams: { roundId: selectedRoundId } })
      setResolvedBranchId(branch.branch_id || null)
    }
    resolve()
  }, [selectedRoundId, customer])

  // D01: revalidate the (possibly persisted) cart against the CURRENT trusted
  // catalog before checkout — removed/unavailable items are dropped with an
  // explicit notice; canonical store pricing recalculates; the server stays
  // the final authority at order creation.
  const revalidatedRef = useRef(false)
  useEffect(() => {
    if (!customer || revalidatedRef.current) return
    if (useCartStore.getState().items.length === 0) return
    revalidatedRef.current = true
    void (async () => {
      try {
        const products = await getProducts()
        const report = revalidateWithCatalog(products)
        const msg = reportToToastMessage(report, 'checkout')
        if (msg) showToast(msg, 'warning')
      } catch (e) {
        console.warn('[Checkout] cart revalidation skipped (catalog unavailable):', e)
      }
    })()
  }, [customer])

  // P2-9: empty-cart redirect runs in an EFFECT — calling navigate() inside
  // the render body (previous code) triggered React's "Cannot update a
  // component (BrowserRouter) while rendering a different component
  // (CheckoutPage)". isHydrated (D01) waits for async cart restore first.
  useEffect(() => {
    if (customer && items.length === 0 && isHydrated && !justPlaced.current) navigate('/cart')
  }, [customer, items.length, isHydrated, navigate])

  // ✅ WAVE 5A (migration 124): per-payload submit key ring — a retry of the
  // SAME payload reuses its key (server replays the original order), an edited
  // payload gets a fresh one. Survives reload (sessionStorage) so refresh +
  // resubmit cannot create a duplicate order. This is the DATABASE guarantee.
  const submitKeysRef = useRef(new SubmitKeyRing())

  async function handlePlaceOrder() {
    if (!customer) {
      showToast('กรุณาเข้าสู่ระบบก่อนสั่งซื้อ', 'info')
      navigate('/login')
      return
    }
    if (items.length === 0) return
    // CR-2 P0: a confirmed, trusted delivery coordinate is REQUIRED before ordering.
    // (deliveryPointStatus keeps source/provenance separate from trust status.)
    // ✅ 127: pickup orders collect at the store — no delivery point required.
    if (fulfillment === 'delivery' && !deliveryPointStatus(deliveryAddress).orderable) {
      showToast('กรุณาระบุและยืนยันตำแหน่งจัดส่งบนแผนที่ก่อนสั่งซื้อ', 'error')
      return
    }
    if (!selectedRoundId) {
      showToast(fulfillment === 'pickup' ? 'กรุณาเลือกช่วงเวลารับอาหาร' : 'กรุณาเลือกรอบการจัดส่ง', 'error')
      return
    }

    // ✅ SERVER-AUTHORITATIVE AVAILABILITY CHECK (P0 #6: cutoff enforcement)
    // Client-side gate — the RPC enforces the same rules again server-side.
    const selectedRound = rounds.find(r => r.id === selectedRoundId)
    if (selectedRound && orderMode === 'SAME_DAY') {
      // ✅ P0-1: deterministic Asia/Bangkok cutoff gate — CLIENT pre-check only;
      // the server remains the authority (create_order_with_items raises
      // ERR_CUTOFF_PASSED comparing Bangkok `time` with strict `>`). The
      // previous implementation derived "ICT now" with
      // `(ictOffset - getTimezoneOffset())`; getTimezoneOffset() is NEGATIVE
      // east of UTC, so on Thai browsers +7h was applied twice (+14h) and the
      // gate was inverted (blocked BEFORE cutoff / allowed AFTER it). The
      // helper uses UTC getters only → identical in every browser timezone.
      if (isBangkokCutoffPassed(String(selectedRound.cutoff_time || '08:00'))) {
        showToast(`รอบจัดส่งนี้ปิดรับออเดอร์แล้ว (cutoff เวลา ${selectedRound.cutoff_time} น.)`, 'error')
        setIsProcessing(false)
        return
      }
      // Quota check — prevent ordering when round is full
      if (selectedRound.current_count >= selectedRound.max_capacity) {
        showToast('รอบจัดส่งนี้เต็มแล้ว กรุณาเลือกroundอื่น', 'error')
        setIsProcessing(false)
        return
      }
    }

    // ✅ WAVE 2B: stale-cart guard — product disabled/mode-restricted AFTER it
    // entered the (persisted) cart must not reach the RPC. Server re-validates.
    {
      const elig = checkModeEligibility(
        items.map((i) => ({
          product_id: i.product.id,
          name: i.product.name,
          is_available: i.product.is_available === true,
          preorder_ok: (i.product.available_preorder ?? (i.product as any).is_preorder ?? false) === true,
          same_day_ok: (i.product.available_same_day ?? true) === true,
        })),
        orderMode,
      )
      if (!elig.ok) {
        showToast(`สินค้าที่ยังไม่พร้อมสำหรับ${orderMode === 'PRE_ORDER' ? 'รอบพรีออเดอร์' : 'สั่งวันนี้'}: ${elig.rejected.join(', ')} — นำออกจากตะกร้าหรือเลือกรอบใหม่`, 'error')
        setIsProcessing(false)
        return
      }
    }

    // ✅ R5: เมนูรอบพิเศษหลายวันในตะกร้าเดียว = แยกสั่งคนละรอบ (ไม่เดา/ไม่ merge)
    if (menuBound.conflict.length > 1) {
      showToast(`สินค้าเมนูรอบพิเศษถูกกำหนดวันจัดส่งต่างกันตามปฏิทินเมนู (${menuBound.conflict.join(', ')}) — แยกสั่งคนละรอบ`, 'error')
      setIsProcessing(false)
      return
    }

    // ✅ R5c (Owner 2026-10-23 · mirror ของ server ERR_PRE_ORDER_REQUIRES_MENU):
    // พรีออเดอร์ต้องมี ≥1 เมนูจากปฏิทินของวันนั้น — ไม่มีพรีออเดอร์วันอิสระ
    if (orderMode === 'PRE_ORDER' && !menuBound.date) {
      showToast('พรีออเดอร์ต้องมีเมนูจากปฏิทินรอบพิเศษของแอดมิน (ป้ายมุมเมนู) อย่างน้อย 1 รายการในตะกร้า — ไม่มีพรีออเดอร์วันอิสระ', 'error')
      setIsProcessing(false)
      return
    }

    // ✅ lead time (server order_setting('pre_order_lead_days') re-checks): วันเมนูต้องล่วงหน้าพอ
    if (orderMode === 'PRE_ORDER' && scheduledDate < addDays(today, leadDays)) {
      showToast(`จองล่วงหน้าต้องส่งวันที่อย่างน้อย ${leadDays} วันข้างหน้า (วันเมนูปัจจุบัน: ${scheduledDate})`, 'error')
      return
    }

    // ✅ CAT-02: canonical menu schedule mirror (migration 039 trg_menu_gate).
    // Blocks submit BEFORE the RPC so the customer never hits a schedule reject;
    // the server re-validates and remains the only authority.
    if (orderMode === 'PRE_ORDER') {
      const selectedRound = rounds.find((r) => r.id === selectedRoundId)
      const gate = mirrorPreOrderScheduleGate(
        items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        scheduledDate, daySchedule,
        selectedRound?.round_key ?? null, selectedRound?.display_name ?? null,
        scheduleMap,
      )
      if (!gate.allowed) {
        const off = (gate.rejected || []).map((r) => items.find((i) => i.product.id === r.product_id)?.product.name || r.product_id).join(', ')
        showToast(`เมนูรอบพิเศษถูกผูกวัน/รอบตามปฏิทินแอดมิน: ${off} — ย้ายไปวันที่เมนูกำหนด หรือเอาออกจากตะกร้า`, 'error')
        setIsProcessing(false)
        return
      }
    }

    // Coupon gate (M2: validation logic ย้ายเข้า CouponBox module — ที่เดียว):
    // migration 114 silently IGNORES a non-qualifying code (no discount, no
    // error) — so re-validate here and refuse to submit rather than let the
    // customer pay full price believing a discount applied. The server still
    // re-derives the authoritative amount inside the RPC.
    const couponCheck = await revalidateCouponForSubmit(subtotal)
    if (!couponCheck.ok) {
      showToast(couponCheck.message, 'error')
      setIsProcessing(false)
      return
    }
    const expectedDiscount = couponCheck.discountAmount

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
      // ✅ 127: pickup => dedicated canonical path (create_pickup_order_i, fee=0)
      delivery_method: fulfillment === 'pickup' ? 'pickup' : 'self_delivery',
      delivery_address: fulfillment === 'pickup' ? 'รับที่ร้าน (Pickup)' : deliveryAddress.detail,
      // guarded above: confirmed + trusted coords are non-null at this point
      // (pickup path ignores coords — server derives the pickup point)
      dropoff_latitude: deliveryAddress.latitude as number,
      dropoff_longitude: deliveryAddress.longitude as number,
      customer_name: customer?.name || 'Guest',
      customer_phone: customer?.phone || '',
      payment_method: paymentMethod,
      promotion_code: couponCode.trim() || undefined,
      order_mode: orderMode,
      scheduled_date: orderMode === 'PRE_ORDER' ? scheduledDate : undefined,
      // TEN-07: resolve branch from selected delivery_round (round has branch_id column)
      branch_id: resolvedBranchId ?? undefined,
    }

    // ✅ R5c (Owner 2026-10-23): ยกเลิกการแยกเป็น 2 ออเดอร์ (Same-day + Pre-order) —
    // ตะกร้าเดียว = ออเดอร์เดียวเสมอ สินค้าทั่วไป + เมนูรอบพิเศษไปรอบเดียวกัน (ทุกวิธีชำระเงิน)


    // Server-authoritative: mode gate / cutoff / capacity / pricing inside the RPC.
    // WAVE 5A (migration 124): submit key = double-submit protection. A retry of
    // the SAME payload reuses its key → the server replays the original order
    // (order_submissions) instead of creating a second one; an edited payload
    // gets a fresh key (R1 fingerprint / R2 key policy / R3 replay).
    const submitFp = orderInputFingerprint(orderInput)
    let order: OrderResult | null = null
    try {
      order = await createOrder({ ...orderInput, client_submit_key: submitKeysRef.current.keyFor(submitFp) })
    } catch (e) {
      const code = (e as { code?: string })?.code
      // CONFLICT/KEY_INVALID can never succeed with THIS key → drop it so the
      // next attempt of the same payload starts clean (BAD_RESULT keeps it).
      if (code === 'ERR_IDEMPOTENCY_CONFLICT' || code === 'ERR_IDEMPOTENCY_KEY_INVALID') submitKeysRef.current.release(submitFp)
      showToast(describeIdempotencyError(code), 'error')
      setIsProcessing(false)
      return
    }
    if (!order) {
      showToast('สร้างออเดอร์ล้มเหลว กรุณาลองใหม่', 'error')
      setIsProcessing(false)
      return
    }
    submitKeysRef.current.release(submitFp) // created/replayed — payload settled

    // Payment intent created at checkout (server amount; validated again by 008).
    let cardClientSecret: string | undefined
    try {
      const intent = await ensureReplaySafeIntent(order.order_number, order.total_amount, paymentMethod, !!order.replay, {
        providerId: 'self_delivery',
        providerName: 'Bite Me Baby (self delivery)',
      })
      // A7(ก.): failure ต้องเห็นชัด (หน้า /payment จะ self-heal intent ให้อัตโนมัติ)
      if (intent && intent.success === false) {
        showToast('⚠ ยังบันทึกช่องทางชำระเงินไม่สำเร็จ — ระบบจะลองอัตโนมัติในหน้าชำระเงิน (ถ้ายังพลาด แอดมินจะเห็น "ไม่พบ payment intent")', 'warning')
      }
      // Card flow (P0-5 completion): PaymentConfirmationPage needs the
      // client_secret to run Stripe.js confirmCardPayment. It is returned only
      // by the create-checkout EF (server-derived amount) and handed through
      // navigation state — never stored anywhere durable.
      cardClientSecret = intent?.payment_intent?.client_secret
      if (paymentMethod === 'credit_card' && intent !== null && !cardClientSecret) {
        showToast('ระบบบัตรยังไม่พร้อม — เลือกช่องทางอื่นหรือลองใหม่', 'error')
      }
    } catch (e) {
      console.warn('[Checkout] Payment intent creation failed:', e)
      showToast('⚠ ยังบันทึกช่องทางชำระเงินไม่สำเร็จ — ระบบจะลองอัตโนมัติในหน้าชำระเงิน (ถ้ายังพลาด แอดมินจะเห็น "ไม่พบ payment intent")', 'warning')
    }

    writeAuditLog({
      action: 'order_create',
      entity_type: 'order',
      entity_id: order.order_number,
      description: order.replay
        ? `ส่งซ้ำ (replay 124) — ใช้ออเดอร์เดิม #${order.order_number} ไม่มีการสร้างออเดอร์ใหม่ (${orderMode})`
        : `ออเดอร์ใหม่ #${order.order_number} โดย ${customer?.name || customer?.email || 'Guest'} รวม ${order.total_amount.toFixed(2)} บาท (${orderMode})`,
      metadata: {
        itemCount: items.length,
        totalAmount: order.total_amount,
        paymentMethod: paymentMethod,
        orderMode,
        scheduledDate: orderMode === 'PRE_ORDER' ? scheduledDate : today,
        deliveryRoundId: selectedRoundId,
        replay: !!order.replay,
      },
    })

    if (order.replay) {
      // 124 R3 evidence: double-submit/retry returns the ORIGINAL order — the
      // customer sees the same number and NO second order exists anywhere.
      showToast(`ตรวจพบการส่งซ้ำ — ใช้ออเดอร์เดิม #${order.order_number} (ไม่มีการสร้างออเดอร์ใหม่)`, 'success')
    } else {
      showToast(`สั่งซื้อสำเร็จ! เลขที่ ${order.order_number}`, 'success')
    }
    // Server-truth coupon outcome (114 silently ignores non-qualifying codes) —
    // report the amount ACTUALLY applied so the receipt never contradicts the UI.
    if (couponCode.trim()) {
      const serverDiscount = Number(order.discount_amount) || 0
      if (serverDiscount > 0) {
        showToast(`ระบบหักส่วนลดจากโค้ด ${normalizePromoCode(couponCode)} แล้ว ${serverDiscount.toFixed(2)} บาท`, 'success')
      } else if (expectedDiscount > 0) {
        showToast('ระบบไม่ได้หักส่วนลด (โค้ดไม่เข้าเงื่อนไข ณ เวลายืนยัน) — ยอดที่ชำระเป็นราคาเต็ม ตรวจสอบรายละเอียดได้ในออเดอร์', 'warning')
      }
    }
    useNotificationStore.getState().triggerEvent('order_placed', {
      orderNumber: order.order_number,
      userId: customer?.id || '',
      totalAmount: order.total_amount,
      itemCount: items.length,
    })

    navigate(`/payment/${order.order_number}`, {
      // D-06 (R1.5): replay flag ไปกับ state ให้หน้า /payment แสดง banner ถาวร
      // "ออเดอร์เดิม/ใหม่" — ไม่เงียบเหมือน toast ที่หายไป
      state: {
        ...(paymentMethod === 'credit_card' && cardClientSecret ? { clientSecret: cardClientSecret } : {}),
        replay: !!order.replay,
      },
    })
    justPlaced.current = true
    clearCart()
    setIsProcessing(false)
  }

  if (items.length === 0) return null

  // ---- P2 gate: ลูกค้าที่ยังไม่มี session -> แสดงช่องยืนยันเบอร์แทนการ redirect ----
  // (Owner OD-2 option A: สั่งได้โดยไม่ต้องสมัครสมาชิกเต็มรูปแบบ)
  // หมายเหตุ: การยืนยันนี้ "ไม่ใช่" หลักฐานการชำระเงิน และไม่ให้สิทธิ์เข้าบัญชีอื่น
  if (!customer && !justPlaced.current) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="card bg-brand-surface">
          <h2 className="text-2xl font-bold text-brand-accent mb-2">ยืนยันเบอร์โทรศัพท์</h2>
          <p className="text-sm text-brand-muted mb-5">
            ไม่ต้องสมัครสมาชิก — ยืนยันว่าคุณเป็นเจ้าของเบอร์นี้ แล้วสั่งซื้อได้ทันที
          </p>

          {gError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {gError}
            </div>
          )}

          <form onSubmit={handleGuestSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">ชื่อ-นามสกุล</label>
              <input
                value={gName}
                onChange={(e) => setGName(e.target.value)}
                className="input"
                placeholder="ชื่อของคุณ"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">เบอร์โทรศัพท์</label>
              <input
                type="tel"
                value={gPhone}
                onChange={(e) => setGPhone(e.target.value)}
                className="input"
                placeholder="เช่น 0812345678"
                required
              />
            </div>
            <button
              type="submit"
              disabled={gSending || gPhone.trim().length < 9}
              className={`btn btn-outline w-full ${gSending ? 'btn-disabled' : ''}`}
            >
              {gSending ? 'กำลังส่ง…' : gOtpSent ? 'ส่งรหัสใหม่' : 'ส่งรหัสยืนยัน'}
            </button>
          </form>

          {gOtpSent && (
            <form onSubmit={handleGuestVerify} className="space-y-3 mt-4 pt-4 border-t border-brand-border">
              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">รหัส 6 หลักจาก SMS</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={gOtpCode}
                  onChange={(e) => setGOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="input tracking-[0.4em]"
                  placeholder="รหัสยืนยัน"
                />
              </div>
              <button
                type="submit"
                disabled={gSubmitting || gOtpCode.length !== 6}
                className={`btn btn-primary w-full ${gSubmitting ? 'btn-disabled' : ''}`}
              >
                {gSubmitting ? 'กำลังยืนยัน…' : 'ยืนยันและสั่งซื้อต่อ'}
              </button>
            </form>
          )}

          <div className="text-center mt-5">
            <button
              type="button"
              onClick={() => navigate('/login', { state: { from: '/checkout' } })}
              className="text-sm text-brand-primary hover:underline"
            >
              มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    )
  }

  const selectedRound = rounds.find((r) => r.id === selectedRoundId) ?? null

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🛒 Checkout</h1>
        <Link to="/cart" className="btn btn-outline">← กลับตะกร้า</Link>
      </div>

      {/* Mode banner — ONE canonical checkout, mode decides date/round UX */}
      <div className={`mb-6 border-2 p-4 rounded-xl ${orderMode === 'PRE_ORDER' ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
        {/* พื้น banner เป็นสีอ่อน → หัวข้อต้องสีเข้มเสมอ (dark mode เห็นชัด) */}
        <h3 className="font-bold text-slate-900 mb-1">
          {orderMode === 'PRE_ORDER' ? '📅 สั่งซื้อแบบจองล่วงหน้า (Pre-order)' : '🔥 สั่งซื้อวันนี้ (Same-day)'}
        </h3>
        {orderMode === 'PRE_ORDER' ? (
          <p className="text-sm text-blue-700">วันจัดส่งถูกกำหนดโดยเมนูรอบพิเศษของแอดมิน (ป้ายมุมเมนู) — เลือกเฉพาะรอบจัดส่งด้านล่าง (ไม่มีพรีออเดอร์วันอิสระ) ระบบเซิร์ฟเวอร์ตรวจ lead time ({leadDays} วัน) และความจุรอบให้อีกครั้ง</p>
        ) : (
          <p className="text-sm text-orange-700">🛵 สั่งวันนี้ = จัดส่งทันที ระบบเลือกรอบเปิดรับให้อัตโนมัติ — เซิร์ฟเวอร์ตรวจ cutoff (เวลาไทย) และความจุรอบให้อีกครั้ง</p>
        )}
      </div>

      {/* ✅ R5c: PRE_ORDER — วันจัดส่ง "ล็อก" โดยเมนูปฏิทินแอดมิน (ไม่มีช่องเลือกวันอิสระ) */}
      {orderMode === 'PRE_ORDER' && (
        <div className="card mb-6">
          <h3 className="font-bold text-brand-accent mb-4">📅 วันจัดส่ง (กำหนดโดยเมนูรอบพิเศษ)</h3>
          {menuBound.date ? (
            <>
              <div
                data-testid="preorder-date"
                className="mb-2 px-3 py-2 rounded-lg border-2 border-brand-primary bg-orange-50 font-bold text-slate-900"
              >
                📅 {menuBound.date}
              </div>
              <p className="text-xs text-blue-700" data-testid="menu-date-lock">
                วันจัดส่งถูกกำหนดโดยเมนูรอบพิเศษของแอดมิน (ปฏิทินเมนู): <b>{menuBound.date}</b> — เลือกเฉพาะรอบจัดส่งด้านล่าง
              </p>
            </>
          ) : (
            <p className="text-xs text-amber-700" data-testid="preorder-requires-menu">
              พรีออเดอร์ต้องมีเมนูจากปฏิทินรอบพิเศษของแอดมิน (การ์ดที่มี "ป้ายปฏิทิน") อย่างน้อย 1 รายการในตะกร้า —
              ไม่มีพรีออเดอร์วันอิสระ (ถ้าต้องการสั่งสินค้าทั่วไปวันนี้ ใช้โหมด "สั่งวันนี้")
            </p>
          )}
          {menuBound.conflict.length > 1 && (
            <p className="text-xs text-red-600 mt-1" data-testid="menu-date-conflict">
              สินค้าเมนูรอบพิเศษถูกกำหนดวันจัดส่งต่างกันตามปฏิทินเมนู ({menuBound.conflict.join(', ')}) — แยกสั่งคนละรอบ
            </p>
          )}
          {daySchedule.length > 0 ? (
            <div data-testid="schedule-banner" className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              📅 วันที่ {scheduledDate} มีเมนูรอบพิเศษ ({daySchedule.length} รายการ) — เมนูเหล่านี้ถูกผูกวัน/รอบตามปฏิทินแอดมิน สินค้าทั่วไปสั่งร่วมรอบเดียวกันได้ (server: ERR_PRODUCT_NOT_ON_MENU เฉพาะเมนูที่ผิดวัน/รอบ)
            </div>
          ) : (
            <div data-testid="schedule-banner" className="mt-2 p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-slate-600">
              ไม่มีเมนูรอบพิเศษของวันที่ {scheduledDate} ในตาราง — พรีออเดอร์ใช้ได้เฉพาะวันที่มีเมนูจากปฏิทินแอดมิน
            </div>
          )}
        </div>
      )}

      {/* ✅ Round selection — Owner 2026-10-19: SAME_DAY = "จัดส่งทันที" อัตโนมัติ
          (ระบบเลือกรอบเปิดรับให้เอง ไม่ให้ลูกค้าเลือก) · PRE_ORDER = เลือกรอบตามวันที่จอง
          (server create RPC ยังตรวจ cutoff/ความจุ/วันที่ของรอบที่เลือกเหมือนเดิม) */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">{orderMode === 'PRE_ORDER' ? '🚚 รอบการจัดส่ง' : '🛵 จัดส่งทันที'}</h3>
        {orderMode !== 'PRE_ORDER' ? (
          selectedRound ? (
            <div data-testid="same-day-auto-round" className="p-3 rounded-lg border-2 border-brand-primary bg-orange-50">
              <div className="font-medium text-slate-900">จัดส่งทันที — ระบบเลือกรอบเปิดรับให้อัตโนมัติ</div>
              <div className="text-xs text-slate-600 mt-1">
                รอบที่ระบบเลือก: {selectedRound.display_name || selectedRound.round_key || selectedRound.id} · ส่ง {String(selectedRound.delivery_start).slice(0, 5)}–{String(selectedRound.delivery_end).slice(0, 5)} · เหลือ {Math.max(0, Number(selectedRound.max_capacity) - Number(selectedRound.current_count))} ที่
              </div>
              <div className="text-xs text-slate-500 mt-1">
                ออเดอร์วันนี้ส่งทันทีตามรอบที่เปิดรับอยู่ ไม่ต้องเลือกรอบเอง (การจองล่วงหน้าจะเลือกวัน/รอบแยกต่างหาก)
              </div>
            </div>
          ) : (
            <p className="text-sm text-brand-muted" data-testid="no-rounds">
              ยังไม่มีรอบที่เปิดรับสำหรับวันนี้ — ลองใหม่ภายหลัง หรือสั่งแบบจองล่วงหน้า
            </p>
          )
        ) : rounds.length === 0 ? (
          <p className="text-sm text-brand-muted" data-testid="no-rounds">
            ยังไม่มีรอบที่เปิดรับสำหรับวันที่เลือก — ลองเลือกวันอื่น
          </p>
        ) : (
          <div className="space-y-3">
            {rounds.map((r) => {
              const remaining = Math.max(0, Number(r.max_capacity) - Number(r.current_count))
              const status = roundBookability(r, { isToday: scheduledDate === today })
              const closed = status !== 'open'
              const selected = selectedRoundId === r.id
              return (
                <label
                  key={r.id}
                  data-testid={`round-row-${r.id}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors ${selected ? 'border-brand-primary bg-orange-50' : 'border-brand-border hover:border-brand-primary/50'} ${closed ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="round"
                    value={r.id}
                    checked={selected}
                    disabled={closed}
                    onChange={() => setSelectedRoundId(r.id)}
                    className="w-5 h-5 mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    {/* พื้นปุ่มเลือกเป็นสีครีม (bg-orange-50) → ตัวอักษรต้องเข้มเสมอ ห้ามใช้สีธีม */}
                    <div className={`font-medium ${selected ? 'text-slate-900' : ''}`}>{r.display_name || r.round_key || r.id}</div>
                    <div className={`text-xs ${selected ? 'text-slate-600' : 'text-brand-muted'}`}>
                      ส่ง {String(r.delivery_start).slice(0, 5)}–{String(r.delivery_end).slice(0, 5)} · สั่งได้ถึง {String(r.cutoff_time).slice(0, 5)} · {closed ? roundStatusLabel(status) : `เหลือ ${remaining} ที่`}
                    </div>
                  </div>
                  {closed && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-200 text-slate-700 whitespace-nowrap">
                      {roundStatusLabel(status)}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* ✅ 127: Fulfillment mode — Delivery vs Customer Pickup */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">🛵 วิธีรับสินค้า</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="fulfillment-delivery"
            onClick={() => setFulfillment('delivery')}
            className={`p-3 rounded-lg border-2 text-left transition-colors ${fulfillment === 'delivery' ? 'border-brand-primary bg-orange-50' : 'border-brand-border hover:border-brand-primary/50'}`}
          >
            <div className="font-medium text-slate-900">จัดส่งถึงที่</div>
            <div className="text-xs text-slate-600">ค่าจัดส่งตามระยะทาง</div>
          </button>
          <button
            type="button"
            data-testid="fulfillment-pickup"
            onClick={() => setFulfillment('pickup')}
            className={`p-3 rounded-lg border-2 text-left transition-colors ${fulfillment === 'pickup' ? 'border-brand-primary bg-orange-50' : 'border-brand-border hover:border-brand-primary/50'}`}
          >
            <div className="font-medium text-slate-900">รับที่ร้าน</div>
            <div className="text-xs text-slate-600">ค่าจัดส่งฟรี · รับตามช่วงเวลาที่เลือก</div>
          </button>
        </div>
        {fulfillment === 'pickup' && (
          <div className="mt-3 text-sm text-slate-700 bg-orange-50 border border-orange-200 rounded-lg p-3" data-testid="pickup-hint">
            รับอาหารที่หน้าร้านตามช่วงเวลาที่เลือก — ระบบจะออก <b>รหัสรับอาหาร</b> ให้แสดงตอนรับ (ค่าจัดส่ง 0 บาท)
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
          <span className="text-xs text-brand-muted" data-testid="location-status">
            {deliveryAddress.latitude != null && deliveryAddress.longitude != null
              ? `ตำแหน่ง: (${deliveryAddress.latitude.toFixed(4)}, ${deliveryAddress.longitude.toFixed(4)}) · แหล่งที่มา: ${
                  deliveryAddress.source === 'gps' ? 'GPS' : deliveryAddress.source === 'manual' ? 'ปักหมุดเอง' : 'ที่บันทึกไว้'
                }${deliveryAddress.confirmed ? ' · ✅ ยืนยันแล้ว' : ' · ⏳ ยังไม่ยืนยัน'}`
              : 'ยังไม่มีตำแหน่งจัดส่ง — กด GPS หรือปักหมุดบนแผนที่ด้านล่าง'}
          </span>
        </div>

        {/* CR-2 P1: visible map + draggable/clickable marker + manual fallback */}
        <DeliveryMapPicker
          latitude={deliveryAddress.latitude}
          longitude={deliveryAddress.longitude}
          onPick={handleMapPick}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-testid="confirm-location"
            disabled={!deliveryPointStatus(deliveryAddress).confirmable}
            onClick={handleConfirmLocation}
          >
            ✅ ยืนยันตำแหน่งจัดส่งนี้
          </button>
          {!deliveryAddress.confirmed && deliveryAddress.latitude != null && (
            <span className="text-xs text-amber-600">กรุณายืนยันตำแหน่งก่อนสั่งซื้อ</span>
          )}
        </div>
      </div>

      {/* Two-Tier routing estimation (debounced) — display-only informational panel */}
      <div className="mb-6">
        <DistanceChecker
          destination={
            deliveryAddress.latitude != null && deliveryAddress.longitude != null
              ? { latitude: deliveryAddress.latitude, longitude: deliveryAddress.longitude }
              : null
          }
        />
      </div>

      {/* Delivery method — server decides tier/fee; client shows the quote */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">🛵 ช่องทางจัดส่ง</h3>
        <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-brand-primary bg-orange-50">
          <div className="flex-1">
            {/* พื้นครีม → ตัวอักษรเข้มเสมอ (เดิมใช้สีธีม ทำให้ขาวบนขาวใน dark mode) */}
            <div className="font-medium text-slate-900">Bite Me Baby Delivery (ระบบเลือกช่องทางให้)</div>
            <div className="text-xs text-slate-600">
              เซิร์ฟเวอร์คำนวณระยะทาง ช่องทาง และค่าส่งจริงตอนสร้างออเดอร์ (ลูกค้าไม่ส่งค่าส่งเอง)
            </div>
          </div>
          <div className="text-right">
            {(() => {
              const ui = feeUiState({ delivery_fee: serverFee, source: feeSource ?? 'error' })
              return (
                <>
                  <div
                    className={`font-bold ${ui.tone === 'error' ? 'text-amber-600' : 'text-brand-primary'}`}
                    data-testid="server-fee"
                  >
                    {ui.label}
                  </div>
                  <div className="text-[10px] text-slate-600">{ui.detail}</div>
                  {ui.tone === 'error' && (
                    <button type="button" className="btn btn-ghost btn-xs mt-1" onClick={() => setFeeRetry((n) => n + 1)}>
                      ลองคำนวณใหม่
                    </button>
                  )}
                </>
              )
            })()}
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
              <div className="font-medium">PromptPay (สแกน QR ของร้าน → โอนเอง)</div>
              <div className="text-sm text-brand-muted">โอนแล้วใส่เลขธุรกรรม — แอดมินตรวจสอบและยืนยันการชำระเงินให้</div>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-brand-border cursor-pointer hover:border-brand-primary transition-colors">
            <input type="radio" name="payment" value="credit_card" checked={paymentMethod === 'credit_card'} onChange={(e) => setPaymentMethod(e.target.value as any)} className="w-5 h-5" />
            <div>
              <div className="font-medium">บัตรเครดิต/เดบิต (Stripe)</div>
              <div className="text-sm text-brand-muted">ปลอดภัยผ่าน Stripe — ตัดเงินจริงทันทีที่ยืนยัน</div>
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

      {/* M2: coupon UI รวมเป็น CouponBox component เดียว — ใช้ร่วมกับ CartPage */}
      <CouponBox />

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
          {/* A3 (2026-10-22): ค่าส่งโซน = ค่าที่แอดมินตั้ง (ไม่ต้องเบลอเป็น "ประมาณการ");
              ถ้า quote พัง/ยังไม่มี ต้องไม่โชว์ค่าเก่าเหมือนคำนวณแล้ว — ระบุ "รอระบบคำนวณ"
              + ติดป้ายยอดโดยประมาณ (server re-derive ตอนสร้างออเดอร์เสมอ) */}
          {(() => {
            const s = summaryFeeState({ delivery_fee: serverFee, source: feeSource }, { pickup: fulfillment === 'pickup' })
            return (
              <>
                <div className="flex justify-between"><span>{s.feeLabel}</span><span data-testid="summary-fee-value">{s.feeValue}</span></div>
                <div className="flex justify-between text-xl font-bold pt-2 border-t border-brand-border"><span>รวมทั้งหมด</span><span className="text-brand-primary" data-testid="summary-total">{total.toFixed(2)} {s.totalSuffix}</span></div>
              </>
            )
          })()}
          <p className="text-xs text-brand-muted">ยอดสุทธิคำนวณใหม่จากระบบตอนยืนยัน (ราคา/ส่วนลด/ค่าส่งเป็นสิทธิ์ของเซิร์ฟเวอร์)</p>
        </div>
      </div>

      <button
        onClick={handlePlaceOrder}
        data-testid="place-order"
        disabled={isProcessing || !selectedRoundId}
        className="btn btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? '⏳ กำลังยืนยัน...' : !selectedRoundId ? (rounds.length > 0 ? '⚠️ ยังไม่มีรอบที่เปิดรับสำหรับวันนี้' : '⚠️ เลือกรอบจัดส่งก่อน') : `✅ ยืนยันสั่งซื้อ${orderMode === 'PRE_ORDER' ? ' (จองล่วงหน้า)' : ''}`}
      </button>
    </div>
  )
}
