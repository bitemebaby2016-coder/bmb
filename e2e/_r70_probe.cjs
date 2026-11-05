// R70 — probe 1: chat (order_messages) + push/PWA readiness (read-only)
// evidence: e2e/_r70_probe.json · ใช้คู่กับ _r70b_probe.cjs (follow-up)
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, SERVICE, api } = require('./wave2Lib.cjs')

async function q(label, p) {
  const r = await api(SERVICE, 'GET', p)
  return { label, status: r.status, rows: r.j }
}

async function rpcq(label, fn, body) {
  const r = await api(SERVICE, 'POST', '/rest/v1/rpc/' + fn, body ?? {})
  return { label, status: r.status, rows: r.j }
}

;(async () => {
  const out = { at: new Date().toISOString(), checks: [] }
  out.checks.push(await q('order_messages_recent', '/rest/v1/order_messages?select=id,order_number,sender_role,body,created_at&order=created_at.desc&limit=10'))
  out.checks.push(await q('msg_outbox', "/rest/v1/notification_outbox?select=event_key,status,channel,customer_id,attempts,last_error,created_at&event_key=like.msg.*&order=created_at.desc&limit=10"))
  out.checks.push(await q('push_config_setting', '/rest/v1/business_settings?key=eq.push_config&select=key,value'))
  out.checks.push(await rpcq('get_push_config', 'get_push_config', {}))
  out.checks.push(await q('notifications_sample', '/rest/v1/notifications?select=id,customer_id,user_id,notification_type,category,title&order=created_at.desc&limit=5'))
  out.checks.push(await q('business_settings_all_keys', '/rest/v1/business_settings?select=key'))
  try {
    const r = await fetch(SB + '/functions/v1/push-send?diag=1', {
      headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
      signal: AbortSignal.timeout(15000),
    })
    out.checks.push({ label: 'push_send_diag', status: r.status, rows: await r.json().catch(() => null) })
  } catch (e) {
    out.checks.push({ label: 'push_send_diag', status: 0, rows: String(e).slice(0, 150) })
  }
  fs.writeFileSync(path.join(__dirname, '_r70_probe.json'), JSON.stringify(out, null, 2))
  for (const c of out.checks) {
    const n = Array.isArray(c.rows) ? c.rows.length : JSON.stringify(c.rows)?.slice(0, 400)
    console.log('== ' + c.label + ' status=' + c.status)
    console.log(typeof n === 'number' ? c.rows.map((r) => JSON.stringify(r).slice(0, 260)).join('\n') : String(n))
  }
  console.log('SAVED _r70_probe.json')
})().catch((e) => { console.error('PROBE FAIL', e); process.exit(1) })
