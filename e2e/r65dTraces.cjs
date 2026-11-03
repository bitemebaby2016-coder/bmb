// R65d — probe traces of today's checkout attempts: cart_sessions / audit_logs / order_submissions (read-only)
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')
const H = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
const get = async (q) => {
  const r = await fetch(SB + q, { headers: H })
  return { s: r.status, j: await r.json().catch(() => null) }
}
;(async () => {
  const out = { at: new Date().toISOString() }
  out.cartSessions = await get('/rest/v1/cart_sessions?select=id,status,customer_id,created_at,updated_at&order=created_at.desc&limit=10')
  out.audit = await get('/rest/v1/audit_logs?select=action,entity_type,entity_id,description,created_at&created_at=gte.2026-11-03T12:00:00Z&order=created_at.desc&limit=20')
  out.submissions = await get('/rest/v1/order_submissions?select=client_submit_key,order_number,created_at&order=created_at.desc&limit=10')
  out.notices = await get('/rest/v1/notifications?select=id,event_key,title,created_at&order=created_at.desc&limit=10')
  fs.writeFileSync(path.join(__dirname, 'r65dTraces-result.json'), JSON.stringify(out, null, 2))
  console.log('cart=', out.cartSessions.s, 'audit=', out.audit.s, 'subs=', out.submissions.s, 'notif=', out.notices.s)
  console.log('cartN=', Array.isArray(out.cartSessions.j) ? out.cartSessions.j.length : '?', 'auditN=', Array.isArray(out.audit.j) ? out.audit.j.length : '?')
})().catch((e) => { console.error(e); process.exit(1) })
