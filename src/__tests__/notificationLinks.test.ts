// ============================================
// Bite Me Baby — notification → หน้าทำงานที่เกี่ยวข้อง (R11 · Owner 2026-10-27)
// กติกา: กดอ่านแจ้งเตือน = เด้งไปหน้าทำงานของ "เรื่องนั้น" ตาม role
//   rider → /rider · admin → ครัว/จัดส่ง/ออเดอร์ ตามประเภท · ลูกค้า → /track/<order>
// ============================================

import { describe, expect, it } from 'vitest'
import { extractOrderNumber, resolveNotificationRoute } from '@/lib/notificationLinks'

describe('extractOrderNumber — ดึงเลขออเดอร์จากข้อความแจ้งเตือน', () => {
  it('ข้อความ trigger 161 (#PO-… — ข้อความ)', () => {
    expect(extractOrderNumber({ message: '#PO-20261027-379 — ออกส่งแล้ว' })).toBe('PO-20261027-379')
  })
  it('BMB format + ไม่มี # (evt-ord rows)', () => {
    expect(extractOrderNumber({ title: 'จัดส่งสำเร็จ', body: '#BMB-20261023-841 — จัดส่งสำเร็จ' })).toBe('BMB-20261023-841')
    expect(extractOrderNumber({ message: 'ออเดอร์ PO-20260928-222 ออกจัดส่งแล้ว' })).toBe('PO-20260928-222')
  })
  it('data.orderNumber มาก่อนข้อความ', () => {
    expect(
      extractOrderNumber({ title: 'x', data: { orderNumber: 'PO-20261027-379' }, message: 'ไม่มีเลข' }),
    ).toBe('PO-20261027-379')
  })
  it('ไม่มีเลขออเดอร์ → null', () => {
    expect(extractOrderNumber({ title: 'โปรโมชัน', message: 'ลด 10%' })).toBeNull()
  })
})

describe('resolveNotificationRoute — เส้นทางตาม role (ทำตามกฏ)', () => {
  it('rider → /rider เสมอ (หน้างานของฉัน)', () => {
    expect(resolveNotificationRoute({ message: '#PO-1 — x' }, 'rider')).toBe('/rider')
    expect(resolveNotificationRoute({ title: 'ไม่มีอะไร' }, 'rider')).toBe('/rider')
  })

  it('admin: งานครัว (preparing/ready) → /admin/kitchen', () => {
    expect(resolveNotificationRoute({ notification_type: 'ORDER_PREPARING' }, 'admin')).toBe('/admin/kitchen')
    expect(resolveNotificationRoute({ notification_type: 'ORDER_READY' }, 'owner')).toBe('/admin/kitchen')
    expect(resolveNotificationRoute({ type: 'order_ready_for_dispatch' }, 'staff')).toBe('/admin/kitchen')
  })

  it('admin: งานจัดส่ง (dispatched..delivered) → /admin/delivery', () => {
    for (const t of ['ORDER_DISPATCHED', 'ORDER_OUT_FOR_DELIVERY', 'ORDER_IN_TRANSIT', 'ORDER_ARRIVED', 'ORDER_DELIVERED']) {
      expect(resolveNotificationRoute({ notification_type: t }, 'admin')).toBe('/admin/delivery')
    }
    expect(resolveNotificationRoute({ type: 'ORDER_DELIVERED' }, 'support')).toBe('/admin/delivery')
  })

  it('admin: ออเดอร์/ชำระเงิน/อื่น ๆ → /admin/orders', () => {
    expect(resolveNotificationRoute({ notification_type: 'ORDER_CREATED' }, 'admin')).toBe('/admin/orders')
    expect(resolveNotificationRoute({ notification_type: 'PAYMENT_CONFIRMED' }, 'finance')).toBe('/admin/orders')
    expect(resolveNotificationRoute({ title: 'อื่น ๆ' }, 'pos')).toBe('/admin/orders')
  })

  it('ลูกค้า: มีเลขออเดอร์ → /track/<order>', () => {
    expect(
      resolveNotificationRoute({ notification_type: 'ORDER_DELIVERED', message: '#PO-20261027-379 — จัดส่งสำเร็จ' }, 'customer'),
    ).toBe('/track/PO-20261027-379')
    expect(resolveNotificationRoute({ title: 'BMB-20261023-841 กำลังเดินทาง' }, null)).toBe('/track/BMB-20261023-841')
  })

  it('ลูกค้า: โปรโมชัน → /promotions · อื่น ๆ → /orders', () => {
    expect(resolveNotificationRoute({ notification_type: 'PROMOTION_EXPIRED' }, 'customer')).toBe('/promotions')
    expect(resolveNotificationRoute({ title: 'ระบบประกาศ' }, 'customer')).toBe('/orders')
    expect(resolveNotificationRoute({ title: 'ไม่รู้จัก' }, null)).toBe('/orders')
  })

  it('specialist role (kitchen/pos/support) ยังได้เส้นทาง admin ตามประเภทงาน', () => {
    expect(resolveNotificationRoute({ notification_type: 'ORDER_PREPARING' }, 'kitchen')).toBe('/admin/kitchen')
    expect(resolveNotificationRoute({ notification_type: 'ORDER_DELIVERED' }, 'kitchen')).toBe('/admin/delivery')
  })
})