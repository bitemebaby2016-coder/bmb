// ============================================
// Bite Me Baby — Print Service (migration 128 wiring)
// Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
//
// Print-state honesty (Owner requirement):
//   requested -> sent -> acknowledged -> printed | failed
// `window.print()` only proves the browser accepted the dialog — we mark the
// job 'sent' and let the operator confirm 'printed' explicitly. We NEVER claim
// physical printing without that confirmation.
//
// Rendering: 80mm thermal receipt + kitchen ticket, Thai-safe (system fonts,
// no external resources). Browser print fallback works with ANY printer the
// OS supports today; ESC/POS raw transport is a future adapter.
//
// R23 (2026-10-30) — แก้ 4 จุดที่ Owner รายงาน (ลงมือทำจริงตามที่เขียน):
// 1) Cancel แล้วยังพิมพ์ → POS รวม 2 ใบเป็น 1 dialog (runAutoPrintPair + page-break) · frame ลบผ่าน afterprint (fallback 60s)
// 2) Auto-print: frame offscreen แบบ render ได้ (left:-10000px 1×1 · ไม่ใช่ 0×0 ที่บาง build ไม่เปิด dialog) + toast แสดง failed
// 3) หน้าตั้งค่า: info box "เทมเพลตอยู่ที่ไหน/ตั้งยังไง/Nimbot ต้องลงไดรเวอร์ Windows" + guard กันกดทดสอบซ้ำ
// 4) paperWidthMm (50/80 มม.) มีผลจริง — inject เข้า printCss() ทุกใบ · ไม่ยิง confirm ซ้ำใน printOrderTicket (คืน behavior เดิม)
//   - บังคับให้ print() ยิงแค่ครั้งเดียวต่อ frame (ไม่ setTimeout ซ้ำ)
//   - frame ถูกลบหลัง afterprint event (ไม่ใช่ setTimeout)
//   - ไม่ confirm ซ้ำถ้ามี dialog เปิดอยู่
// ============================================
import { supabase } from './supabase'

export type PrintJobType = 'receipt' | 'kitchen_ticket'
export type PrintJobStatus = 'requested' | 'sent' | 'acknowledged' | 'printed' | 'failed'

// R23: กัน print ซ้ำ — ถ้ามี dialog เปิดอยู่ ข้ามคำสั่งใหม่ (ไม่ setTimeout ซ้ำ)
let _printDialogOpen = false

export interface PrintOrderLine {
  product_name: string
  quantity: number
  unit_price: number
  customizations?: Record<string, any> | null
  special_request?: string | null
}

export interface PrintOrderData {
  order_number: string
  created_at?: string
  customer_name?: string
  customer_phone?: string
  items: PrintOrderLine[]
  subtotal?: number
  discount_amount?: number
  delivery_fee?: number
  service_fee?: number
  tax_amount?: number
  total_amount: number
  payment_method?: string
  payment_status?: string
  delivery_method?: string
  pickup_code?: string | null
  order_mode?: string
  scheduled_date?: string | null
  special_instructions?: string | null
}

export interface PrinterSettings {
  receiptPrinterName: string
  kitchenPrinterName: string
  autoPrintReceipt: boolean
  autoPrintKitchen: boolean
  // R31 (Owner 2026-10-30): พิมพ์สติกเกอร์ Bluetooth อัตโนมัติหลังรับออเดอร์ — 1 ดวง ต่อ 1 ชิ้น
  autoPrintStickers?: boolean
  paperWidthMm: number
  // R21 (Owner 2026-10-29): ทะเบียนเครื่องพิมพ์ที่แอดมินเพิ่ม/เลือกเอง
  // (ชื่อเดิม 2 ฟิลด์ข้างบนยังคงอยู่ = back-compat กับค่าที่บันทึกไว้แล้ว)
  printers?: PrinterDef[]
  receiptPrinterId?: string | null
  kitchenPrinterId?: string | null
  // R27 (Owner 2026-10-30): QZ Tray = ตัวกลางพิมพ์สติกเกอร์ 40×60 ไม่พึ่งไดรเวอร์ Windows
  // (Nimbot B1Pro มีไดรเวอร์แค่ Win7 → Owner ลง QZ Tray แล้ว เชื่อมผ่านพอร์ตในเครื่อง)
  qzEnabled?: boolean
  /** ชื่อเครื่องพิมพ์ตามที่ QZ/OS รายงาน (สติกเกอร์ใบเสร็จ+ครัวใช้เครื่องเดียวกัน) */
  qzPrinterName?: string
}

