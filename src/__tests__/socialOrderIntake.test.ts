// ============================================
// Bite Me Baby — social order intake contract (Owner 2026-10-17 §3/§4)
// AI สร้างออเดอร์ "ใหม่" ผ่าน workflow ที่อนุญาต (canonical RPC, idempotent)
// ห้ามแก้ไขออเดอร์เดิม · ห้ามเคลมสำเร็จก่อนระบบยืนยัน · ไม่ชัดเจน = ถามก่อน
// ============================================

import { describe, it, expect } from 'vitest'
import intakeSrc from '../../supabase/functions/_shared/socialOrderIntake.ts?raw'
import workerSrc from '../../supabase/functions/social-ai-worker/index.ts?raw'
import {
  semanticOrderExtract,
  matchOrderItems,
  buildIntakeLine,
  ORDER_EXTRACT_SCHEMA,
  type SubmitOrderResult,
} from '../../supabase/functions/_shared/socialOrderIntake.ts'
import { parseStructuredOutput } from '../../supabase/functions/_shared/aiStructuredOutput.ts'
import type { OrderExtractCheck } from '../../supabase/functions/_shared/socialOrderIntake.ts'

/** Narrow helper: assert ok แล้วคืน value (ไม่ให้ test เข้าถึง .value ตรง ๆ). */
function val(s: OrderExtractCheck) {
  if (!s.ok) throw new Error('expected ok, got: ' + s.reason)
  return s.value
}

const extract = (over: Record<string, unknown> = {}) => ({
  wants_order: true,
  items: [{ name: 'ผัดไทย', quantity: 2 }],
  confirmed: true,
  order_mode: 'SAME_DAY',
  scheduled_date: '',
  customer_phone: '0812345678',
  address: 'บ้านเลขที่ 1',
  unclear: '',
  ...over,
})

describe('ORDER_EXTRACT_SCHEMA — structured extraction ผ่าน validator จริง', () => {
  it('JSON ครบ schema → ผ่าน', () => {
    const r = parseStructuredOutput(JSON.stringify(extract()), ORDER_EXTRACT_SCHEMA as never)
    expect(r.ok).toBe(true)
  })
  it('missing field / wrong enum → fail closed', () => {
    expect(parseStructuredOutput(JSON.stringify(extract({ unclear: undefined })), ORDER_EXTRACT_SCHEMA as never).ok).toBe(false)
    expect(parseStructuredOutput(JSON.stringify(extract({ order_mode: 'DELIVER_NOW' })), ORDER_EXTRACT_SCHEMA as never).ok).toBe(false)
  })
})

describe('semanticOrderExtract — ถามก่อน ห้ามเดา (§4)', () => {
  it('confirmed ครบข้อมูล → ผ่าน', () => {
    const s = val(semanticOrderExtract(extract()))
    expect(s.confirmed).toBe(true)
    expect(s.items[0]).toEqual({ name: 'ผัดไทย', quantity: 2 })
  })
  it('unclear ไม่ว่าง → confirmed ถูกบังคับ false (ต้องถามลูกค้าก่อน)', () => {
    const s = val(semanticOrderExtract(extract({ unclear: 'ไม่แน่ใจจำนวน' })))
    expect(s.confirmed).toBe(false)
  })
  it('quantity นอกช่วง 1-20 → reject (ไม่ปัดเศษ/เดาแทนลูกค้า)', () => {
    expect(semanticOrderExtract(extract({ items: [{ name: 'ก', quantity: 0 }] })).ok).toBe(false)
    expect(semanticOrderExtract(extract({ items: [{ name: 'ก', quantity: 21 }] })).ok).toBe(false)
    expect(semanticOrderExtract(extract({ items: [{ name: 'ก', quantity: 1.5 }] })).ok).toBe(false)
    expect(semanticOrderExtract(extract({ items: [{ name: '', quantity: 1 }] })).ok).toBe(false)
  })
  it('PRE_ORDER ไม่ระบุวันที่ → confirmed ถูกบังคับ false', () => {
    const s = val(semanticOrderExtract(extract({ order_mode: 'PRE_ORDER', scheduled_date: '' })))
    expect(s.confirmed).toBe(false)
  })
  it('order_mode UNSURE → confirmed ถูกบังคับ false', () => {
    expect(val(semanticOrderExtract(extract({ order_mode: 'UNSURE' }))).confirmed).toBe(false)
  })
  it('items ไม่ใช่ array / raw ไม่ใช่ object → fail closed ไม่ throw', () => {
    expect(semanticOrderExtract(null).ok).toBe(true)
    const s = semanticOrderExtract(extract({ items: 'x' }))
    expect(s.ok).toBe(true)
    expect(val(s).confirmed).toBe(false)
  })
})

describe('matchOrderItems — จับคู่กับ Catalog จริงเท่านั้น (ห้ามเดาสินค้าแทนลูกค้า)', () => {
  const catalog = [
    { id: 'prod-1', name: 'ผัดไทยกุ้งสด', is_available: true },
    { id: 'prod-2', name: 'ข้าวผัด', is_available: true },
  ]
  it('ชื่อตรง/ชื่อย่อ → match', () => {
    const m = matchOrderItems(catalog, [{ name: 'ผัดไทยกุ้งสด', quantity: 1 }, { name: 'ข้าวผัด', quantity: 2 }])
    expect(m.unmatched).toEqual([])
    expect(m.matched).toEqual([
      { product_id: 'prod-1', name: 'ผัดไทยกุ้งสด', quantity: 1 },
      { product_id: 'prod-2', name: 'ข้าวผัด', quantity: 2 },
    ])
  })
  it('ชื่อที่ไม่มีใน catalog → unmatched (ให้ถามลูกค้า ไม่สั่งแทน)', () => {
    const m = matchOrderItems(catalog, [{ name: 'พิซซ่า', quantity: 1 }])
    expect(m.matched).toEqual([])
    expect(m.unmatched).toEqual(['พิซซ่า'])
  })
})

describe('buildIntakeLine — ระบบเป็นคนเขียน ห้ามเคลมก่อนระบบยืนยัน (§3)', () => {
  const ok: SubmitOrderResult = { ok: true, order_number: 'BMB-20261017-001', duplicate: false }
  it('สำเร็จ → มีเลขที่ออเดอร์จากระบบจริง + ลิงก์ชำระเงิน (ไม่เคลมว่าชำระเงินแล้ว)', () => {
    const line = buildIntakeLine(ok)
    expect(line.confirmed).toBe(true)
    expect(line.text).toContain('BMB-20261017-001')
    expect(line.text).toContain('/payment/BMB-20261017-001')
    expect(line.text).not.toMatch(/ชำระเงินสำเร็จ|ยืนยันการชำระเงิน/)
  })
  it('duplicate (webhook retry) → เลขที่เดิม + บอกว่าเคยบันทึกแล้ว (ไม่สร้างซ้ำ)', () => {
    const line = buildIntakeLine({ ...ok, duplicate: true })
    expect(line.confirmed).toBe(true)
    expect(line.text).toContain('BMB-20261017-001')
    expect(line.text).toContain('เคยบันทึกไว้แล้ว')
  })
  it('ล้มเหลว → ไม่มีเลขที่ออเดอร์ ไม่บอกว่าสำเร็จ + ชี้ไปหน้าร้าน', () => {
    const line = buildIntakeLine({ ok: false, error: 'ERR_CAPACITY_FULL' })
    expect(line.confirmed).toBe(false)
    expect(line.text).not.toMatch(/เลขที่|BMB-/)
    expect(line.text).toContain('ยังไม่ยืนยัน')
    expect(line.text).toContain('/checkout')
  })
})

describe('shared intake = CREATE-ONLY + idempotent (source contract)', () => {
  it('create ผ่าน canonical RPC เท่านั้น + idempotent ด้วย external ref', () => {
    expect(intakeSrc).toMatch(/rpc\/create_order_with_items/)
    expect(intakeSrc).toMatch(/p_external_ref_id/)
    expect(intakeSrc).toMatch(/p_source_channel/)
    // create-only: ห้ามมี mutation surface ของออเดอร์เดิม
    expect(intakeSrc).not.toMatch(/record_payment|confirm_offline_payment|transition_order_status|mark_payment_failed|cancel_order|refund|update_order|delete_order|assign_driver|delivery_assignments|transition_order/)
  })
  it('ไม่มี update/delete/upsert บนตารางธุรกิจ', () => {
    expect(intakeSrc).not.toMatch(/\.update\(|\.delete\(|\.upsert\(/)
    expect(intakeSrc).not.toMatch(/orders\?id=eq|from\('orders'\)/)
  })
  it('round resolution อ่านเฉพาะรอบ active + มีที่ว่าง (server re-validate ตอน create)', () => {
    expect(intakeSrc).toMatch(/status=eq\.active/)
    expect(intakeSrc).toMatch(/max_capacity/)
    expect(intakeSrc).toMatch(/ERR_NO_EXTERNAL_REF/)
  })
})

describe('worker wiring — intake เฉพาะช่องทางส่วนตัว + ไม่เงียบ (§4/§5)', () => {
  it('สร้างออเดอร์เฉพาะ event_type === message — comment = สรุป+ลิงก์ตะกร้า ไม่สร้างเอง ไม่เปิดเผยส่วนตัว (R27 ปรับตาม Owner)', () => {
    expect(workerSrc).toMatch(/ev\.event_type === 'message'/)
    expect(workerSrc).toMatch(/mode === 'comment'/)
    expect(workerSrc).toMatch(/ห้ามเปิดเผยข้อมูลส่วนตัวในคอมเมนต์/)
    expect(workerSrc).toMatch(/buildCartSummaryFooter/)
  })
  it('มี fallback เมื่อ draft พังแต่ระบบมีผลจริงแล้ว — ไม่เงียบหาย', () => {
    expect(workerSrc).toMatch(/fallbackIntakeReply/)
    expect(workerSrc).toMatch(/intake_fallback/)
  })
  it('footer ระบบแนบท้ายจากผลจริงเท่านั้น + ห้าม AI แต่งเลขที่เอง', () => {
    expect(workerSrc).toMatch(/buildIntakeLine/)
    expect(workerSrc).toMatch(/ห้ามแต่งเลขที่อ/)
  })
  it('idempotency: submit ด้วย event id เสมอ (webhook retry ไม่สร้างซ้ำ)', () => {
    expect(workerSrc).toMatch(/externalRef: ev\.event_id/)
  })
})