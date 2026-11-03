// R64 — read-only production probe: print_jobs / notifications / outbox / push / promotions
'use strict'
const fs = require('fs')
const path = require('path')
const { SB, SERVICE } = require('./wave2Lib.cjs')

async function q(label, p) {
  const r = await fetch(SB + p, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } })
  let j = null
  try { j = await r.json() } catch {}
  return { label, status: r.status, rows: j }
}

;(async () => {
  const out = { at: new Date().toISOString(), checks: [] }
  out.checks.push(await q('print_jobs_recent', '/rest/v1/print_jobs?select=id,order_number,job_type,status,printer_id,attempts,last_error,requested_at,printed_at&order=requested_at.desc&limit=8'))
  out.checks.push(await q('notifications_recent', '/rest/v1/notifications?select=id,customer_id,title,message,is_read,notification_type,category,created_at&order=created_at.desc&limit=8'))
  out.checks.push(await q('outbox_recent', '/rest/v1/notification_outbox?select=event_key,status,channel,attempts,last_error,created_at&order=created_at.desc&limit=8'))
  out.checks.push(await q('push_subscriptions_count', '/rest/v1/push_subscriptions?select=id&limit=200'))
  out.checks.push(await q('promotions_recent', '/rest/v1/promotions?select=id,name,is_active,is_banner,banner_image,banner_mascot,start_date,end_date,created_at&order=created_at.desc&limit=10'))
  out.checks.push(await q('printers', '/rest/v1/printers?select=id,name,printer_type,is_default,connection_status&limit=10'))
  // summarize push count
  const push = out.checks.find((c) => c.label === 'push_subscriptions_count')
  out.pushSubscriptionCount = Array.isArray(push.rows) ? push.rows.length : 'err'
  if (Array.isArray(push.rows)) delete push.rows
  fs.writeFileSync(path.join(__dirname, 'r64ProdProbe-result.json'), JSON.stringify(out, null, 2))
  for (const c of out.checks) {
    const n = Array.isArray(c.rows) ? c.rows.length : JSON.stringify(c.rows)?.slice(0, 120)
    console.log(c.label + ' status=' + c.status + ' n=' + n)
    if (Array.isArray(c.rows)) for (const r of c.rows.slice(0, 6)) console.log('  ' + JSON.stringify(r).slice(0, 240))
  }
  console.log('SAVED r64ProdProbe-result.json')
})().catch((e) => { console.error('PROBE FAIL', e); process.exit(1) })