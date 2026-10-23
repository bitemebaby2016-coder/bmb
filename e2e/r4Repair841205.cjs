// R4 — REVERSIBLE data repair for payment_intents 841/205 (Owner APPROVED 2026-10-23)
// Plan: docs/BMB_R3_ENGINEERING_CLOSURE_2026-10-23.md §5
//   mode 'snapshot' → SELECT before-state (undo evidence)
//   mode 'repair'   → UPDATE processing→failed for the two orders ONLY (status-guarded)
//   mode 'verify'   → post-checks (dup pairs, paid-not-completed, order rows intact)
// Safety: WHERE status='processing' guards the exact stale rows; undo =
//   UPDATE ... SET status='processing', updated_at=<from snapshot> WHERE id IN (...)
const fs = require('fs')
const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
if (!token) { console.log('NO_ACCESS_TOKEN'); process.exit(1) }
const REF = 'ivkdfognyiwjcmrhcnwz'
const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, body: await r.text() }
}
const ORDERS = "'BMB-20261023-841','BMB-20261022-205'"
const mode = process.argv[2] || 'snapshot'
const results = []
const log = (label, r) => {
  results.push({ label, status: r.status, body: (() => { try { return JSON.parse(r.body) } catch { return r.body.slice(0, 1200) } })() })
  console.log(`[${label}] status=${r.status}`)
}
;(async () => {
  if (mode === 'snapshot') {
    log('before-rows', await q(`SELECT id, order_number, amount, status, method, failure_reason, created_at, updated_at FROM public.payment_intents WHERE order_number IN (${ORDERS}) ORDER BY order_number, created_at`))
  } else if (mode === 'repair') {
    log('repair-update', await q(`UPDATE public.payment_intents SET status = 'failed', failure_reason = 'superseded-duplicate (R4 repair, Owner approved 2026-10-23)', updated_at = now() WHERE order_number IN (${ORDERS}) AND status = 'processing' RETURNING id, order_number, status`))
  } else if (mode === 'verify') {
    log('after-rows', await q(`SELECT id, order_number, status, failure_reason, updated_at FROM public.payment_intents WHERE order_number IN (${ORDERS}) ORDER BY order_number, created_at`))
    log('active-dup-pairs', await q("SELECT order_number, method, string_agg(status, '+') FROM public.payment_intents WHERE status IN ('pending','processing') GROUP BY 1,2 HAVING count(*) > 1"))
    log('paid-not-completed', await q("SELECT o.order_number FROM public.orders o LEFT JOIN public.payment_intents pi ON pi.order_number = o.order_number AND pi.status = 'completed' WHERE o.payment_status = 'paid' AND pi.id IS NULL LIMIT 10"))
    log('orders-841-205', await q(`SELECT order_number, status, payment_status, total_amount FROM public.orders WHERE order_number IN (${ORDERS})`))
    log('pi-status-counts', await q("SELECT status, count(*) FROM public.payment_intents GROUP BY 1 ORDER BY 1"))
  } else {
    console.log('UNKNOWN_MODE'); process.exit(1)
  }
  fs.writeFileSync(`e2e/artifacts/r4-repair-${mode}.json`, JSON.stringify({ mode, ran_at: new Date().toISOString(), results }, null, 2))
  console.log('MODE_DONE ' + mode)
})().catch((e) => { console.log('REPAIR_ERR ' + e.message); process.exit(1) })