// ============================================
// Bite Me Baby — Location store (new "quick login": name + phone + location)
// Keeps the customer's delivery location client-side AND lets the checkout page
// pre-fill the dropoff point so distance / route / delivery fee are computed
// against the customer's REAL position (connects to existing conditions).
// ============================================

import { create } from 'zustand'

export interface CustomerLocation {
  latitude: number
  longitude: number
  addressDetail: string
  source: 'gps' | 'ip' | 'kitchen' | 'manual' | 'saved' | ''
  /** ORIGINAL capture source — CR-2 P0 trusted-provenance policy. */
  provenance?: 'gps' | 'ip' | 'kitchen' | 'manual' | 'saved' | ''
  name?: string
  phone?: string
}

interface LocationState {
  location: CustomerLocation
  lastUpdatedAt: number | null
  setLocation: (loc: Partial<CustomerLocation> & { source: CustomerLocation['source'] }) => void
  clearLocation: () => void
}

/** CR-2 P0: sources that may be used/persisted as a real delivery coordinate. */
export const TRUSTED_SOURCES: ReadonlyArray<'gps' | 'manual'> = ['gps', 'manual']

/** True when a coordinate source may be used as (and persisted as) a delivery point. */
export function isTrustedSource(source: string | undefined | null): boolean {
  return source === 'gps' || source === 'manual'
}

/** Empty "no delivery point yet" state — deliberately NOT the kitchen coords. */
export function emptyLocation(): CustomerLocation {
  return { latitude: 0, longitude: 0, addressDetail: '', source: '', provenance: '' }
}

/** Delivery-point draft shape used by the checkout confirmation logic. */
export interface DeliveryPointDraft {
  latitude: number | null
  longitude: number | null
  /** Display source for the CURRENT session ('gps' | 'manual' | 'saved' | ''). */
  source: '' | 'gps' | 'manual' | 'saved'
  /** ORIGINAL capture provenance — a saved point keeps gps/manual, is never relabeled. */
  provenance: '' | 'gps' | 'manual'
  /** Explicit customer confirmation (Owner decision). */
  confirmed: boolean
}

/**
 * CR-2 PROVENANCE CORRECTION (Owner 2026-10-10):
 * source/provenance (WHERE the point came from) is kept SEPARATE from
 * trust/confirmation status (WHETHER it may be ordered with).
 * - trusted ⇔ provenance is gps/manual (a restored 'saved' point keeps its
 *   original provenance — it is NEVER called 'gps');
 * - orderable ⇔ trusted AND explicitly confirmed;
 * - any point failing the trust check can never reach `orderable: true`.
 */
export function deliveryPointStatus(p: DeliveryPointDraft): {
  hasPoint: boolean
  trusted: boolean
  confirmable: boolean
  orderable: boolean
} {
  const hasPoint =
    p.latitude != null && p.longitude != null && !(p.latitude === 0 && p.longitude === 0)
  const trusted = hasPoint && isTrustedSource(p.provenance)
  return {
    hasPoint,
    trusted,
    confirmable: trusted && !p.confirmed,
    orderable: trusted && p.confirmed,
  }
}

// Kitchen default (owner can edit .env VITE_DELIVERY_KITCHEN_LAT / LNG)
export const KITCHEN_LAT = Number(import.meta.env.VITE_DELIVERY_KITCHEN_LAT ?? '10.7016')
export const KITCHEN_LNG = Number(import.meta.env.VITE_DELIVERY_KITCHEN_LNG ?? '102.1429')

const STORAGE_KEY = 'bmb_customer_location'

function loadSaved(): CustomerLocation {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CustomerLocation
      if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') {
        // CR-2 P0: restore ONLY trusted provenance (gps/manual). Anything else
        // (ip / kitchen / legacy payloads without trusted provenance) is
        // discarded so a stale approximate point never silently pre-fills checkout.
        const provenance = (parsed.provenance ?? parsed.source) as CustomerLocation['source']
        if (isTrustedSource(provenance) && parsed.latitude !== 0 && parsed.longitude !== 0) {
          return { ...parsed, source: 'saved', provenance }
        }
      }
    }
  } catch { /* ignore corrupted storage */ }
  return emptyLocation()
}

export const useLocationStore = create<LocationState>((set, get) => ({
  location: loadSaved(),
  lastUpdatedAt: null,

  setLocation: (loc) => {
    const prev = get().location
    const next: CustomerLocation = {
      ...prev,
      ...(loc.latitude !== undefined ? { latitude: loc.latitude } : {}),
      ...(loc.longitude !== undefined ? { longitude: loc.longitude } : {}),
      ...(loc.addressDetail !== undefined ? { addressDetail: loc.addressDetail } : {}),
      ...(loc.name !== undefined ? { name: loc.name } : {}),
      ...(loc.phone !== undefined ? { phone: loc.phone } : {}),
      source: loc.source,
      // CR-2 P0: keep the ORIGINAL capture source as provenance
      // (a 'saved' re-save keeps the previous provenance).
      provenance: loc.source === 'saved' ? (prev.provenance ?? prev.source) : loc.source,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch { /* storage unavailable */ }
    set({ location: next, lastUpdatedAt: Date.now() })
  },

  clearLocation: () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    set({ location: emptyLocation(), lastUpdatedAt: null })
  },
}))