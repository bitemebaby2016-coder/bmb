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
} from '@/lib/posApi'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import {
  buildReceiptHtml, buildKitchenTicketHtml, printHtmlInHiddenFrame,
  fetchPrintJobs, markPrintJob, loadPrinterSettings, runAutoPrintPair,
  PrintOrderData, PrintJobRow,
} from '@/lib/printService'
import { SubmitKeyRing } from '@/lib/orderSubmitKey'

interface PosProduct { id: string; name: string; price: number; is_available?: boolean }
interface PosLine { product: PosProduct; quantity: number }
interface PosRound { id: string; display_name: string; round_key?: string; cutoff_time: string; delivery_start: string; delivery_end: string }

function money(n: number): string {
  return '฿' + Number(n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState<{ order_number: string; pickup_code?: string | null; total_amount: number } | null>(null)
  const [pickupOrders, setPickupOrders] = useState<OrderForm[]>([])
  const [shift, setShift] = useState<Awaited<ReturnType<typeof getCurrentShift>>>(null)
  const [openingCash, setUpdatingCash] = useState('')
  const [countedCash, setCountedCash] = useState('')
  const [printJobs, setPrintJobs] = useState<PrintJobRow[]>([])
  const submitKeys = useRef(new SubmitKeyRing())

  const total = useMemo(
    () => lines.reduce((s, l) => s + Number(l.product.price) * l.quantity, 0),
    [lines],
  )

  const refresh = useCallback(async () => {
    const [prods, pickups, sh] = await Promise.all([
      getProductsAdmin() as unknown as Promise<PosProduct[]>,
      listPickupOrders(),
      getCurrentShift(),
    ])
    setProducts((prods ?? []).filter((p) => p.is_available !== false))
    setPickupOrders(pickups)
    setShift(sh)
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

    setBusy(true)
    const input = {
      items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      delivery_round_id: roundId,
      fulfillment: 'pickup' as const,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      payment_method: paymentMethod,
      special_instructions: notes.trim() || undefined,
      order_mode: 'SAME_DAY' as const,
    }
    // POS = counter pickup (127); duplicate protection = 124 submit key ring
    const fp = JSON.stringify({ items: input.items, round: input.delivery_round_id, name: input.customer_name, phone: input.customer_phone, pay: input.payment_method })
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
    } catch (e) {
      console.warn('[POS] auto-print failed (order unaffected):', e)
    }

    // cash counter sale: close out immediately (legal transitions + paid)
    if (paymentMethod === 'cash_on_delivery') {
      const close = await posCloseoutOrder(result.order_number, true)
      if (close.ok) showToast(`ปิดการขาย #${result.order_number} — รับชำระแล้ว`, 'success')
      else showToast(`ออเดอร์สร้างแล้ว แต่ปิดการขายไม่สำเร็จ: ${close.error}`, 'warning')
    }

    setLines([]); setCustomerName(''); setCustomerPhone(''); setNotes('')
    await refresh()
    setBusy(false)
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
    if (r.ok) { showToast(`ส่งมอบออเดอร์ #${o.order_number} เรียบร้อย`, 'success'); await refresh() }
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

      {/* Shift bar */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-3">💵 กะเงินสด</h3>
        {shift ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge badge-success">เปิดกะอยู่ · เงินต้น {money(shift.opening_cash)} · {new Date(shift.opened_at).toLocaleString('th-TH')}</span>
            <input type="number" min="0" step="0.01" placeholder="เงินสดที่นับได้" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} className="input w-40" />
            <button className="btn btn-outline" onClick={() => void handleCloseShift()}>ปิดกะ + กระทบยอด</button>
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
            <button className="btn btn-primary w-full" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? '⏳ กำลังส่ง...' : '✅ ขาย (รับที่ร้าน)'}
            </button>
            <p className="text-xs text-brand-muted">ขายผ่าน Order Hub เดิม · กันสั่งซ้ำด้วย idempotency key · ค่าจัดส่ง 0 บาท</p>
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

      {/* Pickup handover queue */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-3">🥤 คิวรับที่ร้าน (ยืนยันรหัส 6 หลัก)</h3>
        {pickupOrders.map((o) => (
          <div key={o.order_number} className="flex flex-wrap items-center gap-3 py-2 border-b border-brand-border">
            <span className="font-bold">#{o.order_number}</span>
            <span className="text-sm">{o.customer_name}</span>
            <span className="badge badge-warning">{o.status}</span>
            <span className="text-sm text-brand-muted">{money(o.total_amount)} · {o.payment_method}</span>
            <button className="btn btn-primary btn-sm" onClick={() => void handleHandover(o)}>ส่งมอบ (ตรวจรหัส)</button>
          </div>
        ))}
        {pickupOrders.length === 0 && <p className="text-sm text-brand-muted">ไม่มีออเดอร์รอรับที่ร้าน</p>}
      </div>
    </div>
  )
}