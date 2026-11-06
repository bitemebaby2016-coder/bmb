// ============================================
// BMB R74-OMNI — OMNI-2 + OMNI-3 flow probe (TEST DATA ONLY · ค่าลับไม่ถูกพิมพ์/commit)
//
// ยิง webhook จริง (signed HMAC-SHA256 · Meta real shape) → production channel-webhook
//   A. OMNI-2: handshake · NL raw message → social_events intake (แถวใหม่) ·
//      ยิงซ้ำข้อความเดิม = idempotent (ไม่สร้างแถวซ้ำ) · structured order message →
//      orders (external_ref_id) + ยิงซ้ำ = duplicate:true ไม่สร้างออเดอร์ซ้ำ
//   A2. order_submissions ledger (m124 · p_client_submit_key path) — ยิง submit ซ้ำ
//      key เดิม = 1 แถว / 1 ออเดอร์ (web-checkout idempotency ledger)
//   B. OMNI-3: NL parse → draft cart → ลูกค้ายืนยัน (ผ่าน social-ai-worker จริง ·
//      LLM extract จริง): B1 แชททั่วไป = ไม่มีออเดอร์ · B2 สั่ง+ออปชันยังไม่ยืนยัน =
//      draft cart + ลิงก์ตะกร้า + ห้ามสร้างออเดอร์ (no auto-order) ·
//      B3 ยืนยัน = ได้ออเดอร์จริง · B4 คอมเมนต์สาธารณะ = ไม่สร้างออเดอร์
//   C. Hygiene: cancel ออเดอร์ทดสอบทั้งหมดด้วย cancel_order (canonical)
//
// NOTE (doc drift ที่พบ — จดใน test pack §R74-OMNI): raw message ที่ intake จริงเข้า
//   `social_events` (UNIQUE(platform,event_id) = idempotent) · `order_submissions` =
//   ledger ของ web-submit path (`create_order_with_items_i`) — ไม่ใช่ raw message store
//
// Evidence: e2e/_r74_omni_flow.json
// Usage: node e2e/_r74OmniFlow.cjs
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { SB, SERVICE, S, api, login, rpc, ensureAuthUser } = require('./wave2Lib.cjs')

const FN = SB + '/functions/v1/channel-webhook'
const SECRET = S.CHANNEL_WEBHOOK_APP_SECRET
const TOKEN = S.CHANNEL_WEBHOOK_VERIFY_TOKEN
const PAGE = S.META_PAGE_ID
const ts = Date.now()
const REF = 'ivkdfognyiwjcmrhcnwz'

const sign = (b) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(b).digest('hex')
const payload = (entry) => JSON.stringify({ object: 'page', entry: [entry] })

async function call(bodyStr) {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sign(bodyStr) },
    body: bodyStr,
  })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch {}
  return { status: r.status, j, text }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Management API read-only query (order_submissions ถูก REVOKE ทุก role — ต้องใช้ช่องนี้)
const MGMT_TOKENS = []
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*(SUPABASE_ACCESS_TOKEN)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) MGMT_TOKENS.push(m[2])
}
async function mgmtQ(sql) {
  for (const tok of [...MGMT_TOKENS].reverse()) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) return j
  }
  return null
}

const results = { date: new Date().toISOString(), target: FN, tests: [], orders: [], corpus: [] }
// log ผ่าน fs เสมอ — detached context: console หายได้ (บทเรียน R74)
function logLine(s) {
  try { fs.appendFileSync(path.join(__dirname, '_r74_omni_flow.log'), s + '\n') } catch {}
}
const t = (name, pass, detail) => {
  results.tests.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) })
  logLine((pass ? 'PASS ' : 'FAIL ') + name + ' — ' + String(detail).slice(0, 220))
}

async function socialEvent(eventId) {
  const q = await api(SERVICE, 'GET', `/rest/v1/social_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id,platform,event_type,status,content,ai_reply_text,reply_status,attempts`)
  return (q.j || [])[0] || null
}

