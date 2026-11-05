// ============================================
// Bite Me Baby — R72: แจ้งเตือนซ้ำ/เด้งตอนเปิดแอพ/คูปองเช็คเอาท์/สถานะค้าง/รับงานไม่ได้
// ============================================
// Owner (2026-11-05 ค่ำ หลังทดสอบ live §R71): "เด้งตอนเปิดแอพด้วย · แจ้งเตือนไรเดอร์มีซ้ำ ·
// มุมจอต้องบอกเรื่องข้อความทุกฝั่ง · คูปองแอดมินใช้ที่เช็คเอาท์ได้+เพิ่มทีหลังอัตโนมัติ ·
// เซมเดย์นอกเวลา error ถูกต้อง(ยืนยัน) · เส้นทางแจ้งเตือนจัดส่งหายไป+สถานะหลังยืนยันรอบไม่เดินต่อ ·
// ไรเดอร์รับงานไม่ได้" — Source-contract tests (pattern r70/r71)
import { describe, it, expect } from 'vitest'

import mig188 from '../../supabase/migrations/188_order_notification_dedup.sql?raw'
import mig189 from '../../supabase/migrations/189_claim_offer_accept_fallback.sql?raw'
import linksSrc from '@/lib/notificationLinks.ts?raw'
import bellSrc from '@/components/notification/NotificationDropdown.tsx?raw'
import panelSrc from '@/components/messages/OrderChatPanel.tsx?raw'
import homeSrc from '@/pages/HomePage.tsx?raw'
import kitchenSrc from '@/pages/admin/AdminKitchen.tsx?raw'

describe('R72 m188 — แจ้งเตือนออเดอร์ห้ามซ้ำ (trigger กับ worker ต้องใช้ id เดียวกัน)', () => {
  it('hook ใช้ id deterministic แบบเดียวกับ automation-worker (evt-ord-<order>-<status>)', () => {
    expect(mig188).toContain("'evt-ord-' || NEW.order_number || '-' || NEW.status::text")
    expect(mig188).toContain("ON CONFLICT (id) DO NOTHING")
    // ห้ามกลับไปใช้ id สุ่ม (notif-<ts>-<rand>) = ชนกับ worker ไม่ได้ = ซ้ำ 2 เท่า
    expect(mig188).not.toContain("'notif-' || to_char(")
  })

  it('แถวชำระเงินแยก namespace evt-pay- (ไม่มีคู่ใน worker = คงแจ้งเหมือนเดิม) + trigger เดิมครบ', () => {
    expect(mig188).toContain("'evt-pay-' || NEW.order_number || '-' || NEW.payment_status::text")
    expect(mig188).toContain('trg_orders_notify_insert')
    expect(mig188).toContain('trg_orders_notify_status')
    expect(mig188).toContain('trg_orders_notify_payment')
  })
})

describe('R72 m189 — ไรเดอร์ "รับงานไม่ได้": claim ของงานที่แอดมินมอบหมายแล้ว = accept', () => {
  it("assignment 'assigned' ของตัวเอง → ทำงานเท่า accept + คืน ok", () => {
    expect(mig189).toContain("IF v_asg_status = 'assigned' THEN")
    expect(mig189).toContain("'via', 'assigned_fallback'")
    expect(mig189).toContain("SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW())")
  })

  it('งานของคนอื่นยังกันซ้ำจอง (ERR_OFFER_NOT_AVAILABLE) + step-sync เดิมคงอยู่', () => {
    expect(mig189).toContain("RAISE EXCEPTION 'ERR_OFFER_NOT_AVAILABLE'")
    expect(mig189).toContain("IF v_order_status_txt = 'ready_for_dispatch' THEN")
    expect(mig189).toContain('CREATE OR REPLACE FUNCTION public.claim_dispatch_offer(')
  })
})

describe('R72 เส้นทางแจ้งเตือนจัดส่ง + เด้งตอนเปิดแอพ', () => {
  it('แถวแจ้งสายจัดส่ง (DRIVER_*/ORDER_PICKED_UP) เด้งไปหน้าจัดส่ง (เดิมตกไป /admin/orders)', () => {
    expect(linksSrc).toContain("'DRIVER_ASSIGNED'")
    expect(linksSrc).toContain("'DRIVER_ACCEPTED'")
    expect(linksSrc).toContain("'DRIVER_PICKED_UP'")
    expect(linksSrc).toContain("return orderNo ? `/admin/delivery?focus=${orderNo}` : '/admin/delivery'")
  })

  it('เด้งเดสก์ท็อปทั้งตอนเปิดแอปอยู่และตอนไม่โฟกัส (ไม่มี document.hidden gate)', () => {
    expect(bellSrc).not.toContain('document.hidden')
    expect(panelSrc).not.toContain('document.hidden')
    expect(bellSrc).toContain("new Notification(last.title")
    expect(panelSrc).toContain("new Notification(title")
  })
})

describe('R72 คูปองเช็คเอาท์ + คิวครัวเดินต่อ', () => {
  it('การ์ดโปรหน้าร้านเคารพช่วงวันที่ (คูปองหมดอายุห้ามโฆษณา) + ใช้ bangkokDateKey เดียวกับ dropdown', () => {
    expect(homeSrc).toContain("import { bangkokDateKey } from '@/lib/promotionClient'")
    expect(homeSrc).toContain('const todayKey = bangkokDateKey()')
    expect(homeSrc).toContain('if (e && todayKey > e) return false')
    expect(homeSrc).toContain('if (s && todayKey < s) return false')
  })

  it('คิวครัวโชว์พรีออเดอร์ที่รอเข้าครัวทุกวันที่ (สถานะหลังยืนยันรอบต้องเดินต่อได้)', () => {
    expect(kitchenSrc).toContain("['confirmed', 'preparing', 'ready_for_dispatch'].includes(String(o.status))")
    expect(kitchenSrc).toContain("o.order_mode === 'PRE_ORDER'")
  })
})
