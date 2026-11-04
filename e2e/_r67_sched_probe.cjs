'use strict'
// _r67_sched_probe — which menu_schedule dates are published (pre-order menu gate)
const fs = require('fs')
const path = require('path')
const envPath = path.join(__dirname, '..', 'supabase', 'secrets.local.env')
const env = {}
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const SVC = env.SUPABASE_SERVICE_ROLE_KEY || ''
const URL = env.SUPABASE_URL || 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC }

;(async () => {
  const out = {}
  const r = await fetch(URL + '/rest/v1/menu_schedule?select=scheduled_date,is_published,product_id,delivery_round_key&scheduled_date=gte.2026-11-04&order=scheduled_date.asc&limit=200', { headers: H })
  const rows = await r.json()
  if (!r.ok) { console.log('ERR ' + r.status + ' ' + JSON.stringify(rows).slice(0, 300)); process.exit(1) }
  const byDate = {}
  for (const row of rows) {
    const k = row.scheduled_date + (row.is_published ? '' : ' (unpublished)')
    if (!byDate[k]) byDate[k] = []
    byDate[k].push(String(row.product_id) + '@' + (row.delivery_round_key || 'ANY'))
  }
  out.byDate = byDate
  out.total = rows.length
  // rounds for those dates too
  const r2 = await fetch(URL + '/rest/v1/delivery_rounds?select=scheduled_date,id,round_key,status&scheduled_date=gte.2026-11-04&order=scheduled_date.asc&limit=200', { headers: H })
  const rounds = await r2.json()
  const roundByDate = {}
  for (const row of rounds) {
    const k = row.scheduled_date
    if (!roundByDate[k]) roundByDate[k] = []
    roundByDate[k].push(row.round_key + ':' + row.status)
  }
  out.roundsByDate = roundByDate
  fs.writeFileSync(path.join(__dirname, '_r67_sched_probe.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log('scheduleDates=' + JSON.stringify(byDate))
  process.exit(0)
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exit(1) })