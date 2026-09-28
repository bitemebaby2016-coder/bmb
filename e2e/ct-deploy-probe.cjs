'use strict'
// Ground truth: deployed stripe-refund & stripe-webhook behavior (capture JSON; booleans/status only, no secrets).
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const ANON = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'
async function main() {
  const out = { versions: {}, probes: {} }
  for (const s of ['create-checkout', 'stripe-refund', 'stripe-webhook']) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/${s}`, { headers: { Authorization: 'Bearer ' + TOKEN } })
    const j = await r.json().catch(() => ({}))
    out.versions[s] = { version: j.version, verify_jwt: j.verify_jwt, status: j.status }
  }
  // stripe-refund POST with NO bearer (Bearer absent) → should hit 401 ERR_NOT_AUTHENTICATED if env ok, else 500 ERR_NOT_CONFIGURED
  const r1 = await fetch(`${SB}/functions/v1/stripe-refund`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: '{}' })
  out.probes.stripe_refund_noauth = { status: r1.status, body: (await r1.text()).slice(0, 120) }
  // stripe-refund POST with dummy bearer (env check precedes auth; reveals if env configured)
  const r2 = await fetch(`${SB}/functions/v1/stripe-refund`, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer dummy', 'content-type': 'application/json' }, body: '{}' })
  out.probes.stripe_refund_dummy_bearer = { status: r2.status, body: (await r2.text()).slice(0, 160) }
  // stripe-webhook POST bad signature
  const r3 = await fetch(`${SB}/functions/v1/stripe-webhook`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json', 'stripe-signature': 't=1,v1=invalid' }, body: '{}' })
  out.probes.stripe_webhook_bad_sig = { status: r3.status, body: (await r3.text()).slice(0, 160) }
  console.log(JSON.stringify(out, null, 2))
}
main().catch((e) => { console.error('ERR', String(e).slice(0, 250)); process.exit(1) })