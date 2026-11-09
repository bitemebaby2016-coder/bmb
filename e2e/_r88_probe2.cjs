// R88 PROBE รอบ 2 — PRODUCTION **READ-ONLY** เท่านั้น (ต่อจาก _r88_probe.cjs)
// รอบ 1 พบ: admin_portfolio_items=0 · ตาราง portfolio ไม่มีจริง · reviews ไม่มี photo_url
// รอบ 2: นับแถว reviews จริง + คอลัมน์ reviews + policy เต็ม + 196 ใน history + ระบบแต้ม (D6e)
'use strict'
const fs = require('fs')
const REF = 'ivkdfognyiwjcmrhcnwz'
let tok = ''
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$/)
  if (m) tok = m[1]
}
if (!tok) { console.error('STOP: no SUPABASE_ACCESS_TOKEN'); process.exit(2) }

async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, text: await r.text() }
}
async function q(label, query) {
  const r = await sql(query)
  console.log('== ' + label + ' [' + r.status + ']')
  console.log(r.status === 200 ? r.text : r.text.slice(0, 400))
}

async function main() {
  await q('REVIEWS_COUNT', "SELECT count(*)::int AS n FROM reviews")
  await q('REVIEWS_COLS', "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' ORDER BY ordinal_position")
  await q('REVIEWS_SAMPLE', "SELECT * FROM reviews ORDER BY created_at DESC LIMIT 3")
  await q('REVIEWS_POLICY_SELECT', "SELECT policyname, cmd, roles::text AS roles, qual FROM pg_policies WHERE schemaname='public' AND table_name='reviews' AND cmd='SELECT'")
  await q('HIST_196', "SELECT version FROM supabase_migrations.schema_migrations WHERE version IN ('196','191') ORDER BY version")
  await q('MIG_FILES_196', "SELECT 1") // placeholder no-op read-only — เช็กไฟล์ 196 ในเครื่องแทน
  // --- ระบบแต้ม/รางวัล (D6e: สั่งเมนู/ใช้โปรโมชั่น = ได้แต้มจริงไหม) ---
  await q('POINTS_TABLES', "SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE '%point%' OR tablename LIKE '%reward%' OR tablename LIKE '%loyalty%') ORDER BY tablename")
  await q('POINTS_FUNCS', "SELECT proname FROM pg_proc WHERE proname ILIKE '%point%' OR proname ILIKE '%reward%' ORDER BY proname")
  await q('LOYALTY_COLS', "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='loyalty_accounts' ORDER BY ordinal_position")
  await q('LEDGER_COUNT', "SELECT count(*)::int AS n FROM points_ledger")
  await q('CATALOG_COUNT', "SELECT count(*)::int AS n FROM rewards_catalog")
  await q('LOYALTY_ROWS', "SELECT count(*)::int AS n FROM loyalty_accounts")
  console.log('PROBE2_DONE_READONLY')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })
