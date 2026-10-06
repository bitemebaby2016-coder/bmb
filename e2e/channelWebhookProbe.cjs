// ============================================
// BMB W3-C-EXTERNAL — channel-webhook production probe (TEST DATA ONLY)
// Evidence: e2e/channel-webhook-e2e.json
// Usage: node e2e/channelWebhookProbe.cjs
// NOTE: Meta production credentials = NOT configured (honest BLOCKED).
// Signature verification IS runtime-verified with the configured test secret.
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { SB, ANON, SERVICE, S, api, login, rpc } = require('./wave2Lib.cjs')

const FN = SB + '/functions/v1/channel-webhook'
const SECRET = S.CHANNEL_WEBHOOK_APP_SECRET
const TOKEN = S.CHANNEL_WEBHOOK_VERIFY_TOKEN
// Real page id — must exist in channel_page_bindings (G3 HC-1 allowlist);
// synthetic page ids are rejected as page_unbound by design.
const PAGE = '862940416913026'
const ts = Date.now()

const sign = (body) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex')

async function call(qs, bodyStr, headers = {}) {
  const r = await fetch(FN + (qs || ''), {
    method: bodyStr === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: bodyStr === undefined ? undefined : bodyStr,
  })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch {}
  return { status: r.status, j, text }
}

const payload = (entry) => JSON.stringify({ object: 'page', entry: [entry] })
const sig = (body) => ({ 'x-hub-signature-256': sign(body) })

