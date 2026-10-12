// ============================================
// Bite Me Baby — Login UX regression (launch-closure 2026-10-12)
// ============================================
// ลูกค้าเก่าต้อง "ไม่ถูกบังคับกรอกซ้ำ" — restoreProfileAddress ดึงข้อความที่อยู่
// จากแถว customers ของตัวเอง (RLS own-read) มาเติม locationStore ตอน login
// สำเร็จ แบบ best-effort และห้ามให้ trust กับพิกัด (ไม่มี provenance ใน DB)
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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

import { restoreProfileAddress } from '@/store/authStore'
import { useLocationStore, isTrustedSource } from '@/store/locationStore'
import { getGpsLocation } from '@/lib/locationLogin'

const MOCK_USER = 'auth-test-user' // mock auth session user id (supabaseMock)

async function pushCustomerRow(row: Record<string, unknown>) {
  const { supabase } = await import('@/lib/supabase')
  ;(supabase as any).__tables.customers.push({ user_id: MOCK_USER, ...row })
}

describe('restoreProfileAddress — returning-customer address restore (case D)', () => {
  beforeEach(async () => {
    // Mock tables are SHARED across tests — remove rows pushed by previous tests
    // so maybeSingle() sees exactly one (or zero) match per case.
    const { supabase } = await import('@/lib/supabase')
    const tables = (supabase as any).__tables
    tables.customers = (tables.customers || []).filter(
      (r: { id?: string }) => !String(r?.id ?? '').startsWith('cust-t'),
    )
    useLocationStore.getState().clearLocation()
  })

  it('fills address TEXT from the customer own row into locationStore', async () => {
    await pushCustomerRow({ id: 'cust-t1', default_address_detail: '123 ถนนทดสอบ ตัวเมืองจันทบุรี' })
    await restoreProfileAddress()
    const loc = useLocationStore.getState().location
    expect(loc.addressDetail).toBe('123 ถนนทดสอบ ตัวเมืองจันทบุรี')
  })

  it('grants NO coordinate trust — restored text keeps empty provenance (CR-2 policy)', async () => {
    await pushCustomerRow({ id: 'cust-t2', default_address_detail: 'ซอยทดสอบ 4' })
    await restoreProfileAddress()
    const loc = useLocationStore.getState().location
    expect(loc.addressDetail).toBe('ซอยทดสอบ 4')
    expect(isTrustedSource(loc.provenance ?? loc.source)).toBe(false)
  })

  it('never overwrites an address the device already has', async () => {
    await pushCustomerRow({ id: 'cust-t3', default_address_detail: 'แถว DB ห้ามทับ' })
    useLocationStore.getState().setLocation({ addressDetail: 'แถวเครื่องมีอยู่แล้ว', source: '' })
    await restoreProfileAddress()
    expect(useLocationStore.getState().location.addressDetail).toBe('แถวเครื่องมีอยู่แล้ว')
  })

  it('is a no-op when the row has no address text (รวมถึง legacy default_*=0,0)', async () => {
    await pushCustomerRow({ id: 'cust-t4', default_address_detail: null, default_latitude: 0, default_longitude: 0 })
    await restoreProfileAddress()
    expect(useLocationStore.getState().location.addressDetail).toBe('')
  })
})

// ============================================
// CR-4 P1 regression — getGpsLocation gps-branch
// production evidence (e2e/cr4-prod-e2e.json): permission granted + mock coords
// กลับเป็น label IP เสมอ เพราะเงื่อนไขเดิมเช็ค pos.latitude บน GeolocationPosition
// ดิบ (browser จริงวางพิกัดที่ pos.coords.*) → gps-branch ตายใน browser จริง
// ============================================
describe('getGpsLocation — reads the REAL browser GeolocationPosition shape', () => {
  function stubGeolocation(position: unknown) {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (onOk: (p: unknown) => void) => onOk(position),
      },
    })
  }

  afterEach(() => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })
  })

  it('standard shape { coords: { latitude, longitude } } → source=gps (production browsers)', async () => {
    stubGeolocation({ coords: { latitude: 10.7123, longitude: 102.1401 }, timestamp: Date.now() })
    const loc = await getGpsLocation()
    expect(loc.source).toBe('gps')
    expect(loc.latitude).toBeCloseTo(10.7123, 4)
    expect(loc.longitude).toBeCloseTo(102.1401, 4)
  })

  it('legacy top-level { latitude, longitude } shape still supported (mock/compat)', async () => {
    stubGeolocation({ latitude: 10.5, longitude: 102.2 })
    const loc = await getGpsLocation()
    expect(loc.source).toBe('gps')
    expect(loc.latitude).toBeCloseTo(10.5, 4)
  })

  it('null-island pair (0,0) is rejected — falls through, never source=gps', async () => {
    // กันเผลอเรียก ipapi.co จริงจาก test — fallback ต้องเดินต่อโดยไม่มี network
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline-test')))
    stubGeolocation({ coords: { latitude: 0, longitude: 0 }, timestamp: Date.now() })
    const loc = await getGpsLocation()
    expect(loc.source).not.toBe('gps')
    expect(loc.latitude === 0 && loc.longitude === 0).toBe(false) // kitchen fallback ไม่ใช่ 0,0
    vi.unstubAllGlobals()
  })
})
