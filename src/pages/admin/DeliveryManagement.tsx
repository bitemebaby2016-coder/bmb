// ============================================
// Bite Me Baby — Admin Delivery / Dispatch board (STEP 3B-2D)
// ============================================
// CANONICAL ONLY. The backend/database is the sole authority:
//   - driver list        → RPC list_drivers (037, is_admin)
//   - order assignment   → RPC assign_driver (020; admin-only, deterministic
//     ON CONFLICT reassignment, server-side audit) — NO client-side optimizer,
//     NO direct UPDATE of orders/drivers/delivery_assignments/tracking.
//   - assignments/orders → table reads scoped by RLS (041)
//   - dispatch hop       → transition_order_status (008/019/030) via
//     updateOrderStatus — never a direct status write.
// The old client-side "route optimizer assignment" + external-provider mock UI
// were removed (they manufactured dispatch state without backend authority).
// External rider providers (Grab/Lineman/Foodpanda) remain FROZEN — not shown,
// not implemented.
// NO cost/supplier/inventory fields are displayed here.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getOrdersByStatuses, getDeliveryAssignmentsFor, updateOrderStatus } from '@/lib/bmbAdminApi_orders'
import type { OrderForm, DeliveryAssignmentLiteRow } from '@/lib/bmbAdminApi_orders'
import { adminListDrivers, assignDriver, adminAdvanceDelivery, type AdminDriverRow } from '@/lib/driverService'
import { showToast } from '@/components/ui/ToastContainer'

const ASSIGN_LABEL: Record<string, { label: string; cls: string }> = {
  assigned: { label: '📌 มอบหมายแล้ว', cls: 'badge-warning' },
  accepted: { label: '🙋 ไรเดอร์รับแล้ว', cls: 'badge-info' },
  picked_up: { label: '📦 รับของแล้ว', cls: 'badge-info' },
  in_transit: { label: '🛵 กำลังส่ง', cls: 'badge-info' },
  delivered: { label: '🏁 ส่งถึงแล้ว', cls: 'badge-success' },
  cancelled: { label: '⚠ ยกเลิก (exception)', cls: 'badge-danger' },
}

function assignmentBadge(status?: string | null): { label: string; cls: string } {
  if (!status) return { label: '📭 ยังไม่มอบหมาย', cls: 'badge-primary' }
  return ASSIGN_LABEL[status] ?? { label: status, cls: 'badge-primary' }
}

