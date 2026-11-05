// ============================================
// Bite Me Baby — Web POS (หน้าร้าน) — Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
//
// Owner requirement: ไม่ซื้อเครื่อง POS เฉพาะทาง — ใช้ระบบ BMB เอง
// * สั่งออเดอร์ผ่าน Order Hub เดิม (create_pickup_order_i / create_order_with_items_i)
// * idempotency: client_submit_key กันกดซ้ำ (124)
// * เงินสด: pos_closeout_order (129) = เดิน transition ที่อนุญาต + ยืนยันชำระเงิน
// * auto-print: print_jobs (128) — ใบเสร็จ/คิวครัว, ยืนยันพิมพ์จริงด้วยมือ
// * กะเงินสด: open_shift / close_shift (129)
// * pickup handover: ตรวจรหัส 6 หลัก + ปิดวงจร (127)
// ============================================
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import { supabase } from '@/lib/supabase'
import { getProductsAdmin } from '@/lib/bmbAdminApi_products'
import {
  createPosOrder, posCloseoutOrder, listPickupOrders,
  openShift, closeShift, getCurrentShift, PosOrderInput,
  // R51: หมวดบริการหน้าร้าน (ทานที่ร้าน/สั่งกลับบ้าน/รับที่ร้าน) เปิด-ปิดแยกหมวด
  POS_SERVICE_META, POS_SERVICE_TYPES_KEY, DEFAULT_POS_SERVICE_FLAGS,
  loadPosServiceFlags, savePosServiceFlags, posServiceInstruction,
  type PosServiceType, type PosServiceFlags,
} from '@/lib/posApi'
import { writeAuditLog } from '@/lib/auditLog'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import {
  buildReceiptHtml, buildKitchenTicketHtml, printHtmlInHiddenFrame,
  fetchPrintJobs, markPrintJob, loadPrinterSettings, runAutoPrintPair,
  PrintOrderData, PrintJobRow,
} from '@/lib/printService'
// N-9 (Owner 2026-11-05): สติกเกอร์ Bluetooth อัตโนมัติหลังขาย POS (เส้นทางเดียวกับหน้าออเดอร์)
import { stickerRollForOrder, printStickerRoll, describeStickerRollError } from '@/lib/stickerQueue'
import { niimbotSupported } from '@/lib/niimbotBt'
import { SubmitKeyRing } from '@/lib/orderSubmitKey'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ADMIN_NAV_ITEMS, navGroupsForRole } from '@/lib/adminUi'
import { ensureShopConfigLoaded, getShopConfig, getShopHours, subscribeShopConfig } from '@/lib/shopHours'
import { withinShopHours } from '@/lib/shopHoursLogic'
import { getShiftCashSummary, type ShiftCashSummary } from '@/lib/posApi'

interface PosProduct { id: string; name: string; price: number; is_available?: boolean }
interface PosLine { product: PosProduct; quantity: number }
interface PosRound { id: string; display_name: string; round_key?: string; cutoff_time: string; delivery_start: string; delivery_end: string }

