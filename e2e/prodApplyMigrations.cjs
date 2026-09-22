// ============================================
// Bite Me Baby — Production migration applier (Management API, one query per file)
// ============================================
// Applies EXPLICITLY chosen migration files to the linked production project —
// the established remote-apply precedent (one file = one process = one query,
// sanitize BOM/CRLF/NUL, wrap in BEGIN/COMMIT when the file is not self-wrapped).
//
// Usage (token required, NEVER passed as CLI arg):
//   $env:SUPABASE_ACCESS_TOKEN='<token>'
//   node e2e/prodApplyMigrations.cjs --list              # show candidate files, no write
//   node e2e/prodApplyMigrations.cjs --files 028,029,030 # apply in that order
//
// Safety: stops at the FIRST failing file; remaining files are NOT touched.
// Evidence: e2e/prod-apply-result.json
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const REF = process.env.SUPABASE_PROJECT_REF || 'ivkdfognyiwjcmrhcnwz'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const OUT = path.join(PROJ, 'e2e', 'prod-apply-result.json')

function arg(name) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : null
}
const MODE = process.argv.includes('--list') ? 'list' : (arg('files') ? 'apply' : null)

function sanitize(sql) {
  return sql.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\u0000/g, '')
}
function wrapTx(sql) {
  const s = sql.trim()
  if (/^BEGIN\b/m.test(s) && /COMMIT\s*;/m.test(s)) return s
  return 'BEGIN;\n' + s + '\n\nCOMMIT;'
}

async function apiQuery(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await r.json()
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + JSON.stringify(body).slice(0, 400))
  if (body && !Array.isArray(body) && body.message) throw new Error(body.message + ' ' + JSON.stringify(body).slice(0, 300))
  return body
}

async function run() {
  const dir = path.join(PROJ, 'supabase', 'migrations')
  const all = fs.readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort()
  if (!MODE) {
    console.log('Usage: node e2e/prodApplyMigrations.cjs --files 028,029,030  (or --list)')
    console.log('Available migration files: ' + all.map((f) => f.slice(0, 3)).join(', '))
    process.exit(2)
  }
  if (!TOKEN) { console.log('XMARK SUPABASE_ACCESS_TOKEN not set — refusing to touch production'); process.exit(2) }

  const wanted = MODE === 'list' ? null : String(arg('files')).split(',').map((s) => s.trim()).filter(Boolean)
  const chosen = wanted ? all.filter((f) => wanted.some((w) => f.startsWith(w + '_'))) : all
  if (wanted) {
    const missing = wanted.filter((w) => !chosen.some((f) => f.startsWith(w + '_')))
    if (missing.length) { console.log('XMARK no migration file matches: ' + missing.join(', ')); process.exit(2) }
  }
  console.log((MODE === 'list' ? 'WOULD APPLY' : 'APPLYING') + ' (' + chosen.length + '): ' + chosen.join(' | '))
  if (MODE === 'list') { console.log('Dry list only — no production write.'); process.exit(0) }

  const applied = []
  for (const file of chosen) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8')
    const sql = wrapTx(sanitize(raw))
    try {
      await apiQuery(sql)
      applied.push({ file, ok: true })
      console.log('check APPLIED ' + file)
    } catch (e) {
      applied.push({ file, ok: false, error: String(e).slice(0, 500) })
      console.log('XMARK FAILED ' + file + ' :: ' + String(e).slice(0, 300))
      console.log('STOPPED — remaining files untouched (transaction-safe).')
      break
    }
  }

  // post-apply verification probes (same single-query style)
  const verify = {}
  try {
    const rows = await apiQuery(
      "select coalesce(json_agg(t),'[]'::json) from ("
      + " select 'f1_else' k, coalesce((select case when position('ELSE RETURN false' in pg_get_functiondef(oid))>0 then 'present' else 'absent' end"
      + "   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='order_transition_allowed'),'missing') v"
      + " union all select 'grant_029' k, coalesce((select 'granted' from information_schema.role_function_grants"
      + "   where grantee='authenticated' and routine_name='ensure_rounds_for_date' limit 1),'not-granted') v"
      + " union all select 'history_tail' k, (select coalesce(string_agg(version,',' order by version),'') from supabase_migrations.schema_migrations) v"
      + ') t',
    )
    for (const row of rows) verify[row.k] = row.v
  } catch (e) { verify.error = String(e).slice(0, 200) }

  const okCount = applied.filter((a) => a.ok).length
  const result = { timestamp: new Date().toISOString(), ref: REF, applied, verify, pass: okCount === applied.length && applied.length > 0 }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8')
  console.log('\nPROD-APPLY ' + okCount + '/' + applied.length + ' → ' + OUT)
  console.log('NEXT: rerun contract suites against production: contracts_023 / contracts_028 / contracts_029 / contracts_030 (SQL Editor or pooler psql)')
  process.exit(result.pass ? 0 : 1)
}

run().catch((e) => { console.log('FATAL ' + String(e).slice(0, 300)); process.exit(1) })