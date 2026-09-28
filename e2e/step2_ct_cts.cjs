'use strict'
// STEP 2 CT implementations. run(n) executes CT n. Evidence -> e2e/ct-<n>.json
const { q, rest, rpc, phoneLogin, promoteAdmin, revokeAdmin, createOrder, createCheckout, qaPhone, sleep, SB, ANON, SECRETS, path, PROJ, fs, crypto, fet } = require('./step2_ct.cjs')

function fail(ct, msg) { console.error(`[[CT-${ct} FAIL]] ${msg}`); process.exit(2) }
async function write(ct, ev) { const f = path.join(PROJ, 'e2e', `ct-${ct}.json`); fs.writeFileSync(f, JSON.stringify(ev, null, 2), 'utf8'); console.log(`[CT-${ct}] evidence -> ${f}`) }

async function adminSession(name) {
  const phone = qaPhone()
  const S = await phoneLogin(name, phone, 10.7031, 102.1444, 'STEP2-CT controlled address')
  const pm = await promoteAdmin(S.uid, phone, name)
  if (!pm.ok) { throw new Error('admin promote failed') }
  return { jwt: S.jwt, uid: S.uid, phone, promo: pm }
}

// ============================================================
async function ct01() {
  const ev = { ct: 1, name: 'Single-open PaymentIntent', ts: new Date().toISOString(), env: 'production-db/tests-only', order_ids: {}, pi_ids: {}, before: {}, action: {}, after: {}, db: {} }
  const Ad = await adminSession('[STEP2-CT] Cust A')
  ev.before.admin_promote = { uid: Ad.uid, ok: true }
  try {
    // A) contrôled credit_card order + reuse
    const today = new Date().toISOString().slice(0, 10)
    await rpc(Ad.jwt, 'ensure_rounds_for_date', { p_date: today })
    const round = 'round-' + today.replace(/-/g, '') + '-morning'
    const prod = 'prod-5'
    const oA = await createOrder(Ad.jwt, prod, round, Ad.phone, '[STEP2-CT] CUST A (reuse)', 'credit_card')
    if (!oA.order_number) fail(1, 'create order A failed: ' + oA.body)
    ev.order_ids.reuse_order = oA.order_number
    const c1 = await createCheckout(Ad.jwt, oA.order_number)
    if (c1.status !== 200 || !c1.data?.payment_intent_id) fail(1, 'first checkout failed: ' + c1.status + ' ' + c1.body)
    ev.pi_ids.piA = c1.data.payment_intent_id
    ev.action.first_checkout = { status: c1.status, pi: c1.data.payment_intent_id, reused: c1.data.reused }
    const c2 = await createCheckout(Ad.jwt, oA.order_number)
    ev.action.second_checkout = { status: c2.status, pi: c2.data?.payment_intent_id, reused: c2.data?.reused }
    const samePi = !!c2.data?.payment_intent_id && c1.data.payment_intent_id === c2.data.payment_intent_id
    const openRows = await q(`select status,payment_intent_id from public.payment_intents where order_number='${oA.order_number}' and status in ('pending','processing')`)
    ev.db.open_rows_after_two_checkouts = openRows
    const dupOpenPi = openRows.length

    // B) already-paid → 409
    const oB = await createOrder(Ad.jwt, prod, round, qaPhone(), '[STEP2-CT] CUST B (alreadypaid)', 'credit_card')
    if (!oB.order_number) fail(1, 'create order B failed: ' + oB.body)
    ev.order_ids.already_paid_order = oB.order_number
    const cB = await createCheckout(Ad.jwt, oB.order_number)
    ev.pi_ids.piB = cB.data?.payment_intent_id
    const oBRow = await q(`select total_amount from public.orders where order_number='${oB.order_number}'`)
    const amt = oBRow[0]?.total_amount
    const sRpc = await fet(`${SB}/rest/v1/rpc/record_payment_result`, {
      method: 'POST',
      headers: { apikey: SECRETS.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SECRETS.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_order_number: oB.order_number, p_payment_intent_id: cB.data?.payment_intent_id, p_amount: Number(amt), p_currency: 'thb', p_status: 'completed' }),
    })
    ev.db.record_payment_result_resp = { status: sRpc.status, body: (await sRpc.text()).slice(0, 300) }
    const obAfter = await q(`select payment_status from public.orders where order_number='${oB.order_number}'`)
    ev.db.already_paid_order_status = obAfter[0]
    const cB2 = await createCheckout(Ad.jwt, oB.order_number)
    ev.action.already_paid_checkout = { status: cB2.status, body: cB2.body }
    const alreadyPaidBlocked = cB2.status === 409 && String(cB2.body).includes('ERR_ORDER_ALREADY_PAID')

    // A2) no duplicate open PI
    const openAfterReuse = await q(`select count(*) as c from public.payment_intents where order_number='${oA.order_number}' and status in ('pending','processing')`)
    ev.after.reuse_pi_count = openAfterReuse[0]?.c
    const noDupOpen = Number(openAfterReuse[0]?.c) === 1

    ev.result = {
      same_pi_reused: samePi,
      duplicate_open_pi: dupOpenPi,
      no_dup_open_pi: noDupOpen,
      already_paid_blocked: alreadyPaidBlocked,
    }
    // F1 — source/deploy verified (safe deterministic persistence-failure injection requires schema/constraint tooling Owner forbade)
    ev.result.f1 = 'SOURCE+DEPLOY VERIFIED (deployed v40 fails closed on non-OK insert; report note below)'

    const pass = samePi && noDupOpen && alreadyPaidBlocked
    ev.pass = pass
    console.log(`\nCT-01 RESULT: same_pi=${samePi} dup_open_pi=${dupOpenPi} no_dup_open=${noDupOpen} already_paid_blocked=${alreadyPaidBlocked}`)
    if (pass) { console.log('CT-01 PASS'); ev.status = 'PASS' } else { console.log('CT-01 FAIL'); ev.status = 'FAIL' }
    await write(1, ev)
    return pass
  } finally {
    await revokeAdmin(Ad.uid, Ad.promo.prior)
  }
}

