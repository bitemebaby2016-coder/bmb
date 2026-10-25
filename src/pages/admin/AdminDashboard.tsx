// Bite Me Baby — Admin Dashboard (Clean UI): Zone A KPI (real data) /
// Zone B Quick Actions (links only) / Zone C Operational (งานค้างจริง).
// loading + error + empty states — no hard-coded numbers.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats } from '@/lib/bmbAdminApi_users'
// C6 (audit D8/Q4): การ์ด quota+riders จากหน้า /admin/control ย้ายเข้าภาพรวม
import { AdminControl } from '@/components/dashboard/AdminControl'

type Stats = Awaited<ReturnType<typeof getDashboardStats>>

const QUICK_ACTIONS: { to: string; label: string; icon: string; hint: string }[] = [
  { to: '/admin/orders', label: 'จัดการออเดอร์', icon: '📦', hint: 'รับ/ทำ/ส่งออเดอร์' },
  { to: '/admin/kitchen', label: 'ครัว/ผลิต', icon: '🍳', hint: 'คิวผลิตประจำวัน' },
  { to: '/admin/orders?mode=PRE_ORDER', label: 'Pre-Orders', icon: '📅', hint: 'ยอดสั่งล่วงหน้า (กรองใน Orders)' },
  { to: '/admin/products', label: 'เมนู', icon: '🍽️', hint: 'สินค้า/ราคา/หมวด' },
  { to: '/admin/inventory', label: 'สต็อก', icon: '🥬', hint: 'วัตถุดิบ' },
  { to: '/admin/promotions', label: 'โปรโมชั่น', icon: '🎁', hint: 'ส่วนลด/แคมเปญ' },
  { to: '/admin/customers', label: 'ลูกค้า', icon: '👥', hint: 'โปรไฟล์/ยอดใช้จ่าย' },
  { to: '/admin/delivery', label: 'จัดส่ง', icon: '🛵', hint: 'รอบส่ง/เส้นทาง' },
  { to: '/admin/settings', label: 'ตั้งค่าร้าน', icon: '⚙️', hint: 'business settings' },
]

