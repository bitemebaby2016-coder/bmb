// R88 PROBE รอบ 3 — READ-ONLY: policy SELECT ของ reviews (แก้คอลัมน์ tablename) +
// ยืนยัน hooks ระบบแต้ม (loyalty_order_hook) + ตาราง loyalty_points
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
  console.log(r.status === 200 ? r.text : r.text.slice(0, 400))
}
async function main() {
  await q('REVIEWS_POLICIES_COMPACT', "SELECT policyname, cmd, coalesce(qual, '-') AS qual FROM pg_policies WHERE schemaname='public' AND tablename='reviews' ORDER BY policyname")
  await q('REVIEWS_POLICIES', "SELECT tablename, policyname, cmd, roles::text AS roles, qual FROM pg_policies WHERE schemaname='public' AND tablename='reviews' ORDER BY policyname")
  await q('HOOKS', "SELECT p.proname, EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgfoid = p.oid AND NOT t.tgisinternal) AS has_trigger FROM pg_proc p WHERE p.proname IN ('loyalty_order_hook','loyalty_payment_intent_hook','affiliate_order_hook') ORDER BY 1")
  await q('TRIGGERS', "SELECT tgname, tgrelid::regclass::text AS rel FROM pg_trigger WHERE NOT tgisinternal AND tgname ILIKE '%loyalty%' ORDER BY 1")
  await q('LOYALTY_POINTS_COLS', "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='loyalty_points' ORDER BY ordinal_position")
  await q('LEDGER_SAMPLE', "SELECT entry_type, points, left(coalesce(order_id,''),20) AS order_id, created_at FROM points_ledger ORDER BY created_at DESC LIMIT 4")
  console.log('PROBE3_DONE_READONLY')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })
