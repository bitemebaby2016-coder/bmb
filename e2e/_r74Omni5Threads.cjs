// R74-OMNI session 2 — OMNI-5 ident 2: อ่านประวัติข้อความล่าสุดของแต่ละ thread (read-only)
// เพื่อแยก "บทสนทนาทดสอบ" ออกจาก "ลูกค้าจริง" — ไม่ส่งอะไรทั้งสิ้น
'use strict'
const fs = require('fs')
const path = require('path')
const { S } = require('./wave2Lib.cjs')

const out = []
const log = (s) => { out.push(s); console.log(s) }
const maskId = (v) => String(v || '').slice(0, 6) + '…' + String(v || '').slice(-4)

;(async () => {
  const PAGE = S.META_PAGE_ID
  const TOK = S.META_PAGE_ACCESS_TOKEN
  const r = await fetch(`https://graph.facebook.com/v21.0/${PAGE}/conversations?platform=messenger&limit=25&fields=id,participants,updated_time`, {
    headers: { Authorization: 'Bearer ' + TOK },
    signal: AbortSignal.timeout(15000),
  })
  const j = await r.json().catch(() => null)
  for (const c of (j && j.data) || []) {
    const other = ((c.participants && c.participants.data) || []).find((p) => String(p.id) !== String(PAGE))
    log('THREAD conv=' + maskId(c.id) + ' user=' + (other && other.name) + ' psid=' + maskId(other && other.id) + ' updated=' + c.updated_time)
    const r2 = await fetch(`https://graph.facebook.com/v21.0/${c.id}/messages?fields=message,from,created_time,type&limit=12`, {
      headers: { Authorization: 'Bearer ' + TOK },
      signal: AbortSignal.timeout(15000),
    })
    const j2 = await r2.json().catch(() => null)
    if (j2 && j2.error) { log('  msg_error=' + JSON.stringify(j2.error).slice(0, 160)); continue }
    for (const m of (j2 && j2.data) || []) {
      const fromUser = other && String(m.from && m.from.id) === String(other.id)
      log('  [' + (m.created_time || '?') + '] ' + (fromUser ? 'USER' : 'PAGE') + ' (' + (m.type || '?') + '): ' + String((m.message || '').slice(0, 120) || '(no text)').replace(/\s+/g, ' '))
    }
  }
  fs.writeFileSync(path.join(__dirname, '_r74_omni5_threads.json'), JSON.stringify({ date: new Date().toISOString(), lines: out }, null, 2))
  log('THREADS_DONE')
})().catch((e) => {
  log('FATAL ' + String((e && e.stack) || e).slice(0, 400))
  try { fs.writeFileSync(path.join(__dirname, '_r74_omni5_threads.json'), JSON.stringify({ date: new Date().toISOString(), lines: out, fatal: String(e) }, null, 2)) } catch {}
  process.exit(1)
})
