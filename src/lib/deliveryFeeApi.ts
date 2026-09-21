// ============================================
// Bite Me Baby — Authoritative delivery fee API (DEL-01)
// Server fee comes from delivery_zones via compute_delivery_fee_rpc (migration 020).
// The pure mirror exists so UI can render an identical fee even when offline
// (zone rows mirrored from the seeded delivery_zones table).
// ============================================

import { supabase } from './supabase'
import { haversineDistanceKm } from './deliveryRouter'

export interface DeliveryZonesRow {
  id: string
  name: string
  min_distance_km: number
  max_distance_km: number
  fee: number
  is_active: boolean
}

export const SEEDED_DELIVERY_ZONES: DeliveryZonesRow[] = [
  { id: 'zone-city', name: 'ในเมือง', min_distance_km: 0, max_distance_km: 5, fee: 25, is_active: true },
  { id: 'zone-suburb', name: 'ชานเมือง', min_distance_km: 5, max_distance_km: 10, fee: 45, is_active: true },
  { id: 'zone-far', name: 'ไกล', min_distance_km: 10, max_distance_km: 20, fee: 80, is_active: true },
]

/** Pure: pick the zone that contains `distanceKm` and return its flat fee. */
export function zoneFeeForDistance(distanceKm: number, zones: DeliveryZonesRow[] = SEEDED_DELIVERY_ZONES): number | null {
  const zone = zones
    .filter((z) => z.is_active && distanceKm >= z.min_distance_km && distanceKm <= z.max_distance_km)
    .sort((a, b) => a.max_distance_km - b.max_distance_km)[0]
  return zone ? zone.fee : null
}

/** Server-authoritative fee quote (migration 020 RPC). Falls back to local mirror. */
export async function fetchServerDeliveryFee(params: {
  dropoffLatitude: number | null
  dropoffLongitude: number | null
  deliveryMethod?: string
  itemsCount?: number
  distanceKm?: number | null
  kitchen?: { latitude: number; longitude: number }
}): Promise<{ delivery_fee: number; source: 'server' | 'local-mirror' }> {
  try {
    const { data, error } = await supabase.rpc('compute_delivery_fee_rpc', {
      p_dropoff_latitude: params.dropoffLatitude ?? null,
      p_dropoff_longitude: params.dropoffLongitude ?? null,
      p_delivery_method: params.deliveryMethod ?? 'self_delivery',
      p_items_count: params.itemsCount ?? 1,
      p_distance_km: params.distanceKm ?? null,
    })
    if (!error && data && typeof (data as { delivery_fee: number }).delivery_fee === 'number') {
      return { delivery_fee: (data as { delivery_fee: number }).delivery_fee, source: 'server' }
    }
  } catch (e) {
    console.warn('[DeliveryFee] server quote unavailable, using mirror:', String(e).slice(0, 100))
  }
  return { delivery_fee: localZoneFee(params), source: 'local-mirror' }
}

/** Local mirror — identical zone math, no network. */
export function localZoneFee(params: {
  dropoffLatitude?: number | null
  dropoffLongitude?: number | null
  distanceKm?: number | null
  kitchen?: { latitude: number; longitude: number }
}): number {
  const kitchen = params.kitchen ?? { latitude: 10.7016, longitude: 102.1429 }
  const distanceKm =
    params.distanceKm ??
    (params.dropoffLatitude != null && params.dropoffLongitude != null
      ? haversineDistanceKm(kitchen.latitude, kitchen.longitude, params.dropoffLatitude, params.dropoffLongitude)
      : 0)
  return zoneFeeForDistance(distanceKm) ?? 0
}