// R64 — probe marketing_feed_posts (published) + notification_prefs + push subs detail
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
  out.checks.push(await q('feed_published', '/rest/v1/marketing_feed_posts?select=id,title,post_type,status,published_at,created_at,image_urls&order=created_at.desc&limit=10'))
  out.checks.push(await q('push_subs', '/rest/v1/push_subscriptions?select=id,customer_id,failure_count,last_success_at,created_at&limit=10'))
  out.checks.push(await q('notif_prefs', '/rest/v1/notification_prefs?select=customer_id,push_enabled,channels,updated_at&limit=10'))
  fs.writeFileSync(path.join(__dirname, 'r64BProbe-result.json'), JSON.stringify(out, null, 2))
  for (const c of out.checks) {
    console.log(c.label + ' status=' + c.status)
    if (Array.isArray(c.rows)) for (const r of c.rows) console.log('  ' + JSON.stringify(r).slice(0, 260))
    else console.log('  ' + JSON.stringify(c.rows).slice(0, 200))
  }
})().catch((e) => { console.error(e); process.exit(1) })