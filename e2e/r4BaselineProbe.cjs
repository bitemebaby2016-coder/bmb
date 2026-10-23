// R3 Phase 0/1 — READ-ONLY production baseline probe (whole-project closure).
// NEVER writes. Stages: baseline | money | rounds | ops
// Secrets: SUPABASE_ACCESS_TOKEN read from .env.local, never printed.
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
const stage = process.argv[2] || 'baseline'
const results = []
const log = (label, r) => {
  results.push({ label, status: r.status, body: (() => { try { return JSON.parse(r.body) } catch { return r.body.slice(0, 1200) } })() })
  console.log(`[${label}] status=${r.status}`)
}
;(async () => {
  if (stage === 'baseline') {
    log('history', await q("SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5"))
    log('tables', await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ~ 'coupon|promotion|delivery_round|inventory|stock|expense|finance|recipe|print|pos|batch' ORDER BY 1"))
    log('rpcs', await q("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef ORDER BY 1"))
    log('storage-buckets', await q("SELECT id, public FROM storage.buckets ORDER BY id"))
  } else if (stage === 'money') {
    log('pi-status-counts', await q("SELECT status, count(*) FROM public.payment_intents GROUP BY 1 ORDER BY 1"))
    log('pi-any-dup-pairs', await q("SELECT order_number, method, string_agg(status, '+' ORDER BY created_at) statuses, count(*) FROM public.payment_intents GROUP BY 1,2 HAVING count(*) > 1 ORDER BY 3 DESC LIMIT 20"))
    log('pi-841-205', await q("SELECT id, order_number, amount, status, method, provider, slip_path IS NOT NULL AS has_slip, created_at, updated_at FROM public.payment_intents WHERE order_number IN ('BMB-20261023-841','BMB-20261023-205') ORDER BY order_number, created_at"))
    log('orders-pay-matrix', await q("SELECT order_mode, payment_status, count(*) FROM public.orders GROUP BY 1,2 ORDER BY 1,2"))
    log('paid-not-completed', await q("SELECT o.order_number, o.payment_status, o.payment_method, string_agg(pi.status, '+') FROM public.orders o LEFT JOIN public.payment_intents pi ON pi.order_number=o.order_number WHERE o.payment_status='paid' GROUP BY 1,2,3 HAVING count(pi.id) FILTER (WHERE pi.status='completed') = 0 LIMIT 10"))
  } else if (stage === 'rounds') {
    log('rounds-cols', await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_rounds' ORDER BY ordinal_position"))
    log('rounds-20-30', await q("SELECT * FROM public.delivery_rounds ORDER BY 1 DESC LIMIT 12"))
    log('round-audit', await q("SELECT action, entity_type, entity_id, description, metadata, created_at FROM public.audit_logs WHERE entity_type ILIKE '%round%' OR description ILIKE '%round%' ORDER BY created_at DESC LIMIT 15"))
    log('orders-by-round', await q("SELECT delivery_round_id, order_mode, status, count(*) FROM public.orders GROUP BY 1,2,3 ORDER BY 1 DESC NULLS LAST LIMIT 20"))
  } else if (stage === 'ops') {
    log('coupon-state', await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%coupon%' OR table_name ILIKE '%promo%')"))
    log('inventory-tables', await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%invent%' OR table_name ILIKE '%stock%' OR table_name ILIKE '%ingredient%' OR table_name ILIKE '%recipe%')"))
    log('finance-tables', await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%expense%' OR table_name ILIKE '%finance%' OR table_name ILIKE '%ledger%')"))
    log('automation-queue', await q("SELECT status, count(*) FROM public.automation_queue GROUP BY 1"))
    log('pod-objects', await q("SELECT count(*) FROM storage.objects WHERE bucket_id='pod-photos'"))
    log('backup-objects', await q("SELECT name, created_at FROM storage.objects WHERE bucket_id='db-backups' ORDER BY created_at DESC LIMIT 3"))
  } else if (stage === 'investigate') {
    log('automation-jobs', await q("SELECT job_type, status, count(*) FROM public.automation_queue GROUP BY 1,2 ORDER BY 1,2"))
    log('automation-recent', await q("SELECT id, job_type, status, created_at, completed_at FROM public.automation_queue ORDER BY created_at DESC LIMIT 8"))
    log('system-errors', await q("SELECT created_at, left(error_message, 100) AS msg FROM public.system_errors ORDER BY created_at DESC LIMIT 5"))
    log('round-updates-today', await q("SELECT id, status, current_count, created_at, updated_at FROM public.delivery_rounds WHERE updated_at > created_at ORDER BY updated_at DESC LIMIT 10"))
    log('orders-today', await q("SELECT order_number, order_mode, status, payment_status, delivery_round_id, created_at FROM public.orders ORDER BY created_at DESC LIMIT 8"))
  } else {
    console.log('UNKNOWN_STAGE'); process.exit(1)
  }
  fs.writeFileSync(`e2e/artifacts/r4-probe-${stage}.json`, JSON.stringify({ stage, ran_at: new Date().toISOString(), results }, null, 2))
  console.log('STAGE_DONE ' + stage)
})().catch((e) => { console.log('PROBE_ERR ' + e.message); process.exit(1) })