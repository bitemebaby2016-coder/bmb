// R85 READ-ONLY probe — flags/names only, NEVER prints secret values.
'use strict'
const fs = require('fs')
const REF = 'ivkdfognyiwjcmrhcnwz'

let tok = ''
try {
  for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
    if (m) tok = m[1]
  }
} catch (e) { console.log('ENV_LOCAL: missing') }
console.log('PAT_FOUND:', tok ? 'yes' : 'no')

async function api(method, path, body) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + path, {
    method,
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: r.status, text: await r.text() }
}
async function sql(query) {
  const r = await api('POST', '/database/query', { query })
  return { status: r.status, text: r.text }
}

async function main() {
  if (!tok) { console.log('STOP: no PAT in .env.local'); process.exit(2) }

  const sec = await api('GET', '/secrets')
  console.log('SECRETS_HTTP:', sec.status)
  if (sec.status === 200) {
    const names = (JSON.parse(sec.text) || []).map(s => s.name)
    console.log('SECRET_NAMES_INCLUDE_BMB_DB_PASSWORD:', names.includes('BMB_DB_PASSWORD'))
    console.log('SECRET_NAMES_INCLUDE_SUPABASE_DB_URL:', names.includes('SUPABASE_DB_URL'))
  }

  const q1 = await sql("SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'payment_status' ORDER BY e.enumsortorder")
  console.log('ENUM_HTTP', q1.status, q1.text.slice(0, 500))
  const q2 = await sql("SELECT count(*)::int AS stale FROM public.orders WHERE status = 'cancelled' AND payment_status = 'pending'")
  console.log('STALE_PENDING', q2.status, q2.text.slice(0, 300))
  const q3 = await sql("SELECT count(*)::int AS n, max(version) AS last FROM supabase_migrations.schema_migrations")
  console.log('MIG_HISTORY', q3.status, q3.text.slice(0, 300))
}
main().catch(e => { console.error('ERR', String(e).slice(0, 300)); process.exit(1) })
