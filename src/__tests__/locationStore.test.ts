// ============================================
// Bite Me Baby — CR-2 P0 location trust (store) tests
// Trusted-provenance policy: only gps/manual coordinates are usable/persisted
// as delivery points; ip / kitchen / unknown payloads are discarded on restore.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

type StoreModule = typeof import('@/store/locationStore')
const KEY = 'bmb_customer_location'

async function freshStore(): Promise<StoreModule> {
  vi.resetModules()
  return import('@/store/locationStore')
}

describe('isTrustedSource (CR-2 P0 policy)', () => {
  it('accepts gps and manual only', async () => {
    const { isTrustedSource } = await freshStore()
    expect(isTrustedSource('gps')).toBe(true)
    expect(isTrustedSource('manual')).toBe(true)
    expect(isTrustedSource('ip')).toBe(false)
    expect(isTrustedSource('kitchen')).toBe(false)
    expect(isTrustedSource('saved')).toBe(false)
    expect(isTrustedSource('')).toBe(false)
    expect(isTrustedSource(undefined)).toBe(false)
    expect(isTrustedSource(null)).toBe(false)
  })
})

describe('emptyLocation / boot default', () => {
  beforeEach(() => localStorage.clear())

  it('default state is EMPTY (0,0) — NOT the kitchen coordinates', async () => {
    const { useLocationStore, emptyLocation, KITCHEN_LAT, KITCHEN_LNG } = await freshStore()
    const loc = useLocationStore.getState().location
    expect(loc.latitude).toBe(0)
    expect(loc.longitude).toBe(0)
    expect(loc.source).toBe('')
    expect(emptyLocation()).toEqual(loc)
    // the kitchen constants still exist for MAP reference — but are not the default point
    expect(typeof KITCHEN_LAT).toBe('number')
    expect(typeof KITCHEN_LNG).toBe('number')
  })
})

describe('loadSaved (module boot) — provenance filtering', () => {
  beforeEach(() => localStorage.clear())

  it('discards a stored ip-geo point', async () => {
    localStorage.setItem(KEY, JSON.stringify({ latitude: 14.2269, longitude: 100.7155, addressDetail: '', source: 'ip' }))
    const { useLocationStore } = await freshStore()
    expect(useLocationStore.getState().location.latitude).toBe(0)
    expect(useLocationStore.getState().location.source).toBe('')
  })

  it('discards a stored kitchen point', async () => {
    localStorage.setItem(KEY, JSON.stringify({ latitude: 10.7016, longitude: 102.1429, addressDetail: '', source: 'kitchen' }))
    const { useLocationStore } = await freshStore()
    expect(useLocationStore.getState().location.latitude).toBe(0)
  })

  it('restores a gps point (legacy payload without provenance) as saved', async () => {
    localStorage.setItem(KEY, JSON.stringify({ latitude: 12.61, longitude: 102.11, addressDetail: 'บ้านเดิม', source: 'gps' }))
    const { useLocationStore } = await freshStore()
    const loc = useLocationStore.getState().location
    expect(loc.latitude).toBe(12.61)
    expect(loc.source).toBe('saved')
    expect(loc.provenance).toBe('gps')
  })

  it('ignores 0,0 payloads even with trusted source', async () => {
    localStorage.setItem(KEY, JSON.stringify({ latitude: 0, longitude: 0, addressDetail: '', source: 'gps' }))
    const { useLocationStore } = await freshStore()
    expect(useLocationStore.getState().location.latitude).toBe(0)
    expect(useLocationStore.getState().location.source).toBe('')
  })
})

