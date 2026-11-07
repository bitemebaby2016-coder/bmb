// ============================================
// BMB R76 — live verification: ① ลิงก์ AI = https:// ที่แตะได้ (ต่อจาก R75) ② แจ้งเตือนลูกค้า
// Owner 2026-11-07: "อาการเดิมเลย" + "เวลาเอไอตอบโพสหรือข้อความ ต้องมีแจ้งเตือนเฟซบุ้คให้ลูกค้าด้วย"
//
// ความปลอดภัย: สร้างโพสต์ "ไม่เผยแพร่" (published=false — ลูกค้าไม่เห็น) + คอมเมนต์ทดสอบ
//   จากเพจเองบนโพสต์นั้น = object จริงบน Graph (ให้คำตอบสาธารณะ+private reply pipeline ทำงานจริง)
//   โดยไม่แตะลูกค้าจริงสักรายเดียว · ท้ายสคริปต์ลบโพสต์/คอมเมนต์/แถวทดสอบทั้งหมด
//
// Usage: node e2e/_r76ReplyLive.cjs   (log: e2e/_r76_reply_live.log · json: e2e/_r76_reply_live.json)
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
const TOK = S.META_PAGE_ACCESS_TOKEN
const GRAPH = 'https://graph.facebook.com/v21.0'
const ts = Date.now()
const LOG = path.join(__dirname, '_r76_reply_live.log')
const log = (s) => { try { fs.appendFileSync(LOG, s + '\n') } catch {} ; console.log(s) }
fs.writeFileSync(LOG, 'R76_REPLY_LIVE ' + new Date().toISOString() + '\n')

const sign = (b) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(b).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const gfetch = async (url, method = 'GET', body = null) => {
  const r = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  })
  const j = await r.json().catch(() => null)
  return { http: r.status, j }
}

