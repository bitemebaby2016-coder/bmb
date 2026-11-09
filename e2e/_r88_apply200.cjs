// R88 APPLY m200 (Owner อนุมัติ 2026-11-08 ~22:45) — D9: reviews.id default
// ยิงไฟล์ทั้งหมดทีเดียว (atomic) + บันทึก history 200 + VERIFY → e2e/_r88_apply200.log
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
async function q(label, query) {
  const r = await sql(query)
  console.log('== ' + label + ' [' + r.status + ']')
  console.log(r.status >= 200 && r.status < 300 ? r.text : r.text.slice(0, 600))
  return r.status >= 200 && r.status < 300
}

async function main() {
  const body = fs.readFileSync('supabase/migrations/200_reviews_id_default.sql', 'utf8')
  const applied = await sql(body)
  const ok = applied.status >= 200 && applied.status < 300
  console.log('APPLY [' + applied.status + '] ' + (ok ? 'OK' : applied.text.slice(0, 800)))
  if (!ok) { console.log('STOPPED_AT_APPLY'); process.exit(10) }

  const rec = await sql("INSERT INTO supabase_migrations.schema_migrations (version, statements, name) SELECT '200', NULL, '200_reviews_id_default.sql' WHERE NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations m WHERE m.version = '200') RETURNING version")
  console.log('HISTORY [' + rec.status + '] ' + rec.text.slice(0, 200))

  const v1 = await q('VERIFY_ID_DEFAULT', "SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='id'")
  const v2 = await q('VERIFY_SUBMIT_UNCHANGED', "SELECT (prosrc LIKE '%ERR_REVIEW_ORDER_NOT_DELIVERED%') AS delivered_kept, (prosrc LIKE '%ERR_REVIEW_ALREADY_EXISTS%') AS dedupe_kept, (prosrc LIKE '%pending%') AS pending_kept FROM pg_proc WHERE proname='submit_verified_review'")
  const v3 = await q('VERIFY_HISTORY', "SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '199' ORDER BY version")
  const pass = v1 && v2 && v3
  console.log(pass ? 'APPLY200_DONE_VERIFY_ALL_OK' : 'APPLY200_DONE_VERIFY_SOMETHING_WRONG')
  process.exit(pass ? 0 : 3)
}
main().catch(e => { console.error('ERR', String(e).slice(0, 500)); process.exit(1) })