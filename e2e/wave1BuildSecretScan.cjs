// Wave 1 (F-17) — full build-output secret scan (initial chunks + ALL lazy chunks + assets)
'use strict'
const fs = require('fs')
const path = require('path')

const DIST = path.join(process.cwd(), 'dist')
const patterns = {
  openrouter_key: /sk-or-[A-Za-z0-9_-]{10,}/g,
  openrouter_env_ref: /VITE_OPENROUTER_API_KEY/g,
  stripe_secret: /sk_(test|live)_[A-Za-z0-9]{10,}/g,
  stripe_webhook_secret: /whsec_[A-Za-z0-9]{10,}/g,
  supabase_service_secret: /sb_secret_[A-Za-z0-9_-]{10,}/g,
  service_role_marker: /"role"\s*:\s*"service_role"/g,
  vite_secret_vars: /VITE_[A-Z_]*SECRET[A-Z_]*/g,
}

function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name)
    if (f.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(DIST, [])
const hits = {}
let scanned = 0
for (const f of files) {
  const rel = path.relative(DIST, f)
  const buf = fs.readFileSync(f, 'utf8')
  scanned++
  for (const [k, re] of Object.entries(patterns)) {
    re.lastIndex = 0
    const m = buf.match(re)
    if (m) (hits[k] = hits[k] || []).push({ file: rel, count: m.length, sample: k === 'openrouter_env_ref' ? 'env-ref' : '(value hidden)' })
  }
}
const result = { timestamp: new Date().toISOString(), dist: 'dist/', filesScanned: scanned, hits }
fs.writeFileSync(path.join(process.cwd(), 'e2e', 'wave1-build-secret-scan.json'), JSON.stringify(result, null, 2))
console.log('FILES_SCANNED=' + scanned)
console.log('HITS=' + JSON.stringify(hits, null, 2))
