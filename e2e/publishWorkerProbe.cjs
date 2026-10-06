// ============================================
// publishWorkerProbe — negative-path verification for social-publish-worker
//   node e2e/publishWorkerProbe.cjs
// READ-ONLY: never publishes a real post. Verifies the auth/argument/boundary
// surfaces the Owner audit cares about.
// ============================================
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const SERVICE = (() => {
  const raw = fs.readFileSync(path.join(ROOT, 'supabase', 'secrets.local.env'), 'utf8')
  const m = raw.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)
  return m ? m[1].trim() : ''
})()

const URL = (env.VITE_SUPABASE_URL || 'https://ivkdfognyiwjcmrhcnwz.supabase.co') + '/functions/v1/social-publish-worker'

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

async function post(headers, body) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* non-JSON */ }
  return { status: r.status, json, text }
}

async function main() {
  console.log('--- social-publish-worker negative probe ---')

  // 1) anon / automation-token callers are refused
  const anon = await post({ apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.VITE_SUPABASE_ANON_KEY }, {})
  check('anon caller refused', anon.status === 401, `HTTP ${anon.status}`)

  // 2) service_role but empty body → argument error (not a crash)
  const svcHeaders = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
  const empty = await post(svcHeaders, {})
  check('empty body → 400 ERR_INVALID_APPROVAL', empty.status === 400 && empty.json?.error === 'ERR_INVALID_APPROVAL',
    `HTTP ${empty.status} ${empty.json?.error || empty.text.slice(0, 60)}`)

  // 3) invalid json → 400
  const bad = await fetch(URL, { method: 'POST', headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' }, body: 'not-json' })
  check('invalid json → 400', bad.status === 400, `HTTP ${bad.status}`)

  // 4) nonexistent approval → 404 (never invents a post)
  const missing = await post(svcHeaders, { approvalId: 'probe-nonexistent-approval' })
  check('nonexistent approval → 404 ERR_APPROVAL_NOT_FOUND',
    missing.status === 404 && missing.json?.error === 'ERR_APPROVAL_NOT_FOUND',
    `HTTP ${missing.status} ${missing.json?.error || missing.text.slice(0, 60)}`)

  // 5) G7 boundary: a non-approved draft is refused — probe the REAL pending
  //    draft path without touching Meta (a pending row cannot be published, and
  //    the worker must say so BEFORE any Meta call).
  const pendingRes = await fetch((env.VITE_SUPABASE_URL || 'https://ivkdfognyiwjcmrhcnwz.supabase.co') +
    '/rest/v1/content_approvals?select=id,status,content_type&content_type=eq.post&status=eq.pending&limit=1',
    { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
  const pending = await pendingRes.json().catch(() => [])
  if (Array.isArray(pending) && pending.length > 0) {
    const notApproved = await post(svcHeaders, { approvalId: pending[0].id })
    check('PENDING draft refused (G7 boundary holds) → 409 ERR_APPROVAL_NOT_PENDING',
      notApproved.status === 409 && notApproved.json?.error === 'ERR_APPROVAL_NOT_PENDING',
      `HTTP ${notApproved.status} ${notApproved.json?.error || ''}`)
  } else {
    check('PENDING draft refused (no pending draft available to probe)', true, 'skipped — 0 pending rows')
  }

  console.log(`--- PUBLISH_WORKER_RESULT: ${pass} pass / ${fail} fail ---`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('PUBLISH_WORKER_PROBE_ERROR: ' + e.message); process.exit(1) })