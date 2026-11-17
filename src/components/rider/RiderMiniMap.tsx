// ============================================
// Bite Me Baby — RiderMiniMap (PHASE 2 map fix, 2026-10-20)
// แผนที่ย่อในหน้า /rider: แสดง "จุดปัก" ที่แยกชนิดกันชัดเจน
//   🏠 ปลายทาง = พิกัดจากออเดอร์ (dropoff — trusted source, ไม่ใช่ค่า default)
//   🛵 คุณ      = GPS ปัจจุบันของไรเดอร์ (ตอนกดตรวจพิกัดเท่านั้น)
//   🍳 ครัว     = config/kitchenLocation (จุดอ้างอิงเท่านั้น ไม่ใช่ปลายทาง)
// ถ้า Google Maps SDK โหลดไม่ได้ → โหลด Leaflet (OpenStreetMap) เป็น fallback
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

type MapMode = 'google' | 'leaflet' | 'none'
type MapStatus = 'loading' | 'ready' | 'unavailable'

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function loadLeaflet(): Promise<void> {
  if ((window as any).L) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      // CSS already loaded
    } else {
      const cssLink = document.createElement('link')
      cssLink.rel = 'stylesheet'
      cssLink.href = LEAFLET_CSS
      cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
      cssLink.crossOrigin = ''
      document.head.appendChild(cssLink)
    }
    if ((window as any).L) { resolve(); return }
    const script = document.createElement('script')
    script.src = LEAFLET_JS
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
    script.crossOrigin = ''
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Leaflet'))
    document.head.appendChild(script)
  })
}

