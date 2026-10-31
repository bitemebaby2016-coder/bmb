// R43 — approval-status probe ของแถว published-but-unpushed (READ-ONLY)
// คำถามเดียว: content_approvals ของ 3 แถว B3 = status อะไร? (worker เงียบ-skip เมื่อ != approved)
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
async function q(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 300))
  return JSON.parse(t)
}
;(async () => {
  const rows = await q(`
    SELECT p.id, p.status AS post_status, p.provider_post_id, p.publish_attempts AS att,
           p.error, a.id AS approval_id, a.status AS approval_status, a.content_type
    FROM public.marketing_posts p
    LEFT JOIN public.content_approvals a ON a.id = p.approval_id
    WHERE p.id IN ('mk-mvwegu4b-o482','mk-mvvtvqwv-3zjr','mk-mvvspkna-n6uf','mk-mvvz4n44-c60w')
    ORDER BY p.id`)
  console.log(JSON.stringify(rows, null, 1))
  fs.writeFileSync(path.join(__dirname, 'r43_approval_probe.json'), JSON.stringify({ ran_at: new Date().toISOString(), rows }, null, 2))
})().catch((e) => { console.log('FATAL ' + String(e).slice(0, 400)); process.exitCode = 1 })