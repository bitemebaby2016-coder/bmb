// ============================================
// Bite Me Baby — dispatch fallback tests (Task 3 · T3-b)
// ============================================
import { describe, it, expect } from 'vitest'
import {
  evaluateRiderFallback,
  requestExternalDispatchFallback,
  MAX_INTERNAL_RADIUS_KM,
  EXTERNAL_PROVIDER_PRIORITY,
  type ExternalDispatchRequest,
} from '@/lib/dispatchFallback'

describe('evaluateRiderFallback — PURE ตัดสินภายใน/ภายนอก', () => {
  it('ค่าเริ่มต้นรัศมี = 5 กม. (ตาม requirement 0–5)', () => {
    expect(MAX_INTERNAL_RADIUS_KM).toBe(5)
  })

  it('ในรัศมี + มีไรเดอร์ว่าง → internal', () => {
    const d = evaluateRiderFallback({ availableRiderCount: 3, distanceKm: 2.4 })
    expect(d.action).toBe('internal')
    expect(d.reason).toBe('riders_available')
    expect(d.message).toContain('3')
  })

  it('ไม่มีไรเดอร์ว่าง → external (no_available_rider)', () => {
    const d = evaluateRiderFallback({ availableRiderCount: 0, distanceKm: 1 })
    expect(d.action).toBe('external')
    expect(d.reason).toBe('no_available_rider')
  })

  it('นอกรัศมี → external แม้จะมีไรเดอร์ว่าง (out_of_radius)', () => {
    const d = evaluateRiderFallback({ availableRiderCount: 5, distanceKm: 5.1 })
    expect(d.action).toBe('external')
    expect(d.reason).toBe('out_of_radius')
    expect(d.message).toContain('5.1')
  })

  it('ขอบรัศมีพอดี (5.0) = ยังถือว่าในรัศมี (เกิน = >)', () => {
    expect(evaluateRiderFallback({ availableRiderCount: 1, distanceKm: 5 }).action).toBe('internal')
    expect(evaluateRiderFallback({ availableRiderCount: 1, distanceKm: 5.01 }).action).toBe('external')
  })

  it('ค่าเพี้ยน (ลบ/NaN/คนนับ) ถูก neutralize ตามกติกา', () => {
    // count ติดลบ → sanitize เป็น 0 = ไม่มีไรเดอร์ → external (ตรง rule "ไม่มีไรเดอร์ว่าง")
    expect(evaluateRiderFallback({ availableRiderCount: -2, distanceKm: -1 }).action).toBe('external')
    const nan = evaluateRiderFallback({ availableRiderCount: Number.NaN, distanceKm: Number.NaN })
    expect(nan.action).toBe('external') // ไม่มีไรเดอร์จริง → external
    expect(evaluateRiderFallback({ availableRiderCount: 1, distanceKm: 1, maxRadiusKm: 0 }).action).toBe('internal') // max เพี้ยน → ใช้ 5
  })
})

describe('requestExternalDispatchFallback — ใช้ registry เดิม · ตรงไปตรงมาเรื่อง mock', () => {
  const req: ExternalDispatchRequest = {
    orderNumber: 'ORD-FB-1',
    pickup: { latitude: 12.6, longitude: 102.1 },
    dropoff: { latitude: 12.7, longitude: 102.2 },
    itemsCount: 2,
    totalWeightKg: 1.5,
  }

  it('ลำดับความสำคัญ = grab → lalamove (ตาม requirement Grab/Lalamove ก่อน)', () => {
    expect(EXTERNAL_PROVIDER_PRIORITY.slice(0, 2)).toEqual(['grab', 'lalamove'])
  })

  it('ไม่มี key จริง → ได้ผล kind=mock พร้อม message บอกตรง ๆ ว่างานโครง (ไม่แกล้งเป็น live)', async () => {
    const r = await requestExternalDispatchFallback(req)
    expect(r.ok).toBe(true)
    expect(r.kind).toBe('mock')
    expect(r.providerId).toBe('grab')
    expect(r.externalOrderId).toContain('ORD-FB-1')
    expect(r.message).toContain('mockup_pending')
  })
})