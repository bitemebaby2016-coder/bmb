'use strict'
const T = process.env.SUPABASE_ACCESS_TOKEN || ''
const R = 'ivkdfognyiwjcmrhcnwz'
async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + R + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  })
  return JSON.parse(await r.text())
}
;(async () => {
  console.log(JSON.stringify(await q("select proname, prosecdef from pg_proc where pronamespace='public'::regnamespace and (proname ilike '%catalog%' or proname like 'enforce%' or proname='create_order_with_items' or proname like 'get_menu%') order by proname"), null, 2))
})().catch(e => console.error(e.message.slice(0, 200)))
