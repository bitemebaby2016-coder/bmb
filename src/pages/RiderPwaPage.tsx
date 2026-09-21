// ============================================
// Bite Me Baby — Rider PWA (DEL-02: real drivers — migration 020)
// Driver logs in by phone → sees their real assignments → accepts → advances
// (picked_up → in_transit) → final Delivered gated by geolocation + POD
// (RiderPWA) and synced back via driver_update_delivery_status.
// ============================================

import { useEffect, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { RiderPWA } from '@/components/dashboard/RiderPWA'
import {
  driverLogin,
  myDeliveries,
  driverAcceptAssignment,
  driverUpdateDeliveryStatus,
  type DriverRecord,
  type MyDeliveryAssignment,
} from '@/lib/driverService'

const STORAGE_KEY = 'bmb_driver_session'
const STATUS_LABEL: Record<string, string> = {
  assigned: '📩 รอรับงาน',
  accepted: '✅ รับงานแล้ว',
  picked_up: '🛵 รับอาหารแล้ว',
  in_transit: '🚗 กำลังเดินทาง',
  delivered: '🏠 ส่งสำเร็จ',
}

export function RiderPwaPage() {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [driver, setDriver] = useState<DriverRecord | null>(null)
  const [assignments, setAssignments] = useState<MyDeliveryAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [busyOn, setBusyOn] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<MyDeliveryAssignment | null>(null)

  async function refresh(phoneToLoad: string) {
    setLoading(true)
    try {
      setAssignments(await myDeliveries(phoneToLoad))
    } finally {
      setLoading(false)
    }
  }

  async function doLogin(p = phone, n = name) {
    if (!p.trim()) return
    const d = await driverLogin(p.trim(), n.trim())
    if (!d) {
      alert('เข้าสู่ระบบไรเดอร์ไม่สำเร็จ — ต้อง login ด้วยบัญชีลูกค้าก่อน (Rider PWA ใช้ session ของแอป)')
      return
    }
    setDriver(d)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ phone: p.trim(), name: n.trim() }))
    void refresh(p.trim())
  }

  function logout() {
    setDriver(null)
    setAssignments([])
    setActiveOrder(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  async function accept(orderNumber: string) {
    if (!driver) return
    setBusyOn(orderNumber)
    const ok = await driverAcceptAssignment(orderNumber, driver.phone)
    setBusyOn(null)
    if (ok) void refresh(driver.phone)
  }

  async function advance(orderNumber: string, status: 'picked_up' | 'in_transit') {
    if (!driver) return
    setBusyOn(orderNumber)
    const ok = await driverUpdateDeliveryStatus(orderNumber, driver.phone, status)
    setBusyOn(null)
    if (ok) void refresh(driver.phone)
  }
// Restore session on mount (rider PWA persists identity across reloads).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { phone: string; name: string }
      setPhone(saved.phone)
      setName(saved.name)
      void doLogin(saved.phone, saved.name)
    } catch {
      // ignore corrupt session
    }
  }, [])

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-bold text-brand-accent">🧑‍🔧 Rider PWA (ไรเดอร์ร้านเอง)</h1>

      {!driver ? (
        <GlassCard className="p-5">
          <h3 className="font-bold text-slate-800 mb-3">เข้าสู่ระบบไรเดอร์</h3>
          <input
            className="input mb-2"
            placeholder="ชื่อไรเดอร์"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="rider-name"
          />
          <input
            className="input mb-3"
            placeholder="เบอร์โทร (ใช้จริงของไรเดอร์)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-testid="rider-phone"
          />
          <button className="btn btn-primary w-full" onClick={() => void doLogin()} data-testid="rider-login">
            เข้าสู่ระบบ / สร้างโปรไฟล์ไรเดอร์
          </button>
          <p className="text-xs text-slate-500 mt-2">
            ระบบแมตช์โดยเบอร์โทรกับตาราง drivers (migration 020) — แอดมิน assign งานผ่าน Delivery Management
          </p>
        </GlassCard>
      ) : (
        <>
          <GlassCard className="p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800">{driver.name}</p>
              <p className="text-xs text-slate-500">{driver.phone}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">สถานะ: {driver.status}</span>
              <button className="btn btn-outline text-xs ml-3" onClick={logout}>
                ออกจากระบบ
              </button>
            </div>
          </GlassCard>

          <button className="btn btn-outline w-full" onClick={() => void refresh(driver.phone)} disabled={loading}>
            {loading ? 'โหลด…' : '🔄 รีเฟรชงานของฉัน'}
          </button>

          {activeOrder ? (
            <GlassCard className="p-5">
              <button className="btn btn-outline text-xs mb-3" onClick={() => setActiveOrder(null)}>
                ← กลับรายการ
              </button>
              <h3 className="font-bold text-slate-800 mb-1">📦 {activeOrder.order_number}</h3>
              <p className="text-sm text-slate-600 mb-2">
                สถานะ: {STATUS_LABEL[activeOrder.assignment_status] ?? activeOrder.assignment_status}
              </p>
              <ul className="text-sm text-slate-700 mb-2">
                {activeOrder.items.map((it) => (
                  <li key={it.product_name}>• {it.product_name} × {it.quantity}</li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mb-1">📍 {activeOrder.dropoff_detail || 'ไม่มีรายละเอียดที่อยู่'}</p>
              {activeOrder.dropoff_latitude != null && activeOrder.dropoff_longitude != null ? (
                <RiderPWA
                  dropOff={{ latitude: Number(activeOrder.dropoff_latitude), longitude: Number(activeOrder.dropoff_longitude) }}
                  onDelivered={() => {
                    if (driver) void driverUpdateDeliveryStatus(activeOrder.order_number, driver.phone, 'delivered')
                  }}
                />
              ) : (
                <p className="text-xs text-amber-600">ออเดอร์นี้ไม่มีพิกัดปลายทาง — ยืนยันส่งไม่ได้</p>
              )}
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {assignments.length === 0 && (
                <GlassCard className="p-5 text-center text-slate-500">ยังไม่มีงานที่ได้รับมอบหมาย</GlassCard>
              )}
              {assignments.map((a) => (
                <GlassCard key={a.order_number} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-800">📦 {a.order_number}</h3>
                    <span className="text-xs text-slate-500">{STATUS_LABEL[a.assignment_status] ?? a.assignment_status}</span>
                  </div>
                  <ul className="text-sm text-slate-700 mb-2">
                    {a.items.map((it) => (
                      <li key={it.product_name}>• {it.product_name} × {it.quantity}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500 mb-3">📍 {a.dropoff_detail || '—'}</p>
                  <div className="flex gap-2 flex-wrap">
                    {a.assignment_status === 'assigned' && (
                      <button className="btn btn-primary text-xs" disabled={busyOn === a.order_number} onClick={() => void accept(a.order_number)} data-testid="rider-accept">
                        ✅ รับงาน
                      </button>
                    )}
                    {a.assignment_status === 'accepted' && (
                      <button className="btn btn-outline text-xs" onClick={() => void advance(a.order_number, 'picked_up')}>
                        🛵 รับอาหารแล้ว
                      </button>
                    )}
                    {a.assignment_status === 'picked_up' && (
                      <button className="btn btn-outline text-xs" onClick={() => void advance(a.order_number, 'in_transit')}>
                        🚗 กำลังเดินทาง
                      </button>
                    )}
                    {['assigned', 'accepted', 'picked_up', 'in_transit'].includes(a.assignment_status) && (
                      <button className="btn btn-outline text-xs" onClick={() => setActiveOrder(a)}>
                        📸 ยืนยันส่ง (geo + POD)
                      </button>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}