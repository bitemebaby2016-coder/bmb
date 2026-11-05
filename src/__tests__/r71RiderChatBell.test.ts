// ============================================
// Bite Me Baby — R71: ซ่อมฝั่งไรเดอร์ (ส่งข้อความได้จริง + กระดิ่งแจ้งเตือน) — หลัง Owner ทดสอบ live
// ============================================
// Owner (2026-11-05): "ฝั่งไดร์เวอร์ไม่มีแจ้งเตือน ไม่มีหน้าต่างแชทโต้ตอบไม่ได้ ทำให้ถูกต้อง ·
// กระดิ่งเตือนจริง" — Source-contract tests (pattern r70/r51)
// Root cause ที่แก้: m183 ใช้ id 'msgn-'||v_id ซ้ำกันสองแถว → ไรเดอร์ส่ง (เขียน 2 แถว) =
// unique violation → rollback ทั้งก้อน = ส่งไม่ได้จริง + ไม่มีแถวรอรับของไรเดอร์เลย
import { describe, it, expect } from 'vitest'

import mig187 from '../../supabase/migrations/187_order_message_rider_notifications.sql?raw'
import riderSrc from '@/pages/RiderPwaPage.tsx?raw'
import riderBellSrc from '@/components/notification/RiderBell.tsx?raw'
import bellSrc from '@/components/notification/NotificationDropdown.tsx?raw'

describe('R71 m187 — send_order_message v3: id แยกผู้รับ (ห้ามชน) + แจ้งไรเดอร์', () => {
  it('id แถวแจ้งแยก suffix ต่อผู้รับ -c/-a/-r (m183 ใช้ id เดียวกัน = ไรเดอร์ส่งพัง)', () => {
    expect(mig187).toContain("'msgn-' || v_id || '-c'")
    expect(mig187).toContain("'msgn-' || v_id || '-a'")
    expect(mig187).toContain("'msgn-' || v_id || '-r'")
    // ห้ามกลับไปใช้ id ซ้ำแบบ m183 (VALUES ('msgn-' || v_id, ... สองครั้ง)
    expect(mig187).not.toContain("VALUES ('msgn-' || v_id,")
  })

  it('แจ้งไรเดอร์เมื่อแอดมิน/ลูกค้าส่ง — แถว user_id = drivers.user_id ของงาน (RLS own)', () => {
    expect(mig187).toContain("IF v_role IN ('admin', 'customer') AND v_rider_uid IS NOT NULL THEN")
    expect(mig187).toContain('JOIN public.drivers d ON d.id = da.driver_id')
    expect(mig187).toContain("NOT IN ('cancelled', 'declined')")
    expect(mig187).toContain("'msgn-' || v_id || '-r', NULL, v_rider_uid,")
  })

  it('BEST-EFFORT ทุกแถว · ไม่เขียน outbox ตรง · validate เดิมครบ · แยกชื่อผู้ส่ง', () => {
    expect(mig187).not.toContain('INSERT INTO public.notification_outbox')
    expect(mig187).toContain('EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN')
    expect(mig187).toContain("RAISE EXCEPTION 'ERR_FORBIDDEN'")
    expect(mig187).toContain('public.current_driver_id()')
    expect(mig187).toContain('public.owns_order_msg(p_order_number)')
    expect(mig187).toContain("WHEN 'rider' THEN 'ไรเดอร์'")
    expect(mig187).toContain('CREATE OR REPLACE FUNCTION public.send_order_message(')
  })
})

describe('R71 กระดิ่งฝั่งไรเดอร์ (RiderBell) — เตือนจริง: เสียง + ป้าย + browser + อ่านแล้ว', () => {
  it('RiderBell: poll แถวของตัวเอง + เสียง + ป้ายแดง + browser notification ตอนหน้าไม่โฟกัส', () => {
    expect(riderBellSrc).toContain('export function RiderBell()')
    expect(riderBellSrc).toContain("import { playNotifBeep } from '@/lib/notifBeep'")
    expect(riderBellSrc).toContain('playNotifBeep()')
    expect(riderBellSrc).toContain('data-testid="rider-bell-badge"')
    expect(riderBellSrc).toContain('document.hidden')
    expect(riderBellSrc).toContain("Notification.permission === 'granted'")
  })

  it('RiderBell: อ่านทั้งหมดแล้ว = server-authoritative (markAllNotificationsRead)', () => {
    expect(riderBellSrc).toContain('markAllNotificationsRead')
    expect(riderBellSrc).toContain('data-testid="rider-bell-markall"')
    expect(riderBellSrc).toContain('data-testid="rider-bell-list"')
  })

  it('RiderPwaPage: ติดตั้ง RiderBell + แชตรายงานทุกงานเปิดกางค้าง (details open)', () => {
    expect(riderSrc).toContain("import { RiderBell } from '@/components/notification/RiderBell'")
    expect(riderSrc).toContain('<RiderBell />')
    expect(riderSrc).toContain('<details open className="mt-2" data-testid={`rider-job-chat-${a.order_number}`}>')
    // contract เดิม (r51/r70) — ห้ามหาย
    expect(riderSrc).toContain('OrderChatPanel orderNumber={activeOrder.order_number} role="rider"')
    expect(riderSrc).toContain('OrderChatPanel orderNumber={a.order_number} role="rider"')
  })
})

describe('R71 กระดิ่งเดิม "เตือนจริง" — มาร์กอ่านฝั่ง server ทุกแถว + เด้งเดสก์ท็อป', () => {
  it('กดรายการ = markServerAsRead ทุกแถว (เดิมเฉพาะ evt-*/auto-* = ป้ายแดงกลับมาทุก reload)', () => {
    expect(bellSrc).toContain('void markServerAsRead(n.id)')
    expect(bellSrc).not.toContain("n.id.startsWith('evt-') || n.id.startsWith('auto-')")
  })

  it('มีเสียง + เด้ง browser notification เมื่อหน้าไม่โฟกัส + ไอคอนข้อความ', () => {
    expect(bellSrc).toContain('playNotifBeep()')
    expect(bellSrc).toContain('document.hidden')
    expect(bellSrc).toContain("Notification.permission === 'granted'")
    expect(bellSrc).toContain("ORDER_MESSAGE: '💬'")
  })
})
