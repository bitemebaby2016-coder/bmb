// e30: หาว่า approval ของโพส scheduled เป็น content_type อะไร (ต้นเหตุ ERR_NOT_A_POST)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
;(async () => {
  console.log('LINK=' + (await q("SELECT mp.id AS post, mp.approval_id, ca.content_type, ca.status AS ca_status, left(ca.title, 50) AS title, ca.created_at::text AS ca_created FROM public.marketing_posts mp LEFT JOIN public.content_approvals ca ON ca.id = mp.approval_id ORDER BY mp.updated_at DESC LIMIT 5")))
  console.log('TYPES=' + (await q('SELECT content_type, status, count(*) AS n FROM public.content_approvals GROUP BY 1,2 ORDER BY 1,2')))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))