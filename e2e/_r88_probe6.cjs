// R88 PROBE รอบ 6 — READ-ONLY: ชื่อ/จำนวน/ค่า default ของ parameters ทั้ง 2 RPC (แก้ D7 แบบไม่เดา)
'use strict'
const fs = require('fs')
const REF = 'ivkdfognyiwjcmrhcnwz'
let tok = ''
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m) tok = m[1]
}
if (!tok) { console.error('STOP: no SUPABASE_ACCESS_TOKEN'); process.exit(2) }
async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, text: await r.text() }
}
async function main() {
  const r = await sql("SELECT proname, pronargs::int AS nargs, proargnames::text AS argnames, pg_get_function_arguments(oid) AS signature FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('submit_verified_review', 'get_verified_reviews_batch') ORDER BY proname, pronargs")
  console.log('RPC_ARGS [' + r.status + ']')
  console.log(r.status >= 200 && r.status < 300 ? r.text : r.text.slice(0, 600))
  const r2 = await sql("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='branch_id'")
  console.log('BRANCH_NULLABLE [' + r2.status + '] ' + r2.text.slice(0, 300))
  console.log('PROBE6_DONE_READONLY')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })