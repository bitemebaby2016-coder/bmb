// ============================================
// Bite Me Baby — Admin Hubs (R4: ยุบรวมหน้าจอแอดมินที่ฟีเจอร์ซ้ำ/ใกล้เคียง)
// ============================================
// Owner directive 2026-10-23: "หน้าจอแอดมินมีฟีเจอร์คล้ายกันและซ้ำซ้อน
// อะไรโลจิกเหมือนหรือใกล้เคียงกันให้ยุบรวม"
// กลยุทธ์: compose หน้าเดิมไว้ใต้ Hub เดียวเป็นแท็บ — component เดิมไม่ถูก
// แก้ไข (logic เหมือนเดิมทุกประการ) · เส้นทางเดิม (/admin/payment-exceptions
// ฯลฯ) ยังเปิดได้จาก URL ตรง (bookmark ไม่ตาย) แต่ถูกถอดออกจากเมนู
//   OrdersHub    = ออเดอร์ + การชำระเงิน (exception triage ชุดเดียวกับ bmbAdminApi_orders)
//   DeliveryHub  = จัดส่ง + เส้นทางจัดส่ง (orders + driverService ชุดเดียวกัน)
//   SettingsHub  = ตั้งค่าร้าน + เครื่องพิมพ์ + มาสคอต (settings forms ชุดเดียวกัน)
// ============================================

import { useState, type ReactNode } from 'react'
import { AdminOrders } from '@/pages/admin/AdminOrders'
import { AdminPaymentExceptions } from '@/pages/admin/AdminPaymentExceptions'
import { AdminProducts } from '@/pages/admin/AdminProducts'
import { AdminMenuSchedule } from '@/pages/admin/AdminMenuSchedule'
import { AdminTenants } from '@/pages/admin/AdminTenants'
import { AdminBrands } from '@/pages/admin/AdminBrands'
import { DeliveryManagement } from '@/pages/admin/DeliveryManagement'
import { RouteOptimizationPage } from '@/pages/admin/RouteOptimizationPage'
import { AdminSettings } from '@/pages/admin/AdminSettings'
import { AdminPrintSettings } from '@/pages/admin/AdminPrintSettings'
import { MascotSettingsPage } from '@/pages/admin/MascotSettingsPage'
import { AdminRounds } from '@/pages/admin/AdminRounds'
import { DeliveryZonesPanel } from '@/components/admin/DeliveryZonesPanel'
import { TransportAvailabilityBoard } from '@/components/admin/TransportAvailabilityBoard'

interface HubTab {
  key: string
  label: string
  icon: string
  render: () => ReactNode
}

function HubShell({ title, tabs, storageKey }: { title: string; tabs: HubTab[]; storageKey: string }) {
  const [active, setActive] = useState<string>(() => {
    // 1) ?tab= จาก URL (redirect ของหน้าเดิม) → 2) ค่าจำล่าสุด → 3) แท็บแรก
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('tab')
      if (fromUrl && tabs.some((t) => t.key === fromUrl)) return fromUrl
    } catch { /* no window */ }
    try {
      const saved = localStorage.getItem(storageKey)
      return saved && tabs.some((t) => t.key === saved) ? saved : tabs[0].key
    } catch {
      return tabs[0].key
    }
  })
  const current = tabs.find((t) => t.key === active) ?? tabs[0]
  return (
    <div data-testid={`admin-hub-${storageKey}`}>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-xl font-bold text-brand-accent mr-2">{title}</h1>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            data-testid={`hub-tab-${t.key}`}
            onClick={() => {
              setActive(t.key)
              try { localStorage.setItem(storageKey, t.key) } catch { /* private mode */ }
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              t.key === current.key
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-brand-muted hover:text-brand-primary hover:bg-brand-bg border border-brand-border'
            }`}
          >
            <span aria-hidden="true" className="mr-1">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      {current.render()}
    </div>
  )
}

export function OrdersHub() {
  return (
    <HubShell
      title="ออเดอร์และการชำระเงิน"
      storageKey="bmb-hub-orders"
      tabs={[
        { key: 'orders', label: 'ออเดอร์', icon: '📦', render: () => <AdminOrders /> },
        { key: 'payment', label: 'การชำระเงิน/ตรวจสลิป', icon: '💳', render: () => <AdminPaymentExceptions /> },
      ]}
    />
  )
}

export function DeliveryHub() {
  return (
    <HubShell
      title="การจัดการขนส่ง"
      storageKey="bmb-hub-delivery"
      tabs={[
        // D2 (Owner 2026-10-25): ศูนย์ขนส่งเดียว — แท็บแยกตามหน้าที่จริง ใช้ logic/API เดิมทั้งหมด
        { key: 'rounds', label: 'รอบจัดส่ง & แพทเทิร์น', icon: '🕒', render: () => <AdminRounds /> },
        { key: 'availability', label: 'ความพร้อมรับออเดอร์', icon: '✅', render: () => <TransportAvailabilityBoard /> },
        { key: 'dispatch', label: 'จัดส่ง/มอบหมายงาน', icon: '🛵', render: () => <DeliveryManagement /> },
        { key: 'routes', label: 'วางแผนเส้นทาง', icon: '🗺️', render: () => <RouteOptimizationPage /> },
        { key: 'fees', label: 'ค่าส่ง/โซน', icon: '💰', render: () => <DeliveryZonesPanel /> },
      ]}
    />
  )
}

export function SettingsHub() {
  return (
    <HubShell
      title="ตั้งค่าร้าน"
      storageKey="bmb-hub-settings"
      tabs={[
        { key: 'store', label: 'ตั้งค่าร้าน/สาขา', icon: '⚙️', render: () => <AdminSettings /> },
        { key: 'print', label: 'เครื่องพิมพ์', icon: '🖨️', render: () => <AdminPrintSettings /> },
        { key: 'mascot', label: 'มาสคอต', icon: '🤖', render: () => <MascotSettingsPage /> },
      ]}
    />
  )
}

// ---- R5 (Owner 2026-10-23): ยุบรวมระลอก 2 ----
//   MenuHub = เมนู/สินค้า + ตารางเมนูรอบพิเศษ (menu_schedule 7 วัน/14 เมนู — ชุดเดียวกัน)
//   OrgHub  = องค์กร/ร้านค้า + แบรนด์ (tenancy/white-label control plane ชุดเดียวกัน)

export function MenuHub() {
  return (
    <HubShell
      title="เมนูและตารางเมนู"
      storageKey="bmb-hub-menu"
      tabs={[
        { key: 'products', label: 'เมนู/สินค้า', icon: '🍽️', render: () => <AdminProducts /> },
        { key: 'schedule', label: 'ตารางเมนูรอบพิเศษ', icon: '📅', render: () => <AdminMenuSchedule /> },
      ]}
    />
  )
}

export function OrgHub() {
  return (
    <HubShell
      title="องค์กรและแบรนด์"
      storageKey="bmb-hub-org"
      tabs={[
        { key: 'tenants', label: 'องค์กร/ร้านค้า', icon: '🏢', render: () => <AdminTenants /> },
        { key: 'brands', label: 'แบรนด์', icon: '🏳️', render: () => <AdminBrands /> },
      ]}
    />
  )
}