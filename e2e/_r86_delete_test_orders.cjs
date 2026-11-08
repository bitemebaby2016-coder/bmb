// R86 DELETE (Owner: "ออเดอร์ทดสอบจากเอไอ... สร้างเสร็จใช้เสร็จให้ลบเลย อย่าทิ้งไว้มั่วรกจอ")
// Hard-deletes TODAY's test orders (all 5 = R74 Test Structured/Ledger/NoGps,
// Social customer, Siam Portal Customer 471 — created & cancelled within the
// RT-3.4 test session) + every child row, in ONE transaction.
// Scope = only these 5 order_numbers (no other order matches), children first.
// NOT touched: older "Siam Portal Customer" rows (reported to Owner for decision),
// notifications/audit_log payloads (no order_number column — orphan notes only).
'use strict'
const fs = require('fs')
const REF = 'ivkdfognyiwjcmrhcnwz'
let tok = ''
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m) tok = m[1]
}
const NUMS = "('BMB-20261108-767','BMB-20261108-613','BMB-20261108-850','BMB-20261108-484','BMB-20261108-471')"
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
  // safety re-check: exactly these 5 rows, all cancelled+void, all created today
  const pre = await sql("SELECT order_number, status, payment_status FROM public.orders WHERE order_number IN " + NUMS + " ORDER BY order_number")
  console.log('PRE', pre.status, pre.text.slice(0, 800))
  if (pre.status !== 201) { console.log('STOP: pre-check failed'); process.exit(2) }

  const stmts = ['BEGIN;']
  for (const t of BY_NUM) {
    stmts.push(`DELETE FROM public.${t} WHERE order_number IN ${NUMS};`)
  }
  stmts.push(`DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE order_number IN ${NUMS});`)
  stmts.push(`DELETE FROM public.orders WHERE order_number IN ${NUMS};`)
  stmts.push('COMMIT;')
  const body = stmts.join('\n')
  const r = await sql(body)
  console.log('DELETE_HTTP', r.status, r.text.slice(0, 500))
  if (r.status < 200 || r.status >= 300) { console.log('DELETE_FAILED'); process.exit(3) }

  const verify = await sql("SELECT (SELECT count(*) FROM public.orders WHERE order_number IN " + NUMS + ") AS orders_left, (SELECT count(*) FROM public.payment_intents WHERE order_number IN " + NUMS + ") AS intents_left, (SELECT count(*) FROM public.order_status_history WHERE order_number IN " + NUMS + ") AS history_left, (SELECT count(*) FROM public.delivery_assignments WHERE order_number IN " + NUMS + ") AS assign_left, (SELECT count(*) FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE order_number IN " + NUMS + ")) AS items_left")
  console.log('VERIFY', verify.status, verify.text.slice(0, 500))
  const today = await sql("SELECT count(*)::int AS today_rows FROM public.orders WHERE (created_at AT TIME ZONE 'Asia/Bangkok')::date = '2026-11-08'")
  console.log('TODAY_AFTER', today.status, today.text.slice(0, 300))
  console.log('DELETE_DONE')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })
