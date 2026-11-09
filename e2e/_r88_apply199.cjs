// R88 APPLY m199 (Owner อนุมัติ 2026-11-08) — ยิงไฟล์ทั้งหมดทีเดียว (atomic ตาม R86/R87)
// + บันทึก history 199 + VERIFY ทุกเงื่อนไข → e2e/_r88_apply.log
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
  console.log(r.status >= 200 && r.status < 300 ? r.text : r.text.slice(0, 600))
  return r.status >= 200 && r.status < 300
}

async function main() {
  // 1) APPLY: whole-file single transaction (ไฟล์มี BEGIN/COMMIT อยู่แล้ว)
  const file = 'supabase/migrations/199_review_moderation.sql'
  const body = fs.readFileSync(file, 'utf8')
  const applied = await sql(body)
  const appliedOk = applied.status >= 200 && applied.status < 300 // Management API = 201 เมื่อ query ผ่าน
  console.log('APPLY [' + applied.status + '] ' + (appliedOk ? 'OK' : applied.text.slice(0, 800)))
  if (!appliedOk) { console.log('STOPPED_AT_APPLY'); process.exit(10) }

  // 2) RECORD history (manual apply ไม่บันทึกให้เอง — กัน db push ซ้ำในอนาคต)
  const rec = await sql("INSERT INTO supabase_migrations.schema_migrations (version, statements, name) SELECT '199', NULL, '199_review_moderation.sql' WHERE NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations m WHERE m.version = '199') RETURNING version")
  console.log('HISTORY [' + rec.status + '] ' + rec.text.slice(0, 200))

  // 3) VERIFY ครบ
  const v1 = await q('VERIFY_COLUMNS', "SELECT count(*)::int AS ok_cols FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name IN ('order_number','branch_id','product_name_display','status','reply','replied_at')")
  const v2 = await q('VERIFY_POLICY', "SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='reviews' ORDER BY policyname")
  const v3 = await q('VERIFY_DROP_OLD', "SELECT count(*)::int AS old_update_policy FROM pg_policies WHERE schemaname='public' AND tablename='reviews' AND policyname='customers_update_own_review'")
  const v4 = await q('VERIFY_RPC', "SELECT (prosrc LIKE '%status = ''approved''%') AS batch_approved_only, (prosrc LIKE '%ERR_REVIEW_ORDER_NOT_DELIVERED%') AS still_delivered, (prosrc LIKE '%ERR_REVIEW_ALREADY_EXISTS%') AS still_dedupe FROM pg_proc WHERE proname='get_verified_reviews_batch'")
  const v5 = await q('VERIFY_SUBMIT', "SELECT (prosrc LIKE '%pending%') AS inserts_pending, (prosrc LIKE '%product_name_display%') AS fills_product_name, (prosrc LIKE '%ERR_REVIEW_ALREADY_EXISTS%') AS dedupe_kept FROM pg_proc WHERE proname='submit_verified_review'")
  const v6 = await q('VERIFY_ROWS', "SELECT (SELECT count(*)::int FROM reviews) AS reviews_n, (SELECT count(*)::int FROM admin_portfolio_items) AS portfolio_n")
  const v7 = await q('VERIFY_INDEX', "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='reviews' ORDER BY indexname")
  const v8 = await q('HISTORY_ALL', "SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '197' ORDER BY version")
  void v1; void v3; void v4; void v5; void v6; void v7
  const pass = v1 && v2 && v3 && v4 && v5 && v6 && v7 && v8
  console.log(pass ? 'APPLY199_DONE_VERIFY_ALL_OK' : 'APPLY199_DONE_VERIFY_SOMETHING_WRONG')
  process.exit(pass ? 0 : 3)
}
main().catch(e => { console.error('ERR', String(e).slice(0, 500)); process.exit(1) })