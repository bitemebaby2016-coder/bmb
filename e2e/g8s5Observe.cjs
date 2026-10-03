// G8-S5 observation poller (read-only)
const fs = require('fs')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
;(async () => {
  const cutoff = process.argv[2] || "now() - interval '30 minutes'"
  console.log('== QUEUE (last 30m) ==')
  console.log(await q("select id, job_type, status, attempt_count, created_at, completed_at from automation_queue where created_at > now() - interval '30 minutes' order by created_at desc limit 20"))
  console.log('== EXEC TRACES (last 30m) ==')
  console.log(await q("select id, entity_id, metadata->>'status' st, created_at from audit_logs where action='automation.execution' and created_at > now() - interval '30 minutes' order by created_at desc limit 20"))
  console.log('== LEGACY (gh-*) TRACES SINCE CUTOVER ==')
  console.log(await q("select count(*) c from audit_logs where action='automation.execution' and id like 'auto-exec-gh-%' and created_at > '" + (process.argv[3] || new Date(Date.now() - 30 * 60000).toISOString()) + "'"))
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)) })