// ============================================
// R75 — AI link format audit (evidence probe · LOCAL ONLY — contains customer text)
// Owner live test 2026-11-07: "ลิ้งที่เอไอสร้างใช้ไม่ได้เลยสักลิ้ง ต่อออกภายนอกก็ไม่ได้"
// Reads recent social_events.ai_reply_text + content_approvals drafts and classifies
// every link token: markdown / bare domain / http / https.
// Usage: node e2e/_r75LinkAudit.cjs   (from repo root or anywhere — chdir below)
// ============================================
'use strict'
process.chdir(require('path').join(__dirname, '..'))
const fs = require('fs')
const path = require('path')
const { SB, SERVICE, api } = require('./wave2Lib.cjs')

const out = []
function log(s) { out.push(s); console.log(s) }

/** Pure — classify every link-ish token in a text (exported for tests via regex reuse). */
function auditLinks(text) {
  const found = []
  const re = /\[[^\]]*\]\([^)]*\)|https?:\/\/[^\s]+|(?:www\.)?biteme-baby\.com\/?[^\s]*/gi
  let m
  while ((m = re.exec(text || ''))) {
    const tok = m[0]
    let kind
    if (/^\[/.test(tok)) kind = 'MARKDOWN (FB ไม่ render — แตะไม่ได้)'
    else if (/^https:\/\//i.test(tok)) kind = 'https (ใช้ได้)'
    else if (/^http:\/\//i.test(tok)) kind = 'http (ควรเป็น https)'
    else kind = 'BARE-DOMAIN (ไม่มี scheme — Facebook ไม่ทำเป็นลิงก์)'
    found.push(kind + ' :: ' + tok)
  }
  return found.length ? found.join('\n') : '(no link tokens)'
}

async function main() {
  log('=== R75 LINK AUDIT ' + new Date().toISOString() + ' ===')

  const ev = await api(SERVICE, 'GET',
    "/rest/v1/social_events?select=id,platform,event_type,reply_status,ai_reply_text,received_at&ai_reply_text=not.is.null&order=received_at.desc&limit=10")
  const evRows = Array.isArray(ev.j) ? ev.j : []
  log('social_events http=' + ev.status + ' rows=' + evRows.length)
  if (!evRows.length) log('BODY: ' + JSON.stringify(ev.j).slice(0, 500))
  for (const r of evRows) {
    log('--- EV ' + r.id + ' ' + r.platform + '/' + r.event_type + ' ' + r.received_at + ' reply_status=' + r.reply_status)
    log('TEXT>>>\n' + (r.ai_reply_text || '') + '\n<<<TEXT')
    log('LINKS:\n' + auditLinks(r.ai_reply_text))
  }

  const ca = await api(SERVICE, 'GET',
    "/rest/v1/content_approvals?select=id,title,body,status,content_type,created_at&order=created_at.desc&limit=8")
  const caRows = Array.isArray(ca.j) ? ca.j : []
  log('content_approvals http=' + ca.status + ' rows=' + caRows.length)
  if (!caRows.length) log('BODY: ' + JSON.stringify(ca.j).slice(0, 500))
  for (const r of caRows) {
    log('--- CA ' + r.id + ' ' + r.content_type + ' ' + r.status + ' ' + r.created_at)
    log('TITLE>>>' + (r.title || ''))
    log('BODY>>>\n' + (r.body || '') + '\n<<<BODY')
    log('LINKS:\n' + auditLinks((r.title || '') + '\n' + (r.body || '')))
  }

  fs.writeFileSync(path.join('e2e', '_r75_link_audit.log'), out.join('\n'), 'utf8')
  log('WROTE e2e/_r75_link_audit.log')
}

main().catch((e) => { log('ERROR ' + String(e)); process.exitCode = 1 })