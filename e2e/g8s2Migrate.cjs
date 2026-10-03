// G8-S2 — deploy migration via Management API SQL (no secrets printed)
const fs = require('fs')
const token = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
if (!token) { console.log('NO_ACCESS_TOKEN'); process.exit(1) }
const sql = fs.readFileSync('supabase/migrations/110_g8_automation_queue.sql', 'utf8')
;(async () => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await r.text()
  console.log('MIGRATE_STATUS=' + r.status)
  if (r.status >= 400) { console.log(body.slice(0, 500)); process.exit(1) }
  // verify objects exist
  const q = async (query) => {
    const r2 = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }) })
    return { status: r2.status, body: await r2.text() }
  }
  const t = await q("select column_name from information_schema.columns where table_name='automation_queue' order by ordinal_position")
  console.log('COLS=' + t.body.replace(/[\[\]"{}\n]/g, ''))
  const f = await q("select routine_name from information_schema.routines where routine_schema='public' and routine_name like '%automation%' order by 1")
  console.log('FUNCS=' + f.body.replace(/[\[\]"{}\n]/g, ''))
  const rls = await q("select relrowsecurity from pg_class where relname='automation_queue'")
  console.log('RLS=' + rls.body.replace(/[^truefals]/g, ''))
})()