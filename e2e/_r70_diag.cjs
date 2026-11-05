// one-shot diag: how many statement results does the SQL API return?
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return await r.text()
}
;(async () => {
  console.log('TWO_SELECTS:', await q('SELECT 1 AS a; SELECT 2 AS b;'))
  console.log('FUNC_CALL:', await q("SELECT public.send_order_message('BMB-20261105-896', 'R70 diag', 'admin') AS x"))
  console.log('TWO_MIXED:', await q("SELECT 1 AS a; SELECT public.send_order_message('BMB-20261105-896', 'R70 diag2', 'admin') AS x; SELECT 3 AS c;"))
})().catch((e) => { console.error('DIAG_FAIL', String(e).slice(0, 200)); process.exit(1) })
