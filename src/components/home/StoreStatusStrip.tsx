// ============================================
// Bite Me Baby — StoreStatusStrip (UI v5)
// Compact store/delivery status (replaces the 3-round grid on Home).
// Data from StoreStatus contract → future real delivery_rounds/system.
// ============================================

import type { StoreStatus } from '@/types'

export function StoreStatusStrip({ status }: { status: StoreStatus }) {
  return (
    <div
      className={`store-strip ${status.isOpen ? 'is-open' : 'is-closed'}`}
      role="status"
      aria-live="polite"
    >
      <span className="store-strip-dot" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm sm:text-base font-bold truncate">
          {status.isOpen ? '🟢' : '🔴'} {status.message}
        </p>
        {status.cutoff && (
          <p className="text-xs opacity-80 truncate">
            ปิดรับ {status.cutoff} · {status.deliveryWindowLabel}
            {typeof status.capacityPct === 'number' && ` · เหลือที่นั่ง ${100 - status.capacityPct}%`}
          </p>
        )}
      </div>
    </div>
  )
}