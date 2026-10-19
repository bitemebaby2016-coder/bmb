// ============================================
// Bite Me Baby — Admin Reports (Daily Sales / Closing / CSV Export)
// Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
//
// วินัยข้อมูล (Owner rule): order total ≠ เงินสดที่ได้รับ —
// แสดง paid / unpaid / refunded แยกกันเสมอ และห้ามประมาณกำไร
// (ต้นทุนยังไม่ครบ — ไม่คำนวณจากข้อมูลที่ไม่มีจริง)
// ============================================
import { useState, useEffect, useCallback } from 'react'
import { showToast } from '@/components/ui/ToastContainer'
import { getDailySales, closeDay, buildDailySalesCsv, DailySales, DAILY_SALES_CSV_LABELS } from '@/lib/posApi'

function money(n: number | null | undefined): string {
  return '฿' + Number(n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

export function AdminReports() {
  const [date, setDate] = useState(today())
  const [sales, setSales] = useState<DailySales | null>(null)
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [history, setHistory] = useState<DailySales[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const s = await getDailySales(date)
    setSales(s)
    setLoading(false)
  }, [date])

  useEffect(() => { void load() }, [load])

  function exportCsv() {
    const rows = history.length > 0 ? history : (sales ? [sales] : [])
    if (rows.length === 0) { showToast('ไม่มีข้อมูลให้ export', 'warning'); return }
    const csv = buildDailySalesCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bmb-daily-sales-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Export CSV แล้ว (ข้อมูลจากเซิร์ฟเวอร์โดยตรง)', 'success')
  }

  async function handleCloseDay() {
    setClosing(true)
    const r = await closeDay(date)
    setClosing(false)
    if (r.ok && r.sales) {
      showToast(`ปิดยอดวันที่ ${date} แล้ว — บันทึกลง daily_closings`, 'success')
      setHistory((prev) => [...prev.filter((h) => h.date !== r.sales!.date), r.sales!])
      await load()
    } else {
      showToast(`ปิดยอดไม่สำเร็จ: ${r.error}`, 'error')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-accent">📊 รายงานการเงินรายวัน</h1>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <input type="date" className="input w-48" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-outline" onClick={() => void load()} disabled={loading}>{loading ? '⏳ ...' : 'โหลดข้อมูล'}</button>
          <button className="btn btn-primary" onClick={() => void handleCloseDay()} disabled={closing || !sales}>
            {closing ? '⏳ ...' : '📌 ปิดยอดประจำวัน (Daily Closing)'}
          </button>
          <button className="btn btn-outline" onClick={exportCsv}>⬇️ Export CSV</button>
          <button className="btn btn-outline" onClick={() => window.print()}>🖨️ พิมพ์ (browser)</button>
        </div>
        <p className="text-xs text-brand-muted mt-2">
          ยอด "ชำระแล้ว" เท่านั้นที่สะท้อนเงินที่ได้รับจริง — ยอดสั่งซื้อที่ยังไม่ชำระไม่นับเป็นรายได้ · ปิดยอดซ้ำได้ (idempotent) ระบบจะคำนวณใหม่จากออเดอร์จริงทุกครั้ง
        </p>
      </div>

      {sales && (
        <div className="card">
          <h3 className="font-bold text-brand-accent mb-3">ยอดขายวันที่ {sales.date}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">จำนวนออเดอร์</div><div className="text-xl font-bold">{sales.orders_count}</div></div>
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">ยอดขายรวม (ก่อนส่วนลด)</div><div className="text-xl font-bold">{money(sales.gross_sales)}</div></div>
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">ยอดขายสุทธิ</div><div className="text-xl font-bold">{money(sales.net_sales)}</div></div>
            <div className="rounded-lg border-2 border-green-400 bg-green-50 p-3"><div className="text-xs text-slate-600">ชำระแล้ว (เงินเข้าจริง)</div><div className="text-xl font-bold text-green-700">{money(sales.paid_amount)}</div></div>
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">ค้างชำระ</div><div className="text-xl font-bold text-amber-600">{money(sales.unpaid_amount)}</div></div>
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">คืนเงินแล้ว</div><div className="text-xl font-bold text-red-600">{money(sales.refunded_amount)}</div></div>
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">ชำระแล้ว · เงินสด</div><div className="text-xl font-bold">{money(sales.paid_by_cash)}</div></div>
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">ชำระแล้ว · PromptPay</div><div className="text-xl font-bold">{money(sales.paid_by_promptpay)}</div></div>
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">ชำระแล้ว · บัตร</div><div className="text-xl font-bold">{money(sales.paid_by_card)}</div></div>
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">SAME_DAY / PRE_ORDER</div><div className="text-xl font-bold">{sales.sameday_count} / {sales.preorder_count}</div></div>
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">รับที่ร้าน (ชำระแล้ว)</div><div className="text-xl font-bold">{sales.pickup_count} / {money(sales.pickup_paid_amount)}</div></div>
            <div className="rounded-lg border border-brand-border p-3"><div className="text-xs text-brand-muted">ยกเลิก/ล้มเหลว</div><div className="text-xl font-bold">{sales.cancelled_count}</div></div>
          </div>
          <p className="text-xs text-brand-muted">
            ⚠️ กำไร/ต้นทุน: ยังไม่แสดง — ต้องมีข้อมูลต้นทุนวัตถุดิบ/บรรจุภัณฑ์ที่ครบถ้วนก่อน (ห้ามประมาณจากข้อมูลที่ไม่มีจริง)
          </p>
        </div>
      )}
    </div>
  )
}