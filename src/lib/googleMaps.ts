// ============================================
// Bite Me Baby — Google Maps Platform Integration
// Production-ready wrappers for:
//   - Google Routes API   (driving distance/duration + polyline)
//   - Geocoding API       (address ↔ lat/lng)
//   - Places Autocomplete (address search)
//   - Maps JavaScript SDK (interactive maps)
// ============================================

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
const ROUTES_KEY = import.meta.env.VITE_GOOGLE_ROUTES_API_KEY ?? MAPS_KEY
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? ''

/** Returns true when at least one Google key is set. */
export function isGoogleMapsConfigured(): boolean {
  return MAPS_KEY.length >= 10 || ROUTES_KEY.length >= 10
}

// ---------------------------------------------------------------------------
// Google Routes API  — driving distance & duration
// https://developers.google.com/maps/documentation/routes-overview
// ---------------------------------------------------------------------------

export interface GoogleRouteResult {
  origin: { latitude: number; longitude: number }
  destination: { latitude: number; longitude: number }
  distanceKm: number
  durationSec: number
  polyline?: string           // decoded polyline of the route
  providerId?: string         // which route was chosen
  travelMode?: 'DRIVE' | 'WALK' | 'BIKE' | 'TRANSIT'
}

export interface GoogleRoutesRequest {
  origin: { latitude: number; longitude: number }
  destination: { latitude: number; longitude: number }
  travelMode?: 'DRIVE' | 'WALK' | 'BIKE' | 'TRANSIT'
  routingPreference?: 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL'
  languageCode?: string
  regionCode?: string
}

/** Compute a route via Google Cloud Routes API (v1). */
export async function computeGoogleRoute(
  params: GoogleRoutesRequest,
  apiKey: string = ROUTES_KEY || MAPS_KEY,
): Promise<GoogleRouteResult | null> {
  if (!apiKey || apiKey.length < 10) {
    console.warn('[GoogleMaps] No API key configured, returning null')
    return null
  }

  const url = `https://routes.googleapis.com/directions/v2/calculations/driving`
  const body = {
    originLocation: {
      latitude: params.origin.latitude,
      longitude: params.origin.longitude,
    },
    destinationLocation: {
      latitude: params.destination.latitude,
      longitude: params.destination.longitude,
    },
    travelingSalespersonOptions: {},
    computationLanguage: 'BILINGUAL',
    fields: ['distanceMeters', 'duration'],
    languageCode: params.languageCode ?? 'th',
    regionCode: params.regionCode ?? 'TH',
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'distanceMeters,duration,routeLatLngPairs,providers,travelModes',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[GoogleMaps] Routes API error:', res.status, errText)
      return null
    }

    const data = await res.json()
    const routes = data.routes?.[0]
    if (!routes) return null

    const distanceM = routes.distanceMeters ?? 0
    const duration = routes.duration ?? 0

    let polyline: string | undefined
    if (routes.routeLatLngPairs?.polylineEncoded) {
      polyline = routes.routeLatLngPairs.polylineEncoded
    }

    return {
      origin: params.origin,
      destination: params.destination,
      distanceKm: Math.round(distanceM / 100) / 10,
      durationSec: Number(duration) || 0,
      polyline,
      providerId: routes.providers?.[0]?.providerId,
      travelMode: 'DRIVE',
    }
  } catch (e) {
    console.error('[GoogleMaps] computeGoogleRoute failed:', e)
    return null
  }
}

export interface GeocodeResult {
  lat: number
  lng: number
  formattedAddress: string
  placeId?: string
}

export async function reverseGeocode(lat: number, lng: number, apiKey: string = MAPS_KEY): Promise<GeocodeResult | null> {
  if (!apiKey || apiKey.length < 10) return null
  const url = 'https://maps.googleapis.com/maps/api/geocode/json'
  try {
    const res = await fetch(`${url}?latlng=${lat},${lng}&key=${apiKey}&language=th`)
    if (!res.ok) return null
    const json = await res.json()
    if (json.status !== 'OK' || !json.results?.[0]) return null
    const r = json.results[0]
    return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, formattedAddress: r.formatted_address, placeId: r.place_id }
  } catch { return null }
}

export async function geocodeAddress(address: string, apiKey: string = MAPS_KEY): Promise<GeocodeResult | null> {
  if (!apiKey || apiKey.length < 10) return null
  const url = 'https://maps.googleapis.com/maps/api/geocode/json'
  try {
    const res = await fetch(`${url}?address=${encodeURIComponent(address)}&key=${apiKey}&language=th&components=country:th`)
    if (!res.ok) return null
    const json = await res.json()
    if (json.status !== 'OK' || !json.results?.[0]) return null
    const r = json.results[0]
    return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, formattedAddress: r.formatted_address, placeId: r.place_id }
  } catch { return null }
}

export interface PlacePrediction {
  description: string
  placeId: string
}

export async function getPlaceAutocomplete(input: string, apiKey: string = MAPS_KEY, location?: { lat: number; lng: number }): Promise<PlacePrediction[]> {
  if (!apiKey || apiKey.length < 10 || !input || input.length < 2) return []
  const url = 'https://maps.googleapis.com/maps/api/place/queryautocomplete/json'
  let qs = `input=${encodeURIComponent(input)}&key=${apiKey}&language=th`
  if (location) qs += `&location=${location.lat},${location.lng}&radius=50000`
  try {
    const res = await fetch(`${url}?${qs}`)
    if (!res.ok) return []
    const json = await res.json()
    if (json.status !== 'OK' || !json.predictions) return []
    return json.predictions.map((p: any) => ({ description: p.description, placeId: p.place_id }))
  } catch { return [] }
}

export async function getPlaceDetails(placeId: string, apiKey: string = MAPS_KEY): Promise<{ lat: number; lng: number; name: string; formattedAddress: string } | null> {
  if (!apiKey || apiKey.length < 10) return null
  const url = 'https://maps.googleapis.com/maps/api/place/details/json'
  try {
    const res = await fetch(`${url}?place_id=${placeId}&key=${apiKey}&language=th`)
    if (!res.ok) return null
    const json = await res.json()
    if (json.status !== 'OK' || !json.result) return null
    const r = json.result
    return { lat: r.geometry?.location?.lat ?? 0, lng: r.geometry?.location?.lng ?? 0, name: r.name ?? r.formatted_address ?? '', formattedAddress: r.formatted_address ?? '' }
  } catch { return null }
}

let googleMapsLoaded = false
let googleMapsPromise: Promise<void> | null = null

export function loadGoogleMapsJS(): Promise<void> {
  if (googleMapsLoaded) return Promise.resolve()
  if (googleMapsPromise) return googleMapsPromise
  if (!MAPS_KEY || MAPS_KEY.length < 10 || !MAP_ID) {
    console.warn('[GoogleMaps] Missing API key or Map ID')
    googleMapsLoaded = true
    return Promise.resolve()
  }
  googleMapsPromise = new Promise<void>((resolve) => {
    if ((window as any).google?.maps) { googleMapsLoaded = true; resolve(); return }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&loading=async&libraries=maps,places`
    s.async = true; s.defer = true
    s.onload = () => { googleMapsLoaded = true; resolve() }
    s.onerror = () => { console.error('[GoogleMaps] Failed to load SDK'); googleMapsLoaded = true; resolve() }
    document.head.appendChild(s)
  })
  return googleMapsPromise
}

export function isGoogleMapsJSReady(): boolean { return googleMapsLoaded && !!(window as any).google?.maps }

export function haversineDistanceSimple(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}