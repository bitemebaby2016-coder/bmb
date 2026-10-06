// W-1.6: list/delete BMB_TEST_* from production Edge Function secrets
'use strict'
const fs = require('fs')
const env = {}
const tokens = []
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2]) {
    if (m[1] === 'SUPABASE_ACCESS_TOKEN') tokens.push(m[2])
    else env[m[1]] = m[2]
  }
}
const REF = 'ivkdfognyiwjcmrhcnwz'
console.log('tokens found in .env.local:', tokens.length)

async function listSecrets(tok) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, { headers: { Authorization: 'Bearer ' + tok } })
  const j = await r.json().catch(() => [])
  return { status: r.status, arr: Array.isArray(j) ? j : (j.secrets || []) }
}

async function main() {
  let arr = []
  let working = ''
  for (const tok of [...tokens].reverse()) { // latest line first
    const { status, arr: a } = await listSecrets(tok)
    console.log('try token …' + tok.slice(-4) + ' → HTTP ' + status)
    if (status === 200) { arr = a; working = tok; break }
  }
  if (!working) { console.log('NO WORKING TOKEN'); process.exit(1) }
  console.log('total secrets:', arr.length)
  const tests = arr.filter((s) => /^BMB_TEST_/.test(s.name)).map((s) => s.name)
  console.log('BMB_TEST_*:', JSON.stringify(tests))
  if (process.argv[2] === '--delete' && tests.length) {
    const d = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + working, 'Content-Type': 'application/json' }, body: JSON.stringify(tests),
    })
    console.log('DELETE HTTP', d.status)
    const { arr: arr2 } = await listSecrets(working)
    const left = arr2.filter((s) => /^BMB_TEST_/.test(s.name)).map((s) => s.name)
    console.log('remaining BMB_TEST_*:', JSON.stringify(left), '→', left.length === 0 ? 'CLEAN' : 'NOT CLEAN')
  }
}
main().catch((e) => { console.error('ERR', String(e).slice(0, 200)); process.exit(1) })