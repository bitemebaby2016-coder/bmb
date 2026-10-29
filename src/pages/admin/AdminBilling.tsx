// ============================================
// Bite Me Baby — Admin Billing page (Task 2 · หน้าหลังบ้านดูงวดบริการ)
// ============================================
// อ่าน `billing_subscriptions` (migration 175 — ยังไม่ apply → โชว์ LoadErrorBanner
// พร้อมข้อความจริงว่าต้อง apply ก่อน · ไม่มีข้อมูลปลอม/ไม่เดา)
// การแจ้งเตือนตัดงวดผ่าน LINE Notify = ตั้ง secret + automation job (รอบถัดไป —
// บันทึกใน changelog รอบนี้)
// ============================================

import { useCallback, useEffect, useState } from 'react'
import { listBillingSubscriptions, daysUntilDue, billingStatusBadge, type BillingRow } from '@/lib/billingApi'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'

function cycleLabel(row: BillingRow): string {
  return row.billing_cycle === 'yearly' ? 'รายปี' : 'รายเดือน'
}

export function AdminBilling() {
  const [rows, setRows] = useState<BillingRow[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listBillingSubscriptions()
    setRows(res.rows)
    setLoadError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-4" data-testid="admin-billing-page">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-accent">💳 งวดบริการร้านพาร์ทเนอร์</h1>
        <button type="button" className="btn btn-outline text-sm" onClick={() => void load()} disabled={loading}>
          {loading ? '⏳ กำลังโหลด...' : '↻ โหลดใหม่'}
        </button>
      </div>

      <LoadErrorBanner message={loadError} onRetry={() => void load()} />
      {loadError && !loading && (
        <p className="text-xs text-brand-muted">
          ยังไม่มีตาราง = ยังไม่ได้ apply migration 175 (รอคำสั่ง <code>__apply 175__</code> จาก Owner)
        </p>
      )}

      {!loadError && !loading && rows.length === 0 && (
        <div className="card text-sm text-brand-muted" data-testid="billing-empty">
          ยังไม่มีงวดบริการ — เพิ่มแถวเมื่อเริ่มเก็บค่าบริการร้านพาร์ทเนอร์ (ตาราง billing_subscriptions)
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => {
          const days = daysUntilDue(row.current_period_end)
          const badge = billingStatusBadge(row.status)
          return (
            <div className="card" key={row.id} data-testid={`billing-row-${row.id}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-brand-accent">{row.tenants?.name || row.tenant_id}</div>
                <span className={`badge ${badge.cls}`}>{badge.label}</span>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-brand-muted">แพ็กเกจ</span><span>{row.plan} · {cycleLabel(row)}</span></div>
                <div className="flex justify-between"><span className="text-brand-muted">ยอด/งวด</span><span>฿{Number(row.amount_baht || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-brand-muted">ตัดงวดถัดไป</span><span>{new Date(row.current_period_end).toLocaleDateString('th-TH')}</span></div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">คงเหลือ</span>
                  <span className={days !== null && days <= row.remind_days_before ? 'font-semibold text-amber-700' : ''} data-testid="billing-days-left">
                    {days === null ? '—' : days < 0 ? `เกิน ${Math.abs(days)} วัน` : `${days} วัน`}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}