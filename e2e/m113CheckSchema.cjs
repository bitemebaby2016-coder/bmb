// M113 step 2 — inspect delivery_rounds NOT NULL columns (production truth)
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
  const cols = await q(
    `select column_name, is_nullable, column_default, data_type
       from information_schema.columns
      where table_schema='public' and table_name='delivery_rounds'
      order by ordinal_position`
  )
  console.log('--- delivery_rounds columns ---')
  for (const c of cols) console.log(`${c.column_name}: ${c.is_nullable} default=${c.column_default ?? 'NONE'} (${c.data_type})`)
  const tpl = await q(
    `select id, branch_id, tenant_id, round_key, scheduled_date, status
       from public.delivery_rounds order by scheduled_date desc nulls last limit 3`
  )
  console.log('--- recent template rows ---')
  console.log(JSON.stringify(tpl, null, 1))
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
