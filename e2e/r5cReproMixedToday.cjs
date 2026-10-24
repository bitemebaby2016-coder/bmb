// R5c repro probe — Owner 2026-10-24: mixed cart (calendar menu + general) PRE_ORDER
// for the menu date = TODAY fails with a generic "create order failed" toast.
// Runs READ-ONLY facts + a scenario wrapped in BEGIN..ROLLBACK against PRODUCTION
// via the Management API — ZERO persisted data (same harness as contracts_142).
const fs = require('fs')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
const T = "(now() at time zone 'Asia/Bangkok')::date"
;(async () => {
  console.log('== FACTS (read-only) ==')
  console.log('NOW=' + await q("select to_char(now() at time zone 'Asia/Bangkok','YYYY-MM-DD HH24:MI:SS') t"))
  console.log('MENU_TODAY=' + await q(`select product_id, delivery_round_key, is_published from menu_schedule where scheduled_date = ${T} order by 1`))
  console.log('ROUNDS_TODAY=' + await q(`select id, round_key, display_name, cutoff_time, delivery_start, delivery_end, status, current_count, max_capacity from delivery_rounds where scheduled_date = ${T} order by delivery_start`))
  console.log('LEAD_DAYS_RAW=' + await q(`select key, value from business_settings where key like '%lead%' or key like '%pre_order%' or key like '%order%'`))
  console.log('ORDER_SETTING_FN=' + await q(`select pg_get_function_identity_arguments(oid) args, prosrc from pg_proc where proname='order_setting'`))
  console.log('== SCENARIO (BEGIN..ROLLBACK — zero persisted) ==')
  console.log('SCENARIO=' + await q(fs.readFileSync('e2e/r5cReproMixedToday.sql', 'utf8')))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))