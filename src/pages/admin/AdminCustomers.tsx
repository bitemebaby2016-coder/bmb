// ============================================
// Admin — ลูกค้า (เชื่อมฐานข้อมูลจริง)
// ============================================
// แอดมินดูรายชื่อลูกค้าพร้อมสถิติ และลบรายการทดสอบ/รายการที่ไม่ต้องการได้เอง
// การลบใช้สิทธิ์แอดมินผ่านระบบสิทธิ์ของฐานข้อมูล — รายการที่มีประวัติออเดอร์
// จะลบไม่ได้เพื่อรักษาประวัติการเงิน (ระบบแจ้งเหตุผลตามจริง)

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCustomersWithStats, type CustomerWithStats } from '@/lib/bmbAdminApi_customers'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/components/ui/ToastContainer'

export function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setCustomers(await getCustomersWithStats())
    setLoading(false)
  }

  async function handleDelete(c: CustomerWithStats) {
    const name = c.full_name || c.phone || c.email || 'ลูกค้าท่านนี้'
    if (!window.confirm(`ลบ "${name}" ออกจากระบบ?\n\n• ลูกค้าที่มีประวัติออเดอร์จะลบไม่ได้ (เพื่อรักษาประวัติการเงิน)\n• การลบไม่สามารถเรียกคืนได้`)) return
    setDeleting(c.id)
    const { error } = await supabase.from('customers').delete().eq('id', c.id)
    setDeleting(null)
    if (error) {
      if (String(error.code || '') === '23503' || String(error.message).includes('violates foreign key')) {
        showToast('ลบไม่ได้ — ลูกค้าท่านนี้มีประวัติออเดอร์ในระบบ (เก็บไว้เพื่อความถูกต้องของบัญชี)', 'error')
      } else {
        showToast(`ลบไม่สำเร็จ: ${error.message}`, 'error')
      }
      return
    }
    showToast('ลบลูกค้าออกจากระบบแล้ว', 'success')
    void load()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">👥 ลูกค้า</h1>
        <Link to="/admin" className="btn btn-outline">← กลับหน้าภาพรวม</Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-surface">
              <th className="text-left px-3 py-2">ชื่อ</th>
              <th className="text-left px-3 py-2">เบอร์โทร</th>
              <th className="text-left px-3 py-2">อีเมล</th>
              <th className="text-right px-3 py-2">ออเดอร์</th>
              <th className="text-right px-3 py-2">ยอดใช้จ่าย</th>
              <th className="text-right px-3 py-2">แต้มสะสม</th>
              <th className="text-right px-3 py-2">ออเดอร์ล่าสุด</th>
              <th className="text-right px-3 py-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-brand-border">
                <td className="px-3 py-2 font-medium">{c.full_name}</td>
                <td className="px-3 py-2">{c.phone || '—'}</td>
                <td className="px-3 py-2 text-brand-muted">{c.email || '—'}</td>
                <td className="px-3 py-2 text-right">{c.order_count || 0}</td>
                <td className="px-3 py-2 text-right">฿{(c.order_total || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{c.loyalty_points || 0}</td>
                <td className="px-3 py-2 text-right text-brand-muted">
                  {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => void handleDelete(c)}
                    disabled={deleting === c.id}
                    className="btn btn-danger text-xs disabled:opacity-50"
                  >
                    {deleting === c.id ? 'กำลังลบ…' : '🗑 ลบ'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && <div className="text-center py-12 text-brand-muted">กำลังโหลดรายชื่อลูกค้า…</div>}
      {!loading && customers.length === 0 && (
        <div className="text-center py-12 text-brand-muted">ยังไม่มีลูกค้าในระบบค่ะ</div>
      )}
    </div>
  )
}