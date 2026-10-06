// Reconcile supabase_migrations.schema_migrations with local migration files.
// 106-117 were applied to production via Management API (NOT via CLI), so the
// CLI history lags and `supabase db push --include-all` would RE-APPLY them.
// This script inserts the missing (version, name) rows — bookkeeping only,
// it never runs migration SQL.
'use strict'
const fs = require('fs')
const path = require('path')

const tokens = []
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m && m[1]) tokens.push(m[1])
}
const REF = 'ivkdfognyiwjcmrhcnwz'
const MIG_DIR = 'supabase/migrations'

function q(token, sql) {
  return fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }))
}

async function main() {
  let tok = ''
  for (const t of [...tokens].reverse()) {
    const r = await q(t, 'select 1')
    if (r.status === 200 || r.status === 201) { tok = t; break }
    console.log('token …' + t.slice(-4) + ' → HTTP ' + r.status)
  }
  if (!tok) { console.log('NO WORKING TOKEN'); process.exit(1) }

  const local = fs.readdirSync(MIG_DIR)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .map((f) => ({ version: f.split('_')[0], name: f.replace(/\.sql$/, '') }))
  console.log('local migrations:', local.length)

  const cur = await q(tok, 'select version from supabase_migrations.schema_migrations order by version')
  if (cur.status !== 200 && cur.status !== 201) { console.log('QUERY FAILED', cur.status, JSON.stringify(cur.j)); process.exit(1) }
  const have = new Set((cur.j || []).map((r) => String(r.version)))
  console.log('production history rows:', have.size)

  const missing = local.filter((m) => !have.has(m.version))
  console.log('missing in history:', JSON.stringify(missing.map((m) => m.version)))
  if (missing.length === 0) { console.log('HISTORY ALREADY IN SYNC'); return }
  if (process.argv[2] !== '--write') {
    console.log('DRY-RUN (ใส่ --write เพื่อบันทึกจริง)'); return
  }
  for (const m of missing) {
    const sql = `insert into supabase_migrations.schema_migrations(version, name, statements) values ('${m.version}', '${m.name.replace(/'/g, "''")}', '{}'::text[]) on conflict (version) do nothing;`
    const r = await q(tok, sql)
    console.log('insert', m.version, '→ HTTP', r.status)
  }
  const after = await q(tok, 'select count(*)::int as n from supabase_migrations.schema_migrations')
  console.log('history rows after:', JSON.stringify(after.j))
}
main().catch((e) => { console.error('ERR', String(e).slice(0, 300)); process.exit(1) })