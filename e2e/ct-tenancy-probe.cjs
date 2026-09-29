'use strict'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) })
  return JSON.parse(await r.text())
}
;(async () => {
  console.log('FK MAP:', JSON.stringify(await q("select tc.table_name, kcu.column_name, ccu.table_name ref_table, ccu.column_name ref_col from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public' and ccu.table_schema='public' order by tc.table_name")))
  console.log('RLS SUMMARY:', JSON.stringify(await q("select tablename, string_agg(policyname || ':' || cmd, ' | ') pol from pg_policies where schemaname='public' group by tablename order by tablename")))
  console.log('profiles:', JSON.stringify(await q("select column_name from information_schema.columns where table_schema='public' and table_name='profiles'")))
})().catch((e) => { console.error('FATAL', String(e)); process.exit(1) })
