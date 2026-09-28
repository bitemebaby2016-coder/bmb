'use strict'
// Final pre-commit guard: real-secret scan over staged tooling/evidence files (values only).
const fs = require('fs')
const pats = {
  sk_test: /sk_(test|live)_[A-Za-z0-9]{10,}/g,
  sk_any: /[rs]k_[A-Za-z0-9]{20,}/g,
  whsec: /whsec_[A-Za-z0-9]{10,}/g,
  sb_secret: /sb_secret_[A-Za-z0-9_-]{10,}/g,
  sb_anon: /sb_publishable_[A-Za-z0-9_-]{10,}/g,
  bearer: /Bearer\s+[A-Za-z0-9_\-.]{20,}/g,
  access_token_env: /SUPABASE_ACCESS_TOKEN\s*=/, 
}
const files = [
  'e2e/step2_ct.cjs', 'e2e/step2_ct_cts.cjs', 'e2e/step2_deploy.cjs', 'e2e/step2_deploy_verify.cjs',
  'e2e/ct-preflight-probe.cjs', 'e2e/ct-admin-check.cjs', 'e2e/ct-deploy-probe.cjs', 'e2e/ct-env-check.cjs', 'e2e/ct-secrets-check.cjs',
  'e2e/ct-1.json', 'e2e/ct-2.json', 'e2e/ct-3.json', 'e2e/ct-4.json', 'e2e/ct-5.json',
  'e2e/step2-deploy-evidence.json',
]
let bad = 0
for (const f of files) {
  let b; try { b = fs.readFileSync(f, 'utf8') } catch { continue }
  for (const [k, re] of Object.entries(pats)) {
    re.lastIndex = 0
    const m = b.match(re)
    if (m) { console.log('HIT', k.padEnd(12), f); bad++ }
  }
}
console.log('REAL_SECRET_HITS=' + bad)