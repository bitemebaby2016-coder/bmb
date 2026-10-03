// G7-S0 read-only probe — content_approvals approval path (no mutation, no secrets printed)
const fs = require('node:fs')
const T = fs.readFileSync('.env.local', 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)[1].trim()
const q = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(30000),
  })
  const t = await r.text()
  return r.ok ? t.slice(0, 400) : 'ERR ' + r.status + ' ' + t.slice(0, 120)
}
;(async () => {
  console.log('CA_SCHEMA ' + await q("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='content_approvals' order by ordinal_position"))
  console.log('CA_ROWS ' + await q('select count(*) as n from content_approvals'))
  console.log('CA_STATUS_CHECK ' + await q("select pg_get_constraintdef(c.oid) as def from pg_constraint c where c.conrelid='public.content_approvals'::regclass and c.contype='c'"))
  console.log('CA_RPCS ' + await q("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('submit_content_for_approval','review_content','is_content_approved')"))
})()