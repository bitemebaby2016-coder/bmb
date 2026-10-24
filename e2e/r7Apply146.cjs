// R7 (2026-10-24) — production apply for migrations 146 + 147 (role system completion)
//   Owner sign-off: "P1-p3 อนุมัติ signoff · missing ทำให้หมด · partial ให้สมบูรณ์ทั้งระบบ"
//   Local gates green FIRST: vitest 134/1385 exit0 + lint0 + build0 + tsc0.
// STAGES: precheck | apply146 | verify146 | apply147 | verify147 | contract146 | contract147 | record
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
  results.push({ label, status: r.status, body: (() => { try { return JSON.parse(r.body) } catch { return r.body.slice(0, 900) } })() })
  console.log(`[${label}] status=${r.status}`)
}
const save = () => fs.writeFileSync(`e2e/r7Apply146-${stage}.json`, JSON.stringify(results, null, 2))
;(async () => {
  if (stage === 'precheck') {
    log('history', await q('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3'))
    log('constraint-now', await q("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND contype='c'"))
    log('predicates-absent', await q("SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_kitchen'"))
    log('linked-driver-role', await q('SELECT p.role FROM profiles p JOIN drivers d ON d.user_id = p.id'))
    log('backup-recency', await q("SELECT count(*) AS recent_backups FROM storage.objects WHERE bucket_id='db-backups' AND created_at > now() - interval '14 days'"))
  } else if (stage === 'apply146') {
    log('apply-146', await q(fs.readFileSync('supabase/migrations/146_role_foundation.sql', 'utf8')))
  } else if (stage === 'verify146') {
    log('constraint-13-roles', await q("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='profiles_role_check'"))
    log('predicates-present', await q("SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('is_owner','is_kitchen','is_inventory','is_finance','is_marketing','is_pos','is_auditor','is_support','is_developer','is_rider')"))
    log('set-user-role-exists', await q("SELECT count(*) AS hits FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='set_user_role'"))
    log('is-admin-includes-owner', await q("SELECT prosrc LIKE '%owner%' AS ok FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_admin'"))
    log('rider-trigger-exists', await q("SELECT count(*) AS hits FROM pg_trigger WHERE tgname='drivers_promote_rider'"))
    log('linked-driver-is-rider', await q('SELECT p.role FROM profiles p JOIN drivers d ON d.user_id = p.id'))
  } else if (stage === 'apply147') {
    log('apply-147', await q(fs.readFileSync('supabase/migrations/147_role_rls_matrix.sql', 'utf8')))
  } else if (stage === 'verify147') {
    log('role-policies', await q("SELECT policyname FROM pg_policies WHERE schemaname='public' AND policyname IN ('recipes_role_manage','batches_role_manage','batch_items_role_manage','inventory_role_write','daily_closings_finance_write','marketing_posts_role_write','orders_support_read','customers_support_read','orders_audit_read','drivers_scoped_read','drivers_self_update') ORDER BY policyname"))
    log('kitchen-guard', await q("SELECT prosrc LIKE '%is_kitchen%' AS ok FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='kitchen_queue'"))
    log('finance-guards', await q("SELECT (SELECT prosrc LIKE '%is_finance%' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='close_day') AS close_day_ok, (SELECT prosrc LIKE '%is_finance%' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_daily_sales') AS sales_ok"))
    log('inventory-grant-restored', await q("SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs FROM information_schema.table_privileges WHERE table_name='inventory' AND grantee='authenticated'"))
    log('rider-policy-count', await q("SELECT count(*) AS n FROM pg_policies WHERE schemaname='public' AND policyname IN ('drivers_scoped_read','assignments_scoped_read','drivers_self_update') AND (qual LIKE '%is_rider%' OR with_check LIKE '%is_rider%')"))
  } else if (stage === 'contract146') {
    log('contract-146', await q(fs.readFileSync('e2e/contracts_146.sql', 'utf8')))
  } else if (stage === 'contract147') {
    log('contract-147', await q(fs.readFileSync('e2e/contracts_147.sql', 'utf8')))
  } else if (stage === 'record') {
    log('record-146', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('146','146_role_foundation','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('record-147', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('147','147_role_rls_matrix','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4'))
  } else {
    console.log('unknown stage'); process.exit(1)
  }
  save()
  const bad = results.filter((r) => r.status >= 400)
  console.log(bad.length ? 'STAGE_FAILED' : 'STAGE_OK', JSON.stringify(results, null, 2).slice(0, 2000))
  process.exit(bad.length ? 1 : 0)
})()