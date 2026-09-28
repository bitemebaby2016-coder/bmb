'use strict'
// W5-1 SECURITY PROBES — H1 anon PII closure verification (READ-ONLY, TEST DATA ONLY)
// Run AFTER migration 050 is applied to production.
// Evidence: e2e/w5h1-probes.json
// Proves:
//   ANON: no direct SELECT on orders (no PII / address / coords), no enumeration
//   RPC:  track_order deployed + wrong number / wrong phone / missing phone
//         → identical {"found": false} shape (no oracle)
const fs = require('fs')
const path = require('path')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const env = fs.readFileSync(path.join(PROJ, '.env'), 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : '' }
const SUPA = get('VITE_SUPABASE_URL').replace(/\/$/, '')
const ANON = get('VITE_SUPABASE_ANON_KEY')
const OUT = path.join(PROJ, 'e2e', 'w5h1-probes.json')
const ev = { timestamp: new Date().toISOString(), supa: SUPA, probes: [] }
let pass = 0, fail = 0
function record(name, ok, detail) {
  ev.probes.push({ name, ok, detail: String(detail).slice(0, 300) })
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' — ' + String(detail).slice(0, 120))
  ok ? pass++ : fail++
}
async function restGet(pathQ) {
  const r = await fetch(`${SUPA}/rest/v1/${pathQ}`, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } })
  return { status: r.status, body: await r.text() }
}
async function rpc(fn, args) {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  return { status: r.status, body: await r.text() }
}
async function main() {
  // 1) ANON direct SELECT on orders (incl. PII columns) — must return ZERO rows
  //    (empty array) or RLS error — never data.
  {
    const r = await restGet('orders?select=order_number,customer_name,customer_phone,dropoff_detail,dropoff_latitude,dropoff_longitude&limit=10')
    let rows = []
    try { rows = JSON.parse(r.body) } catch { /* error body */ }
    const noData = (r.status === 401 || r.status === 403) || (Array.isArray(rows) && rows.length === 0)
    record('anon:direct-select-orders', noData, `status=${r.status} body=${r.body.slice(0, 120)}`)
  }
  // 2) ANON full-row SELECT (W5-0 probe reproduction) — must NOT return customer PII
  {
    const r = await restGet('orders?select=*&limit=3')
    const body = r.body
    const leaked = /customer_phone|dropoff_detail|"customer_name"/.test(body) && !/^\s*\[\s*\]\s*$/.test(body)
    record('anon:select-star-no-pii', !leaked, `status=${r.status} body=${body.slice(0, 120)}`)
  }
  // 3) RPC deployed (PGRST202 = NOT applied → probe fails, blocks gate)
  {
    const r = await rpc('track_order', { p_order_number: 'QA-W5H1-NONEXIST-000', p_phone: '0900000000' })
    const missing = r.body.includes('PGRST202')
    record('rpc:track_order-deployed', !missing, `status=${r.status} body=${r.body.slice(0, 120)}`)
    if (missing) {
      fs.writeFileSync(OUT, JSON.stringify({ ...ev, pass, fail, blocked: 'migration 050 NOT applied' }, null, 2))
      console.log('BLOCKED: migration 050 not applied on production')
      return
    }
  }
  // 4) Anti-enumeration: wrong number / wrong phone / missing phone → identical shape
  {
    const a = await rpc('track_order', { p_order_number: 'QA-W5H1-NONEXIST-000', p_phone: '0900000000' })
    const b = await rpc('track_order', { p_order_number: 'BMB-20260917-526', p_phone: '0900000000' })
    const c = await rpc('track_order', { p_order_number: 'BMB-20260917-526', p_phone: '' })
    const same = (() => {
      try {
        const pa = JSON.parse(a.body); const pb = JSON.parse(b.body); const pc = JSON.parse(c.body)
        return pa.found === false && pb.found === false && pc.found === false
          && !('order' in pa) && !('order' in pb) && !('order' in pc)
      } catch { return false }
    })()
    record('rpc:anti-enumeration-identical-shape', same, `a=${a.body.slice(0, 60)} b=${b.body.slice(0, 60)} c=${c.body.slice(0, 60)}`)
  }
  // 5) throttle ledger table must be anon-denied
  {
    const r = await restGet('track_order_attempts?select=*&limit=5')
    const body = r.body
    const denied = r.status !== 200 || /^\s*\[\s*\]\s*$/.test(body)
    record('anon:track_order_attempts-denied', denied, `status=${r.status} body=${body.slice(0, 100)}`)
  }
  fs.writeFileSync(OUT, JSON.stringify({ ...ev, pass, fail }, null, 2))
  console.log(`W5-H1 PROBES: pass=${pass} fail=${fail}`)
  process.exitCode = fail === 0 ? 0 : 1
}
main().catch((e) => { console.error('FATAL', e); process.exitCode = 1 })
