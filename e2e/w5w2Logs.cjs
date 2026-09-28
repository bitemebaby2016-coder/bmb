'use strict'
const fs = require('fs')
const env = fs.readFileSync('D:/A PROJECT/Bite Me Baby/.env', 'utf8')
const tk = ((env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m) || [])[1] || process.env.SUPABASE_ACCESS_TOKEN || '').trim()
const REF = 'ivkdfognyiwjcmrhcnwz'
async function main() {
  const q = encodeURIComponent("select cast(timestamp as text) t, event_message from edge_logs where request.method = 'POST' and request.path like '%phone-auto-login%' order by timestamp desc limit 6")
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/logs?sql=${q}`, { headers: { Authorization: 'Bearer ' + tk } })
  console.log('status=' + r.status)
  console.log((await r.text()).slice(0, 2000))
}
main().catch((e) => { console.error('F', String(e).slice(0, 300)); process.exit(1) })
