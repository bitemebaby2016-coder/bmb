// ============================================
// build migration 143 from the 142 function body (anchor-guarded)
// Owner 2026-10-24: "คัทออฟก่อนส่ง 2 ชม." (owner decision Q1 / FC-4 — order_policy.cutoff_hours)
//   + พรีออเดอร์วันนี้ได้จนถึงคัทออฟ (เมนูปฏิทินของวันนี้ = สั่งได้ เลือกเฉพาะรอบที่ยังไม่ผ่านคัทออฟ)
//   + same-day ไม่เปลี่ยน (cutoff_time ของรอบ — "เซมเดย์ส่งได้ตลอดอยู่แล้ว")
//   + ซ่อม order_policy ที่มีค่าไม่ใช่ตัวเลข (เช่น pre_order_lead_days "มี7" -> 7)
//   + order_setting ทนค่าพัง (cast fail -> ใช้ default ไม่ raise)
// Usage: node e2e/m143Build.cjs -> supabase/migrations/143_pre_order_cutoff_settings.sql
// ============================================
const fs = require('fs')

const SRC = 'supabase/migrations/142_pre_order_requires_menu.sql'
const OUT = 'supabase/migrations/143_pre_order_cutoff_settings.sql'

const A_DECLARE = '  v_cur_count integer; v_round_date date; v_round_cutoff time;'
const A_ROUND_SELECT = `  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff
    FROM public.delivery_rounds WHERE id = p_delivery_round_id FOR UPDATE;`
const A_PREORDER_HEAD = `  ELSE
    IF p_scheduled_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_SCHEDULED_DATE'; END IF;
    IF p_scheduled_date <= v_today THEN RAISE EXCEPTION 'ERR_SCHEDULED_DATE_INVALID'; END IF;
    IF p_scheduled_date <> v_round_date THEN RAISE EXCEPTION 'ERR_ROUND_DATE_MISMATCH'; END IF;
    IF (p_scheduled_date - v_today) < public.order_setting('pre_order_lead_days', 1) THEN RAISE EXCEPTION 'ERR_LEAD_TIME'; END IF;`

const R_DECLARE = '  v_cur_count integer; v_round_date date; v_round_cutoff time; v_round_start time;'
const R_ROUND_SELECT = `  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time, delivery_start
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff, v_round_start
    FROM public.delivery_rounds WHERE id = p_delivery_round_id FOR UPDATE;`
const R_PREORDER_HEAD = `  ELSE
    IF p_scheduled_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_SCHEDULED_DATE'; END IF;
    IF p_scheduled_date < v_today THEN RAISE EXCEPTION 'ERR_SCHEDULED_DATE_INVALID'; END IF;
    IF p_scheduled_date <> v_round_date THEN RAISE EXCEPTION 'ERR_ROUND_DATE_MISMATCH'; END IF;
    -- 143 (Owner Q1 + 2026-10-24): พรีออเดอร์วันนี้ได้จนถึงคัทออฟ — คัทออฟ = cutoff_hours ชม.
    --   ก่อน delivery_start (mirror ของ enforce_pre_order_window / FC-4 availability)
    --   · ยกเลิก ERR_LEAD_TIME (pre_order_lead_days เดิม) — คัทออฟคุมแทน ตั้งค่าได้จากแอดมิน
    --   · เมนู/ตะกร้า gate 142 ด้านล่างคงเดิมทุกประการ
    IF v_round_start IS NULL AND v_round_cutoff IS NULL THEN
      RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
    END IF;
    IF (now() at time zone 'Asia/Bangkok')
       > ((p_scheduled_date + COALESCE(v_round_start, v_round_cutoff))
          - (COALESCE(public.order_setting('cutoff_hours', 2), 2) * interval '1 hour')) THEN
      RAISE EXCEPTION 'ERR_CUTOFF_PASSED';
    END IF;`

