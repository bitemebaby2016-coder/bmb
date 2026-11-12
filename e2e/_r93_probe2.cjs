// R93 probe 2 (READ-ONLY) — โครงคอลัมน์ content_approvals + จำลอง select ของ client (เหตุว่างเงียบ)
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
  return { status: r.status, body: t.slice(0, 700) }
}
;(async () => {
  const cols = await sql("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='content_approvals' ORDER BY ordinal_position")
  console.log('COLS ' + cols.status + ' ' + cols.body)
  // จำลอง query เดียวกับ listContentApprovals (select คอลัมน์เดิม — ถ้าพัง = ต้นตอกล่องว่างเงียบ)
  const sim = await sql("SELECT id,content_type,title,body,status,created_by,created_at,image_url,mascot,reviewer_id,reviewed_at,review_note FROM public.content_approvals ORDER BY created_at DESC LIMIT 5")
  console.log('SIM_CLIENT_SELECT ' + sim.status + ' ' + sim.body)
  const pend = await sql("SELECT id, LEFT(title,44) AS title, status, created_by FROM public.content_approvals WHERE status='pending' ORDER BY created_at DESC")
  console.log('PENDING ' + pend.status + ' ' + pend.body)
  // is_admin() จริงใน definition (เช็คว่าอ่านจากตารางไหน)
  const fn = await sql("SELECT pg_get_functiondef('public.is_admin()'::regprocedure) AS def")
  console.log('IS_ADMIN_DEF ' + fn.status + ' ' + String(fn.body).slice(0, 500))
  console.log('R93_PROBE2_DONE')
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
