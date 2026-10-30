// ============================================
// R13 (Owner 2026-10-28) — 3 คำสั่งหลัง retest:
//   1) แถบสถานะรูปแบบใหม่ (R25 Owner 2026-10-30): "🟢 เปิดรับออเดอร์ Same-Day / ส่งวันนี้ : รอบส่ง ทันทีหลังครัวปรุงเสร็จ" +
//      "🟢 เปิดรับออเดอร์ Pre-Order / จองล่วงหน้า : รอบส่ง <ชื่อรอบ> <วันที่> (ปิดรับ HH:MM AM/PM)"
//      (บอกลูกค้าด้วยว่าเป็นรอบไหนของวันไหน · R18 2026-10-29 เปลี่ยน copy ฝั่งพรีออเดอร์)
//   2) ไรเดอร์ปิดงาน → จบลูป + ออกหน้าจอหลักอัตโนมัติ · ห้ามค้าง "กำลังเดินทาง"
//      (ต้นตอจริง = POD path ของ drivers.id สกปรก → รูปไม่เคยเข้า bucket ·
//       checkin ไม่ตั้ง assignment.status → 166 แก้ทั้งคู่)
//   3) แจ้งเตือนแอดมิน "ถึงปลายทาง" → เด้งหน้าที่มีปุ่มปิดวงจร (focus แถว)
// ============================================
import { describe, it, expect } from 'vitest'
import { getStoreStatusFromRounds } from '@/lib/homeProviders'
import { resolveNotificationRoute } from '@/lib/notificationLinks'
import storeStatusStripSrc from '../components/home/StoreStatusStrip.tsx?raw'
import riderSrc from '../pages/RiderPwaPage.tsx?raw'
import deliverySrc from '../pages/admin/DeliveryManagement.tsx?raw'
import driverSvcSrc from '../lib/driverService.ts?raw'
import mig166Src from '../../supabase/migrations/166_r13_rider_pod_path_and_checkin.sql?raw'

const atBkk = (iso: string) => new Date(Date.parse(iso))
const TODAY = '2026-10-28'
const TOMORROW = '2026-10-29'

describe('R13 — แถบสถานะ: รูปแบบใหม่ + บอก "รอบไหนของวันไหน"', () => {
  it('Same-Day = "เปิดรับออเดอร์ Same-Day / ส่งวันนี้ : รอบส่ง ทันทีหลังครัวปรุงเสร็จ"', () => {
    const s = getStoreStatusFromRounds(
      [{ status: 'active', display_name: 'SameDay', delivery_start: '06:00', delivery_end: '23:00', max_capacity: 10, current_count: 1, scheduled_date: TODAY }] as never,
      atBkk('2026-10-28T04:00:00+07:00'),
    )
    expect(s.message).toBe('เปิดรับออเดอร์ Same-Day / ส่งวันนี้ : รอบส่ง ทันทีหลังครัวปรุงเสร็จ')
  })

  it('Pre-Order = "เปิดรับออเดอร์ Pre-Order / จองล่วงหน้า : รอบส่ง" + รอบถัดไป + วันที่ DD/MM/YYYY + (ปิดรับ HH:MM AM/PM)', () => {
    const closedToday = [
      { status: 'closed', display_name: 'เช้า', delivery_start: '06:00', delivery_end: '09:00', scheduled_date: TODAY },
    ]
    const tomorrow = [
      { status: 'active', display_name: 'เช้า', delivery_start: '06:00', delivery_end: '09:00', cutoff_time: '05:00', max_capacity: 60, current_count: 0, scheduled_date: TOMORROW },
    ]
    const s = getStoreStatusFromRounds([...closedToday, ...tomorrow] as never, atBkk('2026-10-28T10:00:00+07:00'))
    expect(s.state).toBe('preorder_only')
    // R18 (Owner 2026-10-29): copy ใหม่ — ห้ามขึ้นต้นแบบเดิม "พรีออเดอร์: เปิดรับออเดอร์ …"
    expect(s.preOrderLine).toContain('เปิดรับออเดอร์ Pre-Order / จองล่วงหน้า : รอบส่ง')
    expect(s.preOrderLine).not.toContain('พรีออเดอร์: เปิดรับออเดอร์')
    expect(s.preOrderLine).toContain('เช้า')
    expect(s.preOrderLine).toContain('29/10/2026')
    expect(s.preOrderLine).toMatch(/\(ปิดรับ \d{2}:\d{2} (AM|PM)\)/)
  })

  it('strip: บรรทัดพรีออเดอร์ขึ้นต้นด้วย 🟢/🔴 ตาม preOrderOpen (R16) + ไม่ truncate (วันที่ต้องไม่โดนตัด)', () => {
    expect(storeStatusStripSrc).toContain("preOrderOpen ? '🟢' : '🔴'")
    expect(storeStatusStripSrc).not.toContain('📅 {status.preOrderLine}')
    expect(storeStatusStripSrc).not.toMatch(/opacity-80 truncate/)
  })
})