/** classify ทุก token ลิงก์ (เดียวกับ _r75ReplyLive) */
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
    const q = await api(SERVICE, 'GET', `/rest/v1/social_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id,platform,event_type,status,ai_reply_text,reply_status,reply_provider_id,ai_guardrail_flags`)
    const row = (q.j || [])[0] || null
    if (row && row.status && !['RECEIVED', 'PROCESSING'].includes(row.status)) return row
    await sleep(4000)
  }
  return null
}
;(async () => {
  if (!SECRET || !PAGE || !SERVICE || !TOK) throw new Error('secrets missing (CHANNEL_WEBHOOK_APP_SECRET / META_PAGE_ID / SERVICE / META_PAGE_ACCESS_TOKEN)')
  const results = { date: new Date().toISOString(), tests: [], cases: [], objects: {} }
  const t = (name, pass, detail) => { results.tests.push({ name, pass, detail: String(detail).slice(0, 300) }); log((pass ? 'PASS ' : 'FAIL ') + name + ' — ' + String(detail).slice(0, 250)) }

  // ---- ① โพสต์ไม่เผยแพร่ + คอมเมนต์จริง (object จริงบน Graph · ลูกค้าไม่เห็น) ----
  const post = await gfetch(`${GRAPH}/${PAGE}/feed`, 'POST', { message: 'R76 probe (unpublished — safe to delete)', published: false })
  const postId = post.j && post.j.id
  if (!postId) { log('POST_CREATE_FAIL ' + JSON.stringify(post.j)); throw new Error('cannot create unpublished post') }
  const cmt = await gfetch(`${GRAPH}/${postId}/comments`, 'POST', { message: 'R76 probe comment — ทดสอบระบบตอบกลับ+แจ้งเตือน' })
  const realCmtId = cmt.j && cmt.j.id
  if (!realCmtId) { log('COMMENT_CREATE_FAIL ' + JSON.stringify(cmt.j)); await gfetch(`${GRAPH}/${postId}`, 'DELETE'); throw new Error('cannot create test comment') }
  results.objects = { postId, realCmtId }
  log('graph objects post=' + postId + ' comment=' + realCmtId)

  // ---- ② case 1: FACEBOOK comment จริง (คำถามเมนู — ไม่สั่งของ = ไม่สร้างออเดอร์) ----
  const evC = JSON.stringify({
    object: 'page',
    entry: [{
      id: PAGE,
      time: ts,
      changes: [{
        field: 'feed',
        value: {
          item: 'comment',
          post_id: postId,
          comment_id: realCmtId,
          from: { id: 'r76-sim-cmt-user-' + ts, name: 'R76 Probe' },
          message: 'เมนูสุกี้แห้งกุ้ง น่ากินมากครับ สั่งยังไงครับ',
          verb: 'add',
        },
      }],
    }],
  })
  const rC = await postSigned(evC)
  log('webhook comment http=' + rC.status)

  // ---- case 2: MESSENGER message synthetic (regression ลิงก์ https — send ล้มได้ตามคาด) ----
  const msgId = 'r76-sim-msg-' + ts
  const evM = JSON.stringify({
    object: 'page',
    entry: [{
      id: PAGE,
      time: ts,
      messaging: [{
        sender: { id: 'r76-sim-msg-user-' + ts },
        recipient: { id: PAGE },
        timestamp: ts,
        message: { mid: msgId, text: 'ร้านเปิดกี่โมงครับ มีช่องทางสั่งอะไรบ้าง' },
      }],
    }],
  })
  const rM = await postSigned(evM)
  log('webhook message http=' + rM.status)
  // ---- ③ ตรวจผล ----
  for (const [label, eventId, isReal] of [['comment', realCmtId, true], ['message', 'msg-' + msgId, false]]) {
    await sleep(8000) // เผื่อ auto-kick
    const row0 = await api(SERVICE, 'GET', `/rest/v1/social_events?event_id=eq.${encodeURIComponent(eventId)}&select=status`)
    if (((row0.j || [])[0] || {}).status === 'RECEIVED') await kickWorker(eventId)
    const row = await waitForEvent(eventId)
    // race guard: status=SUCCEEDED ถูก patch "ก่อน" ขั้นส่ง reply — รอแล้วอ่านซ้ำเพื่อจับ reply_status/dm flags จริง
    await sleep(12000)
    const reread = await api(SERVICE, 'GET', `/rest/v1/social_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id,platform,event_type,status,ai_reply_text,reply_status,reply_provider_id,ai_guardrail_flags`)
    const rowF = ((reread.j || [])[0] || row) || null
    const reply = rowF && rowF.ai_reply_text ? String(rowF.ai_reply_text) : ''
    const links = auditLinks(reply)
    const flags = (rowF && rowF.ai_guardrail_flags) || {}
    results.cases.push({ label, eventId, status: rowF && rowF.status, reply_status: rowF && rowF.reply_status, reply_provider_id: rowF && rowF.reply_provider_id, flags: { dm_reply_id: flags.dm_reply_id ?? '(absent)', dm_error: flags.dm_error ?? '(absent)' }, reply, links })
    t('R76-' + label + '-reply-generated', reply.length > 0, 'status=' + (rowF && rowF.status) + ' len=' + reply.length)
    const broken = links.filter((l) => l.kind !== 'https')
    t('R76-' + label + '-no-broken-links', reply.length > 0 && broken.length === 0,
      (broken.length ? 'broken=' + broken.map((l) => l.kind + ':' + l.tok).join(',').slice(0, 200) : 'none'))
    t('R76-' + label + '-has-clickable-https', links.some((l) => l.kind === 'https' && /biteme-baby\.com/.test(l.tok)),
      'https=' + (links.filter((l) => l.kind === 'https').map((l) => l.tok).join(' ').slice(0, 200) || 'NONE'))
    if (isReal) {
      t('R76-comment-reply-sent-on-fb', rowF && rowF.reply_status === 'sent', 'reply_status=' + (rowF && rowF.reply_status) + ' provider=' + (rowF && rowF.reply_provider_id))
      const hasDmKeys = ('dm_reply_id' in flags) || ('dm_error' in flags)
      t('R76-comment-notify-pipeline-ran', hasDmKeys, 'dm_reply_id=' + (flags.dm_reply_id ?? '(absent)') + ' dm_error=' + (flags.dm_error ?? '(absent)'))
    }
  }

  // ---- ④ cleanup: ลบ object บนเฟซ (reply → comment → post) + แถวทดสอบ ----
  const cRow = results.cases.find((x) => x.label === 'comment') || {}
  const del = {}
  if (cRow.reply_provider_id) del.reply = (await gfetch(`${GRAPH}/${cRow.reply_provider_id}`, 'DELETE')).http
  del.comment = (await gfetch(`${GRAPH}/${realCmtId}`, 'DELETE')).http
  del.post = (await gfetch(`${GRAPH}/${postId}`, 'DELETE')).http
  results.objects.deleted = del
  log('graph cleanup ' + JSON.stringify(del))

  for (const id of [realCmtId, msgId, 'msg-' + msgId]) {
    await api(SERVICE, 'DELETE', `/rest/v1/social_events?event_id=eq.${encodeURIComponent(id)}`)
  }
  const ordC = await api(SERVICE, 'GET', `/rest/v1/orders?external_ref_id=in.(${realCmtId},${msgId})&select=order_number`)
  t('R76-cleanup-no-orders', ((ordC.j || []).length === 0), 'order_rows=' + ((ordC.j || []).length))
  const left = await api(SERVICE, 'GET', `/rest/v1/social_events?event_id=in.(${realCmtId},${msgId},msg-${msgId})&select=event_id`)
  t('R76-cleanup-rows-deleted', ((left.j || []).length === 0), 'left=' + ((left.j || []).length))
  t('R76-cleanup-fb-objects-deleted', [del.reply, del.comment, del.post].every((h) => h === 200 || h === 404 || h == null), JSON.stringify(del))

  results.pass_count = results.tests.filter((x) => x.pass).length
  results.total = results.tests.length
  fs.writeFileSync(path.join(__dirname, '_r76_reply_live.json'), JSON.stringify(results, null, 2))
  log('DONE pass=' + results.pass_count + '/' + results.total)
})().catch((e) => { log('ERROR ' + String(e)); process.exitCode = 1 })