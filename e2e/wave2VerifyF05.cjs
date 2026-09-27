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

  const ordersQ = await api(ANON, 'GET', '/rest/v1/orders?customer_ref=eq.' + cust.uid + '&select=order_number,status&order=created_at.desc&limit=5', undefined, admin.jwt)
  const order = (ordersQ.j || [])[0]
  if (!order) throw new Error('no test order found — run wave2Setup first')
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

  // customer cancel path (owner): pending → cancelled (second test order)
  const ordersQ2 = await api(ANON, 'GET', '/rest/v1/orders?customer_ref=eq.' + cust.uid + '&select=order_number,status&order=created_at.desc&limit=5', undefined, admin.jwt)
  const second = (ordersQ2.j || []).find((o) => o.status === 'pending' && o.order_number !== onum)
  if (second) {
    const cancel = await rpc(cust.jwt, 'transition_order_status', { p_order_number: second.order_number, p_new_status: 'cancelled' })
    const cHist = await history(admin.jwt, second.order_number)
    push('F05.customer_cancel_history', cancel.status === 200 && cHist.rows.some((r) => r.to_status === 'cancelled' && r.actor_type === 'CUSTOMER'),
      'cancel=' + cancel.status + ' rows=' + JSON.stringify(cHist.rows.map((r) => [r.from_status, r.to_status, r.actor_type])))
  } else {
    push('F05.customer_cancel_history', false, 'no second pending test order (run wave2Setup again to create one)')
  }

  // concurrent: two simultaneous transitions must not both win
  const conc = await Promise.all([
    rpc(admin.jwt, 'transition_order_status', { p_order_number: onum, p_new_status: 'dispatched' }),
    rpc(admin.jwt, 'transition_order_status', { p_order_number: onum, p_new_status: 'dispatched' }),
  ])
  const wins = conc.filter((c) => c.status === 200 && c.j?.ok).length
  push('F05.concurrent_single_winner', wins === 1, 'results=' + conc.map((c) => c.status).join(','))
  const finalHist = await history(admin.jwt, onum)
  const finalStatus = (await api(ANON, 'GET', '/rest/v1/orders?order_number=eq.' + onum + '&select=status', undefined, admin.jwt)).j?.[0]?.status
  const lastHist = finalHist.rows[finalHist.rows.length - 1]
  push('F05.concurrent_history_matches_final', lastHist && lastHist.to_status === finalStatus,
    'final=' + finalStatus + ' lastHistory=' + (lastHist && lastHist.to_status))

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

    'dup=' + dup.status + ' rows=' + afterDup.rows.length)

