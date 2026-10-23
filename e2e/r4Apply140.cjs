// R4 (2026-10-23) — production apply for migration 140 (auto_close_expired_rounds).
// Owner approved policy: auto-close ตาม cutoff + admin-only + audit.
// Local gates green first: replay 001-140 clean + contracts_140.sql PASS (G1-G5).
//
// STAGES:
//   node e2e/r4Apply140.cjs precheck  // RO: history + function absent + backup recency
//   node e2e/r4Apply140.cjs apply     // apply 140 (file is a single statement block)
//   node e2e/r4Apply140.cjs verify    // RO: security definer + grants + dry run result
//   node e2e/r4Apply140.cjs record    // ledger schema_migrations 140
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
    log('history', await q("SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4"))
    log('func-must-be-absent', await q("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='auto_close_expired_rounds'"))
    log('active-expired-now', await q("SELECT id, scheduled_date, cutoff_time, status FROM public.delivery_rounds WHERE status='active' AND (scheduled_date < (now() at time zone 'Asia/Bangkok')::date OR (scheduled_date = (now() at time zone 'Asia/Bangkok')::date AND cutoff_time IS NOT NULL AND (extract(hour from cutoff_time) * 3600 + extract(minute from cutoff_time) * 60) < extract(hour from (now() at time zone 'Asia/Bangkok')) * 3600 + extract(minute from (now() at time zone 'Asia/Bangkok')) * 60)) ORDER BY scheduled_date LIMIT 15"))
  } else if (stage === 'apply') {
    log('apply-140', await q(fs.readFileSync('supabase/migrations/140_auto_close_expired_rounds.sql', 'utf8')))
  } else if (stage === 'verify') {
    log('func-def', await q("SELECT p.proname, p.prosecdef, pg_get_function_result(p.oid) AS result FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='auto_close_expired_rounds'"))
    log('grants', await q("SELECT grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name='auto_close_expired_rounds' ORDER BY 1"))
  } else if (stage === 'record') {
    log('record-140', await q("INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('140','140_auto_close_expired_rounds','{}'::text[]) ON CONFLICT (version) DO NOTHING"))
    log('history-after', await q("SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3"))
  } else {
    console.log('UNKNOWN_STAGE'); process.exit(1)
  }
  fs.writeFileSync(`e2e/artifacts/r4-apply140-${stage}.json`, JSON.stringify({ stage, ran_at: new Date().toISOString(), results }, null, 2))
  console.log('STAGE_DONE ' + stage)
})().catch((e) => { console.log('APPLY_ERR ' + e.message); process.exit(1) })