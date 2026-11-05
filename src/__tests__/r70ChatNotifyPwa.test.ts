// ============================================
// Bite Me Baby — R70: แชตสมบูรณ์ (กล่องโต้ตอบ+แจ้งเตือนข้อความ) + PWA/Push prompt
// ============================================
// Source-contract tests (pattern เดียวกับ r51Chat) — ไม่แตะ logic เดิมที่ผ่านแล้ว
import { describe, it, expect } from 'vitest'

import migSrc from '../../supabase/migrations/183_order_message_notifications.sql?raw'
import panelSrc from '@/components/messages/OrderChatPanel.tsx?raw'
import beepSrc from '@/lib/notifBeep.ts?raw'
import trackSrc from '@/pages/OrderTrackPage.tsx?raw'
import ordersSrc from '@/pages/OrdersPage.tsx?raw'
import riderSrc from '@/pages/RiderPwaPage.tsx?raw'
import bellSrc from '@/components/notification/NotificationDropdown.tsx?raw'
import promptSrc from '@/components/notification/PushPermissionPrompt.tsx?raw'

describe('R70 m183 — แจ้งเตือนข้อความผ่านตาราง notifications เดิม (ไม่เขียน outbox เอง)', () => {
  it('แอดมิน/ไรเดอร์ → ลูกค้า: แถว customer-owned (กระดิ่งลูกค้า + builder ntf- = push เดิม)', () => {
    expect(migSrc).toContain("IF v_role IN ('admin', 'rider') AND v_customer_id IS NOT NULL THEN")
    expect(migSrc).toContain("INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)")
    expect(migSrc).toContain("'msgn-' || v_id")
    expect(migSrc).toContain("'💬 ข้อความใหม่จากร้าน'")
    expect(migSrc).toContain("'ORDER_MESSAGE'")
  })

  it('ลูกค้า/ไรเดอร์ → แอดมิน: customer_id/user_id = NULL (RLS เห็นเฉพาะ is_admin · builder ข้าม)', () => {
    expect(migSrc).toContain("IF v_role IN ('customer', 'rider') THEN")
    expect(migSrc).toContain("VALUES ('msgn-' || v_id, NULL, NULL,")
    expect(migSrc).toContain("💬 ข้อความใหม่จาก")
    // ตาราง notifications.customer_id ต้องรับ NULL ได้ (แถวแจ้งแอดมิน)
    expect(migSrc).toContain('ALTER TABLE public.notifications ALTER COLUMN customer_id DROP NOT NULL')
  })

  it('ยังไม่เขียน notification_outbox ตรง · BEST-EFFORT ไม่บล็อกการส่งข้อความ · validate เดิมครบ', () => {
    expect(migSrc).not.toContain('INSERT INTO public.notification_outbox')
    expect(migSrc).toContain('EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN')
    expect(migSrc).toContain("RAISE EXCEPTION 'ERR_FORBIDDEN'")
    expect(migSrc).toContain('public.owns_order_msg(p_order_number)')
    expect(migSrc).toContain('public.current_driver_id()')
    expect(migSrc).toContain('CREATE OR REPLACE FUNCTION public.send_order_message(')
  })
})

describe('R70 กล่องข้อความโต้ตอบ — ลูกค้า/ไรเดอร์ เห็นและตอบได้จริงทุกหน้าที่ใช้', () => {
  it('หน้าติดตามออเดอร์ (ทางเข้าจากแจ้งเตือน) = มีแชตลูกค้า', () => {
    expect(trackSrc).toContain('OrderChatPanel orderNumber={order.order_number} role="customer"')
    expect(trackSrc).toContain('data-testid="track-order-chat"')
    expect(trackSrc).toContain('isAuthenticated')
  })

  it('OrdersPage = แชตเปิดเผยไม่พับซ่อน (details open)', () => {
    expect(ordersSrc).toContain('<details className="mt-2" open data-testid={`order-chat-details-${o.order_number}`}>')
    expect(ordersSrc).toContain('OrderChatPanel orderNumber={o.order_number} role="customer"')
  })

  it('ไรเดอร์ = แชตทุกงานจากรายการ (ไม่ต้องเปิดงานก่อน) + แชตงานปัจจุบันเดิมคงอยู่', () => {
    expect(riderSrc).toContain('OrderChatPanel orderNumber={a.order_number} role="rider"')
    expect(riderSrc).toContain('data-testid={`rider-job-chat-${a.order_number}`}')
    // contract เดิม (r51Chat) — ห้ามหาย
    expect(riderSrc).toContain('OrderChatPanel orderNumber={activeOrder.order_number} role="rider"')
  })
})

describe('R70 แจ้งเตือนข้อความใหม่ในแผงแชต (เสียง + badge + browser)', () => {
  it('panel: จับข้อความใหม่จากอีกฝั่ง · เสียง · badge "มีข้อความใหม่" · browser notification', () => {
    expect(panelSrc).toContain("import { playNotifBeep } from '@/lib/notifBeep'")
    expect(panelSrc).toContain('playNotifBeep()')
    expect(panelSrc).toContain('data-testid="order-chat-new-pill"')
    expect(panelSrc).toContain('มีข้อความใหม่')
    expect(panelSrc).toContain('notifyBrowser')
    expect(panelSrc).toContain("m.sender_role !== role")
  })

  it('beep กลางอยู่ที่ lib/notifBeep (ไม่ duplicate ใน bell)', () => {
    expect(beepSrc).toContain('export function playNotifBeep()')
    expect(bellSrc).toContain("import { playNotifBeep } from '@/lib/notifBeep'")
    expect(bellSrc).not.toContain('function playNotifBeep()')
  })
})

describe('R70 PWA/Push prompt — ต้องใช้งานได้จริง (root cause: bell แย่ง native prompt)', () => {
  it('bell ไม่เรียก requestBrowserPermission เองอีก (บล็อก friendly prompt + grant โดยไม่ subscribe)', () => {
    expect(bellSrc).not.toContain('requestBrowserPermission()')
    expect(bellSrc).not.toContain('Notification.requestPermission')
  })

  it('prompt: auto-heal granted-but-unsubscribed · gate เฉพาะลูกค้า · error copy บอกทางแก้', () => {
    expect(promptSrc).toContain('getCurrentPushSubscription')
    expect(promptSrc).toContain("enablePush('customer')")
    expect(promptSrc).toContain("role == null || role === 'customer'")
    expect(promptSrc).toContain('ERR_PUSH_DISABLED')
    expect(promptSrc).toContain('ERR_NO_VAPID_KEY')
    expect(promptSrc).toContain('push-permission-prompt')
    expect(promptSrc).toContain('push-permission-accept')
    expect(promptSrc).toContain('push-permission-later')
  })
})
