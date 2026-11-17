// ============================================
// Bite Me Baby — R16 (Owner 2026-10-28): multi-job rider route plan
// "ไรเดอร์ Bite Drive รับงานส่งได้มากกว่า 1 เพราะพรีออเดอร์ออกรอบเดียวส่งหลายที่
//  และต้องคำนวณเส้นทางและจุดส่งให้ด้วย"
// Pure (haversine only, no network) — คำนวณฝั่งเครื่องไรเดอร์ · deterministic tests
//   planMultiStopRoute = nearest-neighbour จากจุดเริ่ม (GPS ไรเดอร์/คิทเช่น)
//   googleMapsDirUrl   = ลิงก์นำทางฟรี (ไม่ต้องใช้ API key) origin → waypoints → dest
// ============================================
import { haversineDistanceSimple } from './googleMaps'

export interface PlanStop {
  order_number: string
  latitude: number
  longitude: number
  detail?: string
}

export interface RoutePlan {
  /** ลำดับส่งที่แนะนำ (nearest-neighbour จากจุดเริ่ม) */
  stops: PlanStop[]
  /** ระยะทางรวม กม. (รวมขาจุดเริ่ม → จุดแรก) */
  totalKm: number
  /** ระยะทางขาถึงจุดที่ i (ตามลำดับแนะนำ) — legKm[0] = จุดเริ่ม → จุดแรก */
  legKm: number[]
  /** true = ไม่มีจุดเริ่ม → คงลำดับเดิม (ไม่เดา) */
  noOrigin: boolean
}

/** งานที่มีพิกัด → กรองจุดที่ใช้คำนวณเส้นทางได้จริง (กัน lat/lng null/NaN) */
export function toPlanStops(
  rows: Array<{ order_number: string; dropoff_latitude: number | null; dropoff_longitude: number | null; dropoff_detail?: string | null }>,
): PlanStop[] {
  const out: PlanStop[] = []
  for (const r of rows) {
    const latitude = Number(r.dropoff_latitude)
    const longitude = Number(r.dropoff_longitude)
    if (r.dropoff_latitude == null || r.dropoff_longitude == null) continue
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    out.push({ order_number: r.order_number, latitude, longitude, detail: r.dropoff_detail ?? undefined })
  }
  return out
}

/**
 * ลำดับส่งแบบ nearest-neighbour ( greedy ) — ระยะทางรวมไม่ใช่ OPT แต่พอใช้จริงกับจุด ≤ 20
 * origin = null → คงลำดับ input (noOrigin) — ห้ามเดาจุดเริ่ม (ZERO-FAKE)
 */
