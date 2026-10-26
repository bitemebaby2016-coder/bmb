// evidence: อ่านค่า marketing/menu/stop rules แบบ read-only ผ่าน Management API (2026-10-26)
// เหตุผล: probe ด้วย anon = 42501 (ไม่มี GRANT) → ใช้เส้นทางเดียวกับ w6/w7 = SELECT อย่างเดียว ไม่มี write
const fs = require('fs')
const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
if (!token) { console.log('NO_TOKEN'); process.exit(1) }
const REF = 'ivkdfognyiwjcmrhcnwz'
const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, body: await r.text() }
}
;(async () => {
  const results = []
  const queries = [
    ['marketing_rules', 'SELECT * FROM public.marketing_rules ORDER BY 1 LIMIT 20'],
    ['menu_rules', 'SELECT * FROM public.menu_rules ORDER BY 1 LIMIT 20'],
    ['stop_conditions', 'SELECT * FROM public.stop_conditions ORDER BY 1 LIMIT 20'],
  ]
  for (const [label, query] of queries) {
    const r = await q(query)
    let data
    try { data = JSON.parse(r.body) } catch { data = String(r.body).slice(0, 500) }
    results.push({ label, status: r.status, data })
    console.log('[' + label + '] status=' + r.status + ' ' + JSON.stringify(data).slice(0, 900))
  }
  fs.writeFileSync('e2e/mrRead-2026-10-26.json', JSON.stringify(results, null, 2))
  const bad = results.filter((r) => r.status >= 400)
  console.log(bad.length ? 'MRREAD_FAIL ' + bad.map((b) => b.label).join(',') : 'MRREAD_OK')
})().catch((e) => { console.log('ERR ' + e.message); process.exit(1) })