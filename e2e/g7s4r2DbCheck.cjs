// G7-S4-R2-F — DB runtime proof (READ-ONLY). Temp helper for S4-R2; no secrets printed.
const fs = require('fs')
const T = fs.readFileSync('.env.local', 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)[1].trim()
const ref = process.argv[2] || ''
if (!ref) { console.log('USAGE node e2e/g7s4r2DbCheck.cjs <draft_ref>'); process.exit(1) }
const q = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(30000),
  })
  const t = await r.text()
  return r.ok ? t.slice(0, 600) : 'ERR ' + r.status + ' ' + t.slice(0, 150)
}
;(async () => {
  console.log('CA_ROW ' + await q("select id,content_type,status,created_by,left(title,80) as title from content_approvals where id='g7cap-" + ref + "'"))
  console.log('CA_TOTAL ' + await q('select count(*) as n from content_approvals'))
  console.log('G7_CA_TOTAL ' + await q("select count(*) as n from content_approvals where id like 'g7cap-%'"))
  console.log('AUDIT_ROW ' + await q("select id,action,entity_type,entity_id from audit_logs where id='g7-draft-" + ref + "'"))
  console.log('AUDIT_META ' + await q("select metadata from audit_logs where id='g7-draft-" + ref + "'"))
  console.log('AL_G7DRAFT_TOTAL ' + await q("select count(*) as n from audit_logs where action='g7.draft'"))
})().catch((e) => { console.error('FATAL ' + String(e).slice(0, 200)); process.exit(1) })