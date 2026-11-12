// R93 probe 3 (READ-ONLY) — RLS ของ marketing_posts (เตรียมปุ่มลบ/แก้ไขโพสต์รออนุมัติ)
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const env = {}
for (const f of ['.env.local', '.env']) {
  try {
    for (const l of fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Za-z0-9_]+)=(.*)$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2].trim()
    }
  } catch { /* skip */ }
}
const tok = env.SUPABASE_ACCESS_TOKEN || env.bmb_PAT_SUPABASE_ACCESS_TOKEN
if (!tok) { console.log('NO_ACCESS_TOKEN'); process.exit(1) }
async function sql(q) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { apikey: tok, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const t = await r.text()
  return { status: r.status, body: t.slice(0, 1200) }
}
;(async () => {
  const pol = await sql("SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='marketing_posts'")
  console.log('POLICIES ' + pol.status + ' ' + pol.body)
  const rls = await sql("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='marketing_posts' AND relnamespace='public'::regnamespace")
  console.log('RLS_FLAGS ' + rls.status + ' ' + rls.body)
  console.log('R93_PROBE3_DONE')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
