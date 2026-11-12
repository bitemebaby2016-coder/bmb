// R93 probe (READ-ONLY) — คิวอนุมัติว่างทั้งที่ overview นับ pending_approval = 1
// ① content_approvals: มีแถวจริงไหม + ล่าสุด ② RLS policy ③ marketing_posts ผูก approval_id
// ④ RPC submit_content_for_approval / review_content มีจริงไหม
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
const TOKENS = [env.SUPABASE_ACCESS_TOKEN, env.bmb_PAT_SUPABASE_ACCESS_TOKEN].filter(Boolean)
if (TOKENS.length === 0) { console.log('NO_ACCESS_TOKEN'); process.exit(1) }
async function sql(query) {
  for (const tok of TOKENS) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
      method: 'POST',
      headers: { apikey: tok, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const text = await r.text()
    if (r.status === 200 || r.status === 201) return { ok: true, data: JSON.parse(text) }
    if (r.status === 401 || r.status === 403) continue
    return { ok: false, status: r.status, text: text.slice(0, 400) }
  }
  return { ok: false, status: 0, text: 'all tokens rejected' }
}
;(async () => {
  const cnt = await sql("SELECT COALESCE(status,'(null)') AS status, COUNT(*)::int AS n FROM public.content_approvals GROUP BY 1 ORDER BY 2 DESC")
  console.log('CA_COUNTS ' + JSON.stringify(cnt.ok ? cnt.data : cnt))
  const rows = await sql("SELECT id, content_type, LEFT(title,40) AS title, status, LEFT(COALESCE(created_by,''),12) AS by_, created_at FROM public.content_approvals ORDER BY created_at DESC LIMIT 10")
  if (rows.ok) for (const r of rows.data) console.log('CA ' + r.created_at + ' | ' + r.content_type + ' | ' + r.status + ' | ' + r.title + ' | by=' + r.by_ + ' | id=' + r.id)
  else console.log('CA_ERR ' + JSON.stringify(rows))
  const pol = await sql("SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='content_approvals'")
  if (pol.ok) for (const p of pol.data) console.log('POLICY ' + p.policyname + ' | ' + p.cmd + ' | USING=' + String(p.qual).slice(0, 220) + ' | CHECK=' + String(p.with_check).slice(0, 120))
  else console.log('POLICY_ERR ' + JSON.stringify(pol))
  const rls = await sql("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='content_approvals' AND relnamespace='public'::regnamespace")
  console.log('RLS_FLAGS ' + JSON.stringify(rls.ok ? rls.data : rls))
  const posts = await sql("SELECT id, LEFT(title,36) AS title, status, approval_id, scheduled_for FROM public.marketing_posts ORDER BY created_at DESC LIMIT 12")
  if (posts.ok) for (const p of posts.data) console.log('POST ' + p.id.slice(0, 22) + ' | ' + p.status + ' | ap=' + (p.approval_id || 'NULL') + ' | sched=' + (p.scheduled_for || '-') + ' | ' + p.title)
  else console.log('POST_ERR ' + JSON.stringify(posts))
  const rpc = await sql("SELECT proname FROM pg_proc WHERE proname IN ('submit_content_for_approval','review_content')")
  console.log('RPC ' + JSON.stringify(rpc.ok ? rpc.data.map((r) => r.proname) : rpc))
  console.log('R93_PROBE_DONE')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
