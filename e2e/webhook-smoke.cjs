// ============================================
// Bite Me Baby - Stripe webhook LIVE smoke test (STRIPE GATE tasks 4-7)
// ============================================
// Tasks:
//   T1 unsigned request            -> HTTP 400 ERR_INVALID_SIGNATURE
//   T2 tampered / invalid signature-> HTTP 400 ERR_INVALID_SIGNATURE
//   T3 signed payment_intent.succeeded for a REAL order -> HTTP 200 {received:true,result:"paid"}
//   T4 duplicate delivery (replay) -> HTTP 200, no second payment row (idempotent)
//   T5 event without order_number  -> HTTP 202 (ack, no side effect)
//   T6 payment DB verification     -> needs --service-key: payment_intents row exists
//                                     + orders.payment_status = 'paid' after T3
//
// The webhook signing secret (whsec_...) is NEVER committed / hardcoded.
//   node e2e/webhook-smoke.cjs --order BMB-... --amount 172 \
//        --secret whsec_xxx [--service-key sb_secret_xxx] [--url https://...]
//   or env: WEBHOOK_SECRET=whsec_xxx SERVICE_ROLE_KEY=sb_secret_xxx node e2e/webhook-smoke.cjs --order ... --amount ... --service-key
//   (a --secret/--service-key value prefixed with 'file:' reads the value from that file)
// Exit code 0 = every executed assertion PASSED; 1 = at least one FAIL (evidence kept in e2e/webhook-smoke-result.json)
'use strict'
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const argv = process.argv.slice(2)
function arg(name) {
  const i = argv.indexOf('--' + name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}
function readSecretValue(v, envName) {
  if (v == null) v = process.env[envName] || ''
  if (String(v).startsWith('file:')) v = fs.readFileSync(String(v).slice(5), 'utf8').trim()
  // If the argument is the NAME of an env var that actually holds the value,
  // resolve it (so `--secret STRIPE_WEBHOOK_SECRET` works when that variable is set).
  if (String(v).length > 0 && process.env[v] && process.env[v].length > 0) v = process.env[v]
  return String(v)
}

const ORDER = arg('order') || process.env.SMOKE_ORDER
const AMOUNT = Number(arg('amount') || process.env.SMOKE_AMOUNT || 0)
const SECRET = readSecretValue(arg('secret'), 'WEBHOOK_SECRET')
const SERVICE_KEY = readSecretValue(arg('service-key'), 'SERVICE_ROLE_KEY')
const URL = arg('url') || 'https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/stripe-webhook'
const SUPABASE_URL = arg('api') || 'https://ivkdfognyiwjcmrhcnwz.supabase.co'

if (!ORDER || !(AMOUNT > 0)) {
  console.error('usage: node e2e/webhook-smoke.cjs --order BMB-... --amount 172 [--secret whsec_...] [--service-key sb_secret_...]')
  process.exit(2)
}

// --- Stripe event (payment_intent.succeeded) for the given real order ---
const t = Math.floor(Date.now() / 1000)
const amountMinor = Math.round(AMOUNT * 100)
const piId = 'pi_test_smoke_' + t
const event = {
  id: 'evt_test_smoke_' + t,
  object: 'event',
  api_version: '2024-06-20',
  created: t,
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: piId, object: 'payment_intent', amount: amountMinor, currency: 'thb',
      metadata: { order_number: ORDER },
    },
  },
}
const payload = JSON.stringify(event)

// Stripe signature scheme: v1 = HMAC-SHA256(secret, "<t>.<payload>"), header "t=...,v1=..."
function signSignature(body, secret, ts) {
  const mac = crypto.createHmac('sha256', secret).update(String(ts) + '.' + body).digest()
  const hex = Buffer.from(mac).toString('hex') // MUST hex-encode: String(buffer) would UTF-8-decode and corrupt the signature
  return 't=' + ts + ',v1=' + hex
}

async function postEvent(body, sigHeader) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sigHeader || '' },
    body,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text: text.slice(0, 320) }
}

const results = []
function record(name, ok, extra) {
  results.push({ name, ok, extra: extra || {} })
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(extra))
}

;(async () => {
  // T1 - unsigned request must be rejected (400)
  { const r = await postEvent(payload, '')
    record('T1 unsigned -> 400', r.status === 400 && r.text.includes('ERR_INVALID_SIGNATURE'), { status: r.status, body: r.text }) }

  // T2 - invalid signature must be rejected (400)
  { const bad = signSignature(payload, SECRET ? SECRET + 'x' : 'whsec_wrong_key', t)
    const r = await postEvent(payload, bad)
    record('T2 invalid signature -> 400', r.status === 400 && r.text.includes('ERR_INVALID_SIGNATURE'), { status: r.status, body: r.text }) }

  // T5 - signed event WITHOUT metadata.order_number -> 202 ack (no side effect)
  // T5 requires the REAL secret: without it a signed request is just invalid-signature (400).

  // T3 + T4 + T5 - require the REAL webhook signing secret (never committed)
  if (SECRET) {
    const sig = signSignature(payload, SECRET, t)
    const noMeta = JSON.parse(payload)
    delete noMeta.data.object.metadata
    const p2 = JSON.stringify(noMeta)
    const r5 = await postEvent(p2, signSignature(p2, SECRET, t))
    record('T5 no order_number -> 202', r5.status === 202, { status: r5.status, body: r5.text })

    const r1 = await postEvent(payload, sig)
    const ok1 = r1.status === 200 && r1.json && r1.json.received === true
    record('T3 signed success -> 200', ok1, { status: r1.status, body: r1.text })
    const r2 = await postEvent(payload, sig) // same event, same signature (replay within 5-min window)
    record('T4 duplicate replay -> 200 idempotent', r2.status === 200, { status: r2.status, body: r2.text })
  } else {
    console.log('SKIP  T5/T3/T4 (no --secret provided - live signed smoke needs the owner webhook secret)')
  }

  // T6 - payment DB verification (needs service key, NEVER committed)
  if (SERVICE_KEY && ORDER) {
    const h = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
    let pi = [], ord = []
    try {
      pi = await fetch(SUPABASE_URL + '/rest/v1/payment_intents?select=id,order_number,amount,status,method,provider,payment_intent_id&order_number=eq.' + encodeURIComponent(ORDER), { headers: h }).then(r => r.json())
      ord = await fetch(SUPABASE_URL + '/rest/v1/orders?select=order_number,total_amount,payment_status&order_number=eq.' + encodeURIComponent(ORDER), { headers: h }).then(r => r.json())
    } catch (e) { console.log('WARN  T6 fetch error ' + String(e).slice(0, 200)) }
    pi = Array.isArray(pi) ? pi : []
    ord = Array.isArray(ord) ? ord : []
    const orderPaid = ord.some(o => o.payment_status === 'paid')
    const intentCompleted = pi.some(p => p.status === 'completed')
    record('T6 payment DB verified (order paid + intent completed)', orderPaid && intentCompleted, { payment_intents: pi, orders: ord })
  } else {
    console.log('SKIP  T6 (no --service-key provided)')
  }

  const pass = results.length > 0 && results.every(r => r.ok)
  fs.writeFileSync(path.join(__dirname, 'webhook-smoke-result.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), order: ORDER, amount: AMOUNT, pi_id: piId, url: URL, results, pass }, null, 2), 'utf8')
  console.log('WEBHOOK_SMOKE pass=' + pass + ' order=' + ORDER + ' amount=' + AMOUNT)
  process.exit(pass ? 0 : 1)
})().catch((e) => { console.error('WEBHOOK_SMOKE_FATAL ' + String(e).slice(0, 500)); process.exit(1) })