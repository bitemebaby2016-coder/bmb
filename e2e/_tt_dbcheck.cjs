// TT DB CHECK (ครั้งเดียว): m199 (reviews.status) apply จริงไหม + ค่าจริงในตาราง + RPC
//   ใช้ Supabase Management API (SQL query) ด้วย SUPABASE_ACCESS_TOKEN — ไม่ต้องมี service key
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
const ANON = env.VITE_SUPABASE_ANON_KEY
const SB_URL = env.VITE_SUPABASE_URL
if (TOKENS.length === 0) { console.log('NO_ACCESS_TOKEN'); process.exit(1) }

async function sql(query) {
  for (const tok of TOKENS) {
    const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
      method: 'POST',
      headers: { apikey: tok, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const text = await r.text()
    if (r.status === 200) return { ok: true, data: JSON.parse(text) }
    if (r.status === 401 || r.status === 403) continue
    return { ok: false, status: r.status, text: text.slice(0, 800) }
  }
  return { ok: false, status: 0, text: 'all tokens rejected' }
}

;(async () => {
  const col = await sql("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='status'")
  console.log('COL_STATUS ' + JSON.stringify(col.ok ? col.data : col))
  const cnt = await sql("SELECT COALESCE(status,'(null)') AS status, COUNT(*)::int AS n FROM public.reviews GROUP BY 1 ORDER BY 2 DESC")
  console.log('STATUS_COUNTS ' + JSON.stringify(cnt.ok ? cnt.data : cnt))
  const ver = await sql("SELECT COALESCE(status,'(null)') AS status, COUNT(*)::int AS n FROM public.reviews WHERE is_verified = true GROUP BY 1")
  console.log('VERIFIED_COUNTS ' + JSON.stringify(ver.ok ? ver.data : ver))
  const rpc = await sql("SELECT proname FROM pg_proc WHERE proname IN ('get_verified_reviews_batch','submit_verified_review')")
  console.log('RPC_EXISTS ' + JSON.stringify(rpc.ok ? rpc.data : rpc))
  const sample = await sql("SELECT id, rating, LEFT(comment,40) AS comment, status, created_at FROM public.reviews WHERE status='approved' ORDER BY created_at DESC LIMIT 3")
  console.log('SAMPLE_APPROVED ' + JSON.stringify(sample.ok ? sample.data : sample))
  if (ANON && SB_URL) {
    const r = await fetch(SB_URL + '/rest/v1/reviews?select=id,status&limit=5', { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } })
    const t = await r.text()
    console.log('ANON_READ http=' + r.status + ' body=' + t.slice(0, 400))
  }
  console.log('TT_DB_CHECK_DONE')
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})