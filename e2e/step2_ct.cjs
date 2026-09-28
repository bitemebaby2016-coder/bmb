'use strict'
// ============================================
// STEP 2 — CONTROLLED TEST RUNTIME VERIFICATION (CT-01..CT-05)
// Owner-authorized 2026-09-28. TEST Stripe only. TEST data labeled "[STEP2-CT]".
// Reuses proven mechanics: phone-auto-login JWT, Management-API admin promote/revoke,
// canonical RPCs. Evidence per CT written to e2e/ct-<id>.json.
// Usage: node e2e/step2_ct.cjs --ct <1..5>
// HARD STOP: any PA multiplication mismatch / dup PI / wrong state → exit 2.
// ============================================
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const ANON = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const SECRETS = (() => { const o = {}; for (const l of fs.readFileSync(path.join(PROJ, 'supabase', 'secrets.local.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && m[2]) o[m[1]] = m[2] } return o })()
const SERVICE = SECRETS.SUPABASE_SERVICE_ROLE_KEY
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const qaPhone = () => '+669' + String(Date.now()).slice(-8)

// transient-safe fetch
const _fetch = globalThis.fetch
const fet = async (u, i) => { let last; for (let a = 0; a < 5; a++) { try { return await _fetch(u, i) } catch (e) { last = e; if (a === 4) break; await sleep(1200 * (a + 1)) } } throw last }
async function q(sql) {
  const r = await fet(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }),
  })
  const b = await r.text(); if (!r.ok) throw new Error('MGMT ' + r.status + ' ' + b.slice(0, 250)); return JSON.parse(b)
}
async function rest(p, method, jwt, body) {
  const r = await fet(`${SB}/rest/v1/${p}`, {
    method: method || 'GET', headers: { apikey: ANON, Authorization: 'Bearer ' + (jwt || ANON), 'content-type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text(); let d = null; try { d = JSON.parse(t) } catch { }
  return { status: r.status, data: d, body: t.slice(0, 400) }
}
async function rpc(jwt, fn, i) { return rest('rpc/' + fn, 'POST', jwt, i || {}) }
async function phoneLogin(name, phone, lat, lng, addr) {
  const r = await fet(`${SB}/functions/v1/phone-auto-login`, {
    method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ name, phone, latitude: lat, longitude: lng, address_detail: addr }),
  })
  const j = await r.json(); const tok = j.session?.access_token || j.access_token
  if (!tok) throw new Error('phone-login fail ' + r.status + ' ' + JSON.stringify(j).slice(0, 200))
  return { jwt: tok, uid: (j.user?.id || j.session?.user?.id || '') }
}
// Management-API admin promote/revoke (Owner-approved OPTION A pattern)
async function promoteAdmin(uid, phone, name) {
  const before = await q(`select role from public.profiles where id='${uid}'`)
  const prior = before.length ? before[0].role : null
  await q(`INSERT INTO public.profiles (id, phone, name, role, created_at, updated_at) VALUES ('${uid}','${phone}','${name}','admin',now(),now()) ON CONFLICT (id) DO UPDATE SET role='admin', updated_at=now()`)
  const after = await q(`select role from public.profiles where id='${uid}'`)
  return { prior, ok: after[0]?.role === 'admin' }
}
async function revokeAdmin(uid, prior) {
  if (prior == null) await q(`DELETE FROM public.profiles WHERE id='${uid}'`)
  else await q(`UPDATE public.profiles SET role='${prior}', updated_at=now() WHERE id='${uid}'`)
}
async function createOrder(jwt, productId, roundId, phone, name, method, mode = 'SAME_DAY') {
  const today = new Date().toISOString().slice(0, 10)
  const r = await rpc(jwt, 'create_order_with_items', {
    p_items: [{ product_id: productId, quantity: 1, options: {}, special_request: '[STEP2-CT] controlled test' }],
    p_delivery_round_id: roundId, p_delivery_method: 'self_delivery', p_delivery_address: 'STEP2-CT test address (controlled)',
    p_dropoff_latitude: 10.7031, p_dropoff_longitude: 102.1444,
    p_customer_name: name, p_customer_phone: phone,
    p_payment_method: method, p_order_mode: mode, p_scheduled_date: today,
  })
  return { status: r.status, order_number: r.data?.order_number, body: r.body }
}
async function createCheckout(jwt, orderNumber) {
  const r = await fet(`${SB}/functions/v1/create-checkout`, {
    method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + jwt, 'content-type': 'application/json' },
    body: JSON.stringify({ order_number: orderNumber }),
  })
  let j = null; try { j = await r.json() } catch { }
  return { status: r.status, data: j, body: JSON.stringify(j).slice(0, 300) }
}
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null }
module.exports = { SB, ANON, SERVICE, SECRETS, q, rest, rpc, phoneLogin, promoteAdmin, revokeAdmin, createOrder, createCheckout, qaPhone, sleep, arg, path, fs, PROJ, crypto, fet }

// ---- CT dispatch (loads ./step2_ct_cts.cjs) ----
const cts = require('./step2_ct_cts.cjs')
cts.run(Number(arg('ct') || 0)).catch((e) => { console.error('FATAL', String(e).slice(0, 600)); process.exit(1) })