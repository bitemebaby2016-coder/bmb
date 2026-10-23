// R3 (2026-10-23) — production apply for migrations 138 (payment read authority)
// + 139 (POD policies trusted helper). Same mechanism as prod-apply-136 (Management
// API /database/query). Owner approval: "ถ้าผ่านจริง อนุมัติ apply migration และ
// คอมมิทพุชเลย" — local gates all green before this runs.
//
// STAGES (run one at a time):
//   node e2e/r3Apply138139.cjs precheck   // READ-ONLY: history + ACTIVE dupes + current defs
//   node e2e/r3Apply138139.cjs apply      // apply 138 then 139 (each file is BEGIN..COMMIT)
//   node e2e/r3Apply138139.cjs verify     // READ-ONLY: objects/grants/policies/index
//   node e2e/r3Apply138139.cjs record     // ledger schema_migrations 138/139 (text[] statements)
//
// Secrets: SUPABASE_ACCESS_TOKEN is read from .env.local and NEVER printed.
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

;(async () => {
  if (stage === 'precheck') {
    log('history', await q("SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 8"))
    log('rpc-present-must-be-empty', await q("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_payment_intents_for_orders','current_driver_id','pod_path_is_driver')"))
    log('active-dupes-must-be-empty', await q("SELECT order_number, method, count(*) FROM public.payment_intents WHERE status IN ('pending','processing') GROUP BY 1,2 HAVING count(*) > 1"))
    log('confirm-source-has-old-pick', await q("SELECT position('ORDER BY (status' in prosrc) > 0 AS has_new_pick FROM pg_proc WHERE proname='confirm_offline_payment'"))
    log('pod-objects', await q("SELECT count(*) AS pod_objects FROM storage.objects WHERE bucket_id='pod-photos'"))
    log('backup-recency', await q("SELECT max(created_at) AS latest_backup FROM storage.objects WHERE bucket_id='db-backups'"))
  } else if (stage === 'apply') {
    const sql138 = fs.readFileSync('supabase/migrations/138_payment_intents_read_authority.sql', 'utf8')
    log('apply-138', await q(sql138))
    const sql139 = fs.readFileSync('supabase/migrations/139_pod_policies_trusted_helper.sql', 'utf8')
    log('apply-139', await q(sql139))
  } else if (stage === 'verify') {
    log('funcs', await q("SELECT p.proname, p.prosecdef, pg_get_function_arguments(p.oid) args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_payment_intents_for_orders','current_driver_id','pod_path_is_driver','create_payment_intent_record','confirm_offline_payment') ORDER BY 1"))
    log('grants', await q("SELECT routine_name, grantee FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name IN ('get_payment_intents_for_orders','current_driver_id','pod_path_is_driver') ORDER BY 1,2"))
    log('index', await q("SELECT indexname FROM pg_indexes WHERE indexname='uq_payment_intents_active_order_method'"))
    log('policies', await q("SELECT policyname, qual, with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'pod_photos%' ORDER BY policyname"))
    log('table-grant-must-stay-revoked', await q("SELECT has_table_privilege('authenticated','public.payment_intents','SELECT') AS auth_select"))
  } else if (stage === 'record') {
    log('record-138-139', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('138','138_payment_intents_read_authority','{}'::text[]), ('139','139_pod_policies_trusted_helper','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q("SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4"))
  } else {
    console.log('UNKNOWN_STAGE'); process.exit(1)
  }
  fs.writeFileSync(`e2e/artifacts/prod-${stage}-138-139.json`, JSON.stringify({ stage, ran_at: new Date().toISOString(), results }, null, 2))
  console.log('STAGE_DONE ' + stage)
})().catch((e) => { console.log('STAGE_ERR ' + e.message); process.exit(1) })