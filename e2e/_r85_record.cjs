// R85 record — manual apply (Management API) does NOT write supabase_migrations
// history rows, so record 194/195 explicitly (they ARE applied — verified).
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
  const ins = await sql("INSERT INTO supabase_migrations.schema_migrations (version, statements, name) SELECT v, NULL, v || '_' || CASE v WHEN '194' THEN 'payment_status_void_enum.sql' ELSE 'close_payment_on_cancel.sql' END FROM (VALUES ('194'), ('195')) AS t(v) WHERE NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations m WHERE m.version = t.v) RETURNING version, name")
  console.log('INSERT', ins.status, ins.text.slice(0, 500))
  const verify = await sql("SELECT version, name FROM supabase_migrations.schema_migrations WHERE version IN ('194','195') ORDER BY version")
  console.log('VERIFY', verify.status, verify.text.slice(0, 500))
}
main().catch(e => { console.error('ERR', String(e).slice(0, 300)); process.exit(1) })
