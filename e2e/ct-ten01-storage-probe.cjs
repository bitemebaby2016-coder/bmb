'use strict'
// TEN-01 — storage 403 investigation probes (no secrets printed)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const SUPABASE_URL = `https://${REF}.supabase.co`
const fs = require('fs')
function adminToken() {
  const c = fs.readFileSync('supabase/secrets.local.env', 'utf8')
  const email = c.match(/BMB_TEST_ADMIN_EMAIL=(\S+)/)[1], password = c.match(/BMB_TEST_ADMIN_PASSWORD=(\S+)/)[1]
  const anonKey = fs.readFileSync('.env', 'utf8').match(/VITE_SUPABASE_ANON_KEY=(\S+)/)[1]
  return fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey }, body: JSON.stringify({ email, password }) }).then(async r => { const b = await r.text(); if (!r.ok) throw new Error('AUTH ' + r.status); return JSON.parse(b).access_token })
}

;(async () => {
  const jwt = await adminToken()
  const keys = await (async () => { const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, { headers: { Authorization: 'Bearer ' + TOKEN } }); return (await r.json()).filter(k => k.type === 'legacy').map(k => k.api_key) })()
  const legacyAnon = keys[0]
  const anon = fs.readFileSync('.env', 'utf8').match(/VITE_SUPABASE_ANON_KEY=(\S+)/)[1]
  const H = { apikey: legacyAnon, Authorization: 'Bearer ' + jwt }
  // SELECT (list) via authenticated JWT — tests whether storage resolves user JWT claims at all
  const list = await fetch(`${SUPABASE_URL}/storage/v1/object/list/bmb-images`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: 'products/' }) })
  console.log('storage LIST with admin user JWT:', list.status, (await list.text()).slice(0, 120))
  // LIST with anon apikey only
  const list2 = await fetch(`${SUPABASE_URL}/storage/v1/object/list/bmb-images`, { method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: 'products/' }) })
  console.log('storage LIST with anon apikey:', list2.status, (await list2.text()).slice(0, 120))
  // decode & compare user JWT vs legacy anon key claims (keys only, no secrets printed)
  const dec = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString())
  const u = dec(jwt), a = dec(legacyAnon)
  console.log('user JWT claims subset:', JSON.stringify({ iss: u.iss, aud: u.aud, role: u.role, aal: u.aal, header_alg: jwt.split('.')[0] ? 'see-next' : '' }))
  console.log('legacy anon claims:', JSON.stringify({ iss: a.iss, aud: a.aud, role: a.role }))
  const uh = JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString())
  const ah = JSON.parse(Buffer.from(legacyAnon.split('.')[0], 'base64url').toString())
  console.log('JWT headers:', JSON.stringify({ user: uh, anon: ah }))
  // POSTGRES_URL blinding check: is storage served by same domain (no info leak) — just confirm endpoint presence
  const storageInfo = await fetch(`${SUPABASE_URL}/storage/v1/status`, { headers: { apikey: anon } })
  console.log('storage status:', storageInfo.status, (await storageInfo.text()).slice(0, 100))
})().catch((e) => { console.error('FATAL', String(e).slice(0, 400)); process.exit(1) })
