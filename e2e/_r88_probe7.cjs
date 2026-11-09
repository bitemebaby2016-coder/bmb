// R88 PROBE รอบ 7 — READ-ONLY: ต้นตอ D9 (null value in column id) — ดู definition คอลัมน์ id + function จริง
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
  const a = await sql("SELECT column_name, data_type, is_nullable, coalesce(column_default,'-') AS col_default FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name IN ('id','created_at')")
  console.log('ID_COLUMN [' + a.status + '] ' + a.text.slice(0, 800))
  const b = await sql("SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname='submit_verified_review' AND pronamespace='public'::regnamespace")
  console.log('FUNCDEF [' + b.status + ']')
  console.log(b.status >= 200 && b.status < 300 ? b.text : b.text.slice(0, 500))
  console.log('PROBE7_DONE_READONLY')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })