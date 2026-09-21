// ============================================
// Bite Me Baby — LINE MAN adapter (DEL-03)
// status: sandbox until live API key arrives from the call center.
// ============================================

import { haversineDistanceKm } from '@/lib/deliveryRouter'
import { estimateEtaMinutes, type DeliveryQuote, type DeliveryQuoteRequest, type ExternalDelivery, type ProviderAdapter } from './types'

const envKey = () => (import.meta.env.VITE_LINEMAN_SANDBOX_API_KEY as string) || ''

export interface LinemanAdapterDeps {
  keyGetter?: () => string
  fetchImpl?: typeof fetch
  baseFee: number
  perKmFee: number
}

export const LINEMAN_DEFAULTS: LinemanAdapterDeps = { baseFee: 35, perKmFee: 7 }

/**
 * LINE MAN Merchant API — live wiring when the sandbox key upgrades to live:
 *   POST https://api.linemaniab.com/production/v1/deliveries/create
 *     headers: { Authorization: Bearer <apiKey>, Content-Type: application/json }
 *   (sandbox host: api.linemaniab.com/sandbox/v1)
 */
export class LinemanAdapter implements ProviderAdapter {
  readonly id = 'lineman' as const
  readonly status = 'sandbox' as const
  readonly label = 'LINE MAN Rider'

  private fetcher: typeof fetch
  private keyGetter: () => string
  private readonly deps: LinemanAdapterDeps

  constructor(deps: Partial<LinemanAdapterDeps> = {}) {
    this.deps = { ...LINEMAN_DEFAULTS, ...deps }
    this.fetcher = deps.fetchImpl ?? fetch.bind(globalThis)
    this.keyGetter = deps.keyGetter ?? envKey
  }

  get hasCredentials(): boolean {
    return this.keyGetter().length > 0
  }

  private get host(): string {
    return this.hasCredentials ? 'production' : 'sandbox'
  }

  async quote(req: DeliveryQuoteRequest): Promise<DeliveryQuote> {
    if (this.hasCredentials) {
      try {
        const res = await this.fetcher(`https://api.linemaniab.com/${this.host}/v1/quotations`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + this.keyGetter(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address_from: { coordinates: [req.pickup.longitude, req.pickup.latitude] },
            address_to: { coordinates: [req.dropoff.longitude, req.dropoff.latitude] },
          }),
        })
        if (res.ok) {
          const data = (await res.json()) as { estimated_total_rider_fee?: number; estimated_delivery_minutes?: number }
          return {
            providerId: this.id, fee: Math.round(Number(data.estimated_total_rider_fee ?? 0)),
            etaMinutes: Number(data.estimated_delivery_minutes ?? 0), status: this.status, note: 'LINE MAN quote (sandbox/live)', 
          }
        }
      } catch {
        // fall through to estimate
      }
    }
    const km = haversineDistanceKm(req.pickup.latitude, req.pickup.longitude, req.dropoff.latitude, req.dropoff.longitude)
    return {
      providerId: this.id, fee: Math.round(this.deps.baseFee + km * this.deps.perKmFee),
      etaMinutes: estimateEtaMinutes(km, req.itemsCount), status: this.status,
      note: 'รอ live keys จาก call-center — ประเมินราคา (sandbox)',
    }
  }

  async requestDelivery(req: DeliveryQuoteRequest & { orderNumber: string }): Promise<ExternalDelivery> {
    return { externalOrderId: `lineman-mock-${req.orderNumber}`, status: 'requested', providerId: this.id, fee: (await this.quote(req)).fee, etaMinutes: estimateEtaMinutes(0, req.itemsCount) }
  }

  async getStatus(externalOrderId: string): Promise<{ status: ExternalDelivery['status']; providerId: 'lineman' }> {
    return { status: 'requested', providerId: this.id }
  }

  async cancel(): Promise<boolean> {
    return true
  }
}