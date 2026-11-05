// R72 diag: why the notify hook writes nothing
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
  const r = await q("SELECT prosrc FROM pg_proc WHERE proname = 'orders_notify_hook'")
  console.log('PROSRC_LEN:', String(r).length)
  console.log('PROSRC_TAIL:', String(r).slice(2300, 5200))
})().catch((e) => { console.error('DIAG_FAIL', String(e).slice(0, 300)); process.exit(1) })