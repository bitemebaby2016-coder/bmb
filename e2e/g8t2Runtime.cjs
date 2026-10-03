// G8-T2 — runtime verification of queue-enqueue transport (synthetic only)
const fs = require('fs')
const SERVICE = (/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
const TOKEN = (/^AUTOMATION_TOKEN=(.*)$/m.exec(fs.readFileSync('supabase/secrets.local.env', 'utf8')) || [])[1]
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const EF = SB + '/functions/v1/queue-enqueue'
const TS = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').toLowerCase()
const out = []
const log = (k, v) => { out.push(k + '=' + JSON.stringify(v)); console.log(k + '=' + JSON.stringify(v)) }
const call = async (tok, body) => {
  const r = await fetch(EF, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-automation-token': tok || '', apikey: 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const j = await r.json().catch(() => null)
  return { status: r.status, j }
}
const row = async (qid) => {
  const r = await fetch(SB + '/rest/v1/automation_queue?select=*&id=eq.' + qid, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
  return (await r.json())[0]
}
;(async () => {
  const ref = 'g8t2s-' + TS
  const ids = []
  // --- POSITIVE 1: valid trusted caller → ENQUEUED ---
  const p1 = await call(TOKEN, { job: 'synthetic_selftest', ref })
  ids.push('sched-synthetic_selftest-' + ref)
  const r1 = await row('sched-synthetic_selftest-' + ref)
  log('P1_VALID_ENQUEUE', { status: p1.status, result: p1.j && p1.j.result, rowStatus: r1 && r1.status, payload: r1 && r1.payload, maxAttempts: r1 && r1.max_attempts, worker: r1 && r1.worker })
  // --- POSITIVE 2: duplicate identity → DUPLICATE / NO-OP ---
  const p2 = await call(TOKEN, { job: 'synthetic_selftest', ref })
  const r1b = await row('sched-synthetic_selftest-' + ref)
  log('P2_DUPLICATE', { status: p2.status, result: p2.j && p2.j.result, duplicate: p2.j && p2.j.duplicate, attemptUnchanged: r1b.attempt_count === 0, statusUnchanged: r1b.status === 'queued' })
  // --- POSITIVE 3: legacy-contract template through transport (no business execution) ---
  const p3 = await call(TOKEN, { job: 'notification_dispatch', ref: ref + '-nd', params: { lookbackMinutes: 360, limit: 200 } })
  ids.push('sched-notification_dispatch-' + ref + '-nd')
  const r3 = await row('sched-notification_dispatch-' + ref + '-nd')
  log('P3_LEGACY_TEMPLATE', { status: p3.status, result: p3.j && p3.j.result, payload: r3 && r3.payload, worker: r3 && r3.worker })
  // --- POSITIVE 4: 8 concurrent same identity → exactly one ENQUEUED ---
  const cref = ref + '-cc'
  const cs = await Promise.all(Array.from({ length: 8 }, () => call(TOKEN, { job: 'synthetic_selftest', ref: cref })))
  ids.push('sched-synthetic_selftest-' + cref)
  const enq = cs.filter(c => c.j && c.j.result === 'ENQUEUED').length
  const dup = cs.filter(c => c.j && c.j.result === 'DUPLICATE').length
  log('P4_CONCURRENT_ENQUEUE', { attempts: 8, enqueued: enq, duplicates: dup, exactlyOne: enq === 1 && dup === 7 })
  // --- NEGATIVE 4/5: no token / wrong token ---
  const n1 = await call('', { job: 'synthetic_selftest', ref: ref + '-x1' })
  const n2 = await call('wrong-token', { job: 'synthetic_selftest', ref: ref + '-x2' })
  log('N1_NO_TOKEN', { status: n1.status, denied: n1.status === 401 })
  log('N2_WRONG_TOKEN', { status: n2.status, denied: n2.status === 401 })
  // --- NEGATIVE 6: malformed payload ---
  const n3 = await call(TOKEN, '{"job": broken')
  log('N3_MALFORMED', { status: n3.status, denied: n3.status === 400 })
  // --- NEGATIVE 7: arbitrary job type ---
  const n4 = await call(TOKEN, { job: 'drop_table_everything', ref: ref + '-x3' })
  log('N4_UNKNOWN_JOB', { status: n4.status, denied: n4.status === 400 })
  // --- NEGATIVE 6b: invalid identity + invalid params ---
  const n5 = await call(TOKEN, { job: 'synthetic_selftest', ref: 'UPPER../injection' })
  const n6 = await call(TOKEN, { job: 'notification_dispatch', ref: ref + '-x4', params: { lookbackMinutes: 99999 } })
  log('N5_INVALID_REF', { status: n5.status, denied: n5.status === 400 })
  log('N6_INVALID_PARAMS', { status: n6.status, denied: n6.status === 400 })
  // --- NEGATIVE 8/9: authority + credential injection (must be IGNORED, not forwarded) ---
  const n7 = await call(TOKEN, { job: 'synthetic_selftest', ref: ref + '-x5', params: { tenant_id: 'inj', brand_id: 'inj', is_admin: true, service_role_key: 'inj', attempt_count: 99, status: 'dead' } })
  ids.push('sched-synthetic_selftest-' + ref + '-x5')
  const r7 = await row('sched-synthetic_selftest-' + ref + '-x5')
  const injKeys = r7 && Object.keys(r7.payload || {}).filter(k => k !== 'synthetic')
  log('N7_INJECTION_IGNORED', { status: n7.status, extraPayloadKeys: injKeys, attemptUntouched: r7.attempt_count === 0, statusQueued: r7.status === 'queued', noAuthorityColumns: !('tenant_id' in r7) && !('brand_id' in r7) && !('is_admin' in r7) })
  // --- NEGATIVE 10: arbitrary RPC/table injection — impossible by design (no proxy) ---
  const n8 = await call(TOKEN, { rpc: 'fail_automation_job', table: 'orders', sql: 'select 1', fn: 'claim_automation_jobs', ref: ref + '-x6' })
  log('N8_NO_PROXY', { status: n8.status, note: n8.status === 400 ? 'unknown job — no generic RPC/table path exists' : 'UNEXPECTED' })
  // --- CLEANUP: exact synthetic IDs ---
  const del = await fetch(SB + '/rest/v1/automation_queue?id=in.(' + ids.join(',') + ')', { method: 'DELETE', headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
  const chk = await fetch(SB + '/rest/v1/automation_queue?select=id&id=like.sched-synthetic_selftest-g8t2s-*', { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
  const res = (await chk.json()).length
  log('CLEANUP', { deleteStatus: del.status, residueSynthetic: res })
  fs.writeFileSync('e2e/g8t2-runtime-evidence.json', JSON.stringify(out, null, 2))
  console.log('EVIDENCE_SAVED')
})().catch(e => { console.log('RUNTIME_ERR ' + e.message); process.exit(1) })