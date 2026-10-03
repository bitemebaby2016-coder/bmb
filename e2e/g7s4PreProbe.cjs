// G7-S4-B/H pre/post-mutation probe (READ-ONLY) — synthetic ids absent/present + baseline counts
const fs = require('node:fs')
const T = fs.readFileSync('.env.local', 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)[1].trim()
const ref = process.argv[2] || ''
if (!ref) { console.log('USAGE node e2e/g7s4PreProbe.cjs <draft_ref>'); process.exit(1) }
const draftId = 'g7cap-' + ref
const traceId = 'g7-draft-' + ref
const q = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(30000),
  })
  const t = await r.text()
  return r.ok ? t.slice(0, 400) : 'ERR ' + r.status + ' ' + t.slice(0, 120)
}
;(async () => {
  console.log('REF ' + ref)
  console.log('CA_SYNTHETIC ' + await q("select count(*) as n from content_approvals where id='" + draftId + "'"))
  console.log('TRACE_SYNTHETIC ' + await q("select count(*) as n from audit_logs where id='" + traceId + "'"))
  console.log('CA_TOTAL ' + await q('select count(*) as n from content_approvals'))
  console.log('AL_G7DRAFT_TOTAL ' + await q("select count(*) as n from audit_logs where action='g7.draft'"))
  console.log('BRAND_DEFAULT ' + await q('select id,tenant_id from brands where is_default=true limit 1'))
})().catch((e) => { console.error('FATAL ' + String(e).slice(0, 200)); process.exit(1) })
