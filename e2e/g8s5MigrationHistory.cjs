// G8-S5 diagnostic - migration_history direct in production, read-only
const fs = require('fs')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync('.env.local', 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
;(async () => {
  console.log('MIG_ROWS_GT_103=' + await q("select coalesce(name, 'NULL') name, coalesce(version, 'NULL') version from supabase_migrations.schema_migrations where version > '2026101000' order by version limit 30"))
  console.log('MIG_ROWS_DESC=' + await q("select coalesce(name, 'NULL') name, coalesce(version, 'NULL') version from supabase_migrations.schema_migrations order by version desc limit 30"))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))