// Mint an admin JWT with the local stack's JWT secret and verify it against PostgREST.
// Debug tool only.
const crypto = require('node:crypto')
const fs = require('node:fs')

const env = fs.readFileSync(process.env.TEMP + '/bmb_e2e2.env', 'utf8')
const get = (k) => (env.split(/\r?\n/).find((l) => l.startsWith(k + '=')) || '').split('=').slice(1).join('=')
const secret = get('E2E_JWT_SECRET')
const anon = get('VITE_SUPABASE_ANON_KEY')
const url = get('VITE_SUPABASE_URL')

const b64 = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const now = Math.floor(Date.now() / 1000)
const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
const p = b64(JSON.stringify({ sub: '11111111-1111-1111-1111-111111111111', role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now }))
const s = b64(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest())
const jwt = `${h}.${p}.${s}`

console.log('ENV_KEYS=' + env.split(/\r?\n/).filter((l) => l.includes('=')).map((l) => l.split('=')[0]).join(','))
console.log('URL_LEN=' + url.length)
const fs = require('node:fs')
const sessionPath = process.env.E2E_SESSION_FILE
const session = sessionPath ? JSON.parse(fs.readFileSync(sessionPath, 'utf8')) : {}

async function main() {
  const sh = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const sp = b64(JSON.stringify({ role: 'service_role', iss: 'supabase-demo', aud: 'authenticated', exp: now + 3600, iat: now, sub: '00000000-0000-0000-0000-000000000000' }))
  const ss = b64(crypto.createHmac('sha256', secret).update(`${sh}.${sp}`).digest())
  const serviceJwt = `${sh}.${sp}.${ss}`
  const serviceHeaders = { apikey: serviceJwt, Authorization: `Bearer ${serviceJwt}`, 'Content-Type': 'application/json' }

  const email = `e2e-admin-a-${Date.now().toString(36)}@bmb.local`
  const password = 'e2e-pass-' + Date.now().toString(36)
  const cu = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST', headers: serviceHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const cuBody = await cu.json()
  console.log('CREATE_STATUS=' + cu.status)
  const uid = cuBody?.id

  // promote profile: tenant-a admin (matches E2E fixture)
  const pr = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}`, {
    method: 'PATCH', headers: { ...serviceHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ role: 'admin', tenant_id: 'tenant-a', is_active: true }),
  })
  console.log('PATCH_STATUS=' + pr.status + ' BODY=' + (await pr.text()).slice(0, 120))
  const chk = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}&select=role,tenant_id`, { headers: { apikey: serviceJwt, Authorization: `Bearer ${serviceJwt}` } })
  console.log('PROFILE=' + (await chk.text()))

  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const session = await r.json()
  console.log('LOGIN_STATUS=' + r.status)
  console.log('UID=' + uid)
  fs.writeFileSync(process.env.TEMP + '/bmb_session.json', JSON.stringify(session))
  fs.writeFileSync(process.env.TEMP + '/bmb_uid.txt', uid || '')
}
main().catch((e) => { console.error('ERR=' + e.message); process.exit(1) })
