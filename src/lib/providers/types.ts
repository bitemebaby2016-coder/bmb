// ============================================
// Bite Me Baby — External Delivery Provider Adapter Layer (DEL-03)
// ============================================
// "เตรียมระบบไว้ใส่ API" — every external rider channel is a Plugin-style
// adapter behind ONE interface. As soon as the call center delivers live keys
// the adapter flips from sandbox/mock to live API with NO caller changes.
//
// status semantics (mirror PROVIDER_API_STATUS):
//   live           — real API endpoint configured + called
//   sandbox        — sandbox credentials in env, live contract pending
//   mockup_pending — no credentials yet, estimated quotes only

export interface LatLng {
  latitude: number
  longitude: number
}

export type ProviderId = 'bite_drive' | 'grab' | 'lineman' | 'foodpanda'

export type ProviderStatusKind = 'live' | 'sandbox' | 'mockup_pending'

export interface DeliveryQuoteRequest {
  orderNumber?: string
  pickup: LatLng
  dropoff: LatLng
  itemsCount: number
  totalWeightKg: number
}

export interface DeliveryQuote {
  providerId: ProviderId
  /** Payable fee charged to the customer (THB). */
  fee: number
  /** Estimated delivery time (minutes). */
  etaMinutes: number
  status: ProviderStatusKind
  /** Human-readable note explaining WHY this quote is used (multiplier). */
  note: string
}

export interface ExternalDelivery {
  externalOrderId: string
  status: 'requested' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
  providerId: ProviderId
  fee: number
  etaMinutes: number
}

export interface ProviderAdapter {
  readonly id: ProviderId
  readonly status: ProviderStatusKind
  readonly label: string
  /** Real-time quote for a delivery. */
  quote(req: DeliveryQuoteRequest): Promise<DeliveryQuote>
  /** Dispatch the delivery to the provider. */
  requestDelivery(req: DeliveryQuoteRequest & { orderNumber: string }): Promise<ExternalDelivery>
  /** Poll a live external order status. */
  getStatus(externalOrderId: string): Promise<{ status: ExternalDelivery['status']; providerId: ProviderId }>
  /** Cancel a live external order (best-effort). */
  cancel(externalOrderId: string): Promise<boolean>
}

/** Fallback ETA heuristic shared by adapters that have no live API yet (DEL-04 friendly). */
export function estimateEtaMinutes(distanceKm: number, itemsCount: number): number {
  return Math.round(distanceKm * 2 + itemsCount * 5)
}