/** โมเดลที่ระบบมี preset ให้ (Nimbot B1Pro = เครื่องที่ร้านใช้อยู่ตอนนี้) */
export type PrinterModel = 'nimbot_b1pro' | 'thermal_80' | 'thermal_58' | 'other'

export interface PrinterDef {
  id: string
  /** ชื่อที่แอดมินตั้ง (เช่น "Nimbot B1Pro — ครัว") */
  label: string
  model: PrinterModel
  paperWidthMm: number
  /** จุดตั้งเครื่อง (ครัว/เคาน์เตอร์) — ใช้แสดงเฉย ๆ */
  location?: string
  active: boolean
}

export const PRINTER_MODEL_LABELS: Record<PrinterModel, string> = {
  nimbot_b1pro: 'Nimbot B1Pro (เทอร์มอล/ป้าย)',
  thermal_80: 'เครื่องพิมพ์ความร้อน 80 มม.',
  thermal_58: 'เครื่องพิมพ์ความร้อน 58 มม.',
  other: 'อื่น ๆ (ตั้งชื่อเอง)',
}

/** ความกว้างกระดาษเริ่มต้นของแต่ละโมเดล (แอดมินแก้ได้ทีหลัง) */
export const PRINTER_MODEL_DEFAULT_WIDTH: Record<PrinterModel, number> = {
  nimbot_b1pro: 50,
  thermal_80: 80,
  thermal_58: 58,
  other: 80,
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  receiptPrinterName: '',
  kitchenPrinterName: '',
  autoPrintReceipt: true,
  autoPrintKitchen: true,
  autoPrintStickers: true,
  paperWidthMm: 80,
  printers: [],
  receiptPrinterId: null,
  kitchenPrinterId: null,
  qzEnabled: false,
  qzPrinterName: '',
}

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatThaiBaht(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return '฿' + v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatThaiDateTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
}

const PAYMENT_LABELS: Record<string, string> = {
  promptpay_qr: 'PromptPay QR',
  cash_on_delivery: 'เงินสด',
  credit_card: 'บัตรเครดิต',
}

const FULFILLMENT_LABELS: Record<string, string> = {
  pickup: 'รับที่ร้าน',
  self_delivery: 'จัดส่ง (Bite Drive)',
  grab_rider: 'Grab',
  linemen_rider: 'Lineman',
  foodpanda_rider: 'foodpanda',
}

function itemsRowsHtml(items: PrintOrderLine[]): string {
  return items
    .map((it) => {
      const addons = it.customizations?.addOnTotal ? ` (addOn ${formatThaiBaht(Number(it.customizations.addOnTotal))})` : ''
      const special = it.special_request ? `<div class="sub">* ${escapeHtml(it.special_request)}</div>` : ''
      return `<tr><td class="name">${escapeHtml(it.product_name)}${addons}${special}</td>` +
        `<td class="qty">x${Number(it.quantity)}</td>` +
        `<td class="amt">${formatThaiBaht(Number(it.unit_price) * Number(it.quantity))}</td></tr>`
    })
    .join('')
}

function totalsRowsHtml(o: PrintOrderData): string {
  const rows: string[] = []
  rows.push(`<tr><td>รวมก่อนส่วนลด</td><td class="amt">${formatThaiBaht(o.subtotal ?? 0)}</td></tr>`)
  if (Number(o.discount_amount ?? 0) > 0) {
    rows.push(`<tr><td>ส่วนลด</td><td class="amt">-${formatThaiBaht(o.discount_amount)}</td></tr>`)
  }
  rows.push(`<tr><td>ค่าจัดส่ง</td><td class="amt">${Number(o.delivery_fee ?? 0) === 0 ? 'ฟรี' : formatThaiBaht(o.delivery_fee)}</td></tr>`)
  if (Number(o.service_fee ?? 0) > 0) {
    rows.push(`<tr><td>ค่าบริการ</td><td class="amt">${formatThaiBaht(o.service_fee)}</td></tr>`)
  }
  if (Number(o.tax_amount ?? 0) > 0) {
    rows.push(`<tr><td>ภาษี</td><td class="amt">${formatThaiBaht(o.tax_amount)}</td></tr>`)
  }
  rows.push(`<tr class="total"><td>ยอดสุทธิ</td><td class="amt">${formatThaiBaht(o.total_amount)}</td></tr>`)
  return rows.join('')
}

