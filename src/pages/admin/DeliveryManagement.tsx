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

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getOrdersByStatuses, getDeliveryAssignmentsFor } from '@/lib/bmbAdminApi_orders'
import { resolveOrderDeliveryAddress } from '@/lib/orderAddress'
import type { OrderForm, DeliveryAssignmentLiteRow } from '@/lib/bmbAdminApi_orders'
import { adminListDrivers, assignDriver, adminAdvanceDelivery, upsertDriver, linkDriverUser, getDriverAccounts, driverErrorText, adminCancelAssignment, getPodSignedUrl, dispatchOrder, adminCancelOffer, getRouteHistory, type RoutePoint, type AdminDriverRow, type DriverAccountRow } from '@/lib/driverService'
import { AdminLiveMap } from '@/components/admin/AdminLiveMap'
import { getUsers, type User } from '@/lib/bmbAdminApi_users'
import { showToast } from '@/components/ui/ToastContainer'
import { useNotificationStore } from '@/store/notificationStore'
// R21d backlog: โหลดคิว dispatch ไม่สำเร็จต้องฟ้อง (ห้ามโชว์ "ไม่มีออเดอร์รอ dispatch" ปลอม)
import { LoadErrorBanner } from '@/components/ui/LoadErrorBanner'

const ASSIGN_LABEL: Record<string, { label: string; cls: string }> = {
  assigned: { label: '📌 มอบหมายแล้ว', cls: 'badge-warning' },
  accepted: { label: '🙋 ไรเดอร์รับแล้ว', cls: 'badge-info' },
  picked_up: { label: '📦 รับของแล้ว', cls: 'badge-info' },
  in_transit: { label: '🛵 กำลังส่ง', cls: 'badge-info' },
  delivered: { label: '🏁 ส่งถึงแล้ว', cls: 'badge-success' },
  declined: { label: '🚫 ไรเดอร์ปฏิเสธ', cls: 'badge-warning' },
  cancelled: { label: '⚠ ยกเลิก (exception)', cls: 'badge-danger' },
}

function assignmentBadge(status?: string | null): { label: string; cls: string } {
  if (!status) return { label: '📭 ยังไม่มอบหมาย', cls: 'badge-primary' }
  return ASSIGN_LABEL[status] ?? { label: status, cls: 'badge-primary' }
}

