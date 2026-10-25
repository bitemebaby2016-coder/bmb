// R12 (2026-10-25) — production apply รอบ Owner approvals: 150 (parity) + 151 (HISTORICAL_BASELINE)
//   + 152 (REVOKE EXECUTE menu_schedule RPCs จาก PUBLIC/anon — contract 039-G7)
//   Owner approvals (2026-10-25): "Authorize migration 150 apply production อนุมัติ" ·
//   "เลือก 151: (ก) APPLY HISTORICAL_BASELINE" · "Sign-off migration REVOKE ใหม่ (039-G7 อนุมัติ"
//   รูปแบบ staged = r8Apply148 (precheck → apply → verify → record · evidence = JSON ต่อ stage)
// STAGES: precheck → apply150 → verify150 → apply151 → verify151 → apply152 → verify152
//   → contract039 → record
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
const stage = process.argv[2] || 'precheck'
const results = []
const log = (label, r) => {
  const parsed = (() => { try { return JSON.parse(r.body) } catch { return String(r.body).slice(0, 800) } })()
  results.push({ label, status: r.status, data: parsed })
  console.log(`[${label}] status=${r.status} ${JSON.stringify(parsed).slice(0, 400)}`)
}
const save = () => fs.writeFileSync(`e2e/r12Apply150_152-${stage}.json`, JSON.stringify(results, null, 2))
;(async () => {
  if (stage === 'precheck') {
    log('history', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'))
    log('backup-recency', await q("SELECT count(*) AS recent_backups FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
    log('150-col-present-prod', await q("SELECT count(*) AS has_col FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_address'"))
    log('osh-table', await q("SELECT count(*) AS has_table FROM information_schema.tables WHERE table_schema='public' AND table_name='order_status_history'"))
    log('151-orders-without-history', await q("SELECT count(*) AS n FROM public.orders o WHERE NOT EXISTS (SELECT 1 FROM public.order_status_history h WHERE h.order_number = o.order_number)"))
    log('151-backfill-existing', await q("SELECT count(*) AS n FROM public.order_status_history WHERE metadata->>'backfill' = 'true'"))
    log('152-anon-before', await q("SELECT has_function_privilege('anon', 'public.set_menu_schedule(date, jsonb)', 'EXECUTE') AS anon_can_set, has_function_privilege('anon', 'public.publish_menu_schedule(date, boolean)', 'EXECUTE') AS anon_can_publish, has_function_privilege('authenticated', 'public.set_menu_schedule(date, jsonb)', 'EXECUTE') AS auth_can_set"))
  } else if (stage === 'apply150') {
    log('apply-150', await q(fs.readFileSync('supabase/migrations/150_orders_delivery_address_parity.sql', 'utf8')))
    log('apply-150-idempotent-rerun', await q(fs.readFileSync('supabase/migrations/150_orders_delivery_address_parity.sql', 'utf8')))
  } else if (stage === 'verify150') {
    log('col+default', await q("SELECT column_name, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_address'"))
    log('col-comment', await q("SELECT (SELECT col_description('public.orders'::regclass, ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_address') AS col_comment"))
    log('row-count-untouched', await q('SELECT count(*) AS orders FROM public.orders'))
  } else if (stage === 'apply151') {
    log('apply-151', await q(fs.readFileSync('supabase/migrations/151_order_status_history_baseline.sql', 'utf8')))
    log('apply-151-idempotent-rerun', await q(fs.readFileSync('supabase/migrations/151_order_status_history_baseline.sql', 'utf8')))
  } else if (stage === 'verify151') {
    log('orders-without-history-now', await q("SELECT count(*) AS n FROM public.orders o WHERE NOT EXISTS (SELECT 1 FROM public.order_status_history h WHERE h.order_number = o.order_number)"))
    log('backfill-rows', await q("SELECT count(*) AS n FROM public.order_status_history WHERE metadata->>'backfill' = 'true'"))
    log('baseline-shape-sample', await q("SELECT order_number, from_status, to_status, actor_type FROM public.order_status_history WHERE metadata->>'backfill' = 'true' ORDER BY order_number LIMIT 3"))
    log('non-baseline-untouched', await q("SELECT count(*) AS non_baseline_rows FROM public.order_status_history WHERE metadata->>'backfill' IS DISTINCT FROM 'true'"))
  } else if (stage === 'apply152') {
    log('apply-152', await q(fs.readFileSync('supabase/migrations/152_menu_schedule_execute_revoke.sql', 'utf8')))
    log('apply-152-idempotent-rerun', await q(fs.readFileSync('supabase/migrations/152_menu_schedule_execute_revoke.sql', 'utf8')))
  } else if (stage === 'verify152') {
    log('privileges-after', await q("SELECT has_function_privilege('anon', 'public.set_menu_schedule(date, jsonb)', 'EXECUTE') AS anon_can_set, has_function_privilege('anon', 'public.publish_menu_schedule(date, boolean)', 'EXECUTE') AS anon_can_publish, has_function_privilege('authenticated', 'public.set_menu_schedule(date, jsonb)', 'EXECUTE') AS auth_can_set, has_function_privilege('authenticated', 'public.publish_menu_schedule(date, boolean)', 'EXECUTE') AS auth_can_publish, has_function_privilege('authenticated', 'public.get_menu_for_date(date)', 'EXECUTE') AS auth_can_get_menu"))
  } else if (stage === 'contract039') {
    // ROLLBACK ทั้งไฟล์ — fixture ใน txn (evidence; error อยู่ใน data)
    log('contract-039-g7', await q(fs.readFileSync('e2e/contracts_039_menu_schedule.sql', 'utf8')))
  } else if (stage === 'record') {
    log('record-150', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('150','150_orders_delivery_address_parity','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('record-151', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('151','151_order_status_history_baseline','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('record-152', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('152','152_menu_schedule_execute_revoke','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5'))
  } else {
    console.log('unknown stage'); process.exit(1)
  }
  save()
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })