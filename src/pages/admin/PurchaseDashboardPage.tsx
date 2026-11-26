// ============================================
// Bite Me Baby — Purchase Hub Dashboard (Phase 2 WP8)
// KPI cards + action lists from real get_po_dashboard RPC (migration 228).
// RLS-scoped (branch-aware). No mock.
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { getPoDashboard, type PODashboard } from '@/lib/bmbAdminApi_purchaseAnalytics'
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'

export function PurchaseDashboardPage() {
  const [data, setData] = useState<PODashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await getPoDashboard()
      if (!d) { setError('โหลดข้อมูล Dashboard ไม่สำเร็จ'); return }
      setData(d)
    } catch (e) {
      console.error('[PurchaseDashboardPage] load failed:', e)
      setError('โหลดข้อมูล Dashboard ไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const kpis = [
    { label: 'ยอดใช้จ่ายรวม', value: `฿${(data?.total_spend ?? 0).toLocaleString()}`, icon: '💰' },
    { label: 'จำนวนที่ค้างรับ', value: `${data?.outstanding_qty ?? 0}`, icon: '📦' },
    { label: 'GRN รออนุมัติ', value: `${data?.grn_pending ?? 0}`, icon: '⏳' },
    { label: 'PO ที่ต้องดำเนินการ', value: `${data?.pos_needing_action?.length ?? 0}`, icon: '📝' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">📊 Dashboard จัดซื้อ</h1>
        <button onClick={load} className="btn btn-outline text-sm" disabled={loading}>รีเฟรช</button>
      </div>

      {loading && <div className="card text-center py-8"><p className="text-brand-muted">กำลังโหลด...</p></div>}
      {error && <div className="mb-4"><LoadErrorBanner message={error} onRetry={load} testId="dash-load-error" /></div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {kpis.map(k => (
              <div key={k.label} className="card text-center">
                <div className="text-3xl mb-1">{k.icon}</div>
                <div className="text-xs text-brand-muted">{k.label}</div>
                <div className="text-xl font-bold text-brand-accent">{k.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-bold text-brand-accent mb-3">📝 PO ที่ต้องดำเนินการ</h3>
              {(data.pos_needing_action?.length ?? 0) === 0 ? (
                <p className="text-brand-muted text-sm py-3">ไม่มีรายการ</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {data.pos_needing_action!.map(p => (
                    <li key={p.po_id} className="flex justify-between border-b border-brand-border pb-1">
                      <span className="font-mono">{p.po_number}</span>
                      <span className="text-brand-muted">{p.supplier}</span>
                      <span className="font-medium">ค้าง {p.outstanding}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <h3 className="font-bold text-brand-accent mb-3">⏳ GRN รออนุมัติ</h3>
              {(data.grns_awaiting_approval?.length ?? 0) === 0 ? (
                <p className="text-brand-muted text-sm py-3">ไม่มีรายการ</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {data.grns_awaiting_approval!.map(g => (
                    <li key={g.grn_id} className="flex justify-between border-b border-brand-border pb-1">
                      <span className="font-mono">{g.grn_number}</span>
                      <span className="text-brand-muted">{g.po_number}</span>
                      <span>{g.receipt_date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}