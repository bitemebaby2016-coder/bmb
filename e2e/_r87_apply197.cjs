// R87 APPLY (Owner: "งานเพิ่ม" + rider fix) — migrations 197 (rider) + 198 (review rules)
// on PRODUCTION. Whole-file single query (proven atomic in R86) → record history → verify.
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

async function runFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  console.log('=== ' + file + ' ===')
  const r = await sql(text)
  console.log('  HTTP ' + r.status + (r.status >= 200 && r.status < 300 ? ' OK' : ' FAIL | ' + r.text.slice(0, 500)))
  return r.status >= 200 && r.status < 300
}

async function main() {
  for (const f of ['supabase/migrations/197_rider_available_after_loop.sql', 'supabase/migrations/198_review_verified_rules.sql']) {
    if (!await runFile(f)) { console.log('STOPPED_AT ' + f); process.exit(10) }
  }
  const rec = await sql("INSERT INTO supabase_migrations.schema_migrations (version, statements, name) SELECT v, NULL, CASE v WHEN '197' THEN '197_rider_available_after_loop.sql' ELSE '198_review_verified_rules.sql' END FROM (VALUES ('197'), ('198')) AS t(v) WHERE NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations m WHERE m.version = t.v) RETURNING version")
  console.log('HISTORY', rec.status, rec.text.slice(0, 300))

  // VERIFY: guard has live-order condition + review fn has delivered + dup guard + backfill results
  const v1 = await sql("SELECT (prosrc LIKE '%o.status NOT IN%') AS guard_live_orders FROM pg_proc WHERE proname = 'driver_update_delivery_status'")
  console.log('VERIFY_FN', v1.status, v1.text.slice(0, 300))
  const v2 = await sql("SELECT (prosrc LIKE '%ERR_REVIEW_ORDER_NOT_DELIVERED%') AS delivered_required, (prosrc LIKE '%ERR_REVIEW_ALREADY_EXISTS%') AS dup_guard FROM pg_proc WHERE proname = 'submit_verified_review'")
  console.log('VERIFY_REVIEW', v2.status, v2.text.slice(0, 300))
  const v3 = await sql("SELECT (SELECT count(*)::int FROM delivery_assignments WHERE status IN ('assigned','accepted','picked_up','in_transit','arrived') AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_number = delivery_assignments.order_number AND o.status NOT IN ('cancelled','failed','delivered'))) AS stale_assignments, (SELECT count(*)::int FROM drivers WHERE status = 'busy') AS busy_drivers, (SELECT count(*)::int FROM drivers) AS total_drivers")
  console.log('VERIFY_BACKFILL', v3.status, v3.text.slice(0, 400))
  const hist = await sql("SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '196' ORDER BY version")
  console.log('HISTORY_ALL', hist.status, hist.text.slice(0, 400))
  console.log('APPLY_DONE')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })
