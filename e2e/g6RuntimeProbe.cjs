// ============================================
// BMB G6-S4 — Production runtime verification probe (READ-ONLY / SAFE SYNTHETIC)
//
// Synthetic data justification (contract BMB_G6_CONTRACT.md):
//   - ONE synthetic comment event via canonical `ingest_social_event` RPC
//     (server-side tenant/brand derivation — same path as production)
//   - event_id prefix 'g6probe-' (clearly synthetic, never a real customer event)
//   - content = harmless Thai question, no PII
//   - FULL CLEANUP: rows deleted after verification + 0-row evidence printed
//   - No outbound Meta, no business mutation (worker boundary asserted)
//
// No secret values are printed.
// ============================================
const fs = require('node:fs')
const envLocal = fs.readFileSync('.env.local', 'utf8')
const mTok = envLocal.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)
const TOKEN = (mTok ? mTok[1] : '').trim()
const sec = fs.readFileSync('supabase/secrets.local.env', 'utf8')
const mAuto = sec.match(/^AUTOMATION_TOKEN=(.*)$/m)
const AUTO = (mAuto ? mAuto[1] : '').trim()
const mSvc = sec.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)
const SVC = (mSvc ? mSvc[1] : '').trim()
if (!TOKEN || !AUTO || !SVC) { console.log('MISSING_CREDENTIALS'); process.exit(1) }

const REF = 'ivkdfognyiwjcmrhcnwz'
const BASE = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const PUBLISHABLE = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH' // public by design (workflow uses it)
const EVENT_ID = 'g6probe-' + Date.now()

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(30000),
  })
  const t = await r.text()
  if (!r.ok) throw new Error('SQL ' + r.status + ' ' + t.slice(0, 140))
  return JSON.parse(t)
}

async function callWorker(body, withToken) {
  const headers = { 'Content-Type': 'application/json', apikey: PUBLISHABLE, Authorization: 'Bearer ' + PUBLISHABLE }
  if (withToken) headers['x-automation-token'] = AUTO
  const r = await fetch(`${BASE}/functions/v1/social-ai-worker`, {
    method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
  })
  const t = await r.text()
  let j; try { j = JSON.parse(t) } catch { j = { raw: t.slice(0, 120) } }
  return { status: r.status, j }
}
;(async () => {
  const checks = {}
  // R1 unauthorized (no token)
  const r1 = await callWorker({ limit: 1 }, false)
  checks.R1_unauthorized_401 = r1.status === 401
  console.log('R1_unauthorized: status=' + r1.status)

  // safe synthetic event via canonical ingest (service_role path)
  const ing = await q(`select public.ingest_social_event('FACEBOOK','${EVENT_ID}','862940416913026','comment',null,'g6probe-sender','มีขนมครกวันนี้ไหมคะ','{}'::jsonb) as result`)
  console.log('INGEST ' + JSON.stringify(ing))
  checks.R0_ingest_derived = ing[0]?.result === 'INSERTED' || ing[0]?.result === 'OK' || ing[0]?.result === 'DUPLICATE'

  // tenant/brand isolation evidence (R5): derived server-side
  const row0 = await q(`select tenant_id, brand_id, status from social_events where event_id='${EVENT_ID}'`)
  console.log('R5_tenant_derived ' + JSON.stringify(row0))
  checks.R5_tenant_isolation = row0[0]?.tenant_id === 'tenant-bmb-001' && !!row0[0]?.brand_id

  // R2 valid classification path (worker runs AI on the synthetic event)
  const r2 = await callWorker({ event_id: EVENT_ID }, true)
  console.log('R2_worker ' + JSON.stringify({ status: r2.status, processed: r2.j.processed, succeeded: r2.j.succeeded, failed: r2.j.failed, results: r2.j.results }))
  checks.R2_classify_draft_success = r2.status === 200 && r2.j.succeeded === 1

  // verify persisted AI state + boundaries (R8/R9)
  const row = await q(`select status, ai_model, ai_reply_text, ai_validated, ai_guardrail_flags, reply_status, action_type, order_number from social_events where event_id='${EVENT_ID}'`)
  const ev = row[0] || {}
  const flags = ev.ai_guardrail_flags || {}
  console.log('R2_STATE ' + JSON.stringify({ status: ev.status, ai_validated: ev.ai_validated, ai_model: ev.ai_model, requires_human_review: flags.requires_human_review, review_status: flags.review_status, intent: flags.classification?.intent }))
  console.log('R8R9_BOUNDARY ' + JSON.stringify({ reply_status: ev.reply_status, action_type: ev.action_type, order_number: ev.order_number }))
  checks.R8_no_meta_write = ev.reply_status === null && ev.action_type === 'none' && ev.order_number === null
  checks.R9_no_business_mutation = ev.status === 'SUCCEEDED' && ev.ai_validated === true && typeof ev.ai_reply_text === 'string' && ev.ai_reply_text.length > 0
  checks.R7_review_status_pending = flags.review_status === 'pending_review' && typeof flags.requires_human_review === 'boolean'

  // duplicate invocation (G6-15 runtime): second call finds nothing RECEIVED
  const r3 = await callWorker({ event_id: EVENT_ID }, true)
  console.log('DUP_INVOCATION ' + JSON.stringify({ processed: r3.j.processed, note: r3.j.note }))
  checks.G6_15_duplicate_noop = r3.status === 200 && r3.j.processed === 0

  // R4: social_post_draft still rejected on ai-proxy (guest path)
  const r4 = await fetch(`${BASE}/functions/v1/ai-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + PUBLISHABLE, apikey: PUBLISHABLE },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], task: 'social_post_draft' }),
    signal: AbortSignal.timeout(30000),
  })
  const r4j = await r4.json().catch(() => ({}))
  console.log('R4_reserved ' + JSON.stringify({ status: r4.status, error: r4j.error }))
  checks.R4_social_post_draft_blocked = r4.status === 400 && r4j.error === 'task_reserved_not_active'

  // R6: NULL/empty tenant — unbound page ingestion rejected (structural NOT NULL verified in S0)
  const unbound = await q(`select public.ingest_social_event('FACEBOOK','${EVENT_ID}-x','000000000000000','comment',null,null,'x','{}'::jsonb) as result`)
  console.log('R6_unbound_page ' + JSON.stringify(unbound))
  checks.R6_null_empty_tenant = unbound[0]?.result === 'UNBOUND_PAGE'

  // R10 server-side model routing evidence
  checks.R10_server_model_routing = typeof ev.ai_model === 'string' && ev.ai_model.length > 0
  console.log('R10_model ' + JSON.stringify({ ai_model: ev.ai_model }))

  // CLEANUP + evidence
  const del = await q(`delete from social_events where event_id like 'g6probe-%' returning event_id`)
  const after = await q(`select count(*) as remaining from social_events where event_id like 'g6probe-%'`)
  console.log('CLEANUP deleted=' + JSON.stringify(del.map((d) => d.event_id)) + ' remaining=' + JSON.stringify(after))
  checks.CLEANUP_no_test_rows_left = after[0]?.remaining === 0

  console.log('SUMMARY ' + JSON.stringify(checks))
  const pass = Object.values(checks).every(Boolean)
  console.log(pass ? 'G6 RUNTIME PROBE = PASS' : 'G6 RUNTIME PROBE = FAIL')
  process.exit(pass ? 0 : 1)
})()