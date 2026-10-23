// R5 (2026-10-23) — production apply for migration 141
// (PRE_ORDER universal products + menu-calendar binding + archived rows).
// Owner approved 2026-10-23: "apply ทั้ง migration + commit/push +
//   รันรายการทดสอบฝั่ง server ในโปรดักชั่นให้ครบก่อนส่งมอบ"
// Local gates green first: vitest 1344 + tsc + lint + secret scan.
//
// STAGES:
//   node e2e/r5Apply141.cjs precheck  // RO: history + gate lines present + backups recency
//   node e2e/r5Apply141.cjs apply     // apply 141 (BEGIN...COMMIT single block)
//   node e2e/r5Apply141.cjs verify    // RO: gate line gone + new enforce_menu_gate + grants
//   node e2e/r5Apply141.cjs contract  // e2e/contracts_141.sql (BEGIN...ROLLBACK — zero persisted)
//   node e2e/r5Apply141.cjs record    // ledger schema_migrations 141
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
  results.push({ label, status: r.status, body: (() => { try { return JSON.parse(r.body) } catch { return r.body.slice(0, 800) } })() })
  console.log(`[${label}] status=${r.status}`)
}
const save = () => fs.writeFileSync(`e2e/r5Apply141-${stage}.json`, JSON.stringify(results, null, 2))
;(async () => {
  if (stage === 'precheck') {
    log('history', await q("SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4"))
    log('gate-line-must-still-exist', await q("SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='create_order_with_items' AND p.prosrc LIKE '%PRE_ORDER'' AND NOT COALESCE(v_prod_preorder%'"))
    log('menu-gate-old-shape', await q("SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='enforce_menu_gate' AND p.prosrc LIKE '%every product must be on%'"))
    log('backup-recency', await q("SELECT count(*) AS recent_backups FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
  } else if (stage === 'apply') {
    log('apply-141', await q(fs.readFileSync('supabase/migrations/141_pre_order_unify_menu_calendar.sql', 'utf8')))
  } else if (stage === 'verify') {
    log('gate-line-must-be-gone', await q("SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='create_order_with_items' AND p.prosrc LIKE '%PRE_ORDER'' AND NOT COALESCE(v_prod_preorder%'"))
    log('menu-gate-new-shape', await q("SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='enforce_menu_gate' AND p.prosrc LIKE '%archived = ไม่ผูกมัด%'"))
    log('func-def', await q("SELECT p.proname, p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('create_order_with_items','enforce_menu_gate') ORDER BY 1"))
    log('grants-menu-gate', await q("SELECT grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name='enforce_menu_gate' ORDER BY 1"))
  } else if (stage === 'contract') {
    log('contract-141', await q(fs.readFileSync('e2e/contracts_141.sql', 'utf8')))
  } else if (stage === 'record') {
    log('record-141', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('141','141_pre_order_unify_menu_calendar','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q("SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3"))
  } else {
    console.log('unknown stage'); process.exit(1)
  }
  save()
  const bad = results.filter((r) => r.status >= 400)
  console.log(bad.length ? 'STAGE_FAILED' : 'STAGE_OK', JSON.stringify(results, null, 2).slice(0, 1500))
  process.exit(bad.length ? 1 : 0)
})()