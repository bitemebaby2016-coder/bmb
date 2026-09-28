'use strict'
// W5-1: verify admin/authenticated operational visibility intact after migration 050
const fs = require('fs')
const env = fs.readFileSync('D:/A PROJECT/Bite Me Baby/.env', 'utf8')
const tk = ((env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m) || [])[1] || process.env.SUPABASE_ACCESS_TOKEN || '').trim()
async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  return { status: r.status, body: await r.text() }
}
async function main() {
  const sql = [
    "select has_table_privilege('authenticated','public.orders','SELECT') as authed_select,",
    "has_table_privilege('anon','public.orders','SELECT') as anon_select,",
    "(select count(*) from pg_policies where tablename='orders' and policyname='orders_anon_read') as anon_policy_count,",
    "has_function_privilege('anon','public.track_order(text,text)','EXECUTE') as anon_exec,",
    "has_function_privilege('authenticated','public.track_order(text,text)','EXECUTE') as authed_exec",
  ].join(' ')
  const r = await q(sql)
  console.log('status=' + r.status)
  console.log(r.body)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
