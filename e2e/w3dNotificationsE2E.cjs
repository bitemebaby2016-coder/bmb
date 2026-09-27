// ============================================
// BMB W3-D — notification_dispatch production E2E probe (native, no Make.com)
// Evidence: e2e/w3d-notifications-e2e.json
// TEST DATA ONLY (W3D Test orders + qa-* accounts). TEST transport only.
// Credentials from supabase/secrets.local.env (gitignored) — never printed.
// Usage: node e2e/w3dNotificationsE2E.cjs
// ============================================
'use strict'
const fs = require('fs')
const { SB, ANON, SERVICE, S, api, login, rpc } = require('./wave2Lib.cjs')

const FN = SB + '/functions/v1/automation-worker'
const TOKEN = S.AUTOMATION_TOKEN
const PREFIX = 'W3D Test'
const SECRET_RE = new RegExp(TOKEN.slice(0, 8) + '|' + (SERVICE || '###').slice(0, 12))

async function workerCall(body, withToken = true, method = 'POST') {
  const headers = { apikey: ANON, 'Content-Type': 'application/json' }
  if (withToken) headers['x-automation-token'] = TOKEN
  const r = await fetch(FN, { method, headers, body: method === 'OPTIONS' ? undefined : JSON.stringify(body) })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch {}
  return { status: r.status, j, text }
}

