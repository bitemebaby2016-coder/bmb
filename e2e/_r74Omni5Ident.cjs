// R74-OMNI session 2 — OMNI-5 ident: ระบุ Meta Test User ให้ชัดก่อนส่งข้อความจริง
// (1) GET /{app-id}/accounts/test-users ด้วย app access token (META_APP_ID|META_APP_SECRET)
// (2) Messenger profile ของแต่ละ PSID จาก thread ของเพจ (page token — read-only)
// (3) จับคู่ test user ↔ thread · ไม่ชัด = ไม่ส่งอะไรทั้งสิ้น (กติกาความปลอดภัย)
'use strict'
const fs = require('fs')
const path = require('path')
const { S } = require('./wave2Lib.cjs')

const out = []
const log = (s) => { out.push(s); console.log(s) }
const maskId = (v) => String(v || '').slice(0, 6) + '…' + String(v || '').slice(-4)

;(async () => {
  const APP = S.META_APP_ID
  const PAGE = S.META_PAGE_ID
  const PAGE_TOK = S.META_PAGE_ACCESS_TOKEN
  const APP_TOK = APP + '|' + S.META_APP_SECRET
  log('app_id=' + APP + ' page_id=' + PAGE)

  // (1) test users ของแอป (read-only)
  const r1 = await fetch(`https://graph.facebook.com/v21.0/${APP}/accounts/test-users?fields=id,name,access_token&limit=50`, {
    headers: { Authorization: 'Bearer ' + APP_TOK },
    signal: AbortSignal.timeout(15000),
  })
  const j1 = await r1.json().catch(() => null)
  log('TEST_USERS status=' + r1.status)
  for (const u of (j1 && j1.data) || []) {
    log('  tu id=' + maskId(u.id) + ' name=' + u.name + ' has_token=' + !!u.access_token)
  }
  if (j1 && j1.error) log('  tu_error=' + JSON.stringify(j1.error))

  // (2) thread ของเพจ + profile ของ PSID (page token)
  const r2 = await fetch(`https://graph.facebook.com/v21.0/${PAGE}/conversations?platform=messenger&limit=25&fields=participants,snippet,updated_time`, {
    headers: { Authorization: 'Bearer ' + PAGE_TOK },
    signal: AbortSignal.timeout(15000),
  })
  const j2 = await r2.json().catch(() => null)
  const threads = []
  for (const c of (j2 && j2.data) || []) {
    const other = ((c.participants && c.participants.data) || []).find((p) => String(p.id) !== String(PAGE))
    if (other) threads.push({ psid: other.id, listed_name: other.name, updated: c.updated_time, snippet: String(c.snippet || '').slice(0, 50) })
  }
  for (const t of threads) {
    const r3 = await fetch(`https://graph.facebook.com/v21.0/${t.psid}?fields=first_name,last_name,profile_pic&access_token=${encodeURIComponent(PAGE_TOK)}`, {
      signal: AbortSignal.timeout(15000),
    })
    const j3 = await r3.json().catch(() => null)
    t.profile = j3 && j3.first_name ? { first: j3.first_name, last: j3.last_name } : { err: JSON.stringify(j3 && j3.error ? j3.error : j3).slice(0, 120) }
    log('THREAD psid=' + maskId(t.psid) + ' listed=' + t.listed_name + ' profile=' + JSON.stringify(t.profile) + ' updated=' + t.updated + ' snippet=' + t.snippet)
  }

  fs.writeFileSync(path.join(__dirname, '_r74_omni5_ident.json'), JSON.stringify({ date: new Date().toISOString(), lines: out }, null, 2))
  log('IDENT_DONE')
})().catch((e) => {
  log('FATAL ' + String((e && e.stack) || e).slice(0, 400))
  try { fs.writeFileSync(path.join(__dirname, '_r74_omni5_ident.json'), JSON.stringify({ date: new Date().toISOString(), lines: out, fatal: String(e) }, null, 2)) } catch {}
  process.exit(1)
})
