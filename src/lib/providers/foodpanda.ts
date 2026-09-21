// ============================================
// Bite Me Baby — FoodPanda adapter (DEL-03)
// status: mockup_pending — no credentials yet; quotes are estimates only.
// ============================================

import { haversineDistanceKm } from '@/lib/deliveryRouter'
import { estimateEtaMinutes, type DeliveryQuote, type DeliveryQuoteRequest, type ExternalDelivery, type ProviderAdapter } from './types'

export interface FoodpandaAdapterDeps {
  baseFee: number
  perKmFee: number
}

export const FOODPANDA_DEFAULTS: FoodpandaAdapterDeps = { baseFee: 38, perKmFee: 7.5 }

export class FoodpandaAdapter implements ProviderAdapter {
  readonly id = 'foodpanda' as const
  readonly status = 'mockup_pending' as const
  readonly label = 'FoodPanda'

  private readonly deps: FoodpandaAdapterDeps

  constructor(deps: Partial<FoodpandaAdapterDeps> = {}) {
    this.deps = { ...FOODPANDA_DEFAULTS, ...deps }
  }

  async quote(req: DeliveryQuoteRequest): Promise<DeliveryQuote> {
    const km = haversineDistanceKm(req.pickup.latitude, req.pickup.longitude, req.dropoff.latitude, req.dropoff.longitude)
    return {
      providerId: this.id, fee: Math.round(this.deps.baseFee + km * this.deps.perKmFee),
      etaMinutes: estimateEtaMinutes(km, req.itemsCount), status: this.status,
      note: 'ไม่มี credentials — mock ราคาเท่านั้น (รอ contracts)',
    }
  }

  async requestDelivery(req: DeliveryQuoteRequest & { orderNumber: string }): Promise<ExternalDelivery> {
    return { externalOrderId: `foodpanda-mock-${req.orderNumber}`, status: 'requested', providerId: this.id, fee: (await this.quote(req)).fee, etaMinutes: estimateEtaMinutes(0, req.itemsCount) }
  }

  async getStatus(externalOrderId: string): Promise<{ status: ExternalDelivery['status']; providerId: 'foodpanda' }> {
    return { status: 'requested', providerId: this.id }
  }

  async cancel(): Promise<boolean> {
    return true
  }
}