function money(n: number): string {
  return '฿' + n.toLocaleString()
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStats(await getDashboardStats())
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ — ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-brand-accent">📊 แดชบอร์ดจัดการร้าน</h1>
        <p className="text-sm text-brand-muted mt-1">ภาพรวม Bite Me Baby — ข้อมูลจริงจากออเดอร์/สต็อก/ลูกค้า</p>
      </header>

      <section aria-label="KPI ภาพรวม" data-testid="admin-kpi-zone" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-bold text-brand-accent">ภาพรวมธุรกิจ</h2>
          <span className="text-xs text-brand-muted">
            &laquo;วันนี้&raquo; = กรอบวัน UTC 00:00&ndash;24:00 (เวลาเซิร์ฟเวอร์) · ยอดรวม = ทั้งหมดในระบบ
          </span>
        </div>

        {loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="admin-kpi-loading" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-3 w-20 bg-brand-border-light rounded mb-3" />
                <div className="h-8 w-24 bg-brand-border-light rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="card flex flex-col sm:flex-row sm:items-center gap-3" data-testid="admin-kpi-error" role="alert">
            <span className="text-brand-danger font-medium flex-1">⚠️ {error}</span>
            <button type="button" onClick={() => void load()} className="btn btn-outline text-sm" data-testid="admin-kpi-retry">
              ลองใหม่
            </button>
          </div>
        )}

        {!loading && !error && stats && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card">
                <div className="text-xs font-semibold text-brand-muted">ออเดอร์วันนี้</div>
                <div className="text-3xl font-bold text-brand-primary mt-1" data-testid="kpi-today-orders">{stats.todayOrders}</div>
              </div>
              <div className="card">
                <div className="text-xs font-semibold text-brand-muted">รายได้วันนี้</div>
                <div className="text-3xl font-bold text-brand-primary mt-1" data-testid="kpi-today-revenue">{money(stats.todayRevenue)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-semibold text-brand-muted">อัตราส่งสำเร็จวันนี้</div>
                <div className="text-3xl font-bold text-brand-primary mt-1" data-testid="kpi-completion">{stats.completionRate}%</div>
              </div>
              <div className="card">
                <div className="text-xs font-semibold text-brand-muted">ลูกค้าทั้งหมด</div>
                <div className="text-3xl font-bold text-brand-primary mt-1" data-testid="kpi-total-customers">{stats.totalCustomers}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="card flex items-center justify-between">
                <span className="text-sm text-brand-muted">ออเดอร์ทั้งหมด</span>
                <span className="text-xl font-bold text-brand-accent" data-testid="kpi-total-orders">{stats.totalOrders.toLocaleString()}</span>
              </div>
              <div className="card flex items-center justify-between">
                <span className="text-sm text-brand-muted">รายได้รวม (ทั้งหมด)</span>
                <span className="text-xl font-bold text-brand-accent" data-testid="kpi-total-revenue">{money(stats.totalRevenue)}</span>
              </div>
            </div>
          </>
        )}

        {!loading && !error && !stats && (
          <div className="card text-brand-muted" data-testid="admin-kpi-empty">ไม่มีข้อมูลแสดงในขณะนี้</div>
        )}
      </section>

      <section aria-label="งานที่ต้องดำเนินการ" data-testid="admin-ops-zone" className="space-y-3">
        <h2 className="font-bold text-brand-accent">ต้องดำเนินการ</h2>
        {loading && <div className="card animate-pulse h-16" aria-busy="true" />}
        {!loading && error && <p className="text-sm text-brand-muted">ดึงรายการค้างไม่สำเร็จ (ดูข้อผิดพลาดด้านบน)</p>}
        {!loading && !error && stats && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/admin/orders"
              className="card flex items-center gap-3 hover:border-brand-primary transition-colors"
              data-testid="ops-pending-orders"
            >
              <span className="text-2xl" aria-hidden="true">⏳</span>
              <span className="text-sm">
                <strong className="text-brand-accent">{stats.pendingOrders}</strong> ออเดอร์รอดำเนินการวันนี้ — <span className="text-brand-primary">เปิด Orders</span>
              </span>
            </Link>
            <Link
              to="/admin/inventory"
              className="card flex items-center gap-3 hover:border-brand-primary transition-colors"
              data-testid="ops-low-stock"
            >
              <span className="text-2xl" aria-hidden="true">🥬</span>
              <span className="text-sm">
                <strong className="text-brand-accent">{stats.lowStockItems}</strong> รายการสต็อกต่ำ/หมด — <span className="text-brand-primary">เปิด Inventory</span>
              </span>
            </Link>
            {stats.pendingOrders === 0 && stats.lowStockItems === 0 && (
              <div className="card text-sm text-brand-muted" data-testid="ops-empty">✅ ไม่มีงานค้าง — ทุกอย่างเรียบร้อย</div>
            )}
          </div>
        )}
      </section>

      <section aria-label="ควบคุมร้าน (ย้ายมาจาก /admin/control — audit D8)" data-testid="admin-control-zone">
        <AdminControl />
      </section>

      <section aria-label="ทางลัดจัดการ" data-testid="admin-actions-zone" className="space-y-3">
        <h2 className="font-bold text-brand-accent">ทางลัดจัดการ</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="card text-center hover:border-brand-primary hover:shadow-md transition-all focus-visible:outline-2 focus-visible:outline-brand-primary"
              data-testid="quick-action"
            >
              <div className="text-2xl mb-1.5" aria-hidden="true">{a.icon}</div>
              <div className="text-sm font-bold text-brand-accent">{a.label}</div>
              <div className="text-xs text-brand-muted mt-0.5">{a.hint}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}