function printCss(paperWidthMm = 80): string {
  const bodyW = Math.max(20, paperWidthMm - 8) // พื้นที่พิมพ์ = กระดาษ − ขอบ @page 4 มม.×2
  return `
  @page { margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Sarabun', 'Tahoma', 'Leelawadee UI', sans-serif; font-size: 12px; width: ${bodyW}mm; margin: 0; color: #000; }
  h1 { font-size: 15px; text-align: center; margin: 2px 0; }
  .center { text-align: center; }
  .sub { font-size: 10px; color: #333; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  td.name { width: 60%; }
  td.qty { width: 12%; text-align: center; }
  td.amt { width: 28%; text-align: right; white-space: nowrap; }
  tr.total td { font-weight: bold; font-size: 14px; border-top: 1px solid #000; }
  .code { font-size: 22px; letter-spacing: 6px; font-weight: bold; text-align: center; margin: 6px 0; }
  .kitchen h1 { font-size: 18px; }
  .kitchen .item { font-size: 16px; margin: 4px 0; border-bottom: 1px solid #000; padding-bottom: 3px; }
  .kitchen .item .qty { font-size: 18px; font-weight: bold; }
`
}

/** Customer receipt (80mm) — pure builder, unit-tested. */
export function buildReceiptHtml(o: PrintOrderData, paperWidthMm = 80): string {
  const pickupBlock = o.delivery_method === 'pickup'
    ? `<div class="center">กรุณาแสดงรหัสรับอาหารนี้ที่หน้าร้าน</div><div class="code">${escapeHtml(o.pickup_code ?? '------')}</div>`
    : ''
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเสร็จ ${escapeHtml(o.order_number)}</title><style>${printCss(paperWidthMm)}</style></head><body>
<h1>Bite Me Baby</h1>
<div class="center sub">ใบเสร็จรับเงิน / Receipt</div>
<hr>
<div>ออเดอร์: <b>${escapeHtml(o.order_number)}</b></div>
<div class="sub">วันที่: ${formatThaiDateTime(o.created_at)}</div>
<div class="sub">ลูกค้า: ${escapeHtml(o.customer_name ?? '-')}${o.customer_phone ? ` · ${escapeHtml(o.customer_phone)}` : ''}</div>
<div class="sub">ช่องทางรับ: ${escapeHtml(FULFILLMENT_LABELS[o.delivery_method ?? 'self_delivery'] ?? o.delivery_method ?? '-')} · ${escapeHtml(o.order_mode ?? 'SAME_DAY')}</div>
<hr>
<table>${itemsRowsHtml(o.items)}</table>
<hr>
<table>${totalsRowsHtml(o)}</table>
<hr>
<div class="sub">ชำระโดย: ${escapeHtml(PAYMENT_LABELS[o.payment_method ?? ''] ?? o.payment_method ?? '-')} · สถานะ: ${escapeHtml(o.payment_status ?? '-')}</div>
${o.special_instructions ? `<div class="sub">หมายเหตุ: ${escapeHtml(o.special_instructions)}</div>` : ''}
${pickupBlock}
<hr>
<div class="center sub">ขอบคุณที่อุดหนุน Bite Me Baby</div>
</body></html>`
}

/** Kitchen ticket — item-focused, no prices (pure builder, unit-tested). */
export function buildKitchenTicketHtml(o: PrintOrderData, paperWidthMm = 80): string {
  const items = o.items
    .map((it) => {
      const special = it.special_request ? `<div class="sub">* ${escapeHtml(it.special_request)}</div>` : ''
      return `<div class="item"><span class="qty">x${Number(it.quantity)}</span> ${escapeHtml(it.product_name)}${special}</div>`
    })
    .join('')
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>คิวครัว ${escapeHtml(o.order_number)}</title><style>${printCss(paperWidthMm)}</style></head><body class="kitchen">
<h1>คิวครัว — ${escapeHtml(o.order_number)}</h1>
<div class="center sub">${escapeHtml(FULFILLMENT_LABELS[o.delivery_method ?? 'self_delivery'] ?? o.delivery_method ?? '-')} · ${escapeHtml(o.order_mode ?? 'SAME_DAY')}${o.scheduled_date ? ` · ${escapeHtml(o.scheduled_date)}` : ''}</div>
<hr>
${items}
${o.special_instructions ? `<hr><div class="item">หมายเหตุรวม: ${escapeHtml(o.special_instructions)}</div>` : ''}
</body></html>`
}

