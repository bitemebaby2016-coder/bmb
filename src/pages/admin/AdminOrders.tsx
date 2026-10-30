import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/store/notificationStore'
import { showToast } from '@/components/ui/ToastContainer'
import {
  getOrdersPaged, updateOrderStatus, confirmOfflinePayment, rejectOfflinePayment, stripeRefundOrder, cancelOrder,
  getDeliveryAssignmentsFor, getOrderStatusHistory, getOrderAuditTrail, getRoundsByIds, getOrder,
} from '@/lib/bmbAdminApi_orders'
// R21 (Owner 2026-10-29): พิมพ์ใบสั่งอาหารเข้าครัว/ใบเสร็จจากเทมเพลตเดิมของระบบ
import {
  loadPrinterSettings, runAutoPrint, printOrderTicket, describePrinterTarget, buildPrintOrderData,
  type PrintJobType,
} from '@/lib/printService'
// R31: คิวสติกเกอร์ Bluetooth อัตโนมัติ (1 ดวง/ชิ้น ต่อคิว) + แปล error ไทย
import { stickerRollForOrder, printStickerRoll, describeStickerRollError } from '@/lib/stickerQueue'
import { niimbotSupported } from '@/lib/niimbotBt'
import type { DeliveryAssignmentLiteRow } from '@/lib/bmbAdminApi_orders'
import { getProductsAdmin } from '@/lib/bmbAdminApi_products'
import { summarizeOrderProfit, formatBaht, formatPct, type CostInput } from '@/lib/marginCalc'
import { detectNewPendingOrders, playKitchenChime } from '@/lib/kitchenAlert'
import { addOnLinesFromChoices } from '@/lib/addonDisplay'
import {
  orderModeBadge, paymentStateBadge, deliveryStateBadge,
  isCancellable,
} from '@/lib/adminOrderDisplay'
import {
  groupPreOrders, roundCapacityState, roundCutoffState, isPaymentException,
} from '@/lib/preOrderQueue'
import type { RoundLite } from '@/lib/preOrderQueue'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import type { Product } from '@/types'
import { useAdminTenantContextStore } from '@/lib/adminTenantContext'
import { getPaymentIntentsFor, getPaymentExceptionOrders, describePaymentConfirmError, paymentConfirmability, type PaymentIntentLite } from '@/lib/paymentExceptions'
import { SlipReviewPanel } from '@/components/admin/SlipReviewPanel'
import { SlipThumb } from '@/components/admin/SlipThumb'

const PAGE_SIZE = 25

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready_for_dispatch', label: 'Ready to dispatch' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'failed', label: 'Failed' },
] as const

// STEP 3B-2A: operational status → notification event (in-app surface only —
// SMS/email/push/LINE/pg_cron remain FROZEN per Owner decision 3).
// M4 (2026-10-22): ปุ่มสั่งงานไม่กระจัดอีกต่อไป — เหตุการณ์ notification ของ
// แต่ละ transition ถูกยิงจากหน้าที่เป็นเจ้าของปุ่มนั้น (AdminOrders=ยืนยันออเดอร์
// · AdminKitchen=สายครัว · DeliveryManagement=สายส่ง)

