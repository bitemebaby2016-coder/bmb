// ============================================
// Bite Me Baby — Location login helper ("quick login": name + phone + location)
// Frontend side of the phone-auto-login Edge Function. Reads the customer GPS
// (with IP-geolocation + stored + kitchen fallbacks), then lets the Edge Function
// create/refresh the Supabase Auth account and return real session tokens.
// ============================================

import { supabase } from '@/lib/supabase'
import { useLocationStore, KITCHEN_LAT, KITCHEN_LNG } from '@/store/locationStore'

export interface QuickLoginInput {
  name: string
  phone: string
  /** GPS coordinates; empty → fall back to stored / kitchen location. */
  latitude?: number
  longitude?: number
  addressDetail?: string
}

export interface QuickLoginResult {
  ok: boolean
  session?: { access_token: string; refresh_token: string; expires_at?: number }
  user?: {
    id: string
    email?: string | null
    phone?: string | null
    user_metadata?: Record<string, any>
  }
  location?: { latitude: number; longitude: number; addressDetail: string }
  error?: string
}

/** Minimal typing for the experimental browser Geolocation API (Chrome, HTTPS). */
interface BrowserGeolocationPosition {
  latitude: number
  longitude: number
}
interface BrowserGeolocation {
  getCurrentPosition?: (
    success: (pos: BrowserGeolocationPosition) => void,
    error?: () => void,
    options?: { timeout?: number },
  ) => void
}

/**
 * Get the customer's real position:
 *   1. Browser Geolocation API (user permission, HTTPS)
 *   2. Free IP geolocation (ipapi.co — no key needed)
 *   3. Stored location from a previous session
 *   4. Kitchen default (delivery not priced until the customer sets a real spot)
 */
export async function getGpsLocation(): Promise<{ latitude: number; longitude: number; source: 'gps' | 'ip' | 'saved' | 'kitchen' }> {
  // 1) Browser geolocation API
  try {
    const geo = (navigator as Navigator & { geolocation?: BrowserGeolocation }).geolocation
    if (geo && typeof geo.getCurrentPosition === 'function') {
      const pos = await new Promise<BrowserGeolocationPosition | null>((resolve) => {
        geo.getCurrentPosition!(resolve, () => resolve(null))
      })
      if (pos && typeof pos.latitude === 'number' && typeof pos.longitude === 'number' && Math.abs(pos.latitude) < 90 && Math.abs(pos.longitude) < 180) {
        return { latitude: pos.latitude, longitude: pos.longitude, source: 'gps' }
      }
    }
  } catch { /* fall through */ }

  // 2) IP geolocation (approximate — fine for zone-based delivery pricing)
  try {
    const t0 = Date.now()
    const res = await fetch('https://ipapi.co/json/', { headers: { Accept: 'application/json' } })
    if (res.ok && Date.now() - t0 < 6000) {
      const ip = await res.json()
      const lat = Number(ip?.latitude)
      const lon = Number(ip?.longitude)
      if (Math.abs(lat) < 90 && Math.abs(lon) < 180 && lat !== 0 && lon !== 0) {
        return { latitude: lat, longitude: lon, source: 'ip' }
      }
    }
  } catch { /* fall through */ }

  // 3) Stored location
  const stored = useLocationStore.getState().location
  if (stored?.latitude && stored?.longitude && (stored.source === 'gps' || stored.source === 'manual' || stored.source === 'saved' || stored.source === 'ip')) {
    return { latitude: stored.latitude, longitude: stored.longitude, source: 'saved' }
  }

  // 4) Kitchen default
  return { latitude: KITCHEN_LAT, longitude: KITCHEN_LNG, source: 'kitchen' }
}

/** Call the Edge Function → real Supabase Auth session (connected to existing system). */
export async function quickLoginByPhone(input: QuickLoginInput): Promise<QuickLoginResult> {
  try {
    const gps = await getGpsLocation()
    const { data, error } = await supabase.functions.invoke<QuickLoginResult>('phone-auto-login', {
      body: {
        name: input.name,
        phone: input.phone,
        latitude: input.latitude ?? gps.latitude,
        longitude: input.longitude ?? gps.longitude,
        address_detail: input.addressDetail ?? '',
      },
    })

    if (error) {
      // Function-level error (e.g., not deployed / not configured)
      try {
        const errBody = JSON.parse(String(error.message || '{}'))
        return { ok: false, error: errBody?.error ?? error.message }
      } catch {
        return { ok: false, error: error.message }
      }
    }
    if (!data?.ok || !data.session?.access_token) {
      return { ok: false, error: data?.error ?? 'ERR_QUICK_LOGIN' }
    }

    // Persist the location used for this login locally (customer address for delivery)
    const loc = data.location ?? { latitude: gps.latitude, longitude: gps.longitude, addressDetail: '' }
    useLocationStore.getState().setLocation({
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
      addressDetail: loc.addressDetail || '',
      name: input.name,
      phone: input.phone,
      source: gps.source,
    })

    const result: QuickLoginResult = { ok: true, session: data.session, user: data.user, location: loc }
    // token.user may be absent on some GoTrue versions → refetch current user
    if (!result.user?.id) {
      try {
        const { data: { user } } = await supabase.auth.getUser(String(data.session.access_token))
        if (user) result.user = user
      } catch { /* keep as-is */ }
    }
    return result
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'ERR_NETWORK' }
  }
}