// ============================================
// G3 webhook boundary harness (executable, ISOLATED/test-only).
// Runs supabase/functions/channel-webhook/index.ts SOURCE via Node 24
// type-stripping with a Deno shim + stubbed PostgREST fetch. Asserts the
// Owner hard-constraint boundary: fail-closed secret, HMAC, object
// validation, server-side page allowlist rejection, durable ingest result
// propagation. Exit nonzero on any failure.
// ============================================
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createHmac } from 'node:crypto'
import { join } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'supabase', 'functions', 'channel-webhook', 'index.ts')
let failures = 0
function check(name, cond) {
  if (cond) console.log('PASS ' + name)
  else { failures++; console.log('FAIL ' + name) }
}

const BASE_ENV = {
  SUPABASE_URL: 'http://sb.local',
  SUPABASE_SERVICE_ROLE_KEY: 'srk-test',
  CHANNEL_WEBHOOK_APP_SECRET: 'sec-test',
  CHANNEL_WEBHOOK_VERIFY_TOKEN: 'vt-test',
}

async function loadHandler(envOverrides = {}) {
  const env = { ...BASE_ENV, ...envOverrides }
  const calls = []
  globalThis.Deno = {
    env: { get: (k) => (k in env ? env[k] : null) },
    serve: (h) => { globalThis.__g3Handler = h },
  }
  const stubFetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    calls.push({ url, init })
    let body = null
    try { body = JSON.parse(init && init.body ? init.body : 'null') } catch { /* ignore */ }
    if (url.includes('/rpc/ingest_social_event')) {
      const verdict =
        body && body.p_page_id === 'page-BOUND'
          ? (body.p_event_id === 'evt-dup' ? 'DUPLICATE' : 'INSERTED')
          : 'UNBOUND_PAGE'
      return new Response(JSON.stringify([verdict]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.includes('/audit_logs')) return new Response('[]', { status: 200 })
    if (url.includes('/customer_channel_identities')) return new Response('[]', { status: 200 })
    if (url.includes('/rpc/create_order_with_items')) return new Response(JSON.stringify({ order_number: 'BMB-X' }), { status: 200 })
    return new Response('{}', { status: 200 })
  }
  globalThis.fetch = stubFetch
  // unique import query per load = fresh module instance (fresh env constants)
  const mod = await import(pathToFileURL(SRC).href + '?v=' + Math.random())
  return { calls }
}

function messengerPayload(pageId, mid) {
  return JSON.stringify({ object: 'page', entry: [{ id: pageId, time: 1, messaging: [{ sender: { id: 'u1' }, message: { mid, text: 'hello' } }] }] })
}
function signed(body, secret) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}
// ===== 1. fail-closed: APP_SECRET missing -> 500 before processing =====
{
  const { calls } = await loadHandler({ CHANNEL_WEBHOOK_APP_SECRET: '' })
  const handler = globalThis.__g3Handler
  const body = messengerPayload('page-BOUND', 'm-1')
  const res = await handler(new Request('http://x/channel-webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': signed(body, 'sec-test') } }))
  check('1 fail-closed secret-missing -> 500 (no processing)', res.status === 500 && calls.length === 0)
}

// ===== 2. invalid HMAC -> 401 before any fetch =====
{
  const { calls } = await loadHandler()
  const handler = globalThis.__g3Handler
  const body = messengerPayload('page-BOUND', 'm-2')
  const res = await handler(new Request('http://x/channel-webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=deadbeef' } }))
  check('2 invalid HMAC -> 401 (no fetch side effects)', res.status === 401 && calls.length === 0)
}

// ===== 3. GET verification with missing VERIFY_TOKEN -> fail-closed 500 =====
{
  await loadHandler({ CHANNEL_WEBHOOK_VERIFY_TOKEN: '' })
  const handler = globalThis.__g3Handler
  const res = await handler(new Request('http://x/channel-webhook?hub.mode=subscribe&hub.verify_token=x&hub.challenge=c'))
  check('3 GET verify-token missing -> fail-closed 500', res.status === 500)
}

// ===== 4. valid HMAC + unbound page -> rejected (allowlist) + audited =====
{
  const { calls } = await loadHandler()
  const handler = globalThis.__g3Handler
  const body = messengerPayload('page-UNKNOWN', 'm-4')
  const res = await handler(new Request('http://x/channel-webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': signed(body, 'sec-test'), 'content-type': 'application/json' } }))
  const out = (await res.json()).entries[0]
  const audited = calls.some((c) => c.url.includes('/audit_logs') && c.init && String(c.init.body).includes('channel_event_rejected'))
  check('4 unbound page -> page_unbound=true', out && out.results && out.results.page_unbound === true)
  check('4 unbound page -> rejection audited', audited)
  check('4 unbound page -> NO order path', !calls.some((c) => c.url.includes('create_order_with_items')))
}

// ===== 5. valid HMAC + bound page -> ingest INSERTED, tenant NEVER in request =====
{
  const { calls } = await loadHandler()
  const handler = globalThis.__g3Handler
  const body = messengerPayload('page-BOUND', 'm-5')
  const res = await handler(new Request('http://x/channel-webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': signed(body, 'sec-test'), 'content-type': 'application/json' } }))
  const out = (await res.json()).entries[0]
  const rpcCall = calls.find((c) => c.url.includes('/rpc/ingest_social_event'))
  const rpcBody = rpcCall && JSON.parse(rpcCall.init.body)
  check('5 ingest called with INSERTED result', out && out.results && out.results.social_event === 'INSERTED')
  check('5 ingest args: platform/event/page derived server-side', rpcBody && rpcBody.p_platform === 'MESSENGER' && rpcBody.p_event_id === 'msg-m-5' && rpcBody.p_page_id === 'page-BOUND')
  check('5 NO caller-supplied tenant field in ingest call', rpcBody && !('p_tenant_id' in rpcBody) && !('tenant_id' in rpcBody))
}

// ===== 6. duplicate event -> DUPLICATE propagated =====
{
  await loadHandler()
  const handler = globalThis.__g3Handler
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.includes('/rpc/ingest_social_event')) return new Response(JSON.stringify(['DUPLICATE']), { status: 200 })
    if (url.includes('/audit_logs')) return new Response('[]', { status: 200 })
    if (url.includes('/customer_channel_identities')) return new Response('[]', { status: 200 })
    return new Response('{}', { status: 200 })
  }
  const body = messengerPayload('page-BOUND', 'm-6')
  const res = await handler(new Request('http://x/channel-webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': signed(body, 'sec-test'), 'content-type': 'application/json' } }))
  const out = (await res.json()).entries[0]
  check('6 duplicate -> social_event=DUPLICATE recorded', out && out.results && out.results.social_event === 'DUPLICATE')
}

// ===== 7. unsupported object type -> 400 =====
{
  await loadHandler()
  const handler = globalThis.__g3Handler
  const body = JSON.stringify({ object: 'instagram', entry: [] })
  const res = await handler(new Request('http://x/channel-webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': signed(body, 'sec-test') } }))
  check('7 unsupported object -> 400', res.status === 400)
}

console.log(failures === 0 ? 'ALL G3 WEBHOOK BOUNDARY TESTS PASSED' : 'G3 WEBHOOK BOUNDARY FAILURES=' + failures)
process.exit(failures === 0 ? 0 : 1)
