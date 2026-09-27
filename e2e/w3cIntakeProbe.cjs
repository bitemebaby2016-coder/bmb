// ============================================
// BMB W3-C — omnichannel intake production probe (TEST DATA ONLY)
// Evidence: e2e/w3c-omnichannel-e2e.json
// Usage: node e2e/w3cIntakeProbe.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, ANON, SERVICE, S, api, login, rpc } = require('./wave2Lib.cjs')

;(async () => {
  const out = { date: new Date().toISOString(), tests: [] }
  const t = (name, pass, detail) => out.tests.push({ name, pass, detail })
  const NAME = 'W3C Test'

  const cust = await login('qa-customer@bmb.co.th', S.BMB_TEST_CUSTOMER_PASSWORD)
  t('customer-login', cust.status === 200, 'status=' + cust.status)
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  t('admin-login', admin.status === 200, 'status=' + admin.status)

  // find today's active round + product
  const today = new Date().toISOString().slice(0, 10)
  const rounds = await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=id,status,scheduled_date&limit=50')
  const actives = (rounds.j || []).filter((r) => r.status === 'active')
  const round = actives.find((r) => r.id === 'round-w3b-test') || actives.find((r) => (r.scheduled_date || r.date) === today) || actives[0]
  const products = await api(SERVICE, 'GET', '/rest/v1/products?select=id,is_available&limit=50')
  const product = (products.j || []).find((p) => p.is_available !== false)
  t('setup-round-product', !!round && !!product, 'round=' + (round && round.id) + ' product=' + (product && product.id))

  const items = [{ product_id: product.id, quantity: 1 }]

  // 1. PWA channel — canonical RPC intake
  const pwa = await rpc(cust.jwt, 'create_order_with_items', {
    p_items: items, p_delivery_round_id: round.id, p_delivery_method: 'self_delivery',
    p_delivery_address: 'W3C TEST address', p_dropoff_latitude: 10.7016, p_dropoff_longitude: 102.1429,
    p_customer_name: NAME + ' Customer', p_customer_phone: '0990000088', p_payment_method: 'promptpay_qr',
  })
  const pwaOrder = pwa.j && (pwa.j.order_number || (pwa.j.j && pwa.j.j.order_number))
  t('pwa-canonical-intake', pwa.status === 200 && !!pwaOrder, 'status=' + pwa.status + ' order=' + (pwaOrder || JSON.stringify(pwa.j).slice(0, 100)))

  // 2. MANUAL channel (admin) — same canonical RPC
  const man = await rpc(admin.jwt, 'create_order_with_items', {
    p_items: items, p_delivery_round_id: round.id, p_delivery_method: 'self_delivery',
    p_delivery_address: 'W3C TEST address (manual)', p_dropoff_latitude: 10.7016, p_dropoff_longitude: 102.1429,
    p_customer_name: NAME + ' Manual Customer', p_customer_phone: '0990000077', p_payment_method: 'promptpay_qr',
  })
  const manOrder = man.j && (man.j.order_number || (man.j.j && man.j.j.order_number))
  t('manual-canonical-intake', man.status === 200 && !!manOrder, 'status=' + man.status + ' order=' + (manOrder || JSON.stringify(man.j).slice(0, 100)))

  // 3. direct DB insert by customer (channel-agnostic bypass attempt) — MUST be denied
  const probeId = 'w3c-direct-' + Date.now()
  const direct = await api(ANON, 'POST', '/rest/v1/orders', {
    id: probeId, order_number: probeId, customer_id: 'w3c-test', customer_name: NAME, customer_phone: '0900000000',
    total_amount: 1, payment_status: 'pending', payment_method: 'promptpay_qr',
  }, cust.jwt)
  t('direct-db-insert-denied', direct.status === 403 || direct.status === 401 || direct.status === 404,
    'status=' + direct.status + ' body=' + JSON.stringify(direct.j).slice(0, 120))

  // 3b. anon direct insert — MUST be denied
  const anonIns = await api(ANON, 'POST', '/rest/v1/orders', { id: probeId + 'a', order_number: probeId + 'a', customer_name: 'x', customer_phone: 'x', total_amount: 1 })
  t('anon-direct-insert-denied', anonIns.status === 401 || anonIns.status === 403 || anonIns.status === 404, 'status=' + anonIns.status)

  // 4. order_mode canonical distinction (PRE-ORDER via dedicated canonical RPC)
  // ensure a TEST product allows preorder mode (test data only — PATCH mode flags)
  const tpId = 'prod-w3c-test-pre'
  let tp = await api(SERVICE, 'GET', '/rest/v1/products?id=eq.' + tpId + '&select=id')
  if (!tp.j || !tp.j.length) {
    const cats = await api(SERVICE, 'GET', '/rest/v1/product_categories?select=id&limit=1')
    const catId = cats.j && cats.j[0] && cats.j[0].id
    tp = await api(SERVICE, 'POST', '/rest/v1/products', {
      id: tpId, name: 'W3C Test Preorder Product', description: 'TEST DATA ONLY (W3-C)',
      price: 50, category_id: catId, is_available: true, available_same_day: true,
      available_preorder: true, prep_minutes: 10, sort_order: 999,
    })
  } else {
    tp = await api(SERVICE, 'PATCH', '/rest/v1/products?id=eq.' + tpId, { available_preorder: true, available_same_day: true, is_available: true })
  }
  const pre = await rpc(cust.jwt, 'create_pre_order_with_items', {
    p_product_id: tpId, p_quantity: 1, p_scheduled_date: new Date(Date.now() + 86400_000).toISOString().slice(0, 10),
    p_customer_name: NAME + ' Pre', p_customer_phone: '0990000066',
    p_delivery_latitude: 10.7016, p_delivery_longitude: 102.1429, p_delivery_address: 'W3C TEST pre',
  })
  t('preorder-canonical-intake', tp.status >= 200 && tp.status < 300 && (pre.status === 200 || pre.status === 201),
    'product_status=' + tp.status + ' pre_status=' + pre.status + ' body=' + JSON.stringify(pre.j).slice(0, 120))

  // 5. duplicate protection on transition (no side effect on same-state transition)
  if (pwaOrder) {
    const tr1 = await rpc(cust.jwt, 'transition_order_status', { p_order_number: pwaOrder, p_new_status: 'cancelled' })
    const tr2 = await rpc(cust.jwt, 'transition_order_status', { p_order_number: pwaOrder, p_new_status: 'cancelled' })
    const sameState = tr1.j && tr2.j && tr1.j.new_status === tr2.j.new_status
    t('duplicate-transition-idempotent', tr1.status === 200 && tr1.j.ok === true && sameState,
      'tr1=' + JSON.stringify(tr1.j).slice(0, 100) + ' tr2=' + JSON.stringify(tr2.j).slice(0, 100))
  }

  // 6. invalid payload → rejected by backend (not by channel)
  const bad = await rpc(cust.jwt, 'create_order_with_items', { p_items: [{ product_id: 'no-such-product', quantity: 1 }] })
  t('invalid-payload-rejected', bad.status !== 200, 'status=' + bad.status)

  // 7. duplicate order creation (same items) — CURRENT behavior: allowed (F-14 GAP, no idempotency key)
  const dup = await rpc(cust.jwt, 'create_order_with_items', {
    p_items: items, p_delivery_round_id: round.id, p_delivery_method: 'self_delivery',
    p_delivery_address: 'W3C TEST dup', p_dropoff_latitude: 10.7016, p_dropoff_longitude: 102.1429,
    p_customer_name: NAME + ' Customer', p_customer_phone: '0990000088', p_payment_method: 'promptpay_qr',
  })
  const dupOrder = dup.j && (dup.j.order_number || (dup.j.j && dup.j.j.order_number))
  t('duplicate-create-behavior-documented', dup.status === 200 && !!dupOrder && dupOrder !== pwaOrder,
    'second_order=' + dupOrder + ' (CURRENT: no cross-channel idempotency key — F-14 BLOCKED, see evidence §10/11)')

  // 8. automation handoff: stale-pending worker processes W3C test order (once)
  const TOKEN = S.AUTOMATION_TOKEN
  const wf = SB + '/functions/v1/automation-worker'
  const ev = 'w3c-handoff-' + Date.now()
  if (dupOrder) {
    // backdate the TEST duplicate order so the worker sees it as stale (test data only)
    await api(SERVICE, 'PATCH', '/rest/v1/orders?order_number=eq.' + dupOrder, { created_at: new Date(Date.now() - 30 * 60_000).toISOString() })
  }
  const mk = (evv) => fetch(wf, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json', 'x-automation-token': TOKEN }, body: JSON.stringify({ job: 'orders_stale_pending', eventId: evv, maxAgeMinutes: 10, customerNamePrefix: NAME }) })
  const w1 = await mk(ev); const w1j = await w1.json().catch(() => ({}))
  const res = w1j.results && w1j.results.orders_stale_pending
  const w2 = await mk(ev); const w2j = await w2.json().catch(() => ({}))
  t('automation-handoff-once', w1.status === 200 && w1j.status === 'succeeded' && w2j.duplicate === true,
    'run1=' + (res ? JSON.stringify(res).slice(0, 120) : 'null') + ' run2_duplicate=' + (w2j.duplicate === true))

  out.pass = out.tests.every((x) => x.pass)
  out.pass_count = out.tests.filter((x) => x.pass).length
  out.total = out.tests.length
  fs.writeFileSync(path.join(__dirname, 'w3c-omnichannel-e2e.json'), JSON.stringify(out, null, 2))
  console.log(out.pass ? 'W3C INTAKE PROBE: PASS ' + out.pass_count + '/' + out.total : 'W3C INTAKE PROBE: ' + out.pass_count + '/' + out.total + ' (see FAILs)')
  for (const x of out.tests) console.log((x.pass ? '  PASS ' : '  FAIL ') + x.name + ' — ' + x.detail)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })

