// ============================================
// BMB G4 — SIMULATED Meta webhook delivery (endpoint ตรง, ไม่ต้องรอคอมเมนต์จริง)
// ทำไม: Meta ปิดสร้าง Test User + ล็อกการ add role ชั่วคราว → dev-mode webhook
// ส่ง event จริงเข้าไม่ได้ จึงจำลอง delivery ที่ endpoint ด้วย payload ตาม
// รูปแบบ Meta จริง + HMAC(X-Hub-Signature-256, APP_SECRET) + page id จริง
// (ผ่าน allowlist) → ตรวจว่า intake → social_events → orders DB ครบ
// ครอบคลุม:
//   A. Messenger postback (GET_STARTED) — Meta real shape
//   B. Messenger message with order JSON (order intent → สร้าง order)
//   C. Facebook feed comment (changes[].value.item='comment')
//   D. redelivery B → duplicate_event idempotent
//   E. ตรวจ DB: social_events + orders row tag + customer_channel_identities
//   F. เทียบผลกับ g4CheckRealEvents.cjs (script เดิมต้องเห็น rows เหล่านี้)
// Hygiene: cancel test orders (customer_name like 'W3CSIM*') ด้วย cancel_order
// Usage: node e2e/g4SimulatedDelivery.cjs
// ============================================
'use strict'
const crypto = require('crypto')
const { SB, SERVICE, S, api, login, rpc } = require('./wave2Lib.cjs')

const FN = SB + '/functions/v1/channel-webhook'
const SECRET = S.CHANNEL_WEBHOOK_APP_SECRET
const PAGE = S.META_PAGE_ID || '862940416913026' // ต้องอยู่ใน channel_page_bindings
const ts = Date.now()
const sign = (b) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(b).digest('hex')
const payload = (entry) => JSON.stringify({ object: 'page', entry: [entry] })

async function call(bodyStr) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sign(bodyStr) }, body: bodyStr })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch {}
  return { status: r.status, j, text }
}

const t = (name, pass, detail) => { results.tests.push({ name, pass: !!pass, detail }); console.log((pass ? 'PASS' : 'FAIL') + ' ' + name + ' — ' + detail) }
const results = { date: new Date().toISOString(), target: FN, tests: [], orders: [] }