const src = fs.readFileSync(SRC, 'utf8')
const beginIdx = src.indexOf('\nBEGIN;')
const commitIdx = src.indexOf('\nCOMMIT;')
if (beginIdx < 0 || commitIdx < 0) {
  console.error('ANCHOR_MISSING: BEGIN/COMMIT')
  process.exit(1)
}
let body = src.slice(beginIdx + 1, commitIdx) // ไม่รวม COMMIT — ต่อท้ายเอง
for (const [name, anchor] of [['DECLARE', A_DECLARE], ['ROUND_SELECT', A_ROUND_SELECT], ['PREORDER_HEAD', A_PREORDER_HEAD]]) {
  if (body.split(anchor).length !== 2) {
    console.error('ANCHOR_MISSING_OR_MULTI: ' + name)
    process.exit(1)
  }
}
if (!body.includes('ERR_LEAD_TIME')) {
  console.error('ANCHOR_MISSING: ERR_LEAD_TIME')
  process.exit(1)
}
body = body.replace(A_DECLARE, R_DECLARE)
  .replace(A_ROUND_SELECT, R_ROUND_SELECT)
  .replace(A_PREORDER_HEAD, R_PREORDER_HEAD)
if (body.includes("'ERR_LEAD_TIME'")) {
  console.error('PATCH_FAILED: ERR_LEAD_TIME still present')
  process.exit(1)
}
if (!body.includes('ERR_PRE_ORDER_CUTOFF_UNKNOWN')) {
  console.error('PATCH_FAILED: cutoff block missing')
  process.exit(1)
}
console.log('BODY_PATCHED bytes=' + body.length)

const EXTRA = `-- ============================================
-- 143 extra: harden order_setting (ค่าใน order_policy พัง = ใช้ default ไม่ crash)
--   (เดิม LANGUAGE sql cast ตรง ๆ — ค่า "มี7" ทำให้ทุกพรีออเดอร์พัง 22P02)
-- ============================================
DROP FUNCTION IF EXISTS public.order_setting(text, numeric);
CREATE OR REPLACE FUNCTION public.order_setting(p_field text, p_default numeric DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v numeric;
BEGIN
  BEGIN
    SELECT (bs.value ->> p_field)::numeric INTO v
      FROM public.business_settings bs
     WHERE bs.key = 'order_policy';
  EXCEPTION WHEN invalid_text_representation THEN
    v := NULL;
  END;
  RETURN COALESCE(v, p_default);
END $$;
REVOKE EXECUTE ON FUNCTION public.order_setting(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_setting(text, numeric) TO authenticated, service_role;

-- ============================================
-- 143 extra: enforce_pre_order_window — อนุญาตพรีออเดอร์ "วันนี้" (คัทออฟ cutoff_hours คุม)
--   เดิม: scheduled_date ต้อง strictly future (ERR_PRE_ORDER_DATE_INVALID) — ทำให้เมนู
--   ปฏิทินของวันนี้สั่งไม่ได้แม้ยังไม่ถึงคัทออฟ (Owner ทดสอบ 2026-10-24)
--   ใหม่: scheduled_date >= วันนี้ และ <= วันนี้ + preorder_max_days และก่อนคัทออฟ
--   (cutoff = COALESCE(delivery_start, cutoff_time) - cutoff_hours — Q1/FC-4 เดิมทุกตัวอักษร)
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_pre_order_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today     date;
  v_now_ts    timestamp;
  v_max_days  integer;
  v_start     time;
  v_cutoff_ts timestamp;
  v_cutoff_hours numeric;
BEGIN
  IF NEW.order_mode::text <> 'PRE_ORDER' THEN
    RETURN NEW;
  END IF;

  v_today  := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now_ts := (now() AT TIME ZONE 'Asia/Bangkok')::timestamp;

  -- 143: พรีออเดอร์วันนี้ได้จนถึงคัทออฟ (เดิม strictly future — ปิดช่องเมนูวันนี้โดยไม่ตั้งใจ)
  IF NEW.scheduled_date IS NULL OR NEW.scheduled_date < v_today THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_DATE_INVALID';
  END IF;

  -- owner decision Q1: max window (business_settings, default 40)
  v_max_days := COALESCE(public.order_setting('preorder_max_days', 40), 40);
  IF (NEW.scheduled_date - v_today) > v_max_days THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_DATE_TOO_FAR: max % days ahead', v_max_days;
  END IF;

  -- owner decision Q1 cutoff: closes cutoff_hours before the round's delivery_start
  SELECT COALESCE(delivery_start, cutoff_time) INTO v_start
    FROM public.delivery_rounds
   WHERE id = NEW.delivery_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;
  IF v_start IS NULL THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
  END IF;

  v_cutoff_hours := COALESCE(public.order_setting('cutoff_hours', 2), 2);
  v_cutoff_ts := NEW.scheduled_date::timestamp + v_start - (v_cutoff_hours * interval '1 hour');
  IF v_now_ts > v_cutoff_ts THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_PASSED: closes %', v_cutoff_ts;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================
-- 143 data repair: order_policy ค่าไม่ใช่ตัวเลข (พิมพ์ผ่าน JSON ดิบ เช่น "มี7") -> default
-- ============================================
UPDATE public.business_settings
   SET value = jsonb_set(value, '{pre_order_lead_days}', '7'::jsonb, true),
       updated_at = now()
 WHERE key = 'order_policy'
   AND (value->>'pre_order_lead_days') IS NOT NULL
   AND NOT (value->>'pre_order_lead_days') ~ '^[0-9]+$';
UPDATE public.business_settings
   SET value = jsonb_set(value, '{cutoff_hours}', '2'::jsonb, true),
       updated_at = now()
 WHERE key = 'order_policy'
   AND (value->>'cutoff_hours') IS NOT NULL
   AND NOT (value->>'cutoff_hours') ~ '^[0-9]+(\\.[0-9]+)?$';
UPDATE public.business_settings
   SET value = jsonb_set(value, '{preorder_max_days}', '50'::jsonb, true),
       updated_at = now()
 WHERE key = 'order_policy'
   AND (value->>'preorder_max_days') IS NOT NULL
   AND NOT (value->>'preorder_max_days') ~ '^[0-9]+$';

COMMIT;`

