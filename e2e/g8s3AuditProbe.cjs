// G8-S3 — READ-ONLY production audit probe (no writes, no deletes)
const fs = require('fs')
const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
if (!token) { console.log('NO_ACCESS_TOKEN'); process.exit(1) }
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return { status: r.status, body: await r.text() }
}
;(async () => {
  const sig = await q("select p.proname, pg_get_function_arguments(p.oid) args, p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%automation%' order by 1")
  console.log('RPC_SIGNATURES=' + sig.body.replace(/[\n]/g, ' '))
  const grants = await q("select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name like '%automation%' and grantee in ('anon','authenticated','service_role') order by 1,2")
  console.log('RPC_GRANTS=' + grants.body.replace(/[\n]/g, ' '))
  const tbl = await q("select relrowsecurity from pg_class where relname='automation_queue'")
  console.log('RLS=' + tbl.body)
  const tpol = await q("select count(*) from pg_policies where tablename='automation_queue'")
  console.log('RLS_POLICIES=' + tpol.body)
  const cnt = await q("select status, count(*) from automation_queue group by 1 order by 1")
  console.log('QUEUE_ROWS=' + cnt.body)
  const traces = await q("select metadata->>'status' st, count(*) from audit_logs where action='automation.execution' group by 1 order by 1")
  console.log('LEGACY_TRACES=' + traces.body)
  const recent = await q("select id, entity_id, metadata->>'status' st, metadata->>'finished_at' fin from audit_logs where action='automation.execution' order by created_at desc limit 6")
  console.log('RECENT_TRACES=' + recent.body.replace(/[\n]/g, ' '))
})().catch(e => { console.log('PROBE_ERR ' + e.message); process.exit(1) })