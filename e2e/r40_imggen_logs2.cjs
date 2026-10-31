// R40b — วน endpoint logs ที่เป็นไปได้ (2026-10: /logs/query = 404 แล้ว) — ตัวไหน 200 = ใช้ตัวนั้น
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const REF = 'ivkdfognyiwjcmrhcnwz'
const H = { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' }
const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
;(async () => {
  const tries = [
    ['POST', 'https://api.supabase.com/v1/projects/' + REF + '/analytics/v1/logs/query',
      { sql: "select created_at, event_message from function_edge_logs where id.name = 'image-gen' and created_at > '" + since + "' order by created_at desc limit 40" }],
    ['POST', 'https://api.supabase.com/v1/projects/' + REF + '/analytics/v1/query',
      { sql: "select created_at, event_message from function_edge_logs order by created_at desc limit 40" }],
    ['GET', 'https://api.supabase.com/v1/projects/' + REF + '/analytics/v1/logs?iso_timestamp_start=' + encodeURIComponent(since), null],
  ]
  for (const [m, url, body] of tries) {
    const r = await fetch(url, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined })
    const t = await r.text()
    console.log('TRY ' + m + ' ' + url.replace('https://api.supabase.com', '') + ' => HTTP ' + r.status)
    if (r.ok) { console.log('LOGS_OK=' + t.slice(0, 3500)); return }
    console.log('  body: ' + t.slice(0, 160))
  }
  console.log('ALL_ENDPOINTS_FAILED')
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))