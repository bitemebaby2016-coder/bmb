// R10 cleanup (Owner 2026-10-27): delete stale sample orders 405/205/337 with children.
// Evidence → e2e/r10Cleanup-result.json. Run from anywhere: node e2e/r10Cleanup.cjs
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
  const before = await q("SELECT count(*) AS n FROM orders WHERE order_number IN ('BMB-20261019-405','BMB-20261022-205','BMB-20261020-337')")
  const sql = fs.readFileSync(path.join(__dirname, 'r10Cleanup.sql'), 'utf8')
  const result = await q(sql)
  const after = await q("SELECT count(*) AS n FROM orders WHERE order_number IN ('BMB-20261019-405','BMB-20261022-205','BMB-20261020-337')")
  const out = { at: new Date().toISOString(), before, result, after }
  fs.writeFileSync(path.join(__dirname, 'r10Cleanup-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
