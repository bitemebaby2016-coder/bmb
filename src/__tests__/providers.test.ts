// ============================================
// Bite Me Baby — Phase 3 DEL-03 provider adapter tests
// ============================================

import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { providerRegistry } from '@/lib/providers/registry'
import { GrabAdapter } from '@/lib/providers/grab'
import { LinemanAdapter } from '@/lib/providers/lineman'

const req = {
  pickup: { latitude: 10.7, longitude: 102.14 },
  dropoff: { latitude: 10.75, longitude: 102.2 },
  itemsCount: 1,
  totalWeightKg: 1,
}

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status }) as unknown as Response) as unknown as typeof fetch
}

// Simulate an environment WITHOUT external rider keys (deterministic tests).
beforeEach(() => {
  providerRegistry.reset({ grab: { keyGetter: () => '' }, lineman: { keyGetter: () => '' } })
})
afterEach(() => providerRegistry.reset())

describe('provider registry (DEL-03)', () => {
  it('registers all four channels with correct live statuses', () => {
    const map = providerRegistry.statusMap()
    expect(map.bite_drive.status).toBe('live')
    expect(map.grab.status).toBe('sandbox')
    expect(map.lineman.status).toBe('sandbox')
    expect(map.foodpanda.status).toBe('mockup_pending')
  })

  it('resolves an adapter per provider id', async () => {
    const g = providerRegistry.get('grab')
    const q = await g.quote(req)
    expect(q.providerId).toBe('grab')
    expect(q.status).toBe('sandbox')
    expect(q.fee).toBeGreaterThan(0)
    expect(q.note).toContain('live keys')
  })
})

describe('GrabAdapter (DEL-03 — plug-in ready)', () => {
  it('degrades to estimate when NO credentials (sandbox)', async () => {
    const a = new GrabAdapter({ keyGetter: () => '', baseFee: 40, perKmFee: 8 })
    expect(a.hasCredentials).toBe(false)
    const q = await a.quote(req)
    expect(q.status).toBe('sandbox')
    expect(q.fee).toBeGreaterThan(0)
  })

  it('calls the live API when credentials exist (quote path)', async () => {
    const a = new GrabAdapter({
      keyGetter: () => 'clientId:clientSecret',
      fetchImpl: jsonFetch({ access_token: 'tok', quoted_price: { amount: 60 }, eta: 25 }),
      baseFee: 40,
      perKmFee: 8,
    })
    expect(a.hasCredentials).toBe(true)
    const q = await a.quote(req)
    expect(q.fee).toBe(60)
    expect(q.etaMinutes).toBe(25)
  })

  it('falls back to estimate when a live call fails (quote must never break checkout)', async () => {
    const a = new GrabAdapter({
      keyGetter: () => 'clientId:clientSecret',
      fetchImpl: jsonFetch({ error: 'nope' }, 500),
      baseFee: 40,
      perKmFee: 8,
    })
    const q = await a.quote(req)
    expect(q.status).toBe('sandbox')
    expect(q.fee).toBeGreaterThan(0)
  })
})

describe('LinemanAdapter (DEL-03 — plug-in ready)', () => {
  it('uses sandbox estimate without key', async () => {
    const a = new LinemanAdapter({ keyGetter: () => '' })
    const q = await a.quote(req)
    expect(q.status).toBe('sandbox')
    expect(q.fee).toBeGreaterThan(0)
  })

  it('reads the live quotation when key present', async () => {
    const a = new LinemanAdapter({
      keyGetter: () => 'secret',
      fetchImpl: jsonFetch({ estimated_total_rider_fee: 55, estimated_delivery_minutes: 22 }),
    })
    const q = await a.quote(req)
    expect(q.fee).toBe(55)
    expect(q.etaMinutes).toBe(22)
  })
})