export function DeliveryManagement() {
  const [orders, setOrders] = useState<OrderForm[]>([])
  const [drivers, setDrivers] = useState<AdminDriverRow[]>([])
  const [assignments, setAssignments] = useState<DeliveryAssignmentLiteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, string>>({}) // order_number -> driver_id
  // รูปสถานที่จัดส่งของลูกค้า ( customers.delivery_photo_url ) — ช่วยไรเดอร์หาบ้านเจอ
  const [photoByUser, setPhotoByUser] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dispatchOrders, drv] = await Promise.all([
        getOrdersByStatuses(['ready_for_dispatch', 'dispatched', 'in_transit', 'arrived', 'delivered']),
        adminListDrivers(),
      ])
      setOrders(dispatchOrders)
      setDrivers(drv.drivers)
      // assignments are read AFTER we know the order numbers (scoped read, 041 RLS)
      setAssignments(await getDeliveryAssignmentsFor(dispatchOrders.map((o) => o.order_number)))
    } catch (e) {
      console.error('[DeliveryManagement] load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // โหลดรูปสถานที่จัดส่งของลูกค้าในคิว (READ-ONLY) — customers RLS เปิดให้ is_admin
  useEffect(() => {
    const refs = Array.from(new Set(orders.map((o) => o.customer_ref).filter(Boolean))) as string[]
    if (refs.length === 0) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('customers')
        .select('user_id, delivery_photo_url')
        .in('user_id', refs)
      if (cancelled || !data) return
      const map: Record<string, string> = {}
      for (const row of data) {
        if (row.user_id && row.delivery_photo_url) map[row.user_id] = row.delivery_photo_url
      }
      setPhotoByUser(map)
    })()
    return () => { cancelled = true }
  }, [orders])

  // Canonical assignment: UI → assign_driver RPC → backend validation → DB → audit
  async function handleAssign(orderNumber: string) {
    const driverId = pending[orderNumber]
    if (!driverId) { showToast('เลือกไรเดอร์ก่อน', 'error'); return }
    setActing(orderNumber)
    try {
      const ok = await assignDriver(orderNumber, driverId)
      if (ok) {
        showToast('✅ มอบหมายสำเร็จ: ' + orderNumber, 'success')
        setPending((p) => { const n = { ...p }; delete n[orderNumber]; return n })
        await load()
      } else showToast('มอบหมายไม่สำเร็จ (server ปฏิเสธ)', 'error')
    } finally { setActing(null) }
  }

  // Canonical admin hop: ready_for_dispatch → dispatched via transition RPC
  async function handleDispatch(orderNumber: string) {
    setActing(orderNumber)
    try {
      const res: any = await updateOrderStatus(orderNumber, 'dispatched')
      if (res && res.status === 'dispatched') { showToast('🚚 Dispatch สำเร็จ: ' + orderNumber, 'success'); await load() }
      else showToast('Dispatch ไม่สำเร็จ (server ปฏิเสธ)', 'error')
    } catch (e: any) {
      showToast('ผิดพลาด: ' + String(e?.message || e).slice(0, 80), 'error')
    } finally { setActing(null) }
  }

  // GAP A-1 (m116): close the loop in one call — the RPC walks every hop to the
  // target with the same forward-only rules as the rider PWA, so the admin can
  // never invent a state the order machine rejects.
  async function handleAdminAdvance(orderNumber: string) {
    setActing(orderNumber)
    try {
      const r = await adminAdvanceDelivery(orderNumber, 'delivered')
      if (r.ok) {
        showToast('🏁 Admin ปิดวงจรสำเร็จ: ' + orderNumber + ' → ' + (r.order_status || 'delivered') + (r.driver_released ? ' (ปล่อยไรเดอร์กลับ available)' : ''), 'success')
        await load()
      } else {
        showToast('Admin advance ไม่สำเร็จ: ' + String(r.error || 'ERR_ADVANCE_REJECTED').slice(0, 80), 'error')
      }
    } catch (e: any) {
      showToast('ผิดพลาด: ' + String(e?.message || e).slice(0, 80), 'error')
    } finally { setActing(null) }
  }

  const driverName = (id?: string | null) => drivers.find((d) => d.id === id)?.driver_name || (id ? String(id).slice(0, 14) : null)
  const readyQ = orders.filter((o) => o.status === 'ready_for_dispatch')
  const enroute = orders.filter((o) => ['dispatched', 'in_transit', 'arrived', 'delivered'].includes(o.status))
  const asgFor = (n: string) => assignments.find((a) => a.order_number === n)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-brand-accent">🛵 Dispatch / ไรเดอร์ (Bite Drive)</h1>
        <div className="flex gap-2">
          <button onClick={() => { void load() }} className="btn btn-outline text-sm" disabled={loading}>รีเฟรช</button>
          <Link to="/admin" className="btn btn-outline">← กลับแดชบอร์ด</Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card bg-orange-50 border-2 border-orange-200"><h3 className="font-bold text-brand-accent">📦 รอมอบหมาย</h3><p className="text-3xl font-bold mt-2">{readyQ.filter((o) => !asgFor(o.order_number)).length}</p></div>
        <div className="card bg-blue-50 border-2 border-blue-200"><h3 className="font-bold text-brand-accent">✅ พร้อมส่งทั้งหมด</h3><p className="text-3xl font-bold mt-2">{readyQ.length}</p></div>
        <div className="card bg-green-50 border-2 border-green-200"><h3 className="font-bold text-brand-accent">🛵 บนถนน</h3><p className="text-3xl font-bold mt-2">{enroute.filter((o) => o.status !== 'delivered').length}</p></div>
        <div className="card bg-purple-50 border-2 border-purple-200"><h3 className="font-bold text-brand-accent">👨‍✈️ ไรเดอร์พร้อม</h3><p className="text-3xl font-bold mt-2">{drivers.filter((d) => d.status === 'available').length}</p></div>
      </div>

      {/* Drivers status — display only (availability is backend authority) */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">👨‍✈️ สถานะไรเดอร์ (list_drivers)</h3>
        {drivers.length === 0 ? <p className="text-brand-muted text-sm">ไม่มีไรเดอร์ในระบบ</p> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {drivers.map((d) => (
              <div key={d.id} className={'p-3 rounded-lg border-2 ' + (d.status === 'available' ? 'border-green-300 bg-green-50' : d.status === 'busy' ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-gray-50')}>
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold">{d.driver_name}</div>
                  <span className={'badge ' + (d.status === 'available' ? 'badge-success' : d.status === 'busy' ? 'badge-primary' : 'badge-muted')}>{d.status}</span>
                </div>
                <div className="text-xs text-brand-muted">งานค้าง: {d.active_assignments} · ล่าสุด: {d.last_active ? new Date(d.last_active).toLocaleString('th-TH') : '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispatch queue */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">📦 คิว Dispatch — พร้อมส่ง ({readyQ.length})</h3>
        {loading ? <p className="text-brand-muted text-sm">กำลังโหลด…</p> : readyQ.length === 0 ? <p className="text-brand-muted text-sm py-4 text-center">ไม่มีออเดอร์รอ dispatch</p> : (
          <div className="space-y-3">
            {readyQ.map((o) => {
              const a = asgFor(o.order_number)
              const ab = assignmentBadge(a?.status)
              return (
                <div key={o.order_number} className="border border-brand-border rounded-lg p-3 bg-brand-bg/50">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold">{o.order_number}</span>
                      <span className={'badge ' + ab.cls}>{ab.label}</span>
                      {a?.driver_id ? <span className="badge badge-info">👤 {driverName(a.driver_id)}</span> : null}
                      {o.order_mode ? <span className="badge badge-primary">{o.order_mode}</span> : null}
                      {o.payment_status ? <span className={'badge ' + (o.payment_status === 'paid' ? 'badge-success' : 'badge-warning')}>{o.payment_status}</span> : null}
                    </div>
                    <span className="text-xs text-brand-muted flex items-center gap-1">
                      {o.customer_ref && photoByUser[o.customer_ref] ? (
                        <a href={photoByUser[o.customer_ref]} target="_blank" rel="noreferrer" title="ดูรูปสถานที่จัดส่ง">
                          <img src={photoByUser[o.customer_ref]} alt="รูปสถานที่จัดส่ง" className="w-9 h-9 object-cover rounded border border-brand-border" />
                        </a>
                      ) : null}
                      📍 {o.delivery_address || '—'}
                    </span>
                  </div>
                  {/* exception visibility: order not dispatchable but assignment active */}
                  {!['ready_for_dispatch', 'dispatched'].includes(o.status) ? <p className="text-xs text-red-500 mt-2">⚠ สถานะออเดอร์ = {o.status} (ไม่อยู่ในช่วง dispatch)</p> : null}
                  <div className="mt-3 flex gap-2 flex-wrap items-center">
                    <select value={pending[o.order_number] || ''} onChange={(e) => setPending((p) => ({ ...p, [o.order_number]: e.target.value }))} className="input text-sm w-auto">
                      <option value="">— เลือกไรเดอร์ —</option>
                      {drivers.map((d) => <option key={d.id} value={d.id}>{d.driver_name} ({d.status})</option>)}
                    </select>
                    <button onClick={() => { void handleAssign(o.order_number) }} disabled={acting === o.order_number || !pending[o.order_number]} className="btn btn-primary text-sm disabled:opacity-50">
                      {acting === o.order_number ? '⏳…' : '📌 มอบหมาย (assign_driver)'}
                    </button>
                    <button onClick={() => { void handleDispatch(o.order_number) }} disabled={acting === o.order_number} className="btn btn-outline text-sm disabled:opacity-50">
                      🚚 Dispatch (transition)
                    </button>
                    {/* GAP A-1 (m116): admin close-the-loop override — same forward-only
                        hops as the rider PWA, audit-tagged 'admin_advance_delivery_status'. */}
                    {a?.status && ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived'].includes(a.status) ? (
                      <button
                        onClick={() => { void handleAdminAdvance(o.order_number) }}
                        disabled={acting === o.order_number}
                        className="btn btn-outline text-sm disabled:opacity-50"
                        data-testid={`admin-advance-${o.order_number}`}
                        title="ปิดวงจรแทนไรเดอร์ (geolocation/POD ของไรเดอร์ถูกข้าม — บันทึก audit ว่าเป็นฝีมือแอดมิน)"
                      >
                        🏁 แอดมินปิดวงจร (admin_advance)
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* En-route */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4">🛵 กำลังเดินทาง / ส่งแล้ว ({enroute.length})</h3>
        {enroute.length === 0 ? <p className="text-brand-muted text-sm">ยังไม่มีออเดอร์บนถนน</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-bg"><tr><th className="p-2">ออเดอร์</th><th className="p-2">สถานะ</th><th className="p-2">ไรเดอร์</th><th className="p-2">assignment</th></tr></thead>
              <tbody>
                {enroute.map((o) => {
                  const a = asgFor(o.order_number)
                  const ab = assignmentBadge(a?.status)
                  return (
                    <tr key={o.order_number} className="border-b border-brand-border">
                      <td className="p-2 font-mono">{o.order_number}</td>
                      <td className="p-2">{o.status}</td>
                      <td className="p-2">{a?.driver_id ? driverName(a.driver_id) : '—'}</td>
                      <td className="p-2"><span className={'badge ' + ab.cls}>{ab.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