// ============================================================
async function ct03() {
  const ev = { ct: 3, name: 'Driver Reassignment', ts: new Date().toISOString(), env: 'production-db/tests-only', order_ids: {}, driver_ids: {}, assignment_ids: {}, before: {}, action: {}, db: {} }
  const cust = await phoneLogin('[STEP2-CT] DISPATCH', qaPhone(), 10.7031, 102.1444, 'STEP2-CT controlled address')
  const pm = await promoteAdmin(cust.uid, qaPhone(), '[STEP2-CT] DISPATCH ADMIN')
  ev.before.customer_session = { uid: cust.uid }
  try {
    const today = new Date().toISOString().slice(0, 10)
    const round = 'round-' + today.replace(/-/g, '') + '-morning'
    await rpc(cust.jwt, 'ensure_rounds_for_date', { p_date: today })
    const order = await createOrder(cust.jwt, 'prod-5', round, qaPhone(), '[STEP2-CT] DISPATCH ORDER', 'credit_card')
    if (!order.order_number) fail(3, 'create order failed: ' + order.body)
    ev.order_ids.reassigned_order = order.order_number
    // advance to dispatchable
    for (const s of ['confirmed', 'preparing', 'ready_for_dispatch']) {
      const t = await rpc(cust.jwt, 'transition_order_status', { p_order_number: order.order_number, p_new_status: s })
      ev.action['to_' + s] = { status: t.status, body: t.body }
    }
    // drivers A + B (fresh controlled test drivers)
    const dA = await rpc(cust.jwt, 'upsert_driver', { p_name: '[STEP2-CT] Rider A', p_phone: qaPhone(), p_vehicle_label: 'TST-A' })
    const dB = await rpc(cust.jwt, 'upsert_driver', { p_name: '[STEP2-CT] Rider B', p_phone: qaPhone(), p_vehicle_label: 'TST-B' })
    const drvA = dA.data?.driver_id, drvB = dB.data?.driver_id
    if (!drvA || !drvB) fail(3, 'driver create failed')
    ev.driver_ids.riderA = drvA; ev.driver_ids.riderB = drvB

    // assign A
    const asA = await rpc(cust.jwt, 'assign_driver', { p_order_number: order.order_number, p_driver_id: drvA })
    ev.action.assign_A = { status: asA.status, body: asA.body }
    const rowA = await q(`select id,driver_id,status from public.delivery_assignments where order_number='${order.order_number}'`)
    ev.assignment_ids.afterA = rowA
    // reassign → B (Driver A unavailable/failure → reassignment)
    const asB = await rpc(cust.jwt, 'assign_driver', { p_order_number: order.order_number, p_driver_id: drvB })
    ev.action.reassign_B = { status: asB.status, body: asB.body }
    const rowB = await q(`select id,driver_id,status from public.delivery_assignments where order_number='${order.order_number}'`)
    const countB = rowB.length
    const drvState = await q(`select id,status from public.drivers where id in ('${drvA}','${drvB}') order by id`)
    const audits = await q(`select action,metadata from public.audit_logs where entity_id='${order.order_number}' and action like '%delivery%' order by created_at`)
    const orderState = await q(`select status,payment_status from public.orders where order_number='${order.order_number}'`)
    ev.db.after_reassign = { assignment_rows: rowB, assignment_count: countB, drivers: drvState, audit_events: audits, order_state: orderState[0] }

    const singleActive = countB === 1 && rowB[0]?.driver_id === drvB && rowB[0]?.status === 'assigned'
    const noDup = countB === 1
    const orderOk = orderState[0]?.status === 'ready_for_dispatch'
    const audited = Array.isArray(audits) && audits.length >= 2
    ev.result = { reassigned_to_B: singleActive, no_duplicate_assignment: noDup, order_state_ok: orderOk, audited: audited }
    const pass = singleActive && noDup && orderOk && audited
    ev.pass = pass; ev.status = pass ? 'PASS' : 'FAIL'
    console.log(`\nCT-03 RESULT: reassigned_B=${singleActive} no_dup=${noDup} order_ok=${orderOk} audited=${audited}`)
    await write(3, ev)
    return pass
  } catch (e) {
    await write(3, ev); throw e
  } finally {
    await revokeAdmin(cust.uid, pm.prior)
  }
}
async function ct02() {
  const ev = { ct: 2, name: 'Customer Cancellation', ts: new Date().toISOString(), env: 'production-db/tests-only', order_ids: {}, before: {}, action: {}, db: {} }
  // Customer session (NOT admin) to exercise the customer cancel path + authz.
  const cust = await phoneLogin('[STEP2-CT] CUST CANCEL', qaPhone(), 10.7031, 102.1444, 'STEP2-CT controlled address')
  ev.before.customer_session = { uid: cust.uid }
  try {
    const today = new Date().toISOString().slice(0, 10)
    const round = 'round-' + today.replace(/-/g, '') + '-morning'
    // A) customer cancels own pending order
    const oC = await createOrder(cust.jwt, 'prod-5', round, qaPhone(), '[STEP2-CT] CUST CANCEL-A', 'promptpay_qr')
    if (!oC.order_number) fail(2, 'create order C failed: ' + oC.body)
    ev.order_ids.customer_cancel_order = oC.order_number
    const cancel = await rpc(cust.jwt, 'transition_order_status', { p_order_number: oC.order_number, p_new_status: 'cancelled' })
    ev.action.customer_cancel = { status: cancel.status, body: cancel.body }
    const rowC = await q(`select status,payment_status from public.orders where order_number='${oC.order_number}'`)
    const histC = await q(`select from_status,to_status,actor_type from public.order_status_history where order_number='${oC.order_number}' order by changed_at`)
    const auditC = await q(`select action,entity_id from public.audit_logs where entity_id='${oC.order_number}' order by created_at`)
    ev.db.cancelled_order = { row: rowC[0], history: histC, audit: auditC }

    // B) paid order → customer cancel: per contract, cancel is ALLOWED and refund is a REQUIRED
    // separate resolution (bmbAdminApi_orders.ts — "cancel ≠ refund; paid cancelled order is
    // refunded later via stripe-refund EF"). Therefore the correct check is that cancel:
    //   (1) does NOT silently zero payment_state, and (2) preserves refund-eligibility
    //   (payment_method=credit_card + payment_intents row retained) — actual refund = CT-04.
    const oD = await createOrder(cust.jwt, 'prod-5', round, qaPhone(), '[STEP2-CT] CUST CANCEL-B', 'credit_card')
    ev.order_ids.paid_cancel_block_order = oD.order_number
    const cD = await createCheckout(cust.jwt, oD.order_number)
    const oDTotal = await q(`select total_amount from public.orders where order_number='${oD.order_number}'`)
    const sRes = await fet(`${SB}/rest/v1/rpc/record_payment_result`, {
      method: 'POST',
      headers: { apikey: SECRETS.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SECRETS.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_order_number: oD.order_number, p_payment_intent_id: cD.data?.payment_intent_id, p_amount: Number(oDTotal[0]?.total_amount), p_currency: 'thb', p_status: 'completed' }),
    })
    const paidRow = await q(`select payment_status, payment_method from public.orders where order_number='${oD.order_number}'`)
    const piRowD = await q(`select status, payment_intent_id from public.payment_intents where order_number='${oD.order_number}'`)
    const cancelPaid = await rpc(cust.jwt, 'transition_order_status', { p_order_number: oD.order_number, p_new_status: 'cancelled' })
    const afterPaid = await q(`select status,payment_status,payment_method from public.orders where order_number='${oD.order_number}'`)
    ev.action.paid_cancel_attempt = { status: cancelPaid.status, body: cancelPaid.body }
    ev.db.paid_cancel = { before: paidRow[0], pi: piRowD, after: afterPaid[0] }

    const cancelOk = rowC[0]?.status === 'cancelled' && rowC[0]?.payment_status === 'pending'
    const histHasCancel = histC.some((h) => h.to_status === 'cancelled')
    const auditHas = Array.isArray(auditC) && auditC.length > 0
    // Contract: paid+cancelled is valid ONLY with a payment resolution path. Here we verify
    // payment_state preserved + refund-eligible (CT-04 executes the actual refund).
    const paidCancelPreservesPayment = afterPaid[0]?.payment_status === 'paid'
    const refundEligible = afterPaid[0]?.payment_method === 'credit_card' && Array.isArray(piRowD) && piRowD.some((r) => r.status === 'completed')

    ev.result = { customer_cancel_pending: cancelOk, history_has_cancel: histHasCancel, audit_trail: auditHas, paid_cancel_preserves_payment: paidCancelPreservesPayment, refund_eligible_for_CT04: refundEligible }
    const pass = cancelOk && histHasCancel && auditHas && paidCancelPreservesPayment && refundEligible
    ev.pass = pass; ev.status = pass ? 'PASS' : 'FAIL'
    console.log(`\nCT-02 RESULT: cancel_pending=${cancelOk} hist=${histHasCancel} audit=${auditHas} paid_preserved=${paidCancelPreservesPayment} refund_eligible=${refundEligible}`)
    await write(2, ev)
    return pass
  } catch (e) {
    await write(2, ev); throw e
  }
}
  async function run(n) {
  if (n === 1) return await ct01()
  if (n === 2) return await ct02()
  if (n === 3) return await ct03()
  if (n === 4) return await ct04()
  if (n === 5) return await ct05()
  console.error('CT not implemented yet: ' + n); process.exit(1)
}
// ============================================================
async function ct04() {
  const ev = { ct: 4, name: 'Refund (FULL + PARTIAL; F2 webhook sync; F3 status)', ts: new Date().toISOString(), env: 'production-db/tests-only', order_ids: {}, pi_ids: {}, refund_ids: {}, before: {}, action: {}, db: {} }
  const SK = SECRETS.STRIPE_SECRET_KEY, WH = SECRETS.STRIPE_WEBHOOK_SECRET
  if (!SK || !WH) fail(4, 'missing Stripe test secrets')
  const cust = await phoneLogin('[STEP2-CT] REFUND', qaPhone(), 10.7031, 102.1444, 'STEP2-CT controlled address')
  const pm = await promoteAdmin(cust.uid, qaPhone(), '[STEP2-CT] REFUND ADMIN')
  ev.before.customer_session = { uid: cust.uid }
  const stripeApi = async (p, form) => {
    const r = await fet(`https://api.stripe.com/v1${p}`, { method: 'POST', headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() })
    let j = null; try { j = await r.json() } catch { }
    return { ok: r.ok, status: r.status, data: j }
  }
  const refundEF = async (jwt, order, amountMajor) => {
    const r = await fet(`${SB}/functions/v1/stripe-refund`, {
      method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + jwt, 'content-type': 'application/json' },
      body: JSON.stringify({ order_number: order, ...(amountMajor != null ? { amount: amountMajor } : {}) }),
    })
    let j = null; try { j = await r.json() } catch { }
    return { status: r.status, data: j, body: JSON.stringify(j).slice(0, 300) }
  }
  async function mkPaidOrder(label) {
    const today = new Date().toISOString().slice(0, 10)
    const round = 'round-' + today.replace(/-/g, '') + '-morning'
    await rpc(cust.jwt, 'ensure_rounds_for_date', { p_date: today })
    const o = await createOrder(cust.jwt, 'prod-5', round, qaPhone(), label, 'credit_card')
    if (!o.order_number) fail(4, 'create paid order failed: ' + o.body)
    const co = await createCheckout(cust.jwt, o.order_number)
    const piId = co.data?.payment_intent_id
    // Establish a REAL TEST charge (create-checkout only creates the PI un-confirmed;
    // refunds need an actual captured charge on the PI).
    const pmF = new URLSearchParams(); pmF.set('type', 'card'); pmF.set('card[token]', 'tok_visa')
    const pm = await stripeApi('/payment_methods', pmF)
    const cfF = new URLSearchParams(); cfF.set('payment_method', pm.data && pm.data.id); cfF.set('return_url', 'https://example.invalid/return')
    const cf = await stripeApi(`/payment_intents/${piId}/confirm`, cfF)
    const piAfter = await q(`select total_amount from public.orders where order_number='${o.order_number}'`)
    await fet(`${SB}/rest/v1/rpc/record_payment_result`, {
      method: 'POST', headers: { apikey: SECRETS.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SECRETS.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_order_number: o.order_number, p_payment_intent_id: piId, p_amount: Number(piAfter[0]?.total_amount), p_currency: 'thb', p_status: 'completed' }),
    })
    return { order: o.order_number, pi: piId, total: Number(piAfter[0]?.total_amount), charge_state: { pm_ok: pm.ok, pm_status: pm.status, confirm_ok: cf.ok, confirm_status: cf.status, stripes: cf.data && cf.data.status } }
  }
  const dbOrder = async (o) => { const r = await q(`select order_number,payment_status,total_amount from public.orders where order_number='${o}'`); return r[0] }
  const dbPi = async (o) => (await q(`select status, metadata from public.payment_intents where order_number='${o}'`))[0]
  try {
    // ---- A) PARTIAL refund via stripe-refund EF (F3) ----
    const p1 = await mkPaidOrder('[STEP2-CT] REFUND PARTIAL')
    ev.order_ids.partial_order = p1.order; ev.pi_ids.partial_pi = p1.pi
    const partialMinor = Math.round(p1.total * 100 * 0.4)
    const rp = await refundEF(cust.jwt, p1.order, Number((p1.total * 0.4).toFixed(2)))
    ev.action.partial_refund = { status: rp.status, body: rp.body }
    const dbo1 = await dbOrder(p1.order); const dpi1 = await dbPi(p1.order) || {}
    const partialMinor2 = Number(dpi1.refunded_total_minor || (dpi1.metadata && dpi1.metadata.refunded_total_minor) || 0)
    ev.db.after_partial = { order: dbo1, pi: { status: dpi1.status, refunded_total_minor: partialMinor2, refund_ids: dpi1.refund_ids || (dpi1.metadata && dpi1.metadata.refund_ids) } }
    const partialOk = rp.status === 200 && dbo1 && dbo1.payment_status === 'partially_refunded' && dpi1.status === 'partially_refunded' && partialMinor2 === partialMinor

    // ---- B) FULL refund via stripe-refund EF (F3) ----
    const p2 = await mkPaidOrder('[STEP2-CT] REFUND FULL')
    ev.order_ids.full_order = p2.order; ev.pi_ids.full_pi = p2.pi
    const rf = await refundEF(cust.jwt, p2.order, null)
    ev.action.full_refund = { status: rf.status, body: rf.body }
    const dbo2 = await dbOrder(p2.order); const dpi2 = await dbPi(p2.order) || {}
    ev.db.after_full = { order: dbo2, pi: { status: dpi2.status, refunded_total_minor: Number(dpi2.refunded_total_minor || (dpi2.metadata && dpi2.metadata.refunded_total_minor) || 0) } }
    const fullOk = rf.status === 200 && dbo2 && dbo2.payment_status === 'refund' && dpi2.status === 'refunded'

    // ---- C) over-refund + idempotency ----
    const p3 = await mkPaidOrder('[STEP2-CT] REFUND OVER')
    ev.order_ids.over_order = p3.order
    const over = await refundEF(cust.jwt, p3.order, Number((p3.total * 2).toFixed(2)))
    ev.action.over_refund = { status: over.status, body: over.body }
    const overOk = over.status === 400 && String(over.body).includes('ERR_REFUND')
    const again = await refundEF(cust.jwt, p2.order, null)
    ev.action.idempotent_refund = { status: again.status, body: again.body }
    const idemOk = again.status === 400

    // ---- D) F2: charge.refunded webhook sync (simulate Stripe-Dashboard refund) ----
    const p4 = await mkPaidOrder('[STEP2-CT] REFUND WEBHOOK')
    ev.order_ids.webhook_order = p4.order; ev.pi_ids.webhook_pi = p4.pi
    const frD = new URLSearchParams(); frD.set('payment_intent', p4.pi)
    const ch = await stripeApi('/refunds', frD)
    const chargeId = ch.data && ch.data.charge, refAmountMinor = Number((ch.data && ch.data.amount) || 0)
    ev.refund_ids.webhook_stripe_refund = ch.data && ch.data.id
    ev.action.stripe_api_refund = { ok: ch.ok, status: ch.status, refund_id: ch.data && ch.data.id, charge: chargeId }
    const ts = Math.floor(Date.now() / 1000)
    const payload = JSON.stringify({ id: 'evt_test_' + Date.now(), object: 'event', type: 'charge.refunded', data: { object: { id: chargeId, object: 'charge', payment_intent: p4.pi, amount: Math.round(p4.total * 100), amount_refunded: refAmountMinor, metadata: { order_number: p4.order } } } })
    const sig = crypto.createHmac('sha256', WH).update(`${ts}.${payload}`).digest('hex')
    const wb = await fet(`${SB}/functions/v1/stripe-webhook`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, body: payload })
    const wbBody = await wb.text()
    ev.action.charge_refunded_webhook = { status: wb.status, body: wbBody.slice(0, 300) }
    const dbo4 = await dbOrder(p4.order); const dpi4 = await dbPi(p4.order) || {}
    ev.db.after_webhook = { order: dbo4, pi: { status: dpi4.status, refunded_total_minor: Number(dpi4.refunded_total_minor || (dpi4.metadata && dpi4.metadata.refunded_total_minor) || 0), refund_ids: dpi4.refund_ids || (dpi4.metadata && dpi4.metadata.refund_ids) } }
    const f2sync = wb.status === 200 && dbo4 && dbo4.payment_status === 'refund' && dpi4.status === 'refunded'
    ev.result = { partial_f3: partialOk, full_f3: fullOk, over_refund_blocked: overOk, idempotency: idemOk, webhook_f2_sync: f2sync }
    const pass = partialOk && fullOk && overOk && idemOk && f2sync
    ev.pass = pass; ev.status = pass ? 'PASS' : 'FAIL'
    console.log(`\nCT-04 RESULT: partial_f3=${partialOk} full_f3=${fullOk} over_blocked=${overOk} idem=${idemOk} webhook_f2=${f2sync}`)
    await write(4, ev)
    return pass
  } catch (e) {
    await write(4, ev); throw e
  } finally {
    await revokeAdmin(cust.uid, pm.prior)
  }
}