describe('setLocation — provenance bookkeeping', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the ORIGINAL capture source as provenance (ip recorded as ip)', async () => {
    const { useLocationStore, isTrustedSource } = await freshStore()
    useLocationStore.getState().setLocation({ latitude: 14.2, longitude: 100.7, source: 'ip' })
    const loc = useLocationStore.getState().location
    expect(loc.provenance).toBe('ip')
    // and an ip point must NOT satisfy the trust policy
    expect(isTrustedSource(loc.provenance)).toBe(false)
  })

  it('a gps capture sets provenance gps', async () => {
    const { useLocationStore } = await freshStore()
    useLocationStore.getState().setLocation({ latitude: 12.6, longitude: 102.1, source: 'gps' })
    expect(useLocationStore.getState().location.provenance).toBe('gps')
  })

  it("a 'saved' re-save keeps the previous provenance", async () => {
    const { useLocationStore } = await freshStore()
    useLocationStore.getState().setLocation({ latitude: 12.6, longitude: 102.1, source: 'manual' })
    useLocationStore.getState().setLocation({ addressDetail: 'แก้ที่อยู่', source: 'saved' })
    const loc = useLocationStore.getState().location
    expect(loc.provenance).toBe('manual')
    expect(loc.addressDetail).toBe('แก้ที่อยู่')
  })

  it('clearLocation returns to the empty default (not kitchen)', async () => {
    const { useLocationStore } = await freshStore()
    useLocationStore.getState().setLocation({ latitude: 12.6, longitude: 102.1, source: 'gps' })
    useLocationStore.getState().clearLocation()
    const loc = useLocationStore.getState().location
    expect(loc.latitude).toBe(0)
    expect(loc.source).toBe('')
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

// ============================================
// CR-2 PROVENANCE CORRECTION — deliveryPointStatus:
// source/provenance stays truthful (saved is NEVER called 'gps') while
// trust/confirmation are decided separately.
// ============================================
describe('deliveryPointStatus (CR-2 correction)', () => {
  beforeEach(() => localStorage.clear())

  function base(): import('@/store/locationStore').DeliveryPointDraft {
    return { latitude: 12.61, longitude: 102.11, source: 'gps', provenance: 'gps', confirmed: false }
  }

  it('GPS point: trusted + confirmable before confirm, orderable after', async () => {
    const { deliveryPointStatus } = await freshStore()
    expect(deliveryPointStatus(base())).toMatchObject({ hasPoint: true, trusted: true, confirmable: true, orderable: false })
    expect(deliveryPointStatus({ ...base(), confirmed: true })).toMatchObject({ confirmable: false, orderable: true })
  })

  it('SAVED point keeps provenance gps/manual — trusted by restore, orderable only AFTER confirm', async () => {
    const { deliveryPointStatus } = await freshStore()
    const savedGps = { ...base(), source: 'saved' as const, provenance: 'gps' as const }
    const savedManual = { ...base(), source: 'saved' as const, provenance: 'manual' as const }
    // unconfirmed saved point can be confirmed but NOT ordered yet
    expect(deliveryPointStatus(savedGps)).toMatchObject({ trusted: true, confirmable: true, orderable: false })
    expect(deliveryPointStatus(savedManual)).toMatchObject({ trusted: true, orderable: false })
    // confirmed saved point is orderable — and its provenance is STILL gps/manual (never relabeled to 'gps' in source)
    const confirmed = deliveryPointStatus({ ...savedGps, confirmed: true })
    expect(confirmed.orderable).toBe(true)
    expect(savedGps.source).toBe('saved')
  })

  it('MANUAL pin: orderable only when confirmed', async () => {
    const { deliveryPointStatus } = await freshStore()
    const manual = { ...base(), source: 'manual' as const, provenance: 'manual' as const }
    expect(deliveryPointStatus(manual)).toMatchObject({ trusted: true, orderable: false })
    expect(deliveryPointStatus({ ...manual, confirmed: true })).toMatchObject({ orderable: true })
  })

  it('UNTRUSTED provenance (ip / kitchen / empty) can NEVER become orderable', async () => {
    const { deliveryPointStatus } = await freshStore()
    for (const provenance of ['ip', 'kitchen', ''] as const) {
      // cast: DeliveryPointDraft is typed for trusted values; we deliberately
      // feed hostile/legacy provenance to prove the guard rejects it.
      const p = deliveryPointStatus({ ...base(), provenance: provenance as unknown as '' | 'gps' | 'manual', confirmed: true })
      expect(p.trusted).toBe(false)
      expect(p.confirmable).toBe(false)
      expect(p.orderable).toBe(false)
    }
  })

  it('re-positioning after confirmation (map pick) clears confirmation → not orderable', async () => {
    const { deliveryPointStatus } = await freshStore()
    // confirmed GPS…
    const confirmedGps = deliveryPointStatus({ ...base(), confirmed: true })
    expect(confirmedGps.orderable).toBe(true)
    // …customer then drags the pin → handleMapPick sets provenance manual + confirmed false
    const afterPick = deliveryPointStatus({ ...base(), source: 'manual', provenance: 'manual', confirmed: false })
    expect(afterPick.orderable).toBe(false)
    expect(afterPick.confirmable).toBe(true)
    // 0,0 / null coords are never a point
    expect(deliveryPointStatus({ ...base(), latitude: null, confirmed: true }).hasPoint).toBe(false)
    expect(deliveryPointStatus({ ...base(), latitude: 0, longitude: 0, confirmed: true }).orderable).toBe(false)
  })
})
