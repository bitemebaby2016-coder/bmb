// Wave 1 (F-01) — Production Supabase Auth operations
// 1) Ban the leaked public credential user (admin@bmb.co.th)
// 2) Create a Dedicated Test Admin account (qa-admin@bmb.co.th)
// 3) Verify: public login FAILS, test admin login SUCCEEDS
// Secrets are read from supabase/secrets.local.env (gitignored). Values never printed.
'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const secretsPath = path.join(process.cwd(), 'supabase', 'secrets.local.env')
function readSecrets() {
  const out = {}
  for (const line of fs.readFileSync(secretsPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && m[2]) out[m[1]] = m[2]
  }
  return out
}
const S = readSecrets()
const URL = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const KEY = S.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('NO SERVICE KEY'); process.exit(1) }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }

async function api(method, p, body) {
  const r = await fetch(URL + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined })
  let j = null
  try { j = await r.json() } catch {}
  return { status: r.status, j }
}

async function main() {
  const log = { timestamp: new Date().toISOString(), steps: [] }

  // ---- Step 1: find + ban public admin user
  const q = await api('GET', '/auth/v1/admin/users?email=admin%40bmb.co.th')
  const pubUser = q.j?.users?.find((u) => u.email === 'admin@bmb.co.th')
  log.steps.push({ step: 'find_public_user', found: !!pubUser, id: pubUser?.id ?? null })
  if (pubUser) {
    const ban = await api('PUT', '/auth/v1/admin/users/' + pubUser.id, { ban_duration: '876000h' })
    log.steps.push({ step: 'ban_public_user', status: ban.status, banned: ban.j?.banned_until != null })
  }

  // ---- Step 2: create dedicated test admin
  const email = 'qa-admin@bmb.co.th'
  let password = S.BMB_TEST_ADMIN_PASSWORD
  if (!password) {
    password = 'Bmb-' + crypto.randomBytes(12).toString('base64url') + '!7x'
    fs.writeFileSync(secretsPath, fs.readFileSync(secretsPath, 'utf8')
      .replace(/^BMB_TEST_ADMIN_EMAIL=.*$/m, 'BMB_TEST_ADMIN_EMAIL=' + email)
      .replace(/^BMB_TEST_ADMIN_PASSWORD=.*$/m, 'BMB_TEST_ADMIN_PASSWORD=' + password))
    log.steps.push({ step: 'generate_test_admin_password', storedIn: 'supabase/secrets.local.env (gitignored)' })
  }
  const ex = await api('GET', '/auth/v1/admin/users?email=' + encodeURIComponent(email))
  const existing = ex.j?.users?.find((u) => u.email === email)
  let testUser = existing
  if (!testUser) {
    const cr = await api('POST', '/auth/v1/admin/users', { email, password, email_confirm: true })
    log.steps.push({ step: 'create_test_admin', status: cr.status, id: cr.j?.id ?? null })
    testUser = cr.j
  } else {
    const up = await api('PUT', '/auth/v1/admin/users/' + testUser.id, { password, email_confirm: true, ban_duration: 'none' })
    log.steps.push({ step: 'reset_test_admin_password', status: up.status })
  }
  const testId = testUser?.id
  if (testId) {
    // ensure profiles.role = 'admin' (service key bypasses RLS; upsert-safe)
    const pr = await api('GET', '/rest/v1/profiles?id=eq.' + testId + '&select=id,role')
    if (pr.j?.length) {
      const upr = await api('PATCH', '/rest/v1/profiles?id=eq.' + testId, { role: 'admin' })
      log.steps.push({ step: 'set_profile_role_admin', status: upr.status })
    } else {
      const ins = await api('POST', '/rest/v1/profiles', { id: testId, role: 'admin' })
      log.steps.push({ step: 'insert_profile_role_admin', status: ins.status })
    }
  }

  // ---- Step 3: verification
  const bad = await fetch(URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bmb.co.th', password: 'admin123' }),
  })
  const badBody = await bad.json().catch(() => ({}))
  log.steps.push({ step: 'verify_public_login_revoked', status: bad.status, error: badBody.error || badBody.msg || null })

  const good = await fetch(URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  log.steps.push({ step: 'verify_test_admin_login', status: good.status, ok: good.status === 200 })

  fs.writeFileSync(path.join(process.cwd(), 'e2e', 'wave1-f01-auth-ops.json'), JSON.stringify(log, null, 2))
  console.log(JSON.stringify(log, null, 2))
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
