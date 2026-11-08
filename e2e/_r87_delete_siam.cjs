// R87 DELETE (Owner ยืนยัน: "ทั้งหมด — ... เป็นของจริงที่ทดสอบเอง" → ลบได้ทั้งหมด)
// Hard-deletes EVERY 'Siam Portal Customer' order (10+ rows 2026-10-27 → 11-07,
// incl. 2 active ready_for_dispatch) + child rows, in ONE transaction.
// Children by order_number (same 18-table set as R86) + order_items by order_id.
'use strict'
const fs = require('fs')
const REF = 'ivkdfognyiwjcmrhcnwz'
let tok = ''
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m) tok = m[1]
}
const WHERE = "(customer_name = 'Siam Portal Customer')"
const BY_NUM = ['delivery_assignments', 'dispatch_offers', 'driver_location_history',
  'order_status_history', 'provider_orders', 'order_messages', 'order_submissions',
  'payment_intents', 'pre_orders', 'print_jobs', 'production_batch_items', 'reviews',
  'social_events', 'track_order_attempts', 'points_ledger', 'affiliate_attributions',
  'referral_attributions']

async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, text: await r.text() }
}

async function main() {
  const pre = await sql("SELECT count(*)::int AS n, count(*) FILTER (WHERE status NOT IN ('cancelled'))::int AS non_cancelled FROM public.orders WHERE " + WHERE)
  console.log('PRE', pre.status, pre.text.slice(0, 300))
  const preJ = JSON.parse(pre.text)[0]
  if (!preJ || !preJ.n) { console.log('NOTHING_TO_DELETE'); process.exit(0) }

  const stmts = ['BEGIN;']
  for (const t of BY_NUM) stmts.push(`DELETE FROM public.${t} WHERE order_number IN (SELECT order_number FROM public.orders WHERE ${WHERE});`)
  stmts.push(`DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE ${WHERE});`)
  stmts.push(`DELETE FROM public.orders WHERE ${WHERE};`)
  stmts.push('COMMIT;')
  const r = await sql(stmts.join('\n'))
  console.log('DELETE_HTTP', r.status, r.text.slice(0, 400))
  if (r.status < 200 || r.status >= 300) { console.log('DELETE_FAILED'); process.exit(3) }

  const post = await sql("SELECT (SELECT count(*)::int FROM public.orders WHERE " + WHERE + ") AS orders_left, (SELECT count(*)::int FROM public.delivery_assignments WHERE order_number NOT IN (SELECT order_number FROM public.orders) AND status IN ('assigned','accepted','picked_up','in_transit','arrived')) AS orphan_pending")
  console.log('POST', post.status, post.text.slice(0, 400))
  console.log('DELETE_DONE — deleted ' + preJ.n + ' orders (' + preJ.non_cancelled + ' were not cancelled)')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })
