// ============================================
// Bite Me Baby — Admin Kitchen Page (P1 — DB-backed)
// Shows production batches, kitchen queue, allows batch creation
// Data source: production_batches + order_items via RPCs
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { getKitchenSummary, createBatch } from '@/lib/bmbAdminApi_kitchen'
import { listRoundsForDate } from '@/lib/bmbAdminApi_rounds'
import { writeAuditLog } from '@/lib/auditLog'
import { showToast } from '@/components/ui/ToastContainer'
import type { DeliveryRoundRow } from '@/lib/bmbAdminApi_rounds'

export function AdminKitchen() {
  const [batches, setBatches] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({ pending_orders: 0, ready_orders: 0 })
  const [rounds, setRounds] = useState<DeliveryRoundRow[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getKitchenSummary(date)
      if (res?.ok) {
        setBatches(res.batches || [])
        setSummary(res.summary ?? { pending_orders: 0, ready_orders: 0 })
      }
      const activeRounds = await listRoundsForDate(date)
      setRounds(activeRounds)
    } catch (e) {
      console.error('[AdminKitchen] Load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { void load() }, [load])

  async function handleCreateBatch() {
    if (!selectedRoundId) {
      showToast('กรุาเลือกรอบจัดส่ง', 'error')
      return
    }
    setCreating(true)
    try {
      const result: any = await createBatch(selectedRoundId, date, undefined)
      if (result && result.batch_id) {
        showToast('สร้าง Batch สำเรจ (#' + result.batch_id.slice(5, 12) + ')', 'success')
        writeAuditLog({ action: 'order_create', entity_type: 'production_batch', description: 'Created batch ' + result.batch_id + ' for round ' + selectedRoundId })
        await load()
      } else {
        showToast('ไม่สามารถสร้าง Batch ได้ กรุาลองใหม่', 'error')
      }
    } catch (e) {
      console.error('[AdminKitchen] Create batch failed:', e)
      showToast('เกิดข้อผิดพลาด', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-brand-accent">🍳 ครัว / Production</h1>
        <div className="flex gap-2 items-center">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input text-sm" />
          <button onClick={() => { void load() }} className="btn btn-outline text-sm" disabled={loading}>รีเฟรช</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card bg-orange-50 border-2 border-orange-200">
          <h3 className="font-bold text-brand-accent">📦 ออเดอรรอทำ</h3>
          <p className="text-4xl font-bold text-brand-primary mt-2">{summary.pending_orders}</p>
        </div>
        <div className="card bg-green-50 border-2 border-green-200">
          <h3 className="font-bold text-brand-accent">✅ พร้อมส่ง</h3>
          <p className="text-4xl font-bold text-green-600 mt-2">{summary.ready_orders}</p>
        </div>
        <div className="card bg-blue-50 border-2 border-blue-200">
          <h3 className="font-bold text-brand-accent">🔄 Batch ทั้งหมด</h3>
          <p className="text-4xl font-bold text-blue-600 mt-2">{batches.length}</p>
        </div>
      </div>

      {/* Create Batch Panel */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">➕ สร้าง Production Batch ใหม่</h3>
        <div className="flex gap-3 flex-wrap">
          <select value={selectedRoundId} onChange={(e) => setSelectedRoundId(e.target.value)} className="input flex-1 min-w-[200px]">
            <option value="">— เลือก รอบจัดส่ง —</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>{r.display_name} ({r.current_count}/{r.max_capacity})</option>
            ))}
          </select>
          <button onClick={handleCreateBatch} disabled={creating || !selectedRoundId} className="btn btn-primary disabled:opacity-50">
            {creating ? '⏳ กำลังสร้าง...' : '🔥 สร้าง Batch'}
          </button>
        </div>
        <p className="text-xs text-brand-muted mt-2">Batch จะรวบรวมออเดอรที่ confirmed/preparing ของรอบนี้</p>
      </div>

      {/* Batches Table */}
      {loading ? (
        <div className="card text-center py-8"><p className="text-brand-muted">กำลังหลด...</p></div>
      ) : batches.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">🍽️</div>
          <p className="text-brand-muted">ยังไม่มี Batch สำหรับวันที่เลือก</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-brand-bg">
              <tr>
                <th className="p-3">Batch ID</th>
                <th className="p-3">สถานะ</th>
                <th className="p-3">รายการทั้งหมด</th>
                <th className="p-3">พร้อมส่ง</th>
                <th className="p-3">รอดำเนินการ</th>
                <th className="p-3">สร้างเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.batch_id} className="border-b border-brand-border hover:bg-brand-bg">
                  <td className="p-3 font-mono text-sm">{String(b.batch_id).slice(5, 15)}</td>
                  <td className="p-3">
                    <span className={'badge ' + (b.status === 'ready' ? 'badge-success' : b.status === 'in_progress' ? 'badge-warning' : 'badge-info')}>{b.status}</span>
                  </td>
                  <td className="p-3 font-bold">{b.total_items}</td>
                  <td className="p-3 text-green-600 font-bold">{b.ready_items}</td>
                  <td className="p-3 text-orange-600 font-bold">{b.pending_items}</td>
                  <td className="p-3 text-xs text-brand-muted">{new Date(b.created_at).toLocaleString('th-TH')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

