'use strict'
// _r80Probe207 — READ-ONLY ตรวจ signature ทั้งหมดของ my_deliveries บน prod (ตามหลักฐาน ไม่เดา)
const fs = require('fs')
const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = 'e2e/_r80_probe_207.json'
function readToken() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue
    const txt = fs.readFileSync(f, 'utf8')
    const m2 = txt.match(/^\s*bmb_PAT_SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m2) return m2[1].replace(/^["']|["']$/g, '').trim()
    const m1 = txt.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m)
    if (m1) return m1[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}
const SQL = `select coalesce(json_agg(t), '[]'::json) as sig from (
  select pg_get_function_identity_arguments(p.oid) as args,
         position('scheduled_date' in pg_get_functiondef(p.oid)) > 0 as has_sched
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='my_deliveries') t;`
;(async () => {
  const token = readToken()
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-probe-r80-207' },
    body: JSON.stringify({ query: SQL }),
  })
  const body = await r.json().catch(() => null)
  const out = { at: new Date().toISOString(), http: r.status, body }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  const sig = Array.isArray(body) && body[0] && body[0].sig ? body[0].sig : []
  for (const s of sig) console.log('SIG: ' + s.args + ' | has_sched=' + s.has_sched)
  console.log('COUNT=' + sig.length)
})().catch((e) => { console.log('ERR ' + String(e && e.message || e)) })