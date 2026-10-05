// fcFix114 — hotfix: make_interval(hours=>numeric) ไม่มีใน PG → numeric * interval
// (probe fcProbe6 จับ runtime regression ของ PRE_ORDER insert)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\w+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
async function q(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const j = await r.json()
  if (j.message) throw new Error(j.message)
  return j
}
function fix(def, name) {
  const anchor = `+ (v_start - (v_cutoff_hours * interval '1 hour'))`
  const n = def.split(anchor).length - 1
  if (n !== 1) throw new Error(`${name}: anchor x${n}`)
  return def.replace(anchor, `+ v_start - (v_cutoff_hours * interval '1 hour')`)
}
async function main() {
  const w = (await q(`select pg_get_functiondef('public.enforce_pre_order_window'::regproc) d`))[0].d.replace(/\r\n/g, '\n')
  const c = (await q(`select pg_get_functiondef('public.enforce_pre_order_cancel_window'::regproc) d`))[0].d.replace(/\r\n/g, '\n')
  const w2 = fix(w, 'window')
  const c2 = fix(c, 'cancel')
  const res = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `BEGIN;\n${w2};\n${c2};\nCOMMIT;` }),
  })
  const j = await res.json()
  if (!res.ok || j.message) { console.error('FIX114_FAIL: ' + JSON.stringify(j).slice(0, 800)); process.exit(1) }
  console.log('FIX114_OK')
}
main().catch((e) => { console.error('FIX114_FAIL: ' + e.message); process.exit(1) })