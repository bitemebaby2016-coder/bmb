// ============================================
// Bite Me Baby — Delivery map picker (CR-2 P1)
// Reuses the repository's existing Google Maps integration (src/lib/googleMaps.ts)
// — NO new dependency. Shows the customer's delivery point as a marker that can
// be dragged or set by clicking the map, plus a manual lat/lng fallback when the
// Maps SDK cannot load (missing key / blocked network). The picked point is only
// a candidate until the customer confirms it on the checkout page (CR-2 P0).
// ============================================

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsJS, isGoogleMapsConfigured } from '@/lib/googleMaps'
import { KITCHEN_LAT, KITCHEN_LNG } from '@/store/locationStore'

export interface DeliveryMapPickerProps {
  /** Current candidate delivery point (null = none yet). */
  latitude: number | null
  longitude: number | null
  /** Fired on map click / marker drag / manual pin — candidate only, NOT confirmed. */
  onPick: (lat: number, lng: number) => void
}

/** Pure: parse manual lat/lng inputs → valid WGS84 pair, or null. Exported for tests. */
export function parseManualPin(latText: string, lngText: string): { lat: number; lng: number } | null {
  const lat = Number(String(latText).trim())
  const lng = Number(String(lngText).trim())
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

type MapStatus = 'loading' | 'ready' | 'unavailable'

export function DeliveryMapPicker({ latitude, longitude, onPick }: DeliveryMapPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markerRef = useRef<unknown>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const [status, setStatus] = useState<MapStatus>('loading')
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')

  // Load SDK once + create the map (kitchen = MAP REFERENCE center only).
  useEffect(() => {
    let cancelled = false
    if (!isGoogleMapsConfigured()) { setStatus('unavailable'); return }
    void loadGoogleMapsJS().then(() => {
      if (cancelled) return
      const g = (window as { google?: { maps?: Record<string, unknown> } }).google
      if (!mapRef.current || !g?.maps) { setStatus('unavailable'); return }
      try {
        const MapCtor = g.maps.Map as new (el: HTMLElement, opts: Record<string, unknown>) => unknown
        const center = { lat: latitude ?? KITCHEN_LAT, lng: longitude ?? KITCHEN_LNG }
        mapInstanceRef.current = new MapCtor(mapRef.current, {
          center,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        const map = mapInstanceRef.current as {
          addListener: (evt: string, cb: (e: { latLng?: { lat: () => number; lng: () => number } }) => void) => void
          setCenter: (c: { lat: number; lng: number }) => void
        }
        // Click anywhere → candidate pin
        map.addListener('click', (e: { latLng?: { lat: () => number; lng: () => number } }) => {
          if (e?.latLng) onPickRef.current(e.latLng.lat(), e.latLng.lng())
        })
        setStatus('ready')
      } catch { setStatus('unavailable') }
    })
    return () => { cancelled = true }
  }, [])


  // Keep marker + center in sync with the candidate point.
  useEffect(() => {
    if (status !== 'ready') return
    const g = (window as { google?: { maps?: Record<string, unknown> } }).google
    const map = mapInstanceRef.current as { setCenter: (c: { lat: number; lng: number }) => void } | null
    if (!g?.maps || !map) return
    if (latitude == null || longitude == null) return
    try {
      type GMarker = { addListener: (e: string, cb: () => void) => void; getPosition?: () => { lat: () => number; lng: () => number } }
      const MarkerCtor = g.maps.Marker as new (opts: Record<string, unknown>) => GMarker
      const pos = { lat: latitude, lng: longitude }
      if (!markerRef.current) {
        markerRef.current = new MarkerCtor({ position: pos, map, draggable: true, title: 'ตำแหน่งจัดส่ง' })
        const marker = markerRef.current as { addListener: (e: string, cb: () => void) => void; getPosition?: () => { lat: () => number; lng: () => number } }
        marker.addListener('dragend', () => {
          const p = marker.getPosition?.()
          if (p) onPickRef.current(p.lat(), p.lng())
        })
      } else {
        const existing = markerRef.current as { setPosition: (p: { lat: number; lng: number }) => void }
        existing.setPosition(pos)
      }
      map.setCenter(pos)
    } catch { /* marker failed — map still usable via click */ }
  }, [status, latitude, longitude])

  return (
    <div className="mb-3" data-testid="delivery-map-picker">
      <div
        ref={mapRef}
        data-testid="delivery-map-canvas"
        className="w-full h-64 rounded-xl border-2 border-brand-border"
      />
      {status === 'loading' && (
        <p className="text-xs text-brand-muted mt-1" data-testid="map-status">⏳ กำลังโหลดแผนที่…</p>
      )}
      {status === 'unavailable' && (
        <div className="mt-2 p-3 rounded-lg border border-amber-400" data-testid="map-unavailable">
          <p className="text-xs font-medium mb-2" style={{ color: '#b45309' }}>
            ⚠️ แผนที่ยังไม่พร้อมใช้งาน (โหลด Google Maps ไม่สำเร็จ) — กรุณาระบุพิกัดเองด้านล่าง หรือใช้ปุ่ม GPS
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number" step="any" inputMode="decimal" placeholder="ละติจูด เช่น 12.6096"
              value={manualLat} onChange={(e) => setManualLat(e.target.value)}
              className="input input-sm w-40" aria-label="ละติจูด"
            />
            <input
              type="number" step="any" inputMode="decimal" placeholder="ลองจิจูด เช่น 102.1039"
              value={manualLng} onChange={(e) => setManualLng(e.target.value)}
              className="input input-sm w-40" aria-label="ลองจิจูด"
            />
            <button
              type="button" className="btn btn-outline btn-sm"
              onClick={() => {
                const p = parseManualPin(manualLat, manualLng)
                if (p) onPick(p.lat, p.lng)
              }}
            >
              ใช้พิกัดนี้
            </button>
          </div>
        </div>
      )}
      {status === 'ready' && (
        <p className="text-xs text-brand-muted mt-1">
          📌 แตะแผนที่หรือเลื่อนหมุดเพื่อระบุตำแหน่งจัดส่ง — แล้วกด “ยืนยันตำแหน่งนี้” ด้านล่าง
        </p>
      )}
    </div>
  )
}
