// ============================================
// BMB R74-OMNI · OMNI-5 — Meta Test User LIVE CHAT probe (พร้อมรัน · ยังไม่ได้รันจริง)
//
// เงื่อนไขก่อนรัน (กติกาความปลอดภัย — ห้ามแตะลูกค้าจริง):
//   ① Meta Test User ต้องมีตัวตนจริง (Meta App Dashboard → Roles → Test Users)
//      และทักเพจมาก่อน ≥1 ข้อความ เพื่อสร้าง thread/PSID
//   ② ระบุ PSID ของ Test User ให้ชัด — ใส่ผ่าน --psid + --confirm-name (ต้องตรงกับชื่อใน thread)
//   ③ คีย์ที่ใช้ = META_PAGE_ACCESS_TOKEN + CHANNEL_WEBHOOK_APP_SECRET (คีย์ที่ใช้ได้เท่านั้น)
//      META_USER_ACCESS_TOKEN = ยกเลิกแล้ว ห้ามใช้
//
// Usage:
//   node e2e/_r74Omni5Live.cjs --psid <PSID> --confirm-name <ชื่อใน thread>            = DRY-RUN (ตรวจอย่างเดียว)
//   node e2e/_r74Omni5Live.cjs --psid <PSID> --confirm-name <ชื่อใน thread> --fire     = ยิงจริง
//
// โหมด --fire: ① ส่งข้อความจริงจากเพจ (Graph Send API → หลักฐาน message_id) ② ฉีด user-side
//   ผ่าน signed webhook เข้า production channel-webhook (วิธีเดียวกับ OMNI-2/3) = pipeline จริง
//   → worker จะส่ง reply จริงเข้า Messenger ของ Test User อัตโนมัติ ③ ตรวจ no-auto-order
//   ④ confirm → ออเดอร์จริง (คาดเขียวหลัง deploy EF) ⑤ cleanup cancel ทุกออเดอร์ทดสอบ
//
// Evidence: e2e/_r74_omni5_live.json
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { SB, SERVICE, S, api, login, rpc } = require('./wave2Lib.cjs')

const FN = SB + '/functions/v1/channel-webhook'
const SECRET = S.CHANNEL_WEBHOOK_APP_SECRET
const PAGE = S.META_PAGE_ID
const PAGE_TOK = S.META_PAGE_ACCESS_TOKEN

// ชื่อ thread ที่ยืนยันแล้วว่าเป็นลูกค้าจริง (e2e/_r74_omni5_threads.json · 2026-11-06) — ห้ามแตะ
const REAL_CUSTOMER_NAMES = ['ผู้ใช้ Facebook', 'Siam Portal', 'Phichayapron Khuansuwan']

const argv = process.argv.slice(2)
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null }
const FIRE = argv.includes('--fire')
const PSID = arg('--psid')
const CONFIRM = arg('--confirm-name')

const results = { date: new Date().toISOString(), mode: FIRE ? 'FIRE' : 'DRY_RUN', psid: PSID, tests: [], orders: [] }
const logLine = (s) => { try { fs.appendFileSync(path.join(__dirname, '_r74_omni5_live.log'), s + '\n') } catch {} }
const t = (name, pass, detail) => {
  results.tests.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) })
  logLine((pass ? 'PASS ' : 'FAIL ') + name + ' :: ' + String(detail).slice(0, 220))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sign = (b) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(b).digest('hex')

async function webhook(ev) {
  const body = JSON.stringify({ object: 'page', entry: [ev] })
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sign(body) },
    body,
  })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch {}
  return { status: r.status, j, text }
}

async function graphSend(text) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${PAGE}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PAGE_TOK, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: PSID }, message: { text: text.slice(0, 1800) } }),
    signal: AbortSignal.timeout(15000),
  })
  const j = await r.json().catch(() => null)
  return { status: r.status, j }
}

async function waitForEvent(eventId, ms = 25000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const q = await api(SERVICE, 'GET', `/rest/v1/social_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id,status,content,ai_reply_text,sender_id`)
    const row = (q.j || [])[0]
    if (row && (row.status === 'SUCCEEDED' || row.status === 'FAILED')) return row
    await sleep(1500)
  }
  return null
}

