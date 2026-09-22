// ============================================
// Bite Me Baby — Production contract-suite runner (Management API, ONE query per suite)
// ============================================
// Each contracts_*.sql is a single BEGIN...ROLLBACK transaction designed to run as
// OWNER: success = HTTP 2xx (no gate raised), failure = 4xx/5xx carrying the
// FAIL label. Zero persisted data either way.
//
// Usage: node e2e/prodRunContracts.cjs [file1 file2 ...]
//        (default: contracts_023 + contracts_028 + contracts_029 + contracts_030)
// Token: $env:SUPABASE_ACCESS_TOKEN, or supabase.temp/at.local (gitignored *.local)
// Evidence: e2e/prod-contracts-result.json
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const REF = process.env.SUPABASE_PROJECT_REF || 'ivkdfognyiwjcmrhcnwz'
let TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
if (!TOKEN) {
  const p = path.join(PROJ, 'supabase.temp', 'at.local')
  if (fs.existsSync(p)) TOKEN = fs.readFileSync(p, 'utf8').trim()
}
if (!TOKEN) { console.log('XMARK no SUPABASE_ACCESS_TOKEN (env or supabase.temp/at.local)'); process.exit(2) }

const DEFAULT = [
  'e2e/contracts_023_order_spine.sql',
  'e2e/contracts_028_payment_confirmation_kitchen.sql',
  'e2e/contracts_029_round_grant.sql',
  'e2e/contracts_030_transition_else.sql',
]
const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT

function sanitize(sql) {
  return sql.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\u0000/g, '')
}

;(async () => {
  const out = []
  let ok = 0
  for (const f of files) {
    const full = path.join(PROJ, f)
    const sql = sanitize(fs.readFileSync(full, 'utf8'))
    try {
      const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      })
      const body = await r.text()
      const pass = r.ok
      if (pass) ok++
      console.log((pass ? 'check PASS ' : 'XMARK FAIL ') + f + ' (http ' + r.status + ')' + (pass ? '' : ' :: ' + body.slice(0, 320)))
      out.push({ file: f, ok: pass, status: r.status, detail: pass ? null : body.slice(0, 500) })
    } catch (e) {
      console.log('XMARK FAIL ' + f + ' :: ' + String(e).slice(0, 200))
      out.push({ file: f, ok: false, detail: String(e).slice(0, 300) })
    }
  }
  const pass = ok === out.length && out.length > 0
  fs.writeFileSync(path.join(PROJ, 'e2e', 'prod-contracts-result.json'), JSON.stringify({ timestamp: new Date().toISOString(), ref: REF, checks: out, pass }, null, 2), 'utf8')
  console.log('\nPROD-CONTRACTS ' + ok + '/' + out.length + ' passed (pass=' + pass + ') → e2e/prod-contracts-result.json')
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exit(1) })