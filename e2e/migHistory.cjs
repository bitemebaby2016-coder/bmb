// migHistory — READ-ONLY: ดู migration history ล่าสุด (supabase_migrations.schema_migrations)
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
;(async () => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select version, name from supabase_migrations.schema_migrations order by version desc limit 8' }),
  })
  const j = await r.json()
  if (j.message) { console.error('MIG_FAIL', j.message); process.exit(1) }
  for (const row of j) console.log(row.version, row.name || '')
})().catch((e) => { console.error('MIG_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
