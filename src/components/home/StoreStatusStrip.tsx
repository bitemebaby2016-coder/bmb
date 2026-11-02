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
  // N1 (Owner 2026-11-01 Strip copy รอบ 3 · ทับ R50/R52 ทั้งหมด):
  //   1) ไฟสถานะเปิด-ปิด แจ้งทั้ง Pre-Order และ Same-Day ในบรรทัดเดียว
  //      ไอคอนอยู่หลังคำไทย: จองล่วงหน้า/📅Pre-Order · ส่งวันนี้/⚡Same-Day
  //   2) `🛵 จองล่วงหน้า/📅Pre-Order : รอบส่ง <เวลาออกส่ง> <ชื่อรอบ> <วัน> (ปิดรับ …)`
  //      — เนื้อหาสด dynamic จาก delivery_rounds (ห้าม hardcode) · หัวข้ออยู่ฝั่ง strip
  //   3) `🛵 ส่งวันนี้/⚡Same-Day : จัดส่งทันทีหลังครัวปรุงเสร็จ`
  //      — เซมเดย์ไม่ผูกรอบส่งใด ๆ (ห้ามมีคำในวงเล็บ/เวลาของรอบ)
  const preOrderLine = preOrderLineWithCopy(status.preOrderLine) ?? DEFAULT_STORE_STATUS_COPY.preOrderClosed
  const sameDayLine = status.sameDayLine ?? (sameDayOpen ? 'จัดส่งทันทีหลังครัวปรุงเสร็จ' : 'ปิดรับแล้ว')
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
        {/* N1 บรรทัด ①: ไฟสองสาย + ไอคอนหลังคำไทย (📅 = พรีออเดอร์ · ⚡ = เซมเดย์) */}
        <p className="text-sm sm:text-base font-bold" data-testid="strip-status-lights">
          {preOrderOpen ? '🟢' : '🔴'} เปิดรับออเดอร์ จองล่วงหน้า/📅Pre-Order{preOrderOpen ? '' : ' ปิดรับแล้ว'} — {sameDayOpen ? '🟢' : '🔴'} เปิดรับออเดอร์ ส่งวันนี้/⚡Same-Day{sameDayOpen ? '' : ' ปิดรับแล้ว'}
        </p>
        {/* N1 บรรทัด 2: หัวข้อ จองล่วงหน้า/📅Pre-Order + เนื้อหาสด (รอบส่ง + เวลาออกส่ง + ชื่อรอบ + วัน + ปิดรับ) · ไม่ truncate */}
        <p className="text-sm sm:text-base font-bold" data-testid="strip-preorder">🛵 จองล่วงหน้า/📅Pre-Order : {preOrderLine}</p>
        {/* N1 บรรทัด 3: หัวข้อ ส่งวันนี้/⚡Same-Day — ไม่ผูก Round = จัดส่งทันทีหลังครัวปรุงเสร็จ (ไม่มีวงเล็บ) */}
        <p className="text-sm sm:text-base font-bold" data-testid="strip-sameday">🛵 ส่งวันนี้/⚡Same-Day : {sameDayLine}</p>
      </div>
    </div>
  )
}