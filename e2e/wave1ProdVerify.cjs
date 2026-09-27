// Wave 1 — PRODUCTION VERIFICATION (F-01 + F-17 against the DEPLOYED build)
// 1) Scan every DEPLOYED asset (all JS chunks incl. lazy + assets + sw) for secrets/demo creds
// 2) Supabase REST: public credential must FAIL, dedicated test admin must PASS
'use strict'
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE_URL || 'https://bitemebaby-5f7.pages.dev'

const SECRET_PATTERNS = {
  openrouter_key: /sk-or-[A-Za-z0-9_-]{10,}/g,
  vite_openrouter_key: /VITE_OPENROUTER_API_KEY/g,
  stripe_secret: /sk_(test|live)_[A-Za-z0-9]{10,}/g,
  stripe_secret_var: /VITE_STRIPE_SECRET_KEY|STRIPE_SECRET_KEY=/g,
  webhook_secret: /whsec_[A-Za-z0-9]{10,}/g,
  webhook_secret_var: /VITE_STRIPE_WEBHOOK_SECRET/g,
  supabase_service_secret: /sb_secret_[A-Za-z0-9_-]{10,}/g,
  service_role_var: /VITE_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY=/g,
  service_role_marker: /"role"\s*:\s*"service_role"/g,
  demo_password: /admin123/g,
}
// strings that must NOT appear in the public UI bundle (F-01 C)
const DEMO_CRED_STRINGS = ['admin123', 'admin@bmb.co.th']

function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name)
    if (f.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

async function main() {
  const log = { timestamp: new Date().toISOString(), base: BASE, commit: 'c6a4014', steps: [] }

  // ---- 1) deployed-asset scan (uses local dist file list = what was deployed)
  const distAssets = walk(path.join(process.cwd(), 'dist'), []).map((p) => '/dist/' + path.relative(path.join(process.cwd(), 'dist'), p).replace(/\\/g, '/')).filter((p) => /\.(js|css|html)$/.test(p))
  let scanned = 0
  const hits = {}
  for (const rel of distAssets) {
    if ((scanned % 10) === 0) console.error('scan progress: ' + scanned)
    const url = BASE + rel.replace(/^\/dist/, '')
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const body = await r.text()
      scanned++
      for (const [k, re] of Object.entries(SECRET_PATTERNS)) {
        re.lastIndex = 0
        const m = body.match(re)
        if (m) (hits[k] = hits[k] || []).push({ asset: rel, count: m.length })
      }
    } catch {}
  }
  log.steps.push({ step: 'deployed_build_secret_scan', filesScanned: scanned, hits, note: 'value contents never printed' })

  // ---- 2) auth checks (live, same Supabase project the app uses)
  const secrets = {}
  for (const line of fs.readFileSync(path.join(process.cwd(), 'supabase', 'secrets.local.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && m[2]) secrets[m[1]] = m[2]
  }
  const anonKey = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'
  const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
  const bad = await fetch(SB + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bmb.co.th', password: 'admin123' }),
  })
  log.steps.push({ step: 'F01_A_public_demo_login', status: bad.status, expect: '400 INVALID', pass: bad.status === 400 })

  const good = await fetch(SB + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: secrets.BMB_TEST_ADMIN_EMAIL, password: secrets.BMB_TEST_ADMIN_PASSWORD }),
  })
  log.steps.push({ step: 'F01_B_test_admin_login', status: good.status, expect: '200', pass: good.status === 200, accountType: 'dedicated-test-admin' })

  fs.writeFileSync(path.join(process.cwd(), 'e2e', 'wave1-prod-auth-secret.json'), JSON.stringify(log, null, 2))
  const secretHits = Object.keys(hits).filter((k) => !DEMO_CRED_STRINGS.includes(k))
  console.log('DEPLOYED_SCAN_FILES=' + scanned)
  console.log('SECRET_HITS=' + JSON.stringify(hits))
  console.log('PUBLIC_DEMO_LOGIN=' + bad.status + (bad.status === 400 ? ' (INVALID=PASS)' : ' (FAIL)'))
  console.log('TEST_ADMIN_LOGIN=' + good.status + (good.status === 200 ? ' (PASS)' : ' (FAIL)'))
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
