// R86 — READ-ONLY probe: are migrations 190-193 applied on PRODUCTION?
// Each marker chosen from the migration's own header/body (see file comments).
'use strict'
const fs = require('fs')
const REF = 'ivkdfognyiwjcmrhcnwz'
let tok = ''
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m) tok = m[1]
}
async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, text: await r.text() }
}
async function main() {
  // 190 = create_order_with_items_core body switched CURRENT_DATE -> Asia/Bangkok (promo gate)
  const m190 = await sql("SELECT proname, prosrc LIKE '%AT TIME ZONE ''Asia/Bangkok''%' AS bkk FROM pg_proc WHERE proname = 'create_order_with_items_core'")
  console.log('M190', m190.status, m190.text.slice(0, 400))

  // 191 = create_production_batch default switched to BKK + column defaults on 2 tables
  const m191 = await sql("SELECT proname, prosrc LIKE '%AT TIME ZONE ''Asia/Bangkok''%' AS bkk FROM pg_proc WHERE proname = 'create_production_batch'")
  console.log('M191_FN', m191.status, m191.text.slice(0, 400))
  const m191c = await sql("SELECT c.relname, a.attname, pg_get_expr(d.adbin, d.adrelid) AS def FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = any (d.adkey) WHERE a.attname = 'scheduled_date' ORDER BY c.relname")
  console.log('M191_COLS', m191c.status, m191c.text.slice(0, 900))

  // 192 = customers.birthday + menu_sales_stats + crm_segment_summary
  const m192 = await sql("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'birthday') AS birthday, EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'menu_sales_stats') AS sales_stats, EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'crm_segment_summary') AS segment_summary")
  console.log('M192', m192.status, m192.text.slice(0, 500))

  // 193 = customers.crm_consent + winback scan gated on consent
  const m193 = await sql("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'crm_consent') AS crm_consent, COALESCE((SELECT prosrc LIKE '%crm_consent%' FROM pg_proc WHERE proname = 'crm_winback_scan'), false) AS winback_gated")
  console.log('M193', m193.status, m193.text.slice(0, 500))

  // history rows (194/195 recorded by R85; 190-193 = what we're checking)
  const hist = await sql("SELECT version, name FROM supabase_migrations.schema_migrations WHERE version >= '188' ORDER BY version")
  console.log('HISTORY', hist.status, hist.text.slice(0, 800))

  // cron jobs created by 192 (if pg_cron present)
  const cron = await sql("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS has_cron")
  console.log('CRON_EXT', cron.status, cron.text.slice(0, 300))
}
main().catch(e => { console.error('ERR', String(e).slice(0, 300)); process.exit(1) })
