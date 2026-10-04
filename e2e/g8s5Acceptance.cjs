// G8-S5 acceptance probe - READ-ONLY, single shot
// Counts only event=schedule runs whose production chain is proven end-to-end.
const fs = require('fs')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
const gh = async (u) => (await fetch(u)).json()
;(async () => {
  const SINCE = '2026-10-04T06:02:00Z'
  console.log('NOW=' + new Date().toISOString())
  // 1) GitHub schedule runs since 06:02Z (exclude push/dispatch)
  const runs = await gh('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs?per_page=40')
  const sched = (runs.workflow_runs || []).filter((r) => r.event === 'schedule' && r.created_at > SINCE)
  console.log('SCHEDULE_RUNS_SINCE=' + sched.length)
  for (const r of sched) console.log('RUN id=' + r.id + ' cc=' + r.conclusion + ' at=' + r.created_at + ' sha=' + r.head_sha.slice(0, 7))
  // step-level detail for each schedule run
  for (const r of sched.slice(0, 12)) {
    const j = await gh('https://api.github.com/repos/bitemebaby2016-coder/bmb/actions/runs/' + r.id + '/jobs')
    for (const job of j.jobs || []) {
      const failed = (job.steps || []).filter((s) => s.conclusion === 'failure').map((s) => s.name)
      const okSteps = (job.steps || []).filter((s) => s.conclusion === 'success' && /enqueue|dispatch/.test(s.name)).map((s) => s.name)
      console.log('JOB run=' + r.id + ' job=' + job.name + ' cc=' + job.conclusion + ' ok=[' + okSteps.join(',') + '] failed=[' + failed.join(',') + ']')
    }
  }
  // 2) production chain evidence per job since 06:02Z
  console.log('QUEUE=' + await q("select id, job_type, status, attempt_count, created_at, claimed_at, completed_at from automation_queue where id like 'sched-%-gh-%' and created_at > '" + SINCE + "' order by created_at"))
  console.log('TRACES=' + await q("select id, entity_id, metadata->>'status' st, created_at from audit_logs where action='automation.execution' and id like 'auto-exec-sched-%-gh-%' and created_at > '" + SINCE + "' order by created_at"))
  console.log('LEGACY=' + await q("select count(*) c from audit_logs where action='automation.execution' and id like 'auto-exec-gh-%' and created_at > '2026-10-03T14:52:00Z'"))
  console.log('DUP_CHECK=' + await q("select job_type, id, count(*) c from automation_queue where id like 'sched-%-gh-%' and created_at > '2026-10-03T14:52:00Z' group by 1,2 having count(*) > 1"))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))