// ============================================================
// R27 (Owner 2026-10-30) — เทมเพลตสติกเกอร์ BMB 40×60 (ใบเสร็จ + ครัว = ใบเดียวกัน)
// ============================================================
// แบบจากที่ Owner วาดในแอป Nimbot (Templates-BmB · กระดาษ TT40*60-125transparent):
//   BITE ME BABY · " MORE THAN DELLICIOUS " · เส้นคั่น · Order id / Date / Menu / Notice
//   · CUSTOMER / Tel. ☎ · QR + SCAN FOR MORE + ข้อความไทย + Thank You for love !
// "เวลาใช้พิมรายละเอียดเฉพาะหลัง : เท่านั้น" = ป้ายซ้ายฝังตายในเทมเพลต ค่าทางขวา
// อ่านจากแบบฟอร์มออเดอร์จริง (buildPrintOrderData) — ไม่มีบรรทัดราคาในใบ (รายละเอียด
// การซื้ออยู่หลัง QR = biteme-baby.com) · QR สร้างฝั่ง client ด้วย qrcode (fallback = URL ตรง)
export const BMB_STICKER_W_MM = 40
export const BMB_STICKER_H_MM = 60
const STICKER_QR_URL = 'https://biteme-baby.com'

export async function buildBmbStickerHtml(o: PrintOrderData): Promise<string> {
  let qrImg = ''
  try {
    const QR = await import('qrcode')
    qrImg = await QR.toDataURL(STICKER_QR_URL, {
      margin: 0,
      width: 240,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
  } catch { /* offline/พัง = โชว์ URL ตรงในช่อง QR ยังพิมพ์ได้ */ }

  const menuParts = o.items.slice(0, 3).map((it) => {
    const note = it.special_request ? ` (${escapeHtml(it.special_request)})` : ''
    return `${escapeHtml(it.product_name)} x${Number(it.quantity)}${note}`
  })
  if (o.items.length > 3) menuParts.push('…')
  const menu = menuParts.length > 0 ? menuParts.join('<br>') : '-'
  const notice = (o.special_instructions || '').trim() || '-'
  const date = formatThaiDateTime(o.created_at) || '-'
  const qrBlock = qrImg
    ? `<img src="${qrImg}" alt="QR">`
    : `<div class="ph">${STICKER_QR_URL.replace('https://', '')}</div>`

  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>สติกเกอร์ ${escapeHtml(o.order_number)}</title><style>
  @page { size: ${BMB_STICKER_W_MM}mm ${BMB_STICKER_H_MM}mm; margin: 0.8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Tahoma', 'Leelawadee UI', sans-serif; font-size: 8.2px; color: #000; line-height: 1.22; }
  /* R28: clamp ต่อสติกเกอร์ 1 ใบ — ของล้น = ตัดทิ้ง ไม่ดันไปหน้า 2 (Owner: ปริ้นออกมาเป็น 2 หน้า) */
  .sheet { width: 38.4mm; height: 58.4mm; overflow: hidden; }
  .brand { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: .3px; margin: 0; }
  .tag { text-align: center; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 6.5px; letter-spacing: 1px; margin: 1px 0 1.5px; }
  hr.rule { border: 0; border-top: 1.2px solid #000; margin: 1.5px 0; }
  .f { display: block; margin: .5px 0; font-size: 8.2px; }
  .menu { font-size: 7.8px; margin: .5px 0 0 1px; }
  .cust { margin-top: 1.5px; font-size: 8.6px; font-weight: 700; }
  .telrow { margin: .5px 0 0 5mm; font-size: 8.6px; font-weight: 700; }
  .qrwrap { display: flex; gap: 1.2mm; align-items: center; margin-top: 1.5px; }
  .qrwrap img { width: 12.5mm; height: 12.5mm; display: block; }
  .qrwrap .ph { width: 12.5mm; height: 12.5mm; border: 1px dashed #000; display: flex; align-items: center; justify-content: center; font-size: 5.5px; text-align: center; word-break: break-all; }
  .qrtext { flex: 1; text-align: center; min-width: 0; }
  .scan { font-weight: 800; font-size: 8.5px; letter-spacing: .1px; white-space: nowrap; }
  .qrtext .t { font-size: 6.2px; line-height: 1.15; margin-top: .5px; }
  .ty { font-family: 'Brush Script MT', Georgia, cursive; font-style: italic; font-size: 7.5px; margin-top: 1px; }
  </style></head><body>
  <div class="sheet">
  <p class="brand">BITE ME BABY</p>
  <p class="tag">" MORE THAN DELLICIOUS "</p>
  <hr class="rule">
  <span class="f"><b>Order id  :</b> ${escapeHtml(o.order_number)}</span>
  <span class="f"><b>Date      :</b> ${escapeHtml(date)}</span>
  <span class="f"><b>Menu      :</b></span>
  <div class="menu">${menu}</div>
  <span class="f"><b>Notice    :</b> ${escapeHtml(notice)}</span>
  <hr class="rule">
  <div class="cust">CUSTOMER : ${escapeHtml(o.customer_name ?? '-')}</div>
  <div class="telrow">Tel. ☎ : ${escapeHtml(o.customer_phone ?? '-')}</div>
  <hr class="rule">
  <div class="qrwrap">
    ${qrBlock}
    <div class="qrtext">
      <div class="scan">SCAN FOR MORE</div>
      <div class="t">รายละเอียดการซื้อ</div>
      <div class="t">สแกนสมาชิกเพื่อสะสมแต้ม</div>
      <div class="t">รับรางวัลจำนวนมาก</div>
      <div class="ty">Thank You for love !</div>
    </div>
  </div>
  </div>
  </body></html>`
}

// ---------- print execution (browser fallback) ----------

/** Opens a hidden iframe and triggers the browser print dialog. Returns the
 *  print-job state this call can honestly prove: 'sent' (dialog invoked).
 *  Physical print must be confirmed by the operator via markPrintJob('printed'). */
export function printHtmlInHiddenFrame(html: string): 'sent' | 'failed' {
  if (_printDialogOpen) return 'failed' // กันเรียกซ้ำระหว่าง dialog เปิดอยู่
  _printDialogOpen = true
  try {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    // offscreen แบบยัง render ได้ — 0×0/visibility:hidden บาง build ของ Chrome ไม่เปิด dialog จริง
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;'
    document.body.appendChild(frame)
    const doc = frame.contentWindow?.document
    if (!doc) throw new Error('no print document')
    doc.open()
    doc.write(html)
    doc.close()
    const cleanup = () => {
      frame.remove()
      window.removeEventListener('afterprint', cleanup)
      _printDialogOpen = false // R25: ปล่อย guard เมื่อ dialog "ปิดจริง" (afterprint) — เดิมปล่อยทันทีหลัง print() คืนค่า (Chrome คืนก่อน dialog ปิด) → คำสั่งถัดไปเข้าคิวหลัง dialog เดิม → Cancel แล้วตัวที่ค้างเปิดเอง = "แคนเซิ่ลแล้วยังปริ้น"
    }
    window.addEventListener('afterprint', cleanup) // ลบเมื่อ dialog ปิดจริง
    setTimeout(cleanup, 60_000) // กันค้างถ้า browser ไม่ยิง afterprint
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    return 'sent'
  } catch {
    _printDialogOpen = false
    return 'failed'
  }
}

// ---------- R27: transport เลือกเอง — QZ Tray (เงียบ ไม่พึ่งไดรเวอร์ Windows) → fallback dialog ----------
// QZ สำเร็จ = promise resolve (ส่งงานเข้าสปูเลอร์แล้ว = 'sent' ตามเกณฑ์เดิม ไม่โม้ว่าปริ้นจริง)
// QZ ล้ม = console.warn แล้วตกมาใช้ dialog เดิมของเบราว์เซอร์/OS ต่อ (ของเดิมไม่หาย)
async function printViaTransport(
  html: string,
  settings: PrinterSettings,
  role: PrinterRole,
  jobName: string,
): Promise<'sent' | 'failed'> {
  if (settings.qzEnabled && settings.qzPrinterName) {
    try {
      const qz = await import('./qzTray')
      await qz.qzPrintHtml(settings.qzPrinterName, html, {
        widthMm: BMB_STICKER_W_MM,
        heightMm: BMB_STICKER_H_MM,
        jobName: jobName || role,
      })
      return 'sent'
    } catch (e) {
      console.warn('[printViaTransport] QZ failed — fallback to browser dialog:', e)
    }
  }
  return printHtmlInHiddenFrame(html)
}

// ---------- print_jobs RPC surface ----------

export interface PrintJobRow {
  id: string
  order_number: string
  job_type: PrintJobType
  status: PrintJobStatus
  printer_id: string | null
  attempts: number
  last_error: string | null
  requested_at: string
  updated_at: string
  printed_at: string | null
}

export async function fetchPrintJobs(orderNumber: string): Promise<PrintJobRow[]> {
  const { data, error } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('order_number', orderNumber)
    .order('requested_at', { ascending: true })
  if (error) {
    console.error('[fetchPrintJobs]', error)
    return []
  }
  return (data ?? []) as PrintJobRow[]
}

export async function markPrintJob(jobId: string, status: PrintJobStatus, error?: string): Promise<boolean> {
  const { error: rpcError } = await supabase.rpc('mark_print_job', {
    p_job_id: jobId,
    p_status: status,
    p_error: error ?? undefined,
  })
  if (rpcError) {
    console.error('[markPrintJob]', rpcError)
    return false
  }
  return true
}

/** Full auto-print pass for one order: render + print every pending job of the
 *  given type. Returns per-job results — the ORDER itself is never affected by
 *  print failures (print is an async side-effect, order is the source of truth). */
export async function runAutoPrint(order: PrintOrderData, type: PrintJobType, settings: PrinterSettings): Promise<Array<{ jobId: string; status: PrintJobStatus }>> {
  if (type === 'receipt' && !settings.autoPrintReceipt) return []
  if (type === 'kitchen_ticket' && !settings.autoPrintKitchen) return []
  const jobs = (await fetchPrintJobs(order.order_number)).filter(
    (j) => j.job_type === type && (j.status === 'requested' || j.status === 'failed'),
  )
  // R27 (Owner): ใบเสร็จ + ใบสั่งครัว = สติกเกอร์ BMB 40×60 แบบฟอร์มเดียวกันทั้งคู่
  const html = await buildBmbStickerHtml(order)
  const results: Array<{ jobId: string; status: PrintJobStatus }> = []
  for (const job of jobs) {
    const outcome = await printViaTransport(html, settings, type === 'receipt' ? 'receipt' : 'kitchen', `${type}-${order.order_number}`)
    if (outcome === 'sent') {
      await markPrintJob(job.id, 'sent')
      results.push({ jobId: job.id, status: 'sent' })
    } else {
      await markPrintJob(job.id, 'failed', 'browser print dialog failed')
      results.push({ jobId: job.id, status: 'failed' })
    }
  }
  return results
}

/**
 * POS ออเดอร์เดียว = 1 dialog เดียว (ใบเสร็จ → หน้าถัดไป → ใบสั่งครัว)
 * R23: แก้ "กด Cancel แล้วยังมีใบถัด ๆ มาเด้งตาม" — เดิมเรียก runAutoPrint 2 ครั้ง = 2 dialog ต่อเนื่อง
 */
export async function runAutoPrintPair(
  order: PrintOrderData,
  settings: PrinterSettings,
): Promise<Array<{ jobId: string; status: PrintJobStatus }>> {
  const results: Array<{ jobId: string; status: PrintJobStatus }> = []
  const wantReceipt = settings.autoPrintReceipt
  const wantKitchen = settings.autoPrintKitchen
  if (!wantReceipt && !wantKitchen) return results
  const jobs = (await fetchPrintJobs(order.order_number))
    .filter((j) => (j.job_type === 'receipt' && wantReceipt) || (j.job_type === 'kitchen_ticket' && wantKitchen))
    .filter((j) => j.status === 'requested' || j.status === 'failed')
  if (jobs.length === 0) return results
  // R27: ทั้งสองใบ = สติกเกอร์ BMB แบบเดียวกัน (Owner: ใช้สติกเกอร์รวมเดียวกันทั้งใบเสร็จและครัว)
  const sticker = await buildBmbStickerHtml(order)
  const rHtml = wantReceipt ? sticker : ''
  const kHtml = wantKitchen ? sticker : ''
  const bodyInner = (h: string) => {
    const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(h)
    return m ? m[1] : h
  }
  const combined =
    rHtml && kHtml
      ? rHtml.replace('</body>', `<div style="page-break-after:always"></div>${bodyInner(kHtml)}</body>`)
      : rHtml || kHtml
  const outcome = await printViaTransport(combined, settings, 'receipt', 'pair-' + order.order_number)
  for (const job of jobs) {
    if (outcome === 'sent') {
      await markPrintJob(job.id, 'sent')
      results.push({ jobId: job.id, status: 'sent' })
    } else {
      await markPrintJob(job.id, 'failed', 'browser print dialog failed')
      results.push({ jobId: job.id, status: 'failed' })
    }
  }
  return results
}

// ---------- printer settings (business_settings key: print_settings) ----------

export async function loadPrinterSettings(): Promise<PrinterSettings> {
  const { getBusinessSettings } = await import('./bmbAdminApi_settings')
  const s = await getBusinessSettings()
  const v = (s?.print_settings ?? {}) as Partial<PrinterSettings>
  return { ...DEFAULT_PRINTER_SETTINGS, ...v }
}

export async function savePrinterSettings(settings: PrinterSettings): Promise<boolean> {
  const { setBusinessSetting } = await import('./bmbAdminApi_settings')
  return await setBusinessSetting('print_settings', settings as unknown as Record<string, unknown>)
}

// ============================================================
// R21 (Owner 2026-10-29) — ทะเบียนเครื่องพิมพ์ (แอดมินเพิ่ม/เลือกเองได้)
// ============================================================
// ทุกฟังก์ชันเป็น pure ต่อ input (ไม่ยิง network) — test ได้โดยตรง
// หมายเหตุความซื่อสัตย์: คำสั่งพิมพ์ยังเป็น window.print ผ่าน iframe เดิม
// → เบราว์เซอร์/OS เป็นคนเลือกเครื่องจริง ระบบจึง "แสดงชื่อเครื่องที่ผูกไว้"
// ใน toast เสมอ และไม่เคยอ้างว่าพิมพ์สำเร็จจนกว่าจะได้รับยืนยัน (ตรรกะเดิม)
// ============================================================

export function createPrinterDef(input: {
  label: string
  model: PrinterModel
  paperWidthMm?: number
  location?: string
}): PrinterDef {
  const model = PRINTER_MODEL_LABELS[input.model] ? input.model : 'other'
  return {
    id: `prn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: (input.label || '').trim() || PRINTER_MODEL_LABELS[model],
    model,
    paperWidthMm: Number(input.paperWidthMm) > 0 ? Number(input.paperWidthMm) : PRINTER_MODEL_DEFAULT_WIDTH[model],
    location: (input.location || '').trim() || undefined,
    active: true,
  }
}

/** เพิ่ม/แก้ไขเครื่องพิมพ์ (id เดิม = แทนที่แถวเดิม) */
export function upsertPrinter(settings: PrinterSettings, def: PrinterDef): PrinterSettings {
  const list = [...(settings.printers ?? [])]
  const idx = list.findIndex((p) => p.id === def.id)
  if (idx >= 0) list[idx] = def
  else list.push(def)
  return { ...settings, printers: list }
}

/** ลบเครื่องพิมพ์ — ถ้าเป็นค่าที่ผูกกับใบเสร็จ/คิวครัว ให้ปลดผูกด้วย (ไม่ให้ค้าง id ตาย) */
export function removePrinter(settings: PrinterSettings, printerId: string): PrinterSettings {
  return {
    ...settings,
    printers: (settings.printers ?? []).filter((p) => p.id !== printerId),
    receiptPrinterId: settings.receiptPrinterId === printerId ? null : settings.receiptPrinterId,
    kitchenPrinterId: settings.kitchenPrinterId === printerId ? null : settings.kitchenPrinterId,
  }
}

export type PrinterRole = 'receipt' | 'kitchen'

/** ผูกเครื่องพิมพ์กับบทบาท (null = ใช้ค่าเริ่มต้นของระบบ/ค่าชื่อเดิม) */
export function assignPrinter(settings: PrinterSettings, role: PrinterRole, printerId: string | null): PrinterSettings {
  return role === 'receipt'
    ? { ...settings, receiptPrinterId: printerId }
    : { ...settings, kitchenPrinterId: printerId }
}

/** หาเครื่องพิมพ์ของบทบาท — fallback: แถวเดียวที่ active (ถ้ายังไม่ได้ผูก) */
export function resolvePrinter(settings: PrinterSettings, role: PrinterRole): PrinterDef | null {
  const list = (settings.printers ?? []).filter((p) => p.active)
  const wanted = role === 'receipt' ? settings.receiptPrinterId : settings.kitchenPrinterId
  const byId = wanted ? list.find((p) => p.id === wanted) : undefined
  if (byId) return byId
  if (list.length === 1) return list[0]
  return null
}

/** ชื่อเครื่องสำหรับโชว์ใน toast/ข้อความ (ไม่เคยโม้ว่า "พิมพ์สำเร็จ") */
export function describePrinterTarget(settings: PrinterSettings, role: PrinterRole): string {
  const p = resolvePrinter(settings, role)
  if (p) return `${p.label}${p.location ? ` (${p.location})` : ''}`
  const legacy = role === 'receipt' ? settings.receiptPrinterName : settings.kitchenPrinterName
  return legacy || 'เครื่องพิมพ์ค่าเริ่มต้นของระบบ'
}

// ============================================================
// R21 — แปลงแถวออเดอร์จริง → payload ของเทมเพลต (ใช้ร่วมกัน auto/manual)
// ============================================================

/** โครงสร้างขั้นต่ำที่เทมเพลตต้องการ — รับได้ทั้งแถว orders (select '*') และแถว POS */
export interface PrintableOrder {
  order_number: string
  created_at?: string
  customer_name?: string
  customer_phone?: string
  items: Array<{
    product_name: string
    quantity: number
    unit_price: number
    customizations?: Record<string, any> | null
    special_request?: string | null
  }>
  subtotal?: number | null
  discount_amount?: number | null
  delivery_fee?: number | null
  service_fee?: number | null
  tax_amount?: number | null
  total_amount?: number | null
  payment_method?: string | null
  payment_status?: string | null
  delivery_method?: string | null
  pickup_code?: string | null
  order_mode?: string | null
  scheduled_date?: string | null
  special_instructions?: string | null
}

/**
 * สร้าง payload ของเทมเพลตจากแถวออเดอร์ — ใช้ "ค่าที่ server เก็บไว้" เสมอ
 * และบวกจากบรรทัดสินค้าเฉพาะตอนที่ DB ไม่ได้ส่งยอด subtotal มา (ไม่เดาส่วนลด)
 */
export function buildPrintOrderData(order: PrintableOrder): PrintOrderData {
  const items = (order.items ?? []).map((it) => ({
    product_name: it.product_name,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price || 0),
    customizations: it.customizations ?? null,
    special_request: it.special_request ?? null,
  }))
  const lineSum = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)
  return {
    order_number: order.order_number,
    created_at: order.created_at,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    items,
    subtotal: Number(order.subtotal ?? lineSum),
    discount_amount: Number(order.discount_amount ?? 0),
    delivery_fee: Number(order.delivery_fee ?? 0),
    service_fee: Number(order.service_fee ?? 0),
    tax_amount: Number(order.tax_amount ?? 0),
    total_amount: Number(order.total_amount ?? lineSum),
    payment_method: order.payment_method ?? undefined,
    payment_status: order.payment_status ?? undefined,
    delivery_method: order.delivery_method ?? undefined,
    pickup_code: order.pickup_code ?? null,
    order_mode: order.order_mode ?? undefined,
    scheduled_date: order.scheduled_date ?? null,
    special_instructions: order.special_instructions ?? null,
  }
}

/**
 * พิมพ์งานเดียวแบบ manual (แอดมินกด "เลือกพิมพ์") — ใช้เทมเพลตเดิมของระบบ:
 *   1) ผูกงานกับ print_jobs (enqueue แบบ idempotent — job เดิมไม่ถูกสร้างซ้ำ)
 *   2) render HTML แล้วส่งเข้า frame พิมพ์ (คำสั่งเบราว์เซอร์/OS เดิม)
 *   3) อัปเดตสถานะเป็น sent | failed ตามผลจริง — ห้ามโม้ว่า "พิมพ์สำเร็จ"
 *
 * R23: ไม่ confirm ซ้ำถ้ามี print dialog เปิดอยู่ (กัน Cancel แล้วยังมี confirm ซ้ำ)
 */
export async function printOrderTicket(
  order: PrintableOrder,
  type: PrintJobType,
  settings: PrinterSettings,
): Promise<'sent' | 'failed'> {
  const printer = resolvePrinter(settings, type === 'receipt' ? 'receipt' : 'kitchen')
  let jobId: string | null = null
  try {
    const { data, error } = await supabase.rpc('enqueue_print_job', {
      p_order_number: order.order_number,
      p_job_type: type,
      p_printer_id: printer?.id ?? null,
    })
    if (!error) jobId = ((data as { id?: string } | null)?.id ?? null)
  } catch (e) {
    console.warn('[printOrderTicket] enqueue failed (printing continues):', e)
  }

  const payload = buildPrintOrderData(order)
  // R27 (Owner): ใบเสร็จ + ใบสั่งครัว = สติกเกอร์ BMB 40×60 ใบเดียวกัน (แบบฟอร์มเดียวทั้งสองบทบาท)
  const html = await buildBmbStickerHtml(payload)
  const outcome = await printViaTransport(html, settings, type === 'receipt' ? 'receipt' : 'kitchen', `sticker-${order.order_number}`)

  if (jobId) {
    if (outcome === 'sent') await markPrintJob(jobId, 'sent')
    else await markPrintJob(jobId, 'failed', 'browser print dialog failed')
  }
  return outcome
}