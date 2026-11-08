// R86 APPLY (Owner-approved): migrations 191 → 192 → 193 on PRODUCTION.
// Strategy: try the WHOLE FILE as one query first (Postgres simple protocol =>
// implicit/explicit transaction stays atomic). If the endpoint rejects
// multi-statement, fall back to dollar-quote-aware statement splitting with
// BEGIN/COMMIT lines stripped (each statement autocommits — acceptable
// because every statement in these files is CREATE OR REPLACE / ADD COLUMN
// IF NOT EXISTS / idempotent cron schedule).
// Records applied versions into supabase_migrations.schema_migrations at the end.
'use strict'
const fs = require('fs')
const REF = 'ivkdfognyiwjcmrhcnwz'
let tok = ''
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m) tok = m[1]
}
if (!tok) { console.error('STOP: no SUPABASE_ACCESS_TOKEN'); process.exit(2) }

async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, text: await r.text() }
}

function splitSql(text) {
  const stmts = []
  let buf = ''
  let inDollar = false
  let i = 0
  while (i < text.length) {
    if (text.startsWith('$$', i)) { inDollar = !inDollar; buf += '$$'; i += 2; continue }
    if (text[i] === ';' && !inDollar) { stmts.push(buf); buf = ''; i++; continue }
    buf += text[i]; i++
  }
  if (buf.trim()) stmts.push(buf)
  return stmts
    .map(s => s.trim())
    .filter(s => s.replace(/--[^\n]*/g, '').trim().length > 0)
    // BEGIN/COMMIT wrappers only make sense inside a single connection — drop them
    // when falling back to per-statement execution.
    .filter(s => !/^(BEGIN|COMMIT)\s*;?$/i.test(s.replace(/--[^\n]*/g, '').trim()))
}

async function runFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  console.log('=== ' + file + ' ===')
  // 1) whole-file attempt (atomic)
  let r = await sql(text)
  if (r.status >= 200 && r.status < 300) {
    console.log('  whole-file OK (HTTP ' + r.status + ')')
    return true
  }
  console.log('  whole-file rejected (HTTP ' + r.status + ') -> ' + r.text.slice(0, 200))
  console.log('  fallback: statement-by-statement')
  const stmts = splitSql(text)
  for (let n = 0; n < stmts.length; n++) {
    r = await sql(stmts[n])
    const ok = r.status >= 200 && r.status < 300
    console.log('  stmt ' + (n + 1) + '/' + stmts.length + ' HTTP ' + r.status +
      (ok ? ' OK' : ' FAIL') + ' | ' + stmts[n].replace(/\s+/g, ' ').slice(0, 70))
    if (!ok) { console.log('  SERVER_ERROR: ' + r.text.slice(0, 600)); return false }
  }
  return true
}

async function main() {
  const files = [
    ['191', 'supabase/migrations/191_kitchen_date_bkk.sql'],
    ['192', 'supabase/migrations/192_crm_automation_and_sales_stats.sql'],
    ['193', 'supabase/migrations/193_customers_crm_consent.sql'],
  ]
  for (const [ver, file] of files) {
    const ok = await runFile(file)
    if (!ok) { console.log('STOPPED_AT_' + ver); process.exit(10) }
  }

  // record history (190 already applied earlier but unrecorded — record it too)
  const rec = await sql("INSERT INTO supabase_migrations.schema_migrations (version, statements, name) SELECT v, NULL, CASE v WHEN '190' THEN '190_bkk_promo_gates_core.sql' WHEN '191' THEN '191_kitchen_date_bkk.sql' WHEN '192' THEN '192_crm_automation_and_sales_stats.sql' ELSE '193_customers_crm_consent.sql' END FROM (VALUES ('190'), ('191'), ('192'), ('193')) AS t(v) WHERE NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations m WHERE m.version = t.v) RETURNING version")
  console.log('HISTORY_RECORD', rec.status, rec.text.slice(0, 500))

  console.log('=== VERIFY ===')
  const v = await sql("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'birthday') AS birthday, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'crm_consent') AS crm_consent, EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'menu_sales_stats') AS sales_stats, EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'crm_segment_summary') AS segments, (SELECT prosrc LIKE '%AT TIME ZONE ''Asia/Bangkok''%' FROM pg_proc WHERE proname = 'create_production_batch') AS kitchen_bkk, (SELECT prosrc LIKE '%crm_consent%' FROM pg_proc WHERE proname = 'crm_winback_scan') AS winback_gated")
  console.log('VERIFY', v.status, v.text.slice(0, 700))
  const hist = await sql("SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '190' ORDER BY version")
  console.log('HISTORY', hist.status, hist.text.slice(0, 500))
  console.log('APPLY_DONE')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })
