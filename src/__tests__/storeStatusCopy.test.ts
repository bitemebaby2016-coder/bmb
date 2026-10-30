// ============================================
// Bite Me Baby — N1 (Owner 4-2 · R19): แถบสถานะแก้ copy เองได้ · ไฟอัตโนมัติคงเดิม
//   คีย์ business_settings `store_status_copy` (anon อ่านได้ = policy 164)
//   ⚠️ sameDayOpen/preOrderOpen = คำนวจากรอบจริงเสมอ → ห้าม override จากคีย์นี้
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    default: null,
  }
})

import {
  DEFAULT_STORE_STATUS_COPY,
  STORE_STATUS_COPY_KEY,
  getStoreStatusCopy,
  getStoreStatusCopySync,
  getStoreStatusCopyVersion,
  preOrderLineWithCopy,
  resetStoreStatusCopyCache,
  setStoreStatusCopyLive,
  statusMessageWithCopy,
  subscribeStoreStatusCopy,
} from '@/lib/storeStatusCopy'
import { getStoreStatusFromRounds } from '@/lib/homeProviders'

const CUSTOM: typeof DEFAULT_STORE_STATUS_COPY = {
  sameDayOpen: 'เปิดรับได้เลย ส่งทันทีจ้า',
  preOrderOnly: 'วันนี้เต็มแล้ว — จองวันถัดไปได้',
  closed: 'ร้านหยุดวันนี้ พรุ่งนี้เปิด 06:00',
  preOrderClosed: 'ปิดรับรอบแล้ว รอรอบถัดไป',
}

const TODAY = '2026-10-29'
const TOMORROW = '2026-10-30'
const at = (iso: string) => new Date(Date.parse(iso))

describe('N1 — default copy ต้องตรงกับข้อความที่ provider ผลิตจริง (mapping ไม่มีทางพลาด)', () => {
  it('state เปิด → ตรงกับ sameDayOpen · preorder_only → preOrderOnly · ปิด → closed', () => {
    const open = getStoreStatusFromRounds(
      [{ status: 'active', display_name: 'SameDay', delivery_start: '06:00', delivery_end: '23:00', max_capacity: 10, current_count: 1, scheduled_date: TODAY }] as never,
      at(`${TODAY}T04:00:00+07:00`),
    )
    expect(open.message).toBe(DEFAULT_STORE_STATUS_COPY.sameDayOpen)

    const preOnly = getStoreStatusFromRounds(
      [
        { status: 'active', display_name: 'SameDay', delivery_start: '06:00', delivery_end: '23:00', max_capacity: 1, current_count: 1, scheduled_date: TODAY },
        { status: 'active', display_name: 'เช้า', delivery_start: '06:00', delivery_end: '09:00', cutoff_time: '05:00', max_capacity: 60, current_count: 0, scheduled_date: TOMORROW },
      ] as never,
      at(`${TODAY}T10:00:00+07:00`),
    )
    expect(preOnly.message).toBe(DEFAULT_STORE_STATUS_COPY.preOrderOnly)

    const closed = getStoreStatusFromRounds([] as never, at(`${TODAY}T10:00:00+07:00`))
    expect(closed.message).toBe(DEFAULT_STORE_STATUS_COPY.closed)
  })

  it('บรรทัดพรีออเดอร์ปิดรับ = default คงที่ (ส่วนบรรทัดเปิดรับเป็นข้อมูลสด ไม่ใช่ default)', () => {
    // ไม่มีรอบเปิดรับเลย → early return ไม่มีบรรทัดพรีออเดอร์ (ไม่ใช่ข้อความปิดรับ)
    const none = getStoreStatusFromRounds([] as never, at(`${TODAY}T10:00:00+07:00`))
    expect(none.preOrderLine).toBeUndefined()

    // ทุกรอบวันนี้เลยปิดรอบแล้ว + ไม่มีรอบอนาคต → บรรทัด "ปิดรับแล้ว" (ค่าคงที่ของ default)
    const pastCutoff = getStoreStatusFromRounds(
      [{ status: 'active', display_name: 'รอบเย็น', cutoff_time: '16:00', pre_order_cutoff: '15:00', delivery_start: '17:00', delivery_end: '20:00', max_capacity: 50, current_count: 0, scheduled_date: TODAY }] as never,
      at(`${TODAY}T15:30:00+07:00`), // เลย pre_order_cutoff 15:00 แล้ว
    )
    expect(pastCutoff.preOrderLine).toBe(DEFAULT_STORE_STATUS_COPY.preOrderClosed)

    const live = getStoreStatusFromRounds(
      [{ status: 'active', display_name: 'เช้า', delivery_start: '06:00', delivery_end: '09:00', cutoff_time: '05:00', max_capacity: 60, current_count: 0, scheduled_date: TOMORROW }] as never,
      at(`${TODAY}T04:00:00+07:00`),
    )
    expect(live.preOrderLine).not.toBe(DEFAULT_STORE_STATUS_COPY.preOrderClosed)
    expect(live.preOrderLine).toMatch(/เปิดรับออเดอร์ Pre-Order/)
  })
})

describe('N1 — statusMessageWithCopy / preOrderLineWithCopy', () => {
  beforeEach(() => resetStoreStatusCopyCache())

  it('ยังไม่มี override → ข้อความเดิมทุก state (เปลี่ยนเฉพาะตอนแอดมินบันทึก)', () => {
    for (const m of Object.values(DEFAULT_STORE_STATUS_COPY)) {
      expect(statusMessageWithCopy(m)).toBe(m)
    }
  })

  it('มี override → คืนค่าของแอดมิน (ทั้ง 3 บรรทัดบน)', () => {
    setStoreStatusCopyLive(CUSTOM)
    expect(statusMessageWithCopy(DEFAULT_STORE_STATUS_COPY.sameDayOpen)).toBe(CUSTOM.sameDayOpen)
    expect(statusMessageWithCopy(DEFAULT_STORE_STATUS_COPY.preOrderOnly)).toBe(CUSTOM.preOrderOnly)
    expect(statusMessageWithCopy(DEFAULT_STORE_STATUS_COPY.closed)).toBe(CUSTOM.closed)
  })

  it('override ว่าง/whitespace → fallback ค่าเดิม (แถบห้ามว่าง)', () => {
    setStoreStatusCopyLive({ ...CUSTOM, sameDayOpen: '   ' })
    expect(statusMessageWithCopy(DEFAULT_STORE_STATUS_COPY.sameDayOpen)).toBe(DEFAULT_STORE_STATUS_COPY.sameDayOpen)
    expect(statusMessageWithCopy(DEFAULT_STORE_STATUS_COPY.sameDayOpen, { ...CUSTOM, sameDayOpen: '' })).toBe(DEFAULT_STORE_STATUS_COPY.sameDayOpen)
  })

  it('ข้อความที่ไม่รู้จัก (คำนวณอื่นในอนาคต) → ไม่แตะ', () => {
    setStoreStatusCopyLive(CUSTOM)
    expect(statusMessageWithCopy('เปิดรับออเดอร์ เซมเดย์ : ส่งทันทีพิเศษ')).toBe('เปิดรับออเดอร์ เซมเดย์ : ส่งทันทีพิเศษ')
    expect(statusMessageWithCopy('')).toBe('')
  })

  it('preOrderLine: ปิดรับแล้ว → override ได้ · บรรทัดเปิดรับ (รอบ+วัน+ปิดรอบ R18) → ห้ามแตะ', () => {
    setStoreStatusCopyLive(CUSTOM)
    expect(preOrderLineWithCopy(DEFAULT_STORE_STATUS_COPY.preOrderClosed)).toBe(CUSTOM.preOrderClosed)
    const liveLine = 'เปิดรับ พรีออเดอร์ : จองล่วงหน้า รอบ เช้า 30/10/2026 (ปิดรอบ 05:00)'
    expect(preOrderLineWithCopy(liveLine)).toBe(liveLine)
    expect(preOrderLineWithCopy(undefined)).toBeUndefined()
  })

  it('subscribe ถูกเรียกเมื่อ live เปลี่ยน + version ขึ้น (strip re-render ได้จริง)', () => {
    const before = getStoreStatusCopyVersion()
    let called = 0
    const unsub = subscribeStoreStatusCopy(() => { called++ })
    setStoreStatusCopyLive(CUSTOM)
    expect(called).toBeGreaterThan(0)
    expect(getStoreStatusCopyVersion()).toBeGreaterThan(before)
    expect(getStoreStatusCopySync()).toEqual(CUSTOM)
    unsub()
    const afterUnsub = called
    setStoreStatusCopyLive({ ...CUSTOM, closed: 'x' })
    expect(called).toBe(afterUnsub) // listener ถูกถอดแล้ว
    resetStoreStatusCopyCache()
    expect(getStoreStatusCopySync()).toEqual(DEFAULT_STORE_STATUS_COPY)
  })
})

describe('N1 — getStoreStatusCopy() อ่าน business_settings จริง', () => {
  beforeEach(async () => {
    resetStoreStatusCopyCache()
    const { supabase } = await import('@/lib/supabase')
    const tables = (supabase as any).__tables
    tables.business_settings = (tables.business_settings || []).filter((r: any) => r.key !== STORE_STATUS_COPY_KEY)
  })

  it('ไม่มีคีย์ใน DB → คืน default ทั้ง 4 บรรทัด (merge เติมให้ครบ)', async () => {
    const v = await getStoreStatusCopy(true)
    expect(v).toEqual(DEFAULT_STORE_STATUS_COPY)
    expect(getStoreStatusCopySync()).toEqual(DEFAULT_STORE_STATUS_COPY)
  })

  it('มีคีย์ใน DB → ใช้เฉพาะค่า string ที่ไม่ว่าง · ค่าว่างไม่ทับ default + commit เข้า live', async () => {
    const { supabase } = await import('@/lib/supabase')
    const tables = (supabase as any).__tables
    tables.business_settings.push({ key: STORE_STATUS_COPY_KEY, value: { sameDayOpen: ' เปิดแล้วจ้า ', closed: '' } })
    const v = await getStoreStatusCopy(true)
    expect(v.sameDayOpen).toBe('เปิดแล้วจ้า') // trim + ใช้ค่า DB
    expect(v.closed).toBe(DEFAULT_STORE_STATUS_COPY.closed) // ค่าว่าง → default
    expect(v.preOrderOnly).toBe(DEFAULT_STORE_STATUS_COPY.preOrderOnly)
    expect(getStoreStatusCopySync().sameDayOpen).toBe('เปิดแล้วจ้า')
  })
})
