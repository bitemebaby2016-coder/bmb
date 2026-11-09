// R88 PROBE (step 1 ของแผน) — PRODUCTION **READ-ONLY** เท่านั้น
// นับแถว + grant/RLS policy ของ 3 ตาราง reviews / admin_portfolio_items / portfolio
// ตอบให้ได้ว่า "ว่างจริง" หรือ "มีแต่โดน RLS บล็อก" → แก้คนละทาง (ห้าม seed ข้อมูลปลอม)
// วิธี = Management API เหมือน e2e/_r87_apply197.cjs (PAT จาก .env.local) · ไม่มี INSERT/UPDATE/DELETE
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
  // 1) จำนวนแถวจริง (role ของ Management API = superuser → เห็นผ่าน RLS = ข้อมูล "มีจริง" แค่ไหน)
  await q('COUNTS', "SELECT 'reviews' AS t, count(*)::int AS n FROM reviews UNION ALL SELECT 'admin_portfolio_items', count(*)::int FROM admin_portfolio_items UNION ALL SELECT 'portfolio', count(*)::int FROM portfolio")
  // 2) ตัวอย่างแถวreviews (ล่าสุด 5) — ดูว่ามีรีวิวจริง/รูปไหม
  await q('REVIEWS_SAMPLE', "SELECT id, product_id, customer_name, rating, left(coalesce(comment,''),60) AS comment, (photo_url IS NOT NULL) AS has_photo, created_at FROM reviews ORDER BY created_at DESC LIMIT 5")
  // 3) Admin Portfolio (M094) — active กี่แถว + ตัวอย่าง
  await q('ADMIN_PORTFOLIO_ACTIVE', "SELECT count(*)::int AS active_total FROM admin_portfolio_items WHERE is_active")
  await q('ADMIN_PORTFOLIO_SAMPLE', "SELECT id, title, left(coalesce(image_url,''),80) AS image_url, is_active, display_order FROM admin_portfolio_items ORDER BY display_order LIMIT 5")
  // 4) portfolio (m093) — ตารางเก่า (ถ้าไม่มีตาราง = ตอบ 40P01 ก็ถือว่าจบ ไม่เขียนเพิ่ม)
  await q('LEGACY_PORTFOLIO_SAMPLE', "SELECT * FROM portfolio ORDER BY 1 DESC LIMIT 5")
  // 5) grants (relacl) — anon/authenticated มี SELECT ไหม
  await q('GRANTS', "SELECT c.relname, c.relacl::text AS relacl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('reviews','admin_portfolio_items','portfolio')")
  // 6) RLS เปิดอยู่ไหม + policy ของ 3 ตาราง
  await q('RLS', "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('reviews','admin_portfolio_items','portfolio')")
  await q('POLICIES', "SELECT tablename, policyname, cmd, roles::text AS roles, qual FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('reviews','admin_portfolio_items','portfolio')")
  // 7) RPC รีวิว (m099) ยังอยู่ไหม + ความหมายเมต้า
  await q('RPC', "SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('submit_verified_review','get_verified_reviews_batch') ORDER BY proname")
  // 8) migration history ล่าสุด (ยืนยัน 198 บันทึกแล้ว)
  await q('HISTORY', "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 6")
  console.log('PROBE_DONE_READONLY')
}
main().catch(e => { console.error('ERR', String(e).slice(0, 400)); process.exit(1) })