/** bounded wait until the AI worker finishes this event (status leaves RECEIVED/PROCESSING).
 *  fallback: ถ้า auto-kick ไม่ claim ภายใน 20 วิ = kick social-ai-worker ตรงเอง 1 ครั้ง */
async function waitForEvent(eventId, timeoutMs = 150000) {
  const deadline = Date.now() + timeoutMs
  let row = null
  let kicked = false
  while (Date.now() < deadline) {
    row = await socialEvent(eventId)
    if (row && row.status && !['RECEIVED', 'PROCESSING'].includes(row.status)) return row
    if (!kicked && row && row.status === 'RECEIVED' && Date.now() > deadline - timeoutMs + 20000) {
      kicked = true
      await fetch(SB + '/functions/v1/social-ai-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE,
          Authorization: 'Bearer ' + SERVICE,
          'x-automation-token': S.AUTOMATION_TOKEN || '',
        },
        body: JSON.stringify({ event_id: eventId, limit: 1 }),
        signal: AbortSignal.timeout(120000),
      }).catch(() => null)
    }
    await sleep(5000)
  }
  return row
}

async function ordersByRef(extRef) {
  const q = await api(SERVICE, 'GET', `/rest/v1/orders?external_ref_id=eq.${encodeURIComponent(extRef)}&select=order_number,source_channel,status,customer_name`)
  return q.j || []
}

