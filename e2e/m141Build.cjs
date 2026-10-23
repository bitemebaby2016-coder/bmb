// ============================================
// Bite Me Baby — build migration 141 from the 118 function body (anchor-guarded)
// R5 (Owner 2026-10-23): PRE_ORDER รับสินค้าทุกตัว + แยก "เมนูรอบพิเศษ" ตามปฏิทินแอดมิน
//   - create_order_with_items = body ของ 118 (FC gates ครบ) ลบเฉพาะ gate
//     `PRE_ORDER × available_preorder` (C1) — SAME_DAY gate คงเดิม
//   - enforce_menu_gate = ฉบับ 141 (C2/C3): สินค้าที่มีเมนูผูกวัน → ต้องส่งตรงวัน/รอบ,
//     สินค้าทั่วไปผ่าน (ส่งร่วมรอบเดียวกับเมนูพรีออเดอร์ได้), archived rows ไม่ผูกมัด
// Usage: node e2e/m141Build.cjs
//   → supabase/migrations/141_pre_order_unify_menu_calendar.sql
// ============================================
const fs = require('fs')

const SRC = 'supabase/migrations/118_restore_fc_gates_after_117.sql'
const OUT = 'supabase/migrations/141_pre_order_unify_menu_calendar.sql'

const GATE_LINE = "  IF v_mode = 'PRE_ORDER' AND NOT COALESCE(v_prod_preorder, false) THEN RAISE EXCEPTION 'ERR_PRODUCT_MODE_NOT_ALLOWED'; END IF;"
const REPLACEMENT = '  -- R5/141 C1: ยกเลิก gate PRE_ORDER x available_preorder — สินค้าทั่วไปสั่งพรีออเดอร์/ส่งร่วมรอบเดียวกับเมนูพรีออเดอร์ได้'

const src = fs.readFileSync(SRC, 'utf8')
const beginIdx = src.indexOf('\nBEGIN;')
const commitIdx = src.indexOf('\nCOMMIT;')
if (beginIdx < 0 || commitIdx < 0) {
  console.error('ANCHOR_MISSING: BEGIN/COMMIT')
  process.exit(1)
}
let body = src.slice(beginIdx + 1, commitIdx + '\nCOMMIT;'.length)
if (!body.includes(GATE_LINE)) {
  console.error('ANCHOR_MISSING: PRE_ORDER gate line')
  process.exit(1)
}
body = body.replace(GATE_LINE, REPLACEMENT)
if (body.includes(GATE_LINE)) {
  console.error('REPLACE_FAILED')
  process.exit(1)
}

const HEADER = `-- ============================================================
-- Migration 141 — PRE_ORDER รับสินค้าทุกตัว + แยก "เมนูรอบพิเศษ" ตามปฏิทินแอดมิน
-- Owner directive 2026-10-23: "พรีออเดอร์ควรเพิ่มสินค้าที่ไม่ใช่พรีออเดอร์ได้ทั้งหมด
--   และส่งในรอบเดียวกับพรีออเดอร์ได้ ... ต้องแยกระหว่างพรีออเดอร์ [ทั่วไป] กับเมนู
--   ที่แอดมินใส่เองทีละ 7 วัน 14 เมนู (วันถูกกำหนดโดยปฏิทินที่แอดมินใส่ — ป้ายมุมเมนู)
--   แล้วลูกค้าเลือกแค่รอบ ... เมนูที่เลยวันไปแล้วให้เก็บ archive (ไม่โชว์วันที่ผ่านรอบ)"
-- Contract changes (ตั้งใจ — ไม่ใช่ refactor):
--   C1) create_order_with_items: ยกเลิก gate \`PRE_ORDER × available_preorder\`
--       (ERR_PRODUCT_MODE_NOT_ALLOWED เฉพาะ SAME_DAY × available_same_day เหมือนเดิม)
--   C2) enforce_menu_gate (trg_menu_gate): จาก "วันที่มีเมนู = รับเฉพาะสินค้าในเมนู"
--       เป็น "สินค้าที่มีเมนูผูกวัน → ต้องส่งตรงวัน/รอบที่เมนูกำหนด · สินค้าทั่วไปผ่าน"
--   C3) แถวเมนู scheduled_date < วันนี้ (Asia/Bangkok) = archived — ไม่ผูกมัด
--       (วนใช้รอบถัดไปได้โดยไม่โชว์วันที่ผ่านรอบจัดส่ง)
-- create_order_with_items body = 118 (FC gates ครบ) หักลบ C1 จุดเดียว
--   (สร้างโดย e2e/m141Build.cjs — anchor-guarded)
-- สัญญาทดสอบ: e2e/contracts_141.sql
-- Rollback: apply ใหม่ supabase/migrations/118_restore_fc_gates_after_117.sql
--   + 039_weekly_menu_and_mode_controls.sql (enforce_menu_gate เดิม)
-- ============================================================

`

const GATE_FN = `
-- ============================================
-- 4A v141 (C2/C3): enforce_menu_gate — เมนูรอบพิเศษผูก "วัน/รอบ" เฉพาะสินค้าในเมนู
--   · สินค้าทั่วไป (ไม่มีเมนูผูกวัน) → ผ่านเสมอ (ส่งร่วมรอบเดียวกับเมนูพรีออเดอร์ได้)
--   · สินค้าที่มีเมนูผูกวัน (published, ยังไม่ผ่านรอบจัดส่ง) → ต้องตรงวันที่
--     และรอบที่เมนูกำหนด (delivery_round_key NULL/'' = ทุกรอบ)
--   · แถวเมนูที่ผ่านรอบจัดส่งแล้ว (scheduled_date < วันนี้) = archived — ไม่ผูกมัด
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_menu_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode      text;
  v_scheduled date;
  v_round_id  text;
  v_today     date;
BEGIN
  SELECT o.order_mode::text, o.scheduled_date, o.delivery_round_id
    INTO v_mode, v_scheduled, v_round_id
    FROM public.orders o WHERE o.id = NEW.order_id;

  IF v_mode <> 'PRE_ORDER' OR v_scheduled IS NULL THEN RETURN NEW; END IF;

  v_today := (now() at time zone 'Asia/Bangkok')::date;

  -- binding เฉพาะแถว published ที่ยังไม่ผ่านรอบจัดส่ง (archived = ไม่ผูกมัด)
  IF EXISTS (SELECT 1 FROM public.menu_schedule ms
              WHERE ms.product_id = NEW.product_id
                AND ms.is_published = true
                AND ms.scheduled_date >= v_today) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.menu_schedule ms
       WHERE ms.product_id = NEW.product_id
         AND ms.is_published = true
         AND ms.scheduled_date = v_scheduled
         AND (ms.delivery_round_key IS NULL OR ms.delivery_round_key = ''
              OR ms.delivery_round_key = (SELECT COALESCE(round_key, name)
                    FROM public.delivery_rounds WHERE id = v_round_id))
    ) THEN
      RAISE EXCEPTION 'ERR_PRODUCT_NOT_ON_MENU: % not on menu for %', NEW.product_id, v_scheduled::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_menu_gate() FROM PUBLIC, anon, authenticated;
`

const commitPos = body.lastIndexOf('\nCOMMIT;')
body = body.slice(0, commitPos) + '\n' + GATE_FN + body.slice(commitPos)
fs.writeFileSync(OUT, HEADER + body + '\n')
console.log('WROTE', OUT, fs.statSync(OUT).size, 'bytes')