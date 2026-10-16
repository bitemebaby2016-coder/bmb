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
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { showToast } from '@/components/ui/ToastContainer'
import { createOrder, orderInputFingerprint, type OrderInput, type OrderResult } from '@/lib/bmbAdminApi_orders'
import { SubmitKeyRing, describeIdempotencyError } from '@/lib/orderSubmitKey'
import { planSplitCheckout, type PaymentMethodT, type PlanLine } from '@/lib/m1CheckoutPlan'
import { submitSplitOrders, describeSplitResult } from '@/lib/m1Submit'
import { createPaymentIntent, getPaymentIntents } from '@/lib/paymentGateway'
import { writeAuditLog } from '@/lib/auditLog'
import { useLocationStore, isTrustedSource, deliveryPointStatus } from '@/store/locationStore'
// P2 (Owner OD-2 option A) — Guest Checkout: ยืนยันเบอร์ด้วย OTP แล้วออก session
import { sendGuestCheckoutOtp, createGuestCheckoutSession, describeGuestOtpError } from '@/lib/guestCheckout'
import { resolveAddOnLines } from '@/lib/addonDisplay'
import { DistanceChecker } from '@/components/delivery/DistanceChecker'
import { listRoundsForDate, type DeliveryRoundRow } from '@/lib/bmbAdminApi_rounds'
import { getPublishedScheduleForDate, mirrorPreOrderScheduleGate, checkModeEligibility, type MenuScheduleRow } from '@/lib/bmbMenuSchedule'
import { fetchServerDeliveryFee, feeUiState } from '@/lib/deliveryFeeApi'
import { getBusinessSettings } from '@/lib/bmbAdminApi_settings'
import { resolvePublicBranch } from '@/lib/brandResolver'
import { getProducts } from '@/lib/bmbAdminApi_products'
import { revalidateWithCatalog, reportToToastMessage } from '@/lib/cartPersistence'
import { isBangkokCutoffPassed } from '@/lib/bangkokTime'
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
  return await createPaymentIntent(orderNumber, amount, paymentMethod, metadata)
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { items, subtotal, discount, deliveryFee, total, clearCart, order_mode, isHydrated } = useCartStore()
  const customer = useAuthStore((s) => s.customer)
  const justPlaced = useRef(false)

  // Phase 2 (RC-3 · OD-4): cart mode lock เป็นหลัก — deep link ?mode=pre-order
  // ห้ามสลับโหมดเงียบ ๆ เมื่อตะกร้าล็อกโหมดอื่นอยู่ → lock ชนะ + แจ้งผู้ใช้ (ด้านล่าง)
  const deepLinkPreOrder = searchParams.get('mode') === 'pre-order'
  const lockLabel = order_mode === 'PRE_ORDER' ? 'สั่งล่วงหน้า' : 'ซื้อวันนี้'
  const modeConflict = !!order_mode && deepLinkPreOrder && order_mode !== 'PRE_ORDER'
  const orderMode: OrderMode = order_mode ?? (deepLinkPreOrder ? 'PRE_ORDER' : 'SAME_DAY')
  const today = todayStr()
  const minDate = orderMode === 'PRE_ORDER' ? addDays(today, 1) : today

  useEffect(() => {
    if (modeConflict) {
      showToast(`ตะกร้าถูกล็อกโหมด ${lockLabel} อยู่ — ใช้โหมดเดิมตามที่เลือกไว้`, 'info')
    }
    // notify ครั้งเดียวตอน mount ถ้ามี conflict
  }, [])

  const [scheduledDate, setScheduledDate] = useState(orderMode === 'PRE_ORDER' ? addDays(today, 1) : today)
  const [rounds, setRounds] = useState<DeliveryRoundRow[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState('')
  const [resolvedBranchId, setResolvedBranchId] = useState<string | null>(null) // TEN-07: resolve from round
  const [serverFee, setServerFee] = useState<number | null>(null)
  const [feeSource, setFeeSource] = useState<'server' | 'local-mirror' | 'error' | null>(null)
  const [leadDays, setLeadDays] = useState(1) // DISPLAY ONLY — server policy enforces the real lead
  const [couponCode, setCouponCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'promptpay_qr' | 'cash_on_delivery' | 'credit_card'>('promptpay_qr')
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
  useEffect(() => {
    if (!customer) return // guests are redirected above — skip fetch (no 401 noise)
    let active = true
    void (async () => {
      const list = await listRoundsForDate(scheduledDate)
      if (!active) return
      setRounds(list)
      setSelectedRoundId((prev) => (list.some((r) => r.id === prev) ? prev : (list[0]?.id ?? '')))
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
        const q = await fetchServerDeliveryFee({
          dropoffLatitude: deliveryAddress.latitude,
          dropoffLongitude: deliveryAddress.longitude,
          deliveryMethod: 'self_delivery',
          itemsCount: itemCount,
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
  }, [deliveryAddress.latitude, deliveryAddress.longitude, itemCount, customer, feeRetry])

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

  // ✅ WAVE 4-B: shared in-flight lock for the M1 split engine — prevents
  // double-click/concurrent submit (UI guard ONLY — not database idempotency).
  const submitLockRef = useRef({ busy: false })

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
    if (!deliveryPointStatus(deliveryAddress).orderable) {
      showToast('กรุณาระบุและยืนยันตำแหน่งจัดส่งบนแผนที่ก่อนสั่งซื้อ', 'error')
      return
    }
    if (!selectedRoundId) {
      showToast('กรุณาเลือกรอบการจัดส่ง', 'error')
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

    if (orderMode === 'PRE_ORDER' && scheduledDate < addDays(today, leadDays)) {
      showToast(`จองล่วงหน้าต้องเลือกวันที่อย่างน้อย ${leadDays} วันข้างหน้า`, 'error')
      return
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
        showToast(`สินค้าถูกปิดหรือไม่รองรับโหมด${orderMode === 'PRE_ORDER' ? ' PRE_ORDER ' : ' SAME_DAY '}: ${elig.rejected.join(', ')} — นำออกจากรถเข็นแล้วลองใหม่`, 'error')
        setIsProcessing(false)
        return
      }
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
      )
      if (!gate.allowed) {
        const off = (gate.rejected || []).map((r) => items.find((i) => i.product.id === r.product_id)?.product.name || r.product_id).join(', ')
        showToast(`เมนูวันที่ ${scheduledDate} ไม่รับสินค้านี้: ${off} — เลือกวันอื่นที่เปิดเมนู`, 'error')
        setIsProcessing(false)
        return
      }
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
      // guarded above: confirmed + trusted coords are non-null at this point
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

    // ✅ WAVE 4-B: M1 mixed cart (SAME_DAY + PRE_ORDER) → split child orders.
    // Single-mode carts (the overwhelming common case) skip this entirely and
    // keep the exact legacy path below — all payment methods unchanged (B1).
    const planLines: PlanLine[] = items.map((i) => ({
      product_id: i.product.id,
      name: i.product.name,
      quantity: i.quantity,
      line_mode: i.line_mode ?? orderMode,
    }))
    const isMixedCart = new Set(planLines.map((l) => l.line_mode)).size > 1
    if (isMixedCart) {
      // B3/B4: mixed = cash_on_delivery ONLY → promptpay/credit REJECTED here,
      // BEFORE any create-order RPC is invoked (no order, no intent, no charge).
      if (paymentMethod !== 'cash_on_delivery') {
        showToast('ออเดอร์ผสม (SAME_DAY + PRE_ORDER) รองรับ "เงินสดปลายทาง" เท่านั้น — เปลี่ยนวิธีชำระเงิน หรือสั่งแยกทีละโหมด', 'error')
        return
      }
      const plan = planSplitCheckout(planLines, {
        fallback_mode: orderMode,
        payment_method: paymentMethod as PaymentMethodT,
        delivery_round_id: selectedRoundId,
        scheduled_date: scheduledDate,
      })
      if (!plan.ok) {
        showToast(plan.errors.map((e) => `${e.code}${e.detail ? ` (${e.detail})` : ''}`).join(', '), 'error')
        return
      }
      setIsProcessing(true)
      // child order_number → server total, for 1:1 payment-intent creation.
      const childTotals = new Map<string, number>()
      const result = await submitSplitOrders(plan.children, paymentMethod as PaymentMethodT, {
        lock: submitLockRef.current, // shared across clicks → concurrent submit = 'conflict'
        createChild: async (child) => {
          const childInput: OrderInput = {
            ...orderInput,
            items: child.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
            delivery_round_id: child.delivery_round_id,
            order_mode: child.order_mode,
            payment_method: child.payment_method,
            scheduled_date: child.scheduled_date ?? undefined,
          }
          // WAVE 5A (124): one submit key per child payload — reused on retry,
          // refreshed when the payload is edited (R1/R2/R3 contract).
          const childFp = orderInputFingerprint(childInput)
          const submitKey = submitKeysRef.current.keyFor(childFp)
          try {
            const order = await createOrder({ ...childInput, client_submit_key: submitKey })
            if (!order) {
              // Ambiguous: RPC failed without a definite server code → order MAY
              // exist → classify as 'ambiguous' so the engine NEVER auto-resubmits.
              return { status: 'ambiguous' as const }
            }
            submitKeysRef.current.release(childFp) // created/replayed — settled
            childTotals.set(order.order_number, order.total_amount)
            return { status: 'created' as const, order_number: order.order_number, replay: !!order.replay }
          } catch (e) {
            const code = (e as { code?: string })?.code
            // ERR_IDEMPOTENCY_CONFLICT/KEY_INVALID can never succeed with THIS
            // key → drop it so a retry of the same payload starts clean
            // (BAD_RESULT keeps the key: tx rolled back, no submission row).
            if (code === 'ERR_IDEMPOTENCY_CONFLICT' || code === 'ERR_IDEMPOTENCY_KEY_INVALID') submitKeysRef.current.release(childFp)
            // Definite server rejection (transaction rolled back ⇒ no order) = safe
            // to retry later; anything else is ambiguous → pending, never resubmit.
            return code ? { status: 'failed' as const, code } : { status: 'ambiguous' as const }
          }
        },
      })
      if (result.status !== 'all_created') {
        // Never claim overall success on partial/ambiguous results; keep the cart
        // so the customer can reconcile and retry ONLY proven-failed children (B7-B9).
        showToast(describeSplitResult(result), 'error')
        setIsProcessing(false)
        return
      }
      const createdOrders = result.children.flatMap((s) => (s.outcome?.status === 'created' ? [s.outcome] : []))
      for (const co of createdOrders) {
        // Payment intent 1:1 with its OWN child order number — never a second
        // charge/intent for the same order (B5/B10).
        try {
          // B5/B10: a replayed child (double-submit) must not add a 2nd intent.
          await ensureReplaySafeIntent(co.order_number, childTotals.get(co.order_number) ?? 0, paymentMethod, !!co.replay, {
            providerId: 'self_delivery',
            providerName: 'Bite Me Baby (self delivery)',
          })
        } catch (e) {
          console.warn('[Checkout] Mixed-split payment intent failed (non-critical):', e)
        }
        writeAuditLog({
          action: 'order_create',
          entity_type: 'order',
          entity_id: co.order_number,
          description: co.replay
            ? `ส่งซ้ำ (replay 124) — ใช้ออเดอร์เดิม #${co.order_number} (mixed split) ไม่มีการสร้างออเดอร์ใหม่`
            : `ออเดอร์ใหม่ #${co.order_number} (mixed split) โดย ${customer?.name || customer?.email || 'Guest'} รวม ${(childTotals.get(co.order_number) ?? 0).toFixed(2)} บาท`,
          metadata: { paymentMethod, split: true, scheduledDate, deliveryRoundId: selectedRoundId, replay: !!co.replay },
        })
      }
      const firstNumber = createdOrders[0]?.order_number ?? ''
      showToast(`สั่งซื้อสำเร็จ ${createdOrders.length} ออเดอร์: ${createdOrders.map((c) => c.order_number).join(', ')}`, 'success')
      justPlaced.current = true
      clearCart()
      navigate(`/payment/${firstNumber}`)
      setIsProcessing(false)
      return
    }

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
      // Card flow (P0-5 completion): PaymentConfirmationPage needs the
      // client_secret to run Stripe.js confirmCardPayment. It is returned only
      // by the create-checkout EF (server-derived amount) and handed through
      // navigation state — never stored anywhere durable.
      cardClientSecret = intent?.payment_intent?.client_secret
      if (paymentMethod === 'credit_card' && intent !== null && !cardClientSecret) {
        showToast('ระบบบัตรยังไม่พร้อม — เลือกช่องทางอื่นหรือลองใหม่', 'error')
      }
    } catch (e) {
      console.warn('[Checkout] Payment intent creation failed (non-critical):', e)
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
    useNotificationStore.getState().triggerEvent('order_placed', {
      orderNumber: order.order_number,
      userId: customer?.id || '',
      totalAmount: order.total_amount,
      itemCount: items.length,
    })

    navigate(`/payment/${order.order_number}`, {
      state: paymentMethod === 'credit_card' && cardClientSecret ? { clientSecret: cardClientSecret } : undefined,
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
          {daySchedule.length > 0 ? (
            <div data-testid="schedule-banner" className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              📅 วันที่ {scheduledDate} เปิดเมนูจำกัด ({daySchedule.length} รายการ) — สินค้าที่ไม่อยู่ในเมนูวันนี้ server จะปฏิเสธ (ERR_PRODUCT_NOT_ON_MENU)
            </div>
          ) : (
            <div data-testid="schedule-banner" className="mt-2 p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-brand-muted">
              ไม่มีเมนูจำกัดพิเศษสำหรับวันที่ {scheduledDate} — ใช้เงื่อนไข pre-order ปกติ
            </div>
          )}
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
            <div className="font-medium">Bite Me Baby Delivery (ระบบเลือกช่องทางให้)</div>
            <div className="text-xs text-brand-muted">
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
                  <div className="text-[10px] text-brand-muted">{ui.detail}</div>
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
