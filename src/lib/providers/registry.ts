// ============================================
// Bite Me Baby — Provider adapter registry (DEL-03)
// ============================================
// One place to resolve "which adapter serves provider X" and to surface the
// live API status per channel (mirror of PROVIDER_API_STATUS but driven by the
// adapters themselves, so CALL status can never drift from the render).

import { BiteDriveAdapter, type BiteDriveAdapterDeps } from './biteDrive'
import { GrabAdapter, type GrabAdapterDeps } from './grab'
import { LinemanAdapter, type LinemanAdapterDeps } from './lineman'
import { FoodpandaAdapter, type FoodpandaAdapterDeps } from './foodpanda'
import type { ProviderAdapter, ProviderId } from './types'

export interface ProviderRegistry {
  get(providerId: ProviderId): ProviderAdapter
  all(): ProviderAdapter[]
  statusMap(): Record<string, { status: ProviderAdapter['status']; label: string; note: string }>
  /** Rebuild adapters (e.g. tests, or after runtime key updates). */
  reset(overrides?: Partial<Record<ProviderId, Partial<BiteDriveAdapterDeps & GrabAdapterDeps & LinemanAdapterDeps>>>): void
}

function createRegistry(): ProviderRegistry {
  let adapters: Record<ProviderId, ProviderAdapter> = makeAdapters({})

  function makeAdapters(o: Partial<Record<ProviderId, Partial<BiteDriveAdapterDeps & GrabAdapterDeps & LinemanAdapterDeps>>>): Record<ProviderId, ProviderAdapter> {
    return {
      bite_drive: new BiteDriveAdapter(o.bite_drive),
      grab: new GrabAdapter(o.grab),
      lineman: new LinemanAdapter(o.lineman),
      foodpanda: new FoodpandaAdapter(o.foodpanda),
    }
  }

  return {
    get(providerId) {
      const a = adapters[providerId]
      if (!a) throw new Error('Unknown provider adapter: ' + providerId)
      return a
    },
    all() {
      return Object.values(adapters)
    },
    statusMap() {
      const map: Record<string, { status: ProviderAdapter['status']; label: string; note: string }> = {}
      for (const a of Object.values(adapters)) map[a.id] = { status: a.status, label: a.label, note: '' }
      return map
    },
    reset(overrides = {}) {
      adapters = makeAdapters(overrides)
    },
  }
}

/** Default singleton registry (env-configured credentials). */
export const providerRegistry: ProviderRegistry = createRegistry()