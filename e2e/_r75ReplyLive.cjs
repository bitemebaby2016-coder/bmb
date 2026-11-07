// ============================================
// R75 — live verification: ลิงก์ที่ AI สร้างในคอมเมนต์/ข้อความจริงต้องเป็น https:// URL ที่แตะได้
// Owner 2026-11-07: "ลิ้งที่เอไอสร้างใช้ไม่ได้เลยสักลิ้ง ต่อออกภายนอกก็ไม่ได้"
//
// flow (เดียวกับ _r74OmniFlow · ไม่แตะข้อมูลจริง · cleanup ท้ายสคริปต์):
//   signed webhook (simulated comment + message) → social-ai-worker (deployed)
//   → social_events.ai_reply_text → ตรวจทุก token ลิงก์ = https:// เท่านั้น
//   → ลบแถวทดสอบทั้งหมด (orders ต้อง = 0 เพราะเป็นข้อความไม่สั่งของ)
// Usage: node e2e/_r75ReplyLive.cjs   (log: e2e/_r75_reply_live.log · json: e2e/_r75_reply_live.json)
// ============================================
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { SB, SERVICE, S, api } = require('./wave2Lib.cjs')

const FN = SB + '/functions/v1/channel-webhook'
const SECRET = S.CHANNEL_WEBHOOK_APP_SECRET
const PAGE = S.META_PAGE_ID
const ts = Date.now()
const LOG = path.join(__dirname, '_r75_reply_live.log')
const log = (s) => { try { fs.appendFileSync(LOG, s + '\n') } catch {} ; console.log(s) }
fs.writeFileSync(LOG, 'R75_REPLY_LIVE ' + new Date().toISOString() + '\n')

const sign = (b) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(b).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** classify ทุก token ลิงก์ (เดียวกับ _r75LinkAudit) */
function auditLinks(text) {
  const found = []
  const re = /\[[^\]]*\]\([^)]*\)|https?:\/\/[^\s]+|(?:www\.)?biteme-baby\.com\/?[^\s]*/gi
  let m
  while ((m = re.exec(text || ''))) {
    const tok = m[0]
    let kind
    if (/^\[/.test(tok)) kind = 'MARKDOWN'
    else if (/^https:\/\//i.test(tok)) kind = 'https'
    else if (/^http:\/\//i.test(tok)) kind = 'http'
    else kind = 'BARE'
    found.push({ kind, tok })
  }
  return found
}

async function postSigned(bodyStr) {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sign(bodyStr) },
    body: bodyStr,
  })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch { /* */ }
  return { status: r.status, j, text }
}

async function kickWorker(eventId) {
  const r = await fetch(SB + '/functions/v1/social-ai-worker', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE,
      Authorization: 'Bearer ' + SERVICE,
      'x-automation-token': S.AUTOMATION_TOKEN || '',
    },
    body: JSON.stringify({ event_id: eventId, limit: 1 }),
    signal: AbortSignal.timeout(120000),
  })
  const text = await r.text()
  log('kick ' + eventId + ' http=' + r.status + ' ' + text.slice(0, 200))
  return r.status
}

async function waitForEvent(eventId, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const q = await api(SERVICE, 'GET', `/rest/v1/social_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id,platform,event_type,status,ai_reply_text,reply_status`)
    const row = (q.j || [])[0] || null
    if (row && row.status && !['RECEIVED', 'PROCESSING'].includes(row.status)) return row
    await sleep(4000)
  }
  return null
}

