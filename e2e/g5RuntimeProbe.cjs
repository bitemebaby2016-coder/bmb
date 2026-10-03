// ============================================
// BMB G5 — ai-proxy runtime verification probe (STEP 12)
// Read-only verification: NO business mutation, NO persistent data,
// minimal free-model AI traffic (2 inference calls max).
// Reads .env itself; prints NO secret values.
// ============================================
const fs = require('node:fs')

const env = {}
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const BASE = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const ANON = env.VITE_SUPABASE_ANON_KEY || ''
if (!BASE || !ANON) { console.log('SKIP: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'); process.exit(0) }
const URL = `${BASE}/functions/v1/ai-proxy`

async function probe(name, body, withAuth) {
  const headers = { 'Content-Type': 'application/json' }
  if (withAuth) { headers.Authorization = `Bearer ${ANON}`; headers.apikey = ANON }
  try {
    const r = await fetch(URL, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })
    const text = await r.text()
    let out
    try { out = JSON.parse(text) } catch { out = { raw: text.slice(0, 120) } }
    const summary = {
      status: r.status,
      error: out.error,
      routing: out.routing,
      hasContent: !!(out.data?.choices?.[0]?.message?.content),
      text: out.text ? String(out.text).slice(0, 40) : undefined,
    }
    console.log(`${name}: ${JSON.stringify(summary)}`)
    return { name, status: r.status, out }
  } catch (e) {
    console.log(`${name}: EXCEPTION ${String(e).slice(0, 120)}`)
    return { name, status: 0 }
  }
}

;(async () => {
  const results = []
  // 1) no auth → 401
  results.push(await probe('R1_no_auth_expect_401', { messages: [{ role: 'user', content: 'hi' }] }, false))
  // 2) valid guest chat → 200 + routing evidence (1 inference call, free model)
  results.push(await probe('R2_valid_chat_expect_200', { messages: [{ role: 'user', content: 'ตอบสั้น ๆ คำเดียว: สวัสดี' }], maxTokens: 20 }, true))
  // 3) arbitrary model injection → gateway must ignore it (still 200, policy model)
  results.push(await probe('R3_model_injection_expect_policy_model', { messages: [{ role: 'user', content: 'ตอบว่า ok' }], model: 'openai/gpt-4o', maxTokens: 10 }, true))
  // 4) reserved social task → 400
  results.push(await probe('R4_reserved_social_task_expect_400', { messages: [{ role: 'user', content: 'hi' }], task: 'social_reply_draft' }, true))
  // 5) invalid task → 400
  results.push(await probe('R5_invalid_task_expect_400', { messages: [{ role: 'user', content: 'hi' }], task: 'not_a_task' }, true))
  // 6) provider/endpoint injection keys must be dead → still normal 200/400 shape
  results.push(await probe('R6_provider_injection_dead_keys', { messages: [{ role: 'user', content: 'hi' }], provider: 'https://evil.example.com', endpoint: 'https://evil.example.com/v1', task: 'not_a_task' }, true))

  const checks = {
    R1_no_auth_expect_401: results[0].status === 401,
    R2_valid_chat_expect_200: results[1].status === 200 && results[1].out?.routing?.task === 'chat',
    R3_model_injection_expect_policy_model: results[2].status === 200 && results[2].out?.routing?.model === 'qwen/qwen3.7-flash' && results[2].out?.routing?.client_model_accepted === false,
    R4_reserved_social_task_expect_400: results[3].status === 400 && results[3].out?.error === 'task_reserved_not_active',
    R5_invalid_task_expect_400: results[4].status === 400 && results[4].out?.error === 'invalid_task',
    R6_provider_injection_dead_keys: results[5].status === 400 && results[5].out?.error === 'invalid_task',
  }
  console.log('SUMMARY ' + JSON.stringify(checks))
  const pass = Object.values(checks).every(Boolean)
  console.log(pass ? 'G5 RUNTIME PROBE = PASS' : 'G5 RUNTIME PROBE = FAIL')
  process.exit(pass ? 0 : 1)
})()