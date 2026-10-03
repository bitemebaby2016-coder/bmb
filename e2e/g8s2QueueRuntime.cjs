// G8-S2 — queue runtime verification (synthetic records only; exact-ID cleanup)
const fs = require('fs')
const SERVICE = (/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
const url = 'https://ivkdfognyiwjcmrhcnwz.supabase.co/rest/v1/'
const H = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' }
const TS = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
const id = (s) => 'g8s2-selftest-' + TS + '-' + s
const out = []
const log = (k, v) => { out.push(k + '=' + JSON.stringify(v)); console.log(k + '=' + JSON.stringify(v)) }
async function rest(method, path, body) {
  const r = await fetch(url + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined })
  const j = r.status === 204 ? null : await r.json().catch(() => null)
  return { status: r.status, j }
}
const rpc = (fn, args) => rest('POST', 'rpc/' + fn, args)
const row = async (qid) => { const r = await rest('GET', 'automation_queue?select=*&id=eq.' + qid); return (r.j || [])[0] }
const enqueue = (qid, extra) => rest('POST', 'automation_queue', { id: qid, job_type: 'synthetic_selftest', worker: 'synthetic', payload: { selftest: true }, max_attempts: 3, ...extra })

;(async () => {
  const q1 = id('q1'), q2 = id('q2'), q3 = id('q3'), q4 = id('q4'), q5 = id('q5'), q6 = id('q6'), q7 = id('q7'), q8 = id('q8')
  // QUEUE-01 enqueue
  log('QUEUE01_ENQUEUE', (await enqueue(q1)).status) // 201
  log('QUEUE01_ROW', { status: (await row(q1)).status, attempt: (await row(q1)).attempt_count })
  // QUEUE-02 atomic claim + QUEUE-04 lease
  const c1 = await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 'evidence-runner', p_batch: 1, p_lease_minutes: 5 })
  const claimed1 = (c1.j || [])[0]
  log('QUEUE02_CLAIM', { got: (c1.j || []).length, id: claimed1 && claimed1.id === q1, attempt: claimed1 && claimed1.attempt_count })
  log('QUEUE04_LEASE', { lease_set: !!(claimed1 && claimed1.lease_until), within_5min: claimed1 && (new Date(claimed1.lease_until) - Date.now()) / 60000 <= 5.1 && (new Date(claimed1.lease_until) > new Date()) })
  // QUEUE-03 concurrent claim — 8 parallel claimers on one queued job
  await enqueue(q2)
  const claimers = await Promise.all(Array.from({ length: 8 }, () => rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 'concurrent', p_batch: 1, p_lease_minutes: 5 })))
  const winners = claimers.filter(c => (c.j || []).length === 1)
  const winnerIds = claimers.flatMap(c => (c.j || []).map(r => r.id))
  log('QUEUE03_CONCURRENT', { claimers: 8, winners: winners.length, uniqueWinner: new Set(winnerIds).size === 1 && winnerIds[0] === q2 })
  // QUEUE-05 stale lease recovery (crash after claim)
  await enqueue(q3)
  await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 'crasher', p_batch: 1, p_lease_minutes: 5 })
  await rest('PATCH', 'automation_queue?id=eq.' + q3, { lease_until: new Date(Date.now() - 1000).toISOString() })
  const rq = await rpc('requeue_stale_automation_jobs', {})
  const q3row = await row(q3)
  log('QUEUE05_STALE_RECOVERY', { requeued: rq.j, status: q3row.status, attempt_preserved: q3row.attempt_count === 1 })
  const c2 = await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 'evidence-runner', p_batch: 1, p_lease_minutes: 5 })
  const q3re = (c2.j || []).find(r => r.id === q3)
  log('QUEUE05_RECLAIM', { secondClaim: !!q3re, attempt: q3re && q3re.attempt_count })
  await rest('PATCH', 'automation_queue?id=eq.' + q3, { available_at: new Date().toISOString() })
  // QUEUE-06/07/08/09 retry + backoff + jitter (claim att2 first so fail computes backoff on attempt_count=2)
  const c3 = await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 'evidence-runner', p_batch: 1, p_lease_minutes: 5 })
  const att2 = (c3.j || []).find(r => r.id === q3)
  const f1 = await rpc('fail_automation_job', { p_id: q3, p_error: 'synthetic network fail', p_reason: 'network_transient', p_retryable: true })
  const q3f = await row(q3)
  const backoffSec = (new Date(q3f.next_retry_at) - new Date(q3f.updated_at)) / 1000
  log('QUEUE06_ATTEMPT_PERSISTED', { attempt2Claimed: !!att2, attempt: q3f.attempt_count, status: q3f.status })
  log('QUEUE07_RETRY_SCHEDULED', { fail: f1.j, next_retry_set: !!q3f.next_retry_at })
  const baseSec = 60 * Math.pow(2, q3f.attempt_count - 1)
  log('QUEUE08_BACKOFF', { expectedBaseSec: baseSec, actualSec: Math.round(backoffSec) })
  log('QUEUE09_JITTER_BOUNDS', { within20pct: backoffSec >= baseSec * 0.8 && backoffSec <= baseSec * 1.2 })
  await rest('PATCH', 'automation_queue?id=eq.' + q3, { available_at: new Date().toISOString() })
  // QUEUE-10/11 max attempts -> dead (att2 failed already; claim att3 -> fail -> dead)
  await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 'evidence-runner', p_batch: 1, p_lease_minutes: 5 })
  const f3 = await rpc('fail_automation_job', { p_id: q3, p_error: 'synthetic fail 3', p_reason: 'network_transient', p_retryable: true })
  const q3x = await row(q3)
  log('QUEUE10_MAX_ATTEMPTS', { failResult: f3.j, attempt: q3x.attempt_count, max: q3x.max_attempts })
  log('QUEUE11_DEAD', { status: q3x.status, failed_at: !!q3x.failed_at, reason: q3x.failure_reason, lastError: !!q3x.last_error })
  // QUEUE-12 non-retryable terminal
  await enqueue(q4)
  await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 'evidence-runner', p_batch: 1, p_lease_minutes: 5 })
  const f4 = await rpc('fail_automation_job', { p_id: q4, p_error: 'synthetic bad token', p_reason: 'auth', p_retryable: false })
  const q4r = await row(q4)
  log('QUEUE12_NON_RETRYABLE', { failResult: f4.j, status: q4r.status, reason: q4r.failure_reason, attempt: q4r.attempt_count })
  // QUEUE-13 deterministic duplicate
  const dup = await enqueue(q1)
  const q1n = await row(q1)
  log('QUEUE13_DUPLICATE', { secondEnqueueStatus: dup.status, originalUntouched: q1n.status === 'claimed', attemptUnchanged: q1n.attempt_count === 1 })
  // QUEUE-14/15 replay creates new identity, original preserved
  const rp = await rpc('replay_automation_job', { p_id: q3 })
  const q3after = await row(q3)
  const rpRow = await row(rp.j)
  log('QUEUE14_REPLAY_NEW_IDENTITY', { newIdDistinct: rp.j !== q3 && String(rp.j).startsWith(q3 + '-r'), newStatus: rpRow.status, newAttempt: rpRow.attempt_count })
  log('QUEUE15_ORIGINAL_PRESERVED', { originalStatus: q3after.status, originalFailedAt: !!q3after.failed_at, originalReason: q3after.failure_reason })
  // succeeded path sanity on replay clone
  const cl = await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 'evidence-runner', p_batch: 1, p_lease_minutes: 5 })
  const clId = (cl.j || []).find(r => r.id === rp.j)
  const done = clId ? await rpc('complete_automation_job', { p_id: rp.j }) : { j: 'not_claimed' }
  log('SUCCEEDED_PATH', { completed: done.j })
  // cleanup — exact synthetic IDs only
  const ids = [q1, q2, q3, q4, q5, q6, q7, q8, String(rp.j)]
  const del = await rest('DELETE', 'automation_queue?id=in.(' + ids.join(',') + ')')
  const chk = await rest('GET', 'automation_queue?select=id&id=in.(' + ids.join(',') + ')')
  const residue = await rest('GET', 'automation_queue?select=id&id=like.g8s2-selftest-*')
  log('CLEANUP', { deleteStatus: del.status, remainingExact: (chk.j || []).length, residueSynthetic: (residue.j || []).length })
  fs.writeFileSync('e2e/g8s2-queue-runtime-evidence.json', JSON.stringify(out, null, 2))
  console.log('EVIDENCE_SAVED')
})().catch(e => { console.log('RUNTIME_ERR ' + e.message); process.exit(1) })