// R10 verify (Contract #177 fix): notify trigger must NEVER block order writes
// (fixture orders without customers row → insert OK, notification skipped silently).
// Evidence → e2e/r10VerifyFkSafe-result.json. Run: node e2e/r10VerifyFkSafe.cjs
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
  const result = await q(fs.readFileSync(path.join(__dirname, 'r10VerifyFkSafe.sql'), 'utf8'))
  const out = { at: new Date().toISOString(), result }
  fs.writeFileSync(path.join(__dirname, 'r10VerifyFkSafe-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
