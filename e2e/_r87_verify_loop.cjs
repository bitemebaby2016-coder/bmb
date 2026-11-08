// R87b — READ-ONLY: live prosrc of driver_update_delivery_status must be BOUNDED
// (WHILE v_hop_from <> v_target) — verifies the R87b fix landed in production.
'use strict'
const fs = require('fs')
const REF = 'ivkdfognyiwjcmrhcnwz'
let tok = ''
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m) tok = m[1]
}
async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, text: await r.text() }
}
async function main() {
  const v = await sql("SELECT (prosrc LIKE '%WHILE v_hop_from <> v_target LOOP%') AS bounded_loop, (prosrc LIKE '%o.status NOT IN%') AS live_guard FROM pg_proc WHERE proname = 'driver_update_delivery_status'")
  console.log('LIVE_FN', v.status, v.text.slice(0, 400))
}
main().catch(e => { console.error('ERR', String(e).slice(0, 300)); process.exit(1) })
