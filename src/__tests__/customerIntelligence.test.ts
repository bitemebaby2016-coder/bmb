// ============================================
// Bite Me Baby — CAP-21 Customer Intelligence (เจาะกลุ่มลูกค้า อัตโนมัติ)
// Owner 2026-10-26 "ทำต่อให้สมบูรณ์" + audit D11 "ต้องเป็นอัตโนมัติ ไม่ต้องให้แอดมินกำหนด"
// ============================================

import { describe, it, expect } from 'vitest'
import {
  INTELLIGENCE_THRESHOLDS,
  classifyOrderFrequency,
  daysSince,
  deriveCustomerInsight,
  frequencyLabelTh,
  segmentLabelTh,
  segmentTally,
} from '@/lib/customerIntelligence'
import adminCustomersSrc from '../pages/admin/AdminCustomers.tsx?raw'
import intelligenceSrc from '../lib/customerIntelligence.ts?raw'

const NOW = Date.parse('2026-10-26T04:00:00Z') // 11:00 กรุงเทพ
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

/** ตัด comment ออกก่อนตรวจ contract — ตรวจ "โค้ด" ไม่ใช่คำใน comment (แบบ canonicalFallbackContract) */
const stripComments = (src: string) =>
  src
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')

const customersCode = stripComments(adminCustomersSrc)
const intelligenceCode = stripComments(intelligenceSrc)

describe('classifyOrderFrequency — แบ่งจากจำนวนออเดอร์ล้วน', () => {
  it('boundary ครบทุกช่วง + ข้อมูลผิดไม่นับว่าเคยสั่ง', () => {
    expect(classifyOrderFrequency(0)).toBe('new_customer')
    expect(classifyOrderFrequency(-5)).toBe('new_customer')
    expect(classifyOrderFrequency(1)).toBe('occasional')
    expect(classifyOrderFrequency(INTELLIGENCE_THRESHOLDS.occasionalMaxOrders)).toBe('occasional')
    expect(classifyOrderFrequency(INTELLIGENCE_THRESHOLDS.occasionalMaxOrders + 1)).toBe('regular')
    expect(classifyOrderFrequency(INTELLIGENCE_THRESHOLDS.loyalMinOrders - 1)).toBe('regular')
    expect(classifyOrderFrequency(INTELLIGENCE_THRESHOLDS.loyalMinOrders)).toBe('loyal')
    expect(classifyOrderFrequency(120)).toBe('loyal')
  })
})

describe('daysSince — deterministic กับ now ที่ส่งเข้าไป', () => {
  it('นับวันเป็นจำนวนเต็ม ไม่ติดลบ · null เมื่อไม่มีข้อมูลจริง', () => {
    expect(daysSince(daysAgo(0), NOW)).toBe(0)
    expect(daysSince(daysAgo(10), NOW)).toBe(10)
    expect(daysSince(daysAgo(-1), NOW)).toBe(0)
    expect(daysSince(null, NOW)).toBeNull()
    expect(daysSince('not-a-date', NOW)).toBeNull()
  })
})