describe('R13 — ไรเดอร์จบงาน: จบลูป + ออกหน้าจอหลักอัตโนมัติ + ไม่ค้าง "เดินทาง"', () => {
  it("STATUS_LABEL มี arrived = 'ถึงปลายทาง' (checkin แล้วห้ามโชว์ in_transit)", () => {
    expect(riderSrc).toContain("arrived: '🏁 ถึงปลายทาง'")
  })

  it('delivered สำเร็จ = ข้อความจบงาน + กลับหน้าหลัก (setActiveOrder null + scrollTo บนสุด)', () => {
    expect(riderSrc).toContain('จบงานแล้ว กลับหน้าหลัก')
    expect(riderSrc).toContain('window.scrollTo({ top: 0')
    expect(riderSrc).toContain('setActiveOrder(null)')
  })

  it('upload folder ถูก sanitize ตรง server (driver_path_folder) — id มี space/# ก็อัปโหลดได้', () => {
    expect(driverSvcSrc).toContain("replace(/[^A-Za-z0-9_-]/g, '')")
    expect(mig166Src).toContain('driver_path_folder')
  })
})

describe('R13 — แจ้งเตือนแอดมิน "ถึงปลายทาง" → หน้าที่มีปุ่มปิดวงจร', () => {
  it('งานจัดส่งมีเลข → /admin/delivery?focus=<เลข> (ไฮไลต์แถว)', () => {
    expect(
      resolveNotificationRoute({ notification_type: 'ORDER_ARRIVED', message: '#PO-20261028-942 — ส่งปลายทางแล้ว' }, 'admin'),
    ).toBe('/admin/delivery?focus=PO-20261028-942')
  })

  it('ตาราง "กำลังเดินทาง/ส่งแล้ว" มีปุ่มแอดมินปิดวงจรทุกแถวที่ยังไม่จบ', () => {
    expect(deliverySrc).toContain('admin-advance-enroute-')
    expect(deliverySrc).toContain('แอดมินปิดวงจร')
  })
})

describe('R13 — migration 166 (server: path sanitize + checkin status + self-heal)', () => {
  it('path-layer: sanitize ทั้ง storage policy และ attach check (ไม่แตะ PK/FK)', () => {
    expect(mig166Src).toContain('CREATE OR REPLACE FUNCTION public.driver_path_folder')
    expect(mig166Src).toContain("regexp_replace(coalesce(p_id, ''), '[^A-Za-z0-9_-]', '', 'g')")
    expect(mig166Src).toContain('pod_path_is_driver')
    expect(mig166Src).toContain("RAISE EXCEPTION 'ERR_POD_PATH_FORBIDDEN'")
  })

  it("checkin: assignment.status → 'arrived' + self-heal แถวค้าง (arrived_at มีแล้ว)", () => {
    expect(mig166Src).toContain("THEN 'arrived' ELSE status END")
    expect(mig166Src).toContain('WHERE arrived_at IS NOT NULL')
    expect(mig166Src).toContain("status IN ('accepted', 'picked_up', 'in_transit')")
    // 166 รอบแรก rollback เพราะ CHECK ไม่มี 'arrived' — ต้องเพิ่มใน migration ด้วย
    expect(mig166Src).toContain('delivery_assignments_status_check')
    expect(mig166Src).toContain("'arrived'::text")
  })
})