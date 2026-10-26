// ============================================
// Admin — ลูกค้า (เชื่อมฐานข้อมูลจริง + CAP-21 เจาะกลุ่มอัตโนมัติ)
// ============================================
// แอดมินดูรายชื่อลูกค้าพร้อมสถิติ และลบรายการทดสอบ/รายการที่ไม่ต้องการได้เอง
// การลบใช้สิทธิ์แอดมินผ่านระบบสิทธิ์ของฐานข้อมูล — รายการที่มีประวัติออเดอร์
// จะลบไม่ได้เพื่อรักษาประวัติการเงิน (ระบบแจ้งเหตุผลตามจริง)
//
// CAP-21 (Owner 2026-10-26 + audit D11): "ต้องทำเป็นอัตโนมัติ ไม่ต้องมากำหนดโดยแอดมิน"
//  → กลุ่มลูกค้า/คำสรุปถูก "คำนวณ" จากสถิติออเดอร์จริงทุกครั้งที่โหลดหน้า
//  → ไม่มีช่องกรอกเกณฑ์ ไม่มีปุ่มบันทึกกลุ่ม ไม่มี localStorage (ดู src/lib/customerIntelligence.ts)

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCustomersWithStats, deleteCustomer, type CustomerWithStats } from '@/lib/bmbAdminApi_customers'
import {
  deriveCustomerInsight,
  segmentTally,
  segmentLabelTh,
  type CustomerInsight,
} from '@/lib/customerIntelligence'
import { showToast } from '@/components/ui/ToastContainer'

export function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [insights, setInsights] = useState<Record<string, CustomerInsight>>({})
  const [tally, setTally] = useState<ReturnType<typeof segmentTally> | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const rows = await getCustomersWithStats()
    // อัตโนมัติ: คำนวณกลุ่ม+คำสรุปจากสถิติที่เพิ่งดึงมา (ไม่มี input จากแอดมิน)
    const now = Date.now()
    const map: Record<string, CustomerInsight> = {}
    for (const c of rows) map[c.id] = deriveCustomerInsight(c, { now })
    setInsights(map)
    setTally(segmentTally(Object.values(map)))
    setCustomers(rows)
    setLoading(false)
  }

  async function handleDelete(c: CustomerWithStats) {
    const name = c.full_name || c.phone || c.email || 'ลูกค้าท่านนี้'
    if (!window.confirm(`ลบ "${name}" ออกจากระบบ?\n\n• ลูกค้าที่มีประวัติออเดอร์จะลบไม่ได้ (เพื่อรักษาประวัติการเงิน)\n• การลบไม่สามารถเรียกคืนได้`)) return
    setDeleting(c.id)
    // D13: ลบผ่าน lib (ไม่ยิง supabase ตรง) — เหตุผลจริงมาจาก error code ของ DB
    const res = await deleteCustomer(c.id)
    setDeleting(null)
    if (!res.ok) {
      if (res.code === '23503' || String(res.message || '').includes('violates foreign key')) {
        showToast('ลบไม่ได้ — ลูกค้าท่านนี้มีประวัติออเดอร์ในระบบ (เก็บไว้เพื่อความถูกต้องของบัญชี)', 'error')
      } else {
        showToast(`ลบไม่สำเร็จ: ${res.message || 'unknown error'}`, 'error')
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

      {/* CAP-21: แถบสรุปกลุ่มลูกค้า — คำนวณอัตโนมัติจากสถิติจริงทุกครั้งที่เปิดหน้า (ไม่มีการตั้งค่า) */}
      {tally && !loading && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs" data-testid="customer-segment-tally">
          {(Object.entries(tally) as Array<[keyof ReturnType<typeof segmentTally>, number]>)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => (
              <span key={k} className="badge">
                {segmentLabelTh(k)} · {n}
              </span>
            ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-surface">
              <th className="text-left px-3 py-2">ชื่อ</th>
              <th className="text-left px-3 py-2">เบอร์โทร</th>
              <th className="text-left px-3 py-2">อีเมล</th>
              <th className="text-left px-3 py-2">กลุ่ม/คำสรุป (อัตโนมัติ)</th>
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
                <td className="px-3 py-2" data-testid={`customer-insight-${c.id}`}>
                  <div className="flex flex-wrap gap-1">
                    {(insights[c.id]?.segments ?? []).map((s) => (
                      <span key={s} className="badge text-[10px]">{segmentLabelTh(s)}</span>
                    ))}
                    {(insights[c.id]?.segments ?? []).length === 0 && <span className="text-brand-muted">—</span>}
                  </div>
                  <p className="text-xs text-brand-muted mt-0.5">{insights[c.id]?.summary}</p>
                </td>
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