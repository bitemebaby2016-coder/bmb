// ============================================
// Bite Me Baby — Canonical Order Status Vocabulary tests (PAY-04)
// Verifies there are NO orphan statuses: every server status maps to a client
// display (per mode), every client status maps back, provider <-> server is
// bidirectional, and the UI labels cover every server status.
// ============================================

import { describe, it, expect } from 'vitest'
import {
  SERVER_ORDER_STATUSES,
  CLIENT_ORDER_STATUSES,
  PRE_ORDER_CLIENT_STATUSES,
  PROVIDER_ORDER_STATUSES,
  SERVER_TO_CLIENT,
  CLIENT_TO_SERVER,
  SERVER_TO_PROVIDER,
  PROVIDER_TO_SERVER,
  SERVER_STATUS_LABEL_TH,
} from '@/lib/orderVocabulary'

describe('orderVocabulary — canonical status mapping (PAY-04)', () => {
  it('every server status maps to a client display in BOTH modes (no orphan)', () => {
    for (const s of SERVER_ORDER_STATUSES) {
      const row = SERVER_TO_CLIENT[s]
      expect(row.sameDay).toBeDefined()
      expect(row.preOrder).toBeDefined()
      expect(isClient(row.sameDay)).toBe(true)
      expect(isClient(row.preOrder)).toBe(true)
    }
  })

  it('every client status maps back to a server status', () => {
    for (const s of [...CLIENT_ORDER_STATUSES, ...PRE_ORDER_CLIENT_STATUSES]) {
      const back = CLIENT_TO_SERVER[s]
      expect(back).toBeDefined()
      expect(SERVER_ORDER_STATUSES).toContain(back)
    }
    // Round-trip: server -> client -> server is stable for both modes
    // (in_transit/arrived intentionally COLLAPSE to client 'Dispatched' — they
    //  are display-equal on the customer timeline, so exact round-trip only
    //  holds for the status that owns each client label.)
    for (const s of SERVER_ORDER_STATUSES) {
      if (s === 'in_transit' || s === 'arrived') continue
      expect(CLIENT_TO_SERVER[SERVER_TO_CLIENT[s].sameDay]).toBe(s)
      expect(CLIENT_TO_SERVER[SERVER_TO_CLIENT[s].preOrder]).toBe(s)
    }
    expect(CLIENT_TO_SERVER[SERVER_TO_CLIENT.in_transit.sameDay]).toBe('dispatched')
    expect(CLIENT_TO_SERVER[SERVER_TO_CLIENT.arrived.sameDay]).toBe('dispatched')
  })

  it('provider <-> server mapping is complete and bidirectional', () => {
    for (const s of SERVER_ORDER_STATUSES) {
      const p = SERVER_TO_PROVIDER[s]
      expect(PROVIDER_ORDER_STATUSES).toContain(p)
    }
    for (const p of PROVIDER_ORDER_STATUSES) {
      const s = PROVIDER_TO_SERVER[p]
      expect(SERVER_ORDER_STATUSES).toContain(s)
    }
    // Round-trip provider -> server -> provider
    for (const p of PROVIDER_ORDER_STATUSES) {
      expect(SERVER_TO_PROVIDER[PROVIDER_TO_SERVER[p]]).toBe(p)
    }
  })

  it('every server status has a Thai UI label (no raw enum shown to customers)', () => {
    for (const s of SERVER_ORDER_STATUSES) {
      const label = SERVER_STATUS_LABEL_TH[s]
      expect(label).toBeTruthy()
      expect(label).not.toBe(s) // labels must read as Thai copy, not the raw enum
    }
  })

  it('terminal/cancel special cases map exactly', () => {
    expect(SERVER_TO_PROVIDER.cancelled).toBe('cancelled')
    expect(SERVER_TO_PROVIDER.failed).toBe('cancelled')
    expect(PROVIDER_TO_SERVER.cancelled).toBe('cancelled')
    expect(SERVER_TO_CLIENT.in_transit.sameDay).toBe('Dispatched')
    expect(SERVER_TO_CLIENT.arrived.sameDay).toBe('Dispatched')
  })
})

function isClient(v: string): boolean {
  return (
    (CLIENT_ORDER_STATUSES as readonly string[]).includes(v) ||
    (PRE_ORDER_CLIENT_STATUSES as readonly string[]).includes(v)
  )
}