export function planMultiStopRoute(
  origin: { latitude: number; longitude: number } | null,
  stops: PlanStop[],
): RoutePlan {
  const valid = stops.filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
  if (origin == null) {
    return { stops: valid, totalKm: 0, legKm: [], noOrigin: true }
  }
  const remaining = [...valid]
  const ordered: PlanStop[] = []
  const legKm: number[] = []
  let cur = origin
  let total = 0
  while (remaining.length > 0) {
    let bestIdx = 0
    let bestKm = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const km = haversineDistanceSimple(cur.latitude, cur.longitude, remaining[i].latitude, remaining[i].longitude)
      if (km < bestKm) {
        bestKm = km
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    ordered.push(next)
    legKm.push(Number(bestKm.toFixed(3)))
    total += bestKm
    cur = next
  }
  return { stops: ordered, totalKm: Number(total.toFixed(2)), legKm, noOrigin: false }
}

/** ลิงก์นำทาง Google Maps (URL scheme ฟรี ไม่ใช้ API key): origin → waypoints → destination */
export function googleMapsDirUrl(
  origin: { latitude: number; longitude: number } | null,
  stops: PlanStop[],
): string | null {
  if (stops.length === 0) return null
  const dest = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`
  const mid = stops.slice(0, -1).map((s) => `${s.latitude},${s.longitude}`)
  const params = new URLSearchParams({ api: '1', travelmode: 'driving', destination: dest })
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`)
  if (mid.length > 0) params.set('waypoints', mid.join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/**
 * ลิงก์นำทาง Google Maps โหมด turn-byตรง (single destination) — ใช้ scheme google.navigation:
 * Android: google.navigation:q=lat,lng&mode=d (เปิดแอป Maps เข้าโหมดนำทางทันที)
 * iOS: comgooglemaps://?daddr=lat,lng&directionsmode=driving (ถ้ามี Google Maps) / maps:// (Apple Maps)
 * Desktop/Other: https://www.google.com/maps/dir/?api=1&destination=lat,lng&travelmode=driving
 */
export function googleNavigationUrl(
  latitude: number,
  longitude: number,
): string {
  return `google.navigation:q=${latitude},${longitude}&mode=d`
}

/**
 * iOS fallback URL สำหรับ google.navigation (เมื่อไม่มี Google Maps)
 */
export function appleMapsFallbackUrl(
  latitude: number,
  longitude: number,
): string {
  return `maps://?daddr=${latitude},${longitude}&dirflg=d`
}

/**
 * Web fallback URL สำหรับ google.navigation (เมื่อไม่มีแอป หรือไม่ใช่ Android/iOS)
 */
export function webNavigationFallbackUrl(
  latitude: number,
  longitude: number,
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`
}

/**
 * R38+ (Owner 2026-11-17): แปลงลิงก์นำทางเดี่ยว (google.navigation: / comgooglemaps:// / maps://) ให้เปิดแอปได้จริง
 * Android: wrap google.navigation: ใน intent URL พร้อม package + browser_fallback_url
 * iOS: ใช้ comgooglemaps:// ก่อน ถ้าไม่มี fallback ไป Apple Maps (maps://)
 * Desktop/Other: web fallback URL
 * pure (รับ ua เป็น param — test ได้ไม่ต้องพึ่ง navigator)
 */
export function openNavigationUrl(
  navUrl: string | null,
  webFallbackUrl: string | null = null,
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): string | null {
  if (!navUrl) return null
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  
  // Android: wrap google.navigation: scheme ใน intent URL
  if (isAndroid && navUrl.startsWith('google.navigation:')) {
    const withoutScheme = navUrl.replace(/^google\.navigation:/, '')
    const fallback = encodeURIComponent(webFallbackUrl ?? navUrl)
    return `intent://${withoutScheme}#Intent;scheme=google.navigation;package=com.google.android.apps.maps;S.browser_fallback_url=${fallback};end`
  }
  
  // iOS: ใช้ comgooglemaps:// (Google Maps) ถ้ามีใน navUrl; ไม่งั้นใช้ apple maps fallback
  if (isIOS) {
    // ถ้า navUrl เป็น google.navigation ให้แปลงเป็น comgooglemaps://
    if (navUrl.startsWith('google.navigation:')) {
      const q = navUrl.replace('google.navigation:', '')
      return `comgooglemaps://?${q.replace('&mode=d', '&directionsmode=driving')}`
    }
    // ถ้าเป็น comgooglemaps:// หรือ maps:// ให้ใช้เลย
    if (navUrl.startsWith('comgooglemaps://') || navUrl.startsWith('maps://')) {
      return navUrl
    }
  }
  
  // Desktop / other: ใช้ web fallback
  return webFallbackUrl ?? navUrl
}

/**
 * R38 (Owner 2026-10-31: "การนำทางของไรเดอร์ ลิงก์แผนที่ออกไป แต่ไปเข้าหน้าติดตั้งแอพ
 * เรียกใช้แอพแผนที่ไม่ได้"): ใน PWA/Custom Tab ลิงก์ https://www.google.com/maps ถูกกัน
 * ไม่ให้เปิดแอปข้ามโหมด → Google เสิร์ฟหน้า "ติดตั้งแอป Google Maps" แทนการนำทาง
 * ทางแก้ (Android = ที่ไรเดอร์ใช้จริง): intent URL ระบุ package com.google.android.apps.maps
 *   → Chrome resolve แอปโดยตรง · ไม่มีแอป = S.browser_fallback_url กลับ URL เดิมในเบราว์เซอร์
 * iOS/desktop (Safari ไม่รองรับ intent: scheme) → คืน URL เดิมตามเดิม
 * pure (รับ ua เป็น param — test ได้ไม่ต้องพึ่ง navigator)
 */
export function openMapsUrl(
  url: string | null,
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): string | null {
  if (!url) return null
  if (!/Android/i.test(ua)) return url
  const withoutScheme = url.replace(/^https:\/\//, '')
  const fallback = encodeURIComponent(url)
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=${fallback};end`
}