'use strict'
// _r67_e2e_run — load service key from supabase/secrets.local.env (never printed),
// set BMB_E2E_SVC_KEY, then run e2e/runE2E.cjs (real E2E matrix · Owner-approved run).
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', 'supabase', 'secrets.local.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    const val = m[2].replace(/^["']|["']$/g, '')
    if (m[1] === 'SUPABASE_SERVICE_ROLE_KEY' && !process.env.BMB_E2E_SVC_KEY) {
      process.env.BMB_E2E_SVC_KEY = val
    }
    if (!process.env[m[1]]) process.env[m[1]] = val
  }
}
if (!process.env.BMB_E2E_SVC_KEY) {
  console.error('FATAL: no BMB_E2E_SVC_KEY / SUPABASE_SERVICE_ROLE_KEY available')
  process.exit(2)
}
console.log('SVC_KEY_LOADED len=' + process.env.BMB_E2E_SVC_KEY.length)
require('./runE2E.cjs')
