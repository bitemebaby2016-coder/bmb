// ============================================
// Bite Me Baby — StoreStatusStrip (UI v5)
// Compact store/delivery status (replaces the 3-round grid on Home).
// Data from StoreStatus contract → future real delivery_rounds/system.
// ============================================

import { useEffect, useSyncExternalStore } from 'react'
import type { StoreStatus } from '@/types'
import {
  getStoreStatusCopy,
  getStoreStatusCopySync,
  preOrderLineWithCopy,
  statusMessageWithCopy,
  subscribeStoreStatusCopy,
} from '@/lib/storeStatusCopy'

export function StoreStatusStrip({ status }: { status: StoreStatus }) {
  // R16 (Owner 2026-10-28): สีตามจริงรายสาย — เซมเดย์/พรีออเดอร์เปิด-ปิดแยกกันได้
  // (fallback: แถวเก่าไม่มี flag → เดาจากข้อความพรีออเดอร์เหมือนเดิม)
  const sameDayOpen = status.sameDayOpen ?? status.isOpen
  const preOrderOpen = status.preOrderOpen ?? !/ปิดรับแล้ว|ยังไม่เปิดรอบ/.test(status.preOrderLine || '')
  // N1 (Owner 4-2 · R19): แอดมินแก้ "ข้อความ" เองได้ (business_settings.store_status_copy)
  // — ไฟ 🟢/🔴 สองบรรทัดยังคำนวจากรอบจริงเสมอ ห้าม override (กติกา Owner)
  useSyncExternalStore(subscribeStoreStatusCopy, getStoreStatusCopySync, getStoreStatusCopySync)
  useEffect(() => {
    void getStoreStatusCopy()
  }, [])
  const message = statusMessageWithCopy(status.message)
  const preOrderLine = preOrderLineWithCopy(status.preOrderLine)
  return (
    <div
      className={`store-strip ${status.isOpen ? 'is-open' : 'is-closed'}`}
      role="status"
      aria-live="polite"
    >
      <span className="store-strip-dot" aria-hidden="true" />
      <div className="min-w-0">
        {/* R16: สองบรรทัด "ขนาดเท่ากัน" (font เท่ากัน · ไม่ truncate) */}
        <p className="text-sm sm:text-base font-bold" data-testid="strip-sameday">
          {sameDayOpen ? '🟢' : '🔴'} {message}
        </p>
        {/* D5 (Owner 2026-10-25 / 148): เซมเดย์ไม่มีปิดรอบ — ห้ามโชว์ "ปิดรับ HH:MM" จากค่าเดิมอีก
            SYNC (Owner 2026-10-26): โชว์เวลาปิดจริงจาก business_settings.hours เมื่อรู้ค่า */}
        {/* R12 (Owner 2026-10-28): คำในวงเล็บไม่ต้องแสดง — บรรทัด (ไม่มีปิดรอบ · สั่งได้ถึง · เหลือที่นั่ง) ถอดออกแล้ว
            (ข้อมูลเดิมเคยอยู่บรรทัดนี้: ไม่มีปิดรอบ (สั่งได้ถึง HH:MM) · เหลือที่นั่ง N% — ระบุว่าไม่แสดง) */}
        {/* สองเลน (Owner 2026-10-25): เซมเดย์ไม่มีปิดรอบ (บรรทัดบน) · พรีออเดอร์ = รอบถัดไปที่ยังสั่งได้ */}
        {/* R13 (Owner 2026-10-28): รูปแบบใหม่ — "🟢 …" (ไม่ใช่ 📅) · ไม่ truncate
            ให้เห็นวันที่+ปิดรับครบ (R25 copy: "🟢 เปิดรับออเดอร์ Pre-Order / จองล่วงหน้า : รอบส่ง เช้า 31/10/2026 (ปิดรับ 05:00 AM)") */}
        {status.preOrderLine && (
          <p className="text-sm sm:text-base font-bold" data-testid="strip-preorder">
            {/* N1: บรรทัดเปิดรับ = ข้อมูลสด (R18) คงเดิม · บรรทัดปิดรับแล้ว = แก้ได้ในคีย์ */}
            {preOrderOpen ? '🟢' : '🔴'} {preOrderLine}
          </p>
        )}
      </div>
    </div>
  )
}