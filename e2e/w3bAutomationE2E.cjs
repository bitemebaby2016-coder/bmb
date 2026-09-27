// ============================================
// BMB W3-B — automation-worker production E2E probe (native, no Make.com)
// Evidence: e2e/w3b-automation-e2e.json
// TEST DATA ONLY (W3B Test customer). Credentials from supabase/secrets.local.env (gitignored).
// Usage: node e2e/w3bAutomationE2E.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, ANON, SERVICE, S, api, login, rpc } = require('./wave2Lib.cjs')

const FN = SB + '/functions/v1/automation-worker'
const TOKEN = S.AUTOMATION_TOKEN
const PREFIX = 'W3B Test'
const SECRET_RE = new RegExp(TOKEN.slice(0, 8) + '|' + (SERVICE || '###').slice(0, 12))

async function workerCall(body, withToken = true, method = 'POST', rawBody = null) {
  const headers = { apikey: ANON, 'Content-Type': 'application/json' }
  if (withToken) headers['x-automation-token'] = TOKEN
  const r = await fetch(FN, {
    method,
    headers,
    body: method === 'OPTIONS' ? undefined : (rawBody ?? JSON.stringify(body)),
  })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch {}
  return { status: r.status, j, text }
}

;(async () => {
  const out = { date: new Date().toISOString(), target: FN, tests: [] }
  const t = (name, pass, detail) => out.tests.push({ name, pass, detail })

  // --- setup: TEST order (canonical RPC, customer JWT) ---
  const cust = await login('qa-customer@bmb.co.th', S.BMB_TEST_CUSTOMER_PASSWORD)
  t('customer-login', cust.status === 200, 'status=' + cust.status)
  if (cust.status !== 200) { finalize(); return }

  const rounds = await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=id,status&limit=30')
  const today = new Date().toISOString().slice(0, 10)
  const actives = (rounds.j || []).filter((r) => r.status === 'active')
  const active = actives.find((r) => r.id === 'round-w3b-test')
    || actives.find((r) => (r.scheduled_date || r.date) === today) || actives[0]
  const products = await api(SERVICE, 'GET', '/rest/v1/products?select=id,is_available&limit=50')
  const product = (products.j || []).find((p) => p.is_available !== false)
  t('setup-round-product', !!active && !!product, 'round=' + (active && active.id) + ' product=' + (product && product.id))
  if (!active || !product) { finalize(); return }

  const created = await rpc(cust.jwt, 'create_order_with_items', {
    p_items: [{ product_id: product.id, quantity: 1 }],
    p_delivery_round_id: active.id,
    p_delivery_method: 'self_delivery',
    p_delivery_address: 'TEST-ORDER address (W3-B)',
    p_dropoff_latitude: 10.7016,
    p_dropoff_longitude: 102.1429,
    p_customer_name: PREFIX + ' Customer',
    p_customer_phone: '0990000099',
    p_payment_method: 'promptpay_qr',
  })
  const orderNumber = created.j && (created.j.order_number || (created.j.j && created.j.j.order_number))
  t('test-order-create', created.status === 200 && !!orderNumber, 'status=' + created.status + ' order=' + (orderNumber || JSON.stringify(created.j).slice(0, 120)))
  if (!orderNumber) { finalize(); return }

  // backdate the TEST order so it is "stale" (test data only)
  await api(SERVICE, 'PATCH', '/rest/v1/orders?order_number=eq.' + orderNumber, { created_at: new Date(Date.now() - 30 * 60_000).toISOString() })

  // --- 1. unauthenticated caller rejected ---
  const r1 = await workerCall({ job: 'orders_stale_pending' }, false)
  t('unauthenticated-rejected', r1.status === 401, 'status=' + r1.status)

  // --- 2. stale-pending job (first run) ---
  const ev = 'w3b-test-' + Date.now()
  const r3 = await workerCall({ job: 'orders_stale_pending', eventId: ev, maxAgeMinutes: 10, customerNamePrefix: PREFIX })
  const res3 = r3.j && r3.j.results && r3.j.results.orders_stale_pending
  const notified = res3 && Array.isArray(res3.notified) && res3.notified.includes(orderNumber)
  t('stale-pending-first-run', r3.status === 200 && r3.j.status === 'succeeded' && notified,
    'status=' + r3.status + ' result=' + JSON.stringify(res3).slice(0, 160))

  // --- 3. side effect exists: notification row ---
  const n1 = await api(SERVICE, 'GET', '/rest/v1/notifications?id=eq.auto-stale-' + encodeURIComponent(orderNumber) + '&select=id,title')
  t('notification-recorded', n1.status === 200 && Array.isArray(n1.j) && n1.j.length === 1, 'rows=' + (n1.j || []).length)

  // --- 4. idempotency: same event twice → duplicate, no new side effect ---
  const r5 = await workerCall({ job: 'orders_stale_pending', eventId: ev, maxAgeMinutes: 10, customerNamePrefix: PREFIX })
  const n2 = await api(SERVICE, 'GET', '/rest/v1/notifications?id=eq.auto-stale-' + encodeURIComponent(orderNumber) + '&select=id')
  t('duplicate-event-idempotent', r5.j && r5.j.duplicate === true && (n2.j || []).length === 1,
    'duplicate=' + (r5.j && r5.j.duplicate) + ' notif_rows=' + (n2.j || []).length)

  // --- 5. execution trace in audit_logs (observability) ---
  const a1 = await api(SERVICE, 'GET', '/rest/v1/audit_logs?action=eq.automation.execution&id=eq.auto-exec-' + encodeURIComponent(ev) + '&select=metadata')
  const meta = a1.j && a1.j[0] && a1.j[0].metadata
  t('execution-trace-recorded', !!meta && meta.event_id === ev && meta.status === 'succeeded' && !!meta.execution_id,
    'meta_keys=' + (meta ? Object.keys(meta).join(',') : 'none'))

  // --- 6. inventory_low_stock job + idempotency ---
  const ev2 = 'w3b-stock-' + Date.now()
  const r7 = await workerCall({ job: 'inventory_low_stock', eventId: ev2, stockThreshold: 999 })
  const res7 = r7.j && r7.j.results && r7.j.results.inventory_low_stock
  const r7b = await workerCall({ job: 'inventory_low_stock', eventId: ev2, stockThreshold: 999 })
  t('inventory-job-idempotent', r7.status === 200 && r7.j.status === 'succeeded' && (res7 && res7.found) >= 0 && r7b.j.duplicate === true,
    'first=' + (res7 ? JSON.stringify(res7).slice(0, 120) : 'null') + ' second_duplicate=' + (r7b.j && r7b.j.duplicate))

  // --- 7. unknown job rejected ---
  const r8 = await workerCall({ job: 'not_a_job' })
  t('unknown-job-400', r8.status === 400, 'status=' + r8.status)

  // --- 8. malformed json ---
  const r9 = await workerCall(null, true, 'POST', '{nope')
  t('malformed-json-400', r9.status === 400, 'status=' + r9.status)

  // --- 9. CORS preflight ---
  const r10 = await workerCall(null, false, 'OPTIONS')
  t('cors-preflight', r10.status === 200, 'status=' + r10.status)

  // --- 10. no secret leakage in any response ---
  const leaks = [r1, r3, r5, r7, r7b, r8, r9].filter((x) => SECRET_RE.test(x.text)).length
  t('no-secret-leak', leaks === 0, 'responses=7 leaks=' + leaks)

  function finalize() {
    out.pass = out.tests.every((x) => x.pass)
    out.pass_count = out.tests.filter((x) => x.pass).length
    out.total = out.tests.length
    fs.writeFileSync(path.join(__dirname, 'w3b-automation-e2e.json'), JSON.stringify(out, null, 2))
    console.log(out.pass ? 'W3B E2E PROBE: PASS ' + out.pass_count + '/' + out.total : 'W3B E2E PROBE: FAIL ' + out.pass_count + '/' + out.total)
    for (const x of out.tests) console.log((x.pass ? '  PASS ' : '  FAIL ') + x.name + ' — ' + x.detail)
  }
  finalize()
})().catch((e) => { console.error('FATAL', e); process.exit(1) })

