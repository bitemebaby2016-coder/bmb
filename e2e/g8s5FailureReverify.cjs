// G8-S5 follow-up — synthetic failure-path re-verify + T2 leftover cleanup (synthetic only)
const fs = require('fs')
const TOKEN = (/^AUTOMATION_TOKEN=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
const SERVICE = (/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
;(async () => {
  // fresh synthetic enqueue via secure transport
  const ts = Date.now()
  const en = await fetch(SB + '/functions/v1/queue-enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-automation-token': TOKEN, apikey: 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH' },
    body: JSON.stringify({ job: 'synthetic_selftest', ref: 'g8s5fx-' + ts }) })
  const enj = await en.json()
  const sid = 'sched-synthetic_selftest-g8s5fx-' + ts
  console.log('ENQUEUE ' + en.status + ' ' + enj.result + ' id=' + sid)
  // claim — setof via PostgREST-style: select * from fn(...) → array of row objects
  const c1 = JSON.parse(await q("select * from claim_automation_jobs('synthetic_selftest','synthetic-evidence',1,5)"))
  const claimed = c1[0]
  console.log('F1_CLAIM id=' + claimed.id + ' expected=' + sid + ' match=' + (claimed.id === sid) + ' attempts=' + claimed.attempt_count)
  // retryable fail → requeued
  const f1 = JSON.parse(await q("select fail_automation_job('" + sid + "','synthetic transient','db_transient',true)"))
  const st1 = JSON.parse(await q("select status, next_retry_at is not null as has_backoff from automation_queue where id='" + sid + "'"))
  console.log('F2_RETRYABLE=' + f1[0].fail_automation_job + ' F3_AFTER_RETRY=' + st1[0].status + ' backoff=' + st1[0].has_backoff)
  // claim again → should NOT be claimable before backoff
  const c2 = JSON.parse(await q("select * from claim_automation_jobs('synthetic_selftest','synthetic-evidence',5,5)"))
  console.log('F3B_BACKOFF_RESPECTED claimed=' + c2.length)
  // non-retryable → dead
  const f2 = JSON.parse(await q("select fail_automation_job('" + sid + "','synthetic terminal','business_rejection',false)"))
  const st2 = JSON.parse(await q("select status from automation_queue where id='" + sid + "'"))
  console.log('F4_NONRETRYABLE=' + f2[0].fail_automation_job + ' F5_DEAD=' + st2[0].status)
  // replay → new identity
  const rp = JSON.parse(await q("select replay_automation_job('" + sid + "')"))
  const newId = rp[0].replay_automation_job
  console.log('F6_REPLAY newId=' + newId + ' ok=' + String(newId).startsWith(sid + '-r'))
  // lease expiry: CLAIM first (status=claimed), then backdate lease, then requeue_stale
  const lc = JSON.parse(await q("select * from claim_automation_jobs('synthetic_selftest','synthetic-evidence',1,5)"))
  const lrow = lc[0]
  console.log('F7A_CLAIM ' + lrow.id + ' status=' + lrow.status)
  await q("update automation_queue set lease_until = now() - interval '1 minute' where id='" + lrow.id + "' and job_type='synthetic_selftest'")
  const l2 = JSON.parse(await q("select requeue_stale_automation_jobs()"))
  const l3 = JSON.parse(await q("select status from automation_queue where id='" + lrow.id + "'"))
  console.log('F7_LEASE_EXPIRY requeued=' + l2[0].requeue_stale_automation_jobs + ' status=' + l3[0].status)
  // cleanup ALL synthetic rows (synthetic job_type only) incl. T2 leftover
  const rows = JSON.parse(await q("select id from automation_queue where job_type='synthetic_selftest'"))
  for (const r0 of rows) {
    await fetch(SB + "/rest/v1/automation_queue?id=eq." + encodeURIComponent(r0.id) + "&job_type=eq.synthetic_selftest", {
      method: 'DELETE', headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
  }
  const res = JSON.parse(await q("select count(*) c from automation_queue where id like '%g8s5%' or id like 'sched-synthetic%'"))
  console.log('CLEANUP deleted=' + rows.map(x => x.id).join(',') + ' residue=' + res[0].c)
  const final = JSON.parse(await q('select status, count(*) c from automation_queue group by 1'))
  console.log('QUEUE_FINAL=' + JSON.stringify(final))
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 400)); process.exit(1) })