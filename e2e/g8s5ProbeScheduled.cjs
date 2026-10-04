// G8-S5 deep probe — read-only scheduled evidence per job since cutover
const fs = require('fs')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
;(async () => {
  const C = "2026-10-03T14:52:00Z"
  console.log('PER_JOB_SINCE_CUTOVER=' + await q("select job_type, status, count(*) c, min(created_at) first_at, max(created_at) last_at from automation_queue where id like 'sched-%-gh-%' and created_at > '" + C + "' group by 1,2 order by 1"))
  console.log('ANY_QUEUE_LAST6H=' + await q("select id, job_type, status, created_at from automation_queue where created_at > now() - interval '6 hours' order by created_at desc limit 20"))
  console.log('TRACES_LAST6H=' + await q("select id, entity_id, metadata->>'status' st, created_at from audit_logs where action='automation.execution' and created_at > now() - interval '6 hours' order by created_at desc limit 20"))
  console.log('LEGACY_SINCE_CUTOVER=' + await q("select count(*) c from audit_logs where action='automation.execution' and id like 'auto-exec-gh-%' and created_at > '" + C + "'"))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))