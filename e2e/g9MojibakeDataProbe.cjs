// read-only: check existing DB rows for mojibake text
const fs = require('fs')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
;(async () => {
  console.log('ADDR_COLUMNS=' + await q("select table_name||'.'||column_name c from information_schema.columns where column_name like '%address%' and table_schema='public'"))
  console.log('ORDER_COLS=' + await q("select column_name c from information_schema.columns where table_name='orders' and table_schema='public' and (column_name like '%addr%' or column_name like '%deliver%')"))
  console.log('PREORDER_MOJIBAKE=' + await q("select count(*) c from pre_orders where delivery_address ~ '[\\u00C0-\\u00FF]{2,}'"))
  console.log('CUSTOMERS_MOJIBAKE=' + await q("select count(*) c from customers where address ~ '[\\u00C0-\\u00FF]{2,}' or default_address_detail ~ '[\\u00C0-\\u00FF]{2,}'"))
  console.log('CONTENT_MOJIBAKE=' + await q("select count(*) c from content_approvals where title ~ '[\\u00C0-\\u00FF]{2,}' or body ~ '[\\u00C0-\\u00FF]{2,}'"))
  console.log('NOTIF_MOJIBAKE=' + await q("select count(*) c from notifications where title ~ '[\\u00C0-\\u00FF]{2,}' or message ~ '[\\u00C0-\\u00FF]{2,}'"))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 200)))