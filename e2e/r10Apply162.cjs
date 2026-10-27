// R10 apply 162 (Owner 2026-10-27): admin manual payment rejection RPC.
// Evidence → e2e/r10Apply162-result.json. Run: node e2e/r10Apply162.cjs
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
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '162_admin_reject_payment.sql'), 'utf8')
  const apply = await q(sql)
  const verify = await q("SELECT count(*) AS fn FROM pg_proc WHERE proname = 'admin_reject_payment'")
  const out = { at: new Date().toISOString(), apply, verify }
  fs.writeFileSync(path.join(__dirname, 'r10Apply162-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
