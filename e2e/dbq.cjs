'use strict'
// dbq — run a single SQL (argv[2]) via Supabase Management API, print JSON. read-only use.
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const tokens = []
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !l.trim().startsWith('#') && m[2] && m[1] === 'SUPABASE_ACCESS_TOKEN') tokens.push(m[2])
}
const REF = 'ivkdfognyiwjcmrhcnwz'
// argv[2] = SQL text (legacy) OR a path to a .sql file (new — avoids cmd.exe
// quote-mangling: `node e2e\dbq.cjs e2e\_tmp.sql` runs without any quotes)
const ARG2 = process.argv[2]
let SQL = ARG2
try {
  const fp = path.resolve(ROOT, String(ARG2 || ''))
  if (ARG2 && fs.existsSync(fp) && fs.statSync(fp).isFile()) SQL = fs.readFileSync(fp, 'utf8')
} catch { /* keep raw argv */ }
async function run() {
  let last = ''
  for (const tok of [...tokens].reverse()) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: SQL }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok) { console.log(JSON.stringify(j, null, 1)); return }
    if (r.status === 401 || r.status === 403) { last = 'HTTP ' + r.status; continue }
    console.error('HTTP ' + r.status + ' ' + JSON.stringify(j).slice(0, 400)); process.exit(1)
  }
  console.error(last || 'no token'); process.exit(1)
}
run()
