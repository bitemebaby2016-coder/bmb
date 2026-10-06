// APPLY migration 117 (Owner approved 2026-10-06) via Supabase Management API SQL endpoint
'use strict'
const fs = require('fs')
const env = {}
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) env[m[1]] = m[2]
}
const TOK = env.SUPABASE_ACCESS_TOKEN
const REF = 'ivkdfognyiwjcmrhcnwz'
const sql = fs.readFileSync('supabase/migrations/117_channel_intake_repair.sql', 'utf8')

fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
  .then(async (r) => {
    const j = await r.json().catch(() => null)
    console.log('HTTP', r.status)
    console.log(JSON.stringify(j, null, 2))
    process.exit(r.ok ? 0 : 1)
  })
  .catch((e) => { console.error('ERR', e.message); process.exit(1) })