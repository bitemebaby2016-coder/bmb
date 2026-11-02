// ============================================
// Bite Me Baby — StoreStatusStrip (UI v5)
// Compact store/delivery status (replaces the 3-round grid on Home).
// Data from StoreStatus contract → future real delivery_rounds/system.
// ============================================

import { useEffect, useSyncExternalStore } from 'react'
import type { StoreStatus } from '@/types'
import {
  DEFAULT_STORE_STATUS_COPY,
  getStoreStatusCopy,
  getStoreStatusCopySync,
  preOrderLineWithCopy,
  subscribeStoreStatusCopy,
} from '@/lib/storeStatusCopy'

export function StoreStatusStrip({ status }: { status: StoreStatus }) {
  // R16 (Owner 2026-10-28): สีตามจริงรายสาย — เซมเดย์/พรีออเดอร์เปิด-ปิดแยกกันได้
  // (fallback: แถวเก่าไม่มี flag → เดาจากข้อความพรีออเดอร์เหมือนเดิม)
  const sameDayOpen = status.sameDayOpen ?? status.isOpen
  const preOrderOpen = status.preOrderOpen ?? !/ปิดรับแล้ว|ยังไม่เปิดรอบ/.test(status.preOrderLine || '')
  // N1 (Owner 4-2 · R19): แอดมินแก้ "ข้อความ" เองได้ (business_settings.store_status_copy)
  // — ไฟ 🟢/🔴 ยังคำนวจากรอบจริงเสมอ ห้าม override (กติกา Owner)
  useSyncExternalStore(subscribeStoreStatusCopy, getStoreStatusCopySync, getStoreStatusCopySync)
  useEffect(() => {
    void getStoreStatusCopy()
  }, [])
  // R44/R52 (Owner 2026-11-01 "แสดงสถานะ 3 บรรทัด" · copy ใหม่ตาม R52):
  //   1) ไฟสถานะเปิด-ปิด แจ้งทั้ง Pre-Order และ Same-Day ในบรรทัดเดียว
  //   2) `📅 Pre-Order / จองล่วงหน้า : 🛵 <เนื้อหาสด>` — หัวข้อใน strip · body = รอบส่งถัดไป + เวลาออกส่งจริง
  //      ปิดรับ = fallback default แก้ผ่านคีย์ store_status_copy ได้
  //   3) `⚡ Same-Day / ส่งวันนี้ : 🛵 จัดส่งทันทีหลังปรุงเสร็จ` (ยังไม่ถึงรอบ = "เริ่มส่ง HH:MM AM")
  const preOrderLine = preOrderLineWithCopy(status.preOrderLine) ?? DEFAULT_STORE_STATUS_COPY.preOrderClosed
  const sameDayLine = status.sameDayLine ?? (sameDayOpen ? 'จัดส่งทันทีหลังปรุงเสร็จ' : 'ปิดรับแล้ว')
  return (
    <div
      className={`store-strip ${status.isOpen ? 'is-open' : 'is-closed'}`}
      role="status"
      aria-live="polite"
    >
      <span className="store-strip-dot" aria-hidden="true" />
      <div className="min-w-0">
        {/* R12 (Owner 2026-10-28): คำในวงเล็บไม่ต้องแสดง — บรรทัด (ไม่มีปิดรอบ · สั่งได้ถึง · เหลือที่นั่ง) ถอดออกแล้ว
            (ข้อมูลเดิมเคยอยู่บรรทัด status: ไม่มีปิดรอบ (สั่งได้ถึง HH:MM) · เหลือที่นั่ง N% — ระบุว่าไม่แสดง) */}
        {/* R50 (Owner 2026-11-01 Strip copy): ① ไฟสองสาย + ไอคอนประจำสาย (📅 ปฏิทิน = พรีออเดอร์ · ⚡ สายฟ้า = เซมเดย์) */}
        <p className="text-sm sm:text-base font-bold" data-testid="strip-status-lights">
          {preOrderOpen ? '🟢' : '🔴'} เปิดรับออเดอร์ จองล่วงหน้า/Pre-Order 📅{preOrderOpen ? '' : ' ปิดรับแล้ว'} — {sameDayOpen ? '🟢' : '🔴'} เปิดรับออเดอร์ รอบวันนี้/Same-Day ⚡{sameDayOpen ? '' : ' ปิดรับแล้ว'}
        </p>
        {/* R52 บรรทัด 2: หัวข้อ Pre-Order/จองล่วงหน้า + เนื้อหาสด (เวลาออกส่งจริง ไม่ใช่ชื่อรอบ) · label อยู่ strip · ไม่ truncate */}
        <p className="text-sm sm:text-base font-bold" data-testid="strip-preorder">📅 Pre-Order / จองล่วงหน้า : 🛵 {preOrderLine}</p>
        {/* R52 บรรทัด 3: หัวข้อ Same-Day/ส่งวันนี้ — ในหน้าต่างส่ง = จัดส่งทันทีหลังปรุงเสร็จ */}
        <p className="text-sm sm:text-base font-bold" data-testid="strip-sameday">
          ⚡ Same-Day / ส่งวันนี้ : 🛵 {sameDayLine}
        </p>
      </div>
    </div>
  )
}