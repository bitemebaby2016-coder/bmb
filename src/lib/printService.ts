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
// ============================================
import { supabase } from './supabase'

export type PrintJobType = 'receipt' | 'kitchen_ticket'
export type PrintJobStatus = 'requested' | 'sent' | 'acknowledged' | 'printed' | 'failed'

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
  paperWidthMm: number
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  receiptPrinterName: '',
  kitchenPrinterName: '',
  autoPrintReceipt: true,
  autoPrintKitchen: true,
  paperWidthMm: 80,
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

const PRINT_CSS = `
  @page { margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Sarabun', 'Tahoma', 'Leelawadee UI', sans-serif; font-size: 12px; width: 72mm; margin: 0; color: #000; }
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

/** Customer receipt (80mm) — pure builder, unit-tested. */
export function buildReceiptHtml(o: PrintOrderData): string {
  const pickupBlock = o.delivery_method === 'pickup'
    ? `<div class="center">กรุณาแสดงรหัสรับอาหารนี้ที่หน้าร้าน</div><div class="code">${escapeHtml(o.pickup_code ?? '------')}</div>`
    : ''
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเสร็จ ${escapeHtml(o.order_number)}</title><style>${PRINT_CSS}</style></head><body>
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
export function buildKitchenTicketHtml(o: PrintOrderData): string {
  const items = o.items
    .map((it) => {
      const special = it.special_request ? `<div class="sub">* ${escapeHtml(it.special_request)}</div>` : ''
      return `<div class="item"><span class="qty">x${Number(it.quantity)}</span> ${escapeHtml(it.product_name)}${special}</div>`
    })
    .join('')
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>คิวครัว ${escapeHtml(o.order_number)}</title><style>${PRINT_CSS}</style></head><body class="kitchen">
<h1>คิวครัว — ${escapeHtml(o.order_number)}</h1>
<div class="center sub">${escapeHtml(FULFILLMENT_LABELS[o.delivery_method ?? 'self_delivery'] ?? o.delivery_method ?? '-')} · ${escapeHtml(o.order_mode ?? 'SAME_DAY')}${o.scheduled_date ? ` · ${escapeHtml(o.scheduled_date)}` : ''}</div>
<hr>
${items}
${o.special_instructions ? `<hr><div class="item">หมายเหตุรวม: ${escapeHtml(o.special_instructions)}</div>` : ''}
</body></html>`
}

// ---------- print execution (browser fallback) ----------

/** Opens a hidden iframe and triggers the browser print dialog. Returns the
 *  print-job state this call can honestly prove: 'sent' (dialog invoked).
 *  Physical print must be confirmed by the operator via markPrintJob('printed'). */
export function printHtmlInHiddenFrame(html: string): 'sent' | 'failed' {
  try {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.position = 'fixed'
    frame.style.right = '0'
    frame.style.bottom = '0'
    frame.style.width = '0'
    frame.style.height = '0'
    frame.style.border = '0'
    document.body.appendChild(frame)
    const doc = frame.contentWindow?.document
    if (!doc) throw new Error('no print document')
    doc.open()
    doc.write(html)
    doc.close()
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 60_000)
    return 'sent'
  } catch {
    return 'failed'
  }
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
  const html = type === 'receipt' ? buildReceiptHtml(order) : buildKitchenTicketHtml(order)
  const results: Array<{ jobId: string; status: PrintJobStatus }> = []
  for (const job of jobs) {
    const outcome = printHtmlInHiddenFrame(html)
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