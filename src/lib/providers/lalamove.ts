// ============================================
// Bite Me Baby — Lalamove adapter (DEL-03 pattern · Task 3 T3-b)
// status: mockup_pending — ยังไม่มี credentials (docs/02: ทุก provider ยังไม่ active)
// โครงพร้อมใส่ key โดยไม่ต้องแตะ caller (เหมือน foodpanda/grab รอบ DEL-03)
// ============================================

import { haversineDistanceKm } from '@/lib/deliveryRouter'
import {
  estimateEtaMinutes,
  type DeliveryQuote,
  type DeliveryQuoteRequest,
  type ExternalDelivery,
  type LatLng,
  type ProviderAdapter,
} from './types'

export type KeyGetter = () => string

const envKey: KeyGetter = () => (import.meta.env.VITE_LALAMOVE_SANDBOX_KEY as string) || ''

export interface LalamoveAdapterDeps {
  keyGetter?: KeyGetter
  fetchImpl?: typeof fetch
  baseFee: number
  perKmFee: number
}

export const LALAMOVE_DEFAULTS: LalamoveAdapterDeps = { baseFee: 45, perKmFee: 9 }

/**
 * LIVE wiring (เมื่อได้ key — เปลี่ยนเฉพาะ env ไม่ต้องแก้ caller):
 *   POST https://api.lalamove.com/v2.2/quotes  /  /v2.2/orders
 *   Header: Authorization: <API key> · ราคา/eta ตอนนี้ = ประมาณการจาก	distance
 */
export class LalamoveAdapter implements ProviderAdapter {
  readonly id = 'lalamove' as const
  readonly status = 'mockup_pending' as const
  readonly label = 'Lalamove Express'

  private fetcher: typeof fetch
  private keyGetter: KeyGetter
  private readonly deps: LalamoveAdapterDeps

  constructor(deps: Partial<LalamoveAdapterDeps> = {}) {
    this.deps = { ...LALAMOVE_DEFAULTS, ...deps }
    this.fetcher = deps.fetchImpl ?? fetch.bind(globalThis)
    this.keyGetter = deps.keyGetter ?? envKey
  }

  get hasCredentials(): boolean {
    return this.keyGetter().length > 0
  }

  async quote(req: DeliveryQuoteRequest): Promise<DeliveryQuote> {
    const km = haversineDistanceKm(
      req.pickup.latitude,
      req.pickup.longitude,
      req.dropoff.latitude,
      req.dropoff.longitude,
    )
    return {
      providerId: this.id,
      fee: Math.round(this.deps.baseFee + km * this.deps.perKmFee),
      etaMinutes: estimateEtaMinutes(km, req.itemsCount),
      status: this.status,
      note: this.hasCredentials
        ? 'Lalamove (key มาแล้ว — ยังรอสัญญาณ live contract ก่อนเรียก API)'
        : 'รอ key Lalamove — ประเมินราคา (mockup_pending)',
    }
  }

  async requestDelivery(req: DeliveryQuoteRequest & { orderNumber: string }): Promise<ExternalDelivery> {
    // mockup_pending: สร้างแถวงานโครงเท่านั้น — ไม่มีการยิง API ภายนอกจริง
    void this.fetcher // คงไว้ให้รอบ live ใช้ (ไม่มี side effect ตอนนี้)
    const q = await this.quote(req)
    return {
      externalOrderId: `lalamove-mock-${req.orderNumber}`,
      status: 'requested',
      providerId: this.id,
      fee: q.fee,
      etaMinutes: q.etaMinutes,
    }
  }

  async getStatus(): Promise<{ status: ExternalDelivery['status']; providerId: 'lalamove' }> {
    return { status: 'requested', providerId: this.id }
  }

  async cancel(): Promise<boolean> {
    return true
  }
}

// กัน unused-import รอบ mockup (LatLng ใช้ตอน live wiring เหมือน grab.toPoint)
export type { LatLng }