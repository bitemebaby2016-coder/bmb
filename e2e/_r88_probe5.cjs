// R88 PROBE รอบ 5 — READ-ONLY: เจาะ quals ของ policy reviews เก่า 4 ตัวที่โผล่ตอน verify m199
// (RLS PERMISSIVE = OR กัน → ตัวเก่าที่หละหลวมจะ bypass moderation ได้)
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
}
async function main() {
  await q('LEGACY_POLICIES', "SELECT policyname, cmd, coalesce(qual,'-') AS qual, coalesce(with_check,'-') AS with_check FROM pg_policies WHERE schemaname='public' AND tablename='reviews' ORDER BY policyname")
  await q('SUBMIT_DELIVERED_GUARD', "SELECT (prosrc LIKE '%ERR_REVIEW_ORDER_NOT_DELIVERED%') AS delivered_guard_kept FROM pg_proc WHERE proname='submit_verified_review'")
  console.log('PROBE5_DONE_READONLY')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })