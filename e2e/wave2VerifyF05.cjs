// Wave 2-A — F-05 order lifecycle history verification (TEST DATA only)
// Prereq: migration 040 applied + wave2Setup run (test order exists).
'use strict'
const fs = require('fs')
const path = require('path')
const { api, ANON, rpc, login, S, readSecrets } = require('./wave2Lib.cjs')

const OUT = path.join(process.cwd(), 'e2e', 'wave2-order-history.json')

async function history(jwt, orderNumber) {
  const r = await api(ANON, 'GET', '/rest/v1/order_status_history?order_number=eq.' + orderNumber + '&select=*&order=changed_at.asc', undefined, jwt)
  return { status: r.status, rows: r.j || [] }
}

async function main() {
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  if (admin.status !== 200) throw new Error('admin login failed ' + admin.status)
  const cust = await login('qa-customer@bmb.co.th', readSecrets().BMB_TEST_CUSTOMER_PASSWORD)
  if (cust.status !== 200) throw new Error('customer login failed ' + cust.status)

  const ordersQ = await api(ANON, 'GET', '/rest/v1/orders?customer_ref=eq.' + cust.uid + '&select=order_number,status&order=created_at.desc&limit=10', undefined, admin.jwt)
  const order = (ordersQ.j || []).find((o) => o.status === 'pending')
  if (!order) throw new Error('no PENDING test order found — run node e2e/wave2Setup.cjs to create a fresh one')
  const onum = order.order_number

  const checks = []
  const push = (name, pass, detail) => checks.push({ name, pass, detail: detail == null ? '' : String(detail).slice(0, 220) })

  const before = await history(admin.jwt, onum)
  push('F05.initial_event_exists', before.status === 200 && before.rows.length >= 1,
    'rows=' + before.rows.length + ' first=' + JSON.stringify(before.rows[0] || {}).slice(0, 180))
  const first = before.rows[0]
  push('F05.initial_event_shape', first && first.from_status === null && first.to_status === 'pending' && first.actor_type === 'CUSTOMER',
    JSON.stringify(first || {}).slice(0, 180))

  // legal chain: pending → confirmed → preparing → ready_for_dispatch (admin)
  const chain = ['confirmed', 'preparing', 'ready_for_dispatch']
  let legalOk = true
  for (const st of chain) {
    const t = await rpc(admin.jwt, 'transition_order_status', { p_order_number: onum, p_new_status: st })
    if (t.status !== 200 || t.j?.ok !== true) { legalOk = false; push('F05.legal ' + st, false, t.status + ' ' + JSON.stringify(t.j || {}).slice(0, 120)) }
  }
  if (legalOk) push('F05.legal_chain', true, 'pending→confirmed→preparing→ready_for_dispatch')
  const afterLegal = await history(admin.jwt, onum)
  const statuses = afterLegal.rows.map((r) => r.to_status)
  push('F05.legal_chain_history', ['pending', 'confirmed', 'preparing', 'ready_for_dispatch'].every((s) => statuses.includes(s)),
    'to_statuses=' + statuses.join(','))
  const adminRows = afterLegal.rows.filter((r) => r.actor_type === 'ADMIN' && r.from_status != null)
  push('F05.actor_admin', adminRows.length >= 3, 'admin rows=' + adminRows.length)

  // illegal transition: delivered → preparing (off allow-list, current=ready_for_dispatch)
  const illegal = await rpc(admin.jwt, 'transition_order_status', { p_order_number: onum, p_new_status: 'delivered' })
  push('F05.illegal_rejected', illegal.status !== 200, illegal.status + ' ' + JSON.stringify(illegal.j || {}).slice(0, 120))
  const afterIllegal = await history(admin.jwt, onum)
  push('F05.illegal_no_history', afterIllegal.rows.length === afterLegal.rows.length,
    'rows before=' + afterLegal.rows.length + ' after=' + afterIllegal.rows.length)

  // duplicate (no-op) transition → allowed by state machine, NO new history row
  const dup = await rpc(admin.jwt, 'transition_order_status', { p_order_number: onum, p_new_status: 'ready_for_dispatch' })
  const afterDup = await history(admin.jwt, onum)
  push('F05.duplicate_no_history', dup.status === 200 && afterDup.rows.length === afterIllegal.rows.length,
    'dup=' + dup.status + ' rows=' + afterDup.rows.length)

  // customer cancel path (owner): pending → cancelled on a FRESH order created inline
  const prod = await api(ANON, 'GET', '/rest/v1/products?select=id,is_available&limit=10', undefined, admin.jwt)
  const prodOk = (prod.j || []).find((p) => p.is_available !== false)
  const fresh = await rpc(cust.jwt, 'create_order_with_items', {
    p_items: [{ product_id: prodOk.id, quantity: 1 }],
    p_delivery_round_id: 'round-w2-test',
    p_delivery_method: 'self_delivery',
    p_delivery_address: 'TEST-ORDER cancel-path (Wave 2)',
    p_dropoff_latitude: 10.7016,
    p_dropoff_longitude: 102.1429,
    p_customer_name: 'W2 Test Customer',
    p_customer_phone: '0990000001',
    p_payment_method: 'promptpay_qr',
  })
  if (fresh.status === 200 && fresh.j?.order_number) {
    const cancel = await rpc(cust.jwt, 'transition_order_status', { p_order_number: fresh.j.order_number, p_new_status: 'cancelled' })
    const cHist = await history(admin.jwt, fresh.j.order_number)
    push('F05.customer_cancel_history', cancel.status === 200 && cHist.rows.some((r) => r.to_status === 'cancelled' && r.actor_type === 'CUSTOMER'),
      'cancel=' + cancel.status + ' rows=' + JSON.stringify(cHist.rows.map((r) => [r.from_status, r.to_status, r.actor_type])))
  } else {
    push('F05.customer_cancel_history', false, 'inline order create failed ' + fresh.status + ' ' + JSON.stringify(fresh.j || {}).slice(0, 120))
  }

  // concurrent: two simultaneous same-target transitions — allow-list treats
  // p_from=p_to as idempotent (no history rows); the invariant that MUST hold is
  // history chain consistency vs final orders.status (no contradictory rows).
  const conc = await Promise.all([
    rpc(admin.jwt, 'transition_order_status', { p_order_number: onum, p_new_status: 'dispatched' }),
    rpc(admin.jwt, 'transition_order_status', { p_order_number: onum, p_new_status: 'dispatched' }),
  ])
  const okCount = conc.filter((c) => c.status === 200 && c.j?.ok).length
  push('F05.concurrent_no_corrupt', okCount >= 1 && okCount <= 2, 'same-target concurrent results=' + conc.map((c) => c.status).join(','))
  const finalHist = await history(admin.jwt, onum)
  const finalStatus = (await api(ANON, 'GET', '/rest/v1/orders?order_number=eq.' + onum + '&select=status', undefined, admin.jwt)).j?.[0]?.status
  let chainOk = finalHist.rows.length > 0 && finalHist.rows[0].from_status === null
  for (let i = 1; i < finalHist.rows.length; i++) {
    if (finalHist.rows[i].from_status !== finalHist.rows[i - 1].to_status) chainOk = false
  }
  const lastHist = finalHist.rows[finalHist.rows.length - 1]
  push('F05.history_chain_consistent', chainOk && lastHist && lastHist.to_status === finalStatus,
    'final=' + finalStatus + ' rows=' + finalHist.rows.map((r) => (r.from_status ?? 'null') + '>' + r.to_status).join(','))

  // client cannot insert history directly (forgery blocked)
  const forge = await api(ANON, 'POST', '/rest/v1/order_status_history', {
    id: 'osh-fake-forgery', order_number: onum, from_status: null, to_status: 'delivered', actor_type: 'CUSTOMER',
  }, cust.jwt)
  push('F05.client_forgery_blocked', forge.status !== 200 && forge.status !== 201, 'insert attempt=' + forge.status)

  const result = { kind: 'BMB_WAVE2_F05_ORDER_HISTORY', timestamp: new Date().toISOString(), env: 'PRODUCTION-DB (test data only)', commit: 'wave2', test_order: onum, checks, passCount: checks.filter((c) => c.pass).length, total: checks.length }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log('PASS ' + result.passCount + '/' + result.total)
  for (const c of checks) if (!c.pass) console.log('FAIL ' + c.name + ' :: ' + c.detail)
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })

