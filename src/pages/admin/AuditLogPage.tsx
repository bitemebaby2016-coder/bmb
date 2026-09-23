// ============================================
// Bite Me Baby — Admin Audit Log Page (P1 — DB-backed)
// Reads from audit_logs table directly (authoritative source)
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export function AuditLogPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (filterAction !== 'all') {
        query = query.eq('action', filterAction)
      }
      const { data, error } = await query
      if (error) { console.error('[AuditLog] Load failed:', error); return }
      setEntries(data || [])
    } catch (e) {
      console.error('[AuditLog] Load error:', e)
    } finally {
      setLoading(false)
    }
  }, [filterAction, page])

  useEffect(() => { void load() }, [load])

  const filtered = searchTerm
    ? entries.filter(function(e) {
        return (e.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
               (e.entity_id || '').toLowerCase().includes(searchTerm.toLowerCase())
      })
    : entries

  const actionLabels: Record<string, string> = {
    user_login: 'Login',
    user_register: 'Register',
    order_create: 'สร้างออเดอร',
    order_status_change: 'Status Change',
    product_update: 'แก้ไขสินค้า',
    payment_processed: 'ชำระเงิน',
    batch_created: 'Batch Created',
    preorder_migrated: 'Pre-order Migrated',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">📜 บันทึกการตรวจสอบ (Audit Logs)</h1>

      {/* Controls */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input type="text" placeholder="ค้นหา..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input flex-1 min-w-[200px]" />
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input">
          <option value="all">ทั้งหมด</option>
          <option value="user_login">Login</option>
          <option value="order_create">สร้างออเดอร</option>
          <option value="order_status_change">Status Change</option>
          <option value="payment_processed">ชำระเงิน</option>
        </select>
      </div>

      {loading ? (
        <div className="card text-center py-8"><p className="text-brand-muted">กำลังหลด...</p></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-brand-muted">ยังไม่มีบันทึก</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-bg">
              <tr>
                <th className="p-3">เวลา</th>
                <th className="p-3">การกระทำ</th>
                <th className="p-3">รายละเอียด</th>
                <th className="p-3">Entity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(entry) {
                return (
                  <tr key={entry.id} className="border-b border-brand-border hover:bg-brand-bg">
                    <td className="p-3 whitespace-nowrap">{new Date(entry.created_at).toLocaleString('th-TH')}</td>
                    <td className="p-3">{actionLabels[entry.action] || entry.action}</td>
                    <td className="p-3 max-w-[300px] truncate">{entry.description}</td>
                    <td className="p-3 text-xs">{entry.entity_type}: {entry.entity_id}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex justify-between items-center p-3 text-sm text-brand-muted">
            <span>แสดง {filtered.length} รายการ</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="btn btn-outline text-xs disabled:opacity-50">◀ ย้อนกลับ</button>
              <button onClick={() => setPage(page + 1)} className="btn btn-outline text-xs">ถัดไป ▶</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


