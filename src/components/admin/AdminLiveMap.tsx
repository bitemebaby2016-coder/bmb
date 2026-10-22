// ============================================
// Bite Me Baby — AdminLiveMap (E3 · 2026-10-22)
// ============================================
// แผนที่กลางของ Dispatch Center: แสดงตำแหน่งไรเดอร์ "วิ่งจริง" ทุกคน
// (drivers.current_* จาก GPS heartbeat 136) + เส้นทางย้อนหลังของงาน
// (driver_location_history) เป็น polyline — ข้อมูลทั้งหมดมาจาก server
// ไม่มีจุดจำลอง · Google Maps SDK โหลดไม่ได้ = แสดงข้อความ+พิกัดแทน (ไม่หลอกว่ามีแผนที่)
import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsJS, isGoogleMapsConfigured, getGoogleMapId, getGoogleMapsLoadError } from '@/lib/googleMaps'
import { KITCHEN_LAT, KITCHEN_LNG } from '@/config/kitchenLocation'

export interface AdminLiveMapDriver {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  status?: string
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
    return () => { cancelled = true; window.removeEventListener('bmb-maps-error', onMapsError) }
  }, [])

  // marker sync — รีเฟรชทุกครั้งที่ drivers เปลี่ยน (poll ของหน้าแม่)
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
        markerRefs.current.push(new MarkerCtor({
          position: { lat: Number(d.latitude), lng: Number(d.longitude) },
          map,
          title: `${d.name}${d.status ? ` (${d.status})` : ''}`,
          label: d.name.slice(0, 1),
        }))
      }
    } catch { /* marker sync ล้ม = คงของเดิมไว้ */ }
  }, [drivers, status])

  // route polyline — เส้นทางย้อนหลังที่แอดมินเลือกดู (E3)
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

  const positioned = drivers.filter((d) => d.latitude != null && d.longitude != null)

  return (
    <div>
      {status === 'unavailable' ? (
        <div className="text-xs text-brand-muted border border-brand-border rounded-lg p-3" data-testid="admin-map-fallback">
          🗺️ แผนที่ไม่พร้อมใช้งานในเบราว์เซอร์นี้ — ตำแหน่งไรเดอร์ล่าสุด:{' '}
          {positioned.length === 0
            ? 'ยังไม่มีไรเดอร์ส่งพิกัด (ต้องเปิดหน้า /rider บนเครื่องไรเดอร์)'
            : positioned.map((d) => `${d.name}: ${Number(d.latitude).toFixed(5)},${Number(d.longitude).toFixed(5)}`).join(' · ')}
          {route && route.length > 0 ? ` · เส้นทางย้อนหลัง ${route.length} จุด` : ''}
        </div>
      ) : (
        <>
          <div ref={mapRef} className="w-full h-64 rounded-lg border border-brand-border" data-testid="admin-live-map" />
          <p className="text-xs text-brand-muted mt-1">
            🛵 ไรเดอร์บนแผนที่ {positioned.length}/{drivers.length} คน
            {route && route.length > 0 ? ` · เส้นทางย้อนหลัง ${route.length} จุด` : ''}
            {status === 'loading' ? ' · กำลังโหลดแผนที่…' : ''}
          </p>
        </>
      )}
    </div>
  )
}