describe('deriveCustomerInsight — เจาะกลุ่มอัตโนมัติจากสถิติจริง', () => {
  it('ลูกค้าใหม่ = new_customer + ไม่มี aov ปลอม', () => {
    const i = deriveCustomerInsight({ order_count: 0, order_total: 0 }, { now: NOW })
    expect(i.frequency).toBe('new_customer')
    expect(i.segments).toContain('new_customer')
    expect(i.average_order_value).toBe(0)
    expect(i.days_since_last_order).toBeNull()
    expect(i.summary).toContain('ยังไม่เคยสั่ง')
  })

  it('ยอดรวม/จำนวนออเดอร์ ถึงเกณฑ์ = high_value + loyal_customer', () => {
    const i = deriveCustomerInsight(
      { order_count: 8, order_total: 5000, last_order_at: daysAgo(2), loyalty_points: 0 },
      { now: NOW },
    )
    expect(i.frequency).toBe('loyal')
    expect(i.segments).toContain('high_value')
    expect(i.segments).toContain('loyal_customer')
    expect(i.average_order_value).toBeCloseTo(625)
    expect(i.segments).not.toContain('at_risk')
  })

  it('เคยสั่งแต่เงียบเกินเกณฑ์ = at_risk (ระบบชี้ให้เอง ไม่ต้องให้แอดมินตั้ง)', () => {
    const i = deriveCustomerInsight(
      { order_count: 3, order_total: 450, last_order_at: daysAgo(INTELLIGENCE_THRESHOLDS.dormantDays + 5) },
      { now: NOW },
    )
    expect(i.segments).toContain('at_risk')
    expect(i.days_since_last_order!).toBeGreaterThanOrEqual(INTELLIGENCE_THRESHOLDS.dormantDays)
  })

  it('รีวิว/แต้ม แปลเป็นกลุ่มเมื่อมีข้อมูลจริงเท่านั้น (ไม่มี = ไม่เดา)', () => {
    const withData = deriveCustomerInsight(
      { order_count: 2, order_total: 300, loyalty_points: 40 },
      { now: NOW, reviewCount: 3, reviewsAvgRating: 4.7 },
    )
    expect(withData.segments).toEqual(expect.arrayContaining(['active_reviewer', 'satisfied', 'referral_source']))

    const noData = deriveCustomerInsight({ order_count: 2, order_total: 300 }, { now: NOW })
    expect(noData.segments).not.toContain('active_reviewer')
    expect(noData.segments).not.toContain('satisfied')
  })

  it('ผลซ้ำได้เป๊ะกับ input + now เดิม (ไม่อ่านนาฬิกาเองกลางทาง)', () => {
    const input = { order_count: 5, order_total: 2500, last_order_at: daysAgo(50) }
    expect(deriveCustomerInsight(input, { now: NOW })).toEqual(deriveCustomerInsight(input, { now: NOW }))
  })
})

describe('segmentTally/labels — แถบสรุปอัตโนมัติ', () => {
  it('นับครบทุกกลุ่ม + คืนป้ายไทยที่ไม่ว่าง', () => {
    const a = deriveCustomerInsight({ order_count: 0, order_total: 0 }, { now: NOW })
    const b = deriveCustomerInsight({ order_count: 9, order_total: 9000, last_order_at: daysAgo(1) }, { now: NOW })
    const t = segmentTally([a, b])
    expect(t.new_customer).toBe(1)
    expect(t.high_value).toBe(1)
    expect(t.loyal_customer).toBe(1)
    expect(t.at_risk).toBe(0)
    expect(segmentLabelTh('high_value')).toBe('ยอดสูง')
    expect(frequencyLabelTh('loyal')).toBe('สั่งบ่อย')
    expect(segmentLabelTh('unknown' as never)).toBe('unknown')
  })
})

describe('AUTOMATIC contract — ห้ามมีการตั้งค่าด้วยมือแอดมิน (audit D11)', () => {
  it('หน้าลูกค้าคำนวณกลุ่มเองทุกครั้งที่โหลด (ไม่ใช่ค่าที่บันทึกไว้)', () => {
    expect(customersCode).toContain('deriveCustomerInsight(c, { now })')
    expect(customersCode).toContain('segmentTally(Object.values(map))')
    expect(adminCustomersSrc).toContain('data-testid="customer-segment-tally"')
  })

  it('โค้ดไม่ persist กลุ่มลูกค้าลง localStorage และไม่มีช่องกรอกเกณฑ์', () => {
    expect(customersCode).not.toContain('localStorage')
    expect(customersCode).not.toContain('intelligence-threshold')
    expect(customersCode).not.toContain('saveIntelligence')
    expect(intelligenceCode).not.toContain('localStorage')
    expect(intelligenceCode).not.toContain('storageSet')
  })

  it('เกณฑ์เป็นค่าคงที่ที่ test อ้างได้ (ไม่ใช่เลขฝังกลางฟังก์ชัน)', () => {
    expect(intelligenceCode).toContain('export const INTELLIGENCE_THRESHOLDS')
    expect(intelligenceCode).toContain('highValueTotalBaht')
    expect(intelligenceCode).toContain('dormantDays')
  })
})