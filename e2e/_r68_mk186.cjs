'use strict'
// _r68_mk186 — สร้าง migration 186 จาก body VERBATIM ของ definition ล่าสุด
// เปลี่ยนเฉพาะบรรทัด start_date/end_date ที่เทียบ CURRENT_DATE (UTC)
//   → (now() AT TIME ZONE 'Asia/Bangkok')::date (ตรง pattern v_today ที่ระบบใช้อยู่แล้ว)
// Owner สั่ง 2026-11-05: "migration ใหม่ + apply production ด้วย"
const fs = require('fs')

function slice(file, from, to) {
  const all = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  return all.slice(from - 1, to).join('\n')
}
function fixDates(sql, tag) {
  let n = 0
  const out = sql.split('\n').map((l) => {
    if (/\bstart_date\b|\bend_date\b/.test(l) && /CURRENT_DATE/.test(l)) {
      n++
      return l.replace(/CURRENT_DATE/g, "(now() AT TIME ZONE 'Asia/Bangkok')::date")
    }
    return l
  })
  console.log(tag + ' date-lines replaced = ' + n)
  if (n < 2) throw new Error(tag + ': expected >=2 date lines, got ' + n)
  return out.join('\n')
}

const applyRules = fixDates(slice('supabase/migrations/181_addon_margin_rules.sql', 89, 172), 'promotion_apply_rules(181)')
const orderFn = fixDates(slice('supabase/migrations/173_order_id_bigint_fix.sql', 17, 338), 'create_order_with_items(173)')

const out = [
  '-- ============================================',
  '-- Bite Me Baby — Migration 186: คูปอง/promotion ต้องเทียบ "วันที่กรุงเทพ" ไม่ใช่ CURRENT_DATE (UTC)',
  '-- Date: 2026-11-05 · Owner สั่งตรง: "migration ใหม่ + apply production ด้วย"',
  '--',
  '-- DEFECT: คูปองถูกสร้างด้วยวันที่ BKK (m154 v_today = now() AT TIME ZONE Asia/Bangkok)',
  '--   แต่ gate โปรโมชันทั้ง create_order_with_items (m173) และ promotion_apply_rules (m181)',
  '--   เทียบ CURRENT_DATE = วันที่ตาม session TZ (Supabase = UTC) → คนละวันช่วง 00:00–07:00 ICT',
  '--   = คูปองใช้ไม่ได้จริงทุกวัน (หลักฐาน: contract 154 G6 แดงใน CI ช่วง 17:00–24:00 UTC)',
  '--',
  '-- FIX = body VERBATIM จาก definition ล่าสุด เปลี่ยนเฉพาะ 2 บรรทัดวันที่ต่อฟังก์ชัน:',
  "--   start_date / end_date  เทียบ (now() AT TIME ZONE 'Asia/Bangkok')::date",
  '--   (ไม่แตะ assertion ใด ๆ · pattern เดียวกับ v_today ที่ business logic ใช้อยู่แล้ว)',
  '--',
  '-- Evidence: e2e/_r68_mk186.log · fix ฝั่ง test = commit 388fed9 (session TZ ใน contract 154)',
  '-- ============================================',
  'BEGIN;',
  '',
  '-- ---- 1) promotion_apply_rules — VERBATIM จาก 181_addon_margin_rules.sql:89-172 ----',
  applyRules,
  '',
  '-- ---- 2) create_order_with_items — VERBATIM จาก 173_order_id_bigint_fix.sql:17-338 ----',
  orderFn,
  '',
  'DO $$ BEGIN',
  "  IF to_regprocedure('public.promotion_apply_rules(text,numeric,numeric)') IS NULL THEN",
  "    RAISE EXCEPTION '186 FAIL: promotion_apply_rules missing';",
  '  END IF;',
  "  RAISE NOTICE '186 PASS: BKK date gate applied';",
  'END $$;',
  '',
  'COMMIT;',
  '',
].join('\n')

fs.writeFileSync('supabase/migrations/186_promotion_date_bkk.sql', out, 'utf8')
console.log('WROTE supabase/migrations/186_promotion_date_bkk.sql bytes=' + Buffer.byteLength(out))