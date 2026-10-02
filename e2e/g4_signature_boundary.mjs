// ============================================
// G4/D4-2 signature boundary tests (executable, test-only).
// Runs the REAL channel-webhook source via Node type-stripping. Proves the
// constant-time comparison code path behaviorally: valid/invalid/malformed
// signatures, missing secret, and raw-body integrity (sign A, send B).
// Exit nonzero on any failure.
// ============================================
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createHmac } from 'node:crypto'
import { join } from 'node:path'

const SRC = join(process.cwd(), 'supabase', 'functions', 'channel-webhook', 'index.ts')
const SRC_TEXT = readFileSync(SRC, 'utf8')
let failures = 0
const check = (n, c) => { if (c) console.log('PASS ' + n); else { failures++; console.log('FAIL ' + n) } }

const ENV = {
  SUPABASE_URL: 'http://sb.local',
  SUPABASE_SERVICE_ROLE_KEY: 'srk-test',
  CHANNEL_WEBHOOK_APP_SECRET: 'sec-test',
  CHANNEL_WEBHOOK_VERIFY_TOKEN: 'vt-test',
}
async function load(envOverrides = {}) {
  const env = { ...ENV, ...envOverrides }
  globalThis.Deno = { env: { get: (k) => (k in env ? env[k] : null) }, serve: (h) => { globalThis.__g4Handler = h } }
  globalThis.fetch = async () => { throw new Error('fetch must not be reached before signature verification') }
  await import(pathToFileURL(SRC).href + '?v=' + Math.random())
  return globalThis.__g4Handler
}
const body = () => JSON.stringify({ object: 'page', entry: [{ id: 'p1', time: 1, messaging: [{ sender: { id: 'u' }, message: { mid: 'm', text: 'hi' } }] }] })
const sign = (b, s) => 'sha256=' + createHmac('sha256', s).update(b).digest('hex')

// 1. implementation actually wired into the verification code path
check('1 timingSafeEqualHex defined and used in verification', SRC_TEXT.includes('function timingSafeEqualHex') && /if \(!sig \|\| !timingSafeEqualHex\(sig, expected\)\)/.test(SRC_TEXT))
check('1b plain string comparison removed from signature gate', !/if \(!sig \|\| sig !== expected\)/.test(SRC_TEXT))

// 2. valid signature passes verification (fetch reached = verification OK)
{
  const handler = await load()
  const b = body()
  globalThis.fetch = async () => new Response('[]', { status: 200 })
  const res = await handler(new Request('http://x/cw', { method: 'POST', body: b, headers: { 'x-hub-signature-256': sign(b, 'sec-test') } }))
  check('2 valid signature -> verification passed (status 200)', res.status === 200)
}

// 3. invalid signature (different secret) -> 401, no downstream fetch
{
  const handler = await load()
  const b = body()
  const res = await handler(new Request('http://x/cw', { method: 'POST', body: b, headers: { 'x-hub-signature-256': sign(b, 'WRONG-SECRET') } }))
  check('3 invalid signature -> 401', res.status === 401)
}

// 4. malformed signatures (missing prefix / short / wrong case) -> 401
{
  const handler = await load()
  const b = body()
  for (const bad of ['deadbeef', 'sha256=short', sign(b, 'sec-test').toUpperCase(), 'md5=' + 'a'.repeat(64)]) {
    const res = await handler(new Request('http://x/cw', { method: 'POST', body: b, headers: { 'x-hub-signature-256': bad } }))
    check('4 malformed signature rejected: ' + bad.slice(0, 24) + '...', res.status === 401)
  }
}

// 5. missing signature header -> 401
{
  const handler = await load()
  const res = await handler(new Request('http://x/cw', { method: 'POST', body: body() }))
  check('5 missing signature -> 401', res.status === 401)
}

// 6. missing secret -> 500 fail-closed BEFORE any body processing
{
  const handler = await load({ CHANNEL_WEBHOOK_APP_SECRET: '' })
  const b = body()
  const res = await handler(new Request('http://x/cw', { method: 'POST', body: b, headers: { 'x-hub-signature-256': sign(b, 'sec-test') } }))
  check('6 missing secret -> 500 fail-closed', res.status === 500)
}

// 7. raw-body integrity: sign body A, send modified body B -> 401
{
  const handler = await load()
  const a = body()
  const b = body().replace('hi', 'EVIL')
  const res = await handler(new Request('http://x/cw', { method: 'POST', body: b, headers: { 'x-hub-signature-256': sign(a, 'sec-test') } }))
  check('7 raw-body integrity (sign A send B) -> 401', res.status === 401)
}

console.log(failures === 0 ? 'ALL G4 SIGNATURE BOUNDARY TESTS PASSED' : 'G4 SIGNATURE FAILURES=' + failures)
process.exit(failures === 0 ? 0 : 1)
