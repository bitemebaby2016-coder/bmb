// ============================================
// Bite Me Baby — Reactive Delivery Router Store (Two-Tier Hub)
// ============================================
// Holds origin/destination and a computed RoutingQuote. Reactivity lives here;
// debounce (500ms) is enforced by the DistanceChecker component / hook before
// calling `evaluate()` so API consumption stays rate-limit friendly.

import { create } from 'zustand'
import { routeOrder, type RoutingQuote } from '@/lib/deliveryRouter'
import { usePlatformConfigStore } from '@/config/platformConfig'

export interface LatLng {
  latitude: number
  longitude: number
}

interface DeliveryRouterStore {
  origin: LatLng | null
  destination: LatLng | null
  quote: RoutingQuote | null
  error: string | null

  setOrigin: (origin: LatLng | null) => void
  setDestination: (destination: LatLng | null) => void
  /** Recompute the routing decision from the current config (synchronous, pure). */
  evaluate: () => void
  reset: () => void
}

export const useDeliveryRouter = create<DeliveryRouterStore>((set, get) => ({
  origin: null,
  destination: null,
  quote: null,
  error: null,

  setOrigin: (origin) => set({ origin }),

  setDestination: (destination) => {
    if (!destination || !Number.isFinite(destination.latitude) || !Number.isFinite(destination.longitude)) {
      set({ destination, quote: null, error: null })
      return
    }
    set({ destination, error: null })
  },

  evaluate: () => {
    const { origin, destination } = get()
    if (!destination) {
      set({ quote: null, error: 'ยังไม่มีพิกัดปลายทาง' })
      return
    }
    if (
      !Number.isFinite(destination.latitude) ||
      !Number.isFinite(destination.longitude) ||
      (origin !== null &&
        (!Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude)))
    ) {
      set({ quote: null, error: 'พิกัดไม่ถูกต้อง (ไม่ใช่ตัวเลข finite)' })
      return
    }
    const config = usePlatformConfigStore.getState().config
    try {
      const quote = routeOrder({
        from: origin ?? undefined,
        to: destination,
        delivery: config.delivery,
      })
      set({ quote, error: null })
    } catch (e) {
      set({ quote: null, error: (e as Error).message })
    }
  },

  reset: () => set({ origin: null, destination: null, quote: null, error: null }),
}))
