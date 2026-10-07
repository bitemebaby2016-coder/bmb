// ============================================
// Bite Me Baby — Edge Function: phone-auto-login
// New "quick login" — the customer signs in with ONLY:
//   name + phone + location (GPS latitude/longitude + optional address detail)
// This connects to the EXISTING system: creates/links a Supabase Auth account
// (phone-keyed email <phone>@phone.bmb.local, same convention as authStore.loginByPhone),
// persists the customer location (migration 015 columns) so checkout can calculate
// distance / plan routes / price delivery fees against the real dropoff point.
//
// Security notes:
//   - verify_jwt = false (callable from the login page without a session).
//   - A phone number is the single factor here (owner UX directive: name+phone+location
//     only). For production hardening, this function should be replaced by phone OTP
//     (SMS) — see code comment (TODO OTP).
//   - The service-role key lives ONLY in the Edge Function env (never client-side).
//
// Env (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_ANON_KEY,
//   bmb_backend_production_supabase_service_role_key (2026-09-19 rotation;
//   legacy SUPABASE_SERVICE_ROLE_KEY kept as fallback)
// ============================================

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

function normalizePhone(raw: string): string {
  let p = String(raw ?? '').replace(/[^\d+]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('+')) return p
  const digits = p.replace(/\D/g, '')
  // Thai local format 0XXXXXXXXX (10 digits) → E.164 +66XXXXXXXXX.
  // GoTrue's admin API REQUIRES E.164 (finding 2026-10-08: quick login failed
  // with "Invalid phone number format (E.164 required)" for 08xxxxxxxx).
  if (digits.length === 10 && digits.startsWith('0')) return '+66' + digits.slice(1)
  if (digits.length === 9 && /^[1-9]\d{8}$/.test(digits)) return '+66' + digits
  return digits
}

function randomPassword(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  let s = ''
  for (const v of b) s += String.fromCharCode(33 + (v % 90)) // printable ASCII subset
  return 'Bmb!' + s + 'Z9'
}

