// ============================================
// Bite Me Baby — R51: Order chat (ลูกค้า ↔ ไรเดอร์ ↔ แอดมิน)
// ============================================
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }))

import { chatComposeGuard, CHAT_POLL_MS, CHAT_ROLE_LABELS, CHAT_MAX_LEN } from '@/lib/orderMessages'
import libSrc from '@/lib/orderMessages.ts?raw'
import panelSrc from '@/components/messages/OrderChatPanel.tsx?raw'
import migSrc from '../../supabase/migrations/182_order_messages.sql?raw'
import ordersSrc from '@/pages/OrdersPage.tsx?raw'
import adminSrc from '@/pages/admin/AdminOrders.tsx?raw'
import riderSrc from '@/pages/RiderPwaPage.tsx?raw'

describe('R51 แชตออเดอร์ m182 — migration (PREPARED · ยังไม่ apply)', () => {
  it('ตาราง + RLS + policies: อ่านเฉพาะ เจ้าของ/ไรเดอร์ที่ผูกงาน/แอดมิน · ห้ามเขียนตรง', () => {
    expect(migSrc).toContain('CREATE TABLE IF NOT EXISTS public.order_messages')
    expect(migSrc).toContain("CHECK (sender_role IN ('customer', 'rider', 'admin'))")
    expect(migSrc).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migSrc).toContain('order_messages_select')
    expect(migSrc).toContain('public.owns_order_msg(order_number)')
    expect(migSrc).toContain('public.drives_order_msg(order_number)')
    // ไม่มี INSERT/UPDATE/DELETE policy — เขียนผ่าน RPC เท่านั้น (direct write ถูก RLS บล็อก)
    expect(migSrc).not.toMatch(/CREATE POLICY[^;]*FOR INSERT/s)
    expect(migSrc).not.toMatch(/CREATE POLICY[^;]*FOR UPDATE/s)
    expect(migSrc).toContain('REVOKE ALL ON public.order_messages FROM anon')
  })

  it('send_order_message = SECURITY DEFINER จุดเขียนเดียว · validate ครบทุก role · id ไม่ใช้ to_char ล้น', () => {
    expect(migSrc).toContain('CREATE OR REPLACE FUNCTION public.send_order_message(')
    expect(migSrc).toContain('SECURITY DEFINER')
    expect(migSrc).toContain("IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'")
    expect(migSrc).toContain("RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;") // rider gate ในบล็อกเดียวกัน
    expect(migSrc).toContain('public.current_driver_id()')
    expect(migSrc).toContain("length(btrim(p_body)) > 2000")
    expect(migSrc).toContain("::bigint::text")
    expect(migSrc).not.toContain("to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')")
    expect(migSrc).toContain('REVOKE ALL ON FUNCTION public.send_order_message')
  })

  it('เชื่อมระบบเดิม: REUSE enqueue_notification (m179) event_key msg- · ไม่เขียน outbox เอง', () => {
    expect(migSrc).toContain('PERFORM public.enqueue_notification(')
    expect(migSrc).toContain("'msg-' || v_id")
    expect(migSrc).toContain('idempotent')
    // ไม่มี INSERT เข้า notification_outbox ตรง ๆ (ห้ามสร้าง logic ซ้ำ)
    expect(migSrc).not.toContain('INSERT INTO public.notification_outbox')
  })
})

describe('R51 แชต — client lib + panel', () => {
  it('lib: เขียนผ่าน RPC เดียว + poll ไม่ใช้ realtime', () => {
    expect(libSrc).toContain("supabase.rpc('send_order_message'")
    expect(libSrc).toContain("from('order_messages')")
    expect(libSrc).toContain('CHAT_POLL_MS = 10_000')
    expect(libSrc).not.toContain('postgres_changes')
    expect(libSrc).not.toContain('.channel(')
    expect(CHAT_POLL_MS).toBe(10_000)
    expect(CHAT_ROLE_LABELS).toEqual({ customer: 'ลูกค้า', rider: 'ไรเดอร์', admin: 'ร้าน' })
  })

  it('chatComposeGuard: pure — ว่าง/เกินขอบ/ผ่าน', () => {
    expect(chatComposeGuard('')).toBeTruthy()
    expect(chatComposeGuard('   ')).toBeTruthy()
    expect(chatComposeGuard('x'.repeat(CHAT_MAX_LEN + 1))).toBeTruthy()
    expect(chatComposeGuard('สวัสดีครับ')).toBeNull()
  })

  it('panel: testids ครบ · poll ทุก 10 วิ · ไม่ใช้ realtime channel', () => {
    expect(panelSrc).toContain('data-testid="order-chat-panel"')
    expect(panelSrc).toContain('data-testid="order-chat-list"')
    expect(panelSrc).toContain('data-testid="order-chat-input"')
    expect(panelSrc).toContain('data-testid="order-chat-send"')
    expect(panelSrc).toContain('CHAT_POLL_MS')
    expect(panelSrc).toContain('setInterval')
    expect(panelSrc).not.toContain('postgres_changes')
    expect(panelSrc).not.toContain('.channel(')
  })

  it('ฝังครบทั้ง 3 ฝั่ง — component เดียว ไม่มี logic ซ้ำ', () => {
    expect(ordersSrc).toContain('OrderChatPanel orderNumber={o.order_number} role="customer"')
    expect(adminSrc).toContain('OrderChatPanel orderNumber={order.order_number} role="admin"')
    expect(riderSrc).toContain('OrderChatPanel orderNumber={activeOrder.order_number} role="rider"')
  })
})
