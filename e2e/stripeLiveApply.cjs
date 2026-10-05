// ============================================
// stripeLiveApply — สลับ Stripe จาก TEST → LIVE (Stage A / W-2.1)
//
//   node e2e/stripeLiveApply.cjs secrets   → set EF secrets (LIVE)
//   node e2e/stripeLiveApply.cjs verify    → read-only: ยืนยันว่า key = LIVE จริง
//   node e2e/stripeLiveApply.cjs list      → secrets ปัจจุบัน (ไม่แสดงค่า)
//
// Keys มาจาก .env.local (ชื่อที่ Owner กำหนด):
//   LIVE_STRIPE_PUBLISHABLE_KEY  (pk_live_…)  — Cloudflare Pages env (หน้าบ้าน)
//   BMB_LIVE_STRIPE_SECRET_KEY   (rk_live_…)  — restricted live key → EF secret
//   LIVE_STRIPE_WEBHOOK_SECRET   (whsec_…)    — live webhook endpoint signing
//
// ไม่พิมพ์ค่า key กลับออกมา — แสดงแค่ prefix/mode/ความยาว
// verify ใช้ GET /v1/account (read-only) — ไม่สร้าง order/transaction ใด ๆ
// ============================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const PROJECT = 'ivkdfognyiwjcmrhcnwz'
const API = `https://api.supabase.com/v1/projects/${PROJECT}`

const LIVE_SECRET = env.BMB_LIVE_STRIPE_SECRET_KEY || ''
const LIVE_WEBHOOK_SECRET = env.LIVE_STRIPE_WEBHOOK_SECRET || ''
const LIVE_PUBLISHABLE = env.LIVE_STRIPE_PUBLISHABLE_KEY || ''

function modeOf(key) {
  if (/^pk_live_/.test(key)) return 'LIVE (publishable)'
  if (/^pk_test_/.test(key)) return 'TEST (publishable)'
  if (/^(sk|rk)_live_/.test(key)) return 'LIVE (secret)'
  if (/^(sk|rk)_test_/.test(key)) return 'TEST (secret)'
  if (/^whsec_/.test(key)) return 'WEBHOOK SECRET'
  return 'UNKNOWN'
}

/**
 * Read-only Stripe checks that work with a RESTRICTED live key.
 *  - 401  = key invalid/unknown        → FAIL
 *  - 403  = key recognised but the endpoint is not granted (restricted key) → OK
 *  - 200  = endpoint readable; report livemode from the body
 * /v1/account is included for information only — a restricted key usually lacks
 * "Account" permission, and a publishable key can NEVER call it.
 */
async function probeStripe(key, label) {
  const endpoints = [
    ['balance', '/v1/balance'],
    ['charges', '/v1/charges?limit=1'],
    ['account', '/v1/account'],
  ]
  let recognised = false
  let livemodeSeen = null
  for (const [name, ep] of endpoints) {
    const res = await fetch('https://api.stripe.com' + ep, { headers: { Authorization: 'Bearer ' + key } })
    const j = await res.json().catch(() => null)
    if (res.status === 401) {
      console.log(`${label} [${name}]: HTTP 401 — key INVALID`)
      return { ok: false, livemode: null }
    }
    if (res.status === 403) {
      // Stripe returns 403 for a valid key that lacks permission for the endpoint.
      recognised = true
      console.log(`${label} [${name}]: HTTP 403 — key recognised, permission not granted (expected for a restricted key)`)
      continue
    }
    if (res.ok) {
      recognised = true
      if (j && typeof j.livemode === 'boolean') livemodeSeen = j.livemode
      console.log(`${label} [${name}]: HTTP 200 · livemode=${j && j.livemode}`)
      continue
    }
    console.log(`${label} [${name}]: HTTP ${res.status} — ${j && j.error ? j.error.message : 'unknown'}`)
  }
  if (!recognised) return { ok: false, livemode: livemodeSeen }
  return { ok: true, livemode: livemodeSeen }
}

async function setSecrets() {
  if (!LIVE_SECRET || !LIVE_WEBHOOK_SECRET) {
    console.error('STRIPE_LIVE_FAIL: LIVE keys not found in .env.local (BMB_LIVE_STRIPE_SECRET_KEY / LIVE_STRIPE_WEBHOOK_SECRET)')
    process.exit(1)
  }
  if (!/^rk_live_|^sk_live_/.test(LIVE_SECRET)) {
    console.error('STRIPE_LIVE_FAIL: secret key is not a LIVE key (' + modeOf(LIVE_SECRET) + ')')
    process.exit(1)
  }
  const pairs = [
    ['STRIPE_SECRET_KEY', LIVE_SECRET],
    ['STRIPE_WEBHOOK_SECRET', LIVE_WEBHOOK_SECRET],
  ]
  for (const [name, value] of pairs) {
    const res = await fetch(`${API}/secrets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ name, value }]),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error(`STRIPE_LIVE_SECRET_FAIL ${name}: HTTP ${res.status} ${txt.slice(0, 300)}`)
      process.exit(1)
    }
    console.log(`SECRET_SET ${name} mode=${modeOf(value)} len=${value.length}`)
  }
  console.log('STRIPE_LIVE_SECRETS_OK — Edge Functions must be redeployed to pick these up.')
}

async function verify() {
  const secretProbe = await probeStripe(LIVE_SECRET, 'STRIPE_SECRET_KEY (EF secret)')
  if (!secretProbe.ok) {
    console.log('STRIPE_LIVE_VERIFY_FAIL')
    process.exit(1)
  }
  // A publishable key cannot call the account endpoint by design — report its
  // shape only (it is a build-time identifier, not a secret).
  console.log(`PUBLISHABLE_KEY (Pages env): mode=${modeOf(LIVE_PUBLISHABLE)} len=${LIVE_PUBLISHABLE.length} (not an API credential — no endpoint check)`)
  console.log(`STRIPE_WEBHOOK_SECRET: present=${!!LIVE_WEBHOOK_SECRET} mode=${modeOf(LIVE_WEBHOOK_SECRET)} (proven only by a real event signature)`)
  if (secretProbe.livemode === true) console.log('STRIPE_LIVE_VERIFY_OK (livemode=true confirmed)')
  else if (secretProbe.livemode === false) {
    console.log('STRIPE_LIVE_VERIFY_FAIL — key decoded but is NOT live mode')
    process.exit(1)
  } else {
    console.log('STRIPE_LIVE_VERIFY_OK_PARTIAL (key valid+recognised; livemode not readable via granted endpoints — confirmed at first real charge)')
  }
}

async function listSecrets() {
  const res = await fetch(`${API}/secrets`, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } })
  const json = await res.json().catch(() => [])
  const names = (Array.isArray(json) ? json : []).map((s) => s.name).sort()
  for (const need of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) {
    console.log(`  ${need}: ${names.includes(need) ? 'PRESENT' : 'MISSING'}`)
  }
}

const mode = process.argv[2] || 'secrets'
if (mode === 'verify') verify()
else if (mode === 'list') listSecrets()
else setSecrets()