// ============================================
// BMB F-14 — channel intake production probe (TEST DATA ONLY)
// Evidence: e2e/f14-channel-intake-e2e.json
// Usage: node e2e/f14ChannelIntakeProbe.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, ANON, SERVICE, S, api, login, rpc } = require('./wave2Lib.cjs')

;(async () => {
  const out = { date: new Date().toISOString(), tests: [] }
  const t = (name, pass, detail) => out.tests.push({ name, pass, detail })
  const NAME = 'F14 Test'
  const ts = Date.now()

  const cust = await login('qa-customer@bmb.co.th', S.BMB_TEST_CUSTOMER_PASSWORD)
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  t('logins', cust.status === 200 && admin.status === 200, 'cust=' + cust.status + ' admin=' + admin.status)

  const today = new Date().toISOString().slice(0, 10)
  const rounds = await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=id,status,scheduled_date&limit=50')
  const actives = (rounds.j || []).filter((r) => r.status === 'active')
  const round = actives.find((r) => r.id === 'round-w3b-test') || actives.find((r) => (r.scheduled_date || r.date) === today) || actives[0]
  const products = await api(SERVICE, 'GET', '/rest/v1/products?select=id,is_available,available_same_day&limit=50')
  const product = (products.j || []).find((p) => p.is_available !== false)
  t('setup', !!round && !!product, 'round=' + (round && round.id) + ' product=' + (product && product.id))

  const items = [{ product_id: product.id, quantity: 1 }]

  // 1. LEGACY PWA intake (14-param) → trigger stamps PWA
  const pwa = await rpc(cust.jwt, 'create_order_with_items', {
    p_items: items, p_delivery_round_id: round.id, p_delivery_method: 'self_delivery',
    p_delivery_address: 'F14 TEST', p_dropoff_latitude: 10.7016, p_dropoff_longitude: 102.1429,
    p_customer_name: NAME + ' PWA', p_customer_phone: '0990000071', p_payment_method: 'promptpay_qr',
  })
  const pwaOrder = pwa.j && (pwa.j.order_number || (pwa.j.j && pwa.j.j.order_number))
  t('legacy-pwa-intake', pwa.status === 200 && !!pwaOrder, 'status=' + pwa.status + ' order=' + pwaOrder)

  // 2. LEGACY MANUAL intake (admin, 14-param) → trigger stamps MANUAL
  const man = await rpc(admin.jwt, 'create_order_with_items', {
    p_items: items, p_delivery_round_id: round.id, p_delivery_method: 'self_delivery',
    p_delivery_address: 'F14 TEST manual', p_dropoff_latitude: 10.7016, p_dropoff_longitude: 102.1429,
    p_customer_name: NAME + ' MANUAL', p_customer_phone: '0990000072', p_payment_method: 'promptpay_qr',
  })
  const manOrder = man.j && (man.j.order_number || (man.j.j && man.j.j.order_number))
  t('legacy-manual-intake', man.status === 200 && !!manOrder, 'status=' + man.status + ' order=' + manOrder)

  // check stamps
  const stamped = await api(SERVICE, 'GET', `/rest/v1/orders?order_number=in.(${pwaOrder},${manOrder})&select=order_number,source_channel,external_ref_id`)
  const st = (o) => (stamped.j || []).find((x) => x.order_number === o)
  t('legacy-stamped-pwa', st(pwaOrder) && st(pwaOrder).source_channel === 'PWA' && st(pwaOrder).external_ref_id === null,
    JSON.stringify(st(pwaOrder)))
  t('legacy-stamped-manual', st(manOrder) && st(manOrder).source_channel === 'MANUAL', JSON.stringify(st(manOrder)))

  // helper: channel-tagged intake via new overload
  const intake = async (channel, ref) => rpc(cust.jwt, 'create_order_with_items', {
    p_items: items, p_delivery_round_id: round.id, p_delivery_method: 'self_delivery',
    p_delivery_address: 'F14 TEST ' + channel, p_dropoff_latitude: 10.7016, p_dropoff_longitude: 102.1429,
    p_customer_name: NAME + ' ' + channel, p_customer_phone: '0990000073',
    p_payment_method: 'promptpay_qr', p_source_channel: channel, p_external_ref_id: ref,
  })

  // 3-5. channel simulations (canonical contract — no fake DB shortcut)
  const fb = await intake('FACEBOOK', 'f14-fb-' + ts)
  const fbOrder = fb.j && fb.j.order_number
  t('facebook-intake', fb.status === 200 && fb.j.duplicate === false && fb.j.source_channel === 'FACEBOOK' && !!fbOrder,
    'status=' + fb.status + ' order=' + fbOrder + ' sc=' + (fb.j && fb.j.source_channel))

  const fbg = await intake('FACEBOOK_GROUP', 'f14-fbg-' + ts)
  const msg = await intake('MESSENGER', 'f14-msg-' + ts)
  t('fbgroup-messenger-intake', fbg.status === 200 && fbg.j.duplicate === false && msg.status === 200 && msg.j.duplicate === false,
    'fbg=' + (fbg.j && fbg.j.order_number) + ' msg=' + (msg.j && msg.j.order_number))

  // 6. duplicate retry (same channel + same ref) → SAME order, no new order
  const fbRetry = await intake('FACEBOOK', 'f14-fb-' + ts)
  const cnt = await api(SERVICE, 'GET', `/rest/v1/orders?source_channel=eq.FACEBOOK&external_ref_id=eq.f14-fb-${ts}&select=order_number`)
  t('duplicate-retry-same-order', fbRetry.status === 200 && fbRetry.j.duplicate === true && fbRetry.j.order_number === fbOrder && (cnt.j || []).length === 1,
    'retry_order=' + (fbRetry.j && fbRetry.j.order_number) + ' rows=' + (cnt.j || []).length)

  // 7. same external_ref_id on different channel → NO collision (separate orders)
  const xref = 'f14-shared-' + ts
  const c1 = await intake('FACEBOOK_GROUP', xref)
  const c2 = await intake('MESSENGER', xref)
  t('cross-channel-no-collision', c1.status === 200 && c2.status === 200 && c1.j.duplicate === false && c2.j.duplicate === false && c1.j.order_number !== c2.j.order_number,
    c1.j.order_number + ' vs ' + c2.j.order_number)

  // 8. NULL external_ref_id (legacy semantics) — no guard, allowed
  const n1 = await intake('MANUAL', null)
  t('null-ref-no-guard', n1.status === 200 && n1.j.duplicate === false && n1.j.external_ref_id === null, 'order=' + (n1.j && n1.j.order_number))

  // 9. invalid source_channel → rejected by backend
  const bad = await intake('no', 'f14-bad-' + ts) // invalid pattern (too short) → ERR_INVALID_SOURCE_CHANNEL
  t('invalid-channel-rejected', bad.status !== 200, 'status=' + bad.status + ' body=' + JSON.stringify(bad.j).slice(0, 100))

  // 10. unauthorized (anon) → denied
  const anonCall = await api(ANON, 'POST', '/rest/v1/rpc/create_order_with_items', {
    p_items: items, p_delivery_round_id: round.id, p_source_channel: 'FACEBOOK', p_external_ref_id: 'f14-anon-' + ts,
  })
  t('unauthorized-denied', anonCall.status !== 200, 'status=' + anonCall.status + ' body=' + JSON.stringify(anonCall.j).slice(0, 100))

  // 11. direct DB insert still denied (RLS)
  const d = await api(ANON, 'POST', '/rest/v1/orders', { id: 'f14-d-' + ts, order_number: 'f14-d-' + ts, customer_name: 'x', customer_phone: 'x', total_amount: 1 }, cust.jwt)
  t('direct-insert-denied', d.status === 403 || d.status === 401, 'status=' + d.status + ' body=' + JSON.stringify(d.j).slice(0, 100))

  // 12. concurrent duplicate (parallel same channel+ref) → ONE order
  const cref = 'f14-conc-' + ts
  const [p1, p2] = await Promise.all([intake('MESSENGER', cref), intake('MESSENGER', cref)])
  const ccnt = await api(SERVICE, 'GET', `/rest/v1/orders?source_channel=eq.MESSENGER&external_ref_id=eq.${cref}&select=order_number`)
  const sameTarget = p1.j && p2.j && p1.j.order_number === p2.j.order_number
  t('concurrent-duplicate-one-order', p1.status === 200 && p2.status === 200 && (p1.j.duplicate === true || p2.j.duplicate === true) && sameTarget && (ccnt.j || []).length === 1,
    'p1=' + (p1.j && p1.j.order_number) + ' dup1=' + (p1.j && p1.j.duplicate) + ' p2=' + (p2.j && p2.j.order_number) + ' dup2=' + (p2.j && p2.j.duplicate) + ' rows=' + (ccnt.j || []).length)

  // 13. RLS/order-history regression: cancelled transition still records history
  if (pwaOrder) {
    await rpc(cust.jwt, 'transition_order_status', { p_order_number: pwaOrder, p_new_status: 'cancelled' })
    const hist = await api(SERVICE, 'GET', '/rest/v1/order_status_history?order_number=eq.' + pwaOrder + '&select=id')
    t('order-history-regression', (hist.j || []).length >= 2, 'history_rows=' + (hist.j || []).length)
  }

  out.pass = out.tests.every((x) => x.pass)
  out.pass_count = out.tests.filter((x) => x.pass).length
  out.total = out.tests.length
  fs.writeFileSync(path.join(__dirname, 'f14-channel-intake-e2e.json'), JSON.stringify(out, null, 2))
  console.log(out.pass ? 'F14 PROBE: PASS ' + out.pass_count + '/' + out.total : 'F14 PROBE: ' + out.pass_count + '/' + out.total + ' (see FAILs)')
  for (const x of out.tests) console.log((x.pass ? '  PASS ' : '  FAIL ') + x.name + ' — ' + x.detail)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })

