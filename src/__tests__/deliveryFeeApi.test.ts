// ============================================
// Bite Me Baby — Phase 3 DEL-01 authoritative delivery-fee tests
// ============================================

import { describe, it, expect } from 'vitest'
import { zoneFeeForDistance, localZoneFee, feeUiState, summaryFeeState, SEEDED_DELIVERY_ZONES } from '@/lib/deliveryFeeApi'

describe('zoneFeeForDistance (DEL-01 — fee จาก delivery_zones)', () => {
  it('picks the zone that contains the distance', () => {
    expect(zoneFeeForDistance(3)).toBe(25)
    expect(zoneFeeForDistance(5)).toBe(25) // inclusive min of next zone boundary handled by ordering
    expect(zoneFeeForDistance(7)).toBe(45)
    expect(zoneFeeForDistance(15)).toBe(80)
  })

  it('returns null when no zone covers the distance', () => {
    expect(zoneFeeForDistance(50)).toBeNull()
    expect(zoneFeeForDistance(-1)).toBeNull()
  })

  it('§18 tier grid: <1 / 1 / 4.99 / 5 / >5 km (server-zone mirror)', () => {
    expect(zoneFeeForDistance(0.99)).toBe(25) // <1 km → city
    expect(zoneFeeForDistance(1)).toBe(25) // 1 km → city
    expect(zoneFeeForDistance(4.99)).toBe(25) // just under the city boundary
    expect(zoneFeeForDistance(5)).toBe(25) // 5 km inclusive → city (first band by max_distance)
    expect(zoneFeeForDistance(5.01)).toBe(45) // >5 km → suburb
    expect(zoneFeeForDistance(9.99)).toBe(45)
    expect(zoneFeeForDistance(10.01)).toBe(80) // >10 km → far
    expect(zoneFeeForDistance(19.99)).toBe(80)
  })

  it('honours is_active=false zones (admin disables a zone → fallthrough to next)', () => {
    const zones = SEEDED_DELIVERY_ZONES.map((z) => (z.id === 'zone-city' ? { ...z, is_active: false } : z))
    // city (0-5) disabled → a 6 km drop falls into suburb (5-10)
    expect(zoneFeeForDistance(6, zones)).toBe(45)
    // and the disabled city band is NOT served anymore
    expect(zoneFeeForDistance(2, zones)).toBeNull()
  })
})

describe('localZoneFee (DEL-01 — offline mirror)', () => {
  it('computes server-style fee from drop-off coordinates', () => {
    // near the real kitchen (src/config/kitchenLocation.ts — 12.615659, 102.098063)
    const near = localZoneFee({ dropoffLatitude: 12.62, dropoffLongitude: 102.10 })
    // ~1 km away → zone-city (25 THB)
    expect(near).toBe(25)
  })

  it('uses the supplied distance when coordinates are absent', () => {
    expect(localZoneFee({ distanceKm: 8 })).toBe(45)
  })
})

describe('feeUiState (CR-2 P2 — error must never look like a valid zero fee)', () => {
  it('server fee renders as a price with the server label', () => {
    const ui = feeUiState({ delivery_fee: 25, source: 'server' })
    expect(ui.tone).toBe('ok')
    expect(ui.label).toBe('25.00 ฿')
    expect(ui.detail).toBe('คำนวณจากเซิร์ฟเวอร์')
  })

  it('mirror fee renders as an estimate', () => {
    const ui = feeUiState({ delivery_fee: 45, source: 'local-mirror' })
    expect(ui.tone).toBe('ok')
    expect(ui.detail).toContain('ประมาณการ')
  })

  it('error state shows a failure message — NOT 0.00', () => {
    const ui = feeUiState({ delivery_fee: null, source: 'error' })
    expect(ui.tone).toBe('error')
    expect(ui.label).not.toContain('0.00')
    expect(ui.label).toBe('ยังคำนวณไม่สำเร็จ')
  })

  it('a null fee with any source is treated as error', () => {
    expect(feeUiState({ delivery_fee: null, source: 'server' }).tone).toBe('error')
    expect(feeUiState({ delivery_fee: null, source: 'local-mirror' }).tone).toBe('error')
  })

  it('a real zero fee from the server is still shown as a price (server-authorized)', () => {
    const ui = feeUiState({ delivery_fee: 0, source: 'server' })
    expect(ui.tone).toBe('ok')
    expect(ui.label).toBe('0.00 ฿')
  })
})

describe('summaryFeeState (A3 · 2026-10-22 — ยอดสรุปต้องตรงกับค่าที่แอดมินตั้ง ไม่โชว์ค่าเก่าเป็นจริง)', () => {
  it('server quote → ค่าส่งตามโซนที่แอดมินตั้ง + ยอดไม่ติดป้ายโดยประมาณ', () => {
    const s = summaryFeeState({ delivery_fee: 45, source: 'server' })
    expect(s.feeLabel).toBe('ค่าจัดส่ง (ตามโซนที่แอดมินตั้ง)')
    expect(s.feeValue).toBe('45.00 บาท')
    expect(s.totalSuffix).toBe('บาท')
    expect(s.exact).toBe(true)
  })

  it('local-mirror → ติดป้าย "โดยประมาณ" ทั้งค่าส่งและยอดรวม', () => {
    const s = summaryFeeState({ delivery_fee: 25, source: 'local-mirror' })
    expect(s.feeLabel).toContain('โดยประมาณ')
    expect(s.totalSuffix).toContain('โดยประมาณ')
    expect(s.exact).toBe(false)
  })

  it('error/null source → "รอระบบคำนวณ" ไม่โชว์ตัวเลขเก่า + ยอดโดยประมาณ', () => {
    for (const source of ['error', null] as const) {
      const s = summaryFeeState({ delivery_fee: 45, source })
      expect(s.feeValue).toBe('รอระบบคำนวณ') // ค่า 45 ที่ค้างต้องไม่ถูกโชว์เป็นจริง
      expect(s.feeValue).not.toContain('45')
      expect(s.totalSuffix).toContain('โดยประมาณ')
      expect(s.exact).toBe(false)
    }
  })

  it('delivery_fee null แม้ source=server → ยังคงเป็นสถานะรอคำนวณ', () => {
    const s = summaryFeeState({ delivery_fee: null, source: 'server' })
    expect(s.feeValue).toBe('รอระบบคำนวณ')
    expect(s.exact).toBe(false)
  })

  it('pickup → ค่าส่งฟรีชัดเจน + ยอดตรง (ไม่ใช่โดยประมาณ)', () => {
    const s = summaryFeeState({ delivery_fee: 0, source: 'server' }, { pickup: true })
    expect(s.feeLabel).toContain('รับที่ร้าน')
    expect(s.feeValue).toBe('0.00 บาท')
    expect(s.exact).toBe(true)
  })
})