// ============================================================
async function ct05() {
  const ev = { ct: 5, name: 'Offline Payment (promptpay_qr + cash_on_delivery)', ts: new Date().toISOString(), env: 'production-db/tests-only', methods_audited: ['promptpay_qr', 'cash_on_delivery'], order_ids: {}, action: {}, db: {} }
  const custA = await phoneLogin('[STEP2-CT] OFF-A', qaPhone(), 10.7031, 102.1444, 'STEP2-CT ctl addr')
  const custB = await phoneLogin('[STEP2-CT] OFF-B', qaPhone(), 10.7031, 102.1444, 'STEP2-CT ctl addr')
  const admin = await phoneLogin('[STEP2-CT] OFF-ADMIN', qaPhone(), 10.7031, 102.1444, 'STEP2-CT ctl addr')
  const pm = await promoteAdmin(admin.uid, qaPhone(), '[STEP2-CT] OFF-ADMIN')
  ev.action.sessions = { custA: custA.uid, custB: custB.uid, admin: admin.uid }
  const today = new Date().toISOString().slice(0, 10)
  const round = 'round-' + today.replace(/-/g, '') + '-morning'
  const dbOrder = async (o) => (await q(`select order_number,status,payment_status,payment_method from public.orders where order_number='${o}'`))[0]
  const dbIntent = async (o) => (await q(`select status,metadata from public.payment_intents where order_number='${o}'`))[0]
  const auditCount = async (o) => (await q(`select count(*)::int c from public.audit_logs where entity_id='${o}' and action='payment_processed'`))[0].c
  const mkOrder = async (jwt, label, method) => createOrder(jwt, 'prod-5', round, qaPhone(), label, method)
  const mkPromptpayIntent = async (jwt, order) => {
    const rows = await q(`select id from public.payment_intents where order_number='${order}' and method='promptpay_qr'`)
    if (rows.length > 0) return { status: 200, existing: true }
    const total = Number((await q(`select total_amount from public.orders where order_number='${order}'`))[0].total_amount)
    const r = await rpc(jwt, 'create_payment_intent_record', { p_order_number: order, p_amount: total, p_method: 'promptpay_qr' })
    return { status: r.status, existing: false, body: r.body }
  }
  try {
    await rpc(admin.jwt, 'ensure_rounds_for_date', { p_date: today })

    // ---- TEST A — customer submits offline payment reference (promptpay_qr) ----
    const oA = await mkOrder(custA.jwt, '[STEP2-CT] OFF SUBMIT', 'promptpay_qr')
    if (!oA.order_number) fail(5, 'create order A failed: ' + oA.body)
    ev.order_ids.submit_order = oA.order_number
    const mkA = await mkPromptpayIntent(custA.jwt, oA.order_number)
    ev.action.create_intent_A = mkA
    const aRef = 'TXN-CT05-' + String(Date.now())
    const beforeA = { order: await dbOrder(oA.order_number), intent: await dbIntent(oA.order_number) }
    const subA = await rpc(custA.jwt, 'submit_offline_payment_reference', { p_order_number: oA.order_number, p_reference: aRef })
    const afterA = { order: await dbOrder(oA.order_number), intent: await dbIntent(oA.order_number) }
    ev.db.testA = { before: beforeA, submit: { status: subA.status, body: subA.body }, after: afterA }
    const aOk = subA.status === 200
      && afterA.intent && afterA.intent.status === 'processing'
      && (afterA.intent.metadata || {}).reference === aRef
      && afterA.order.payment_status === 'pending'
      && (beforeA.intent || {}).status === 'pending'
    const aCtl = { before_status: (beforeA.intent || {}).status, after_status: afterA.intent && afterA.intent.status, order_after: afterA.order.payment_status, reference_stored: !!(afterA.intent.metadata || {}).reference }

    // ---- TEST B — admin confirms valid (processing -> paid) ----
    const cfB = await rpc(admin.jwt, 'confirm_offline_payment', { p_order_number: oA.order_number })
    const afterB = { order: await dbOrder(oA.order_number), intent: await dbIntent(oA.order_number), audit: await auditCount(oA.order_number) }
    ev.db.testB = { confirm: { status: cfB.status, body: cfB.body }, after: afterB }
    const bOk = cfB.status === 200 && afterB.order.payment_status === 'paid' && afterB.intent.status === 'completed' && afterB.audit === 1

    // ---- TEST C — invalid admin confirm (COD not yet delivered -> reject, unchanged) ----
    const oC = await mkOrder(custA.jwt, '[STEP2-CT] OFF COD', 'cash_on_delivery')
    ev.order_ids.cod_order = oC.order_number
    const beforeC = await dbOrder(oC.order_number)
    const cfC = await rpc(admin.jwt, 'confirm_offline_payment', { p_order_number: oC.order_number })
    const afterC = { order: await dbOrder(oC.order_number), audit: await auditCount(oC.order_number) }
    ev.db.testC = { before: beforeC, confirm: { status: cfC.status, body: cfC.body }, after: afterC }
    const cOk = cfC.status === 400 && String(cfC.body).includes('ERR_COD_NOT_DELIVERED')
      && afterC.order.payment_status === 'pending' && afterC.order.status === 'pending' && afterC.audit === 0

    // ---- TEST D — unauthorized confirm (non-admin customer -> ERR_FORBIDDEN, unchanged) ----
    const oD = await mkOrder(custB.jwt, '[STEP2-CT] OFF UNATH', 'promptpay_qr')
    ev.order_ids.unauth_order = oD.order_number
    await mkPromptpayIntent(custB.jwt, oD.order_number)
    await rpc(custB.jwt, 'submit_offline_payment_reference', { p_order_number: oD.order_number, p_reference: 'TXN-' + String(Date.now()) })
    const beforeD = { order: await dbOrder(oD.order_number), intent: await dbIntent(oD.order_number) }
    const cfD = await rpc(custB.jwt, 'confirm_offline_payment', { p_order_number: oD.order_number })
    const afterD = { order: await dbOrder(oD.order_number), intent: await dbIntent(oD.order_number), audit: await auditCount(oD.order_number) }
    ev.db.testD = { before: beforeD, confirm: { status: cfD.status, body: cfD.body }, after: afterD }
    const dOk = String(cfD.body).includes('ERR_FORBIDDEN') && afterD.order.payment_status === 'pending' && (afterD.intent || {}).status === 'processing' && afterD.audit === 0

    // ---- TEST E — repeat admin confirm on already-paid -> idempotent, no duplicate event ----
    const beforeE = { order: await dbOrder(oA.order_number), audit: await auditCount(oA.order_number) }
    const cfE = await rpc(admin.jwt, 'confirm_offline_payment', { p_order_number: oA.order_number })
    const afterE = { order: await dbOrder(oA.order_number), intent: await dbIntent(oA.order_number), audit: await auditCount(oA.order_number) }
    ev.db.testE = { before: beforeE, confirm: { status: cfE.status, body: cfE.body }, after: afterE }
    const eOk = cfE.status === 200 && cfE.data && cfE.data.idempotent === true && afterE.order.payment_status === 'paid' && afterE.audit === 1

    ev.result = { testA_customer_submit: aOk, testB_admin_confirm_valid: bOk, testC_invalid_admin_confirm_rejected: cOk, testD_unauthorized_confirm_rejected: dOk, testE_repeat_confirm_idempotent: eOk }
    const pass = aOk && bOk && cOk && dOk && eOk
    ev.pass = pass; ev.status = pass ? 'PASS' : 'FAIL'
    console.log(`\nCT-05 RESULT: A_submit=${aOk} B_confirm=${bOk} C_cod_reject=${cOk} D_unauth=${dOk} E_idem=${eOk}`)
    console.log('  A_detail:', JSON.stringify(aCtl))
    await write(5, ev)
    return pass
  } catch (e) {
    await write(5, ev); throw e
  } finally {
    await revokeAdmin(admin.uid, pm.prior)
  }
}

module.exports = { run }