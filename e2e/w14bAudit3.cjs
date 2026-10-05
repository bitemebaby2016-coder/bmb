// W-1.4b audit #3 — promotions (ตรวจว่ามี canonical free-shipping threshold ไหม)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
async function q(sql) {
  const res = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json()
  if (!res.ok || json.message) throw new Error('SQL failed: ' + (json.message || res.statusText))
  return json
}
async function main() {
  console.log('=== promotions columns ===')
  console.log(JSON.stringify(await q(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='promotions' order by ordinal_position`), null, 1))
  console.log('=== promotions rows ===')
  console.log(JSON.stringify(await q(`select * from public.promotions`), null, 1))
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
