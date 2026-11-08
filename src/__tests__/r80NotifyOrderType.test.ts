// ============================================
// Bite Me Baby — R80 (Owner 2026-11-07)
// ① D-4: "ไม่มีแจ้งเตือนจากเฟซเวลาเอไอตอบโพสและข้อความ" → เอ_aiตอบคอมเมนต์/ข้อความ
//    และเอ_aiโพสขึ้น Facebook → แจ้งทีมแอดมินผ่าน m179 (enqueue_notification → outbox →
//    cron bmb-notify ≤5 นาที → Notification Center + push) — side-channel ห้ามกระทบ flow หลัก
// ② ชนิดออเดอร์ต้องแยกถูกตอนเอ_aiสรุป/โพส: order_mode (ส่งวันนี้/พรีออเดอร์) +
//    service_type (ทานที่ร้าน/สั่งกลับบ้าน/รับที่ร้าน) — ห้ามเดา ไม่ชัดเจน = ถามก่อน
// ============================================

import { describe, it, expect } from 'vitest'
import notifySrc from '../../supabase/functions/_shared/notificationLinks.ts?raw'
import workerSrc from '../../supabase/functions/social-ai-worker/index.ts?raw'
import automationSrc from '../../supabase/functions/automation-worker/index.ts?raw'
import {
  ORDER_EXTRACT_SCHEMA,
  ORDER_EXTRACT_SYSTEM,
  ORDER_MODE_LABELS,
  SERVICE_TYPE_LABELS,
  buildIntakeLine,
  type SubmitOrderResult,
} from '../../supabase/functions/_shared/socialOrderIntake.ts'
import { STICKER_SERVICE_LABELS } from '../lib/stickerForm'

const ok = { ok: true, order_number: 'BMB-20261107-999', duplicate: false } as SubmitOrderResult

describe('R80 ① D-4 admin notification bridge', () => {
  it('notificationLinks ยิงผ่าน RPC enqueue_notification (idempotent event_key ต่อผู้รับ)', () => {
    expect(notifySrc).toContain('rpc/enqueue_notification')
    expect(notifySrc).toContain('`${a.eventKey}-${id}`')
    expect(notifySrc).toContain('p_customer_id')
    expect(notifySrc).toContain('p_event_key')
  })

  it('resolve ผู้รับจาก profiles.role (owner/manager/staff/admin) → customers.id — ไม่ hardcode', () => {
    expect(notifySrc).toContain('owner,manager,staff,admin')
    expect(notifySrc).toContain('/rest/v1/profiles?select=user_id,role')
    expect(notifySrc).toContain('/rest/v1/customers?select=id&user_id=in.')
  })

  it('social-ai-worker เรียกแจ้งเตือนหลังตอบสำเร็จ 2 จุด (main + fallback) พร้อม guard ห้ามกระทบ flow', () => {
    const defs = (workerSrc.match(/notifyOwnerAiReply/g) || []).length
    expect(defs).toBeGreaterThanOrEqual(3)
    expect(workerSrc).toContain('if (sent.ok) void notifyOwnerAiReply(ev)')
    const sends = (workerSrc.match(/void notifyOwnerAiReply\(ev\)/g) || []).length
    expect(sends).toBeGreaterThanOrEqual(2)
    const i = workerSrc.indexOf('async function notifyOwnerAiReply')
    expect(i).toBeGreaterThan(0)
    expect(workerSrc.slice(i, i + 600)).toContain('catch')
  })

  it('automation-worker แจ้งเตือนเมื่อโพสขึ้น Facebook สำเร็จ (side-channel .catch)', () => {
    expect(automationSrc).toContain('marketing-post-published-')
    expect(automationSrc).toContain('import { enqueueAdminAlert }')
    expect(automationSrc).toContain('.catch(() => {')
  })
})

describe('R80 ② ชนิดออเดอร์แยกถูก (order_mode + service_type)', () => {
  it('ป้าย service_type ตรงกับ STICKER_SERVICE_LABELS ฝั่งสติกเกอร์ (กัน drift 3 หมวด)', () => {
    expect(SERVICE_TYPE_LABELS.DINE_IN).toBe(STICKER_SERVICE_LABELS.dine_in)
    expect(SERVICE_TYPE_LABELS.TAKEAWAY).toBe(STICKER_SERVICE_LABELS.takeaway)
    expect(SERVICE_TYPE_LABELS.PICKUP).toBe(STICKER_SERVICE_LABELS.pickup)
    expect(SERVICE_TYPE_LABELS.UNSURE).toContain('ถาม')
  })

  it('ป้าย order_mode แยก ส่งวันนี้ / พรีออเดอร์', () => {
    expect(ORDER_MODE_LABELS.SAME_DAY).toContain('ส่งวันนี้')
    expect(ORDER_MODE_LABELS.PRE_ORDER).toContain('พรีออเดอร์')
  })

  it('buildIntakeLine แนบบรรทัดประเภทเมื่อส่ง types — และของเดิมไม่เปลี่ยนเมื่อไม่ส่ง', () => {
    const line = buildIntakeLine(ok, undefined, { orderMode: 'PRE_ORDER', serviceType: 'PICKUP' })
    expect(line.text).toContain('📦 ประเภทออเดอร์')
    expect(line.text).toContain('พรีออเดอร์ (Pre-Order)')
    expect(line.text).toContain('รับที่ร้าน')
    const legacy = buildIntakeLine(ok)
    expect(legacy.text).not.toContain('ประเภทออเดอร์')
  })

  it('schema extraction มี service_type (optional — ของเดิมต้องรอด) ครบ 4 ค่า', () => {
    const st = (ORDER_EXTRACT_SCHEMA as Record<string, { required?: boolean; enumValues?: string[] }>).service_type
    expect(st).toBeTruthy()
    expect(st?.required).toBe(false)
    expect(st?.enumValues).toEqual(['DINE_IN', 'TAKEAWAY', 'PICKUP', 'UNSURE'])
  })

  it('SYSTEM prompt สั่งแยกชนิด + ห้ามเดา และ worker ส่ง types เข้า buildIntakeLine', () => {
    expect(ORDER_EXTRACT_SYSTEM).toContain('DINE_IN')
    expect(ORDER_EXTRACT_SYSTEM).toContain('TAKEAWAY')
    expect(ORDER_EXTRACT_SYSTEM).toContain('PICKUP')
    expect(ORDER_EXTRACT_SYSTEM).toContain('UNSURE')
    expect(ORDER_EXTRACT_SYSTEM).toContain('ห้ามเดา')
    expect(workerSrc).toContain(
      'buildIntakeLine(res, undefined, { orderMode: x.order_mode, serviceType: x.service_type })',
    )
    expect(workerSrc).toContain('ห้ามเดา ถ้าไม่ชัดเจนให้ถามลูกค้าเพิ่ม')
  })
})
