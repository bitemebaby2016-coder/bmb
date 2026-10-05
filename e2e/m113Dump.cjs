// ============================================================
// M113 — dump production defs of round-instantiation functions
// ใช้ API pattern เดียวกับ e2e/w14BuildMigration112.cjs
// ผล: e2e/m113_current_def.sql (ground truth ก่อน build migration 113)
// ============================================================
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const API = 'https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query'

async function q(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const json = await res.json()
  if (!res.ok || json.message) throw new Error('SQL failed: ' + (json.message || res.statusText))
  return json
}

async function main() {
  const rows = await q(
    `select p.proname, pg_get_functiondef(p.oid) def
       from pg_proc p
      where p.proname in ('ensure_rounds_for_date')
        and p.pronamespace = 'public'::regnamespace
      order by p.proname`
  )
  const out = rows.map((r) => `-- ===== ${r.proname} =====\n${r.def}`).join('\n\n')
  const outPath = path.join(ROOT, 'e2e', 'm113_current_def.sql')
  fs.writeFileSync(outPath, out, 'utf8')
  console.log('WROTE ' + outPath + ' (' + out.split('\n').length + ' lines)')
  console.log(out)
}

main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
