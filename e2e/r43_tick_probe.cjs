// R43 — เช็ค chain bmb-tick → worker (READ-ONLY)
// 1) return_message ของ pg_cron รอบล่าสุด (pg_net ยิงสำเร็จไหม) 2) g26-poll ล่าสุด
//    (worker marketing_publish รันถึงไหม — poll อยู่ท้ายฟังก์ชันเดียวกัน) 3) audit automation.execution
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
async function q(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 400))
  return JSON.parse(t)
}
;(async () => {
  const out = { ran_at: new Date().toISOString() }
  try {
    out.tick_runs = await q(`
      SELECT j.jobname, rd.status, left(rd.return_message, 300) AS return_message, rd.start_time::text
      FROM cron.job_run_details rd JOIN cron.job j ON j.jobid = rd.jobid
      WHERE j.jobname = 'bmb-tick' ORDER BY rd.start_time DESC LIMIT 6`)
  } catch (e) { out.tick_runs = { error: String(e.message || e).slice(0, 300) } }
  try {
    out.promote_runs = await q(`
      SELECT rd.status, left(rd.return_message, 200) AS return_message, rd.start_time::text
      FROM cron.job_run_details rd JOIN cron.job j ON j.jobid = rd.jobid
      WHERE j.jobname = 'bmb-promote' ORDER BY rd.start_time DESC LIMIT 3`)
  } catch (e) { out.promote_runs = { error: String(e.message || e).slice(0, 300) } }
  try {
    out.g26_poll = await q(`SELECT id, created_at::text FROM public.audit_logs
      WHERE id LIKE 'g26-poll%' ORDER BY created_at DESC LIMIT 6`)
  } catch (e) { out.g26_poll = { error: String(e.message || e).slice(0, 300) } }
  try {
    out.auto_exec = await q(`SELECT id, entity_id, left(description, 200) AS descr, created_at::text
      FROM public.audit_logs WHERE action = 'automation.execution'
      ORDER BY created_at DESC LIMIT 12`)
  } catch (e) { out.auto_exec = { error: String(e.message || e).slice(0, 300) } }
  fs.writeFileSync(path.join(__dirname, 'r43_tick_probe.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 400)); process.exitCode = 1 })