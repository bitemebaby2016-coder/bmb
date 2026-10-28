// ============================================
// Bite Me Baby — RiderMiniMap (PHASE 2 map fix, 2026-10-20)
// แผนที่ย่อในหน้า /rider: แสดง "จุดปัก" ที่แยกชนิดกันชัดเจน
//   🏠 ปลายทาง = พิกัดจากออเดอร์ (dropoff — trusted source, ไม่ใช่ค่า default)
//   🛵 คุณ      = GPS ปัจจุบันของไรเดอร์ (ตอนกดตรวจพิกัดเท่านั้น)
//   🍳 ครัว     = config/kitchenLocation (จุดอ้างอิงเท่านั้น ไม่ใช่ปลายทาง)
// ถ้า Google Maps SDK โหลดไม่ได้ → แสดงข้อความสาเหตุ + พิกัดตัวเลข
// (haversine ระยะทางยังคำนวณได้) — ไม่ hardcode หลอกว่าแผนที่ทำงานแล้ว
//
// R16 (Owner 2026-10-28): `stops` — งานหลายใบ = ปักจุดส่ง 1..N ตามลำดับแนะนำ
//   + polyline เส้นทาง (คำนวณฝั่ง deliveryPlan.ts · null/[] = โหมดเดิมจุดเดียว)
// ============================================

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsJS, isGoogleMapsConfigured, getGoogleMapId, getGoogleMapsLoadError, haversineDistanceSimple } from '@/lib/googleMaps'
import { KITCHEN_LAT, KITCHEN_LNG } from '@/config/kitchenLocation'
import type { PlanStop } from '@/lib/deliveryPlan'

export interface RiderMiniMapProps {
  dropOff: { latitude: number; longitude: number }
  rider?: { latitude: number; longitude: number } | null
  /** R16: งานหลายใบ (null/[] = โหมดเดิม จุดเดียว 🏠) */
  stops?: PlanStop[] | null
}

type MapStatus = 'loading' | 'ready' | 'unavailable'

