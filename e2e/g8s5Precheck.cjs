// G8-S5 — READ-ONLY precheck (no writes, no deletes)
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
  const cnt = await q("select status, count(*) from automation_queue group by 1 order by 1")
  console.log('QUEUE_BY_STATUS=' + cnt.body)
  const schedIds = await q("select id, job_type, status, attempt_count, max_attempts from automation_queue where id like 'sched-%' and job_type in ('notification_dispatch','orders_stale_pending','inventory_low_stock') order by created_at desc limit 10")
  console.log('SCHED_JOB_ROWS=' + schedIds.body)
  const active = await q("select id, status, lease_until, updated_at from automation_queue where status in ('claimed','running')")
  console.log('ACTIVE=' + active.body)
  const stale = await q("select id, status, lease_until from automation_queue where status in ('claimed','running') and lease_until is not null and lease_until < now()")
  console.log('STALE_LEASES=' + stale.body)
  const retry = await q("select id, attempt_count, next_retry_at, available_at from automation_queue where status='queued' and (next_retry_at is not null or attempt_count > 0)")
  console.log('RETRY_PENDING=' + retry.body)
  const dead = await q("select id, attempt_count, failure_reason from automation_queue where status='dead'")
  console.log('DEAD=' + dead.body)
  const traces = await q("select metadata->>'status' st, metadata->>'job' job, count(*) from audit_logs where action='automation.execution' and created_at > now() - interval '6 hours' group by 1,2 order by 1")
  console.log('LEGACY_TRACES_6H=' + traces.body)
  const qtr = await q("select count(*) from audit_logs where action like '%queue%' and created_at > now() - interval '6 hours'")
  console.log('QUEUE_TRACES_6H=' + qtr.body)
  const idhist = await q("select job_type, count(*), count(distinct id) from automation_queue where id like 'sched-%' group by 1")
  console.log('SCHED_ID_HISTORY=' + idhist.body)
  // workflow_dispatch input mapping audit: workflow currently calls worker directly with job=..., eventId=..., params
  console.log('NOTE legacy eventId format: gh-dispatch-YYYYMMDDTHHMM | gh-stale-... | gh-stock-YYYYMMDDTHH')
})().catch(e => { console.log('PROBE_ERR ' + e.message); process.exit(1) })