async function ghFetch(base: string, key: string, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const headers = new Headers(init.headers)
  headers.set('apikey', key)
  headers.set('Authorization', 'Bearer ' + key)
  if (init.body) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${base}${path}`, { ...init, headers })
  let data: any = {}
  try { data = await res.json() } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data }
}
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ('https://' + new URL(req.url).host)
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceKey = Deno.env.get('bmb_backend_production_supabase_service_role_key')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) return json({ error: 'ERR_NOT_CONFIGURED', detail: { has_url: !!supabaseUrl, has_svc: !!serviceKey } }, 500)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'ERR_INVALID_BODY' }, 400) }

  const name: string = String(body?.name ?? '').trim()
  const phone: string = normalizePhone(String(body?.phone ?? ''))
  let latitude = Number(body?.latitude)
  let longitude = Number(body?.longitude)
  const addressDetail: string = String(body?.address_detail ?? '').trim()
  const deliveryPhotoUrl: string = String(body?.delivery_photo_url ?? '').trim()
  const deliveryPhotoPath: string = String(body?.delivery_photo_path ?? '').trim()

  // ---- update_profile mode: save customer details + delivery photo ----
  // Called AFTER login (JWT required — caller is an authenticated user) so the
  // quick-login form can store the delivery-place photo + address once and the
  // system remembers them (Owner feature, 2026-10-08).
  if (String(body?.action ?? '').trim() === 'update_profile') {
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'ERR_UNAUTHORIZED' }, 401)
    const caller = await ghFetch(supabaseUrl, anonKey, '/auth/v1/user', { headers: { Authorization: authHeader } })
    if (!caller.ok || !caller.data?.id) return json({ error: 'ERR_UNAUTHORIZED' }, 401)
    const callerId = String(caller.data.id)

    const row: Record<string, unknown> = {}
    if (name) row.full_name = name
    if (phone) row.phone = phone
    if (addressDetail) { row.address = addressDetail; row.default_address_detail = addressDetail }
    const latU = Number(body?.latitude)
    const lngU = Number(body?.longitude)
    if (latU >= -90 && latU <= 90 && lngU >= -180 && lngU <= 180) {
      row.default_latitude = latU
      row.default_longitude = lngU
    }
    if (deliveryPhotoUrl) row.delivery_photo_url = deliveryPhotoUrl
    if (deliveryPhotoPath) row.delivery_photo_path = deliveryPhotoPath

    if (phone) {
      // deterministic id per phone — merge into the existing row when present
      await ghFetch(supabaseUrl, serviceKey, '/rest/v1/customers', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ id: `cust-${phone.replace(/\D/g, '').slice(-14)}`, user_id: callerId, ...row }),
      })
    } else if (Object.keys(row).length > 0) {
      // no phone in the payload — update the caller's existing row by user_id
      await ghFetch(supabaseUrl, serviceKey, `/rest/v1/customers?user_id=eq.${callerId}`, {
        method: 'PATCH',
        body: JSON.stringify(row),
      })
    }
    // sync profile name/phone (best effort — filter by id = auth uid)
    if (name || phone) {
      await ghFetch(supabaseUrl, serviceKey, `/rest/v1/profiles?id=eq.${callerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...(name ? { name } : {}), ...(phone ? { phone } : {}) }),
      })
    }
    return json({ ok: true, action: 'update_profile' })
  }

  if (!name || phone.length < 7) return json({ error: 'ERR_MISSING_NAME_OR_PHONE' }, 400)
  // coords optional → fall back to the kitchen point (routes/delivery unsupported until set)
  if (!(latitude >= -90 && latitude <= 90)) latitude = 10.7016
  if (!(longitude >= -180 && longitude <= 180)) longitude = 102.1429

  const email = phone.includes('@') ? phone : `${phone}@phone.bmb.local`

  // ---- 1. locate / create the auth user (phone-keyed email) ----
  let uid: string
  const existing = await ghFetch(supabaseUrl, serviceKey, `/auth/v1/admin/users?email=${encodeURIComponent(email)}`)
  const found: any[] = Array.isArray(existing.data) ? existing.data : []
  const password = randomPassword()

  if (found.length > 0) {
    uid = String(found[0].id)
    // refresh the password so we can mint a session, and merge name metadata
    const upd = await ghFetch(supabaseUrl, serviceKey, `/auth/v1/admin/users/${uid}`, {
      method: 'PUT',
      body: JSON.stringify({
        password,
        user_metadata: {
          full_name: name,
          phone,
          login_method: 'location',
        },
      }),
    })
    // if the account owns another password (email signup), ignore — we hold the fresh session
    if (!upd.ok && upd.status !== 404) {
      return json({ error: 'ERR_ACCOUNT_UPDATE_FAILED', detail: upd.data?.msg ?? 'update failed' }, 502)
    }
  } else {
    const created = await ghFetch(supabaseUrl, serviceKey, '/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        // TODO OTP: for production-grade phone verification replace this flow by
        // phone OTP (set phone + verified) — requires an SMS provider on the project.
        phone,
        user_metadata: {
          full_name: name,
          phone,
          login_method: 'location',
        },
      }),
    })
    if (!created.ok) {
      // W5-2 FIX (2026-09-28): the admin users endpoint does NOT support ?email=
      // filtering, so the `found` check above always misses → "already registered"
      // for any existing account. Fallback: page the list and match locally.
      const em = email.toLowerCase()
      let foundUser: any = null
      for (let page = 1; page <= 20 && !foundUser; page++) {
        const list = await ghFetch(supabaseUrl, serviceKey, `/auth/v1/admin/users?page=${page}&per_page=200`)
        const users = (list.data && (Array.isArray(list.data.users) ? list.data.users : (Array.isArray(list.data) ? list.data : []))) || []
        for (const u of users) {
          if (String(u.email ?? '').toLowerCase() === em) { foundUser = u; break }
        }
        if (users.length < 200) break
      }
      if (!foundUser) {
        return json({ error: 'ERR_ACCOUNT_CREATE_FAILED', detail: created.data?.msg ?? 'create failed' }, 502)
      }
      uid = String(foundUser.id)
      const upd = await ghFetch(supabaseUrl, serviceKey, `/auth/v1/admin/users/${uid}`, {
        method: 'PUT',
        body: JSON.stringify({
          password,
          user_metadata: {
            full_name: name,
            phone,
            login_method: 'location',
          },
        }),
      })
      if (!upd.ok && upd.status !== 404) {
        return json({ error: 'ERR_ACCOUNT_UPDATE_FAILED', detail: upd.data?.msg ?? 'update failed' }, 502)
      }
    }
    uid = String(created.data?.id ?? uid)
  }
  if (!uid) return json({ error: 'ERR_NO_USER_ID' }, 500)
// ---- 2. mint a real session (password grant with the password we just set) ----
  const token = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  let tokenData: any = {}
  try { tokenData = await token.json() } catch {}
  if (!token.ok || !tokenData.access_token) {
    return json({ error: 'ERR_SESSION_MINT_FAILED', detail: tokenData.error_description ?? tokenData.msg ?? 'token error' }, 502)
  }

  // ---- 3. persist customer location (service role; deterministic id per phone) ----
  const lock = phone.replace(/\D/g, '').slice(-14)
  await ghFetch(supabaseUrl, serviceKey, '/rest/v1/customers', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: `cust-${lock}`,
      user_id: uid,
      full_name: name,
      phone,
      email,
      address: addressDetail,
      default_latitude: latitude,
      default_longitude: longitude,
      default_address_detail: addressDetail,
      ...(deliveryPhotoUrl ? { delivery_photo_url: deliveryPhotoUrl } : {}),
      ...(deliveryPhotoPath ? { delivery_photo_path: deliveryPhotoPath } : {}),
    }),
  })

  // sync profile name/phone (best effort — filter by id = auth uid)
  await ghFetch(supabaseUrl, serviceKey, `/rest/v1/profiles?id=eq.${uid}`, {
    method: 'PATCH',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ phone, name }),
  })

  return json({
    ok: true,
    login_method: 'location',
    session: {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(tokenData.expires_in || 3600),
    },
    user: tokenData.user,
    location: { latitude, longitude, addressDetail },
  })
})