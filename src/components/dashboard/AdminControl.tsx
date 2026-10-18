// ============================================
// Bite Me Baby — Admin Control (Quota & Rider Status)
// ============================================
// ข้อมูลจริงทั้งหมด: จำนวนออเดอร์วันนี้จากตาราง orders + รายชื่อไรเดอร์จาก
// ตาราง drivers (ผ่านคำสั่ง list_drivers) — ไม่มีข้อมูลตัวอย่างค้างในระบบอีกแล้ว
// (เดิมมีไรเดอร์สมมติ 001/007/012 + ตัวเลขออเดอร์คงที่ ซึ่งไม่ใช่ข้อมูลจริง)

import { useEffect, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { usePlatformConfig } from '@/config/platformConfig'
import { isOrderAvailable, isNearQuota } from '@/lib/availabilityEngine'
import { adminListDrivers, type AdminDriverRow } from '@/lib/driverService'
import { supabase } from '@/lib/supabase'

export interface AdminControlProps {
  /** สำหรับการทดสอบเท่านั้น — หน้าจริงโหลดจากฐานข้อมูลเอง */
  currentOrders?: number
}

function riderStatusOf(d: AdminDriverRow): { key: 'available' | 'busy' | 'offline'; label: string } {
  const s = String(d.status || '').toLowerCase()
  if ((d.active_assignments || 0) > 0 || s === 'busy' || s === 'on_delivery' || s === 'delivering') {
    return { key: 'busy', label: 'ไม่ว่าง (กำลังส่ง)' }
  }
  if (s === 'available' || s === 'active' || s === 'online') return { key: 'available', label: 'ว่างรับงาน' }
  return { key: 'offline', label: 'ออฟไลน์' }
}

async function countTodayOrders(): Promise<number | null> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString())
  if (error) return null
  return count ?? 0
}

export function AdminControl({ currentOrders: currentOrdersOverride }: AdminControlProps) {
  const config = usePlatformConfig()
  const { dailyQuota, cutoffHours } = config.delivery
  const [currentOrders, setCurrentOrders] = useState<number | null>(currentOrdersOverride ?? null)
  const [riders, setRiders] = useState<AdminDriverRow[]>([])
  const [ridersOk, setRidersOk] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [count, dr] = await Promise.all([
        currentOrdersOverride != null ? Promise.resolve(currentOrdersOverride) : countTodayOrders(),
        adminListDrivers(),
      ])
      if (!alive) return
      setCurrentOrders(count)
      setRiders(dr.drivers)
      setRidersOk(dr.ok)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [currentOrdersOverride])

  const nearQuota = currentOrders != null && isNearQuota(currentOrders, dailyQuota)
  const pct = currentOrders != null && dailyQuota > 0
    ? Math.min(100, Math.round((currentOrders / dailyQuota) * 100))
    : 0
  const avail = currentOrders != null
    ? isOrderAvailable({
        currentOrders,
        dailyQuota,
        targetDeliveryTime: new Date(Date.now() + 4 * 3_600_000).toISOString(),
        cutoffHours,
      })
    : null

  const availableRiders = riders.filter((r) => riderStatusOf(r).key === 'available').length

  return (
    <GlassCard className="p-5">
      <h3 className="font-bold text-slate-800 mb-4">🛎️ ควบคุมร้าน — ภาพรวมวันนี้</h3>

      <div className="mb-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-slate-500">โควตารายวัน (ออเดอร์วันนี้)</span>
          <span className="font-semibold text-slate-800">
            {currentOrders == null ? '—' : currentOrders} / {dailyQuota} (
            <span className={nearQuota ? 'text-amber-600' : ''}>{pct}%</span>)
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/40 overflow-hidden">
          <div
            className={`h-full rounded-full ${nearQuota ? 'bg-amber-500' : 'bg-brand-primary'}`}
            style={{ width: `${pct}%` }}
            data-testid="admin-quota-bar"
          />
        </div>
        <p className="text-xs mt-2 text-slate-500" data-testid="admin-availability">
          {currentOrders == null
            ? loading
              ? 'กำลังโหลดข้อมูล…'
              : 'โหลดจำนวนออเดอร์วันนี้ไม่สำเร็จ — ลองรีเฟรชหน้านี้'
            : (
              <>สถานะรับออเดอร์ (ปิดรับล่วงหน้า {cutoffHours} ชม.):{' '}
                <span className={avail?.isAvailable ? 'text-green-600' : 'text-red-600'}>
                  {avail?.isAvailable ? 'รับออเดอร์ได้' : avail?.reason}
                </span>
              </>
            )}
        </p>
      </div>

      <h4 className="text-sm font-semibold text-slate-700 mb-2">ไรเดอร์</h4>
      {!ridersOk && (
        <p className="text-xs text-red-500">โหลดรายชื่อไรเดอร์ไม่สำเร็จ — ลองรีเฟรชหน้านี้</p>
      )}
      {ridersOk && riders.length === 0 && !loading && (
        <p className="text-xs text-slate-500">
          ยังไม่มีไรเดอร์ในระบบ — เพิ่มและลงทะเบียนได้ที่หน้า "จัดส่ง"
        </p>
      )}
      <ul className="space-y-2" data-testid="admin-riders">
        {riders.map((r) => {
          const st = riderStatusOf(r)
          return (
            <li key={r.id} className="flex items-center justify-between text-sm border border-white/30 rounded-xl px-3 py-2">
              <span className="font-medium text-slate-800">{r.driver_name}</span>
              <span className="flex items-center gap-2">
                <span className="text-slate-500">งานที่กำลังส่ง {r.active_assignments || 0}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    st.key === 'available'
                      ? 'bg-green-100 text-green-700'
                      : st.key === 'busy'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {st.label}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-slate-400 mt-3">ไรเดอร์ว่างรับงาน {availableRiders}/{riders.length}</p>
    </GlassCard>
  )
}
