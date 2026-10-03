// G7-S4-R2-I — cleanup ONLY exact synthetic identifiers (no broad DELETE)
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
  return r.ok ? t.slice(0, 400) : 'ERR ' + r.status + ' ' + t.slice(0, 150)
}
const ref1 = 'g7-s4r2-20261003T090000Z-q7w2n4'
const ref2 = 'g7-s4r2-20261003T091500Z-m3k8v6'
;(async () => {
  console.log('DEL_CA ' + await q("delete from content_approvals where id='g7cap-" + ref1 + "' or id='g7cap-" + ref2 + "'"))
  console.log('DEL_AUDIT_G7 ' + await q("delete from audit_logs where id='g7-draft-" + ref1 + "' or id='g7-draft-" + ref2 + "'"))
  console.log('DEL_AUDIT_REVIEW ' + await q("delete from audit_logs where action='content_review' and entity_id='g7cap-" + ref1 + "' or action='content_review' and entity_id='g7cap-" + ref2 + "'"))
  console.log('AFTER_CA_TOTAL ' + await q('select count(*) as n from content_approvals'))
  console.log('AFTER_G7CAP ' + await q("select count(*) as n from content_approvals where id like 'g7cap-%'"))
  console.log('AFTER_G7DRAFT ' + await q("select count(*) as n from audit_logs where id like 'g7-draft-%'"))
  console.log('AFTER_G7DRAFT_ACTION ' + await q("select count(*) as n from audit_logs where action='g7.draft'"))
  console.log('AFTER_CONTENT_REVIEW ' + await q("select count(*) as n from audit_logs where action='content_review'"))
})().catch((e) => { console.error('FATAL ' + String(e).slice(0, 200)); process.exit(1) })