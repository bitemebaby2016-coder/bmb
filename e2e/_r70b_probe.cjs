// R70b — follow-up: why msg-* missing + push_subscriptions shape + nullability
// (แยกจาก _r70_probe.cjs ตัวแรก = chat/PWA readiness · evidence: _r70b_probe.json)
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, SERVICE, api } = require('./wave2Lib.cjs')

async function q(label, p) {
  const r = await api(SERVICE, 'GET', p)
  return { label, status: r.status, rows: r.j }
}

;(async () => {
  const out = { at: new Date().toISOString(), checks: [] }
  out.checks.push(await q('outbox_any', '/rest/v1/notification_outbox?select=event_key,status,channel,customer_id,created_at&order=created_at.desc&limit=20'))
  out.checks.push(await q('order_896', '/rest/v1/orders?select=order_number,customer_id,customer_ref,delivery_method,status&order_number=eq.BMB-20261105-896'))
  out.checks.push(await q('push_subs_all', '/rest/v1/push_subscriptions?select=*&order=created_at.desc&limit=20'))
  out.checks.push(await q('drivers', '/rest/v1/drivers?select=id,user_id,is_active&limit=10'))
  // scrub ความลับก่อนบันทึก (pattern r64ProdProbe): endpoint/p256dh/auth_secret ห้ามลงไฟล์ evidence
  for (const c of out.checks) {
    if (Array.isArray(c.rows)) {
      c.rows = c.rows.map((r) => {
        const { endpoint, p256dh, auth_secret, ...safe } = r
        return { ...safe, has_endpoint: !!endpoint, has_keys: !!(p256dh && auth_secret) }
      })
    }
  }
  fs.writeFileSync(path.join(__dirname, '_r70b_probe.json'), JSON.stringify(out, null, 2))
  for (const c of out.checks) {
    console.log('== ' + c.label + ' status=' + c.status)
    if (Array.isArray(c.rows)) for (const r of c.rows) console.log('  ' + JSON.stringify(r).slice(0, 300))
    else console.log('  ' + JSON.stringify(c.rows)?.slice(0, 300))
  }
  console.log('SAVED _r70b_probe.json')
})().catch((e) => { console.error('PROBE FAIL', e); process.exit(1) })
