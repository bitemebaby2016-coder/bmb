// G8-S5 — dispatcher runtime evidence (controlled; canonical semantics unchanged)
const fs = require('fs')
const TOKEN = (/^AUTOMATION_TOKEN=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
const SERVICE = (/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const hdrs = (tok) => ({ 'Content-Type': 'application/json', 'x-automation-token': tok || '', apikey: 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH' })
const out = []
const log = (k, v) => { out.push(k + ' = ' + JSON.stringify(v)); console.log(k + ' = ' + JSON.stringify(v)) }

const call = async (tok, body) => {
  const r = await fetch(SB + '/functions/v1/queue-dispatcher', { method: 'POST', headers: hdrs(tok), body: JSON.stringify(body) })
  return { status: r.status, j: await r.json().catch(() => null) }
}
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
const enqueue = async (job, ref, params) => {
  const r = await fetch(SB + '/functions/v1/queue-enqueue', { method: 'POST', headers: hdrs(TOKEN), body: JSON.stringify({ job, ref, params }) })
  return { status: r.status, j: await r.json().catch(() => null) }
}

;(async () => {
  const ts = Date.now()
  // --- negatives ---
  const n1 = await call('', { jobType: 'notification_dispatch' })
  log('D1_NO_TOKEN', { status: n1.status, denied: n1.status === 401 })
  const n2 = await call('wrong-token', { jobType: 'notification_dispatch' })
  log('D2_WRONG_TOKEN', { status: n2.status, denied: n2.status === 401 })
  const n3 = await call(TOKEN, { jobType: 'synthetic_selftest' })
  log('D3_UNKNOWN_JOBTYPE', { status: n3.status, denied: n3.status === 400 })
  const n4 = await fetch(SB + '/functions/v1/queue-dispatcher', { method: 'POST', headers: hdrs(TOKEN), body: '{bad' })
  log('D4_INVALID_JSON', { status: n4.status, denied: n4.status === 400 })

  // --- empty queue → claimed:0 ---
  const e0 = await call(TOKEN, { jobType: 'inventory_low_stock' })

  // --- controlled canonical run: one per legacy job (canonical template params, unchanged) ---
  const jobs = [
    ['notification_dispatch', { lookbackMinutes: 360, limit: 200 }],
    ['orders_stale_pending', { maxAgeMinutes: 120 }],
    ['inventory_low_stock', { stockThreshold: 3 }],
  ]
  const ctrlIds = []
  for (const [job, params] of jobs) {
    const ref = 'g8s5-ctrl-' + ts + '-' + job.slice(0, 4)
    const en = await enqueue(job, ref, params)
    const id = 'sched-' + job + '-' + ref
    ctrlIds.push(id)
    const d = await call(TOKEN, { jobType: job })
    const res = (d.j && d.j.results || []).find((x) => x.id === id)
    await sleep(500)
    const qrow = JSON.parse(await q("select status, attempt_count from automation_queue where id='" + id + "'"))
    const trace = JSON.parse(await q("select metadata->>'status' st from audit_logs where id='auto-exec-" + id + "'"))
    log('CTRL_' + job, {
      enqueue: en.j && en.j.result, dispatchHttp: d.status, workerStatus: res && res.workerStatus,
      workerHttp: res && res.workerHttp, queueResult: res && res.queueResult, queueFinal: qrow[0] && qrow[0].status,
      trace: trace[0] && trace[0].st,
    })
    // idempotency: duplicate enqueue same ref + re-dispatch (row already succeeded → nothing claimed)
    const en2 = await enqueue(job, ref, params)
    const d2 = await call(TOKEN, { jobType: job })
    log('IDEMP_' + job, { reEnqueue: en2.j && en2.j.result, reDispatchClaimed: d2.j && d2.j.claimed })
  }

  log('D5_EMPTY_CLAIM', { status: e0.status, claimed: e0.j && e0.j.claimed })

  // --- failure handling synthetic (RPC-driven, service_role; no business impact) ---
  const sid = 'sched-synthetic_selftest-g8s5f-' + ts
  await enqueue('synthetic_selftest', 'g8s5f-' + ts, {})
  const c1 = JSON.parse(await q("select claim_automation_jobs('synthetic_selftest','synthetic-evidence',1,5)"))
  log('F1_CLAIM', { claimed: !!(c1[0] && c1[0].claim_automation_jobs && c1[0].claim_automation_jobs.id === sid) })
  const f1 = JSON.parse(await q("select fail_automation_job('" + sid + "','synthetic transient','db_transient',true)"))
  log('F2_RETRYABLE', { result: f1[0] && f1[0].fail_automation_job })
  const st1 = JSON.parse(await q("select status from automation_queue where id='" + sid + "'"))
  log('F3_AFTER_RETRY', { status: st1[0] && st1[0].status })
  const f2 = JSON.parse(await q("select fail_automation_job('" + sid + "','synthetic terminal','business_rejection',false)"))
  log('F4_NONRETRYABLE', { result: f2[0] && f2[0].fail_automation_job })
  const st2 = JSON.parse(await q("select status from automation_queue where id='" + sid + "'"))
  log('F5_DEAD', { status: st2[0] && st2[0].status })
  const rp = JSON.parse(await q("select replay_automation_job('" + sid + "')"))
  const newId = rp[0] && rp[0].replay_automation_job
  log('F6_REPLAY', { newId: String(newId || '').startsWith(sid + '-r') })
  // lease expiry requeue — synthetic row ONLY (no business state touched)
  const l1 = JSON.parse(await q("update automation_queue set lease_until = now() - interval '1 minute' where id='" + newId + "' and job_type='synthetic_selftest' returning id"))
  const l2 = JSON.parse(await q("select requeue_stale_automation_jobs()"))
  const l3 = JSON.parse(await q("select status from automation_queue where id='" + newId + "'"))
  log('F7_LEASE_EXPIRY', { updated: (l1[0] && l1[0].id) === newId, requeuedFn: l2[0] !== undefined, status: l3[0] && l3[0].status })

  // --- cleanup: exact-ID deletes (synthetic + control queue rows; audit traces preserved) ---
  const ids = [sid, newId, ...ctrlIds]
  for (const id of ids) await deleteQueueRow(id)
  await sleep(500)
  const residue = JSON.parse(await q("select count(*) c from automation_queue where id like '%g8s5%' or id like 'sched-synthetic_selftest-%'"))
  log('CLEANUP', { deleted: ids.length, residue: residue[0] && residue[0].c })
  fs.writeFileSync('e2e/g8s5-dispatcher-evidence.json', JSON.stringify(out, null, 2))
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 400)); process.exit(1) })


const sleep = (ms) => new Promise((res) => setTimeout(res, ms))
const deleteQueueRow = async (id) => {
  await fetch(SB + '/rest/v1/automation_queue?id=eq.' + encodeURIComponent(id), {
    method: 'DELETE', headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
}
