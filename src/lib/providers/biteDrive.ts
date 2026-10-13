// ============================================
// Bite Me Baby — Bite Drive adapter (own fleet) — status: live (no external key)
// ============================================

import { haversineDistanceKm } from '@/lib/deliveryRouter'
import { estimateEtaMinutes, type DeliveryQuote, type DeliveryQuoteRequest, type ExternalDelivery, type ProviderAdapter } from './types'

export interface BiteDriveAdapterDeps {
  baseFee: number
  perKmFee: number
  maxDistanceKm: number
}

export const BITE_DRIVE_DEFAULTS: BiteDriveAdapterDeps = {
  baseFee: 25,
  perKmFee: 4,
  maxDistanceKm: 5,
}

export class BiteDriveAdapter implements ProviderAdapter {
  readonly id = 'bite_drive' as const
  readonly status = 'live' as const
  readonly label = 'Bite Drive (ไรเดอร์ร้านเอง)'

  private readonly deps: BiteDriveAdapterDeps

  constructor(deps: Partial<BiteDriveAdapterDeps> = {}) {
    this.deps = { ...BITE_DRIVE_DEFAULTS, ...deps }
  }

  async quote(req: DeliveryQuoteRequest): Promise<DeliveryQuote> {
    const km = haversineDistanceKm(req.pickup.latitude, req.pickup.longitude, req.dropoff.latitude, req.dropoff.longitude)
    const overMax = km > this.deps.maxDistanceKm
    return {
      providerId: this.id,
      fee: overMax ? -1 : Math.round(this.deps.baseFee + km * this.deps.perKmFee),
      etaMinutes: estimateEtaMinutes(km, req.itemsCount),
      status: this.status,
      note: overMax
        ? 'ไกลเกินระยะ Bite Drive — ต้องเลือกพันธมิตรภายนอก'
        : 'ส่งโดยไรเดอร์ร้านเอง คุณภาพ 100%',
    }
  }

  async requestDelivery(req: DeliveryQuoteRequest & { orderNumber: string }): Promise<ExternalDelivery> {
    // Own fleet dispatch goes through delivery_assignments (migration 020), not an API.
    return {
      externalOrderId: `bd-${req.orderNumber}`,
      status: 'accepted',
      providerId: this.id,
      fee: (await this.quote(req)).fee,
      etaMinutes: estimateEtaMinutes(
        haversineDistanceKm(req.pickup.latitude, req.pickup.longitude, req.dropoff.latitude, req.dropoff.longitude),
        req.itemsCount,
      ),
    }
  }

  async getStatus(externalOrderId: string): Promise<{ status: ExternalDelivery['status']; providerId: 'bite_drive' }> {
    return { status: 'accepted', providerId: this.id }
  }

  async cancel(): Promise<boolean> {
    return true
  }
}