export function RiderMiniMap({ dropOff, rider, stops }: RiderMiniMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markerRefs = useRef<Record<string, unknown>>({})
  const polylineRef = useRef<{ setMap: (m: unknown) => void } | null>(null)
  const [status, setStatus] = useState<MapStatus>('loading')
  const stopList = stops && stops.length > 0 ? stops : null

  useEffect(() => {
    let cancelled = false
    // PHASE 3 (2026-10-20): gm_authFailure แจ้งผ่าน event — สลับเป็น unavailable ทันที
    const onMapsError = () => setStatus('unavailable')
    window.addEventListener('bmb-maps-error', onMapsError)
    if (!isGoogleMapsConfigured()) { setStatus('unavailable'); return }
    void loadGoogleMapsJS().then(() => {
      if (cancelled) return
      if (getGoogleMapsLoadError()) { setStatus('unavailable'); return }
      const g = (window as { google?: { maps?: Record<string, unknown> } }).google
      if (!mapRef.current || !g?.maps) { setStatus('unavailable'); return }
      try {
        const MapCtor = g.maps.Map as new (el: HTMLElement, opts: Record<string, unknown>) => unknown
        mapInstanceRef.current = new MapCtor(mapRef.current, {
          center: { lat: dropOff.latitude, lng: dropOff.longitude },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          ...(getGoogleMapId() ? { mapId: getGoogleMapId() } : {}),
        })
        setStatus('ready')
      } catch { setStatus('unavailable') }
    })
    return () => { cancelled = true; window.removeEventListener('bmb-maps-error', onMapsError) }
    // สร้างแผนที่ครั้งเดียว — marker sync ใน effect ถัดไป
    // สร้างแผนที่ครั้งเดียวต่อ mount — marker sync ใน effect ถัดไป
  }, [])

  // marker sync — ล้างทุกครั้งแล้วปักใหม่ (กัน marker ค้างข้ามโหมดเดี่ยว/หลายจุด)
  useEffect(() => {
    if (status !== 'ready') return
    const g = (window as { google?: { maps?: Record<string, unknown> } }).google
    const map = mapInstanceRef.current as { setCenter: (c: { lat: number; lng: number }) => void } | null
    if (!g?.maps || !map) return
    type GMarker = { setPosition?: (p: { lat: number; lng: number }) => void; setMap?: (m: unknown) => void }
    const MarkerCtor = g.maps.Marker as new (opts: Record<string, unknown>) => GMarker
    try {
      for (const key of Object.keys(markerRefs.current)) {
        const old = markerRefs.current[key] as GMarker | undefined
        old?.setMap?.(null)
      }
      markerRefs.current = {}
      const points: Array<{ key: string; title: string; label: string; pos: { lat: number; lng: number } }> = []
      if (rider) points.push({ key: 'rider', title: 'ตำแหน่งคุณ (GPS)', label: '🛵', pos: { lat: rider.latitude, lng: rider.longitude } })
      if (stopList) {
        // R16: จุดส่งหลายใบ เรียงตามลำดับแนะนำ (เลข 1..N บนแผนที่)
        stopList.forEach((s, i) => {
          points.push({ key: `stop-${s.order_number}`, title: `จุด ${i + 1} · ${s.order_number}`, label: String(i + 1), pos: { lat: s.latitude, lng: s.longitude } })
        })
      } else {
        points.push({ key: 'dropoff', title: 'ปลายทาง (จากออเดอร์)', label: '🏠', pos: { lat: dropOff.latitude, lng: dropOff.longitude } })
      }
      points.push({ key: 'kitchen', title: 'ครัว (จุดอ้างอิง)', label: '🍳', pos: { lat: KITCHEN_LAT, lng: KITCHEN_LNG } })
      for (const p of points) {
        markerRefs.current[p.key] = new MarkerCtor({ position: p.pos, map, title: p.title, label: p.label })
      }
      const focus = rider ?? (stopList ? { latitude: stopList[0].latitude, longitude: stopList[0].longitude } : { latitude: dropOff.latitude, longitude: dropOff.longitude })
      map.setCenter({ lat: focus.latitude, lng: focus.longitude })
    } catch { /* marker พัง — แผนที่ยังใช้ดูได้ */ }
  }, [status, dropOff.latitude, dropOff.longitude, rider?.latitude, rider?.longitude, stopList])

  // R16: polyline เส้นทางแนะนำ — ไรเดอร์(ถ้ามี) → จุดส่งตามลำดับ
  useEffect(() => {
    if (status !== 'ready') return
    const g = (window as { google?: { maps?: Record<string, unknown> } }).google
    const map = mapInstanceRef.current as Record<string, unknown> | null
    if (!g?.maps || !map) return
    try {
      if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null }
      if (stopList && stopList.length > 1) {
        const path = [
          ...(rider ? [{ lat: rider.latitude, lng: rider.longitude }] : []),
          ...stopList.map((s) => ({ lat: s.latitude, lng: s.longitude })),
        ]
        const PolyCtor = g.maps.Polyline as new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void }
        polylineRef.current = new PolyCtor({ path, map, strokeColor: '#2563eb', strokeOpacity: 0.9, strokeWeight: 4 })
      }
    } catch { /* polyline พัง — ปักจุดยังใช้ดูได้ */ }
  }, [status, rider?.latitude, rider?.longitude, stopList])

  const distanceM = rider
    ? Math.round(haversineDistanceSimple(rider.latitude, rider.longitude, dropOff.latitude, dropOff.longitude) * 1000)
    : null

  return (
    <div className="mt-2" data-testid="rider-mini-map">
      {status !== 'unavailable' && (
        <div ref={mapRef} data-testid="rider-mini-map-canvas" className="w-full h-52 rounded-xl border-2 border-brand-border" />
      )}
      {status === 'loading' && <p className="text-xs text-brand-muted mt-1">⏳ กำลังโหลดแผนที่…</p>}
      {status === 'unavailable' && (
        <div className="mt-2 p-3 rounded-lg border border-amber-400" data-testid="rider-mini-map-unavailable">
          <p className="text-xs font-medium" style={{ color: '#b45309' }}>
            ⚠️ แผนที่แสดงไม่ได้{getGoogleMapsLoadError() ? ` (${getGoogleMapsLoadError()})` : ' (ยังไม่ได้ตั้งค่า Google Maps API key บนเซิร์ฟเวอร์ที่ deploy หรือโหลด SDK ไม่สำเร็จ)'}
            {' '}— ใช้พิกัดด้านล่างแทน
          </p>
        </div>
      )}
      <p className="text-xs text-slate-600 mt-1">
        🏠 ปลายทาง (จากออเดอร์): {dropOff.latitude.toFixed(5)}, {dropOff.longitude.toFixed(5)}
        {stopList ? ` · ${stopList.length} จุดส่ง (ตามลำดับแนะนำ)` : ''}
      </p>
      {rider ? (
        <p className="text-xs text-slate-600">
          🛵 คุณ (GPS): {rider.latitude.toFixed(5)}, {rider.longitude.toFixed(5)}
          {distanceM !== null && ` · ห่างปลายทาง ${distanceM.toLocaleString('th-TH')} ม.`}
        </p>
      ) : (
        <p className="text-xs text-slate-500">🛵 กด "ตรวจพิกัดปัจจุบัน" เพื่อเทียบระยะห่างจากปลายทาง</p>
      )}
      <p className="text-xs text-slate-400">🍳 ครัว (อ้างอิง): {KITCHEN_LAT.toFixed(5)}, {KITCHEN_LNG.toFixed(5)}</p>
    </div>
  )
}