;(async () => {
  if (!SECRET || !PAGE || !SERVICE) throw new Error('secrets missing (CHANNEL_WEBHOOK_APP_SECRET / META_PAGE_ID / SERVICE)')
  const results = { date: new Date().toISOString(), cases: [], tests: [] }
  const t = (name, pass, detail) => {
    results.tests.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) })
    log((pass ? 'PASS ' : 'FAIL ') + name + ' — ' + String(detail).slice(0, 250))
  }

  // ---- case 1: FACEBOOK comment (คำถามเมนู — ไม่สั่งของ = ไม่สร้างออเดอร์) ----
  const cmtId = 'r75-sim-cmt-' + ts
  const evC = JSON.stringify({
    object: 'page',
    entry: [{
      id: PAGE,
      time: ts,
      changes: [{
        field: 'feed',
        value: {
          item: 'comment',
          post_id: PAGE + '_' + ts,
          comment_id: cmtId,
          from: { id: 'r75-sim-cmt-user-' + ts, name: 'R75 Commenter' },
          message: 'เมนูสุกี้แห้งกุ้ง น่ากินมากครับ สั่งยังไงครับ',
          verb: 'add',
        },
      }],
    }],
  })
  const rC = await postSigned(evC)
  log('webhook comment http=' + rC.status)

  // ---- case 2: MESSENGER message (ทักทาย/ถามทาง — ไม่สั่งของ) ----
  const msgId = 'r75-sim-msg-' + ts
  const evM = JSON.stringify({
    object: 'page',
    entry: [{
      id: PAGE,
      time: ts,
      messaging: [{
        sender: { id: 'r75-sim-msg-user-' + ts },
        recipient: { id: PAGE },
        timestamp: ts,
        message: { mid: msgId, text: 'ร้านเปิดกี่โมงครับ มีช่องทางสั่งอะไรบ้าง' },
      }],
    }],
  })
  const rM = await postSigned(evM)
  log('webhook message http=' + rM.status)

  for (const [label, eventId] of [['comment', cmtId], ['message', 'msg-' + msgId]]) {
    await sleep(8000) // เผื่อ auto-kick
    const row0 = await api(SERVICE, 'GET', `/rest/v1/social_events?event_id=eq.${encodeURIComponent(eventId)}&select=status`)
    if (((row0.j || [])[0] || {}).status === 'RECEIVED') await kickWorker(eventId)
    const row = await waitForEvent(eventId)
    const reply = row && row.ai_reply_text ? String(row.ai_reply_text) : ''
    const links = auditLinks(reply)
    results.cases.push({ label, eventId, status: row && row.status, reply_status: row && row.reply_status, reply, links })
    t('R75-' + label + '-reply-generated', reply.length > 0, 'status=' + (row && row.status) + ' len=' + reply.length)
    const broken = links.filter((l) => l.kind !== 'https')
    t('R75-' + label + '-no-broken-links', reply.length > 0 && broken.length === 0,
      (broken.length ? 'broken=' + broken.map((l) => l.kind + ':' + l.tok).join(',').slice(0, 200) : 'none'))
    t('R75-' + label + '-has-clickable-https', links.some((l) => l.kind === 'https' && /biteme-baby\.com/.test(l.tok)),
      'https=' + (links.filter((l) => l.kind === 'https').map((l) => l.tok).join(' ').slice(0, 200) || 'NONE'))
  }

  // ---- cleanup: ลบแถวทดสอบ (ข้อความไม่สั่งของ = orders ต้อง 0) · message ingest = 'msg-' + mid ----
  for (const id of [cmtId, msgId, 'msg-' + msgId]) {
    await api(SERVICE, 'DELETE', `/rest/v1/social_events?event_id=eq.${encodeURIComponent(id)}`)
  }
  const ordC = await api(SERVICE, 'GET', `/rest/v1/orders?external_ref_id=in.(${cmtId},${msgId})&select=order_number`)
  t('R75-cleanup-no-orders', ((ordC.j || []).length === 0), 'order_rows=' + ((ordC.j || []).length))
  const left = await api(SERVICE, 'GET', `/rest/v1/social_events?event_id=in.(${cmtId},${msgId},msg-${msgId})&select=event_id`)
  t('R75-cleanup-rows-deleted', ((left.j || []).length === 0), 'left=' + ((left.j || []).length))

  results.pass_count = results.tests.filter((x) => x.pass).length
  results.total = results.tests.length
  fs.writeFileSync(path.join(__dirname, '_r75_reply_live.json'), JSON.stringify(results, null, 2))
  log('DONE pass=' + results.pass_count + '/' + results.total)
})().catch((e) => { log('ERROR ' + String(e)); process.exitCode = 1 })