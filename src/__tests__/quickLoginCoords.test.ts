// ============================================
// Bite Me Baby — CR-3 quick-login coordinate policy tests
// 1) buildQuickLoginCoords (client): no fallback point may be shipped as a
//    customer coordinate; login payload works without coordinates.
// 2) locationPolicy (Edge Function contract): default_* is written ONLY for
//    trusted (gps/manual) WGS84-valid pairs — never for kitchen/ip/missing
//    sources, and never for invalid pairs.
// ============================================

import { describe, it, expect } from 'vitest'
import { buildQuickLoginCoords } from '@/lib/locationLogin'
import {
  isValidDeliveryCoord,
  isTrustedCoordSource,
  shouldPersistDefaultCoords,
} from '../../supabase/functions/phone-auto-login/locationPolicy'

describe('buildQuickLoginCoords (client → EF body)', () => {
  it('sends genuine browser GPS with source=gps', () => {
    const out = buildQuickLoginCoords({}, { latitude: 12.6096, longitude: 102.1039, source: 'gps' })
    expect(out).toEqual({ latitude: 12.6096, longitude: 102.1039, source: 'gps' })
  })

  it('quick login WITHOUT real coords (kitchen fallback) sends null — no fake point', () => {
    const out = buildQuickLoginCoords({}, { latitude: 10.7016, longitude: 102.1429, source: 'kitchen' })
    expect(out.latitude).toBeNull()
    expect(out.longitude).toBeNull()
    expect(out.source).toBe('kitchen') // metadata stays truthful about where it came from
  })

  it('IP-geo result is NOT shipped as a customer coordinate', () => {
    const out = buildQuickLoginCoords({}, { latitude: 14.2269, longitude: 100.7155, source: 'ip' })
    expect(out.latitude).toBeNull()
    expect(out.longitude).toBeNull()
  })

  it('saved fallback from the legacy chain is NOT auto-shipped either', () => {
    const out = buildQuickLoginCoords({}, { latitude: 12.61, longitude: 102.11, source: 'saved' })
    expect(out.latitude).toBeNull()
  })

  it('caller-provided coordinates are sent ONLY with explicit source metadata', () => {
    const withSource = buildQuickLoginCoords(
      { latitude: 12.6, longitude: 102.1, source: 'manual' },
      { latitude: 10.7016, longitude: 102.1429, source: 'kitchen' },
    )
    expect(withSource).toEqual({ latitude: 12.6, longitude: 102.1, source: 'manual' })
    // coords WITHOUT source metadata are dropped (cannot be persisted anyway)
    const noSource = buildQuickLoginCoords(
      { latitude: 12.6, longitude: 102.1 },
      { latitude: 10.7016, longitude: 102.1429, source: 'kitchen' },
    )
    expect(noSource.latitude).toBeNull()
  })

  it('0,0 caller coords are rejected', () => {
    const out = buildQuickLoginCoords(
      { latitude: 0, longitude: 0, source: 'gps' },
      { latitude: 10.7016, longitude: 102.1429, source: 'kitchen' },
    )
    expect(out.latitude).toBeNull()
  })
})

describe('locationPolicy (EF contract) — shouldPersistDefaultCoords', () => {
  it('gps + valid pair → persisted', () => {
    expect(shouldPersistDefaultCoords({ latitude: 12.6096, longitude: 102.1039, source: 'gps' })).toBe(true)
  })

  it('manual + valid pair → persisted', () => {
    expect(shouldPersistDefaultCoords({ latitude: 12.6096, longitude: 102.1039, source: 'manual' })).toBe(true)
  })

  it('request WITHOUT source can NEVER write coordinates (update_profile guard)', () => {
    expect(shouldPersistDefaultCoords({ latitude: 12.6096, longitude: 102.1039 })).toBe(false)
    expect(shouldPersistDefaultCoords({ latitude: 12.6096, longitude: 102.1039, source: '' })).toBe(false)
  })

  it('untrusted sources (kitchen / ip / saved / unknown) are never persisted', () => {
    for (const source of ['kitchen', 'ip', 'saved', 'random']) {
      expect(shouldPersistDefaultCoords({ latitude: 10.7016, longitude: 102.1429, source })).toBe(false)
    }
  })

  it('kitchen fallback pair must not reach customers.default_* through a fallback source', () => {
    // exactly the EF scenario before CR-3: missing coords replaced by kitchen values
    expect(shouldPersistDefaultCoords({ latitude: 10.7016, longitude: 102.1429, source: 'kitchen' })).toBe(false)
    expect(shouldPersistDefaultCoords({ latitude: 10.7016, longitude: 102.1429, source: undefined })).toBe(false)
  })

  it('invalid coordinates are never persisted even with gps source', () => {
    expect(shouldPersistDefaultCoords({ latitude: 0, longitude: 0, source: 'gps' })).toBe(false)
    expect(shouldPersistDefaultCoords({ latitude: 91, longitude: 102.1, source: 'gps' })).toBe(false)
    expect(shouldPersistDefaultCoords({ latitude: 12.6, longitude: 181, source: 'gps' })).toBe(false)
    expect(shouldPersistDefaultCoords({ latitude: NaN, longitude: 102.1, source: 'gps' })).toBe(false)
    expect(shouldPersistDefaultCoords({ latitude: null, longitude: 102.1, source: 'gps' })).toBe(false)
    expect(shouldPersistDefaultCoords({ latitude: '12.6', longitude: 102.1, source: 'gps' })).toBe(false)
  })
})

describe('locationPolicy helpers', () => {
  it('isValidDeliveryCoord accepts WGS84 pairs, rejects 0,0 / NaN / Infinity / out-of-range', () => {
    expect(isValidDeliveryCoord(12.6, 102.1)).toBe(true)
    expect(isValidDeliveryCoord(-33.8, 151.2)).toBe(true)
    expect(isValidDeliveryCoord(0, 0)).toBe(false)
    expect(isValidDeliveryCoord(NaN, 1)).toBe(false)
    expect(isValidDeliveryCoord(Infinity, 1)).toBe(false)
    expect(isValidDeliveryCoord(91, 0)).toBe(false)
    expect(isValidDeliveryCoord(0, 181)).toBe(false)
  })

  it('isTrustedCoordSource accepts gps/manual only', () => {
    expect(isTrustedCoordSource('gps')).toBe(true)
    expect(isTrustedCoordSource('manual')).toBe(true)
    expect(isTrustedCoordSource('ip')).toBe(false)
    expect(isTrustedCoordSource('kitchen')).toBe(false)
    expect(isTrustedCoordSource(undefined)).toBe(false)
  })
})
