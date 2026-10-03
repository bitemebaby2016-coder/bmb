// G7-S4-R2-H — post-review state (READ-ONLY)
const fs = require('fs')
const T = fs.readFileSync('.env.local', 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m)[1].trim()
const q = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(30000),
  })
  const t = await r.text()
  return r.ok ? t.slice(0, 500) : 'ERR ' + r.status + ' ' + t.slice(0, 150)
}
;(async () => {
  console.log('CA_STATES ' + await q("select id,status from content_approvals where id like 'g7cap-%' order by id"))
  console.log('PUBLISHED_COUNT ' + await q("select count(*) as published from content_approvals where status='published'"))
  console.log('CONTENT_REVIEW_AUDIT ' + await q("select id,action,entity_id,description from audit_logs where action='content_review' order by created_at desc limit 4"))
  console.log('REVIEWED_BY_SET ' + await q("select count(*) as reviewed from content_approvals where reviewed_by is not null and id like 'g7cap-%'"))
})().catch((e) => { console.error('FATAL ' + String(e).slice(0, 200)); process.exit(1) })