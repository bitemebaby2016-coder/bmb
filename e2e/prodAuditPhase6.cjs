// Phase 6 READ-ONLY integration probe — safe GETs on production EF endpoints + AI path checks
'use strict'
const fs = require('fs')
const path = require('path')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const BASE = 'https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1'
const OUT = path.join(PROJ, 'e2e', 'prod-phase6-integration.json')

async function probe(url, opts) {
  try {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) })
    const text = await r.text()
    return { status: r.status, body: text.slice(0, 300) }
  } catch (e) { return { error: String(e).slice(0, 200) } }
}

async function main() {
  const ev = { timestamp: new Date().toISOString(), endpoints: {}, aiChat: null }
  for (const fn of ['ai-proxy', 'stripe-webhook', 'create-checkout', 'stripe-refund', 'phone-auto-login', 'daily-report', 'vote-menu', 'generate-rewards']) {
    ev.endpoints[fn] = await probe(BASE + '/' + fn, { method: 'GET' })
  }
  // AI chat live test (production) — POST ai-proxy with anon key only (no secret used)
  const anonRes = await probe(BASE + '/ai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (process.env.P6_ANON || ''), apikey: process.env.P6_ANON || '' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], model: 'test', maxTokens: 5 }),
  })
  ev.aiChat = anonRes
  fs.writeFileSync(OUT, JSON.stringify(ev, null, 2), 'utf8')
  console.log('PHASE6 done')
  for (const [k, v] of Object.entries(ev.endpoints)) console.log(k + ' → ' + JSON.stringify(v).slice(0, 160))
  console.log('ai-proxy POST → ' + JSON.stringify(anonRes).slice(0, 200))
}
main().catch((e) => { console.error('FATAL ' + String(e)); process.exit(1) })