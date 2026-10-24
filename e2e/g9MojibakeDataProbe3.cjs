// read-only probe #3: EXACT mojibake values in orders (hex evidence) + customers columns
const fs = require('fs')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
// real chars (JS \uXXXX escapes) — PG regex receives the characters themselves
const MJ = '[\u00C0-\u00FF\u0152\u0153\u20AC\u2018\u2019\u201C\u201D\u2013\u2014]{2,}'
const hex = (col) => `encode(convert_to(coalesce(${col},''),'UTF8'),'hex') AS ${col}_hex`
;(async () => {
  console.log('CUSTOMER_COLS=' + await q("select column_name c from information_schema.columns where table_name='customers' and table_schema='public' order by 1"))
  console.log('ORDERS_NAME_ROWS=' + await q(`select order_number, customer_name, ${hex('customer_name')}, length(customer_name) len from orders where customer_name ~ '${MJ}'`))
  console.log('ORDERS_DROP_ROWS=' + await q(`select order_number, dropoff_detail, ${hex('dropoff_detail')}, length(dropoff_detail) len from orders where dropoff_detail ~ '${MJ}'`))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 200)))