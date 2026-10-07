// whoIs — READ-ONLY: ข้อมูลบัญชี (email/role) เพื่อยืนยันว่าเป็นบัญชีทดสอบ
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
;(async () => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "select u.id::text, u.email, p.role from auth.users u join public.profiles p on p.id=u.id where u.id='ae12e10b-0f1f-45ff-b0f0-6dd7a682b064'" }),
  })
  const j = await r.json()
  if (j.message) { console.error('FAIL', j.message); process.exit(1) }
  console.log(JSON.stringify(j))
})().catch((e) => { console.error('ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
