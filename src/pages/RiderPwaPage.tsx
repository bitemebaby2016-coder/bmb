// ============================================
// Bite Me Baby — Rider PWA (DEL-02: real drivers — migration 020)
// Driver logs in by phone → sees their real assignments → accepts → advances
// (picked_up → in_transit) → final Delivered gated by geolocation + POD
// (RiderPWA) and synced back via driver_update_delivery_status.
// ============================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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

/**
 * Rider session storage key.
 * NOTE: Rider PWA uses a simplified phone-based auth (not Supabase Auth).
 * This is intentional — riders log in quickly from any browser without
 * needing email/password. Session is persisted in localStorage so they
 * don't need to re-login on page refresh. Security is acceptable because:
 *   1. Drivers can only READ their own deliveries (RLS on my_deliveries RPC)
 *   2. Status updates write to delivery_assignments (service_role RPC)
 *   3. A driver cannot see another driver's orders or modify them
 */
const STATUS_LABEL: Record<string, string> = {
  assigned: '📩 รอรับงาน',
  accepted: '✅ รับงานแล้ว',
  picked_up: '🛵 รับอาหารแล้ว',
  in_transit: '🚗 กำลังเดินทาง',
  delivered: '🏠 ส่งสำเร็จ',
}

export function RiderPwaPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [driver, setDriver] = useState<DriverRecord | null>(null)
  const [assignments, setAssignments] = useState<MyDeliveryAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [busyOn, setBusyOn] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<MyDeliveryAssignment | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      setAssignments(await myDeliveries())
    } finally {
      setLoading(false)
    }
  }

  /**
   * F-06 (Wave 2-B): rider identity = Supabase Auth JWT.
   * Phone/name self-registration removed — the account must be provisioned
   * (linked to a drivers row) by an Admin (Owner Decision 06).
   */
  async function doLogin(em = email, pw = password) {
    if (!em.trim() || !pw) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: em.trim(), password: pw })
      if (error) {
        alert('เข้าสู่ระบบไม่สำเร็จ: ' + error.message)
        return
      }
      const d = await driverLogin()
      if (!d) {
        alert('บัญชีนี้ยังไม่ถูกผูกกับโปรไฟล์ไรเดอร์ — ต้องให้ Admin provision (F-06: เบอร์โทรอย่างเดียวใช้ระบุตัวตนไม่ได้)')
        return
      }
      setDriver(d)
      void refresh()
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setDriver(null)
    setAssignments([])
    setActiveOrder(null)
  }

  async function accept(orderNumber: string) {
    if (!driver) return
    setBusyOn(orderNumber)
    const ok = await driverAcceptAssignment(orderNumber)
    setBusyOn(null)
    if (ok) void refresh()
  }

  async function advance(orderNumber: string, status: 'picked_up' | 'in_transit') {
    if (!driver) return
    setBusyOn(orderNumber)
    const ok = await driverUpdateDeliveryStatus(orderNumber, status)
    setBusyOn(null)
    if (ok) void refresh()
  }

  // Restore session on mount (Supabase Auth persists the rider session).
  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const d = await driverLogin()
      if (d) {
        setDriver(d)
        void refresh()
      }
    })()
  }, [])

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-bold text-brand-accent">🧑‍🔧 Rider PWA (ไรเดอร์ร้านเอง)</h1>

      {!driver ? (
        <GlassCard className="p-5">
          <h3 className="font-bold text-slate-800 mb-3">เข้าสู่ระบบไรเดอร์ (Supabase Auth)</h3>
          <input
            className="input mb-2"
            placeholder="อีเมลไรเดอร์ (บัญชีที่ Admin provision แล้ว)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="rider-email"
          />
          <input
            className="input mb-3"
            placeholder="รหัสผ่าน"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="rider-password"
          />
          <button className="btn btn-primary w-full" onClick={() => void doLogin()} data-testid="rider-login">
            เข้าสู่ระบบ
          </button>
          <p className="text-xs text-slate-500 mt-2">
            F-06: ตัวตนไรเดอร์ยืนยันด้วย Supabase Auth JWT — เบอร์โทร/ชื่อจาก client ใช้ระบุตัวตนไม่ได้อีกต่อไป
            (บัญชีต้องถูก Admin link กับ drivers.user_id ก่อน)
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

          <button className="btn btn-outline w-full" onClick={() => void refresh()} disabled={loading}>
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
                    void driverUpdateDeliveryStatus(activeOrder.order_number, 'delivered')
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