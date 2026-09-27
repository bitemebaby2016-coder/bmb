// ============================================
// BMB WAVE 2 — setup + verification harness (F-05, F-06, F-18)
// Prerequisite: migrations 040/041/042 applied (owner runs `supabase db push`).
// Uses TEST DATA ONLY (TEST-ORDER-*, qa-* accounts). Never touches customer data.
// Credentials are read/generated in supabase/secrets.local.env (gitignored) — never printed.
// Usage:
//   node e2e/wave2Setup.cjs            → provision accounts/driver/test order
//   node e2e/wave2VerifyF05.cjs        → order lifecycle history evidence
//   node e2e/wave2VerifyF06.cjs        → driver identity spoof tests
//   node e2e/wave2VerifyF18.cjs        → RLS matrix
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')

const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const ANON = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'
const SECRETS_PATH = path.join(process.cwd(), 'supabase', 'secrets.local.env')
const crypto = require('crypto')

function readSecrets() {
  const out = {}
  for (const line of fs.readFileSync(SECRETS_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && m[2]) out[m[1]] = m[2]
  }
  return out
}
const S = readSecrets()
const SERVICE = S.SUPABASE_SERVICE_ROLE_KEY

function saveSecret(key, value) {
  let raw = fs.readFileSync(SECRETS_PATH, 'utf8')
  if (new RegExp('^' + key + '=', 'm').test(raw)) raw = raw.replace(new RegExp('^' + key + '=.*$', 'm'), key + '=' + value)
  else raw = raw.replace(/\s*$/, '\n' + key + '=' + value + '\n')
  fs.writeFileSync(SECRETS_PATH, raw)
}

function genPassword() {
  return 'Bmb-' + crypto.randomBytes(12).toString('base64url') + '!7x'
}

async function api(key, method, p, body, jwt) {
  const r = await fetch(SB + p, {
    method,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + (jwt || key),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let j = null
  try { j = await r.json() } catch {}
  return { status: r.status, j }
}

async function login(email, password) {
  const r = await fetch(SB + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, jwt: j.access_token, uid: j.user?.id ?? null, error: j.error || j.msg || null }
}

async function ensureAuthUser(email, passwordKey) {
  let password = S[passwordKey]
  // try login first (idempotent)
  if (password) {
    const l = await login(email, password)
    if (l.status === 200) return { uid: l.uid, password }
  }
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  if (admin.status !== 200) throw new Error('test admin login failed: ' + admin.status)
  // find existing user
  const q = await api(SERVICE, 'GET', '/auth/v1/admin/users?email=' + encodeURIComponent(email))
  let user = q.j?.users?.find((u) => u.email === email)
  if (!user) {
    password = password || genPassword()
    const cr = await api(SERVICE, 'POST', '/auth/v1/admin/users', { email, password, email_confirm: true })
    if (cr.status !== 200 && cr.status !== 201) throw new Error('create user failed ' + cr.status)
    user = cr.j
    saveSecret(passwordKey, password)
  } else {
    if (!password) {
      password = genPassword()
      await api(SERVICE, 'PUT', '/auth/v1/admin/users/' + user.id, { password, email_confirm: true })
      saveSecret(passwordKey, password)
    }
  }
  return { uid: user.id, password }
}

async function rpc(jwt, fn, body) {
  return api(ANON, 'POST', '/rest/v1/rpc/' + fn, body ?? {}, jwt)
}

module.exports = { SB, ANON, SERVICE, S, api, login, rpc, ensureAuthUser, saveSecret, genPassword, readSecrets, saveSecretFile: (k, v) => saveSecret(k, v) }
