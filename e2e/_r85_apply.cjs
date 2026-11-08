// R85 APPLY (Owner-approved 2026-11-08): run migrations 194 → 195 on PRODUCTION
// via Supabase Management API POST /v1/projects/{ref}/database/query
// (same effect as running the files in the SQL Editor, per docs/04_DEPLOYMENT_RUNBOOK.md:36)
// - splits each file into statements dollar-quote aware ($$ ... $$ kept intact)
// - stops at the FIRST failing statement and prints its index + head + server error
// - NEVER prints secret values (PAT read from .env.local, used in-memory only)
'use strict'
const fs = require('fs')
const REF = 'ivkdfognyiwjcmrhcnwz'

let tok = ''
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m) tok = m[1]
}
if (!tok) { console.error('STOP: no SUPABASE_ACCESS_TOKEN in .env.local'); process.exit(2) }

async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, text: await r.text() }
}

/** Split SQL into statements; ';' only counts OUTSIDE $$ ... $$ blocks. */
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
}

async function runFile(file) {
  const stmts = splitSql(fs.readFileSync(file, 'utf8'))
  console.log('=== ' + file + ' — ' + stmts.length + ' statement(s) ===')
  for (let n = 0; n < stmts.length; n++) {
    const r = await sql(stmts[n])
    const ok = r.status >= 200 && r.status < 300
    console.log('  stmt ' + (n + 1) + '/' + stmts.length + ' HTTP ' + r.status +
      (ok ? ' OK' : ' FAIL') + ' | ' + stmts[n].replace(/\s+/g, ' ').slice(0, 70))
    if (!ok) {
      console.log('  SERVER_ERROR: ' + r.text.slice(0, 600))
      return false
    }
  }
  return true
}

async function main() {
  const a = await runFile('supabase/migrations/194_payment_status_void_enum.sql')
  if (!a) { console.log('STOPPED_AFTER_194'); process.exit(10) }
  const b = await runFile('supabase/migrations/195_close_payment_on_cancel.sql')
  if (!b) { console.log('STOPPED_AFTER_195'); process.exit(11) }

  console.log('=== VERIFY ===')
  const v1 = await sql("SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'payment_status' ORDER BY e.enumsortorder")
  console.log('ENUM_NOW', v1.status, v1.text.slice(0, 500))
  const v2 = await sql("SELECT order_number, status, payment_status FROM public.orders WHERE order_number IN ('BMB-20261108-484','BMB-20261108-850','BMB-20261108-613','BMB-20261108-767') ORDER BY order_number")
  console.log('FOUR_TEST_ORDERS', v2.status, v2.text.slice(0, 900))
  const v3 = await sql("SELECT count(*)::int AS still_stale FROM public.orders WHERE status = 'cancelled' AND payment_status = 'pending'")
  console.log('STALE_AFTER', v3.status, v3.text.slice(0, 300))
  const v4 = await sql("SELECT count(*)::int AS voided FROM public.orders WHERE payment_status = 'void'")
  console.log('VOID_TOTAL', v4.status, v4.text.slice(0, 300))
  const v5 = await sql("SELECT (position('void' in prosrc) > 0) AS has_void_close, (position('SET status = ''cancelled''' in prosrc) > 0) AS has_cancel_update FROM pg_proc WHERE proname = 'cancel_order'")
  console.log('FN_DEF', v5.status, v5.text.slice(0, 500))
  console.log('APPLY_DONE')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })
