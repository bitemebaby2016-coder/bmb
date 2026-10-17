// ============================================
// Bite Me Baby — round-key link: menu_schedule ↔ delivery_rounds
// (Owner 2026-10-17: "menu schedule ซ้ำซ้อนกับ pre-order ให้ลิ้งค์กันจริงด้วย
//  round key + ปุ่มเปิดปิดทุกรอบส่ง + แอดมินเป็นสวิตช์/ดรอปดาวน์")
// ============================================

import { describe, it, expect } from 'vitest'
import {
  roundKeyOptions,
  nextRoundStatus,
  toggleDraftEntry,
  mirrorPreOrderScheduleGate,
  type MenuScheduleRow,
} from '@/lib/bmbMenuSchedule'
import adminMenuScheduleSrc from '../pages/admin/AdminMenuSchedule.tsx?raw'
import adminRoundsSrc from '../pages/admin/AdminRounds.tsx?raw'

const T = '2026-10-20'
const mkRow = (over: Partial<MenuScheduleRow> = {}): MenuScheduleRow => ({
  id: 'ms-1',
  scheduled_date: T,
  product_id: 'prod-5',
  delivery_round_key: null,
  is_published: true,
  note: '',
  ...over,
})

describe('roundKeyOptions — dropdown ผูกกับ delivery_rounds จริง (ไม่ hardcode)', () => {
  it('ไม่มีรอบ → มีแค่ "ทุกรอบ" (ไม่มี morning/midday/evening สำเร็จรูปโผล่มาเอง)', () => {
    expect(roundKeyOptions([])).toEqual([{ key: '', label: 'ทุกรอบ' }])
    expect(roundKeyOptions([{ round_key: null, display_name: 'x' }])).toEqual([{ key: '', label: 'ทุกรอบ' }])
  })

  it('key ทุกตัวเลือกมาจาก round_key ของรอบจริง (round key แปลก ๆ อย่าง brunch ก็ผ่าน)', () => {
    const opts = roundKeyOptions([
      { round_key: 'brunch', display_name: 'สายพิเศษ', delivery_start: '10:00:00', delivery_end: '12:30:00', status: 'active' },
    ])
    expect(opts.map((o) => o.key)).toEqual(['', 'brunch'])
    expect(opts[1].label).toContain('สายพิเศษ')
    expect(opts[1].label).toContain('10:00–12:30')
  })

  it('รอบซ้ำ round_key ถูก dedupe + รอบปิดรับมีป้าย "ปิดรับ" (แอดมินยังเห็น/ย้ายเมนูได้)', () => {
    const opts = roundKeyOptions([
      { round_key: 'midday', display_name: 'เที่ยง', delivery_start: '11:00:00', delivery_end: '13:00:00', status: 'active' },
      { round_key: 'midday', display_name: 'เที่ยง(ซ้ำ)', status: 'active' },
      { round_key: 'evening', display_name: 'เย็น', delivery_start: '16:30:00', delivery_end: '19:00:00', status: 'closed' },
    ])
    expect(opts.map((o) => o.key)).toEqual(['', 'midday', 'evening'])
    expect(opts[1].label).toContain('เที่ยง')
    expect(opts[1].label).not.toContain('ซ้ำ')
    expect(opts[2].label).toContain('ปิดรับ')
  })
})

describe('สวิตช์เปิด/ปิดทุกรอบส่ง — active ↔ closed', () => {
  it('nextRoundStatus สลับสถานะเดียว (idempotent ต่อค่าที่ไม่ใช่ active)', () => {
    expect(nextRoundStatus('active')).toBe('closed')
    expect(nextRoundStatus('closed')).toBe('active')
    expect(nextRoundStatus(null)).toBe('active')
    expect(nextRoundStatus('')).toBe('active')
    expect(nextRoundStatus('paused')).toBe('active')
  })

  it('สวิตช์เมนูรายสินค้า: on = อยู่ในเมนู, off = __off__ (sentinel เดิมของการ Save replace-all)', () => {
    const d0: Record<string, string> = {}
    const d1 = toggleDraftEntry(d0, 'prod-5', true)
    expect(d1['prod-5']).toBe('') // '' = ทุกรอบ
    const d2 = toggleDraftEntry(d1, 'prod-5', false)
    expect(d2['prod-5']).toBe('__off__')
    const d3 = toggleDraftEntry(d2, 'prod-5', true)
    expect(d3['prod-5']).toBe('') // กลับมา = ทุกรอบ (sentinel __off__ ไม่เก็บ key เดิม — semantics เดียวกับ checkbox ดั้งเดิม)
    // off = ถูกตัดออกจาก items ตอน Save (replace-all) — key เดิมหายตามไป ไม่ใช่บั๊ก
    const d4 = toggleDraftEntry({ 'prod-5': 'evening' }, 'prod-5', false)
    expect(d4['prod-5']).toBe('__off__')
    // แต่ key คงอยู่ระหว่าง on→on (สลับสวิตช์เฉพาะตอนที่ on เท่านั้นที่แตะ key)
    const dKeep = toggleDraftEntry({ 'prod-5': 'evening' }, 'prod-5', true)
    expect(dKeep['prod-5']).toBe('evening')
  })

  it('toggleDraftEntry ไม่ mutate draft เดิม (immutable)', () => {
    const d0: Record<string, string> = { 'prod-5': 'midday' }
    const d1 = toggleDraftEntry(d0, 'prod-5', false)
    expect(d0['prod-5']).toBe('midday')
    expect(d1).not.toBe(d0)
  })
})

describe('ลิงก์จริง end-to-end: dropdown key ชุดเดียวกับที่ pre-order gate/checkout ใช้', () => {
  it('schedule row ที่ผูก round_key จากรอบจริง → ผ่าน gate เมื่อ checkout เลือกรอบนั้น และถูกปฏิเสธเมื่อเลือกอีกรอบ', () => {
    const rounds = [
      { round_key: 'midday', display_name: 'เที่ยง', status: 'active' },
      { round_key: 'evening', display_name: 'เย็น', status: 'active' },
    ]
    const keys = roundKeyOptions(rounds).map((o) => o.key)
    expect(keys).toContain('midday')
    const rows = [mkRow({ product_id: 'prod-5', delivery_round_key: 'midday' })]
    // CheckoutPage ส่ง selectedRound.round_key + display_name แบบเดียวกัน (ตรวจแล้ว L420)
    expect(mirrorPreOrderScheduleGate([{ product_id: 'prod-5', quantity: 1 }], T, rows, 'midday', 'เที่ยง').allowed).toBe(true)
    const wrong = mirrorPreOrderScheduleGate([{ product_id: 'prod-5', quantity: 1 }], T, rows, 'evening', 'เย็น')
    expect(wrong.allowed).toBe(false)
    expect(wrong.rejected?.[0]?.code).toBe('ERR_PRODUCT_NOT_ON_MENU')
  })
})

describe('source invariants — แอดมินเป็นสวิตช์ + ดรอปดาวน์รอบจริง (ไม่เหลือ hardcode)', () => {
  it('AdminMenuSchedule: ใช้ getRoundsForDateAdmin + ToggleSwitch + roundKeyOptions และไม่มี ROUND_KEY_OPTIONS hardcode', () => {
    expect(adminMenuScheduleSrc).toContain('getRoundsForDateAdmin')
    expect(adminMenuScheduleSrc).toContain('ToggleSwitch')
    expect(adminMenuScheduleSrc).toContain('roundKeyOptions(dateRounds)')
    expect(adminMenuScheduleSrc).toContain('data-testid="round-toggles"')
    expect(adminMenuScheduleSrc).not.toContain('ROUND_KEY_OPTIONS')
    expect(adminMenuScheduleSrc).not.toContain("'morning'")
    expect(adminMenuScheduleSrc).not.toContain('type="checkbox"')
    expect(adminMenuScheduleSrc).not.toContain('void rounds')
  })

  it('AdminRounds: เปิด/ปิดรอบเป็น ToggleSwitch (ไม่ใช่ปุ่มคู่ open/close)', () => {
    expect(adminRoundsSrc).toContain('ToggleSwitch')
    expect(adminRoundsSrc).toContain('nextRoundStatus')
    expect(adminRoundsSrc).not.toContain('Close round')
    expect(adminRoundsSrc).not.toContain('Open round')
  })
})