async function ordersByRef(ref) {
  const q = await api(SERVICE, 'GET', `/rest/v1/orders?external_ref_id=eq.${encodeURIComponent(ref)}&select=id,order_number,status,source_channel`)
  return q.j || []
}

;(async () => {
  // ---- 0) เงื่อนไข + safety ----
  if (!PSID || !CONFIRM) {
    console.log('USAGE: node e2e/_r74Omni5Live.cjs --psid <PSID> --confirm-name <ชื่อใน thread> [--fire]')
    process.exit(1)
  }
  if (!SECRET || !PAGE_TOK) { console.log('MISSING_KEYS'); process.exit(1) }
  if (REAL_CUSTOMER_NAMES.includes(CONFIRM)) {
    t('safety-block-real-customer', false, 'ชื่อ ' + CONFIRM + ' = ลูกค้าจริงที่ยืนยันแล้ว — ยกเลิกทันที')
    fs.writeFileSync(path.join(__dirname, '_r74_omni5_live.json'), JSON.stringify(results, null, 2))
    process.exit(2)
  }
  t('safety-name-allowed', !REAL_CUSTOMER_NAMES.includes(CONFIRM), 'confirm-name=' + CONFIRM)

  // ตรวจ thread จริงจากเพจ (page token · read-only)
  const rc = await fetch(`https://graph.facebook.com/v21.0/${PAGE}/conversations?platform=messenger&limit=50&fields=participants,updated_time`, {
    headers: { Authorization: 'Bearer ' + PAGE_TOK }, signal: AbortSignal.timeout(15000),
  })
  const jc = await rc.json().catch(() => null)
  const threads = ((jc && jc.data) || []).map((c) => ({
    psid: String((((c.participants && c.participants.data) || []).find((p) => String(p.id) !== String(PAGE)) || {}).id || ''),
    name: String((((c.participants && c.participants.data) || []).find((p) => String(p.id) !== String(PAGE)) || {}).name || ''),
    updated: c.updated_time,
  }))
  const th = threads.find((x) => x.psid === String(PSID))
  t('thread-exists', !!th, th ? 'name=' + th.name + ' updated=' + th.updated : 'PSID ไม่มีใน thread ของเพจ (ต้องให้ Test User ทักมาก่อน)')
  t('thread-name-match', !!th && th.name === CONFIRM, 'thread.name=' + (th && th.name) + ' vs confirm=' + CONFIRM)
  if (!th || th.name !== CONFIRM || REAL_CUSTOMER_NAMES.includes(th.name)) {
    t('safety-final', false, 'ไม่ผ่านเงื่อนไขความปลอดภัย — ไม่ส่งอะไรทั้งสิ้น')
    results.pass = false
    fs.writeFileSync(path.join(__dirname, '_r74_omni5_live.json'), JSON.stringify(results, null, 2))
    process.exit(2)
  }
  if (!FIRE) {
    t('dry-run-only', true, 'ทุกเงื่อนไขผ่าน — เติม --fire เพื่อยิงจริง')
    results.pass = true
    fs.writeFileSync(path.join(__dirname, '_r74_omni5_live.json'), JSON.stringify(results, null, 2))
    console.log('DRY_RUN_OK — พร้อมยิงจริง (ใส่ --fire)')
    return
  }

  const ts = Date.now()

  // ---- 1) ส่งข้อความจริงจากเพจ → Messenger ของ Test User (หลักฐาน message_id) ----
  const hello = await graphSend('สวัสดีค่ะ Bite Me Baby ยินดีต้อนรับค่ะ 🥢 (OMNI-5 live chat test)')
  t('live-send-hello', hello.status === 200 && hello.j && hello.j.message_id, 'status=' + hello.status + ' mid=' + (hello.j && hello.j.message_id))

  // ---- 2) B1 แชททั่วไป = ไม่มีออเดอร์ ----
  const mid1 = 'omni5a-' + ts
  const ev1 = { id: PAGE, time: ts, messaging: [{ sender: { id: PSID }, recipient: { id: PAGE }, timestamp: ts, message: { mid: mid1, text: 'สวัสดีค่ะ วันนี้มีเมนูอะไรน่ากินบ้างคะ' } }] }
  await webhook(ev1)
  const row1 = await waitForEvent('msg-' + mid1)
  const ord1 = await ordersByRef('msg-' + mid1)
  t('B1-chat-no-order', ord1.length === 0 && !!(row1 && row1.ai_reply_text), 'orders=' + ord1.length + ' reply=' + ((row1 && row1.ai_reply_text) ? 'yes' : 'NO'))

  // ---- 3) B2 สั่ง+ออปชัน ยังไม่ยืนยัน = draft เท่านั้น ห้ามมีออเดอร์ (no auto-order) ----
  const mid2 = 'omni5b-' + ts
  const ev2 = { id: PAGE, time: ts, messaging: [{ sender: { id: PSID }, recipient: { id: PAGE }, timestamp: ts, message: { mid: mid2, text: 'เอาเมี่ยงแซลมอน 2 ที่ ไม่เผ็ด เพิ่มไข่ดาวด้วยค่ะ ขอคิดก่อนนะ' } }] }
  await webhook(ev2)
  const row2 = await waitForEvent('msg-' + mid2)
  const ord2 = await ordersByRef('msg-' + mid2)
  t('B2-no-auto-order', ord2.length === 0, 'orders=' + ord2.length + ' (ห้ามมีออเดอร์ก่อนลูกค้ายืนยัน) reply=' + String((row2 && row2.ai_reply_text) || '').slice(0, 80))

  // ---- 4) B3 ยืนยัน = ออเดอร์จริง (คาดเขียวหลัง deploy EF · ก่อนหน้า = ติด prompt เก่า/บั๊กพิกัด) ----
  const mid3 = 'omni5c-' + ts
  const ev3 = { id: PAGE, time: ts, messaging: [{ sender: { id: PSID }, recipient: { id: PAGE }, timestamp: ts, message: { mid: mid3, text: 'ตกลงค่ะ ยืนยัน สั่งเลยค่ะ' } }] }
  await webhook(ev3)
  const row3 = await waitForEvent('msg-' + mid3)
  const ord3 = await ordersByRef('msg-' + mid3)
  t('B3-confirm-creates-order', ord3.length === 1, 'orders=' + ord3.length + ' order=' + (ord3[0] && ord3[0].order_number) + ' reply=' + String((row3 && row3.ai_reply_text) || '').slice(0, 80))
  if (ord3[0]) results.orders.push({ order_number: ord3[0].order_number, why: 'OMNI-5-confirm' })

  // ---- 5) B3b ยิงซ้ำ event เดิม = idempotent ----
  const rEb = await webhook(ev3)
  const eEb = rEb.j && rEb.j.entries && rEb.j.entries[0]
  const dupEb = eEb && eEb.results && (eEb.results.duplicate_event === true || eEb.results.social_event === 'DUPLICATE')
  const ord3b = await ordersByRef('msg-' + mid3)
  t('B3b-refire-idempotent', !!dupEb && ord3b.length === 1, 'dup=' + JSON.stringify(dupEb) + ' orders=' + ord3b.length)

  // ---- 6) cleanup: cancel ออเดอร์ทดสอบทั้งหมด ----
  const admin = await login(S.BMB_TEST_ADMIN_EMAIL, S.BMB_TEST_ADMIN_PASSWORD)
  let cancelled = 0
  if (admin.status === 200) {
    for (const o of results.orders) {
      const c = await rpc(admin.jwt, 'cancel_order', { p_order_number: o.order_number, p_reason: 'OMNI-5 live test cleanup' })
      if (c.status === 200) cancelled++
    }
  }
  t('C-cleanup', results.orders.length === 0 || cancelled === results.orders.length, 'cancelled ' + cancelled + '/' + results.orders.length)

  results.pass = results.tests.every((x) => x.pass)
  results.pass_count = results.tests.filter((x) => x.pass).length
  results.total = results.tests.length
  fs.writeFileSync(path.join(__dirname, '_r74_omni5_live.json'), JSON.stringify(results, null, 2))
  logLine('OMNI5 LIVE: ' + results.pass_count + '/' + results.total)
  console.log('OMNI5_LIVE_DONE ' + results.pass_count + '/' + results.total)
})().catch((e) => {
  logLine('FATAL ' + String((e && e.stack) || e).slice(0, 600))
  try { results.fatal = String((e && e.message) || e).slice(0, 300); fs.writeFileSync(path.join(__dirname, '_r74_omni5_live.json'), JSON.stringify(results, null, 2)) } catch {}
  process.exit(1)
})



