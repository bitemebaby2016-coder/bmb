// R10 verify (2026-10-27): payment trigger branch (161) + admin_reject_payment (162).
// Evidence → e2e/r10VerifyTriggers-result.json. Run: node e2e/r10VerifyTriggers.cjs
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
;(async () => {
  const result = await q(fs.readFileSync(path.join(__dirname, 'r10VerifyTriggers.sql'), 'utf8'))
  const out = { at: new Date().toISOString(), result }
  fs.writeFileSync(path.join(__dirname, 'r10VerifyTriggers-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
