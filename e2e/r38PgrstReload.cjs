// R38 — force PostgREST schema cache reload หลัง GRANT/DDL ( Management API ไม่ได้ notify เอง )
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
  console.log('NOTIFY=' + await q("NOTIFY pgrst, 'reload schema'"))
  console.log('GRANT_RECHECK=' + await q("SELECT has_table_privilege('anon', 'public.marketing_posts', 'SELECT') AS sel"))
  console.log('POL_RECHECK=' + await q("SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='marketing_posts' AND roles @> ARRAY['anon']::name[]"))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))