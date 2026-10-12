// ============================================
// Bite Me Baby — Edge Function: guest-checkout-session (P2 / Owner OD-2 option A)
// ============================================
// หน้าที่: แปลง "ลูกค้าที่ยืนยันการควบคุมเบอร์แล้ว" ให้มี session
//          เพื่อเรียก `create_order_with_items` (GRANT authenticated เท่านั้น)
//          โดย "ไม่ต้องสมัครสมาชิกเต็มรูปแบบ"
//
// แยกจาก `phone-auto-login` โดยเจตตา (Owner สั่งห้ามยืมใช้ตรง ๆ):
//   * บังคับ OTP purpose='guest_checkout' เสมอ — ไม่มี flag ปิดได้
//   * ไม่ทำ update_profile action
//   * ไม่แตะ business rules / RPC / Payment Authority / Order State Machine
//
// หลักฐานตาม acceptance criteria ของ Owner:
//   1. กลับมาสั่งซ้ำได้ทันที — account ผูกกับเบอร์ + customers row มี id คงที่
//   2. ออเดอร์ทุกใบมีเจ้าของ — RPC ตั้ง customer_ref = auth.uid() ฝั่ง server
//   3. ไม่สร้าง Customer ซ้ำ — deterministic id + merge-duplicates
//   4. OTP ไม่ให้สิทธิ์เข้าบัญชีอื่น — เข้าถึงเฉพาะบัญชี phone-keyed ของเบอร์นั้น
//   5. OTP/Session ล้มเหลว = ไม่มี session = เรียก RPC ไม่ได้ = ไม่มีออเดอร์ค้าง
// ============================================

import { consumeOtpChallenge } from '../_shared/otpVerify.ts'
import { normalizeOtpPhone, maskOtpPhone } from '../_shared/otpPolicy.ts'

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

function randomPassword(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  let s = ''
  for (const v of b) s += String.fromCharCode(33 + (v % 90))
  return 'Bmb!' + s + 'Z9'
}

