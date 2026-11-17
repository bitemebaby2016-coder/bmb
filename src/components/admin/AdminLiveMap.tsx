// ============================================
// Bite Me Baby — AdminLiveMap (E3 · 2026-10-22 · R47 2026-11-17)
// ============================================
// แผนที่กลางของ Dispatch Center: แสดงตำแหน่งไรเดอร์ "วิ่งจริง" ทุกคน
// (drivers.current_* จาก GPS heartbeat 136) + เส้นทางย้อนหลังของงาน
// (driver_location_history) เป็น polyline — ข้อมูลทั้งหมดมาจาก server ไม่มีจุดจำลอง
//
// R47 (Owner 2026-11-17): Google Maps SDK ล้มในเบราว์เซอร์ (key ถูกปฏิเสธ/เครือข่าย)
// แอดมินเคยเป็นฝั่งเดียวที่ไม่มี fallback map → เห็นแต่ข้อความพิกัด
// เพิ่ม Leaflet (OpenStreetMap) fallback ตามต้นแบบ RiderMiniMap (รอบ 44-45):
//   * div แผนที่ render ตลอด (mapRef พร้อมก่อน init — กันบั๊ก render-order รอบ 45)
//   * Google ล้ม → Leaflet ยึด div เดิม: OSM tiles + จุดไรเดอร์จริง + polyline
//   * จุดเก่า (R46) = วงจาง/สีเทา + tooltip บอก label อายุ — ไม่อวดว่า live
// ============================================
import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsJS, isGoogleMapsConfigured, getGoogleMapId, getGoogleMapsLoadError } from '@/lib/googleMaps'
import { KITCHEN_LAT, KITCHEN_LNG } from '@/config/kitchenLocation'
import { loadLeaflet, OSM_TILE, OSM_ATTRIBUTION } from '@/lib/leafletLoader'
import { positionAgeInfo } from '@/lib/positionFreshness'

export interface AdminLiveMapDriver {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  status?: string
  /** R46 (m180): เวลา heartbeat GPS ล่าสุด — ใช้ตัดสิน "ตำแหน่งเก่า" (ไม่โชว์พิกัดค้างราวกับ live) */
  lastSeenAt?: string | null
}

export interface AdminLiveMapProps {
  drivers: AdminLiveMapDriver[]
  /** เส้นทางย้อนหลังของงานที่เลือก (E3) — null = ยังไม่เปิดดู */
  route?: Array<{ latitude: number; longitude: number }> | null
}

type MapStatus = 'loading' | 'ready' | 'unavailable'

export function AdminLiveMap({ drivers, route }: AdminLiveMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markerRefs = useRef<Array<{ setMap: (m: unknown) => void }>>([])
  const polylineRef = useRef<{ setMap: (m: unknown) => void } | null>(null)
  const leafletMapRef = useRef<any>(null)
  const leafletLayerRefs = useRef<any[]>([])
  const [status, setStatus] = useState<MapStatus>('loading')

  useEffect(() => {
    let cancelled = false
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
          center: { lat: KITCHEN_LAT, lng: KITCHEN_LNG },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          ...(getGoogleMapId() ? { mapId: getGoogleMapId() } : {}),
        })
        setStatus('ready')
      } catch { setStatus('unavailable') }
    })
    return () => {
      cancelled = true
      window.removeEventListener('bmb-maps-error', onMapsError)
      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove() } catch { /* ปิดแผนที่ล้ม = ข้าม */ }
        leafletMapRef.current = null
        leafletLayerRefs.current = []
      }
    }
  }, [])

  // R47: Leaflet fallback — div มีอยู่แล้ว (render ตลอด) → init ตรง ๆ ได้
  useEffect(() => {
    if (status !== 'unavailable') return
    let cancelled = false
    void loadLeaflet().then(() => {
      if (cancelled) return
      if (!mapRef.current || (window as any).L === undefined) return
      try {
        const L = (window as any).L
        // Google อาจ inject DOM ค้างใน div ก่อน fail — เคลียร์ก่อน Leaflet ยึดครอง
        if (mapRef.current) mapRef.current.innerHTML = ''
        const map = L.map(mapRef.current, {
          center: [KITCHEN_LAT, KITCHEN_LNG],
          zoom: 12,
          zoomControl: false,
          attributionControl: true,
        })
        L.tileLayer(OSM_TILE, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map)
        leafletMapRef.current = map
      } catch (e) {
        console.error('[AdminLiveMap] Leaflet init failed:', e)
      }
    }).catch((e) => {
      console.error('[AdminLiveMap] Leaflet CDN load failed:', e)
    })
    return () => { cancelled = true }
  }, [status])

  // marker sync — Google mode: รีเฟรชทุกครั้งที่ drivers เปลี่ยน (poll ของหน้าแม่)
  useEffect(() => {
    if (status !== 'ready') return
    const g = (window as { google?: { maps?: Record<string, unknown> } }).google
    const map = mapInstanceRef.current as Record<string, unknown> | null
    if (!g?.maps || !map) return
    try {
      for (const m of markerRefs.current) m.setMap(null)
      markerRefs.current = []
      const MarkerCtor = g.maps.Marker as new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void }
      for (const d of drivers) {
        if (d.latitude == null || d.longitude == null) continue
        const age = positionAgeInfo(d.lastSeenAt)
        // R46: ตำแหน่งเก่าเกินเกณฑ์ = จุดจาง + title บอกชัดว่าเก่า (ไม่หลอกว่า live)
        markerRefs.current.push(new MarkerCtor({
          position: { lat: Number(d.latitude), lng: Number(d.longitude) },
          map,
          opacity: age.stale ? 0.4 : 1,
          title: `${d.name}${d.status ? ` (${d.status})` : ''} · ${age.label}`,
          label: d.name.slice(0, 1),
        }))
      }
    } catch { /* marker sync ล้ม = คงของเดิมไว้ */ }
  }, [drivers, status])

  // route polyline (Google mode) — เส้นทางย้อนหลังที่แอดมินเลือกดู (E3)
  useEffect(() => {
    if (status !== 'ready') return
    const g = (window as { google?: { maps?: Record<string, unknown> } }).google
    const map = mapInstanceRef.current as Record<string, unknown> | null
    if (!g?.maps || !map) return
    try {
      if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null }
      if (route && route.length > 1) {
        const PolyCtor = g.maps.Polyline as new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void }
        polylineRef.current = new PolyCtor({
          path: route.map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude) })),
          map,
          strokeColor: '#2563eb',
          strokeOpacity: 0.9,
          strokeWeight: 4,
        })
      }
    } catch { /* polyline sync ล้ม = คงของเดิมไว้ */ }
  }, [route, status])

  // R47: marker/polyline sync (Leaflet mode) — จุดจริงเท่านั้น · เก่า = สีเทา/จาง
  useEffect(() => {
    const map = leafletMapRef.current
    const L = (window as any).L
    if (!map || !L) return
    try {
      for (const layer of leafletLayerRefs.current) {
        try { map.removeLayer(layer) } catch { /* ลบซ้ำ = ข้าม */ }
      }
      leafletLayerRefs.current = []
      for (const d of drivers) {
        if (d.latitude == null || d.longitude == null) continue
        const age = positionAgeInfo(d.lastSeenAt)
        const dot = L.circleMarker([Number(d.latitude), Number(d.longitude)], {
          radius: 8,
          color: age.stale ? '#9ca3af' : '#16a34a',
          fillColor: age.stale ? '#9ca3af' : '#16a34a',
          fillOpacity: age.stale ? 0.45 : 0.9,
          weight: 2,
        }).addTo(map)
        dot.bindTooltip(`${d.name}${d.status ? ` (${d.status})` : ''} · ${age.label}`)
        leafletLayerRefs.current.push(dot)
      }
      if (route && route.length > 1) {
        const poly = L.polyline(
          route.map((p) => [Number(p.latitude), Number(p.longitude)]),
          { color: '#2563eb', opacity: 0.9, weight: 4 },
        ).addTo(map)
        leafletLayerRefs.current.push(poly)
      }
    } catch { /* leaflet sync ล้ม = คงของเดิมไว้ */ }
  }, [drivers, route, status])

  const positioned = drivers.filter((d) => d.latitude != null && d.longitude != null)
  const staleCount = positioned.filter((d) => positionAgeInfo(d.lastSeenAt).stale).length

  return (
    <div>
      {/* R47: div แผนที่ render ตลอด — ref ต้องพร้อมก่อน Google/Leaflet init (บั๊กรอบ 45) */}
      <div ref={mapRef} className="w-full h-64 rounded-lg border border-brand-border" style={{ zIndex: 0 }} data-testid="admin-live-map" />
      <p className="text-xs text-brand-muted mt-1">
        🛵 ไรเดอร์บนแผนที่ {positioned.length}/{drivers.length} คน
        {staleCount > 0 ? ` · ตำแหน่งเก่า ${staleCount} คน (จุดจาง)` : ''}
        {route && route.length > 0 ? ` · เส้นทางย้อนหลัง ${route.length} จุด` : ''}
        {status === 'loading' ? ' · กำลังโหลดแผนที่…' : ''}
      </p>
      {status === 'unavailable' && (
        <p className="text-xs text-brand-muted mt-1 border border-brand-border rounded-lg p-2" data-testid="admin-map-fallback">
          🗺️ Google Maps โหลดไม่ได้{getGoogleMapsLoadError() ? ` (${getGoogleMapsLoadError()})` : ' (ยังไม่ได้ตั้งค่า key หรือโหลด SDK ไม่สำเร็จ)'} — กำลังโหลด OpenStreetMap แทน
          {' · '}ตำแหน่งล่าสุด:{' '}
          {positioned.length === 0
            ? 'ยังไม่มีไรเดอร์ส่งพิกัด (ต้องเปิดหน้า /rider บนเครื่องไรเดอร์)'
            : positioned.map((d) => `${d.name}: ${Number(d.latitude).toFixed(5)},${Number(d.longitude).toFixed(5)} · ${positionAgeInfo(d.lastSeenAt).label}`).join(' · ')}
          {route && route.length > 0 ? ` · เส้นทางย้อนหลัง ${route.length} จุด` : ''}
        </p>
      )}
    </div>
  )
}
