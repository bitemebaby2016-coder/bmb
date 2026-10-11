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
  /** URL รูปสถานที่จัดส่ง (อัปโหลดแล้ว) — บันทึกลง customers ให้ไรเดอร์เห็น */
  deliveryPhotoUrl?: string
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
    options?: { timeout?: number; maximumAge?: number; enableHighAccuracy?: boolean },
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

/**
 * CR-2 P0 (Owner 2026-10-10): TRUSTED GPS ONLY for delivery coordinates.
 * Browser Geolocation API — NO IP-geo, NO saved, NO kitchen fallback.
 * Resolves `null` when permission is denied / unavailable / timed out so the
 * caller can send the customer to the map pin flow instead of silently using
 * an approximate (wrong) point. Used by the checkout delivery flow.
 */
export function getTrustedGpsLocation(timeoutMs = 10_000): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    try {
      const geo = (navigator as Navigator & { geolocation?: BrowserGeolocation }).geolocation
      if (!geo || typeof geo.getCurrentPosition !== 'function') { resolve(null); return }
      let settled = false
      const done = (value: { latitude: number; longitude: number } | null) => {
        if (!settled) { settled = true; resolve(value) }
      }
      const timer = setTimeout(() => done(null), timeoutMs)
      geo.getCurrentPosition!(
        (pos) => {
          clearTimeout(timer)
          // support both the minimal shape and the DOM GeolocationPosition shape
          const raw = pos as unknown as {
            latitude?: number; longitude?: number
            coords?: { latitude: number; longitude: number }
          }
          const lat = typeof raw.latitude === 'number' ? raw.latitude : raw.coords?.latitude
          const lng = typeof raw.longitude === 'number' ? raw.longitude : raw.coords?.longitude
          if (
            typeof lat === 'number' && typeof lng === 'number' &&
            Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
            !(lat === 0 && lng === 0)
          ) {
            done({ latitude: lat, longitude: lng })
          } else done(null)
        },
        () => { clearTimeout(timer); done(null) },
        { timeout: timeoutMs, maximumAge: 30_000, enableHighAccuracy: true },
      )
    } catch { resolve(null) }
  })
}

/** Call the Edge Function → real Supabase Auth session (connected to existing system). */

/**
 * CR-3: build the coordinate payload for quick login — REAL coordinates only.
 * - caller-provided coordinates are sent ONLY with explicit source metadata;
 * - the browser-GPS result is sent ONLY when `gps.source === 'gps'`;
 * - kitchen / ip / saved fallbacks are sent as `null` so the Edge Function
 *   persists NO default coordinates instead of writing a fake point;
 *   login itself still works without coordinates.
 * NOTE: `source` is client metadata (a claim), NOT proof against spoofing —
 * the Edge Function applies its own policy independently.
 */
export function buildQuickLoginCoords(
  input: { latitude?: number; longitude?: number; source?: string },
  gps: { latitude: number; longitude: number; source: string },
): { latitude: number | null; longitude: number | null; source: string } {
  const inputValid =
    typeof input.latitude === 'number' && typeof input.longitude === 'number' &&
    Number.isFinite(input.latitude) && Number.isFinite(input.longitude) &&
    !(input.latitude === 0 && input.longitude === 0)
  if (inputValid && input.source) {
    return { latitude: input.latitude as number, longitude: input.longitude as number, source: input.source }
  }
  if (gps.source === 'gps') {
    return { latitude: gps.latitude, longitude: gps.longitude, source: 'gps' }
  }
  // no trustworthy point in this session → no coordinates in the payload
  return { latitude: null, longitude: null, source: gps.source }
}

export async function quickLoginByPhone(input: QuickLoginInput): Promise<QuickLoginResult> {
  try {
    const gps = await getGpsLocation()
    // CR-3: stop shipping fallback (kitchen/ip) points as customer coordinates
    const coords = buildQuickLoginCoords(input, gps)
    const { data, error } = await supabase.functions.invoke<QuickLoginResult>('phone-auto-login', {
      body: {
        name: input.name,
        phone: input.phone,
        latitude: coords.latitude,
        longitude: coords.longitude,
        source: coords.source,
        address_detail: input.addressDetail ?? '',
        delivery_photo_url: input.deliveryPhotoUrl ?? '',
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

/**
 * อัปโหลดรูปสถานที่จัดส่ง (หน้าบ้าน/เลขที่บ้าน ฯลฯ) เข้า storage bmb-images
 * ต้อง login แล้ว (policy authenticated INSERT) · ย่อรูปก่อน ~1280px เพื่อลดขนาดไฟล์
 */
export async function uploadDeliveryPhoto(file: File): Promise<{ ok: boolean; url?: string; path?: string; error?: string }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) return { ok: false, error: 'ERR_NOT_AUTHENTICATED' }
    // ย่อรูปด้วย canvas (ไม่เปลี่ยนไฟล์ต้นฉบับ)
    const bmp = await createImageBitmap(file)
    const maxSide = 1280
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close?.()
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82))
    if (!blob) return { ok: false, error: 'ERR_IMAGE_PROCESS' }
    const path = `delivery-photos/${uid}/${Date.now()}.jpg`
    const { error } = await supabase.storage.from('bmb-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) return { ok: false, error: error.message }
    const { data: pub } = supabase.storage.from('bmb-images').getPublicUrl(path)
    return { ok: true, url: pub?.publicUrl || '', path }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'ERR_UPLOAD' }
  }
}

/**
 * บันทึกโปรไฟล์ลูกค้าหลัง login (ชื่อ/เบอร์/ที่อยู่/รูปสถานที่) — "ให้ข้อมูลครั้งเดียวแล้วระบบจำตลอด"
 * เรียก EF phone-auto-login mode=update_profile (ตรวจ JWT server-side)
 */
export async function saveDeliveryProfile(input: {
  name?: string
  phone?: string
  addressDetail?: string
  latitude?: number
  longitude?: number
  /** CR-3: coordinate provenance (gps|manual) — EF writes default_* ONLY with a trusted source. */
  source?: string
  deliveryPhotoUrl?: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('phone-auto-login', {
      body: {
        action: 'update_profile',
        name: input.name,
        phone: input.phone,
        address_detail: input.addressDetail ?? '',
        latitude: input.latitude,
        longitude: input.longitude,
        source: input.source,
        delivery_photo_url: input.deliveryPhotoUrl ?? '',
      },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: !!data?.ok, error: data?.error }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'ERR_NETWORK' }
  }
}