export function AdminOrders() {
  const [orders, setOrders] = useState<OrderForm[]>([])
  const [filterStatus, setFilterStatus] = useState('all')
  // STEP 3B-2A: SAME_DAY / PRE_ORDER is a server-side filter (Phase D display only —
  // the pre-order queue/cutoff/capacity workflow itself belongs to 3B-2B).
  // Phase 4 (RC-6): preset จาก URL (?mode=PRE_ORDER|SAME_DAY) — redirect ของหน้าแยก
  // bookmark เก่า (/admin/pre-orders) ชี้มานี่ → ยังเห็นเฉพาะ PRE_ORDER โดยไม่ต้องมีหน้าแยก
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [filterMode, setFilterMode] = useState<'all' | 'SAME_DAY' | 'PRE_ORDER'>(() => {
    const p = searchParams.get('mode')
    return p === 'SAME_DAY' || p === 'PRE_ORDER' ? p : 'all'
  })
  const [productById, setProductById] = useState<Record<string, Product>>({})
  // W4-A: server-side pagination — avoids loading the full orders table on every visit.
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loadError, setLoadError] = useState('')
  // STEP 3B-2A Phase B: delivery-assignment state per order (migration 020 rows, RLS admin).
  const [assignmentByOrder, setAssignmentByOrder] = useState<Record<string, DeliveryAssignmentLiteRow>>({})
  // A2+M5 (2026-10-22): payment_intents ของทุกออเดอร์ในหน้านี้ — query ครั้งเดียวต่อ
  // หน้า (getPaymentIntentsFor = เส้นอ่านเดียวผ่าน paymentGateway) แล้วส่งเป็น props
  // เข้า SlipThumb/SlipReviewPanel (เลิก self-fetch ซ้ำทีละออเดอร์)
  const [intentsByOrder, setIntentsByOrder] = useState<Record<string, PaymentIntentLite[]>>({})
  // R21 (Owner ask #3): ประตูตรวจสลิปก่อนรับออเดอร์ — เงินโอนค้างตรวจ → ต้องดูรูป
  // + ยืนยัน (confirm_offline_payment ตัวเดิม) ก่อน/พร้อมกด "รับออเดอร์"
  const [slipGate, setSlipGate] = useState<string | null>(null)
  // R3 (D-08): ถ้าอ่าน payment_intents ไม่ได้ ต้องแสดง banner ชัด — ห้ามเงียบจน
  // แอดมินคิดว่า "ไม่มีสลิป" (ต้นเหตุ D-08 เดิมคือ read โดน REVOKE แล้วคืน [])
  const [paymentReadError, setPaymentReadError] = useState('')
  // D-04 (R1.2, 2026-10-23): แผงตรวจสลิป = "ทุกออเดอร์ที่รอตรวจ" ไม่ผูกหน้า/ตัวกรอง/สาขา
  // (เดิมใช้ filteredOrders ของหน้า → ออเดอร์ที่อยู่คนละหน้า/ถูก filter/branch บัง
  //  ไม่โผล่ในแผงเลย = ที่ Owner เจอ "สลิปตรวจไม่ได้")
  const [reviewOrders, setReviewOrders] = useState<OrderForm[]>([])
  // STEP 3B-2B: delivery_rounds rows (canonical capacity/cutoff source of truth) for the
  // PRE_ORDER queue header — DISPLAY ONLY; server RPCs (025/038) enforce the rules.
  const [roundsById, setRoundsById] = useState<Record<string, RoundLite>>({})
  // Phase C inspection: lazily-loaded lifecycle trace + audit trail per expanded order.
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [inspect, setInspect] = useState<{ history: any[]; audit: any[]; loading: boolean }>({ history: [], audit: [], loading: false })
  // [Task 3 · T3-a] สำเนา orders ล่าสุดไว้ใน ref — ใช้เทียบหา "ออเดอร์เข้าใหม่"
  // (loadOrders เป็น useCallback ที่ไม่ depend `orders` — closure จะค้างค่าเก่าถ้าไม่มี ref)
  const ordersRef = useRef<OrderForm[]>([])
  const chimeBaselineRef = useRef(false)

  const loadOrders = useCallback(async (p: number = page, status: string = filterStatus, mode: 'all' | 'SAME_DAY' | 'PRE_ORDER' = filterMode) => {
    setLoadError('')
    const res = await getOrdersPaged({
      page: p,
      pageSize: PAGE_SIZE,
      status: status === 'all' ? undefined : status,
      // RC-1 / Phase 3: mode filter ต้องเป็น server-side — ส่ง `orderMode` เข้า query จริง
      // (bmbAdminApi_orders.ts:147 ทำ .eq('order_mode', ...) อยู่แล้ว) — 'all' = ไม่กรอง
      orderMode: mode === 'all' ? undefined : mode,
      
      // TEN-07: filter by active admin branch context\n      branchId: useAdminTenantContextStore.getState().activeBranchId || undefined,
    })
    // [Task 3 · T3-a] เสียงเตือนออเดอร์เข้า — เทียบกับหน้าก่อนหน้าจริงผ่าน ref
    // (โหลดแรกของหน้า = baseline เงียบ ไม่ตีกระดิ่งกับของค้างเก่าทั้งหน้า)
    const prevOrders = ordersRef.current
    const freshPending = chimeBaselineRef.current ? detectNewPendingOrders(prevOrders, res.orders) : []
    chimeBaselineRef.current = true
    ordersRef.current = res.orders
    if (freshPending.length > 0) playKitchenChime()
    setOrders(res.orders)
    setTotal(res.total)
    const numbers = res.orders.map((o) => o.order_number)
    const assignments = await getDeliveryAssignmentsFor(numbers)
    const amap: Record<string, DeliveryAssignmentLiteRow> = {}
    for (const a of assignments) amap[a.order_number] = a
    setAssignmentByOrder(amap)
    // A2+M5: intents ของทุกออเดอร์ในหน้า — query เดียว (batch) แล้ว map ตาม order_number
    // R3 (D-08): อ่านไม่ได้ = log + banner ชัด (ไม่เงียบ) — ส่วน orders โหลดต่อได้ตามปกติ
    const imap: Record<string, PaymentIntentLite[]> = {}
    let payReadErr = ''
    try {
      const intents = await getPaymentIntentsFor(numbers)
      for (const it of intents) {
        ;(imap[it.order_number] ||= []).push(it)
      }
    } catch (e) {
      payReadErr = String((e as Error)?.message || e)
      console.error('[AdminOrders] payment intents read failed:', payReadErr)
    }
    setIntentsByOrder(imap)
    // D-04: แผงตรวจสลิปโหลดรายการ "รอตรวจ" เองต่างหากจากตัวกรองหน้า/สาขา —
    // payment_status='pending' ทั้งหมด (getPaymentExceptionOrders = read-only,
    // RLS admin scope) แล้วเติม intents ของชุดนี้เข้า map เดิม (ยังเป็น
    // query เดียวต่อหน้า — แยกเป็นครั้งที่สองเฉพาะเมื่อมีรายการใหม่ให้ตรวจ)
    const review = (await getPaymentExceptionOrders()).filter((o) => o.payment_status === 'pending')
    setReviewOrders(review)
    const reviewNumbers = review.map((o) => o.order_number).filter((n) => !imap[n])
    if (reviewNumbers.length > 0) {
      try {
        const more = await getPaymentIntentsFor(reviewNumbers)
        for (const it of more) {
          ;(imap[it.order_number] ||= []).push(it)
        }
        setIntentsByOrder({ ...imap })
      } catch (e) {
        payReadErr = payReadErr || String((e as Error)?.message || e)
        console.error('[AdminOrders] payment intents (review set) read failed:', payReadErr)
      }
    }
    setPaymentReadError(
      payReadErr
        ? `โหลดข้อมูลการชำระเงิน/สลิปไม่สำเร็จ: ${payReadErr} — หลักฐานอาจไม่แสดงในแผงตรวจสลิป`
        : '',
    )
    // 3B-2B: rounds for the current page (queue headers read the DB source of truth)
    const roundIds = Array.from(new Set(res.orders.map((o) => o.delivery_round_id).filter(Boolean))) as string[]
    const rounds = await getRoundsByIds(roundIds)
    const rmap: Record<string, RoundLite> = {}
    for (const r of rounds) rmap[(r as any).id] = r as RoundLite
    setRoundsById(rmap)
    const products = await getProductsAdmin()
    const map: Record<string, Product> = {}
    for (const p of products || []) map[p.id] = p
    setProductById(map)
  }, [page, filterStatus, filterMode])

  useEffect(() => {
    loadOrders()
    // R3 (D-07): refresh ทันทีที่กลับเข้าหน้า (ไม่ใช้ realtime — polling/focus เท่านั้น)
    const onFocus = () => { if (!document.hidden) void loadOrders() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [loadOrders])

  function changeFilter(status: string) {
    setFilterStatus(status)
    setPage(0)
  }
  function changeMode(mode: 'all' | 'SAME_DAY' | 'PRE_ORDER') {
    setFilterMode(mode)
    setPage(0)
  }
  function changePage(p: number) {
    setPage(p)
  }

  // M4 (2026-10-22): "รับออเดอร์" (pending→confirmed) = ปุ่มสั่งงานเดียวที่เหลือ
  // ของหน้านี้ (การจัดการออเดอร์) — สายครัวอยู่ที่ AdminKitchen · สายส่งอยู่ที่
  // Dispatch Center (DeliveryManagement) · ปุ่มเดียวกันห้ามมีสองที่
  async function handleAcceptOrder(orderNumber: string) {
    // R21 (Owner ask #3): เงินโอนค้างตรวจสลิป → บังคับผ่าน "ประตูตรวจสลิป" ก่อน
    // (reuse ระบบเดิมทั้งหมด: SlipThumb โชว์รูปจริง + confirm_offline_payment ตัวเดิม)
    const row = orders.find((o) => o.order_number === orderNumber)
    const evidence = intentsByOrder[orderNumber] || []
    if (row?.payment_status === 'pending' && evidence.some((i) => i.slip_path)) {
      setSlipGate(orderNumber)
      return
    }
    await acceptOrderCore(orderNumber)
  }

  // ขั้นตอน "รับออเดอร์จริง" (ต่อจากประตูตรวจสลิป หรือออเดอร์ที่ไม่มีสลิปค้างตรวจ)
  async function acceptOrderCore(orderNumber: string) {
    const updated = await updateOrderStatus(orderNumber, 'confirmed')
    loadOrders()
    if (!updated) {
      showToast('ยืนยันออเดอร์ไม่สำเร็จ (state machine rule)', 'error')
      return
    }
    useNotificationStore.getState().triggerEvent('order_confirmed', { orderNumber })
    showToast('ยืนยันออเดอร์แล้ว (pending → confirmed)', 'success')
    // R21: รับออเดอร์แล้ว → พิมพ์ใบสั่งอาหารเข้าครัวอัตโนมัติจากเทมเพลตเดิม
    // (fire-and-forget: การพิมพ์พังไม่มีผลกับออเดอร์ — ออเดอร์ยืนยันแล้ว)
    void autoPrintKitchenTicket(orderNumber)
    // R31 (Owner): คิวสติกเกอร์ Bluetooth ต่อทันที — 1 ดวง/ชิ้น หลายใบต่อกัน (ทุกช่องทาง = orders กลาง)
    void autoPrintStickerRoll(orderNumber)
    // [Task 3 · T3-a] เสียงเตือนพร้อมใบสั่งครัว — อยู่ในจังหวะ click (user gesture)
    // จึงไม่ติดนโยบาย autoplay ของเบราว์เซอร์
    playKitchenChime()
  }

  // R21 (Owner ask #3): กด "ยืนยันสลิป & รับออเดอร์" ในประตู — ยืนยันเงินด้วย
  // canonical RPC ตัวเดิม (confirm_offline_payment) ก่อน แล้วค่อยรับออเดอร์
  async function handleSlipGateConfirm(orderNumber: string) {
    setSlipGate(null)
    await handleConfirmPayment(orderNumber)
    await acceptOrderCore(orderNumber)
  }

  // R21 (Owner 2026-10-29) — พิมพ์อัตโนมัติหลัง "รับออเดอร์": ใช้ buildKitchenTicketHtml
  // (เทมเพลตที่มีอยู่แล้ว) + สถานะ autoPrintKitchen + เครื่องพิมพ์ที่ผูกไว้ในตั้งค่า
  // R23 (2026-10-30): แก้ auto-print ไม่ทำงาน — frame ถูกลบก่อน print() เสร็จ → ยิง print แล้วค่อยลบ
  async function autoPrintKitchenTicket(orderNumber: string) {
    try {
      const settings = await loadPrinterSettings()
      if (!settings.autoPrintKitchen) return
      const full = await getOrder(orderNumber)
      if (!full) return
      const target = describePrinterTarget(settings, 'kitchen')
      const results = await runAutoPrint(buildPrintOrderData(full), 'kitchen_ticket', settings)
      if (results.length > 0) {
        const failed = results.filter((r) => r.status === 'failed')
        if (failed.length > 0) {
          showToast(`พิมพ์ใบสั่งครัวไม่สำเร็จ — ตรวจเครื่องพิมพ์แล้วกดพิมพ์ใหม่`, 'warning')
        } else {
          showToast(`ส่งใบสั่งครัวไปที่ "${target}" แล้ว (สถานะ sent ยังไม่ยืนยันว่ากระดาษออกจริง)`, 'info')
        }
      }
    } catch (e) {
      console.warn('[AdminOrders] auto-print failed (order unaffected):', e)
    }
  }

  // R31 (Owner 2026-10-30): คิวสติกเกอร์ Bluetooth อัตโนมัติหลังรับออเดอร์ — 1 ดวง/ชิ้น ต่อกันหลายใบ
  // (เว็บ/โซเชียล/ข้อความ = orders กลางอยู่แล้ว → getOrder ตัวเดิม cover ทุกช่องทาง · fire-and-forget)
  async function autoPrintStickerRoll(orderNumber: string) {
    try {
      const settings = await loadPrinterSettings()
      if (!settings.autoPrintStickers) return
      if (!niimbotSupported()) return // ไม่ใช่ Chrome/Edge = ข้ามเงียบ (frame/QZ ยังเป็นทางเดิม)
      const full = await getOrder(orderNumber)
      if (!full) return
      const roll = stickerRollForOrder(buildPrintOrderData(full))
      showToast(`กำลังพิมพ์สติกเกอร์ ${roll.length} ใบ (Bluetooth ต่อคิว)…`, 'info')
      await printStickerRoll(roll)
      showToast(`✅ สติกเกอร์ ${roll.length} ใบ — เครื่องยืนยันครบแล้ว`, 'success')
    } catch (e) {
      console.warn('[AdminOrders] auto sticker roll failed (order unaffected):', e)
      showToast('พิมพ์สติกเกอร์อัตโนมัติไม่สำเร็จ: ' + describeStickerRollError(e), 'warning')
    }
  }

  // R21 — แอดมิน "เลือกพิมพ์เอง" ทีละออเดอร์ (enqueue job แบบ idempotent + พิมพ์ทันที)
  async function printOrderManually(orderNumber: string, type: PrintJobType) {
    try {
      const [full, settings] = await Promise.all([getOrder(orderNumber), loadPrinterSettings()])
      if (!full) {
        showToast('โหลดข้อมูลออเดอร์ไม่สำเร็จ — ลองใหม่', 'error')
        return
      }
      const target = describePrinterTarget(settings, type === 'receipt' ? 'receipt' : 'kitchen')
      const outcome = await printOrderTicket(full, type, settings)
      if (outcome === 'sent') {
        showToast(`ส่งงาน${type === 'receipt' ? 'ใบเสร็จ' : 'ใบสั่งครัว'}ไปที่ "${target}" แล้ว (รอเครื่องพิมพ์ยืนยัน)`, 'success')
      } else {
        showToast(`เปิดคำสั่งพิมพ์ไม่สำเร็จ — ตรวจเครื่องพิมพ์ "${target}" ในระบบ`, 'error')
      }
    } catch (e) {
      console.warn('[AdminOrders] manual print failed:', e)
      showToast('พิมพ์ไม่สำเร็จ — ลองใหม่', 'error')
    }
  }

  async function handleConfirmPayment(orderNumber: string) {
    // P0-5: server-authoritative — COD requires delivered, PromptPay requires TXN submitted.
    // A2 (2026-10-22): this is the SINGLE confirm_offline_payment action — it lives
    // only in the SlipReviewPanel ("แผงตรวจสลิปเดียว"); the order rows no longer
    // carry a duplicate confirm button.
    const r = await confirmOfflinePayment(orderNumber)
    loadOrders()

    if (r.success) {
      useNotificationStore.getState().triggerEvent('payment_confirmed', { orderNumber })
      showToast('Payment confirmed', 'success')
      // R10 (Owner 2026-10-27): ยืนยันชำระแล้วเด้งไปหน้าทำงานต่ออัตโนมัติ = เข้าครัว/ผลิต
      navigate('/admin/kitchen')
    } else {
      // D-04 (R1.2): บอกเหตุผลชัดเจนเป็นภาษาไทย (ERR_NO_PAYMENT_INTENT /
      // ERR_INTENT_NOT_PROCESSING / ERR_COD_NOT_DELIVERED ฯลฯ) แทน ERR code ลอย ๆ
      showToast(describePaymentConfirmError(r.error), 'error')
    }
  }

  // R10 (Owner 2026-10-27): "ต้องมีปุ่มที่ปฏิเสธโดยมือแอดมิน เผื่อสลิปไม่ถูกหรือเงินไม่เข้า"
  async function handleRejectPayment(orderNumber: string) {
    const reason = window.prompt(
      `ปฏิเสธการชำระเงินของ ${orderNumber}\nเหตุผล (เช่น สลิปไม่ถูกต้อง / เงินยังไม่เข้า):`,
      'สลิปไม่ถูกต้อง / เงินยังไม่เข้า',
    )
    if (reason === null) return // แอดมินกดยกเลิก
    const r = await rejectOfflinePayment(orderNumber, reason)
    loadOrders()
    if (r.success) {
      showToast(`ปฏิเสธการชำระเงิน ${orderNumber} แล้ว (payment = failed)`, 'success')
    } else {
      showToast(`ปฏิเสธไม่สำเร็จ: ${r.error || 'ไม่ทราบสาเหตุ'}`, 'error')
    }
  }

  async function handleStripeRefund(orderNumber: string) {
    // C-6: server-side Stripe refund (admin-only EF). Full refund by default.
    const r = await stripeRefundOrder(orderNumber)
    loadOrders()
    if (r.success) {
      showToast(`Refund successful (${r.data?.payment_status || 'refund'})`, 'success')
    } else {
      showToast(r.error || 'Refund failed', 'error')
    }
  }

  // STEP 3B-2A GAP-A2: admin cancellation goes through the canonical ATOMIC
  // `cancel_order` RPC (authz + capacity release + inventory restore + delivery-
  // assignment cancel + audit in ONE transaction) — NOT transition_order_status.
  async function handleCancelOrder(orderNumber: string) {
    const reason = window.prompt(`Cancel reason for ${orderNumber} (optional)`)
    if (reason === null) return // operator aborted the prompt
    const r = await cancelOrder(orderNumber, reason)
    await loadOrders()
    if (r.success) {
      showToast(
        r.idempotent ? 'Already cancelled' : `Cancelled (${r.previous_status})${r.capacity_released ? ' · round capacity released' : ''}${r.inventory_restored ? ' · inventory restored' : ''}`,
        'success',
      )
      if (r.note) showToast(r.note, 'info')
    } else {
      showToast(r.error || 'Cannot cancel', 'error')
    }
  }

  // Phase C inspection: status history (order_status_history, migration 040) +
  // audit trail (audit_logs, migration 018) — both admin-RLS read-only.
  async function toggleInspect(orderNumber: string) {
    if (expandedOrder === orderNumber) {
      setExpandedOrder(null)
      return
    }
    setExpandedOrder(orderNumber)
    setInspect({ history: [], audit: [], loading: true })
    const [history, audit] = await Promise.all([
      getOrderStatusHistory(orderNumber),
      getOrderAuditTrail(orderNumber),
    ])
    setInspect({ history, audit, loading: false })
  }

  // W4-A: server already filtered the current page — no client re-filter.
  const filteredOrders = orders

  // STEP 3B-2B: PRE_ORDER queue grouping (display only — canonical spine columns)
  const preGroupsByKey: Record<string, ReturnType<typeof groupPreOrders>[number]> = {}
  if (filterMode === 'PRE_ORDER') {
    for (const g of groupPreOrders(filteredOrders)) preGroupsByKey[g.key] = g
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">📋 Manage Orders</h1>
        <Link to="/admin" className="btn btn-outline">← Dashboard</Link>
      </div>

      <div className="flex gap-2 mb-2 overflow-x-auto">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status.key}
            onClick={() => changeFilter(status.key)}
            className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
              filterStatus === status.key ? 'bg-brand-primary text-white' : 'bg-brand-surface text-brand-accent hover:bg-brand-bg'
            }`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {/* STEP 3B-2A GAP-A4: SAME_DAY / PRE_ORDER distinguishable at filter level (display only) */}
      <div className="flex gap-2 mb-6">
        {([
          { key: 'all', label: 'All modes' },
          { key: 'SAME_DAY', label: '⚡ SAME_DAY' },
          { key: 'PRE_ORDER', label: '📅 PRE_ORDER' },
        ] as const).map((mode) => (
          <button
            key={mode.key}
            onClick={() => changeMode(mode.key)}
            className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all text-sm ${
              filterMode === mode.key ? 'bg-brand-accent text-white' : 'bg-brand-surface text-brand-accent hover:bg-brand-bg'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* R3 (D-08): error ของการอ่าน payment_intents ต้องมองเห็น ไม่หายเงียบ */}
      {paymentReadError && (
        <div className="card mb-3 border border-red-400 bg-red-50 text-sm text-red-700" data-testid="payment-read-error">
          ⚠️ {paymentReadError}
        </div>
      )}

      {/* A2 (2026-10-22): "แผงตรวจสลิปเดียว" — จุดเดียวที่ตรวจหลักฐานการโอน +
          กดยืนยันการชำระเงิน (confirm_offline_payment) · M5: intents query ครั้งเดียว
          ใน loadOrders แล้วส่งต่อเป็น props (SlipThumb เลิก self-fetch)
          · D-04 (R1.2): ส่ง reviewOrders (ทุกออเดอร์รอตรวจ ไม่ผูกตัวกรองหน้า/สาขา) */}
      <SlipReviewPanel
        orders={reviewOrders}
        intentsByOrder={intentsByOrder}
        onConfirmPayment={handleConfirmPayment}
        onRejectPayment={handleRejectPayment}
      />

      {/* R21 (Owner ask #3): ประตูตรวจสลิปก่อนรับออเดอร์ — โชว์รูปสลิปจริง (SlipThumb)
          + ยืนยันด้วย canonical RPC ตัวเดิม ไม่มีการ UPDATE เงินจาก client */}
      {slipGate && (() => {
        const o = orders.find((x) => x.order_number === slipGate) || reviewOrders.find((x) => x.order_number === slipGate)
        const ev = intentsByOrder[slipGate] || []
        const check = o ? paymentConfirmability(o, ev) : null
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" data-testid="slip-gate-modal">
            <div className="card max-w-md w-full p-4 bg-white max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-brand-accent mb-2">🧾 ตรวจสลิปก่อนรับออเดอร์ {slipGate}</h3>
              <p className="text-xs text-brand-muted mb-3">
                ออเดอร์นี้มีหลักฐานการโอนค้างตรวจ — ดูรูปสลิปด้านล่าง แล้วยืนยันการชำระเงิน
                (ระบบเดิม = confirm_offline_payment) ก่อน/พร้อมกดรับออเดอร์
              </p>
              <SlipThumb
                orderNumber={slipGate}
                paymentStatus={o?.payment_status || 'pending'}
                paymentMethod={o?.payment_method || ''}
                intents={ev}
              />
              {check && !check.confirmable && (
                <p className="mt-2 text-xs text-amber-700" data-testid={`slip-gate-reason-${slipGate}`}>⚠ {check.reason}</p>
              )}
              <div className="flex gap-2 mt-4 justify-end">
                <button type="button" className="btn btn-outline text-sm" onClick={() => setSlipGate(null)} data-testid="slip-gate-later">
                  ⏳ ไว้ก่อน
                </button>
                <button
                  type="button"
                  className="btn btn-success text-sm disabled:opacity-50"
                  disabled={!check?.confirmable}
                  onClick={() => { void handleSlipGateConfirm(slipGate) }}
                  data-testid={`slip-gate-confirm-accept-${slipGate}`}
                >
                  ✅ ยืนยันสลิป &amp; รับออเดอร์
                </button>
              </div>
            </div>
          </div>
        )
      })()}

<div className="space-y-4">
        {filteredOrders.map((order) => {
          const modeBadge = orderModeBadge(order.order_mode, order.scheduled_date)
          const payBadge = paymentStateBadge(order.payment_status)
          const dlvBadge = deliveryStateBadge(assignmentByOrder[order.order_number])
          // 3B-2B queue context: group header before the first order of each (date|round) group
          const grp = filterMode === 'PRE_ORDER' ? preGroupsByKey[`${order.scheduled_date || '—'}|${order.delivery_round_id || '—'}`] : null
          const cap = grp ? roundCapacityState(roundsById[grp.roundId] ?? null, grp.orders.length) : null
          const cut = grp ? roundCutoffState(roundsById[grp.roundId] ?? null) : null
          const payExcCount = grp ? grp.orders.filter((o) => isPaymentException(o.payment_status)).length : 0
          return (
          <div key={order.id}>
          {grp && grp.orders[0].order_number === order.order_number && (
            <div className="card mb-2" data-testid="preorder-queue-header">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-brand-accent">📅 {grp.scheduledDate}</span>
                <span className="badge badge-primary">{grp.roundId}</span>
                {roundsById[grp.roundId]?.display_name && <span className="badge badge-primary">{roundsById[grp.roundId].display_name}</span>}
                <span className={`badge ${cap!.cls}`}>{cap!.label}</span>
                <span className="badge badge-info">{cut!.label}</span>
                {roundsById[grp.roundId]?.status && <span className="badge badge-primary">round: {roundsById[grp.roundId].status}</span>}
                {payExcCount > 0 && <span className="badge badge-warning">⚠ payment needs attention: {payExcCount}</span>}
                <span className="text-brand-muted">({grp.orders.length} orders)</span>
              </div>
            </div>
          )}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold">
                  {order.order_number.slice(-3)}
                </div>
                <div>
                  <div className="font-bold text-brand-accent">{order.order_number}</div>
                  <div className="text-sm text-brand-muted">
                    {order.customer_name} • {order.customer_phone} • {new Date(order.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {/* STEP 3B-2A GAP-A3: mode / scheduled date / round / payment / delivery badges */}
                  <div className="flex flex-wrap gap-1 mt-1 text-xs" data-testid="admin-order-badges">
                    <span className={`badge ${modeBadge.mode === 'PRE_ORDER' ? 'badge-warning' : modeBadge.mode === 'SAME_DAY' ? 'badge-info' : 'badge-danger'}`}>
                      {modeBadge.label}
                    </span>
                    <span className="badge badge-primary">Round {order.delivery_round_id || '—'}</span>
                    <span className={`badge ${payBadge.cls}`}>{payBadge.label}</span>
                    <span className="badge badge-primary">{order.payment_method || '—'}</span>
                    <span className={`badge ${dlvBadge.cls}`} data-testid="admin-order-delivery-state">{dlvBadge.label}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-brand-primary">฿{order.total_amount}</div>
                {(() => {
                  // [Task 1 · T1-c] กำไร/ออเดอร์ real-time ในระบบหลังบ้าน — เรียก
                  // summarizeOrderProfit → computeOrderProfit ที่มีอยู่แล้ว (ไม่มีสูตรใหม่ ·
                  // ข้อมูลต้นทุนไม่พอ = บอกตรง ๆ ห้ามโชว์ตัวเลขกำไรปลอม)
                  const costById: Record<string, CostInput> = {}
                  for (const i of order.items) {
                    if (costById[i.product_id]) continue
                    const p = productById[i.product_id]
                    if (p) {
                      costById[i.product_id] = {
                        cogs: p.cogs,
                        packagingCost: p.packaging_cost,
                        otherCost: p.other_unit_cost,
                      }
                    }
                  }
                  const sum = summarizeOrderProfit(
                    order.items.map((i) => ({
                      productId: i.product_id,
                      unitPrice: Number(i.unit_price) || 0,
                      quantity: Number(i.quantity) || 0,
                    })),
                    costById,
                    { discountTotal: Number(order.discount_amount) || 0 },
                  )
                  if (sum.status === 'empty') return null
                  if (sum.status === 'no_cost_data') {
                    return (
                      <div className="text-xs text-brand-muted" data-testid="admin-order-profit-pending">
                        📊 กำไร: {sum.message}
                      </div>
                    )
                  }
                  return (
                    <div className="text-xs font-semibold text-emerald-700" data-testid="admin-order-profit">
                      📊 กำไรสุทธิ ~{formatBaht(sum.profit.netProfit)} ({formatPct(sum.profit.netMarginPct)})
                    </div>
                  )
                })()}
                <span className={`badge ${
                  order.status === 'delivered' ? 'badge-success' :
                  order.status === 'preparing' ? 'badge-info' :
                  order.status === 'pending' ? 'badge-warning' : 'badge-primary'
                }`} data-testid="admin-order-status">
                  {order.status}
                </span>
              </div>
            </div>

            <div className="text-sm text-brand-muted mb-3">
              <strong>Items:</strong>
              <ul className="mt-1 space-y-1" data-testid="admin-order-items">
                {order.items.map((i) => {
                  const addonLines = addOnLinesFromChoices(productById[i.product_id]?.addons, i.customizations?.addOns)
                  return (
                    <li key={i.product_id} className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-brand-accent">{i.product_name}</span>
                        <span className="text-brand-muted"> × {i.quantity}</span>
                        {addonLines.length > 0 && (
                          <ul className="pl-3 text-xs text-brand-muted list-disc list-inside">
                            {addonLines.map((line) => (
                              <li key={line.groupName}>
                                {line.groupName}{line.selections.length > 0 ? `: ${line.selections.join(', ')}` : ''}{line.note ? ` · "${line.note.trim()}"` : ''}
                                {line.linePrice > 0 ? `  +฿${line.linePrice}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                        {i.special_request && <div className="text-xs text-brand-muted italic">“{i.special_request}”</div>}
                      </div>
                      <span className="whitespace-nowrap">฿{Number(i.unit_price || 0).toFixed(2)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* M4 (2026-10-22): ปุ่มสั่งงานรวมศูนย์ที่หน้าเจ้าของ — รับออเดอร์
                  (pending→confirmed) อยู่ที่นี่ · สายครัว (confirmed→ready) ที่
                  AdminKitchen · สายส่ง (assign/ส่งออกงาน/POD) ที่ Dispatch Center
                  — ปุ่มเดียวกันห้ามมีสองที่ ที่เหลือคือ deep-link ไปบอร์ดที่รับผิดชอบ */}
              {order.status === 'pending' && (
                <button
                  onClick={() => { void handleAcceptOrder(order.order_number) }}
                  className="btn btn-primary text-sm"
                  data-testid={`accept-order-${order.order_number}`}
                >
                  ✅ ยืนยันออเดอร์ (pending → confirmed)
                </button>
              )}
              <Link to="/admin/kitchen" className="btn btn-outline text-sm">🍳 ไป Kitchen</Link>
              <Link to={`/admin/delivery?focus=${order.order_number}`} className="btn btn-outline text-sm">🛵 ไป Dispatch</Link>

              {/* R21 (Owner 2026-10-29): เลือกพิมพ์เองต่อออเดอร์ — ใช้เทมเพลตเดิมของระบบ */}
              <button
                className="btn btn-outline text-sm"
                data-testid={`print-receipt-${order.order_number}`}
                onClick={() => { void printOrderManually(order.order_number, 'receipt') }}
              >
                🧾 พิมพ์ใบเสร็จ
              </button>
              <button
                className="btn btn-outline text-sm"
                data-testid={`print-kitchen-${order.order_number}`}
                onClick={() => { void printOrderManually(order.order_number, 'kitchen_ticket') }}
              >
                🍜 พิมพ์ใบสั่งครัว
              </button>

              {/* GAP-A2: canonical atomic cancel via cancel_order RPC (any non-terminal state) */}
              {isCancellable(order.status) && (
                <button onClick={() => handleCancelOrder(order.order_number)} className="btn btn-danger text-sm">✖ Cancel</button>
              )}

              {/* Phase C inspection: lifecycle history + audit trail (read-only, admin RLS) */}
              <button onClick={() => toggleInspect(order.order_number)} className="btn btn-outline text-sm" data-testid={`admin-order-inspect-${order.order_number}`}>
                🕘 History / Audit
              </button>

              {/* A2 (2026-10-22): หลักฐานการโอน + ปุ่มยืนยัน ย้ายไปที่ SlipReviewPanel
                  ด้านบน (แผงตรวจสลิปเดียว — action เดียวกันห้ามมีสองที่) */}
              {order.payment_method === 'credit_card' && (order.payment_status === 'paid' || order.payment_status === 'partially_refunded') && (
                    <button onClick={() => handleStripeRefund(order.order_number)} className="btn btn-outline text-sm">💸 Refund (Stripe)</button>
                  )}

              <button className="btn btn-outline text-sm ml-auto">📞 Call</button>
            </div>

            {expandedOrder === order.order_number && (
              <div className="mt-3 rounded-lg border border-brand-muted/30 p-3 text-xs" data-testid="admin-order-inspect-panel">
                {inspect.loading && <div className="text-brand-muted">Loading lifecycle…</div>}
                {!inspect.loading && (
                  <>
                    <div className="font-bold text-brand-accent mb-1">Status history (order_status_history)</div>
                    {inspect.history.length === 0 && <div className="text-brand-muted mb-2">No history rows (or not permitted).</div>}
                    <ul className="space-y-0.5 mb-3">
                      {inspect.history.map((h) => (
                        <li key={h.id}>
                          {h.from_status ? `${h.from_status} → ` : 'create → '}{h.to_status}
                          {' · '}{new Date(h.changed_at).toLocaleString()}
                          {' · '}{h.actor_type}{h.reason ? ` · “${h.reason}”` : ''}
                        </li>
                      ))}
                    </ul>
                    <div className="font-bold text-brand-accent mb-1">Audit trail (audit_logs · entity=order)</div>
                    {inspect.audit.length === 0 && <div className="text-brand-muted">No audit rows for this order.</div>}
                    <ul className="space-y-0.5">
                      {inspect.audit.map((a) => (
                        <li key={a.id}>
                          {a.action}{' · '}{new Date(a.created_at || a.timestamp).toLocaleString()}
                          {a.description ? ` · ${a.description}` : ''}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
          </div>
          )
        })}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-brand-accent">No orders found</h3>
        </div>
      )}

      {/* W4-A pagination */}
      <div className="flex items-center justify-between mt-4 text-sm">
        <button
          disabled={page === 0}
          onClick={() => changePage(Math.max(0, page - 1))}
          className="px-3 py-1 rounded-lg border disabled:opacity-40"
        >← ก่อนหน้า</button>
        <span className="text-xs text-brand-muted">
          หน้า {page + 1} · ทั้งหมด {total} ออเดอร์
        </span>
        <button
          disabled={(page + 1) * PAGE_SIZE >= total}
          onClick={() => changePage(page + 1)}
          className="px-3 py-1 rounded-lg border disabled:opacity-40"
        >ถัดไป →</button>
      </div>
    </div>
  )
}
