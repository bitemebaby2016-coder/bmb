// read-only probe #2: mojibake in ORDER/CUSTOMER text columns shown in admin tables
// (orders.dropoff_detail / orders.customer_name / customers.name+phone / branches.address)
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
;(async () => {
  console.log('ORDERS_DROP_MOJIBAKE=' + await q(`select count(*) c from orders where dropoff_detail ~ '${MJ}'`))
  console.log('ORDERS_NAME_MOJIBAKE=' + await q(`select count(*) c from orders where customer_name ~ '${MJ}'`))
  console.log('ORDERS_DROP_SAMPLES=' + await q(`select order_number, left(dropoff_detail, 60) v from orders where dropoff_detail ~ '${MJ}' order by created_at desc limit 5`))
  console.log('CUSTOMERS_NAME_MOJIBAKE=' + await q(`select count(*) c from customers where name ~ '${MJ}'`))
  console.log('BRANCHES_ADDR_MOJIBAKE=' + await q(`select count(*) c from branches where address_line1 ~ '${MJ}' or coalesce(address_line2,'') ~ '${MJ}'`))
  console.log('ORDERS_TOTAL=' + await q("select count(*) c from orders"))
  console.log('ORDERS_DROP_ANY=' + await q("select count(*) c from orders where coalesce(dropoff_detail,'') <> ''"))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 200)))