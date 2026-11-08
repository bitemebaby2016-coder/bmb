// R86 — READ-ONLY: today's orders (identify test rows) + FK constraints referencing
// `orders` (needed for safe hard-delete of test orders). No secrets printed.
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
  // (a) confirm 191 body change in kitchen_queue (COALESCE line)
  const kq = await sql("SELECT (prosrc LIKE '%Asia/Bangkok%') AS bkk FROM pg_proc WHERE proname = 'kitchen_queue'")
  console.log('KITCHEN_QUEUE', kq.status, kq.text.slice(0, 300))
  // (b) every table+column that references an order (builds the hard-delete list)
  const refs = await sql("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('order_number', 'order_id') ORDER BY table_name")
  console.log('REF_TABLES', refs.status, refs.text.slice(0, 2500))
  // (c) test-pattern orders from PREVIOUS days (report only — no delete without ask)
  const old = await sql("SELECT order_number, customer_name, status, (created_at AT TIME ZONE 'Asia/Bangkok')::date AS d FROM public.orders WHERE (created_at AT TIME ZONE 'Asia/Bangkok')::date < '2026-11-08' AND (customer_name LIKE 'R74 Test%' OR customer_name LIKE '%Test Structured%' OR customer_name = 'Social customer' OR customer_name = 'Siam Portal Customer' OR customer_phone LIKE '09900000%') ORDER BY d DESC")
  console.log('OLD_TEST_PATTERN', old.status, old.text.slice(0, 2500))
}
main().catch(e => { console.error('ERR', String(e).slice(0, 300)); process.exit(1) })
