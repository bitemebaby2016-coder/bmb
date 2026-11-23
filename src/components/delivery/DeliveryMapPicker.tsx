// ============================================
// Bite Me Baby — Delivery map picker (CR-2 P1, Leaflet fallback 2026-11-23)
// Reuses the repository's existing Google Maps integration (src/lib/googleMaps.ts)
// — NO new dependency. Shows the customer's delivery point as a marker that can
// be dragged or set by clicking the map, plus a manual lat/lng fallback when the
// Maps SDK cannot load (missing key / blocked network). The picked point is only
// a candidate until the customer confirms it on the checkout page (CR-2 P0).
// ============================================

import { useEffect, useRef, useState, useCallback } from 'react'
import { loadGoogleMapsJS, isGoogleMapsConfigured, getGoogleMapId, getGoogleMapsLoadError, geocodeAddress } from '@/lib/googleMaps'
import { loadLeaflet, OSM_TILE, OSM_ATTRIBUTION } from '@/lib/leafletLoader'
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
type MapMode = 'google' | 'leaflet' | 'none'

export function DeliveryMapPicker({ latitude, longitude, onPick }: DeliveryMapPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markerRef = useRef<unknown>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const [status, setStatus] = useState<MapStatus>('loading')
  const [mode, setMode] = useState<MapMode>('google')
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  // R44 T10 (Owner: "ใช้พิกัดกดแล้วเงียบ") — ฟีดแบ็กใต้ช่องพิกัด:
  // ว่าง/ผิด = แดงบอกวิธีแก้ · ถูก = เขียวบอกว่ารับพิกัดแล้ว (รอขั้นถัดไปกดยืนยันด้านล่าง)
  const [manualMsg, setManualMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // R81-B5: ค้นหาที่อยู่ด้วยข้อความ — ทำงานใน FB WebView ได้ (ไม่พึ่ง GPS ที่ถูกบล็อก)
  const [addrQuery, setAddrQuery] = useState('')
  const [addrMsg, setAddrMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const leafletMapRef = useRef<any>(null)
  const leafletMarkerRef = useRef<any>(null)
  const initDoneRef = useRef(false)

  async function handleSearchAddress() {
    const q = addrQuery.trim()
    if (!q) { setAddrMsg({ ok: false, text: 'พิมพ์ที่อยู่หรือถนนที่ต้องการค้นหาก่อน' }); return }
    const g = await geocodeAddress(q)
    if (!g) { setAddrMsg({ ok: false, text: 'หาที่อยู่นี้ไม่เจอ — พิมพ์ใหม่ให้เจาะจงขึ้น หรือกรอกพิกัดเองด้านล่าง' }); return }
    onPickRef.current(g.lat, g.lng)
    setAddrMsg({ ok: true, text: `✓ เจอ: ${g.formattedAddress} — ปักหมุดให้แล้ว ตรวจสอบบนแผนที่แล้วยืนยันด้านล่างต่อ` })
  }

  // ---- Google Maps init (runs once) ----
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
        const center = { lat: latitude ?? KITCHEN_LAT, lng: longitude ?? KITCHEN_LNG }
        mapInstanceRef.current = new MapCtor(mapRef.current, {
          center,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          ...(getGoogleMapId() ? { mapId: getGoogleMapId() } : {}),
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
        initDoneRef.current = true
      } catch { setStatus('unavailable') }
    })
    return () => {
      cancelled = true
      window.removeEventListener('bmb-maps-error', onMapsError)
      // Cleanup Google map instance
      if (mapRef.current) mapRef.current.innerHTML = ''
    }
  }, [])

  // ---- Leaflet fallback init (runs once when status becomes unavailable) ----
  useEffect(() => {
    if (status !== 'unavailable' || mode === 'leaflet') return
    let cancelled = false
    void loadLeaflet().then(() => {
      if (cancelled) return
      if (!mapRef.current || (window as any).L === undefined) return
      try {
        const L = (window as any).L
        // Clear any Google-injected DOM before Leaflet takes over
        if (mapRef.current) mapRef.current.innerHTML = ''
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '',
          iconUrl: '',
          shadowUrl: '',
        })
        const map = L.map(mapRef.current, {
          center: [latitude ?? KITCHEN_LAT, longitude ?? KITCHEN_LNG],
          zoom: 16,
          zoomControl: false,
          attributionControl: true,
        })
        L.tileLayer(OSM_TILE, {
          maxZoom: 19,
          attribution: OSM_ATTRIBUTION,
        }).addTo(map)
        leafletMapRef.current = map
        setMode('leaflet')
        initDoneRef.current = true
        // Initial marker
        if (latitude != null && longitude != null) {
          leafletMarkerRef.current = L.marker([latitude, longitude], {
            draggable: true,
            icon: L.divIcon({
              className: 'delivery-map-emoji-marker',
              html: '<div style="font-size: 28px; line-height: 1;">📍</div>',
              iconSize: [28, 28],
              iconAnchor: [14, 28],
            }),
          }).addTo(map)
          leafletMarkerRef.current.on('dragend', (e: any) => {
            const pos = e.target.getLatLng()
            onPickRef.current(pos.lat, pos.lng)
          })
        }
        map.on('click', (e: any) => {
          onPickRef.current(e.latlng.lat, e.latlng.lng)
        })
      } catch (e) {
        console.error('[DeliveryMapPicker] Leaflet init failed:', e)
      }
    }).catch((e) => {
      if (cancelled) return
      console.error('[DeliveryMapPicker] Leaflet CDN load failed:', e)
    })
    return () => {
      cancelled = true
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  }, [status])

  // ---- Imperative marker updates for Leaflet (on candidate lat/lng change) ----
  const updateLeafletMarker = useCallback(() => {
    if (mode !== 'leaflet' || !leafletMapRef.current) return
    const map = leafletMapRef.current
    const L = (window as any).L
    if (latitude != null && longitude != null) {
      const pos = [latitude, longitude]
      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng(pos)
      } else {
        leafletMarkerRef.current = L.marker(pos, {
          draggable: true,
          icon: L.divIcon({
            className: 'delivery-map-emoji-marker',
            html: '<div style="font-size: 28px; line-height: 1;">📍</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 28],
          }),
        }).addTo(map)
        leafletMarkerRef.current.on('dragend', (e: any) => {
          const p = e.target.getLatLng()
          onPickRef.current(p.lat, p.lng)
        })
      }
      map.setView(pos, map.getZoom(), { animate: true })
    } else if (leafletMarkerRef.current) {
      leafletMarkerRef.current.remove()
      leafletMarkerRef.current = null
    }
  }, [mode, latitude, longitude])

  useEffect(() => {
    if (mode !== 'leaflet') return
    updateLeafletMarker()
  }, [updateLeafletMarker])

  // ---- Google Maps marker sync (imperative updates) ----
  useEffect(() => {
    if (status !== 'ready') return
    const g = (window as { google?: { maps?: Record<string, unknown> } }).google
    const map = mapInstanceRef.current as { setCenter: (c: { lat: number; lng: number }) => void } | null
    if (!g?.maps || !map) return
    if (latitude == null || longitude == null) return
    try {
      type GMarker = { addListener: (e: string, cb: () => void) => void; getPosition?: () => { lat: () => number; lng: () => number }; setPosition: (p: { lat: number; lng: number }) => void }
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
      {/* R81-B5 (Owner C9: GPS ใน FB = platform block): ค้นหาที่อยู่ด้วยข้อความ = ใช้ได้ใน FB WebView */}
      <div className="flex items-center gap-2 mb-2" data-testid="map-address-search">
        <input
          type="text"
          value={addrQuery}
          onChange={(e) => setAddrQuery(e.target.value)}
          placeholder="พิมพ์ค้นหาที่อยู่ เช่น ถนนสุขุมวิท ซอย 21"
          className="input input-sm flex-1"
          aria-label="ค้นหาที่อยู่จัดส่ง"
          data-testid="map-address-input"
        />
        <button
          type="button"
          className="btn btn-outline btn-sm"
          data-testid="map-address-go"
          onClick={() => { void handleSearchAddress() }}
        >
          ค้นหา
        </button>
      </div>
      {addrMsg && (
        <p
          className={`text-xs font-medium mb-2 ${addrMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}
          role={addrMsg.ok ? 'status' : 'alert'}
          data-testid="map-address-msg"
        >
          {addrMsg.text}
        </p>
      )}
      {/* Map canvas - render when not unavailable OR when Leaflet fallback is active */}
      {(status !== 'unavailable' || mode === 'leaflet') && (
        <div
          ref={mapRef}
          data-testid="delivery-map-canvas"
          className="w-full h-64 rounded-xl border-2 border-brand-border"
        />
      )}
      {status === 'loading' && (
        <p className="text-xs text-brand-muted mt-1" data-testid="map-status">⏳ กำลังโหลดแผนที่…</p>
      )}
      {status === 'unavailable' && mode === 'google' && (
        <div className="mt-2 p-3 rounded-lg border border-amber-400" data-testid="map-unavailable">
          <p className="text-xs font-medium mb-2" style={{ color: '#b45309' }}>
            ⚠️ แผนที่ยังไม่พร้อมใช้งาน (โหลด Google Maps ไม่สำเร็จ{getGoogleMapsLoadError() ? `: ${getGoogleMapsLoadError()}` : ''}) — กำลังโหลด OpenStreetMap แทน…
          </p>
        </div>
      )}
      {/* Manual pin fallback - only show when Google is truly unavailable (no Leaflet) and no candidate exists */}
      {status === 'unavailable' && mode === 'google' && (
        <div className="mt-2 p-3 rounded-lg border border-amber-400" data-testid="map-unavailable">
          <p className="text-xs font-medium mb-2" style={{ color: '#b45309' }}>
            ⚠️ แผนที่ยังไม่พร้อมใช้งาน (โหลด Google Maps ไม่สำเร็จ{getGoogleMapsLoadError() ? `: ${getGoogleMapsLoadError()}` : ''}) — กรุณาระบุพิกัดเองด้านล่าง หรือใช้ปุ่ม GPS
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
              data-testid="manual-pin-use"
              onClick={() => {
                // R44 T10: ห้ามเงียบ — parse ไม่ผ่าน (ว่าง/ไม่ใช่ตัวเลข/เกินพิกัด) ต้องบอกทันที
                const p = parseManualPin(manualLat, manualLng)
                if (!p) {
                  setManualMsg({ ok: false, text: 'พิกัดยังไม่ถูกต้อง — กรอกตัวเลข เช่น ละติจูด 12.6096 · ลองจิจูด 102.1039 แล้วกดใหม่' })
                  return
                }
                onPick(p.lat, p.lng)
                setManualMsg({ ok: true, text: `✓ ใช้พิกัด ${p.lat}, ${p.lng} แล้ว — กด "✅ ยืนยันตำแหน่งจัดส่งนี้" ด้านล่างต่อ` })
              }}
            >
              ใช้พิกัดนี้
            </button>
          </div>
          {manualMsg && (
            <p
              className={`mt-2 text-xs font-medium ${manualMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}
              role={manualMsg.ok ? 'status' : 'alert'}
              data-testid="manual-pin-msg"
            >
              {manualMsg.text}
            </p>
          )}
        </div>
      )}
      {/* Hide manual pin box when we have a candidate (map or manual) and Leaflet is active or Google is ready */}
      {(status === 'ready' || mode === 'leaflet') && (latitude != null || longitude != null) && (
        <p className="text-xs text-emerald-600 mt-1">
          ✓ ตำแหน่งจัดส่งถูกกำหนดแล้ว {mode === 'leaflet' ? '(OpenStreetMap)' : '(Google Maps)'} — แตะแผนที่/ลากหมุดเพื่อแก้ไข แล้วกดยืนยันด้านล่าง
        </p>
      )}
      {status === 'ready' && (
        <p className="text-xs text-brand-muted mt-1">
          📌 แตะแผนที่หรือเลื่อนหมุดเพื่อระบุตำแหน่งจัดส่ง — แล้วกด “ยืนยันตำแหน่งนี้” ด้านล่าง
        </p>
      )}
    </div>
  )
}