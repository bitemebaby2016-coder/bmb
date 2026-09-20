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
  name?: string
  phone?: string
}

interface LocationState {
  location: CustomerLocation
  lastUpdatedAt: number | null
  setLocation: (loc: Partial<CustomerLocation> & { source: CustomerLocation['source'] }) => void
  clearLocation: () => void
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
        return { ...parsed, source: 'saved' }
      }
    }
  } catch { /* ignore corrupted storage */ }
  return { latitude: KITCHEN_LAT, longitude: KITCHEN_LNG, addressDetail: '', source: '' }
}

export const useLocationStore = create<LocationState>((set, get) => ({
  location: loadSaved(),
  lastUpdatedAt: null,

  setLocation: (loc) => {
    const next: CustomerLocation = {
      ...get().location,
      ...(loc.latitude !== undefined ? { latitude: loc.latitude } : {}),
      ...(loc.longitude !== undefined ? { longitude: loc.longitude } : {}),
      ...(loc.addressDetail !== undefined ? { addressDetail: loc.addressDetail } : {}),
      ...(loc.name !== undefined ? { name: loc.name } : {}),
      ...(loc.phone !== undefined ? { phone: loc.phone } : {}),
      source: loc.source,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch { /* storage unavailable */ }
    set({ location: next, lastUpdatedAt: Date.now() })
  },

  clearLocation: () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    set({ location: { latitude: KITCHEN_LAT, longitude: KITCHEN_LNG, addressDetail: '', source: '' }, lastUpdatedAt: null })
  },
}))