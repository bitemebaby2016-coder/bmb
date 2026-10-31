// R39 anon feed RPC probe — marketing_feed_posts (promote + คืนแถว) เรียกในฐานะ anon ได้ไหม (read-only)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const k = (/^VITE_SUPABASE_ANON_KEY=(.*)$/m.exec(env) || [])[1]
const url = (/^VITE_SUPABASE_URL=(.*)$/m.exec(env) || [])[1]
;(async () => {
  if (!k || !url) { console.log('NO_ENV url=' + !!url + ' key=' + !!k); return }
  const r = await fetch(url + '/rest/v1/rpc/marketing_feed_posts', {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_limit: 6 }),
  })
  console.log('FEED_RPC_HTTP=' + r.status)
  const body = await r.text()
  console.log('FEED_RPC_BODY=' + body.slice(0, 700))
  try {
    const rows = JSON.parse(body)
    console.log('ROWS=' + rows.length + ' TITLES=' + rows.map((x) => x.title + '|' + x.status).join(' · '))
  } catch { /* non-json = error text เดิมโชว์อยู่ */ }
})().catch((e) => console.log('ERR ' + String(e).slice(0, 300)))