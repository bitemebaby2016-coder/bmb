// R9 repro probe (Owner defect 2026-10-27): "การสร้างออเดอร์ล้มเหลว" ทั้ง 3 โหมด
// (พรีออเดอร์ / พรี+แซมเดย์ / แซมเดย์) — runs the CLIENT RPC path
// `create_order_with_items_i` (with p_client_submit_key) inside BEGIN..ROLLBACK
// against PRODUCTION via the Management API — ZERO persisted data
// (same harness as r5cReproMixedToday). Run from the repo root:
//   node e2e/r9OrderRepro.cjs
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const q = async (query) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  return r.text()
}
;(async () => {
  console.log('== FACTS (read-only) ==')
  console.log('NOW=' + await q("select to_char(now() at time zone 'Asia/Bangkok','YYYY-MM-DD HH24:MI:SS') t"))
  console.log('== SCENARIO (BEGIN..ROLLBACK — zero persisted) ==')
  console.log('SCENARIO=' + await q(fs.readFileSync(path.join(__dirname, 'r9OrderRepro.sql'), 'utf8')))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
