// ============================================
// Bite Me Baby — Kitchen alert tests (Task 3 · T3-a)
// ============================================
import { describe, it, expect, afterEach } from 'vitest'
import { detectNewPendingOrders, playKitchenChime, type AlertOrderLike } from '@/lib/kitchenAlert'

const o = (order_number: string, status = 'pending'): AlertOrderLike => ({ order_number, status })

describe('detectNewPendingOrders —  PURE diff หน้าก่อน/หลัง', () => {
  it('โหลดแรก (prev ว่าง) → pending ทั้งหมดถือว่าใหม่', () => {
    expect(detectNewPendingOrders([], [o('ord-1'), o('ord-2')])).toEqual(['ord-1', 'ord-2'])
  })

  it('เลขเดิม pending อยู่แล้ว = ไม่ใช่ใหม่', () => {
    expect(detectNewPendingOrders([o('ord-1')], [o('ord-1')])).toEqual([])
  })

  it('มีของใหม่เข้ามา = คืนเฉพาะเลขใหม่ที่เป็น pending', () => {
    const prev = [o('ord-1'), o('ord-2', 'confirmed')]
    const next = [o('ord-1'), o('ord-2', 'confirmed'), o('ord-3'), o('ord-4', 'delivered')]
    expect(detectNewPendingOrders(prev, next)).toEqual(['ord-3'])
  })

  it('เลขที่เคยเห็นแต่เปลี่ยนสถานะ (ไม่ใช่ pending ใหม่) = ไม่เตือน', () => {
    expect(detectNewPendingOrders([o('ord-1', 'confirmed')], [o('ord-1', 'pending')])).toEqual([])
  })

  it('ข้อมูลเพี้ยน (null/ไม่มีเลข/ซ้ำใน next) ไม่พังและไม่คืนซ้ำ', () => {
    const next = [null as unknown as AlertOrderLike, o(''), o('dup'), o('dup')]
    expect(detectNewPendingOrders([], next)).toEqual(['dup'])
    expect(detectNewPendingOrders(null as unknown as AlertOrderLike[], undefined as unknown as AlertOrderLike[])).toEqual([])
  })
})

describe('playKitchenChime — เล่นได้/ไม่พังทุกสภาพแวดล้อม', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).AudioContext
  })

  it('ไม่มี AudioContext (jsdom) → คืน false ไม่ throw', () => {
    expect(playKitchenChime()).toBe(false)
  })

  it('มี AudioContext → เล่น 3 โน้ต แล้วคืน true (และถูก throttle ครั้งที่ 2)', () => {
    class FakeCtx {
      currentTime = 0
      destination = {}
      createOscillator() {
        return { type: 'sine', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
      }
      close() { return Promise.resolve() }
    }
    ;(globalThis as Record<string, unknown>).AudioContext = FakeCtx
    expect(playKitchenChime()).toBe(true)
    expect(playKitchenChime()).toBe(false) // throttle 800ms — ครั้งที่ 2 ภายในวินาทีเดียวถูกข้าม
  })
})