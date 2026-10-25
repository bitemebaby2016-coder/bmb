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
        {/* D5 (Owner 2026-10-25 / 148): เซมเดย์ไม่มีคัทออฟ — ห้ามโชว์ "ปิดรับ HH:MM" จากค่าเดิมอีก */}
        {(status.deliveryWindowLabel || typeof status.capacityPct === 'number') && (
          <p className="text-xs opacity-80 truncate">
            ไม่มีคัทออฟ (สั่งได้ถึงปิดร้าน) · {status.deliveryWindowLabel}
            {typeof status.capacityPct === 'number' && ` · เหลือที่นั่ง ${100 - status.capacityPct}%`}
          </p>
        )}
        {/* สองเลน (Owner 2026-10-25): เซมเดย์ไม่มีคัทออฟ (บรรทัดบน) · พรีออเดอร์ = รอบถัดไปที่ยังสั่งได้ */}
        {status.preOrderLine && (
          <p className="text-xs opacity-80 truncate">📅 {status.preOrderLine}</p>
        )}
      </div>
    </div>
  )
}