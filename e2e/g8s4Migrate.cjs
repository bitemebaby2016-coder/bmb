// G8-S4 — precheck (read-only) → deploy migration 111 → verify objects
const fs = require('fs')
const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
if (!token) { console.log('NO_ACCESS_TOKEN'); process.exit(1) }
const sql = fs.readFileSync('supabase/migrations/111_g8_s4_enqueue_idempotency.sql', 'utf8')
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return { status: r.status, body: await r.text() }
}
;(async () => {
  // --- S4-03 READ-ONLY precheck ---
  const rows = await q('select status, count(*) from automation_queue group by 1')
  console.log('PRECHECK_ROWS=' + rows.body + ' status=' + rows.status) // must be [] (0 rows) before deploy
  const idx = await q("select indexname, indexdef from pg_indexes where tablename='automation_queue'")
  console.log('PRECHECK_INDEXES=' + idx.body.replace(/[\n]/g, ' '))
  const cons = await q("select conname, contype from pg_constraint where conrelid = 'public.automation_queue'::regclass")
  console.log('PRECHECK_CONSTRAINTS=' + cons.body.replace(/[\n]/g, ' '))
  if (rows.status >= 400) { console.log('PRECHECK_FAIL'); process.exit(1) }
  const parsed = JSON.parse(rows.body)
  if (Array.isArray(parsed) && parsed.length > 0) { console.log('UNEXPECTED_EXISTING_ROWS — HARD STOP'); process.exit(1) }
  // --- deploy ---
  const d = await q(sql)
  console.log('MIGRATE_STATUS=' + d.status)
  if (d.status >= 400) { console.log(d.body.slice(0, 500)); process.exit(1) }
  // --- verify ---
  const sig = await q("select p.proname, pg_get_function_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('enqueue_automation_job','fail_automation_job') order by 1")
  console.log('FUNCS=' + sig.body.replace(/[\n]/g, ' '))
  const g = await q("select routine_name, grantee from information_schema.routine_privileges where routine_schema='public' and routine_name='enqueue_automation_job' and grantee in ('anon','authenticated','service_role') order by 2")
  console.log('GRANTS=' + g.body.replace(/[\n]/g, ' '))
  const src = await q("select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='fail_automation_job'")
  console.log('AI_TIMEOUT_IN_SRC=' + (src.body.includes("'ai_timeout'") ? 'YES' : 'NO'))
})().catch(e => { console.log('MIGRATE_ERR ' + e.message); process.exit(1) })