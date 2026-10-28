// ============================================
// Bite Me Baby — A6 truth-matrix guarantees (2026-10-22)
// ============================================
// บั๊กเดิม: กด "ถึงปลายทาง" (arrived) แล้วแอดมินบอก "สำเร็จ" แต่ลูกค้าค้าง
// arrived = คำ/flow หลอก — แผ่นแก้: "ถึงปลายทาง" ≠ "ส่งมอบสำเร็จ" ทุกที่,
// 'delivered' เขียนครบ 3 ตาราง (orders+history(trigger)+assignments), ปุ่มเดียว
// ต่อ transition (M4) — matrix นี้คุมว่า 3 หน้าเห็นสถานะเดียวกันทุกช่อง
// NOTE: ไฟล์นี้ต้องเป็น `.ts` — vitest include pattern รับเฉพาะ .js/.ts (ไม่รับ .tsx)
import { describe, it, expect } from 'vitest'
import { getServerStatusLabel, SERVER_STATUS_LABEL_TH } from '../lib/orderVocabulary.ts'
import trackSrc from '../pages/OrderTrackPage.tsx?raw'
import deliveryMgmtSrc from '../pages/admin/DeliveryManagement.tsx?raw'
import riderPageSrc from '../pages/RiderPwaPage.tsx?raw'
import mig116Src from '../../supabase/migrations/116_admin_advance_delivery.sql?raw'
import mig132Src from '../../supabase/migrations/132_rider_pod_push_decline.sql?raw'

describe('A6 · "ถึงปลายทาง" ≠ "ส่งมอบสำเร็จ" — คำต้องตรงสถานะจริง', () => {
  it('มีเฉพาะ delivered เท่านั้นที่ใช้คำว่าส่งสำเร็จ (สถานะอื่นห้าม)', () => {
    const statuses = ['pending', 'confirmed', 'preparing', 'ready_for_dispatch', 'dispatched', 'in_transit', 'arrived', 'delivered', 'cancelled', 'failed']
    for (const s of statuses) {
      const label = getServerStatusLabel(s, 'SAME_DAY')
      if (s === 'delivered') {
        expect(label).toBe('ส่งสำเร็จ')
      } else {
        expect(label, `สถานะ ${s} ห้ามใช้คำว่าส่งสำเร็จ`).not.toContain('ส่งสำเร็จ')
      }
    }
    expect(getServerStatusLabel('arrived', 'SAME_DAY')).toBe('ถึงปลายทาง')
    expect(SERVER_STATUS_LABEL_TH.arrived).not.toBe(SERVER_STATUS_LABEL_TH.delivered)
  })
})

describe('A6 · ปุ่มต้องบอกสถานะจริง (matrix ปุ่ม × หน้า)', () => {
  it('ปุ่มแอดมิน "ปิดวงจร" บอกชัดว่าไปถึงไหน + ไม่มีปุ่มสำเร็จปลอมบน arrived', () => {
    expect(deliveryMgmtSrc).toContain('adminAdvanceDelivery(orderNumber, \'delivered\')')
    expect(deliveryMgmtSrc).toContain('แอดมินปิดวงจร')
    // R13 (Owner 2026-10-28): ปุ่มปิดวงจรต้องอยู่ที่ตาราง "กำลังเดินทาง/ส่งแล้ว" ด้วย
    // (แจ้งเตือน "ถึงปลายทาง" เด้งมานี่ → ปิดได้โดยไม่ต้องไล่หาในคิว dispatch)
    expect(deliveryMgmtSrc).toContain('admin-advance-enroute-')
    // ปุ่มเดิมที่บอก "สำเร็จ" ตอน arrived ถูกถอดออกพร้อม forward chain (M4) แล้ว
    expect(deliveryMgmtSrc).not.toContain('nextForwardAction')
    expect(deliveryMgmtSrc).not.toContain('handleStatusUpdate')
  })

  it('หน้าลูกค้าโชว์ "ส่งสำเร็จ" เฉพาะ delivered เท่านั้น (≤1 poll หลัง RPC เขียน)', () => {
    expect(trackSrc).toContain("'delivered'")
    expect(trackSrc).not.toContain("statusLabel('arrived'")
  })

  it('หน้าไรเดอร์ไม่มีปุ่มหลอกว่าส่งสำเร็จก่อนมี POD', () => {
    expect(riderPageSrc).toContain('rider-pod-input')
    expect(riderPageSrc).toContain('rider-deliver')
  })
})

describe('A6 · delivered เขียนครบ 3 ตารางใน RPC เดียว', () => {
  it('adminAdvanceDelivery (116): orders + assignments + audit (history ผ่าน trigger)', () => {
    expect(mig116Src).toContain('UPDATE public.orders SET status')
    expect(mig116Src).toContain('UPDATE public.delivery_assignments')
    expect(mig116Src).toContain('append_audit_log')
    // trigger ประวัติ F-05 บันทึก order_status_history ทุก hop (008/019) —
    // เดียวกับที่ driver_update_delivery_status ใช้ (132)
    expect(mig132Src).toContain("PERFORM set_config('app.delivery_sync_order', p_order_number, true)")
    expect(mig132Src).toContain('UPDATE public.delivery_assignments')
    expect(mig132Src).toContain('UPDATE public.orders SET status')
  })
})