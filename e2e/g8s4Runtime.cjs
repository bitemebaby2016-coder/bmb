// G8-S4 — synthetic E2E for queue dispatcher infrastructure (NO real business execution)
const fs = require('fs')
const SERVICE = (/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
const ADMIN_EMAIL = (/^BMB_TEST_ADMIN_EMAIL=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
const ADMIN_PW = (/^BMB_TEST_ADMIN_PASSWORD=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
const ANON = (/apikey: (\S+)/.exec(fs.readFileSync('.github/workflows/automation-scheduler.yml', 'utf8')) || [])[1]
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const TS = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
const id = (s) => 'g8s4-synth-' + TS + '-' + s
const out = []
const log = (k, v) => { out.push(k + '=' + JSON.stringify(v)); console.log(k + '=' + JSON.stringify(v)) }
const mk = (key) => ({ apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' })
async function rest(key, method, path, body) {
  const r = await fetch(SB + path, { method, headers: mk(key), body: body ? JSON.stringify(body) : undefined })
  const j = r.status === 204 ? null : await r.json().catch(() => null)
  return { status: r.status, j }
}
const rpc = (fn, args, key = SERVICE) => rest(key, 'POST', '/rest/v1/rpc/' + fn, args)
const row = async (qid) => { const r = await rest(SERVICE, 'GET', '/rest/v1/automation_queue?select=*&id=eq.' + qid); return (r.j || [])[0] }
const ffwd = async (qid) => rest(SERVICE, 'PATCH', '/rest/v1/automation_queue?id=eq.' + qid, { available_at: new Date().toISOString() })
const enq = (qid, extra) => rpc('enqueue_automation_job', { p_id: qid, p_job_type: 'synthetic_selftest', p_worker: 's4-evidence', p_payload: { synthetic: true }, ...extra })

;(async () => {
  const a = id('a'), b = id('b'), c = id('c'), d = id('d'), t = id('t'), cc = id('cc'), s = id('s')
  // --- S4-05 flow 1: ENQUEUE → CLAIM → LEASE → RUN → SUCCESS ---
  log('F1_ENQUEUE', await enq(a))
  log('F1_DUPLICATE_ENQUEUE', await enq(a)) // OD-2: duplicate = DUPLICATE no-op
  const c1 = await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 's4-runner', p_batch: 1, p_lease_minutes: 5 })
  const w1 = (c1.j || []).find(r => r.id === a)
  log('F1_CLAIM', { won: !!w1, attempt: w1 && w1.attempt_count, lease: !!(w1 && w1.lease_until) })
  log('F1_COMPLETE', await rpc('complete_automation_job', { p_id: a }))
  const ra = await row(a)
  log('F1_SUCCESS', { status: ra.status, completed: !!ra.completed_at })
  // --- flow 2: RETRYABLE FAILURE → NEXT RETRY → SUCCESS ---
  log('F2_ENQUEUE', await enq(b))
  await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 's4-runner', p_batch: 1, p_lease_minutes: 5 })
  const f2 = await rpc('fail_automation_job', { p_id: b, p_error: 'synthetic db transient', p_reason: 'db_transient', p_retryable: true })
  const rb = await row(b)
  const d2 = (new Date(rb.next_retry_at) - new Date(rb.updated_at)) / 1000
  log('F2_RETRY', { result: f2.j, attempt: rb.attempt_count, base30_in_bounds: d2 >= 24 && d2 <= 36, actualSec: Math.round(d2) })
  await ffwd(b)
  await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 's4-runner', p_batch: 1, p_lease_minutes: 5 })
  log('F2_COMPLETE', await rpc('complete_automation_job', { p_id: b }))
  log('F2_SUCCESS', { status: (await row(b)).status })
  // --- flow 3: NON-RETRYABLE → DEAD ---
  log('F3_ENQUEUE', await enq(c))
  await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 's4-runner', p_batch: 1, p_lease_minutes: 5 })
  const f3 = await rpc('fail_automation_job', { p_id: c, p_error: 'synthetic bad input', p_reason: 'malformed_input', p_retryable: false })
  const rc3 = await row(c)
  log('F3_DEAD', { result: f3.j, status: rc3.status, reason: rc3.failure_reason })
  // --- flow 4: DEAD → REPLAY → NEW IDENTITY, ORIGINAL PRESERVED ---
  const rp = await rpc('replay_automation_job', { p_id: c })
  const rpRow = await row(rp.j)
  log('F4_REPLAY', { newIdDistinct: rp.j !== c && String(rp.j).startsWith(c + '-r'), newStatus: rpRow.status, newAttempt: rpRow.attempt_count })
  const rc = await row(c)
  log('F4_ORIGINAL_PRESERVED', { status: rc.status, failedAt: !!rc.failed_at })
  // isolation: keep replay clone + retried job out of later claim windows
  await rest(SERVICE, 'PATCH', '/rest/v1/automation_queue?id=eq.' + rp.j, { available_at: new Date(Date.now() + 3600000).toISOString() })
  // --- flow 5: CLAIM → CRASH → LEASE EXPIRY → REQUEUE → SECOND CLAIM ---
  log('F5_ENQUEUE', await enq(d))
  await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 'crasher', p_batch: 1, p_lease_minutes: 5 })
  await rest(SERVICE, 'PATCH', '/rest/v1/automation_queue?id=eq.' + d, { lease_until: new Date(Date.now() - 1000).toISOString() })
  const rq = await rpc('requeue_stale_automation_jobs', {})
  const rd = await row(d)
  log('F5_REQUEUE', { requeued: rq.j, status: rd.status, attemptPreserved: rd.attempt_count === 1 })
  const c2 = await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 's4-runner', p_batch: 1, p_lease_minutes: 5 })
  const w2 = (c2.j || []).find(r => r.id === d)
  log('F5_SECOND_CLAIM', { won: !!w2, attempt: w2 && w2.attempt_count })
  // --- S4-04 OD-6: ai_timeout → base 120 in [96,144], max 2 attempts ---
  log('OD6_ENQUEUE', await enq(t, { p_max_attempts: 3 }))
  await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 's4-runner', p_batch: 1, p_lease_minutes: 5 })
  const ft1 = await rpc('fail_automation_job', { p_id: t, p_error: 'synthetic ai timeout', p_reason: 'ai_timeout', p_retryable: true })
  const rt = await row(t)
  const dt = (new Date(rt.next_retry_at) - new Date(rt.updated_at)) / 1000
  log('OD6_ATTEMPT1', { result: ft1.j, base120_in_bounds: dt >= 96 && dt <= 144, actualSec: Math.round(dt) })
  await ffwd(t)
  await rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 's4-runner', p_batch: 1, p_lease_minutes: 5 })
  const ft2 = await rpc('fail_automation_job', { p_id: t, p_error: 'synthetic ai timeout 2', p_reason: 'ai_timeout', p_retryable: true })
  const rt2 = await row(t)
  log('OD6_ATTEMPT2_DEAD', { result: ft2.j, attempt: rt2.attempt_count, status: rt2.status })
  // --- S4-06 concurrency: N concurrent enqueues same identity → 1 canonical identity ---
  const enqN = await Promise.all(Array.from({ length: 8 }, () => enq(cc)))
  const enqOk = enqN.filter(r => r.j === 'ENQUEUED').length
  const enqDup = enqN.filter(r => r.j === 'DUPLICATE').length
  log('S4_06_CONCURRENT_ENQUEUE', { attempts: 8, enqueued: enqOk, duplicates: enqDup, exactlyOne: enqOk === 1 && enqDup === 7 })
  const clmN = await Promise.all(Array.from({ length: 8 }, () => rpc('claim_automation_jobs', { p_job_type: 'synthetic_selftest', p_worker: 'conc', p_batch: 1, p_lease_minutes: 5 })))
  const winIds = clmN.flatMap(r => (r.j || []).map(x => x.id))
  log('S4_06_CONCURRENT_CLAIM', { winners: winIds.length, oneWinner: winIds.length === 1 && winIds[0] === cc })
  // --- S4-07 security negatives ---
  const anonEnq = await rpc('enqueue_automation_job', { p_id: 'should-not-exist-anon', p_job_type: 'x', p_worker: 'x' }, ANON)
  log('S4_07_ANON_ENQUEUE', { status: anonEnq.status, denied: anonEnq.status === 401 || anonEnq.status === 403 || anonEnq.status === 404 })
  let authTok = null
  if (ADMIN_EMAIL && ADMIN_PW) {
    const lr = await fetch(SB + '/auth/v1/token?grant=password', { method: 'POST', headers: mk(ANON), body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PW }) })
    log('S4_07_LOGIN', { status: lr.status, gotToken: lr.ok && !!(await lr.clone().json().catch(() => ({}))).access_token })
    if (lr.ok) authTok = ((await lr.json()) || {}).access_token
  }
  if (authTok) {
    const authEnq = await rest(authTok, 'POST', '/rest/v1/rpc/enqueue_automation_job', { p_id: 'should-not-exist-auth', p_job_type: 'x', p_worker: 'x' })
    log('S4_07_AUTHED_ENQUEUE', { status: authEnq.status, denied: authEnq.status === 401 || authEnq.status === 403 || authEnq.status === 404 })
    const authTbl = await rest(authTok, 'GET', '/rest/v1/automation_queue?select=id&limit=1')
    log('S4_07_AUTHED_TABLE_READ', { status: authTbl.status, denied: (authTbl.j || []).length === 0 }) // RLS 0 policies → empty
  } else log('S4_07_AUTHED_ENQUEUE', { skipped: 'login failed or no creds' })
  const wrongTok = await rpc('enqueue_automation_job', { p_id: 'should-not-exist-wrong', p_job_type: 'x', p_worker: 'x' }, ANON)
  log('S4_07_WRONG_CALLER', { status: wrongTok.status, denied: wrongTok.status !== 200 })
  const inject = await enq(s, { p_payload: { synthetic: true, tenant_id: 'injected', brand_id: 'injected', is_admin: true, service_role_key: 'injected-cred', openrouter_api_key: 'injected-cred' } })
  const rInj = await row(s)
  log('S4_07_AUTHORITY_INJECTION', { enqueueResult: inject.j, payloadStoredAsOpaqueData: !!rInj.payload.tenant_id, noAuthorityColumn: !('tenant_id' in rInj) && !('brand_id' in rInj) && !('is_admin' in rInj) })
  // --- S4-10 cleanup: exact synthetic IDs only ---
  const ids = [a, b, c, d, t, cc, s, String(rp.j)]
  const del = await rest(SERVICE, 'DELETE', '/rest/v1/automation_queue?id=in.(' + ids.join(',') + ')')
  const chk = await rest(SERVICE, 'GET', '/rest/v1/automation_queue?select=id&id=in.(' + ids.join(',') + ')')
  const res = await rest(SERVICE, 'GET', '/rest/v1/automation_queue?select=id&id=like.g8s4-synth-*')
  log('CLEANUP', { deleteStatus: del.status, remainingExact: (chk.j || []).length, residueSynthetic: (res.j || []).length })
  fs.writeFileSync('e2e/g8s4-runtime-evidence.json', JSON.stringify(out, null, 2))
  console.log('EVIDENCE_SAVED')
})().catch(e => { console.log('RUNTIME_ERR ' + e.message); process.exit(1) })