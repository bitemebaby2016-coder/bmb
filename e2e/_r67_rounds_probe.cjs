'use strict'
// _r67_rounds_probe — why is checkout's round list empty at 20:28 BKK?
// Reads the service key from supabase/secrets.local.env (never printed), then
// dumps today's delivery_rounds + business_settings hours/operating_hours.
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
if (!SVC) { console.log('FATAL no service key'); process.exit(1) }

const H = { apikey: SVC, Authorization: 'Bearer ' + SVC }

async function q(pathAndQuery) {
  const r = await fetch(URL + '/rest/v1/' + pathAndQuery, { headers: H })
  const txt = await r.text()
  if (!r.ok) return { error: r.status + ' ' + txt.slice(0, 300) }
  try { return JSON.parse(txt) } catch { return { error: 'bad json ' + txt.slice(0, 200) } }
}

;(async () => {
  const out = {}
  out.nowUtc = new Date().toISOString()
  // 1) today's rounds — fetch raw first to discover the date column
  const raw = await q('delivery_rounds?select=*&limit=5')
  out.roundsSample = raw
  if (!raw.error && Array.isArray(raw) && raw.length) {
    out.columns = Object.keys(raw[0])
    const dateCol = ['round_date', 'delivery_date', 'scheduled_date', 'date'].find((c) => c in raw[0])
    out.dateCol = dateCol
    if (dateCol) {
      const today = await q('delivery_rounds?select=*&' + dateCol + '=eq.2026-11-04&order=delivery_start.asc&limit=30')
      out.todayCount = Array.isArray(today) ? today.length : today
      out.today = Array.isArray(today)
        ? today.map((r) => ({
            id: r.id, key: r.round_key, name: r.display_name, start: r.delivery_start,
            end: r.delivery_end, status: r.status, used: r.current_count, cap: r.max_capacity,
            branch: r.branch_id, tenant: r.tenant_id,
          }))
        : today
    }
    // how many rounds exist at all + distinct dates
    const all = await q('delivery_rounds?select=' + (dateCol || 'id') + '&limit=1000')
    out.totalRounds = Array.isArray(all) ? all.length : all
    if (Array.isArray(all) && dateCol) {
      const dates = [...new Set(all.map((r) => r[dateCol]))].sort()
      out.dates = dates.slice(-10)
    }
  }
  // 2) business settings hours / operating_hours
  const bs = await q('business_settings?select=*&limit=3')
  if (Array.isArray(bs) && bs[0]) {
    out.businessSettings = {}
    for (const k of Object.keys(bs[0])) {
      if (/hour|operat|open|close|cutoff|round/i.test(k)) out.businessSettings[k] = bs[0][k]
    }
    if (!Object.keys(out.businessSettings).length) out.bsColumns = Object.keys(bs[0])
  } else out.businessSettings = bs

  fs.writeFileSync(path.join(__dirname, '_r67_rounds_probe.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log('roundsToday=' + out.todayCount + ' total=' + out.totalRounds + ' dateCol=' + out.dateCol)
  process.exit(0)
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exit(1) })