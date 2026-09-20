// ============================================
// Bite Me Baby — Admin Control (Quota & Rider Status)
// ============================================
// Real-time store dashboard: dispatch cycles, quota ceilings, rider metrics.
// Everything is driven by the active platform config + pure engines — no
// hard-coded limits.

import { useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { usePlatformConfig } from '@/config/platformConfig'
import { isOrderAvailable, isNearQuota } from '@/lib/availabilityEngine'

interface RiderMetric {
  id: string
  name: string
  load: number
  status: 'available' | 'busy' | 'offline'
}

export interface AdminControlProps {
  /** Current orders placed today (drives the quota ceiling). */
  currentOrders?: number
  riders?: RiderMetric[]
}

const DEFAULT_RIDERS: RiderMetric[] = [
  { id: 'R-001', name: 'ไรเดอร์ 001', load: 2, status: 'available' },
  { id: 'R-007', name: 'ไรเดอร์ 007', load: 4, status: 'busy' },
  { id: 'R-012', name: 'ไรเดอร์ 012', load: 0, status: 'offline' },
]

export function AdminControl({ currentOrders = 42, riders = DEFAULT_RIDERS }: AdminControlProps) {
  const config = usePlatformConfig()
  const { dailyQuota, cutoffHours } = config.delivery

  // Sample "slot availability" for a target ~4h out.
  const target = new Date(Date.now() + 4 * 3_600_000).toISOString()
  const avail = isOrderAvailable({
    currentOrders,
    dailyQuota,
    targetDeliveryTime: target,
    cutoffHours,
  })
  const nearQuota = isNearQuota(currentOrders, dailyQuota)
  const pct = dailyQuota > 0 ? Math.min(100, Math.round((currentOrders / dailyQuota) * 100)) : 0

  const availableRiders = riders.filter((r) => r.status === 'available').length

  return (
    <GlassCard className="p-5">
      <h3 className="font-bold text-slate-800 mb-4">🛎️ Admin Control — ร้านค้า</h3>

      <div className="mb-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-slate-500">โควตารายวัน</span>
          <span className="font-semibold text-slate-800">
            {currentOrders} / {dailyQuota} (<span className={nearQuota ? 'text-amber-600' : ''}>{pct}%</span>)
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
          สถานะรอบ (เป้าหมาย +4 ชม., cutoff {cutoffHours} ชม.):{' '}
          <span className={avail.isAvailable ? 'text-green-600' : 'text-red-600'}>
            {avail.isAvailable ? 'รับออเดอร์ได้' : avail.reason}
          </span>
        </p>
      </div>

      <h4 className="text-sm font-semibold text-slate-700 mb-2">ไรเดอร์</h4>
      <ul className="space-y-2" data-testid="admin-riders">
        {riders.map((r) => (
          <li key={r.id} className="flex items-center justify-between text-sm border border-white/30 rounded-xl px-3 py-2">
            <span className="font-medium text-slate-800">{r.name}</span>
            <span className="flex items-center gap-2">
              <span className="text-slate-500">โหลด {r.load}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  r.status === 'available'
                    ? 'bg-green-100 text-green-700'
                    : r.status === 'busy'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {r.status === 'available' ? 'ว่าง' : r.status === 'busy' ? 'ยุ่ง' : 'ออฟไลน์'}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-400 mt-3">ไรเดอร์ว่าง {availableRiders}/{riders.length} · จุดศูนย์ร้าน {config.tenantId}</p>
    </GlassCard>
  )
}