;(async () => {
  const out = { date: new Date().toISOString(), target: FN, tests: [] }
  const t = (name, pass, detail) => out.tests.push({ name, pass, detail })
  const leaks = []
  const scan = (label, text) => { if (text && SECRET_RE.test(text)) leaks.push(label) }

  // --- 1. unauthenticated caller rejected ---
  const r1 = await workerCall({ job: 'notification_dispatch' }, false)
  scan('unauth', r1.text)
  t('unauthenticated-rejected', r1.status === 401, 'status=' + r1.status)

  // --- 2. unknown job / malformed rejected ---
  const r2 = await workerCall({ job: 'not_a_real_job' })
  scan('unknown-job', r2.text)
  t('unknown-job-rejected', r2.status === 400, 'status=' + r2.status)
  const r2b = await workerCall('not-json-{', true)
  t('malformed-payload-rejected', r2b.status === 400, 'status=' + r2b.status)

  // --- setup: TEST order (canonical RPC, customer JWT) ---
  const cust = await login('qa-customer@bmb.co.th', S.BMB_TEST_CUSTOMER_PASSWORD)
  t('customer-login', cust.status === 200, 'status=' + cust.status)
  if (cust.status !== 200) { finalize(); return }

  // ensure TEST customers row (notifications.customer_id FK + RLS own-read resolution)
  let custRowQ = await api(SERVICE, 'GET', '/rest/v1/customers?select=id&user_id=eq.' + cust.uid)
  if (!Array.isArray(custRowQ.j) || custRowQ.j.length === 0) {
    await api(SERVICE, 'POST', '/rest/v1/customers', {
      id: 'cust-qa-customer', user_id: cust.uid, full_name: 'QA Customer (TEST)',
      email: 'qa-customer@bmb.co.th', loyalty_points: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    custRowQ = await api(SERVICE, 'GET', '/rest/v1/customers?select=id&user_id=eq.' + cust.uid)
  }
  t('test-customer-row', Array.isArray(custRowQ.j) && custRowQ.j.length === 1, 'rows=' + (custRowQ.j || []).length)

  const rounds = await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=id,status&limit=30')
  const actives = (rounds.j || []).filter((r) => r.status === 'active')
  const active = actives.find((r) => r.id === 'round-w3b-test') || actives[0]
  const products = await api(SERVICE, 'GET', '/rest/v1/products?select=id,is_available&limit=50')
  const product = (products.j || []).find((p) => p.is_available !== false)
  t('setup-round-product', !!active && !!product, 'round=' + (active && active.id))
  if (!active || !product) { finalize(); return }

  const created = await rpc(cust.jwt, 'create_order_with_items', {
    p_items: [{ product_id: product.id, quantity: 1 }],
    p_delivery_round_id: active.id,
    p_delivery_method: 'self_delivery',
    p_delivery_address: 'TEST-ORDER address (W3-D)',
    p_dropoff_latitude: 10.7016,
    p_dropoff_longitude: 102.1429,
    p_customer_name: PREFIX + ' Customer',
    p_customer_phone: '0990000099',
    p_payment_method: 'promptpay_qr',
  })
  const orderNumber = created.j && (created.j.order_number || (created.j.j && created.j.j.order_number))
  t('test-order-create', created.status === 200 && !!orderNumber, 'status=' + created.status + ' order=' + (orderNumber || '').slice(0, 40))
  if (!orderNumber) { finalize(); return }
  out.order_number = orderNumber

  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  t('admin-login', admin.status === 200, 'status=' + admin.status)
  if (admin.status !== 200) { finalize(); return }

  async function dispatch(eventIdSuffix, lookback = 240) {
    const ev = 'w3d-' + eventIdSuffix + '-' + Date.now()
    const r = await workerCall({ job: 'notification_dispatch', eventId: ev, lookbackMinutes: lookback, customerNamePrefix: PREFIX })
    scan('dispatch-' + eventIdSuffix, r.text)
    return { ev, r, res: r.j && r.j.results && r.j.results.notification_dispatch }
  }

  // --- 3. dispatch run #1: ORDER_CREATED (pending) notification ---
  const d1 = await dispatch('first')
  t('dispatch-run-1-created', d1.r.status === 200 && d1.r.j.status === 'succeeded' && (d1.res.created || []).includes('evt-ord-' + orderNumber + '-pending'),
    'status=' + d1.r.status + ' created=' + JSON.stringify(d1.res && d1.res.created).slice(0, 200) + ' errors=' + JSON.stringify(d1.r.j && d1.r.j.errors))

  // --- 4. durable side effect row with canonical recipient ---
  const n1 = await api(SERVICE, 'GET', '/rest/v1/notifications?id=eq.evt-ord-' + encodeURIComponent(orderNumber) + '-pending&select=id,customer_id,title,notification_type,category')
  const row1 = (n1.j || [])[0]
  const custRows = await api(SERVICE, 'GET', '/rest/v1/customers?select=id,user_id&limit=200')
  const custId = ((custRows.j || []).find((c) => c.user_id === cust.uid) || {}).id
  t('notification-recorded-with-recipient', n1.status === 200 && row1 && row1.customer_id === custId && row1.notification_type === 'ORDER_CREATED',
    'rows=' + (n1.j || []).length + ' customer_id_match=' + !!(row1 && row1.customer_id === custId))

  // --- 5. canonical transition → dispatch run #2 produces ORDER_CONFIRMED ---
  const tr1 = await rpc(admin.jwt, 'transition_order_status', { p_order_number: orderNumber, p_new_status: 'confirmed' })
  t('transition-to-confirmed', tr1.status === 200, 'status=' + tr1.status + ' body=' + JSON.stringify(tr1.j).slice(0, 120))
  const d2 = await dispatch('second')
  t('dispatch-run-2-order-confirmed', d2.r.status === 200 && (d2.res.created || []).includes('evt-ord-' + orderNumber + '-confirmed'),
    'created=' + JSON.stringify(d2.res && d2.res.created).slice(0, 200))

  // --- 6. idempotency: same window re-run → duplicates, no new rows ---
  const d2b = await dispatch('second-rerun')
  const bothDup = (d2b.res.duplicate || []).includes('evt-ord-' + orderNumber + '-pending') && (d2b.res.duplicate || []).includes('evt-ord-' + orderNumber + '-confirmed')
  const nCount = await api(SERVICE, 'GET', '/rest/v1/notifications?id=in.(' + ['evt-ord-' + orderNumber + '-pending', 'evt-ord-' + orderNumber + '-confirmed'].map(encodeURIComponent).join(',') + ')&select=id')
  t('re-run-idempotent-no-duplicate-side-effect', d2b.r.status === 200 && bothDup && (nCount.j || []).length === 2,
    'duplicate=' + JSON.stringify(d2b.res && d2b.res.duplicate).slice(0, 220) + ' rows=' + (nCount.j || []).length)

  // --- 7. DRIVER_ASSIGNED event from authoritative feed ---
  const tr2 = await rpc(admin.jwt, 'transition_order_status', { p_order_number: orderNumber, p_new_status: 'preparing' })
  const tr3 = await rpc(admin.jwt, 'transition_order_status', { p_order_number: orderNumber, p_new_status: 'ready_for_dispatch' })
  const asg = await rpc(admin.jwt, 'assign_driver', { p_order_number: orderNumber, p_driver_id: 'drv-qa-w2-01' })
  t('driver-assigned-canonical', asg.status === 200, 'tr2=' + tr2.status + ' tr3=' + tr3.status + ' asg=' + asg.status + ' ' + JSON.stringify(asg.j).slice(0, 100))
  const d3 = await dispatch('third')
  const drvCreated = (d3.res.created || []).includes('evt-drv-' + orderNumber + '-assigned')
  const drvDup = (d3.res.duplicate || []).includes('evt-drv-' + orderNumber + '-assigned')
  t('driver-assigned-notification', d3.r.status === 200 && (drvCreated || drvDup),
    'created=' + JSON.stringify(d3.res && d3.res.created).slice(0, 200) + ' duplicate=' + JSON.stringify(d3.res && d3.res.duplicate).slice(0, 200))

  // --- 8. execution trace in audit_logs (observability / failure visibility) ---
  const a1 = await api(SERVICE, 'GET', '/rest/v1/audit_logs?action=eq.automation.execution&id=eq.auto-exec-' + encodeURIComponent(d1.ev) + '&select=metadata')
  const meta = a1.j && a1.j[0] && a1.j[0].metadata
  t('execution-trace-recorded', !!meta && meta.event_id === d1.ev && !!meta.execution_id, 'meta_keys=' + (meta ? Object.keys(meta).join(',') : 'none'))

  // --- 9. bounded scan: unknown prefix → observable empty result (no fake events) ---
  const d4 = await dispatch('empty', 60)
  t('empty-window-observable', d4.r.status === 200 && d4.r.j.status === 'succeeded' && (d4.res.created || []).length === 0,
    'created=' + (d4.res && d4.res.created ? d4.res.created.length : 'n/a'))

  // --- 10. customer isolation (RLS) ---
  const own = await api(ANON, 'GET', '/rest/v1/notifications?id=eq.evt-ord-' + encodeURIComponent(orderNumber) + '-pending&select=id', undefined, cust.jwt)
  t('customer-reads-own-notification', own.status === 200 && (own.j || []).length === 1, 'status=' + own.status + ' rows=' + (own.j || []).length)
  const foreign = await api(ANON, 'GET', '/rest/v1/notifications?id=eq.auto-stock-nonexistent&select=id', undefined, cust.jwt)
  t('customer-cannot-read-foreign-row', foreign.status === 200 && Array.isArray(foreign.j) && foreign.j.length === 0, 'status=' + foreign.status + ' rows=' + (foreign.j || []).length)
  const foreignWrite = await api(ANON, 'PATCH', '/rest/v1/notifications?id=eq.auto-stock-prod-1', { is_read: true }, cust.jwt)
  const foreignWriteCheck = await api(SERVICE, 'GET', '/rest/v1/notifications?id=eq.auto-stock-prod-1&select=is_read')
  const foreignStillUnread = ((foreignWriteCheck.j || [])[0] || {}).is_read === false
  t('customer-cannot-mutate-foreign-row', foreignWrite.status === 204 && foreignStillUnread,
    'status=' + foreignWrite.status + ' still_unread=' + foreignStillUnread)
  const ownWrite = await api(ANON, 'PATCH', '/rest/v1/notifications?id=eq.evt-ord-' + encodeURIComponent(orderNumber) + '-pending', { is_read: true }, cust.jwt)
  const ownWriteCheck = await api(SERVICE, 'GET', '/rest/v1/notifications?id=eq.evt-ord-' + encodeURIComponent(orderNumber) + '-pending&select=is_read')
  const ownNowRead = ((ownWriteCheck.j || [])[0] || {}).is_read === true
  t('customer-marks-own-read-persisted', ownWrite.status === 204 && ownNowRead,
    'status=' + ownWrite.status + ' now_read=' + ownNowRead)

  // --- 11. admin access (RLS admin policy) ---
  const adm = await api(ANON, 'GET', '/rest/v1/notifications?id=eq.evt-drv-' + encodeURIComponent(orderNumber) + '-assigned&select=id', undefined, admin.jwt)
  t('admin-reads-notification', adm.status === 200 && (adm.j || []).length === 1, 'rows=' + (adm.j || []).length)

  // --- 12. anonymous blocked ---
  const anonGet = await api(ANON, 'GET', '/rest/v1/notifications?id=eq.evt-ord-' + encodeURIComponent(orderNumber) + '-pending&select=id')
  t('anonymous-blocked-by-rls', (anonGet.status === 401) || (anonGet.status === 200 && Array.isArray(anonGet.j) && anonGet.j.length === 0),
    'status=' + anonGet.status + ' rows=' + (Array.isArray(anonGet.j) ? anonGet.j.length : 'n/a'))

  // --- 13. secret scan across all captured responses ---
  t('no-secret-leak', leaks.length === 0, 'leaks=' + JSON.stringify(leaks))

  function finalize() {
    out.passed = out.tests.filter((x) => x.pass).length
    out.total = out.tests.length
    out.all_pass = out.passed === out.total
    fs.writeFileSync(__dirname + '/w3d-notifications-e2e.json', JSON.stringify(out, null, 2))
    console.log('W3-D E2E: ' + out.passed + '/' + out.total + (out.all_pass ? ' PASS' : ' FAIL'))
    if (!out.all_pass) console.log(JSON.stringify(out.tests.filter((x) => !x.pass), null, 2))
  }
  finalize()
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
