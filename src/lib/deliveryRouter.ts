// ============================================
// Bite Me Baby — Hybrid Delivery Router (Two-Tier)
// ============================================
// Tier 1 (Bite Drive - Local) : distance ≤ biteDriveMaxDistanceKm
//                               -> own fleet, flat fee, 100% QC.
// Tier 2 (3rd-Party)          : distance > biteDriveMaxDistanceKm
//                               -> external provider real-time quote
//                                  + dynamic platform markup.
// Pure functions (no imports) so the routing decision is deterministic and
// unit-testable; the reactive store feeds it from reactivity-safe inputs.

import type { DeliveryConfig } from '@/config/platformConfig'

export type DeliveryTier = 'bite_drive' | 'third_party'

export interface RoutingQuote {
  tier: DeliveryTier
  /** Payable shipping fee shown to the customer (THB). */
  finalFee: number
  /** Fee charged by the actual executor (flat for Bite Drive, external for 3rd-party). */
  executorFee: number
  /** Amount added by the platform on top of the external quote (Tier 2 only). */
  markup: number
  /** Provider label for display. */
  providerLabel: string
  distanceKm: number
  /** Short description of the chosen service tier. */
  rationale: string
}

/** Haversine great-circle distance between two lat/lon points (km). */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface RouteInput {
  distanceKm?: number
  from?: { latitude: number; longitude: number }
  to: { latitude: number; longitude: number }
  delivery: DeliveryConfig
  /** Real-time external quote (THB) supplied by the 3rd-party API. Defaults to a flat estimate. */
  externalQuote?: number
}

/**
 * Route an order through the two-tier hub.
 * Tier 1 route (≤ max distance) uses the flat Bite Drive fee.
 * Tier 2 route (> max distance) takes the external real-time quote and injects
 * the dynamic markup before surfacing the final fee to the customer.
 */
export function routeOrder(input: RouteInput): RoutingQuote {
  const distanceKm =
    input.distanceKm ??
    (input.from
      ? haversineDistanceKm(input.from.latitude, input.from.longitude, input.to.latitude, input.to.longitude)
      : 0)

  const { biteDriveMaxDistanceKm, biteDriveFlatFee, tier2MarkupPct } = input.delivery

  if (distanceKm <= biteDriveMaxDistanceKm) {
    return {
      tier: 'bite_drive',
      finalFee: biteDriveFlatFee,
      executorFee: biteDriveFlatFee,
      markup: 0,
      providerLabel: 'Bite Drive (ไรเดอร์ร้านเอง)',
      distanceKm,
      rationale: `Tier 1: ระยะทาง ${distanceKm.toFixed(1)} กม. ≤ ${biteDriveMaxDistanceKm} กม. — ส่งเรือธงของร้านเอง ค่าธรรมเนียมคงที่ คุณภาพ 100%`,
    }
  }

  const executorFee = input.externalQuote ?? estimateExternalQuote(distanceKm)
  const markup = executorFee * (tier2MarkupPct / 100)
  return {
    tier: 'third_party',
    finalFee: executorFee + markup,
    executorFee,
    markup,
    providerLabel: 'พันธมิตรขนส่งภายนอก (GrabExpress/Lalamove/Deliveree)',
    distanceKm,
    rationale: `Tier 2: ระยะทาง ${distanceKm.toFixed(1)} กม. > ${biteDriveMaxDistanceKm} กม. — เรียกค่าบริการ real-time จากผู้ให้บริการภายนอก + markup แพลตฟอร์ม ${tier2MarkupPct}%`,
  }
}

/** Fallback external quote estimator used when a live API call is unavailable. */
export function estimateExternalQuote(distanceKm: number, base = 45, perKm = 8): number {
  return Math.max(base, Math.round(base + distanceKm * perKm))
}