function money(n: number): string {
  return '฿' + Number(n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// R66-D: เวลา "จริง" ของร้าน (ปฏิทินกรุงเทพ) — ใช้เช็กว่าเลยเวลาเปิดปิดร้านหรือยัง
function bkkMsOfDay(d: Date): number {
  return (((d.getTime() + 7 * 3_600_000) % 86_400_000) + 86_400_000) % 86_400_000
}

// R66-D: ความยาวเปิดกะแบบ realtime (h:mm:ss) — นับจากเวลาเปิดกะจริงถึง "ตอนนี้"
function elapsedText(fromIso: string, nowMs: number): string {
  const diff = Math.max(0, nowMs - new Date(fromIso).getTime())
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function AdminPos() {
  const [products, setProducts] = useState<PosProduct[]>([])
  const [lines, setLines] = useState<PosLine[]>([])
  const [rounds, setRounds] = useState<PosRound[]>([])
  const [roundId, setRoundId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery' | 'promptpay_qr' | 'credit_card'>('cash_on_delivery')
  const [notes, setNotes] = useState('')
  // R51: ชนิดบริการหน้าร้าน — default รับที่ร้าน (พฤติกรรมเดิม) · เปิด/ปิดแยกหมวดโดยแอดมิน
  const [serviceFlags, setServiceFlags] = useState<PosServiceFlags>(DEFAULT_POS_SERVICE_FLAGS)
  const [serviceType, setServiceType] = useState<PosServiceType>('pickup')
  const [seat, setSeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState<{ order_number: string; pickup_code?: string | null; total_amount: number } | null>(null)
  const [pickupOrders, setPickupOrders] = useState<OrderForm[]>([])
  const [shift, setShift] = useState<Awaited<ReturnType<typeof getCurrentShift>>>(null)
  const [openingCash, setUpdatingCash] = useState('')
  const [countedCash, setCountedCash] = useState('')
  const [printJobs, setPrintJobs] = useState<PrintJobRow[]>([])
  const submitKeys = useRef(new SubmitKeyRing())
  // R66-D: นาฬิกากะ/เวลาเปิดร้านแบบสด + ยอดเงินสดระหว่างกะ (ค่าจริงเท่านั้น)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [cashSummary, setCashSummary] = useState<ShiftCashSummary | null>(null)
  const role = useAuthStore((s) => s.role)
  // dynamic links = ทางลัดไปหน้าจริงของระบบ — ดูจาก nav ชุดเดิม (ไม่สร้างเมนูใหม่)
  // กรองด้วยสิทธิ์ role เดียวกับ AdminNav (pos เห็นเฉพาะของที่ตัวเองเข้าได้)
  const quickLinks = useMemo(() => {
    const wanted = ['/admin', '/admin/orders', '/admin/customers', '/admin/reports']
    const allowed = new Set(navGroupsForRole(role).flatMap((g) => g.items.map((i) => i.to)))
    return ADMIN_NAV_ITEMS.filter((i) => wanted.includes(i.to) && allowed.has(i.to))
  }, [role])

  const total = useMemo(
    () => lines.reduce((s, l) => s + Number(l.product.price) * l.quantity, 0),
    [lines],
  )

  const refresh = useCallback(async () => {
    const [prods, pickups, sh, svc] = await Promise.all([
      getProductsAdmin() as unknown as Promise<PosProduct[]>,
      listPickupOrders(),
      getCurrentShift(),
      loadPosServiceFlags(),
    ])
    setProducts((prods ?? []).filter((p) => p.is_available !== false))
    setPickupOrders(pickups)
    setShift(sh)
    setServiceFlags(svc)
    // หมวดที่ถูกปิด = ห้ามเลือกค้างอยู่ (ดีดกลับไปหมวดแรกที่ยังเปิด)
    setServiceType((cur) => (svc[cur] ? cur : ((Object.keys(svc) as PosServiceType[]).find((k) => svc[k]) ?? 'pickup')))
  }, [])

  useEffect(() => {
    void refresh()
    void (async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
      const { data } = await supabase
        .from('delivery_rounds')
        .select('id, display_name, round_key, cutoff_time, delivery_start, delivery_end')
        .eq('scheduled_date', today)
        .eq('status', 'active')
        .order('delivery_start')
      setRounds((data ?? []) as PosRound[])
      if ((data ?? []).length > 0) setRoundId((data as PosRound[])[0].id)
    })()
  }, [refresh])

  // R66-D ①: นาฬิกากะเดินจริงทุก 1 วิ + โหลด/รีเฟรชค่าเปิดปิดร้านจริงจาก business_settings
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    void ensureShopConfigLoaded()
    return subscribeShopConfig(() => setNowMs(Date.now()))
  }, [])

  // R66-D ②: ยอดเงินสดระหว่างกะ (เปิดกะใหม่ + ทุก 20 วิ) — ดึงไม่ได้ = บอกว่าดึงไม่ได้
  const reloadCashSummary = useCallback(async (openedAt?: string | null) => {
    if (!openedAt) { setCashSummary(null); return }
    setCashSummary(await getShiftCashSummary(openedAt))
  }, [])
  const openedAt = shift?.opened_at ?? null
  useEffect(() => {
    if (!openedAt) { setCashSummary(null); return }
    void reloadCashSummary(openedAt)
    const t = window.setInterval(() => { if (!document.hidden) void reloadCashSummary(openedAt) }, 20_000)
    return () => window.clearInterval(t)
  }, [openedAt, reloadCashSummary])

  // R66-D: เลยเวลาเปิดปิดร้านจริงหรือยัง (null = โหลดค่าไม่สำเร็จ → ห้ามเดา = ไม่เตือน)
  const shopCfg = getShopConfig()
  const hours = getShopHours()
  const pastHours = shopCfg?.shopHoursMs
    ? !withinShopHours(bkkMsOfDay(new Date(nowMs)), shopCfg.shopHoursMs)
    : false
  const masterClosed = shopCfg?.masterOpen === false
  const closeLabel = hours ? `${hours.open}–${hours.close}` : ''

  function addLine(p: PosProduct) {
    setLines((prev) => {
      const hit = prev.find((l) => l.product.id === p.id)
      if (hit) return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { product: p, quantity: 1 }]
    })
  }

  function setQty(productId: string, qty: number) {
    setLines((prev) => (qty <= 0
      ? prev.filter((l) => l.product.id !== productId)
      : prev.map((l) => (l.product.id === productId ? { ...l, quantity: qty } : l))))
  }

  async function handleSubmit() {
    if (lines.length === 0) { showToast('ยังไม่มีสินค้าในรายการ', 'error'); return }
    if (!roundId) { showToast('กรุณาเลือกรอบ/ช่วงเวลารับ', 'error'); return }
    if (!customerName.trim()) { showToast('กรุณากรอกชื่อลูกค้า', 'error'); return }
    if (!shift) { showToast('กรุณาเปิดกะก่อนขาย (เงินสด)', 'warning'); return }
    if (!serviceFlags[serviceType]) { showToast('หมวดบริการนี้ถูกปิดอยู่ — เปิดที่กล่อง "เปิด/ปิดหมวดบริการ" ก่อน', 'error'); return }
    // R66-D: เตือนตามเวลาเปิดปิดร้าน "จริง" ก่อนขาย (server ยังเป็นคนตัดสิน INSERT — ที่นี่คือประตูหน้าร้าน)
    if (pastHours) {
      const okSell = window.confirm(
        `${closeLabel || 'เวลาเปิดร้าน'} ผ่านไปแล้ว — เวลาจริง ${new Date(nowMs).toLocaleTimeString('th-TH')} น. ` +
        'จะขายกรณีพิเศษต่อไหม? (ถ้าหมดวันแล้วให้กด "ปิดกะ + กระทบยอด")',
      )
      if (!okSell) return
    }

    setBusy(true)
    // R51: ป้ายชนิดบริการแนบหัว special_instructions (ครัว/สติกเกอร์ Notice เห็นทันที) — engine เดิม 127
    const serviceNote = posServiceInstruction(serviceType, seat)
    const input = {
      items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      delivery_round_id: roundId,
      fulfillment: 'pickup' as const,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      payment_method: paymentMethod,
      special_instructions: [serviceNote, notes.trim()].filter(Boolean).join(' · ') || undefined,
      order_mode: 'SAME_DAY' as const,
    }
    // POS = counter pickup (127); duplicate protection = 124 submit key ring
    const fp = JSON.stringify({ items: input.items, round: input.delivery_round_id, name: input.customer_name, phone: input.customer_phone, pay: input.payment_method, svc: serviceType, seat: seat.trim() })
    const submitKey = submitKeys.current.keyFor(fp)
    const result = await createPosOrder({ ...input, client_submit_key: submitKey } as PosOrderInput)
    if (!result) {
      submitKeys.current.release(fp)
      showToast('สร้างออเดอร์ไม่สำเร็จ — ลองใหม่ (ไม่มีออเดอร์ซ้ำ)', 'error')
      setBusy(false)
      return
    }
    submitKeys.current.release(fp)
    setLastResult({ order_number: result.order_number, pickup_code: (result as any).pickup_code, total_amount: result.total_amount })
    showToast(`สร้างออเดอร์ #${result.order_number} สำเร็จ`, 'success')

    // auto-print receipt + kitchen ticket (print failure NEVER affects the order)
    try {
      const settings = await loadPrinterSettings()
      const printData: PrintOrderData = {
        order_number: result.order_number,
        created_at: new Date().toISOString(),
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        items: lines.map((l) => ({ product_name: l.product.name, quantity: l.quantity, unit_price: l.product.price })),
        subtotal: total,
        delivery_fee: 0,
        total_amount: result.total_amount,
        payment_method: input.payment_method,
        payment_status: result.payment_status,
        delivery_method: 'pickup',
        pickup_code: (result as any).pickup_code ?? null,
        order_mode: 'SAME_DAY',
        special_instructions: input.special_instructions ?? null,
      }
      await runAutoPrintPair(printData, settings)
      setPrintJobs(await fetchPrintJobs(result.order_number))
      // N-9 (Owner 2026-11-05): สติกเกอร์ 1 ดวง/ชิ้น ผ่าน Bluetooth ตรง อัตโนมัติหลังขาย
      // (เส้นทางเดียวกับปุ่ม "รับออเดอร์" ที่หน้าออเดอร์ · สวิตช์ autoPrintStickers ปิด = ข้ามพร้อมบอกสาเหตุ)
      if (settings.autoPrintStickers) {
        if (niimbotSupported()) {
          const roll = stickerRollForOrder(printData)
          void printStickerRoll(roll, {
            offsetY: settings.stickerOffsetYPx ?? 0,
            faceH: settings.stickerFaceHPx ?? 709,
            density: settings.stickerDensity ?? 3,
          })
            .then(() => showToast(`✅ สติกเกอร์ ${roll.length} ใบ (Bluetooth) — เครื่องยืนยันครบแล้ว`, 'success'))
            .catch((e) => showToast('พิมพ์สติกเกอร์อัตโนมัติไม่สำเร็จ: ' + describeStickerRollError(e), 'warning'))
        } else {
          showToast('ข้ามพิมพ์สติกเกอร์อัตโนมัติ: เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth — เปิดด้วย Chrome/Edge (https)', 'warning')
        }
      }
    } catch (e) {
      console.warn('[POS] auto-print failed (order unaffected):', e)
    }

    // cash counter sale: close out immediately (legal transitions + paid)
    if (paymentMethod === 'cash_on_delivery') {
      const close = await posCloseoutOrder(result.order_number, true)
      if (close.ok) {
        showToast(`ปิดการขาย #${result.order_number} — รับชำระแล้ว`, 'success')
        void reloadCashSummary(shift?.opened_at)
      } else showToast(`ออเดอร์สร้างแล้ว แต่ปิดการขายไม่สำเร็จ: ${close.error}`, 'warning')
    }

    setLines([]); setCustomerName(''); setCustomerPhone(''); setNotes(''); setSeat('')
    await refresh()
    setBusy(false)
  }

  // R51: เปิด/ปิดหมวดบริการแยกกัน (business_settings.pos_service_types — key เดียวของระบบ settings)
  const enabledTypes = (Object.keys(POS_SERVICE_META) as PosServiceType[]).filter((k) => serviceFlags[k])
  async function handleSaveServiceFlags(next: PosServiceFlags) {
    setServiceFlags(next)
    const r = await savePosServiceFlags(next)
    if (r.ok) {
      showToast('บันทึกหมวดบริการแล้ว', 'success')
      void writeAuditLog({ action: 'settings_change', entity_type: 'business_settings', entity_id: POS_SERVICE_TYPES_KEY, description: 'POS service categories updated', metadata: { [POS_SERVICE_TYPES_KEY]: next } })
    } else {
      showToast(`บันทึกหมวดบริการไม่สำเร็จ: ${r.error ?? 'unknown'}`, 'error')
      setServiceFlags(await loadPosServiceFlags())
    }
  }

  // ---------- shift / cash ----------
  async function handleOpenShift() {
    const r = await openShift(Number(openingCash || 0))
    if (r.ok) { showToast('เปิดกะแล้ว', 'success'); setUpdatingCash(''); await refresh() }
    else showToast(`เปิดกะไม่สำเร็จ: ${r.error}`, 'error')
  }

  async function handleCloseShift() {
    if (!shift) return
    const r = await closeShift(shift.id, Number(countedCash || 0))
    if (r.ok) {
      showToast(`ปิดกะแล้ว — ยอดคาดหวัง ${money(r.expected ?? 0)} · ผลต่าง ${money(r.difference ?? 0)}`, 'success')
      setCountedCash('')
      await refresh()
    } else showToast(`ปิดกะไม่สำเร็จ: ${r.error}`, 'error')
  }

  // ---------- pickup handover ----------
  async function handleHandover(o: OrderForm) {
    const code = window.prompt(`ยืนยันรหัสรับอาหารของออเดอร์ #${o.order_number} (6 หลัก):`, '')
    if (code == null) return
    if (code.trim() !== String(o.pickup_code ?? '')) {
      showToast('รหัสรับอาหารไม่ถูกต้อง — ยกเลิกการส่งมอบ', 'error')
      return
    }
    const r = await posCloseoutOrder(o.order_number, true)
    if (r.ok) { showToast(`ส่งมอบออเดอร์ #${o.order_number} เรียบร้อย`, 'success'); await refresh(); void reloadCashSummary(shift?.opened_at) }
    else showToast(`ส่งมอบไม่สำเร็จ: ${r.error}`, 'error')
  }

  // ---------- manual print (honest states) ----------
  async function manualPrint(orderNumber: string, type: 'receipt' | 'kitchen_ticket') {
    const o = (pickupOrders.find((x) => x.order_number === orderNumber) ?? lastResult) as any
    if (!o) return
    const data: PrintOrderData = {
      order_number: orderNumber,
      created_at: o.created_at ?? new Date().toISOString(),
      customer_name: o.customer_name ?? customerName,
      customer_phone: o.customer_phone ?? customerPhone,
      items: (o.items ?? lines.map((l) => ({ product_name: l.product.name, quantity: l.quantity, unit_price: l.product.price }))),
      subtotal: Number(o.subtotal ?? total),
      delivery_fee: Number(o.delivery_fee ?? 0),
      total_amount: Number(o.total_amount ?? total),
      payment_method: o.payment_method ?? paymentMethod,
      payment_status: o.payment_status ?? 'pending',
      delivery_method: o.delivery_method ?? 'pickup',
      pickup_code: o.pickup_code ?? null,
      order_mode: o.order_mode ?? 'SAME_DAY',
      special_instructions: o.special_instructions ?? null,
    }
    const st = await loadPrinterSettings()
    const html = type === 'receipt' ? buildReceiptHtml(data, st.paperWidthMm) : buildKitchenTicketHtml(data, st.paperWidthMm)
    const outcome = printHtmlInHiddenFrame(html)
    showToast(outcome === 'sent'
      ? 'ส่งงานพิมพ์แล้ว (sent) — กรุณากด "ยืนยันพิมพ์จริง" เมื่อกระดาษออก'
      : 'ส่งงานพิมพ์ไม่สำเร็จ — ออเดอร์ไม่ได้รับผลกระทบ', outcome === 'sent' ? 'info' : 'warning')
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-accent">🧾 Web POS — ขายหน้าร้าน</h1>

      {/* R66-D: dynamic links — ทางลัดไปหน้าจริงของระบบ (ได้จาก nav ชุดเดิม · role-filter) */}
      <div className="flex flex-wrap gap-2" data-testid="pos-quick-links">
        {quickLinks.map((l) => (
          <Link key={l.to} to={l.to} className="btn btn-outline btn-sm" data-testid={`pos-link-${l.to}`}>
            {l.icon} {l.label}
          </Link>
        ))}
      </div>

      {/* R66-D: เตือนตามเวลาเปิดปิดร้านจริง / สวิตช์ Master — พร้อมบอกให้ปิดกะให้ตรงเวลา */}
      {(pastHours || masterClosed) && (
        <div className="card border-2 border-red-300 bg-red-50" data-testid="pos-after-hours-banner">
          <b className="text-red-700">
            ⏰ {masterClosed ? 'ร้านถูกปิดจากสวิตช์ Master ของแอดมิน' : `เลยเวลาเปิดร้าน ${closeLabel} แล้ว`} — เวลาจริง{' '}
            <span data-testid="pos-banner-clock">{new Date(nowMs).toLocaleTimeString('th-TH')}</span> น.
          </b>
          <p className="text-sm text-slate-700 mt-1">
            {shift
              ? 'ยังเปิดกะอยู่ → กด "ปิดกะ + กระทบยอด" เพื่อปิดกะของวันนี้ให้ตรงเวลาจริง'
              : 'ไม่มีกะเปิดค้างอยู่ — ขายใหม่ต้องเปิดกะก่อน'}
          </p>
        </div>
      )}

      {/* Shift bar */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-3">💵 กะเงินสด</h3>
        {shift ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge badge-success" data-testid="pos-shift-open">เปิดกะอยู่</span>
            <span className="text-sm text-slate-700">🕐 เวลาจริง <b data-testid="pos-live-clock">{new Date(nowMs).toLocaleTimeString('th-TH')}</b></span>
            <span className="text-sm text-slate-700">⏱️ เปิดกะมา <b data-testid="pos-shift-elapsed">{elapsedText(shift.opened_at, nowMs)}</b></span>
            <span className="text-sm text-slate-700">เงินต้น {money(shift.opening_cash)} · เปิด {new Date(shift.opened_at).toLocaleString('th-TH')}</span>
            <span className="text-sm text-slate-700" data-testid="pos-shift-cash">
              {cashSummary === null
                ? '💵 ยอดเงินสดระหว่างกะ: กำลังโหลด…'
                : cashSummary.ok
                  ? `💵 เงินสดระหว่างกะ ${money(cashSummary.cashTotal)} (${cashSummary.orderCount} ออเดอร์) · คาดปิดกะ ${money(shift.opening_cash + cashSummary.cashTotal)}`
                  : '💵 ดึงยอดเงินสดไม่ได้ — ยอดจริง server คำนวณตอนปิดกะ'}
            </span>
            <input type="number" min="0" step="0.01" placeholder="เงินสดที่นับได้" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} className="input w-40" />
            <button className={`btn ${pastHours ? 'btn-danger' : 'btn-outline'}`} onClick={() => void handleCloseShift()} data-testid="pos-close-shift">ปิดกะ + กระทบยอด</button>
            <Link to="/admin/reports" className="btn btn-outline btn-sm" data-testid="pos-link-close-day">📊 รายงาน/ปิดวัน</Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <input type="number" min="0" step="0.01" placeholder="เงินสดตั้งต้น" value={openingCash} onChange={(e) => setUpdatingCash(e.target.value)} className="input w-40" />
            <button className="btn btn-primary" onClick={() => void handleOpenShift()}>เปิดกะ</button>
            <span className="text-xs text-brand-muted">ต้องเปิดกะก่อนขายเงินสด — ระบบกระทบยอดอัตโนมัติตอนปิดกะ</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product grid */}
        <div className="lg:col-span-2 card">
          <h3 className="font-bold text-brand-accent mb-3">🍽️ เมนู</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((p) => (
              <button key={p.id} onClick={() => addLine(p)} className="p-3 rounded-lg border-2 border-brand-border hover:border-brand-primary text-left">
                <div className="font-medium text-slate-900 text-sm">{p.name}</div>
                <div className="text-brand-primary font-bold">{money(p.price)}</div>
              </button>
            ))}
            {products.length === 0 && <p className="text-sm text-brand-muted">ไม่มีเมนูพร้อมขาย</p>}
          </div>
        </div>

        {/* Cart */}
        <div className="card">
          <h3 className="font-bold text-brand-accent mb-3">🛒 รายการขาย</h3>
          {lines.map((l) => (
            <div key={l.product.id} className="flex items-center gap-2 py-1 border-b border-brand-border">
              <div className="flex-1 text-sm">{l.product.name}</div>
              <input type="number" min="0" value={l.quantity} onChange={(e) => setQty(l.product.id, Number(e.target.value))} className="input w-16" />
              <div className="w-20 text-right">{money(l.product.price * l.quantity)}</div>
            </div>
          ))}
          <div className="flex justify-between font-bold text-lg mt-3"><span>รวม</span><span className="text-brand-primary">{money(total)}</span></div>

          <div className="space-y-2 mt-4">
            {/* R51: ชนิดบริการหน้าร้าน — เฉพาะหมวดที่แอดมินเปิดไว้ */}
            <div className="flex gap-2 flex-wrap" data-testid="pos-service-types">
              {(Object.keys(POS_SERVICE_META) as PosServiceType[]).filter((k) => serviceFlags[k]).map((k) => (
                <button
                  key={k}
                  type="button"
                  data-testid={`pos-service-${k}`}
                  onClick={() => setServiceType(k)}
                  className={`btn btn-sm ${serviceType === k ? 'btn-primary' : 'btn-outline'}`}
                >
                  {POS_SERVICE_META[k].emoji} {POS_SERVICE_META[k].label}
                </button>
              ))}
              {enabledTypes.length === 0 && <span className="text-xs text-red-500">ปิดหมวดบริการไว้ทุกหมวด — เปิดอย่างน้อย 1 หมวดก่อนขาย</span>}
            </div>
            {serviceType === 'dine_in' && (
              <input className="input" placeholder="โต๊ะ/ที่นั่ง (ไม่บังคับ)" value={seat} onChange={(e) => setSeat(e.target.value)} data-testid="pos-seat" />
            )}
            <input className="input" placeholder="ชื่อลูกค้า *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <input className="input" placeholder="เบอร์โทร" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <select className="input" value={roundId} onChange={(e) => setRoundId(e.target.value)}>
              <option value="">— เลือกช่วงเวลารับ —</option>
              {rounds.map((r) => <option key={r.id} value={r.id}>{r.display_name || r.round_key} ({String(r.delivery_start).slice(0, 5)}–{String(r.delivery_end).slice(0, 5)})</option>)}
            </select>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
              <option value="cash_on_delivery">เงินสด (ปิดการขายทันที)</option>
              <option value="promptpay_qr">PromptPay QR</option>
              <option value="credit_card">บัตรเครดิต</option>
            </select>
            <input className="input" placeholder="หมายเหตุ" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button className="btn btn-primary w-full" disabled={busy || enabledTypes.length === 0} onClick={() => void handleSubmit()} data-testid="pos-submit">
              {busy ? '⏳ กำลังส่ง...' : `✅ ขาย (${POS_SERVICE_META[serviceType].label})`}
            </button>
            <p className="text-xs text-brand-muted">ขายผ่าน Order Hub เดิม · กันสั่งซ้ำด้วย idempotency key · ค่าจัดส่ง 0 บาท · ป้ายชนิดบริการแจ้งลง Notice ของใบสั่งครัว</p>
          </div>
        </div>
      </div>

      {/* Last sale + print jobs */}
      {lastResult && (
        <div className="card">
          <h3 className="font-bold text-brand-accent mb-3">🖨️ งานพิมพ์ของออเดอร์ล่าสุด #{lastResult.order_number}</h3>
          {lastResult.pickup_code && (
            <div className="mb-3 text-center rounded-lg border-2 border-brand-primary bg-orange-50 p-3">
              <div className="text-sm text-slate-700">รหัสรับอาหาร</div>
              <div className="text-3xl font-bold tracking-[0.3em]">{lastResult.pickup_code}</div>
            </div>
          )}
          <div className="flex gap-2 mb-3">
            <button className="btn btn-outline" onClick={() => void manualPrint(lastResult.order_number, 'receipt')}>พิมพ์ใบเสร็จซ้ำ</button>
            <button className="btn btn-outline" onClick={() => void manualPrint(lastResult.order_number, 'kitchen_ticket')}>พิมพ์คิวครัวซ้ำ</button>
            <Link to="/admin/orders" className="btn btn-outline" data-testid="pos-link-last-order">📦 เปิดหน้าออเดอร์</Link>
          </div>
          <div className="space-y-1">
            {printJobs.map((j) => (
              <div key={j.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="badge">{j.job_type}</span>
                <span className={`badge ${j.status === 'printed' ? 'badge-success' : j.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>{j.status}</span>
                <button className="btn btn-outline btn-sm" onClick={() => void markPrintJob(j.id, 'printed').then(() => fetchPrintJobs(lastResult.order_number).then(setPrintJobs))}>ยืนยันพิมพ์จริง</button>
                <button className="btn btn-outline btn-sm" onClick={() => void markPrintJob(j.id, 'failed', 'operator marked failed').then(() => fetchPrintJobs(lastResult.order_number).then(setPrintJobs))}>ทำเครื่องหมายล้มเหลว</button>
                <span className="text-xs text-brand-muted">attempts: {j.attempts}</span>
              </div>
            ))}
            {printJobs.length === 0 && <p className="text-sm text-brand-muted">ยังไม่มีงานพิมพ์</p>}
          </div>
        </div>
      )}

      {/* R51: เปิด/ปิดหมวดบริการแยกกัน */}
      <div className="card" data-testid="pos-service-settings">
        <h3 className="font-bold text-brand-accent mb-3">🗂️ เปิด/ปิดหมวดบริการ (แยกแต่ละหมวด)</h3>
        <div className="flex gap-3 flex-wrap">
          {(Object.keys(POS_SERVICE_META) as PosServiceType[]).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm cursor-pointer select-none" data-testid={`pos-flag-${k}`}>
              <input
                type="checkbox"
                checked={serviceFlags[k]}
                onChange={(e) => void handleSaveServiceFlags({ ...serviceFlags, [k]: e.target.checked })}
              />
              <span>{POS_SERVICE_META[k].emoji} {POS_SERVICE_META[k].label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-brand-muted mt-2">หมวดที่ปิด = ไม่โชว์ในแผงขายด้านบน · ทุกชนิดยังผ่าน Order Hub เดิม (รับที่ร้าน + รหัส 6 หลัก)</p>
      </div>

      {/* Pickup handover queue */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-3">🥤 คิวรับที่ร้าน/ส่งมอบหน้าเคาน์เตอร์ (ยืนยันรหัส 6 หลัก)</h3>
        {pickupOrders.map((o) => (
          <div key={o.order_number} className="flex flex-wrap items-center gap-3 py-2 border-b border-brand-border">
            <span className="font-bold">#{o.order_number}</span>
            <span className="text-sm">{o.customer_name}</span>
            <span className="badge badge-warning">{o.status}</span>
            <span className="text-sm text-brand-muted">{money(o.total_amount)} · {o.payment_method}</span>
            <Link to={`/admin/orders?status=${encodeURIComponent(o.status)}`} className="btn btn-outline btn-sm" data-testid={`pos-link-order-${o.order_number}`}>ดูในหน้าออเดอร์</Link>
            <button className="btn btn-primary btn-sm" onClick={() => void handleHandover(o)}>ส่งมอบ (ตรวจรหัส)</button>
          </div>
        ))}
        {pickupOrders.length === 0 && <p className="text-sm text-brand-muted">ไม่มีออเดอร์รอรับที่ร้าน</p>}
      </div>
    </div>
  )
}