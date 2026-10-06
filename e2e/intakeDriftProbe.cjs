// READ-ONLY probe: intake-chain state + active rounds (Management API SELECT only)
'use strict'
const fs = require('fs')
const env = {}
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) env[m[1]] = m[2]
}
const TOK = env.SUPABASE_ACCESS_TOKEN
const REF = 'ivkdfognyiwjcmrhcnwz'

async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(j))
  return j
}

;(async () => {
  const fns = await q(`select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('create_order_with_items','create_order_with_items_core') order by 1,2`)
  const entry = fns.find((f) => f.proname === 'create_order_with_items')
  const ok = entry && entry.args.includes('p_source_channel') && entry.args.includes('p_external_ref_id') && entry.args.includes('p_customer_ref')
  console.log('INTAKE SIGNATURE: ' + (ok ? 'OK (18-param single signature)' : 'DRIFT — migration 117 needed'))

  const rounds = await q(`select id, status, scheduled_date, cutoff_time from public.delivery_rounds where status='active' order by scheduled_date desc limit 10`)
  console.log('ACTIVE ROUNDS:', JSON.stringify(rounds, null, 2))
  const today = await q(`select (now() AT TIME ZONE 'Asia/Bangkok')::date as bangkok_today, (now() AT TIME ZONE 'Asia/Bangkok')::time as bangkok_now`)
  console.log('BANGKOK TODAY/NOW:', JSON.stringify(today))
  const cols = await q(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='delivery_rounds' order by ordinal_position`)
  console.log('DELIVERY_ROUNDS COLUMNS:', JSON.stringify(cols, null, 1))
})().catch(e => { console.error('ERR', e.message); process.exit(1) })