export function DeliveryManagement() {
  // M4: deep-link จาก AdminOrders (?focus=ORDERNO) — ไฮไลต์การ์ดออเดอร์ที่เลือกมา
  const [searchParams] = useSearchParams()
  const focusOrder = searchParams.get('focus')
  const [orders, setOrders] = useState<OrderForm[]>([])
  const [drivers, setDrivers] = useState<AdminDriverRow[]>([])
  const [assignments, setAssignments] = useState<DeliveryAssignmentLiteRow[]>([])
  // E1: สถานะประกาศ (dispatch_offers) ต่อออเดอร์ — 'offered' = รอไรเดอร์รับ / 'claimed' = มีคนจองแล้ว
  const [offerByOrder, setOfferByOrder] = useState<Record<string, { status: string; claimed_by_driver_id: string | null }>>({})
  const [loading, setLoading] = useState(true)
  // R21d: โหลดล้มเหลว ≠ คิวว่าง (เฉพาะโหลดแรก — refresh เงียบล้มเหลวไม่ต้องปล่อย banner ทับข้อมูลเดิม)
  const [loadError, setLoadError] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, string>>({}) // order_number -> driver_id
  // รูปสถานที่จัดส่งของลูกค้า (Owner feature 2026-10-08) — user_id -> photo URL
  const [photoByUser, setPhotoByUser] = useState<Record<string, string>>({})
  // Provision ไรเดอร์ (Owner Decision 06 / F-06) — Admin สร้าง driver + ผูกบัญชี login เอง
  const [accounts, setAccounts] = useState<DriverAccountRow[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [provName, setProvName] = useState('')
  const [provPhone, setProvPhone] = useState('')
  const [provVehicle, setProvVehicle] = useState('')
  const [linkPick, setLinkPick] = useState<Record<string, string>>({}) // driver_id -> user_id
  const [provisioning, setProvisioning] = useState<string | null>(null)
  // Owner 2026-10-19: ลงทะเบียนไรเดอร์แบบ dropdown — เลือกจากคนที่ลงทะเบียนบนเว็บแล้ว
  // (ไม่ต้องพิมพ์ชื่อ/เบอร์ใหม่) + เลือกพาหนะจาก dropdown
  const [regUsers, setRegUsers] = useState<{ id: string; name: string | null; phone: string | null; email: string | null }[]>([])
  const [provPick, setProvPick] = useState('')
  const [provVehicleOther, setProvVehicleOther] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setLoadError('') }
    try {
      // Owner 2026-10-20: คิวมอบหมายต้องเห็นออเดอร์ที่ "จ่ายแล้ว" ทันที (confirmed/
      // preparing) — assign_driver รองรับอยู่แล้ว (020/125) ไม่ต้องรอ ready_for_dispatch
      // ไรเดอร์จะเห็นงานทันทีที่มอบหมาย (my_deliveries) ไม่ต้องรอครัวปิดงาน
      const [dispatchOrders, drv, accts] = await Promise.all([
        getOrdersByStatuses(['confirmed', 'preparing', 'ready_for_dispatch', 'dispatched', 'in_transit', 'arrived', 'delivered']),
        adminListDrivers(),
        getDriverAccounts(),
      ])
      setOrders(dispatchOrders)
      setDrivers(drv.drivers)
      setAccounts(accts)
      // assignments are read AFTER we know the order numbers (scoped read, 041 RLS)
      const numbers = dispatchOrders.map((o) => o.order_number)
      setAssignments(await getDeliveryAssignmentsFor(numbers))
      // E1: สถานะประกาศของทุกออเดอร์ในคิว (dispatch_offers, admin RLS)
      const { data: offerRows } = await supabase
        .from('dispatch_offers')
        .select('order_number, status, claimed_by_driver_id')
        .in('order_number', numbers)
      const omap: Record<string, { status: string; claimed_by_driver_id: string | null }> = {}
      for (const row of (offerRows || []) as { order_number: string; status: string; claimed_by_driver_id: string | null }[]) {
        omap[row.order_number] = { status: row.status, claimed_by_driver_id: row.claimed_by_driver_id }
      }
      setOfferByOrder(omap)
    } catch (e) {
      console.error('[DeliveryManagement] load failed:', e)
      // R21d: โหลดแรกพัง = หน้าคิวเปล่าต้องฟ้อง ไม่ใช่โชว์ "ไม่มีออเดอร์รอ dispatch"
      if (!silent) setLoadError('โหลดคิว dispatch ไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // รายชื่อบัญชีผู้ใช้สำหรับผูกไรเดอร์ (public_profiles; READ-ONLY, admin RLS)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const list = await getUsers()
      if (!cancelled) setUsers(list)
    })()
    return () => { cancelled = true }
  }, [])

  // Owner 2026-10-19: รายชื่อผู้ใช้ที่ลงทะเบียนบนเว็บ (profiles — admin RLS) สำหรับ
  // dropdown ลงทะเบียนไรเดอร์ (ชื่อ+เบอร์ เติมให้เอง ไม่ต้องกรอกซ้ำ)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('profiles').select('id, name, phone, email, role')
      if (cancelled || !data) return
      setRegUsers(
        (data as { id: string; name: string | null; phone: string | null; email: string | null; role: string | null }[])
          .filter((u) => (u.role ?? 'customer') !== 'admin'),
      )
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => { void load() }, [load])

  // R15 (Owner 2026-10-28: "ปิดงานแล้วแต่หน้าจอไม่ปิดอัตโนมัติ"): auto-close ฝั่ง server
  // ทำงานจริงแล้ว (probe = order+assignment delivered · driver available · POD มีรูป) —
  // ที่ค้าง = หน้าโหลดข้อมูลครั้งเดียว → เพิ่ม (a) poll เงียบทุก 20 วิ (b) refetch เมื่อกลับมาที่แท็บ
  useEffect(() => {
    const t = window.setInterval(() => { void load(true) }, 20000)
    const onVis = () => { if (document.visibilityState === 'visible') void load(true) }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  // R15: แจ้งเตือน ?focus= → โหลดข้อมูลใหม่เสมอ + เลื่อนแถวมารับสายกลางจอ (ครั้งเดียวต่อ focus)
  const scrolledFocusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!focusOrder) return
    void load(true)
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-focus-row="${focusOrder}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        scrolledFocusRef.current = focusOrder
      }
      // แถวยังไม่มา (โหลดไม่เสร็จ) = ไม่ทำเครื่องหมาย → orders เปลี่ยนเมื่อไหร่ retry เอง
    }, 250)
    return () => window.clearTimeout(t)
  }, [focusOrder, load, orders])

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
      } else showToast('มอบหมายไม่สำเร็จ — ตรวจสอบสถานะออเดอร์และไรเดอร์แล้วลองใหม่', 'error')
    } finally { setActing(null) }
  }

  // E1 (2026-10-22) "ส่งออกงาน (Dispatch)" = ประกาศ+push แจ้งไรเดอร์ทุกคนที่ผูกบัญชี
  // (คนแรกรับ = จองงานคนเดียว — atomic claim) — ไม่ใช่แค่สลับสถานะออเดอร์แบบเดิม
  // (A4 เดิม: กด dispatch แล้วลูกค้าเปลี่ยน แต่ไรเดอร์รับงานไม่ได้)
  async function handleAnnounce(orderNumber: string) {
    setActing(orderNumber)
    try {
      const r = await dispatchOrder(orderNumber)
      if (r.ok) {
        showToast('📣 ส่งออกงาน ' + orderNumber + ' แล้ว — ประกาศ+แจ้งไรเดอร์ทุกคน คนแรกรับได้งาน', 'success')
        await load()
      } else {
        showToast('ส่งออกงานไม่สำเร็จ: ' + driverErrorText(r.error), 'error')
      }
    } catch (e: any) {
      showToast('ส่งออกงานไม่สำเร็จ: ' + driverErrorText(e?.message || e), 'error')
    } finally { setActing(null) }
  }

  // E1: แอดมินยกเลิกประกาศ (งานกลับสู่การมอบหมายปกติ — เลือกไรเดอร์เอง)
  async function handleCancelOffer(orderNumber: string) {
    const reason = window.prompt('เหตุผลที่ยกเลิกประกาศ (บันทึกลง audit):', '') ?? ''
    setActing(orderNumber)
    try {
      const r = await adminCancelOffer(orderNumber, reason)
      if (r.ok) {
        showToast('🔕 ยกเลิกประกาศ ' + orderNumber + ' แล้ว — มอบหมายเองได้จากคิวนี้', 'success')
        await load()
      } else {
        showToast('ยกเลิกประกาศไม่สำเร็จ: ' + driverErrorText(r.error), 'error')
      }
    } catch (e: any) {
      showToast('ยกเลิกประกาศไม่สำเร็จ: ' + driverErrorText(e?.message || e), 'error')
    } finally { setActing(null) }
  }

  // GAP A-1 (m116): close the loop in one call — the RPC walks every hop to the
  // target with the same forward-only rules as the rider PWA, so the admin can
  // never invent a state the order machine rejects.
  // A4: แอดมินยกเลิกงานค้าง (เก็บประวัติไว้ — ไม่ลบ assignment; audit บันทึก actor+เหตุผล)
  async function handleCancelAssignment(orderNumber: string) {
    const reason = window.prompt('เหตุผลที่ยกเลิกงานนี้ (บันทึกลง audit):', '') ?? ''
    setActing(orderNumber)
    try {
      const r = await adminCancelAssignment(orderNumber, reason)
      if (r.ok) {
        showToast('⛔ ยกเลิกงาน ' + orderNumber + ' แล้ว (มอบหมายใหม่ได้)', 'success')
        await load()
      } else {
        showToast('ยกเลิกงานไม่สำเร็จ: ' + driverErrorText(r.error || 'ERR_ASSIGNMENT_CLOSED'), 'error')
      }
    } catch (e: any) {
      showToast('ยกเลิกงานไม่สำเร็จ: ' + driverErrorText(e?.message || e), 'error')
    } finally { setActing(null) }
  }

  // E3 (2026-10-22): แผนที่ live + ประวัติเส้นทาง — GPS จริงจาก heartbeat ไรเดอร์ (136)
  const [routeFor, setRouteFor] = useState<string | null>(null)
  const [routePoints, setRoutePoints] = useState<RoutePoint[] | null>(null)
  async function loadRoute(orderNumber: string) {
    setRouteFor(orderNumber)
    setRoutePoints(await getRouteHistory(orderNumber))
  }
  // รีเฟรชตำแหน่งไรเดอร์ทุก 20 วิ (เฉพาะ drivers — เบา) ระหว่างเปิดหน้านี้
  useEffect(() => {
    const t = window.setInterval(() => {
      void adminListDrivers().then((r) => { if (r.ok) setDrivers(r.drivers) })
    }, 20_000)
    return () => window.clearInterval(t)
  }, [])

  // A3: signed URL ของรูป POD (bucket ส่วนตัว) — cache ต่อ path ไม่ยิงซ้ำตอน render
  const podUrlCache = useRef<Record<string, string>>({})
  const [podUrls, setPodUrls] = useState<Record<string, string>>({})
  function podUrlOf(path?: string | null): string | null {
    if (!path) return null
    const hit = podUrlCache.current[path] || podUrls[path]
    if (hit) return hit
    void getPodSignedUrl(path).then((url) => {
      if (url) {
        podUrlCache.current[path] = url
        setPodUrls((p) => ({ ...p, [path]: url }))
      }
    })
    return null
  }

  async function handleAdminAdvance(orderNumber: string) {
    setActing(orderNumber)
    try {
      const r = await adminAdvanceDelivery(orderNumber, 'delivered')
      if (r.ok) {
        showToast('🏁 Admin ปิดวงจรสำเร็จ: ' + orderNumber + ' → ' + (r.order_status || 'delivered') + (r.driver_released ? ' (ปล่อยไรเดอร์กลับ available)' : ''), 'success')
        // M4: notification event ของสายส่งถูกยิงจากเจ้าของปุ่ม (ที่นี่)
        useNotificationStore.getState().triggerEvent('order_delivered', { orderNumber })
        await load()
      } else {
        showToast('เดินหน้าสถานะไม่สำเร็จ: ' + driverErrorText(r.error || 'ERR_ADVANCE_REJECTED'), 'error')
      }
    } catch (e: any) {
      showToast('เดินหน้าสถานะไม่สำเร็จ: ' + driverErrorText(e?.message || e), 'error')
    } finally { setActing(null) }
  }

  // ===== Provision ไรเดอร์ (Owner Decision 06 / F-06) — admin RPC เท่านั้น: upsert_driver / link_driver_user =====
  async function handleCreateDriver() {
    if (!provName.trim() || !provPhone.trim()) { showToast('เลือกผู้ใช้ที่ลงทะเบียนแล้ว หรือกรอกชื่อและเบอร์โทรก่อน', 'error'); return }
    const vehicleLabel = (provVehicle === 'อื่น ๆ' ? provVehicleOther : provVehicle).trim()
    setProvisioning('create')
    try {
      const r = await upsertDriver(provName.trim(), provPhone.trim(), vehicleLabel)
      if (r.ok) {
        showToast('✅ บันทึกไรเดอร์แล้ว (หากเบอร์ซ้ำ = อัปเดตข้อมูลเดิม)', 'success')
        setProvName(''); setProvPhone(''); setProvVehicle(''); setProvPick(''); setProvVehicleOther('')
        await load()
      } else {
        showToast('บันทึกไม่สำเร็จ: ' + driverErrorText(r.error || 'ERR_UPSERT_REJECTED'), 'error')
      }
    } catch (e: any) {
      showToast('บันทึกไม่สำเร็จ: ' + driverErrorText(e?.message || e), 'error')
    } finally { setProvisioning(null) }
  }

  async function handleLinkUser(driverId: string) {
    const userId = linkPick[driverId]
    if (!userId) { showToast('เลือกบัญชีผู้ใช้ก่อน', 'error'); return }
    setProvisioning('link:' + driverId)
    try {
      const r = await linkDriverUser(driverId, userId)
      if (r.ok) {
        showToast('✅ ผูกบัญชีเรียบร้อย — ไรเดอร์เข้าใช้งานที่หน้า ไรเดอร์ ได้แล้ว', 'success')
        setLinkPick((p) => { const n = { ...p }; delete n[driverId]; return n })
        await load()
      } else {
        showToast('ผูกบัญชีไม่สำเร็จ: ' + driverErrorText(r.error || 'ERR_LINK_REJECTED'), 'error')
      }
    } catch (e: any) {
      showToast('ผูกบัญชีไม่สำเร็จ: ' + driverErrorText(e?.message || e), 'error')
    } finally { setProvisioning(null) }
  }

  const driverName = (id?: string | null) => drivers.find((d) => d.id === id)?.driver_name || (id ? String(id).slice(0, 14) : null)
  // D-03 (R1.3, 2026-10-23): คิวมอบหมาย/ส่งออกต้องเห็นทุกสถานะที่ RPC รับจริง
  // (assign_driver 020:610 + dispatch_order/claim 135:104/166 รับ
  //  confirmed/preparing/ready_for_dispatch/dispatched) — เดิมกรองเฉพาะ
  //  ready_for_dispatch ทำให้ออเดอร์ที่จ่ายเงินแล้ว (confirmed/preparing)
  //  มองไม่เห็นในบอร์ด → มอบหมาย/ประกาศไม่ได้ (ตรงที่ Owner เจอ)
  const DISPATCHABLE = ['confirmed', 'preparing', 'ready_for_dispatch']
  const readyQ = orders.filter((o) => DISPATCHABLE.includes(o.status))
  const enroute = orders.filter((o) => ['dispatched', 'in_transit', 'arrived', 'delivered'].includes(o.status))
  const asgFor = (n: string) => assignments.find((a) => a.order_number === n)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-brand-accent">🛵 Dispatch / ไรเดอร์ (Bite Drive)</h1>
        <div className="flex gap-2">
          <button onClick={() => { void load() }} className="btn btn-outline text-sm" disabled={loading}>รีเฟรช</button>
          {/* ADDENDUM: ทางเข้า Rider PWA สำหรับแอดมินตรวจสอบระบบ — เปิดในแท็บใหม่
              ไม่ทำให้แอดมินกลายเป็นไรเดอร์ (หน้า /rider ตรวจ JWT→drivers.user_id ของตัวเอง) */}
          <a href="/rider" target="_blank" rel="noreferrer" className="btn btn-outline text-sm" data-testid="admin-open-rider">
            🛵 เปิดหน้าไรเดอร์
          </a>
          <Link to="/admin" className="btn btn-outline">← กลับแดชบอร์ด</Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card bg-orange-50 border-2 border-orange-200"><h3 className="font-bold text-brand-accent">📦 รอมอบหมาย</h3><p className="text-3xl font-bold mt-2">{readyQ.filter((o) => !asgFor(o.order_number)).length}</p></div>
        <div className="card bg-blue-50 border-2 border-blue-200"><h3 className="font-bold text-brand-accent">📋 คิวส่งออกทั้งหมด</h3><p className="text-3xl font-bold mt-2">{readyQ.length}</p></div>
        <div className="card bg-green-50 border-2 border-green-200"><h3 className="font-bold text-brand-accent">🛵 บนถนน</h3><p className="text-3xl font-bold mt-2">{enroute.filter((o) => o.status !== 'delivered').length}</p></div>
        <div className="card bg-purple-50 border-2 border-purple-200"><h3 className="font-bold text-brand-accent">👨‍✈️ ไรเดอร์พร้อม</h3><p className="text-3xl font-bold mt-2">{drivers.filter((d) => d.status === 'available').length}</p></div>
      </div>

      {/* Provision ไรเดอร์ (Owner Decision 06 / F-06) — upsert_driver + link_driver_user (admin RPC; ไม่มี self-signup) */}
      <div className="card mb-6" data-testid="driver-provision-panel">
        <h3 className="font-bold text-brand-accent mb-1">🧑‍✈️ จัดการไรเดอร์ (Provision)</h3>
        <p className="text-xs text-brand-muted mb-4">
          สร้าง/อัปเดตไรเดอร์ด้วย <code>upsert_driver</code> (คีย์ด้วยเบอร์โทร — เบอร์ซ้ำ = อัปเดตตัวเดิม) แล้วผูกบัญชี login ด้วย <code>link_driver_user</code>
          · บัญชีผู้ใช้ต้องมีใน Supabase Auth ก่อน (ลงทะเบียน/สร้างจาก dashboard) แล้วนำมาผูกที่นี่ — ไรเดอร์จะใช้ <code>/rider</code> ได้เฉพาะคนที่ผูกแล้ว (JWT)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
          {/* Owner 2026-10-19: dropdown เลือกจากผู้ใช้ที่ลงทะเบียนบนเว็บแล้ว — ไม่ต้องกรอกชื่อ/เบอร์ใหม่ */}
          <select
            className="input"
            value={provPick}
            onChange={(e) => {
              const id = e.target.value
              setProvPick(id)
              const u = regUsers.find((x) => x.id === id)
              if (u) { setProvName(u.name ?? ''); setProvPhone(u.phone ?? '') }
            }}
            data-testid="drv-prov-user-select"
          >
            <option value="">— เลือกผู้ใช้ที่ลงทะเบียนแล้ว (เติมชื่อ/เบอร์ให้อัตโนมัติ) —</option>
            {regUsers.map((u) => (
              <option key={u.id} value={u.id}>{(u.name || u.email || u.phone || u.id) + (u.phone ? ' · ' + u.phone : '')}</option>
            ))}
          </select>
          {/* Owner 2026-10-19: เลือกพาหนะจาก dropdown (ตรวพาหนะไรเดอร์) */}
          <select className="input" value={provVehicle} onChange={(e) => setProvVehicle(e.target.value)} data-testid="drv-prov-vehicle">
            <option value="">— เลือกพาหนะ —</option>
            <option value="มอเตอร์ไซค์">มอเตอร์ไซค์</option>
            <option value="รถยนต์">รถยนต์</option>
            <option value="จักรยาน">จักรยาน</option>
            <option value="อื่น ๆ">อื่น ๆ (กรอกเอง)</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input className="input" placeholder="ชื่อ-นามสกุล *" value={provName} onChange={(e) => setProvName(e.target.value)} data-testid="drv-prov-name" />
          <input className="input" placeholder="เบอร์โทร * (คีย์ยืนยันตัวตน)" value={provPhone} onChange={(e) => setProvPhone(e.target.value)} data-testid="drv-prov-phone" />
          {provVehicle === 'อื่น ๆ' ? (
            <input className="input" placeholder="ระบุพาหนะ" value={provVehicleOther} onChange={(e) => setProvVehicleOther(e.target.value)} data-testid="drv-prov-vehicle-other" />
          ) : (
            <div className="text-xs text-brand-muted self-center">เลือกผู้ใช้ด้านบนเพื่อเติมชื่อ/เบอร์อัตโนมัติ — ตรวจความถูกต้องก่อนบันทึก</div>
          )}
          <button onClick={() => { void handleCreateDriver() }} disabled={provisioning !== null} className="btn btn-primary disabled:opacity-50" data-testid="drv-prov-create">
            {provisioning === 'create' ? '⏳…' : '➕ บันทึกไรเดอร์'}
          </button>
        </div>
        {accounts.length === 0 ? <p className="text-brand-muted text-sm">ยังไม่มีไรเดอร์ในตาราง drivers</p> : (
          <div className="space-y-2">
            {accounts.map((a) => {
              const linkedUser = users.find((u) => u.id === a.user_id)
              const takenByOthers = new Set(accounts.filter((x) => x.id !== a.id && x.user_id).map((x) => x.user_id))
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-2 border border-brand-border rounded-lg p-2 bg-brand-bg/40">
                  <span className="font-bold text-sm w-40">{a.name}</span>
                  <span className={'badge ' + (a.user_id ? 'badge-success' : 'badge-warning')}>
                    {a.user_id ? '✅ ผูกบัญชีแล้ว' : '⚠ ยังไม่ผูกบัญชี'}
                  </span>
                  <span className="text-xs text-brand-muted">{a.user_id ? (linkedUser ? linkedUser.name || linkedUser.email || a.user_id : a.user_id) : '—'}</span>
                  <select
                    className="input text-sm w-auto"
                    value={linkPick[a.id] || ''}
                    onChange={(e) => setLinkPick((p) => ({ ...p, [a.id]: e.target.value }))}
                    data-testid={`drv-prov-link-select-${a.id}`}
                  >
                    <option value="">— เลือกบัญชีผู้ใช้ —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id} disabled={takenByOthers.has(u.id)}>
                        {(u.name || u.email || u.phone || u.id) + (takenByOthers.has(u.id) ? ' (ถูกผูกแล้ว)' : '')}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => { void handleLinkUser(a.id) }}
                    disabled={provisioning !== null || !linkPick[a.id]}
                    className="btn btn-outline text-sm disabled:opacity-50"
                    data-testid={`drv-prov-link-btn-${a.id}`}
                  >
                    {provisioning === 'link:' + a.id ? '⏳…' : '🔗 ผูกบัญชี (link_driver_user)'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
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

      {/* E3: แผนที่ live — ไรเดอร์วิ่งจริง (GPS heartbeat) + เส้นทางย้อนหลังที่เลือกดู */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-3">🗺️ ตำแหน่งไรเดอร์ (Live)</h3>
        <AdminLiveMap
          drivers={drivers.map((d) => ({
            id: d.id,
            name: d.driver_name ?? d.id,
            latitude: (d as { current_latitude?: number | null }).current_latitude ?? null,
            longitude: (d as { current_longitude?: number | null }).current_longitude ?? null,
            status: d.status,
          }))}
          route={routePoints}
        />
        {routeFor && (
          <p className="text-xs text-brand-muted mt-2">
            📍 กำลังแสดงเส้นทางย้อนหลังของ {routeFor} ({routePoints?.length ?? 0} จุด){' '}
            <button className="underline" onClick={() => { setRouteFor(null); setRoutePoints(null) }}>ปิดเส้นทาง</button>
          </p>
        )}
      </div>

      {/* Dispatch queue */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">📦 คิว Dispatch — มอบหมาย/ส่งออก ({readyQ.length})</h3>
        {loading ? <p className="text-brand-muted text-sm">กำลังโหลด…</p> : loadError ? (
          <div data-testid="dispatch-load-error" className="py-3">
            <LoadErrorBanner message={loadError} onRetry={() => { void load() }} />
          </div>
        ) : readyQ.length === 0 ? <p className="text-brand-muted text-sm py-4 text-center">ไม่มีออเดอร์รอ dispatch</p> : (
          <div className="space-y-3">
            {readyQ.map((o) => {
              const a = asgFor(o.order_number)
              const ab = assignmentBadge(a?.status)
              const offer = offerByOrder[o.order_number]
              return (
                <div key={o.order_number} data-focus-row={o.order_number} className={`border border-brand-border rounded-lg p-3 bg-brand-bg/50 ${focusOrder === o.order_number ? 'ring-2 ring-brand-primary' : ''}`}>
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
                      📍 {resolveOrderDeliveryAddress(o) || '—'}
                    </span>
                  </div>
                  {/* exception visibility: แจ้งเฉพาะสถานะที่อยู่นอกช่วง dispatch จริง ๆ —
                      confirmed/preparing อยู่ในคิวได้ตามสัญญา RPC (020:610 / 135:104) ห้ามเตือนมั่ว */}
                  {!['confirmed', 'preparing', 'ready_for_dispatch', 'dispatched'].includes(o.status) ? <p className="text-xs text-red-500 mt-2">⚠ สถานะออเดอร์ = {o.status} (ไม่อยู่ในช่วง dispatch)</p> : null}
                  <div className="mt-3 flex gap-2 flex-wrap items-center">
                    <select value={pending[o.order_number] || ''} onChange={(e) => setPending((p) => ({ ...p, [o.order_number]: e.target.value }))} className="input text-sm w-auto">
                      <option value="">— เลือกไรเดอร์ —</option>
                      {drivers.map((d) => <option key={d.id} value={d.id}>{d.driver_name} ({d.status})</option>)}
                    </select>
                    <button onClick={() => { void handleAssign(o.order_number) }} disabled={acting === o.order_number || !pending[o.order_number]} className="btn btn-primary text-sm disabled:opacity-50">
                      {acting === o.order_number ? '⏳…' : '📌 มอบหมาย (assign_driver)'}
                    </button>
                    {/* E1: ส่งออกงาน = ประกาศ+push ไรเดอร์ทุกคน (คนแรกรับ = จองงานคนเดียว) */}
                    <button
                      onClick={() => { void handleAnnounce(o.order_number) }}
                      disabled={acting === o.order_number}
                      className="btn btn-outline text-sm disabled:opacity-50"
                      data-testid={`dispatch-announce-${o.order_number}`}
                      title="ประกาศงาน + แจ้งเตือนไรเดอร์ทุกคนที่ผูกบัญชีแล้ว — คนแรกที่กดรับได้งานไป"
                    >
                      📣 ส่งออกงาน (ประกาศ+push ทุกคน)
                    </button>
                    {offer?.status === 'offered' && (
                      <>
                        <span className="badge badge-warning" data-testid={`offer-open-${o.order_number}`}>📣 ประกาศแล้ว — รอไรเดอร์รับ</span>
                        <button
                          onClick={() => { void handleCancelOffer(o.order_number) }}
                          disabled={acting === o.order_number}
                          className="btn btn-outline text-sm disabled:opacity-50"
                          data-testid={`offer-cancel-${o.order_number}`}
                        >
                          🔕 ยกเลิกประกาศ
                        </button>
                      </>
                    )}
                    {offer?.status === 'claimed' && (
                      <span className="badge badge-success" data-testid={`offer-claimed-${o.order_number}`}>
                        🙋 มีคนรับงานประกาศแล้ว{offer.claimed_by_driver_id ? `: ${driverName(offer.claimed_by_driver_id)}` : ''}
                      </span>
                    )}
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
                    {/* A4: ยกเลิกงานค้าง (คืนเข้าคิวมอบหมายใหม่; เหตุผล + audit) */}
                    {a?.status && ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(a.status) ? (
                      <button
                        onClick={() => { void handleCancelAssignment(o.order_number) }}
                        disabled={acting === o.order_number}
                        className="btn btn-outline text-sm disabled:opacity-50"
                        data-testid={`admin-cancel-${o.order_number}`}
                        title="ยกเลิกงานนี้ (assignment เก็บเป็นประวัติไว้ — มอบหมายใหม่ได้)"
                      >
                        ⛔ ยกเลิกงาน
                      </button>
                    ) : null}
                    {/* A4: เหตุผลปฏิเสธ/ยกเลิก แสดงให้แอดมินรู้ว่าเกิดอะไรขึ้น */}
                    {a?.status === 'declined' && (
                      <span className="text-xs text-amber-600">เหตุผลที่ปฏิเสธ: {(a as any).decline_reason || '(ไม่ได้ระบุ)'}</span>
                    )}
                    {a?.status === 'cancelled' && (
                      <span className="text-xs text-red-500">เหตุผลที่ยกเลิก: {(a as any).cancel_reason || '(ไม่ได้ระบุ)'}</span>
                    )}
                  </div>
                  {/* E4 (2026-10-22): แอดมินเห็นทุกขั้น — timeline จาก timestamps จริงของ assignment */}
                  {a && (
                    <div className="mt-2 text-xs text-brand-muted flex flex-wrap gap-x-3 gap-y-1" data-testid={`asg-timeline-${o.order_number}`}>
                      <span>📌 มอบหมาย: {a.assigned_at ? new Date(a.assigned_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      <span>🙋 รับงาน: {a.accepted_at ? new Date(a.accepted_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      <span>🛍️ รับของ: {a.picked_up_at ? new Date(a.picked_up_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      <span>🚚 ออกเดินทาง: {a.in_transit_at ? new Date(a.in_transit_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      <span>✅ ส่งสำเร็จ: {a.delivered_at ? new Date(a.delivered_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      <button
                        onClick={() => { void loadRoute(o.order_number) }}
                        className="underline text-brand-accent"
                        data-testid={`route-history-${o.order_number}`}
                      >
                        📍 เส้นทางย้อนหลัง
                      </button>
                    </div>
                  )}
                  {/* A3: รูปส่งมอบ (POD) ที่ไรเดอร์อัปโหลดไว้ — เปิดดูได้, ยังอยู่หลัง refresh/re-login */}
                  {a?.proof_of_delivery_path ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-brand-muted">📸 รูปส่งมอบ:</span>
                      {podUrlOf(a.proof_of_delivery_path) ? (
                        <a href={podUrlOf(a.proof_of_delivery_path)!} target="_blank" rel="noreferrer" title="ดูรูปส่งมอบ (POD)">
                          <img src={podUrlOf(a.proof_of_delivery_path)!} alt="รูปส่งมอบ" className="w-12 h-12 object-cover rounded border border-brand-border" data-testid={`pod-thumb-${o.order_number}`} />
                        </a>
                      ) : (
                        <span className="text-xs text-brand-muted">⏳ กำลังโหลดรูป…</span>
                      )}
                    </div>
                  ) : null}
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
              <thead className="bg-brand-bg"><tr><th className="p-2">ออเดอร์</th><th className="p-2">สถานะ</th><th className="p-2">ไรเดอร์</th><th className="p-2">assignment</th><th className="p-2">รูปส่งมอบ</th><th className="p-2">ปิดวงจร</th></tr></thead>
              <tbody>
                {enroute.map((o) => {
                  const a = asgFor(o.order_number)
                  const ab = assignmentBadge(a?.status)
                  const podUrl = a?.proof_of_delivery_path ? podUrlOf(a.proof_of_delivery_path) : null
                  return (
                    <tr key={o.order_number} data-focus-row={o.order_number} className={`border-b border-brand-border ${focusOrder === o.order_number ? 'bg-brand-primary/10' : ''}`}>
                      <td className="p-2 font-mono">{o.order_number}</td>
                      <td className="p-2">{o.status}</td>
                      <td className="p-2">{a?.driver_id ? driverName(a.driver_id) : '—'}</td>
                      <td className="p-2"><span className={'badge ' + ab.cls}>{ab.label}</span></td>
                      <td className="p-2">
                        {a?.proof_of_delivery_path ? (
                          podUrl ? (
                            <a href={podUrl} target="_blank" rel="noreferrer" title="ดูรูปส่งมอบ (POD)">
                              <img src={podUrl} alt="รูปส่งมอบ" className="w-10 h-10 object-cover rounded border border-brand-border" data-testid={`pod-thumb-enroute-${o.order_number}`} />
                            </a>
                          ) : (
                            <span className="text-xs text-brand-muted">⏳</span>
                          )
                        ) : (
                          <span className="text-xs text-brand-muted">—</span>
                        )}
                      </td>
                      {/* R13 (Owner 2026-10-28): แจ้งเตือน "ถึงปลายทาง" เด้งมาหน้านี้
                          → แอดมินปิดวงจรได้จากแถวกำลังเดินทาง/ถึงปลายทางโดยตรง */}
                      <td className="p-2">
                        {a?.status && ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived'].includes(a.status) ? (
                          <button
                            onClick={() => { void handleAdminAdvance(o.order_number) }}
                            disabled={acting === o.order_number}
                            className="btn btn-outline text-xs disabled:opacity-50"
                            data-testid={`admin-advance-enroute-${o.order_number}`}
                            title="ปิดวงจรแทนไรเดอร์ (geolocation/POD ของไรเดอร์ถูกข้าม — บันทึก audit ว่าเป็นฝีมือแอดมิน)"
                          >
                            🏁 แอดมินปิดวงจร
                          </button>
                        ) : (
                          <span className="text-xs text-brand-muted">—</span>
                        )}
                      </td>
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
