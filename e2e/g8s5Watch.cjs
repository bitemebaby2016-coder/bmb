// G8-S5 watcher - poll every 2 min up to 3 h; resilient to transient fetch failures
const fs = require('fs')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
const q = async (query) => {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
        method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }) })
      return r.text()
    } catch (e) { await new Promise((r) => setTimeout(r, 5000)) }
  }
  return '[]'
}
;(async () => {
  const CUTOVER = '2026-10-03T14:52:00Z'
  const deadline = Date.now() + 180 * 60000
  while (Date.now() < deadline) {
    const rows = JSON.parse(await q("select id, job_type, status, attempt_count, created_at from automation_queue where id like '%-gh-%' and created_at > '" + CUTOVER + "' order by created_at desc limit 20"))
    const traces = JSON.parse(await q("select id, entity_id, metadata->>'status' st, created_at from audit_logs where action='automation.execution' and id like 'auto-exec-sched-%-gh-%' and created_at > '" + CUTOVER + "' order by created_at desc limit 20"))
    const legacy = JSON.parse(await q("select count(*) c from audit_logs where action='automation.execution' and id like 'auto-exec-gh-%' and created_at > '" + CUTOVER + "'"))
    if ((rows && rows.length) || (traces && traces.length)) {
      console.log('ACTIVITY')
      console.log('QUEUE=' + JSON.stringify(rows))
      console.log('TRACES=' + JSON.stringify(traces))
      console.log('LEGACY_SINCE_CUTOVER=' + (legacy[0] ? legacy[0].c : '?'))
      process.exit(0)
    }
    console.log(new Date().toISOString() + ' quiet legacySinceCutover=' + (legacy[0] ? legacy[0].c : '?'))
    await new Promise((r) => setTimeout(r, 120000))
  }
  console.log('TIMEOUT_NO_ACTIVITY')
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)) })