;(async () => {
  if (!SECRET) throw new Error('CHANNEL_WEBHOOK_APP_SECRET missing')
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  const nowT = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16)

  // setup: round วันนี้ cutoff ยังไม่ผ่าน (idempotent ต่อวัน) + product
  const rounds = await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=id,status,scheduled_date,cutoff_time&order=scheduled_date.desc&limit=50')
  const actives = (rounds.j || []).filter((r) => r.status === 'active' && (r.scheduled_date || r.date) === today && (r.cutoff_time || '00:00') > nowT)
  let round = actives[0]
  if (!round) {
    const rid = 'round-w3c-ext-' + today.replace(/-/g, '')
    const br = (await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=branch_id&limit=1')).j?.[0]?.branch_id
    const ins = await api(SERVICE, 'POST', '/rest/v1/delivery_rounds?on_conflict=id', {
      id: rid, display_name: 'W3C-EXT test round', name: 'W3C-EXT test round',
      branch_id: br, scheduled_date: today, cutoff_time: '23:59:00',
      delivery_start: '08:00:00', delivery_end: '20:00:00', status: 'active',
    })
    if (ins.status !== 200 && ins.status !== 201) throw new Error('create test round failed ' + ins.status)
    round = { id: rid }
  }
  const product = ((await api(SERVICE, 'GET', '/rest/v1/products?select=id,is_available&limit=50')).j || []).find((p) => p.is_available !== false)
  t('setup-round-product', !!round && !!product, 'round=' + round.id + ' product=' + product.id)

  // ===== A. Messenger postback (Meta real shape — ไม่มี message) =====
  const pbEv = { id: PAGE, time: ts, messaging: [{ sender: { id: 'sim-msgr-pb-' + ts }, recipient: { id: PAGE }, timestamp: ts, postback: { payload: 'GET_STARTED', title: 'Get Started' } }] }
  const bA = payload(pbEv)
  const rA = await call(bA)
  const eA = rA.j && rA.j.entries && rA.j.entries[0]
  t('A-messenger-postback-processed', rA.status === 200 && eA && eA.channel === 'MESSENGER' && eA.errors.length === 0 && eA.results && eA.results.social_event,
    'status=' + rA.status + ' social_event=' + (eA && eA.results && eA.results.social_event))

  // ===== B. Messenger message with order JSON → order =====
  const midB = 'sim-mid-' + ts
  const orderB = { order: { items: [{ product_id: product.id, quantity: 1 }], delivery_round_id: round.id, delivery_method: 'self_delivery', delivery_address: 'W3CSIM TEST address', dropoff_latitude: 10.7016, dropoff_longitude: 102.1429, customer_name: 'W3CSIM Test Messenger', customer_phone: '0990000091', payment_method: 'promptpay_qr' } }
  const bB = payload({ id: PAGE, time: ts, messaging: [{ sender: { id: 'sim-msgr-ord-' + ts }, recipient: { id: PAGE }, timestamp: ts, message: { mid: midB, text: JSON.stringify(orderB) } }] })
  const rB = await call(bB)
  const eB = rB.j && rB.j.entries && rB.j.entries[0]
  const orderNo = eB && eB.results && eB.results.order && eB.results.order.body && eB.results.order.body.order_number
  t('B-messenger-order-created', rB.status === 200 && eB && eB.channel === 'MESSENGER' && !!orderNo, 'status=' + rB.status + ' order=' + (orderNo || 'none'))

  // ===== C. Facebook feed comment =====
  const commentId = 'sim-comment-' + ts
  const bC = payload({ id: PAGE, time: ts, changes: [{ field: 'feed', value: { item: 'comment', post_id: PAGE + '_' + ts, comment_id: commentId, from: { id: 'sim-fb-user-' + ts, name: 'W3CSIM FB User' }, message: 'สนใจสั่งอาหารค่ะ', verb: 'add' } }] })
  const rC = await call(bC)
  const eC = rC.j && rC.j.entries && rC.j.entries[0]
  t('C-facebook-comment-processed', rC.status === 200 && eC && eC.channel === 'FACEBOOK' && eC.errors.length === 0, 'status=' + rC.status + ' channel=' + (eC && eC.channel))

  // ===== D. redelivery B → duplicate idempotent =====
  const rD = await call(bB)
  const eD = rD.j && rD.j.entries && rD.j.entries[0]
  const dup = eD && eD.results && (eD.results.duplicate_event || (eD.results.order && eD.results.order.body && eD.results.order.body.duplicate))
  t('D-redelivery-duplicate-idempotent', rD.status === 200 && !!dup, 'status=' + rD.status + ' dup=' + JSON.stringify(dup))

  // ===== E. ตรวจ DB: social_events + orders tag + identities =====
  const evIds = ['msg-' + midB, '862940416913026_' + ts]
  const sev = await api(SERVICE, 'GET', `/rest/v1/social_events?event_id=eq.${encodeURIComponent('msg-' + midB)}&select=event_id,platform,event_type,status`)
  const sevFb = await api(SERVICE, 'GET', `/rest/v1/social_events?platform=eq.FACEBOOK&sender_id=eq.${encodeURIComponent('sim-fb-user-' + ts)}&select=event_id,platform,event_type,status`)
  const sevRows = [...(sev.j || []), ...(sevFb.j || [])]
  t('E1-social-events-rows', sevRows.length >= 2 && sevRows.some((r) => r.platform === 'MESSENGER') && sevRows.some((r) => r.platform === 'FACEBOOK' && r.status === 'RECEIVED'), 'rows=' + JSON.stringify(sevRows))
  const orow = await api(SERVICE, 'GET', `/rest/v1/orders?source_channel=eq.MESSENGER&external_ref_id=eq.${encodeURIComponent('msg-' + midB)}&select=order_number,customer_name,status`)
  const orowOk = (orow.j || []).length === 1
  t('E2-order-row-tagged', orowOk, JSON.stringify(orow.j))
  if (orderNo && orow.j[0]) results.orders.push({ order_number: orderNo, customer_name: orow.j[0].customer_name })
  const ident = await api(SERVICE, 'GET', `/rest/v1/customer_channel_identities?external_user_id=eq.${encodeURIComponent('sim-msgr-ord-' + ts)}&select=channel,customer_ref`)
  t('E3-identity-bound', (ident.j || []).length === 1, JSON.stringify(ident.j))

  // ===== F. เทียบกับ g4CheckRealEvents.cjs — social_events 1h ล่าสุดต้องเห็น simulated rows
  const since = new Date(ts - 3600 * 1000).toISOString()
  const recent = await api(SERVICE, 'GET', `/rest/v1/social_events?received_at=gte.${encodeURIComponent(since)}&order=received_at.desc&limit=10&select=event_id,platform,event_type,received_at`)
  const recentOk = (recent.j || []).some((r) => evIds.includes(r.event_id))
  t('F-g4CheckRealEvents-visible', recentOk, 'recent rows=' + (recent.j || []).length + ' (script เดิมจะเห็น rows เหล่านี้)')

  // ===== Hygiene: cancel test orders ด้วย cancel_order =====
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  if (admin.status === 200) {
    const mine = await api(SERVICE, 'GET', `/rest/v1/orders?customer_name=like.W3CSIM*&status=neq.cancelled&select=order_number,status`)
    for (const o of mine.j || []) {
      const c = await rpc(admin.jwt, 'cancel_order', { p_order_number: o.order_number, p_reason: 'G4 simulated delivery cleanup' })
      console.log('cleanup:', o.order_number, '→', c.status)
    }
    results.orders_cancelled = (mine.j || []).length
  } else { console.log('cleanup SKIP — admin login failed ' + admin.status) }

  const pass = results.tests.filter((x) => x.pass).length
  console.log(`\nG4 SIMULATED DELIVERY: ${pass}/${results.tests.length}`)
  process.exit(pass === results.tests.length ? 0 : 1)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })