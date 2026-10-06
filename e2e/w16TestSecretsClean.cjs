// W-1.6: list/delete BMB_TEST_* from production Edge Function secrets
'use strict'
const fs = require('fs')
const env = {}
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) env[m[1]] = m[2]
}
const TOK = env.SUPABASE_ACCESS_TOKEN
const REF = 'ivkdfognyiwjcmrhcnwz'
const H = { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' }

async function main() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, { headers: H })
  console.log('LIST HTTP', r.status)
  const j = await r.json().catch(() => [])
  const arr = Array.isArray(j) ? j : (j.secrets || [])
  console.log('total secrets:', arr.length)
  const tests = arr.filter((s) => /^BMB_TEST_/.test(s.name)).map((s) => s.name)
  console.log('BMB_TEST_*:', JSON.stringify(tests))
  if (process.argv[2] === '--delete' && tests.length) {
    const d = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
      method: 'DELETE', headers: H, body: JSON.stringify(tests),
    })
    console.log('DELETE HTTP', d.status)
    const r2 = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, { headers: H })
    const j2 = await r2.json().catch(() => [])
    const arr2 = Array.isArray(j2) ? j2 : (j2.secrets || [])
    const left = arr2.filter((s) => /^BMB_TEST_/.test(s.name)).map((s) => s.name)
    console.log('remaining BMB_TEST_*:', JSON.stringify(left), '→', left.length === 0 ? 'CLEAN' : 'NOT CLEAN')
  }
}
main().catch((e) => { console.error('ERR', String(e).slice(0, 200)); process.exit(1) })