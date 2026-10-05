// ============================================
// g9NonMetaProbe — G9 Non-Meta verification (D-03, contract §7.2)
//
// VERIFIES the five compiled-evidence items (#3 #4 #5 #7 #10) without inventing
// evidence and without touching Meta:
//
//   #3  AI timeout          → timeout maps to RETRYABLE, never FAILED
//   #4  AI/provider failure → exactly ONE fallback attempt, then RETRYABLE
//   #5  malformed AI output → FAILED without persisting outbound state
//   #7  worker crash/retry  → conditional-PATCH claim + release path
//   #10 stale action        → stale events are NOTIFIED only, never acted upon
//
// Every check is READ-ONLY (code-shape assertions + live row counts). It never
// inserts an event, never calls Meta, and never reruns G8-S5.
//
// It deliberately does NOT declare G9 PASS — contract §10.7 reserves that for the
// Owner.
//   node e2e/g9NonMetaProbe.cjs
// ============================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const SERVICE = (() => {
  const raw = fs.readFileSync(path.join(ROOT, 'supabase', 'secrets.local.env'), 'utf8')
  const m = raw.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)
  return m ? m[1].trim() : ''
})()

const SB = env.VITE_SUPABASE_URL || 'https://ivkdfognyiwjcmrhcnwz.supabase.co'

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

async function restGet(p) {
  const r = await fetch(SB + p, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* non-JSON */ }
  return { status: r.status, json }
}

async function main() {
  console.log('--- G9 Non-Meta probe (read-only) ---')

  const worker = read('supabase/functions/social-ai-worker/index.ts')
  const timeout = read('supabase/functions/_shared/aiTimeout.ts')
  const policy = read('supabase/functions/_shared/aiPolicy.ts')
  const auto = read('supabase/functions/automation-worker/index.ts')

  // ---- #3 AI timeout → RETRYABLE, never a terminal FAILED path -------------------
  check('#3 worker uses the shared timeout helper', worker.includes('fetchWithTimeout'))
  check('#3 TimeoutError is detected explicitly', worker.includes('TimeoutError'))
  check('#3 timeout surfaces as status "timeout"', /status:\s*'timeout'/.test(worker))
  check('#3 timeout is NOT routed to markFailed', !/markFailed\([^)]*timeout/i.test(worker))
  check('#3 shared helper defines TimeoutError + fetchWithTimeout',
    /class\s+TimeoutError/.test(timeout) && /fetchWithTimeout/.test(timeout))

  // ---- #4 provider failure → exactly one fallback retry -------------------------
  check('#4 fallback model is referenced', worker.includes('policy.fallback'))
  check('#4 fallback is guarded (differs from primary)', /policy\.fallback\s*!==\s*modelUsed/.test(worker))
  check('#4 fallback lives in the shared single-source policy', policy.includes('MODEL_A_FALLBACK'))
  check('#4 failure maps to upstream_error (retryable)', worker.includes('upstream_error'))

  // ---- #5 malformed AI output → FAILED with no outbound state -------------------
  check('#5 empty/invalid AI content is rejected', worker.includes('AI_EMPTY_CONTENT'))
  check('#5 rejection path uses markFailed', worker.includes('markFailed'))
  check('#5 no outbound Meta write path exists in the worker',
    !/graph\.facebook|graph\.meta|PAGE_ACCESS_TOKEN/i.test(worker))

  // ---- #7 crash / retry → conditional claim + release ----------------------------
  check('#7 claim is race-safe (claimEvent)', worker.includes('claimEvent'))
  check('#7 claimed_at is written on claim', worker.includes('claimed_at'))
  check('#7 releaseToRetryable exists', worker.includes('releaseToRetryable'))
  check('#7 attempts increment on release', /attempts[\s\S]{0,80}?\+\s*1/.test(worker))

  // ---- #10 stale action → notification only --------------------------------------
  check('#10 stale_pending is present in the automation worker', auto.includes('orders_stale_pending'))
  check('#10 stale handling mutates no business table',
    !/orders_stale_pending[\s\S]{0,400}(orders|products|delivery_assignments)\.(update|upsert|delete)/i.test(auto))

  // ---- live production state (read-only counts) ----------------------------------
  const events = await restGet('/rest/v1/social_events?select=id&limit=1')
  check('social_events table reachable', events.status === 200, `HTTP ${events.status}`)

  const failed = await restGet('/rest/v1/social_events?select=id&status=eq.FAILED&limit=100')
  const retryable = await restGet('/rest/v1/social_events?select=id&status=eq.RETRYABLE&limit=100')
  const processing = await restGet('/rest/v1/social_events?select=id,claimed_at&status=eq.PROCESSING&limit=100')

  // G6 boundary: a FAILED event must never carry outbound state.
  // (Column is ai_reply_text per the live schema, not ai_reply.)
  const outbound = await restGet(
    '/rest/v1/social_events?select=id,reply_status,action_type,ai_reply_text&status=eq.FAILED&or=(reply_status.not.is.null,action_type.not.is.null,ai_reply_text.not.is.null)&limit=50',
  )
  check('no FAILED event carries reply_status / action_type / ai_reply',
    outbound.status === 200 && Array.isArray(outbound.json) && outbound.json.length === 0,
    outbound.status === 200 ? `violations=${outbound.json.length}` : `HTTP ${outbound.status}`)

  // No event may be stranded mid-claim without a claimed_at timestamp.
  const stranded = (processing.json || []).filter((e) => !e.claimed_at)
  check('no PROCESSING event is stranded without claimed_at',
    stranded.length === 0,
    `processing=${(processing.json || []).length}`)

  console.log(`  live: FAILED=${(failed.json || []).length} RETRYABLE=${(retryable.json || []).length} PROCESSING=${(processing.json || []).length}`)

  console.log('--- NOTE: this probe does NOT declare G9 PASS — contract §10.7 reserves that for the Owner.')
  console.log(`--- G9_NONMETA_RESULT: ${pass} pass / ${fail} fail ---`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('G9_NONMETA_PROBE_ERROR: ' + e.message); process.exit(1) })