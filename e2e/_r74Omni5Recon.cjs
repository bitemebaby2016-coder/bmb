// R74-OMNI session 2 — probe: (1) scan .env.local หา mgmt auth ใหม่ (mask ค่า) ·
// (2) Graph: page conversations → หา PSID ของ Meta Test User · (3) channel_identities (m179)
// ค่าลับไม่ถูกพิมพ์เต็ม — เฉพาะ head/tail และ ID ที่จำเป็นต่อการทดสอบ
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const { SB, SERVICE, S, api } = require('./wave2Lib.cjs')

const mask = (v) => (v || '').slice(0, 6) + '…' + (String(v || '').length) + '…' + String(v || '').slice(-4)
const out = []
const log = (s) => { out.push(s); console.log(s) }

// 1) scan .env.local — ค่าที่หน้าตาเหมือน PAT (sbp_/sbp_pat/eyJ…) ทุก key
const raw = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
  if (!m) continue
  const v = m[2].trim().replace(/^["']|["']$/g, '')
  if (/^(sbp_|sb_secret_|sb_publishable_|eyJ)/.test(v)) {
    log('SCAN ' + m[1] + ' => ' + mask(v) + ' kind=' + (v.startsWith('sbp_') ? 'PAT_LIKE' : v.startsWith('ey') ? 'JWT_LIKE' : 'PROJECT_KEY'))
  }
}

;(async () => {
  // 2) Graph: page conversations (page token — คีย์ที่ใช้ได้)
  const PAGE = S.META_PAGE_ID
  const TOK = S.META_PAGE_ACCESS_TOKEN
  log('PAGE_ID=' + PAGE + ' TOKEN=' + mask(TOK))
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${PAGE}/conversations?platform=messenger&limit=25&fields=participants,snippet,updated_time`, {
      headers: { Authorization: 'Bearer ' + TOK },
      signal: AbortSignal.timeout(15000),
    })
    const j = await r.json().catch(() => null)
    log('CONVERSATIONS status=' + r.status)
    for (const c of (j && j.data) || []) {
      const parts = (c.participants && c.participants.data) || []
      log('  thread updated=' + c.updated_time + ' snippet=' + String(c.snippet || '').slice(0, 40) + ' parts=' + JSON.stringify(parts.map((p) => ({ id: String(p.id).slice(0, 6) + '…' + String(p.id).slice(-4), name: p.name }))))
    }
    if (j && j.error) log('  graph_error=' + JSON.stringify(j.error))
  } catch (e) { log('CONV_EX ' + String(e && e.message).slice(0, 120)) }

  // 3) channel_identities + social_events senders จริง (อ่านอย่างเดียว)
  const ci = await api(SERVICE, 'GET', '/rest/v1/channel_identities?select=*&limit=50')
  log('CHANNEL_IDENTITIES status=' + ci.status + ' rows=' + JSON.stringify((ci.j || []).map((r) => ({ id: r.id, channel: r.channel || r.platform, identity: r.identity_id ? String(r.identity_id).slice(0, 6) + '…' : null, customer_id: r.customer_id, active: r.is_active ?? r.active }))).slice(0, 800))
  const se = await api(SERVICE, 'GET', "/rest/v1/social_events?platform=eq.MESSENGER&order=received_at.desc&limit=25&select=event_id,sender_id,sender_name,event_type,received_at")
  log('SOCIAL_EVENTS senders=' + JSON.stringify((se.j || []).map((r) => ({ e: String(r.event_id).slice(0, 24), s: r.sender_id ? String(r.sender_id).slice(0, 8) + '…' + String(r.sender_id).slice(-4) : null, n: r.sender_name, t: r.event_type, at: r.received_at }))).slice(0, 1200))

  fs.writeFileSync(path.join(__dirname, '_r74_omni5_recon.json'), JSON.stringify({ date: new Date().toISOString(), lines: out }, null, 2))
  log('RECON_DONE')
})().catch((e) => {
  log('FATAL ' + String((e && e.stack) || e).slice(0, 400))
  try { fs.writeFileSync(path.join(__dirname, '_r74_omni5_recon.json'), JSON.stringify({ date: new Date().toISOString(), lines: out, fatal: String(e) }, null, 2)) } catch {}
  process.exit(1)
})