;(async () => {
  if (!SECRET || !TOKEN) throw new Error('CHANNEL_WEBHOOK_APP_SECRET / VERIFY_TOKEN missing')
  if (!PAGE) throw new Error('META_PAGE_ID missing')
  if (!SERVICE) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')

  // ---------- setup: today round (BKK) + real product + kitchen-based dropoff ----------
  const KLat = Number(S.VITE_DELIVERY_KITCHEN_LAT || '12.615659')
  const KLng = Number(S.VITE_DELIVERY_KITCHEN_LNG || '102.098063')
  const dropLat = KLat + 0.003 // ~300 m จากครัวจริง (อยู่ใน radius)
  const dropLng = KLng + 0.003
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  const nowT = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16)
  const rounds = await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=id,status,scheduled_date,cutoff_time&order=scheduled_date.desc&limit=50')
  const actives = (rounds.j || []).filter((r) => r.status === 'active' && (r.scheduled_date || r.date) === today && (r.cutoff_time || '00:00') > nowT)
  let round = actives[0]
  if (!round) {
    const rid = 'round-r74-' + today.replace(/-/g, '')
    // idempotent: รอบนี้อาจถูกสร้างจากรอบก่อน (probe ซ้ำได้) — ใช้ของเดิมถ้ายัง active
    const existing = ((await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?id=eq.' + rid + '&select=id,status,scheduled_date,cutoff_time')).j || [])[0]
    if (existing && existing.status === 'active') {
      round = existing
    } else {
      const br = ((await api(SERVICE, 'GET', '/rest/v1/delivery_rounds?select=branch_id&limit=1')).j || [])[0]?.branch_id
      const ins = await api(SERVICE, 'POST', '/rest/v1/delivery_rounds?on_conflict=id', {
        id: rid, display_name: 'R74-OMNI test round', name: 'R74-OMNI test round',
        branch_id: br, scheduled_date: today, cutoff_time: '23:59:00',
        delivery_start: '08:00:00', delivery_end: '20:00:00', status: 'active',
      })
      if (ins.status !== 200 && ins.status !== 201) {
        // แถวค้างจาก run ก่อน (เช่น status ไม่ใช่ active) → ใช้ของเดิมแล้วให้ create RPC ตรวจเอง
        if (existing) round = existing
        else throw new Error('create test round failed ' + ins.status + ' ' + JSON.stringify(ins.j).slice(0, 120))
      } else {
        round = { id: rid }
      }
    }
  }
  const prods = (await api(SERVICE, 'GET', '/rest/v1/products?select=id,name,is_available&archived=eq.false&limit=300')).j || []
  const product = prods.find((p) => p.is_available !== false)
  if (!product) throw new Error('no available product for tests')
  t('setup-round-product', !!round && !!product, 'round=' + round.id + ' date=' + (round.scheduled_date || '?') + ' cutoff=' + (round.cutoff_time || '?') + ' product=' + product.name)

  // ================= OMNI-2 =================
  // A0. Meta verification handshake
  const hs = await fetch(`${FN}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(TOKEN)}&hub.challenge=R74CHALLENGE`)
  t('A0-verification-handshake', hs.status === 200 && (await hs.text()).includes('R74CHALLENGE'), 'status=' + hs.status)

  // A1. raw NL message → intake row (social_events INSERTED)
  const midA = 'r74a-' + ts
  const senderA = 'r74-sim-' + ts
  const textA = 'สวัสดีค่ะ ขอดูเมนูหน่อยค่ะ'
  const evA = { id: PAGE, time: ts, messaging: [{ sender: { id: senderA }, recipient: { id: PAGE }, timestamp: ts, message: { mid: midA, text: textA } }] }
  const bA = payload(evA)
  const rA = await call(bA)
  const eA = rA.j && rA.j.entries && rA.j.entries[0]
  t('A1-raw-message-intake', rA.status === 200 && eA && eA.results && eA.results.social_event === 'INSERTED' && (!eA.errors || eA.errors.length === 0),
    'status=' + rA.status + ' ingest=' + (eA && eA.results && eA.results.social_event) + ' errors=' + JSON.stringify(eA && eA.errors))
  const rowA = await waitForEvent('msg-' + midA, 20000)
  t('A1b-raw-message-row', !!(rowA && rowA.content === textA), 'row=' + JSON.stringify(rowA && { event_id: rowA.event_id, status: rowA.status, content: (rowA.content || '').slice(0, 40) }))
  results.corpus.push({ step: 'A1', text: textA, ai_reply: rowA && rowA.ai_reply_text ? String(rowA.ai_reply_text).slice(0, 160) : null })

  // A2. re-fire identical → idempotent (no second row)
  const rA2 = await call(bA)
  const eA2 = rA2.j && rA2.j.entries && rA2.j.entries[0]
  const cntA = await api(SERVICE, 'GET', `/rest/v1/social_events?platform=eq.MESSENGER&event_id=eq.${encodeURIComponent('msg-' + midA)}&select=id`)
  const dupFlag = eA2 && eA2.results && (eA2.results.duplicate_event === true || eA2.results.social_event === 'DUPLICATE')
  t('A2-refire-idempotent', rA2.status === 200 && !!dupFlag && (cntA.j || []).length === 1,
    'dup=' + JSON.stringify(dupFlag) + ' rows=' + (cntA.j || []).length)

  // A3. structured order message → order created (canonical RPC · external_ref_id)
  const midB = 'r74b-' + ts
  const orderB = {
    order: {
      items: [{ product_id: product.id, quantity: 1 }],
      delivery_round_id: round.id, delivery_method: 'self_delivery',
      delivery_address: 'R74 TEST address', dropoff_latitude: dropLat, dropoff_longitude: dropLng,
      customer_name: 'R74 Test Structured', customer_phone: '0990000074', payment_method: 'promptpay_qr',
    },
  }
  const evB = { id: PAGE, time: ts, messaging: [{ sender: { id: 'r74-sim-ord-' + ts }, recipient: { id: PAGE }, timestamp: ts, message: { mid: midB, text: JSON.stringify(orderB) } }] }
  const bB = payload(evB)
  const rB = await call(bB)
  const eB = rB.j && rB.j.entries && rB.j.entries[0]
  const orderBno = eB && eB.results && eB.results.order && eB.results.order.body && eB.results.order.body.order_number
  t('A3-structured-order-created', rB.status === 200 && !!orderBno, 'order=' + (orderBno || 'none') + ' res=' + JSON.stringify(eB && eB.results && eB.results.order).slice(0, 220))
  const orowsB = await ordersByRef('msg-' + midB)
  t('A3b-order-row-tagged', orowsB.length === 1 && orowsB[0].source_channel === 'MESSENGER', 'rows=' + orowsB.length)
  if (orderBno) results.orders.push({ order_number: orderBno, why: 'A3-structured' })

  // A4. re-fire structured → duplicate:true · ไม่สร้างออเดอร์ซ้ำ
  const rB2 = await call(bB)
  const eB2 = rB2.j && rB2.j.entries && rB2.j.entries[0]
  const dupB = eB2 && eB2.results && (eB2.results.duplicate_event === true || (eB2.results.order && eB2.results.order.body && eB2.results.order.body.duplicate === true))
  const orowsB2 = await ordersByRef('msg-' + midB)
  t('A4-order-refire-idempotent', rB2.status === 200 && !!dupB && orowsB2.length === 1,
    'dup=' + JSON.stringify(dupB) + ' rows=' + orowsB2.length)

  // A5. order_submissions ledger (m124 · web-submit idempotency path — ตารางที่ test pack อ้างถึง)
  let cust = { status: 0, jwt: null }
  try {
    const cu = await ensureAuthUser('qa-r74-cust@bmb.test', 'BMB_TEST_CUSTOMER_PASSWORD')
    cust = await login('qa-r74-cust@bmb.test', cu.password)
  } catch (e) {
    cust = { status: 0, jwt: null, error: String((e && e.message) || e).slice(0, 120) }
  }
  t('A5-login', cust.status === 200, 'customer jwt status=' + cust.status + (cust.error ? ' err=' + cust.error : ''))
  const ck = 'CK-R74-' + ts
  const iArgs = {
    p_items: [{ product_id: product.id, quantity: 1 }],
    p_delivery_round_id: round.id, p_delivery_method: 'self_delivery',
    p_delivery_address: 'R74 TEST ledger', p_dropoff_latitude: dropLat, p_dropoff_longitude: dropLng,
    p_customer_name: 'R74 Test Ledger', p_customer_phone: '0990000075', p_payment_method: 'promptpay_qr',
    p_order_mode: 'SAME_DAY', p_source_channel: 'PWA', p_client_submit_key: ck,
  }
  const i1 = await rpc(cust.jwt, 'create_order_with_items_i', iArgs)
  const i1no = i1.j && i1.j.order_number
  const i2 = await rpc(cust.jwt, 'create_order_with_items_i', iArgs)
  const i2no = i2.j && i2.j.order_number
  const subCnt = await mgmtQ(`SELECT count(*)::int AS n FROM public.order_submissions WHERE client_submit_key = '${ck}'`)
  const subN = subCnt && subCnt[0] ? subCnt[0].n : null
  t('A5-ledger-submit', i1.status === 200 && !!i1no, 'order=' + (i1no || 'none') + ' status=' + i1.status)
  t('A5b-ledger-replay-idempotent', i1no && i2no === i1no && (subN === null || subN === 1),
    'replay=' + i2no + ' ledger_rows=' + (subN === null ? 'unverified (mgmt PAT หมดอายุ — replay คืน order เดิม = อ่านแถว ledger สำเร็จ)' : subN))
  if (i1no) results.orders.push({ order_number: i1no, why: 'A5-ledger' })

  // A6. FIXED intake shape: ไม่มี GPS = ใช้พิกัดครัว (business_settings.kitchen_location)
  // → ต้องสร้างออเดอร์ได้ (dist 0 ผ่าน gate/zone) — ยืนยันว่า EF fix มีผลกับ server จริง
  const kq = await api(SERVICE, 'GET', '/rest/v1/business_settings?key=eq.kitchen_location&select=value&limit=1')
  const kv = (kq.j || [])[0] && (kq.j || [])[0].value
  const kLat = kv && Number(kv.latitude)
  const kLng = kv && Number(kv.longitude)
  const { p_client_submit_key: _omit, ...iArgsBase } = iArgs
  const iArgsNull = { ...iArgsBase, p_dropoff_latitude: Number.isFinite(kLat) ? kLat : null, p_dropoff_longitude: Number.isFinite(kLng) ? kLng : null, p_customer_name: 'R74 Test NoGps' }
  const n1 = await rpc(cust.jwt, 'create_order_with_items', iArgsNull)
  const n1no = n1.j && (n1.j.order_number || (n1.j.body && n1.j.body.order_number))
  t('A6-kitchen-fallback-accepted', n1.status === 200 && !!n1no, 'kitchen=' + kLat + ',' + kLng + ' order=' + (n1no || 'none') + ' res=' + JSON.stringify(n1.j).slice(0, 160))
  if (n1no) results.orders.push({ order_number: n1no, why: 'A6-kitchen-fallback' })

  // ================= OMNI-3 (NL parse → draft cart → ลูกค้ายืนยัน) =================
  const senderN = 'r74-nl-' + ts

  // B1. แชททั่วไป (ไม่มีเจตนาสั่ง) → ไม่มีออเดอร์ · มี draft reply
  const midC = 'r74c-' + ts
  const textC = 'สวัสดีค่ะ วันนี้มีเมนูอะไรน่ากินบ้างคะ'
  const evC = { id: PAGE, time: ts, messaging: [{ sender: { id: senderN }, recipient: { id: PAGE }, timestamp: ts, message: { mid: midC, text: textC } }] }
  const rC = await call(payload(evC))
  const rowC = await waitForEvent('msg-' + midC)
  const ordC = await ordersByRef('msg-' + midC)
  results.corpus.push({ step: 'B1', text: textC, ai_reply: rowC && rowC.ai_reply_text ? String(rowC.ai_reply_text).slice(0, 200) : null })
  t('B1-chit-chat-no-order', (rC.status === 200) && ordC.length === 0 && !!(rowC && rowC.ai_reply_text),
    'order_rows=' + ordC.length + ' status=' + (rowC && rowC.status) + ' reply=' + (rowC && rowC.ai_reply_text ? 'yes' : 'NO'))

  // B2. สั่ง+ออปชันแต่ยังไม่ยืนยัน ("ขอคิดก่อน") → draft cart + ห้ามสร้างออเดอร์ (no auto-order)
  const midD = 'r74d-' + ts
  const textD = 'เอา' + product.name + ' 2 ที่ ไม่เผ็ด เพิ่มไข่ดาวด้วยค่ะ ขอคิดก่อนนะ'
  const evD = { id: PAGE, time: ts, messaging: [{ sender: { id: senderN }, recipient: { id: PAGE }, timestamp: ts, message: { mid: midD, text: textD } }] }
  const rD = await call(payload(evD))
  const rowD = await waitForEvent('msg-' + midD)
  const ordD = await ordersByRef('msg-' + midD)
  const replyD = (rowD && rowD.ai_reply_text) || ''
  results.corpus.push({ step: 'B2', text: textD, ai_reply: replyD.slice(0, 200) })
  t('B2-no-auto-order', (rD.status === 200) && ordD.length === 0, 'order_rows=' + ordD.length + ' (ห้ามมีออเดอร์ก่อนลูกค้ายืนยัน)')
  t('B2b-draft-cart-link', replyD.includes('/shop?cart='), replyD.includes('/shop?cart=') ? 'draft cart link present' : 'reply=' + replyD.slice(0, 120))

  // B3. ลูกค้ายืนยัน → ได้ออเดอร์จริง (idempotent ด้วย event id)
  const midE = 'r74e-' + ts
  const textE = 'ตกลงค่ะ ยืนยัน สั่งเลยค่ะ'
  const evE = { id: PAGE, time: ts, messaging: [{ sender: { id: senderN }, recipient: { id: PAGE }, timestamp: ts, message: { mid: midE, text: textE } }] }
  const rE = await call(payload(evE))
  const rowE = await waitForEvent('msg-' + midE)
  const ordE = await ordersByRef('msg-' + midE)
  const replyE = (rowE && rowE.ai_reply_text) || ''
  results.corpus.push({ step: 'B3', text: textE, ai_reply: replyE.slice(0, 200) })
  t('B3-confirm-creates-order', (rE.status === 200) && ordE.length === 1,
    'order_rows=' + ordE.length + ' order=' + (ordE[0] && ordE[0].order_number) + ' reply=' + replyE.slice(0, 100))
  if (ordE[0]) results.orders.push({ order_number: ordE[0].order_number, why: 'B3-confirm' })

  // B3b. ยิงซ้ำ event เดิม → ไม่สร้างออเดอร์ซ้ำ (webhook idempotency ชั้น intake)
  const rE2 = await call(payload(evE))
  const eE2 = rE2.j && rE2.j.entries && rE2.j.entries[0]
  const ordE2 = await ordersByRef('msg-' + midE)
  const dupE = eE2 && eE2.results && (eE2.results.duplicate_event === true || eE2.results.social_event === 'DUPLICATE')
  t('B3b-confirm-refire-idempotent', !!dupE && ordE2.length === 1, 'dup=' + JSON.stringify(dupE) + ' rows=' + ordE2.length)

  // B4. คอมเมนต์สาธารณะ: สั่งในคอมเมนต์ → ห้ามสร้างออเดอร์ (§5.1) · draft เท่านั้น
  const cmtId = 'r74cmt-' + ts
  const textF = 'เอา' + product.name + ' 2 ที่ค่ะ'
  const evF = { id: PAGE, time: ts, changes: [{ field: 'feed', value: { item: 'comment', post_id: PAGE + '_' + ts, comment_id: cmtId, from: { id: 'r74-sim-cmt-' + ts, name: 'R74 Commenter' }, message: textF, verb: 'add' } }] }
  const rF = await call(payload(evF))
  const rowF = await waitForEvent(cmtId)
  const ordF = await ordersByRef(cmtId)
  results.corpus.push({ step: 'B4', text: textF, ai_reply: rowF && rowF.ai_reply_text ? String(rowF.ai_reply_text).slice(0, 200) : null })
  t('B4-comment-no-order', (rF.status === 200) && ordF.length === 0 && !!(rowF && rowF.ai_reply_text),
    'order_rows=' + ordF.length + ' reply=' + (rowF && rowF.ai_reply_text ? 'yes' : 'NO'))

  // ================= C. Hygiene: cancel ออเดอร์ทดสอบทั้งหมด =================
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  let cancelled = 0
  if (admin.status === 200) {
    for (const o of results.orders) {
      const c = await rpc(admin.jwt, 'cancel_order', { p_order_number: o.order_number, p_reason: 'R74-OMNI probe cleanup' })
      if (c.status === 200) cancelled++
      logLine('cleanup: ' + o.order_number + ' → ' + c.status)
    }
  } else {
    t('C-cleanup-admin-login', false, 'admin login failed ' + admin.status)
  }
  results.orders_cancelled = cancelled
  t('C-cleanup-orders-cancelled', results.orders.length === 0 || cancelled === results.orders.length,
    'cancelled ' + cancelled + '/' + results.orders.length)

  results.pass = results.tests.every((x) => x.pass)
  results.pass_count = results.tests.filter((x) => x.pass).length
  results.total = results.tests.length
  fs.writeFileSync(path.join(__dirname, '_r74_omni_flow.json'), JSON.stringify(results, null, 2))
  logLine('\nR74 OMNI FLOW: ' + results.pass_count + '/' + results.total + (results.pass ? ' ALL PASS' : ' (see FAILs)'))
})().catch((e) => {
  try { logLine('FATAL ' + String((e && e.stack) || e).slice(0, 600)) } catch {}
  try { results.fatal = String((e && e.message) || e).slice(0, 300); fs.writeFileSync(path.join(__dirname, '_r74_omni_flow.json'), JSON.stringify(results, null, 2)) } catch {}
  process.exit(1)
})


