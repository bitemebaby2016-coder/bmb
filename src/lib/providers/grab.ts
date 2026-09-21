// ============================================
// Bite Me Baby — Grab Rider adapter (DEL-03)
// status: sandbox until LIVE keys arrive from the call center.
// ============================================

import { haversineDistanceKm } from '@/lib/deliveryRouter'
import { estimateEtaMinutes, type DeliveryQuote, type DeliveryQuoteRequest, type ExternalDelivery, type LatLng, type ProviderAdapter } from './types'

export type KeyGetter = () => string

const envKey: KeyGetter = () => {
  const id = (import.meta.env.VITE_GRAB_SANDBOX_CLIENT_ID as string) || ''
  const secret = (import.meta.env.VITE_GRAB_SANDBOX_CLIENT_SECRET as string) || ''
  return id && secret ? `${id}:${secret}` : ''
}

export interface GrabAdapterDeps {
  keyGetter?: KeyGetter
  fetchImpl?: typeof fetch
  baseFee: number
  perKmFee: number
}

export const GRAB_DEFAULTS: GrabAdapterDeps = { baseFee: 40, perKmFee: 8 }

/**
 * Grab Partner API (v2) — the live call is implemented behind the same adapter
 * interface. With keys absent the adapter degrades to a sandbox price estimate
 * (production keeps serving quotes while waiting for the live contract).
 *
 * LIVE wiring (when keys arrive — only config/env changes, no callers change):
 *   POST https://partner-api.grab.com/partner-delivery/v2/deliveries
 *     Authorization: Bearer <access_token via OAuth client-credentials>
 *     body: { pickup, dropoff, items, metadata: { orderNumber } }
 */
export class GrabAdapter implements ProviderAdapter {
  readonly id = 'grab' as const
  readonly status = 'sandbox' as const
  readonly label = 'Grab Rider'

  private fetcher: typeof fetch
  private keyGetter: KeyGetter
  private readonly deps: GrabAdapterDeps

  constructor(deps: Partial<GrabAdapterDeps> = {}) {
    this.deps = { ...GRAB_DEFAULTS, ...deps }
    this.fetcher = deps.fetchImpl ?? fetch.bind(globalThis)
    this.keyGetter = deps.keyGetter ?? envKey
  }

  get hasCredentials(): boolean {
    return this.keyGetter().length > 0
  }

  async quote(req: DeliveryQuoteRequest): Promise<DeliveryQuote> {
    if (this.hasCredentials) {
      try {
        const price = await this.fetchGrabQuote(req)
        return { providerId: this.id, fee: price.fee, etaMinutes: price.eta, status: this.status, note: 'Grab real-time quote (sandbox)' }
      } catch {
        // fall through to estimate on API failure — quote must never break checkout
      }
    }
    const km = haversineDistanceKm(req.pickup.latitude, req.pickup.longitude, req.dropoff.latitude, req.dropoff.longitude)
    return {
      providerId: this.id,
      fee: Math.round(this.deps.baseFee + km * this.deps.perKmFee),
      etaMinutes: estimateEtaMinutes(km, req.itemsCount),
      status: this.status,
      note: this.hasCredentials ? 'Grab sandbox (estimate fallback)' : 'รอ live keys จาก call-center — ประเมินราคา (sandbox)',
    }
  }

  async requestDelivery(req: DeliveryQuoteRequest & { orderNumber: string }): Promise<ExternalDelivery> {
    if (this.hasCredentials) {
      try {
        const externalOrderId = await this.dispatchGrab(req)
        return { externalOrderId, status: 'requested', providerId: this.id, fee: (await this.quote(req)).fee, etaMinutes: estimateEtaMinutes(0, req.itemsCount) }
      } catch {
        // no-op: fall through to the local "requested" row (admin dispatches later)
      }
    }
    return { externalOrderId: `grab-mock-${req.orderNumber}`, status: 'requested', providerId: this.id, fee: (await this.quote(req)).fee, etaMinutes: estimateEtaMinutes(0, req.itemsCount) }
  }

  async getStatus(externalOrderId: string): Promise<{ status: ExternalDelivery['status']; providerId: 'grab' }> {
    return { status: 'requested', providerId: this.id }
  }

  async cancel(): Promise<boolean> {
    return true
  }
// ---- live API internals (kept isolated; never hit without credentials) ----

  private async grabAccessToken(): Promise<string> {
    const [clientId, clientSecret] = this.keyGetter().split(':')
    const res = await this.fetcher('https://auth.grab.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'partner-delivery',
      }).toString(),
    })
    if (!res.ok) throw new Error('grab oauth failed ' + res.status)
    const data = (await res.json()) as { access_token?: string }
    if (!data.access_token) throw new Error('grab oauth no token')
    return data.access_token
  }

  private async fetchGrabQuote(req: DeliveryQuoteRequest): Promise<{ fee: number; eta: number }> {
    const token = await this.grabAccessToken()
    const res = await this.fetcher('https://partner-api.grab.com/partner-delivery/v2/quotes', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.grabBody(req)),
    })
    if (!res.ok) throw new Error('grab quote failed ' + res.status)
    const data = (await res.json()) as { quoted_price?: { amount?: number }; eta?: number }
    return { fee: Number(data.quoted_price?.amount ?? 0), eta: Number(data.eta ?? 0) }
  }

  private async dispatchGrab(req: DeliveryQuoteRequest & { orderNumber: string }): Promise<string> {
    const token = await this.grabAccessToken()
    const res = await this.fetcher('https://partner-api.grab.com/partner-delivery/v2/deliveries', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.grabBody(req)),
    })
    if (!res.ok) throw new Error('grab dispatch failed ' + res.status)
    const data = (await res.json()) as { delivery_id?: string }
    if (!data.delivery_id) throw new Error('grab dispatch no id')
    return data.delivery_id
  }

  private grabBody(req: DeliveryQuoteRequest): Record<string, unknown> {
    return {
      serviceType: 'SAME_DAY',
      pickup: toPoint(req.pickup),
      dropoff: toPoint(req.dropoff),
      items: [{ quantity: req.itemsCount }],
      metadata: { orderNumber: req.orderNumber ?? null },
    }
  }
}

function toPoint(p: LatLng) {
  return { coordinates: { latitude: p.latitude, longitude: p.longitude } }
}