const HEADER = `-- ============================================================
-- Migration 143 — คัทออฟพรีออเดอร์ = cutoff_hours ชม. ก่อนส่ง + พรีออเดอร์วันนี้ได้
-- Owner directive 2026-10-24 (production test):
--   "ต้องคัทออฟก่อนส่ง 2 ชม. — สั่งพรีออเดอร์ 10 โมง รอบเที่ยงต้องสั่งไม่ได้แล้ว เหลือรอบเย็น"
--   + ตะกร้ารวมพรีออเดอร์+เซมเดย์ เลือกรอบเย็น ต้องสั่งได้ (เดิมล้มเหลว ERR_SCHEDULED_DATE_INVALID)
-- Contract changes (ตั้งใจ — ไม่ใช่ refactor):
--   143a) create_order_with_items (PRE_ORDER branch):
--        · อนุญาต scheduled_date >= วันนี้ (เดิม <= วันนี้ = ERR_SCHEDULED_DATE_INVALID — ปิดเมนูวันนี้)
--        · คัทออฟ: now > scheduled_date + COALESCE(delivery_start, cutoff_time) - cutoff_hours
--          = ERR_CUTOFF_PASSED (mirror enforce_pre_order_window / FC-4 availability engine)
--        · ยกเลิก ERR_LEAD_TIME (pre_order_lead_days เดิม — คัทออฟคุมแทน ตั้งค่าได้จากแอดมิน)
--        · gate 142 (ERR_PRE_ORDER_REQUIRES_MENU / ERR_PRODUCT_NOT_ON_MENU) คงเดิม
--        · SAME_DAY คงเดิมทุกบรรทัด (cutoff_time ของรอบ — เซมเดย์ส่งได้ตลอดเหมือนเดิม)
--   143b) enforce_pre_order_window (trigger บน orders): อนุญาต scheduled_date = วันนี้
--   143c) order_setting ทนค่าพัง (cast fail -> default) + ซ่อม order_policy ที่เป็นข้อความ
-- create_order_with_items body = 142 + patch 143 (สร้างโดย e2e/m143Build.cjs — anchor-guarded)
-- สัญญาทดสอบ: e2e/contracts_143.sql
-- Rollback: apply ใหม่ supabase/migrations/142_pre_order_requires_menu.sql
-- ============================================================

`

fs.writeFileSync(OUT, HEADER + body + '\n' + EXTRA + '\n', 'utf8')
console.log('WROTE=' + OUT + ' bytes=' + (HEADER + body + EXTRA).length)