export function RiderMiniMap({ dropOff, rider, stops }: RiderMiniMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markerRefs = useRef<Record<string, unknown>>({})
  const polylineRef = useRef<{ setMap: (m: unknown) => void } | null>(null)
  const leafletMapRef = useRef<any>(null)
  const leafletMarkersRef = useRef<any[]>([])
  const [status, setStatus] = useState<MapStatus>('loading')
  const [mode, setMode] = useState<MapMode>('google')
  const stopList = stops && stops.length > 0 ? stops : null

  // Render map container whenever we have a map to show (google ready OR leaflet fallback)
  const shouldRenderMap = status === 'ready' || (status === 'unavailable' && mode === 'leaflet')

  // Google Maps effect
  useEffect(() => {
    let cancelled = false
    const onMapsError = () => {
      if (!cancelled) setStatus('unavailable')
    }
    window.addEventListener('bmb-maps-error', onMapsError)
    if (!isGoogleMapsConfigured()) {
      if (!cancelled) setStatus('unavailable')
      return
    }
    void loadGoogleMapsJS().then(() => {
      if (cancelled) return
      if (getGoogleMapsLoadError()) {
        if (!cancelled) setStatus('unavailable')
        return
      }
      const g = (window as { google?: { maps?: Record<string, unknown> } }).google
      if (!mapRef.current || !g?.maps) {
        if (!cancelled) setStatus('unavailable')
        return
      }
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
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('unavailable')
      }
    })
    return () => { cancelled = true; window.removeEventListener('bmb-maps-error', onMapsError) }
  }, [])

  // Leaflet fallback effect
  useEffect(() => {
    if (status !== 'unavailable') return
    let cancelled = false
    void loadLeaflet().then(() => {
      if (cancelled) return
      if (!mapRef.current || (window as any).L === undefined) return
      try {
        const L = (window as any).L
        // Delete default marker icon images to use emoji markers instead
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '',
          iconUrl: '',
          shadowUrl: '',
        })
        const map = L.map(mapRef.current, {
          center: [dropOff.latitude, dropOff.longitude],
          zoom: 15,
          zoomControl: false,
          attributionControl: true,
        })
        L.tileLayer(OSM_TILE, {
          maxZoom: 19,
          attribution: OSM_ATTRIBUTION,
        }).addTo(map)
        leafletMapRef.current = map
        setMode('leaflet')
        // Render markers after map is ready
        renderLeafletMarkers(L, map)
      } catch (e) {
        console.error('[RiderMiniMap] Leaflet init failed:', e)
        // Leaflet failed, stay unavailable but map container exists
      }
    }).catch((e) => {
      if (cancelled) return
      console.error('[RiderMiniMap] Leaflet CDN load failed:', e)
      // CDN failed - map container exists but no tiles
    })
    return () => {
      cancelled = true
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  }, [status, dropOff.latitude, dropOff.longitude, rider?.latitude, rider?.longitude, stopList])

  function renderLeafletMarkers(L: any, map: any) {
    // Clear existing markers
    leafletMarkersRef.current.forEach(m => m.remove())
    leafletMarkersRef.current = []

    const points: Array<{ key: string; title: string; label: string; pos: { lat: number; lng: number } }> = []
    if (rider) points.push({ key: 'rider', title: 'ตำแหน่งคุณ (GPS)', label: '🛵', pos: { lat: rider.latitude, lng: rider.longitude } })
    if (stopList) {
      stopList.forEach((s, i) => {
        points.push({ key: `stop-${s.order_number}`, title: `จุด ${i + 1} · ${s.order_number}`, label: String(i + 1), pos: { lat: s.latitude, lng: s.longitude } })
      })
    } else {
      points.push({ key: 'dropoff', title: 'ปลายทาง (จากออเดอร์)', label: '🏠', pos: { lat: dropOff.latitude, lng: dropOff.longitude } })
    }
    points.push({ key: 'kitchen', title: 'ครัว (จุดอ้างอิง)', label: '🍳', pos: { lat: KITCHEN_LAT, lng: KITCHEN_LNG } })

    const bounds = L.latLngBounds()
    points.forEach(p => {
      const latLng = L.latLng(p.pos.lat, p.pos.lng)
      const marker = L.marker(latLng, {
        title: p.title,
        icon: L.divIcon({
          className: 'rider-mini-map-emoji-marker',
          html: `<div style="font-size: 20px; line-height: 1;">${p.label}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map)
      marker.bindTooltip(p.title, { permanent: false, direction: 'top' })
      leafletMarkersRef.current.push(marker)
      bounds.extend(latLng)
    })
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] })

    // Polyline for multi-stop
    if (stopList && stopList.length > 1) {
      const path = [
        ...(rider ? [{ lat: rider.latitude, lng: rider.longitude }] : []),
        ...stopList.map(s => ({ lat: s.latitude, lng: s.longitude })),
      ].map(p => L.latLng(p.lat, p.lng))
      L.polyline(path, { color: '#2563eb', weight: 4, opacity: 0.9 }).addTo(map)
    }
  }

  // Google Maps marker sync
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

  // Google Maps polyline
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
          ...stopList.map(s => ({ lat: s.latitude, lng: s.longitude })),
        ]
        const PolyCtor = g.maps.Polyline as new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void }
        polylineRef.current = new PolyCtor({ path, map, strokeColor: '#2563eb', strokeOpacity: 0.9, strokeWeight: 4 })
      }
    } catch { /* polyline พัง — ปักจุดยังใช้ดูได้ */ }
  }, [status, rider?.latitude, rider?.longitude, stopList])

  const distanceM = rider
    ? Math.round(haversineDistanceSimple(rider.latitude, rider.longitude, dropOff.latitude, dropOff.longitude) * 1000)
    : null

  const isGoogleReady = status === 'ready' && mode === 'google'
  const isLeafletReady = status === 'unavailable' && mode === 'leaflet'

  return (
    <div className="mt-2" data-testid="rider-mini-map">
      {shouldRenderMap && (
        <div ref={mapRef} data-testid="rider-mini-map-canvas" className="w-full h-52 rounded-xl border-2 border-brand-border" style={{ zIndex: mode === 'leaflet' ? 0 : undefined }} />
      )}
      {status === 'loading' && <p className="text-xs text-brand-muted mt-1">⏳ กำลังโหลดแผนที่…</p>}
      {status === 'unavailable' && mode === 'google' && (
        <div className="mt-2 p-3 rounded-lg border border-amber-400" data-testid="rider-mini-map-unavailable">
          <p className="text-xs font-medium" style={{ color: '#b45309' }}>
            ⚠️ Google Maps โหลดไม่ได้{getGoogleMapsLoadError() ? ` (${getGoogleMapsLoadError()})` : ' (ยังไม่ได้ตั้งค่า Google Maps API key หรือโหลด SDK ไม่สำเร็จ)'}
            {' '}— กำลังโหลด OpenStreetMap แทน…
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