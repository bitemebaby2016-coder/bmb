// ============================================
// BMB — margin/profit helper tests (R21 Phase 2 · Owner 2026-10-29)
// ============================================
import { describe, it, expect } from 'vitest'
import {
  computeMargin,
  computeOrderProfit,
  computeUnitCost,
  classifyMargin,
  marginTierLabel,
  formatPct,
  formatBaht,
  toCostNumber,
  MARGIN_THRESHOLDS,
} from '@/lib/marginCalc'

describe('computeUnitCost', () => {
  it('sums cogs + packaging + other (ตรงกับ column generated unit_cost)', () => {
    expect(computeUnitCost({ cogs: 35, packagingCost: 4.5, otherCost: 2 })).toBe(41.5)
  })

  it('treats missing/negative/NaN as 0 (ฟอร์มพิมพ์ค้างไม่พัง)', () => {
    expect(computeUnitCost({})).toBe(0)
    expect(computeUnitCost({ cogs: -10, packagingCost: Number.NaN })).toBe(0)
    expect(computeUnitCost({ cogs: 10, packagingCost: null, otherCost: undefined })).toBe(10)
  })

  it('toCostNumber guards Infinity', () => {
    expect(toCostNumber(Number.POSITIVE_INFINITY)).toBe(0)
    expect(toCostNumber('12.5')).toBe(12.5)
  })
})

describe('computeMargin — gross margin real-time', () => {
  it('computes gross profit and % of price', () => {
    const m = computeMargin(100, { cogs: 40, packagingCost: 5, otherCost: 5 })
    expect(m.unitCost).toBe(50)
    expect(m.grossProfit).toBe(50)
    expect(m.grossMarginPct).toBe(50)
    expect(m.markupPct).toBe(100)
    expect(m.tier).toBe('strong')
  })

  it('reports loss when cost > price (ไม่ปิดบังตัวเลข)', () => {
    const m = computeMargin(80, { cogs: 60, packagingCost: 20, otherCost: 5 })
    expect(m.grossProfit).toBe(-5)
    expect(m.grossMarginPct).toBeLessThan(0)
    expect(m.tier).toBe('loss')
  })

  it('never divides by zero price', () => {
    const m = computeMargin(0, { cogs: 10 })
    expect(m.grossMarginPct).toBe(0)
    expect(m.markupPct).toBe(-100)
    expect(m.tier).toBe('loss')
  })
})

describe('classifyMargin thresholds', () => {
  it('buckets by the shared threshold table', () => {
    expect(MARGIN_THRESHOLDS).toEqual({ thin: 15, strong: 50 })
    expect(classifyMargin(-3)).toBe('loss')
    expect(classifyMargin(14.9)).toBe('thin')
    expect(classifyMargin(30)).toBe('healthy')
    expect(classifyMargin(50)).toBe('strong')
  })

  it('has Thai labels for every tier (UI badge)', () => {
    expect(marginTierLabel('loss')).toBe('ขาดทุน')
    expect(marginTierLabel('thin')).toBe('กำไรบาง')
    expect(marginTierLabel('healthy')).toBe('กำไรดี')
    expect(marginTierLabel('strong')).toBe('กำไรสูง')
  })
})

describe('computeOrderProfit — net profit ทั้งออเดอร์', () => {
  const lines = [
    { price: 100, quantity: 2, cost: { cogs: 40, packagingCost: 5 } },
    { price: 50, quantity: 1, cost: { cogs: 20, packagingCost: 5 } },
  ]

  it('gross = ยอดก่อนหักส่วนลด, net = ยอดหลังหักส่วนลด', () => {
    const r = computeOrderProfit(lines, { discountTotal: 30 })
    expect(r.grossRevenue).toBe(250)
    expect(r.totalCost).toBe(45 * 2 + 25) // 115
    expect(r.grossProfit).toBe(135)
    expect(r.netRevenue).toBe(220)
    expect(r.netProfit).toBe(105)
    expect(r.grossMarginPct).toBeCloseTo(54, 1)
    expect(r.netMarginPct).toBeCloseTo(47.7, 1)
  })

  it('extraCost (ค่าส่งที่ร้านจ่าย) ลด net profit แต่ไม่แตะ gross', () => {
    const r = computeOrderProfit(lines, { extraCost: 25 })
    expect(r.grossProfit).toBe(135)
    expect(r.netProfit).toBe(110)
  })

  it('discount มากกว่ายอดขาย = ตัดที่ยอดขาย (ไม่คืนค่าติดลบเกินจริง)', () => {
    const r = computeOrderProfit([], { discountTotal: 999 })
    expect(r.netRevenue).toBe(0)
    expect(r.grossMarginPct).toBe(0)
    expect(r.tier).toBe('loss')
  })

  it('empty cart / non-array input is safe', () => {
    const r = computeOrderProfit([])
    expect(r.grossRevenue).toBe(0)
    expect(r.netProfit).toBe(0)
    expect(r.tier).toBe('loss')
  })
})

describe('formatters', () => {
  it('formats percent and baht for Thai UI', () => {
    expect(formatPct(12.34)).toBe('12.3%')
    expect(formatPct(null)).toBe('0%')
    expect(formatPct(Number.NaN)).toBe('0%')
    expect(formatBaht(1234.5)).toContain('1,234.50')
  })
})
