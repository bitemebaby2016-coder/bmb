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