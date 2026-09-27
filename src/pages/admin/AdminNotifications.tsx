// ============================================
// Bite Me Baby — Admin Notifications (W3-D-8 operational visibility)
// Shows durable notification state: recipient (opaque customer_id),
// event/type, channel category, read state, created_at.
// RLS: admin SELECT via notifications_admin policy. No PII/tokens/credentials.
// ============================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface AdminNotificationRow {
  id: string
  customer_id: string | null
  title: string
  message: string
  notification_type: string | null
  category: string
  is_read: boolean
  created_at: string
}

const PAGE_SIZE = 50

export function AdminNotificationsPage() {
  const [rows, setRows] = useState<AdminNotificationRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (q.trim()) query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .or(`id.ilike.%${q.trim()}%,notification_type.ilike.%${q.trim()}%,title.ilike.%${q.trim()}%`)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    query.then(({ data, error: e, count }) => {
      if (cancelled) return
      if (e) setError(e.message)
      else {
        setError('')
        setRows((data || []) as AdminNotificationRow[])
        setTotal(count || 0)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [page, q])

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-brand-accent">🔔 Notifications</h1>
      <p className="text-xs text-brand-muted">
        Durable notification state (W3-D). Recipient shown as opaque customer id — no PII / tokens / provider credentials.
      </p>
      <input
        value={q}
        onChange={(e) => { setPage(0); setQ(e.target.value) }}
        placeholder="ค้นหา id / type / title…"
        className="w-full max-w-md px-3 py-2 rounded-lg border border-brand-border bg-white text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-brand-muted">กำลังโหลด…</p>
      ) : (
        <div className="overflow-x-auto border border-brand-border rounded-xl bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-bg text-brand-accent">
              <tr>
                <th className="px-3 py-2 text-left">id</th>
                <th className="px-3 py-2 text-left">recipient (customer_id)</th>
                <th className="px-3 py-2 text-left">event / type</th>
                <th className="px-3 py-2 text-left">channel</th>
                <th className="px-3 py-2 text-left">status</th>
                <th className="px-3 py-2 text-left">created_at</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-brand-bg/50">
                  <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.customer_id || '— (admin/ops)'}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.notification_type || '—'}</div>
                    <div className="text-xs text-brand-muted">{r.title}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.category}</td>
                  <td className="px-3 py-2 text-xs">{r.is_read ? 'read' : 'unread'}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('th-TH')}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-brand-muted">ไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-3 text-sm">
        <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-3 py-1 rounded-lg border disabled:opacity-40">← ก่อนหน้า</button>
        <span className="text-xs text-brand-muted">หน้า {page + 1} · ทั้งหมด {total} รายการ</span>
        <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40">ถัดไป →</button>
      </div>
    </div>
  )
}