async function gh(
  base: string,
  key: string,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: any }> {
  const headers = new Headers(init.headers)
  headers.set('apikey', key)
  headers.set('Authorization', 'Bearer ' + key)
  if (init.body) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${base}${path}`, { ...init, headers })
  let data: any = {}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (req.method !== 'POST') return json({ error: 'ERR_METHOD_NOT_ALLOWED' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ('https://' + new URL(req.url).host)
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceKey =
    Deno.env.get('bmb_backend_production_supabase_service_role_key') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    ''
  if (!serviceKey || !anonKey) return json({ error: 'ERR_NOT_CONFIGURED' }, 503)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }

  const phone = normalizeOtpPhone(String(body?.phone ?? ''))
  const otpCode = String(body?.otp_code ?? '').trim()
  const name = String(body?.name ?? '').trim()
  const addressDetail = String(body?.address_detail ?? '').trim()

  if (phone.length < 9) return json({ error: 'ERR_INVALID_PHONE' }, 400)
  if (!otpCode) return json({ error: 'ERR_OTP_REQUIRED' }, 401)

  // ---- 1. บังคับ OTP (purpose='guest_checkout') — ไม่มีทางข้ามได้ ----
  const verdict = await consumeOtpChallenge({
    supabaseUrl,
    serviceKey,
    phone,
    code: otpCode,
    purpose: 'guest_checkout',
    verifyStore: sessionStore,
  })
  if (!verdict.ok) {
    return json(
      { error: verdict.reason, ...(verdict.retryAfterSec ? { retry_after_sec: verdict.retryAfterSec } : {}) },
      verdict.reason === 'ERR_RATE_LIMITED' ? 429 : 401,
    )
  }

  // ---- 2. หา/สร้าง "บัญชี phone-keyed ของเบอร์นี้เท่านั้น" ----
  // Owner criteria #4: ห้ามเข้าถึงบัญชีอีเมล/บัญชีอื่นเด็ดขาด
  //   -> จับคู่ด้วย synthetic email `<phone>@phone.bmb.local` เท่านั้น
  //      (ผู้ใช้ที่สมัครด้วยอีเมลจริงจะ "ไม่ถูกแตะต้อง" — ได้บัญชีแยก ไม่ใช่ takeover)
  const email = `${phone}@phone.bmb.local`
  const password = randomPassword()

  async function findUidByPhoneEmail(): Promise<string> {
    for (let page = 1; page <= 20; page++) {
      const list = await gh(supabaseUrl, serviceKey, `/auth/v1/admin/users?page=${page}&per_page=200`)
      const users: any[] = Array.isArray(list.data?.users)
        ? list.data.users
        : (Array.isArray(list.data) ? list.data : [])
      const hit = users.find((u) => String(u.email ?? '').toLowerCase() === email)
      if (hit) return String(hit.id)
      if (users.length < 200) break
    }
    return ''
  }

  let uid = await findUidByPhoneEmail()

  if (uid) {
    // มีอยู่แล้ว -> รีเฟรชรหัสผ่านเพื่อ mint session (บัญชีนี้เป็นของเบอร์นี้ตามนิยาม)
    const upd = await gh(supabaseUrl, serviceKey, `/auth/v1/admin/users/${uid}`, {
      method: 'PUT',
      body: JSON.stringify({
        password,
        user_metadata: { ...(name ? { full_name: name } : {}), phone, login_method: 'guest_checkout' },
      }),
    })
    if (!upd.ok && upd.status !== 404) return json({ error: 'ERR_ACCOUNT_UPDATE_FAILED' }, 502)
  } else {
    const created = await gh(supabaseUrl, serviceKey, '/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        phone,
        user_metadata: { ...(name ? { full_name: name } : {}), phone, login_method: 'guest_checkout' },
      }),
    })
    if (created.ok) {
      uid = String(created.data?.id ?? '')
    } else {
      // กัน race (สร้างซ้ำ) -> ไล่อีกรอบเพื่อเอา uid ของแถวที่เพิ่งถูกสร้าง
      uid = await findUidByPhoneEmail()
      if (uid) {
        const upd = await gh(supabaseUrl, serviceKey, `/auth/v1/admin/users/${uid}`, {
          method: 'PUT',
          body: JSON.stringify({ password }),
        })
        if (!upd.ok && upd.status !== 404) return json({ error: 'ERR_ACCOUNT_UPDATE_FAILED' }, 502)
      }
    }
  }
  if (!uid) return json({ error: 'ERR_NO_USER_ID' }, 502)

  // ---- 3. mint session ----
  const token = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  let tokenData: any = {}
  try { tokenData = await token.json() } catch { /* empty */ }
  if (!token.ok || !tokenData.access_token) return json({ error: 'ERR_SESSION_MINT_FAILED' }, 502)

  // ---- 4. upsert customers row — id คงที่ -> merge ไม่สร้างซ้ำ (criteria #3) ----
  const lock = phone.replace(/\D/g, '').slice(-14)
  await gh(supabaseUrl, serviceKey, '/rest/v1/customers', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: `cust-${lock}`,
      user_id: uid,
      ...(name ? { full_name: name } : {}),
      phone,
      email,
      ...(addressDetail ? { address: addressDetail, default_address_detail: addressDetail } : {}),
    }),
  })
  // sync profile (best effort)
  await gh(supabaseUrl, serviceKey, `/rest/v1/profiles?id=eq.${uid}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...(name ? { name } : {}), phone }),
  })

  return json({
    ok: true,
    masked_phone: maskOtpPhone(phone),
    session: {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(tokenData.expires_in || 3600),
    },
    user: { id: uid, email },
    note: 'ยืนยันการควบคุมเบอร์แล้ว — session นี้ใช้สำหรับสั่งซื้อเท่านั้น ไม่ใช่หลักฐานการชำระเงิน',
  })
})

  try { data = await res.json() } catch { /* empty */ }
  return { ok: res.ok, status: res.status, data }
}

// in-memory limiter กัน spam (interim — reset ตอน cold start)
const sessionStore = new Map<string, number[]>()
