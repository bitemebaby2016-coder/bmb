// smsPhoneLookup — READ-ONLY: หา customer_id ที่มี phone ตรงกับปลายทาง (mask เบอร์ก่อนพิมพ์)
//   node e2e/smsPhoneLookup.cjs 9269
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const suffix = process.argv[2] || '9269'
const mask = (p) => {
  const d = String(p || '').replace(/\D/g, '')
  return d.length < 6 ? '***' : d.slice(0, 3) + '***' + d.slice(-4)
}
;(async () => {
  const sql = suffix === 'all'
    ? `select id, phone, role from public.profiles order by role, id limit 40`
    : `select id, phone, role from public.profiles where phone like '%${suffix.replace(/'/g, '')}' order by id`
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const j = await r.json()
  if (j.message) { console.error('LOOKUP_FAIL', j.message); process.exit(1) }
  console.log('matches:', j.length)
  for (const row of j) console.log(' id=' + row.id, '| phone=' + mask(row.phone), '| role=' + (row.role || ''))
})().catch((e) => { console.error('LOOKUP_ERR', String(e.message || e).slice(0, 300)); process.exit(1) })
