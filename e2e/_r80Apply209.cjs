'use strict'
// _r80Apply209 — apply migration 209 (R80 Floating Ad: is_floating_ad on products + marketing_posts)
// เข้า production ผ่าน Supabase Management API (pattern เดียวกับ r11Apply163/r61Apply183)
// Owner อนุมัติ 2026-11-20: "อนุมัติแอพพลายมิเกรชั่นที่ขาดอยู๋รวม209 สู่โปรดักชั่น"
//
// พิสูจน์ก่อนหน้า (READ-ONLY · e2e/_r80_deploy_probe.json + _r80_probe_207.json):
//   - 209 = ยังไม่ apply จริง (products/marketing_posts ยังไม่มี is_floating_ad) → APPLY
//   - 186/205/206/207/208 = apply แล้วจริงตาม schema (แต่ไม่เคย record) → RECORD ONLY
//     · 186: promotion_apply_rules ใช้ Asia/Bangkok ✓ (probe m186_bkk=bkk)
//     · 205: cancel_order_as_customer + social_timeline_for_web = 2/2 ✓
//     · 206: bucket Bite_Mascot public ✓ (probe=1 · evidence _r206_apply.json)
//     · 207: my_deliveries v3 (scheduled_date) ✓ (probe has_sched=true — args ใช้ "timestamp with time zone" เต็ม)
//     · 208: preorder_vote_cast + preorder_vote_status = 2/2 ✓ (Owner live-verified 2026-11-19)
// ไม่พิมพ์ค่า token ลง log · evidence: e2e/_r80_apply209_result.json
const fs = require('fs')
const path = require('path')

const ROOT = 'D:/A PROJECT/Bite Me Baby'
const PROJECT_REF = 'ivkdfognyiwjcmrhcnwz'
const SQL_FILE = 'supabase/migrations/209_add_floating_ad_flags.sql'
const OUT = path.join(ROOT, 'e2e', '_r80_apply209_result.json')

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

const results = []
async function q(token, label, sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': 'bmb-apply-r80' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await r.text()
  results.push({ stage: label, status: r.status, body: text.slice(0, 800) })
  return text
}

;(async () => {
  const token = readToken()
  if (!token) { console.log('FATAL token not found'); process.exit(1) }
  const out = { at: new Date().toISOString(), file: SQL_FILE, project: PROJECT_REF, owner_approved: '2026-11-20 apply missing migrations incl. 209' }

  // ---- stage 1: precheck (209 ต้องยังไม่มี · 207/208 ต้องมี = ยืนยันข้อสรุป probe ก่อนยิง) ----
  out.precheck = {
    colsBefore: await q(token, 'cols-before',
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name='is_floating_ad' AND table_name IN ('products','marketing_posts')"),
    fnsSanity: await q(token, 'fns-sanity',
      "SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('my_deliveries','preorder_vote_cast','cancel_order_as_customer','social_timeline_for_web','promotion_apply_rules')"),
  }

  // ---- stage 2: apply 209 (ไฟล์เดียวกับ repo · additive: ADD COLUMN IF NOT EXISTS + 2 partial indexes + comments) ----
  const sql = fs.readFileSync(path.join(ROOT, SQL_FILE), 'utf8')
  out.apply = { raw: (await q(token, 'apply-209', sql)).slice(0, 500) }

  // ---- stage 3: verify (columns 2/2 + indexes 2 + comment มี) ----
  out.verify = {
    colsAfter: await q(token, 'cols-after',
      "SELECT table_name, column_name, column_default, is_nullable FROM information_schema.columns WHERE table_schema='public' AND column_name='is_floating_ad' AND table_name IN ('products','marketing_posts') ORDER BY table_name"),
    indexes: await q(token, 'indexes',
      "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_products_is_floating_ad','idx_marketing_posts_is_floating_ad') ORDER BY indexname"),
    comment: await q(token, 'comment',
      "SELECT obj_description('public.products'::regclass, 'pg_class') IS NOT NULL AS products_commented"),
  }

  // ---- stage 4: record ledger — 209 (apply วันนี้) + 186/205/206/207/208 (apply ค้างไม่ record ตามหลักฐาน) ----
  out.record = {
    ins209: await q(token, 'record-209', "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('209','209_add_floating_ad_flags','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    insBackfill: await q(token, 'record-backfill', "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('186','186_promotion_date_bkk','{}'::text[]), ('205','205_social_order_actions','{}'::text[]), ('206','206_mascot_bucket_selfservice','{}'::text[]), ('207','207_rider_history_dates','{}'::text[]), ('208','208_preorder_vote_cast','{}'::text[]) ON CONFLICT (version) DO NOTHING"),
    reload: await q(token, 'notify-pgrst', "NOTIFY pgrst, 'reload schema'"),
    ledgerTopAfter: await q(token, 'ledger-top', 'SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 8'),
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))

  // ---- assertions ----
  const parse = (t) => { try { return JSON.parse(t) } catch (e) { return null } }
  const cols = parse(out.verify.colsAfter) || []
  const idx = parse(out.verify.indexes) || []
  const led = parse(out.record.ledgerTopAfter) || []
  const colsOk = cols.length === 2
  const idxOk = idx.length === 2
  const led209 = led.some((x) => x.version === '209')
  const ledBackfill = ['186', '205', '206', '207', '208'].every((v) => led.some((x) => x.version === v))
  out.ALL_OK = colsOk && idxOk && led209 && ledBackfill
  console.log(JSON.stringify({ ALL_OK: out.ALL_OK, cols: cols.length, indexes: idx.length, ledger_top: led.map((x) => x.version).join(',') }))
  process.exit(out.ALL_OK ? 0 : 1)
})().catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ ok: false, error: String(e && e.message || e), results }, null, 2))
  console.log('FATAL ' + String(e && e.message || e))
  process.exit(1)
})