;(async () => {
  const out = { date: new Date().toISOString(), target: FN, tests: [] }
  const t = (name, pass, detail) => out.tests.push({ name, pass, detail })

  // 1. Meta verification handshake
  const v1 = await call(`?hub.mode=subscribe&hub.verify_token=${TOKEN}&hub.challenge=CHALLENGE_123`, undefined)
  t('verification-handshake', v1.status === 200 && v1.text.includes('CHALLENGE_123'), 'status=' + v1.status + ' body=' + v1.text.slice(0, 40))
  const v2 = await call(`?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=X`, undefined)
  t('verification-wrong-token-rejected', v2.status === 403, 'status=' + v2.status)

  // 2. unsigned / bad signature
  const body1 = payload({ id: 'pg-test', time: ts, messaging: [{ sender: { id: 'ext-fb-user-1' }, recipient: { id: 'page-1' }, timestamp: ts, message: { mid: 'mid-' + ts, text: 'สวัสดีค่ะ' } }] })
  const u1 = await call('', body1, {})
  t('unsigned-rejected', u1.status === 401, 'status=' + u1.status)
  const u2 = await call('', body1, { 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) })
  t('bad-signature-rejected', u2.status === 401, 'status=' + u2.status)

  // 3. malformed json (signed)
  const m1 = await call('', 'not-json{', sig('not-json{'))
  t('malformed-json-400', m1.status === 400, 'status=' + m1.status)

  // 4. unsupported object (signed)
  const bad = JSON.stringify({ object: 'instagram', entry: [] })
  const u3 = await call('', bad, sig(bad))
  t('unsupported-object-400', u3.status === 400, 'status=' + u3.status)

  // 5. unknown-origin event (no group_id/item metadata) → rejected, not guessed
  const unk = payload({ id: 'pg-test', time: ts, changes: [{ value: { foo: 'bar' } }] })
  const u4 = await call('', unk, sig(unk))
  const u4e = u4.j && u4.j.entries && u4.j.entries[0]
  t('unknown-origin-rejected', u4.status === 200 && u4e && u4e.errors.length > 0 && !u4e.channel, 'channel=' + (u4e && u4e.channel) + ' errors=' + JSON.stringify(u4e && u4e.errors))

  // 6. setup: today round (cutoff ยังไม่ผ่าน) + product (canonical contract)
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10) // Asia/Bangkok date
  const nowT = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16)
  const rounds = await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=id,status,scheduled_date,cutoff_time,branch_id&order=scheduled_date.desc&limit=50')
  const actives = (rounds.j || []).filter((r) => r.status === 'active' && (r.scheduled_date || r.date) === today && (r.cutoff_time || '00:00') > nowT)
  let round = actives[0]
  if (!round) {
    // สร้าง test round ของวันนี้ (cutoff 23:59) — idempotent ต่อวัน
    const rid = 'round-w3c-ext-' + today.replace(/-/g, '')
    const br = (await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=branch_id&limit=1')).j?.[0]?.branch_id
    const ins = await api(SERVICE, 'POST', '/rest/v1/delivery_rounds?on_conflict=id', {
      id: rid, display_name: 'W3C-EXT test round', name: 'W3C-EXT test round',
      branch_id: br, scheduled_date: today, cutoff_time: '23:59:00',
      delivery_start: '08:00:00', delivery_end: '20:00:00', status: 'active',
    })
    if (ins.status !== 200 && ins.status !== 201) throw new Error('create test round failed ' + ins.status + ' ' + JSON.stringify(ins.j))
    round = { id: rid }
  }
  const products = await api(SERVICE, 'GET', '/rest/v1/products?select=id,is_available,available_same_day&limit=50')
  const product = (products.j || []).find((p) => p.is_available !== false)
  t('setup-round-product', !!round && !!product, 'round=' + (round && round.id) + ' product=' + (product && product.id))

  // 7. MESSENGER order event → canonical order (provisioned customer)
  const mid = 'f14-mid-' + ts
  const orderPayload = {
    order: {
      items: [{ product_id: product.id, quantity: 1 }],
      delivery_round_id: round.id,
      delivery_method: 'self_delivery',
      delivery_address: 'W3C-EXT TEST address',
      dropoff_latitude: 10.7016,
      dropoff_longitude: 102.1429,
      customer_name: 'W3CEXT Test Messenger',
      customer_phone: '0990000081',
      payment_method: 'promptpay_qr',
    },
  }
  const msgev = { id: PAGE, time: ts, messaging: [{ sender: { id: 'ext-msgr-' + ts }, recipient: { id: 'page-1' }, timestamp: ts, message: { mid, text: JSON.stringify(orderPayload) } }] }
  const b2 = payload(msgev)
  const r1 = await call('', b2, sig(b2))
  const r1e = r1.j && r1.j.entries && r1.j.entries[0]
  const msgOrder = r1e && r1e.results && r1e.results.order && r1e.results.order.body
  const msgOrderNumber = msgOrder && msgOrder.order_number
  t('messenger-order-intake', r1.status === 200 && r1e && r1e.channel === 'MESSENGER' && !!msgOrderNumber,
    'status=' + r1.status + ' channel=' + (r1e && r1e.channel) + ' order=' + (msgOrderNumber || 'none') + ' body=' + (r1e && r1e.results && r1e.results.order ? JSON.stringify(r1e.results.order).slice(0, 140) : 'null'))

  // 8. order row: source_channel=MESSENGER + external_ref_id=event id
  const msgrRef = 'msg-' + mid
  const orow = await api(SERVICE, 'GET', `/rest/v1/orders?source_channel=eq.MESSENGER&external_ref_id=eq.${encodeURIComponent(msgrRef)}&select=order_number`)
  t('messenger-order-row-tagged', (orow.j || []).length === 1, 'rows=' + (orow.j || []).length + ' ref=' + msgrRef)

  // 9. duplicate event → no new order
  const r2 = await call('', b2, sig(b2))
  const r2e = r2.j && r2.j.entries && r2.j.entries[0]
  const cnt2 = await api(SERVICE, 'GET', `/rest/v1/orders?source_channel=eq.MESSENGER&external_ref_id=eq.${encodeURIComponent(msgrRef)}&select=order_number`)
  t('duplicate-event-idempotent', r2.status === 200 && r2e && (r2e.results.duplicate_event === true || (r2e.results.order && r2e.results.order.body && r2e.results.order.body.duplicate === true)) && (cnt2.j || []).length === 1,
    'dup_event=' + (r2e && r2e.results.duplicate_event) + ' order_dup=' + (r2e && r2e.results && r2e.results.order && r2e.results.order.body && r2e.results.order.body.duplicate) + ' rows=' + (cnt2.j || []).length)

  // 10. FACEBOOK page-change event (item metadata) → audited, channel=FACEBOOK
  const fbev = { id: PAGE, time: ts, changes: [{ field: 'feed', value: { item: 'post', post_id: 'post-' + ts, from: { id: 'ext-fbuser-' + ts } } }] }
  const b3 = payload(fbev)
  const r3 = await call('', b3, sig(b3))
  const r3e = r3.j && r3.j.entries && r3.j.entries[0]
  t('facebook-change-event', r3.status === 200 && r3e && r3e.channel === 'FACEBOOK' && r3e.errors.length === 0,
    'channel=' + (r3e && r3e.channel))

  // 11. FACEBOOK_GROUP event (explicit group_id) → channel=FACEBOOK_GROUP
  const grev = { id: PAGE, time: ts, changes: [{ field: 'feed', value: { item: 'comment', group_id: 'grp-' + ts, comment_id: 'cmt-' + ts, from: { id: 'ext-fbuser-g-' + ts } } }] }
  const b4 = payload(grev)
  const r4 = await call('', b4, sig(b4))
  const r4e = r4.j && r4.j.entries && r4.j.entries[0]
  t('facebook-group-channel', r4.status === 200 && r4e && r4e.channel === 'FACEBOOK_GROUP', 'channel=' + (r4e && r4e.channel))

  // 12. concurrency: parallel identical MESSENGER order events → ONE order
  const mid2 = 'f14-mid-c-' + ts
  const ev2 = { id: PAGE, time: ts, messaging: [{ sender: { id: 'ext-msgr-c-' + ts }, recipient: { id: 'page-1' }, timestamp: ts, message: { mid: mid2, text: JSON.stringify(orderPayload) } }] }
  const b5 = payload(ev2)
  const [p1, p2] = await Promise.all([call('', b5, sig(b5)), call('', b5, sig(b5))])
  await new Promise((r) => setTimeout(r, 1500))
  const ccnt = await api(SERVICE, 'GET', `/rest/v1/orders?source_channel=eq.MESSENGER&external_ref_id=eq.msg-${mid2}&select=order_number`)
  t('concurrent-one-order', p1.status === 200 && p2.status === 200 && (ccnt.j || []).length === 1, 'rows=' + (ccnt.j || []).length)

  // 13. no secret leakage in responses
  const leakRe = new RegExp(SECRET.slice(0, 10) + '|' + TOKEN.slice(0, 8) + '|' + (S.SUPABASE_SERVICE_ROLE_KEY || '###').slice(0, 12))
  const leaks = [v1, v2, u1, u2, m1, u3, u4, r1, r2, r3, r4, p1, p2].filter((x) => leakRe.test(x.text)).length
  t('no-secret-leak', leaks === 0, 'responses=13 leaks=' + leaks)

  out.pass = out.tests.every((x) => x.pass)
  out.pass_count = out.tests.filter((x) => x.pass).length
  out.total = out.tests.length
  fs.writeFileSync(path.join(__dirname, 'channel-webhook-e2e.json'), JSON.stringify(out, null, 2))
  console.log(out.pass ? 'W3CEXT PROBE: PASS ' + out.pass_count + '/' + out.total : 'W3CEXT PROBE: ' + out.pass_count + '/' + out.total + ' (see FAILs)')
  for (const x of out.tests) console.log((x.pass ? '  PASS ' : '  FAIL ') + x.name + ' — ' + x.detail)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })

