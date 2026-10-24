// ============================================
// build migration 145 (two independent cutoffs) from the 143 + 144 bodies — anchor-guarded
// Owner approval 2026-10-24 (handoff task 4): ONE shared round + capacity,
// TWO cutoff columns: same_day_cutoff (เซมเดย์) + pre_order_cutoff (พรีออเดอร์).
//   - pre_order_cutoff NULL = legacy rule (delivery_start - order_policy.cutoff_hours)
//   - same_day_cutoff backfilled from cutoff_time (behaviour identical until edited)
//   - ensure_rounds_for_date copies both from order_pattern when present
// Usage: node e2e/m145Build.cjs -> supabase/migrations/145_two_cutoffs.sql
// ============================================
const fs = require('fs')

const SRC143 = 'supabase/migrations/143_pre_order_cutoff_settings.sql'
const SRC144 = 'supabase/migrations/144_round_pattern.sql'
const OUT = 'supabase/migrations/145_two_cutoffs.sql'

function extractBody(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const i = raw.indexOf('\nBEGIN;')
  const j = raw.indexOf('\nCOMMIT;')
  if (i < 0 || j < 0 || j <= i) {
    console.error('ANCHOR_MISSING: BEGIN/COMMIT in ' + file)
    process.exit(1)
  }
  return raw.slice(i + 1, j).replace(/^BEGIN;\n/, '') // strip BEGIN; keep content
}

function patchOnce(body, name, anchor, replacement) {
  const parts = body.split(anchor)
  if (parts.length !== 2) {
    console.error((parts.length === 1 ? 'ANCHOR_MISSING: ' : 'ANCHOR_MULTI: ') + name)
    process.exit(1)
  }
  return parts[0] + replacement + parts[1]
}

// ---------- part 1: create_order_with_items + enforce_pre_order_window (143 body) ----------
let b143 = extractBody(SRC143)

b143 = patchOnce(b143, 'DECLARE',
  '  v_cur_count integer; v_round_date date; v_round_cutoff time; v_round_start time;',
  '  v_cur_count integer; v_round_date date; v_round_cutoff time; v_round_start time;\n  v_same_day_cutoff time; v_pre_order_cutoff time;')

b143 = patchOnce(b143, 'ROUND_SELECT',
  `  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time, delivery_start
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff, v_round_start
    FROM public.delivery_rounds WHERE id = p_delivery_round_id FOR UPDATE;`,
  `  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time, delivery_start,
         same_day_cutoff, pre_order_cutoff
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff, v_round_start,
         v_same_day_cutoff, v_pre_order_cutoff
    FROM public.delivery_rounds WHERE id = p_delivery_round_id FOR UPDATE;`)

b143 = patchOnce(b143, 'SAME_DAY_CUTOFF',
  "    IF v_now > v_round_cutoff THEN RAISE EXCEPTION 'ERR_CUTOFF_PASSED'; END IF;",
  `    -- 145: เซมเดย์ใช้ same_day_cutoff ของรอบ (แยกจากพรีออเดอร์) — ไม่มีค่า = cutoff_time เดิม
    IF v_now > COALESCE(v_same_day_cutoff, v_round_cutoff) THEN RAISE EXCEPTION 'ERR_CUTOFF_PASSED'; END IF;`)

b143 = patchOnce(b143, 'PRE_ORDER_CUTOFF',
  `    IF v_round_start IS NULL AND v_round_cutoff IS NULL THEN
      RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
    END IF;
    IF (now() at time zone 'Asia/Bangkok')
       > ((p_scheduled_date + COALESCE(v_round_start, v_round_cutoff))
          - (COALESCE(public.order_setting('cutoff_hours', 2), 2) * interval '1 hour')) THEN
      RAISE EXCEPTION 'ERR_CUTOFF_PASSED';
    END IF;`,
  `    -- 145: แอดมินตั้ง pre_order_cutoff ของรอบได้เอง (แยกจากเซมเดย์) — ไม่มีค่า = กฎเดิม
    IF v_pre_order_cutoff IS NOT NULL THEN
      IF (now() at time zone 'Asia/Bangkok') > (p_scheduled_date + v_pre_order_cutoff) THEN
        RAISE EXCEPTION 'ERR_CUTOFF_PASSED';
      END IF;
    ELSE
      IF v_round_start IS NULL AND v_round_cutoff IS NULL THEN
        RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
      END IF;
      IF (now() at time zone 'Asia/Bangkok')
         > ((p_scheduled_date + COALESCE(v_round_start, v_round_cutoff))
            - (COALESCE(public.order_setting('cutoff_hours', 2), 2) * interval '1 hour')) THEN
        RAISE EXCEPTION 'ERR_CUTOFF_PASSED';
      END IF;
    END IF;`)

// ---- trigger enforce_pre_order_window (inside 143 body) ----
b143 = patchOnce(b143, 'TRIGGER_DECLARE',
  '  v_cutoff_hours numeric;',
  '  v_cutoff_hours numeric;\n  v_pre_cutoff    time;')

b143 = patchOnce(b143, 'TRIGGER_ROUND_SELECT',
  `  SELECT COALESCE(delivery_start, cutoff_time) INTO v_start
    FROM public.delivery_rounds
   WHERE id = NEW.delivery_round_id;`,
  `  SELECT COALESCE(delivery_start, cutoff_time), pre_order_cutoff INTO v_start, v_pre_cutoff
    FROM public.delivery_rounds
   WHERE id = NEW.delivery_round_id;`)

b143 = patchOnce(b143, 'TRIGGER_CUTOFF_TS',
  `  v_cutoff_hours := COALESCE(public.order_setting('cutoff_hours', 2), 2);
  v_cutoff_ts := NEW.scheduled_date::timestamp + v_start - (v_cutoff_hours * interval '1 hour');`,
  `  v_cutoff_hours := COALESCE(public.order_setting('cutoff_hours', 2), 2);
  IF v_pre_cutoff IS NOT NULL THEN
    -- 145: pre_order_cutoff ตั้งตรง ๆ ของรอบ (แยกจากเซมเดย์)
    v_cutoff_ts := NEW.scheduled_date::timestamp + v_pre_cutoff;
  ELSE
    v_cutoff_ts := NEW.scheduled_date::timestamp + v_start - (v_cutoff_hours * interval '1 hour');
  END IF;`)

// ---------- part 2: ensure_rounds_for_date (144 body) ----------
let b144 = extractBody(SRC144)

b144 = patchOnce(b144, 'PATTERN_INSERT',
  `      INSERT INTO public.delivery_rounds (
        id, round_key, name, display_name, cutoff_time, delivery_start, delivery_end,
        max_capacity, current_count, date, scheduled_date, status, branch_id
      ) VALUES (
        v_id, v_key, v_key, v_p->>'display_name',
        (v_p->>'cutoff_time')::time, (v_p->>'delivery_start')::time, (v_p->>'delivery_end')::time,
        (v_p->>'max_capacity')::integer, 0, p_date, p_date, 'active', v_branch
      )
      ON CONFLICT (id) DO NOTHING;`,
  `      INSERT INTO public.delivery_rounds (
        id, round_key, name, display_name, cutoff_time, same_day_cutoff, pre_order_cutoff,
        delivery_start, delivery_end,
        max_capacity, current_count, date, scheduled_date, status, branch_id
      ) VALUES (
        v_id, v_key, v_key, v_p->>'display_name',
        (v_p->>'cutoff_time')::time,
        COALESCE(NULLIF(v_p->>'same_day_cutoff', '')::time, (v_p->>'cutoff_time')::time),
        NULLIF(v_p->>'pre_order_cutoff', '')::time,
        (v_p->>'delivery_start')::time, (v_p->>'delivery_end')::time,
        (v_p->>'max_capacity')::integer, 0, p_date, p_date, 'active', v_branch
      )
      ON CONFLICT (id) DO NOTHING;`)

b144 = patchOnce(b144, 'FALLBACK_INSERT',
  `    INSERT INTO public.delivery_rounds (
      id, round_key, name, display_name, cutoff_time, delivery_start, delivery_end,
      max_capacity, current_count, date, scheduled_date, status, branch_id
    ) VALUES (
      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time, v_tpl.delivery_start,
      v_tpl.delivery_end, v_tpl.max_capacity, 0, p_date, p_date, 'active', v_tpl.branch_id
    )
    ON CONFLICT (id) DO NOTHING;`,
  `    INSERT INTO public.delivery_rounds (
      id, round_key, name, display_name, cutoff_time, same_day_cutoff, pre_order_cutoff,
      delivery_start, delivery_end,
      max_capacity, current_count, date, scheduled_date, status, branch_id
    ) VALUES (
      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time,
      COALESCE(v_tpl.same_day_cutoff, v_tpl.cutoff_time), v_tpl.pre_order_cutoff,
      v_tpl.delivery_start, v_tpl.delivery_end,
      v_tpl.max_capacity, 0, p_date, p_date, 'active', v_tpl.branch_id
    )
    ON CONFLICT (id) DO NOTHING;`)

b144 = patchOnce(b144, 'RETURN_FIELDS',
  `'scheduled_date', r.scheduled_date, 'cutoff_time', r.cutoff_time,`,
  `'scheduled_date', r.scheduled_date, 'cutoff_time', r.cutoff_time,
           'same_day_cutoff', r.same_day_cutoff, 'pre_order_cutoff', r.pre_order_cutoff,`)
const EXTRA = `
-- ============================================
-- 145a: สองคอลัมน์คัทออฟอิสระบนรอบเดิม (1 รอบ + ความจุก้อนเดียว — ไม่สร้างตารางใหม่)
-- ============================================
ALTER TABLE public.delivery_rounds
  ADD COLUMN IF NOT EXISTS same_day_cutoff time,
  ADD COLUMN IF NOT EXISTS pre_order_cutoff time;

-- backfill: เซมเดย์ค่าเดิมเท่ากับ cutoff_time (พฤติกรรมเหมือนเดิมจนกว่าแอดมินจะแก้)
--           พรีออเดอร์ NULL = ใช้กฎเดิม delivery_start - cutoff_hours
UPDATE public.delivery_rounds
   SET same_day_cutoff = cutoff_time, updated_at = now()
 WHERE same_day_cutoff IS NULL;

-- ============================================
-- 145b: order_pattern เดิมรับคีย์ใหม่ (same_day_cutoff คัดจาก cutoff_time,
--       pre_order_cutoff ยังไม่ตั้ง = ใช้กฎ) — preserve ค่าที่แอดมินตั้งไปแล้ว
-- ============================================
UPDATE public.business_settings bs
   SET value = jsonb_set(bs.value, '{rounds}', (
         SELECT COALESCE(jsonb_agg(
                  rr.elem || jsonb_strip_nulls(jsonb_build_object(
                    'same_day_cutoff', COALESCE(rr.elem->>'same_day_cutoff', rr.elem->>'cutoff_time'),
                    'pre_order_cutoff', rr.elem->>'pre_order_cutoff'
                  )) ORDER BY rr.ord), '[]'::jsonb)
         FROM jsonb_array_elements(bs.value->'rounds') WITH ORDINALITY AS rr(elem, ord)
       ), true),
       updated_at = now()
 WHERE bs.key = 'order_pattern'
   AND jsonb_typeof(bs.value->'rounds') = 'array';
`

const HEADER = `-- ============================================================
-- Migration 145 — คัทออฟ 2 ช่องทางบนรอบเดียว (same-day / pre-order)
-- Owner approval 2026-10-24 (handoff task 4: "อนุมัติทั้ง schema 2-คัทออฟ + บังคับกฎ >=2"):
--   "1 รอบ = ความจุก้อนเดียว แยก 2 คอลัมน์คัทออฟ ไม่สร้างตารางใหม่"
--   · same_day_cutoff   = คัทออฟเซมเดย์ของรอบนั้น (backfill = cutoff_time เดิม)
--   · pre_order_cutoff  = คัทออฟพรีออเดอร์ตั้งตรง (NULL = กฎเดิม
--                         delivery_start - order_policy.cutoff_hours)
--   · capacity/shared-slot ไม่เปลี่ยน — ทั้งสองโหมดใช้แถวรอบเดียวกันเหมือนเดิม
-- Contract changes (ตั้งใจ — ไม่ใช่ refactor):
--   145a) delivery_rounds +2 columns + backfill
--   145b) create_order_with_items: SAME_DAY = COALESCE(same_day_cutoff, cutoff_time)
--         · PRE_ORDER = pre_order_cutoff ถ้าตั้ง ไม่งั้นกฎเดิม 143 (gate 142 คงเดิม)
--   145c) enforce_pre_order_window (trigger): pre_order_cutoff ถ้าตั้ง ไม่งั้นกฎเดิม
--   145d) ensure_rounds_for_date: รอบใหม่รับค่าทั้งสองจาก order_pattern
--   145e) order_pattern เดิม +คีย์ same_day_cutoff/pre_order_cutoff (idempotent)
-- สร้างโดย e2e/m145Build.cjs (anchor-guarded จาก body 143 + 144)
-- สัญญาทดสอบ: e2e/contracts_145.sql (+ regression contracts_143/144)
-- Rollback: apply ใหม่ 143_pre_order_cutoff_settings.sql + 144_round_pattern.sql
--           (คอลัมน์เพิ่มเองไม่ยุ่งกับ key ใด ๆ — DROP COLUMN ถ้าต้องการ rollback จริง)
-- ============================================================

`

const out = HEADER + 'BEGIN;\n\n' + b143 + '\n' + b144 + '\n' + EXTRA + '\nCOMMIT;\n'
fs.writeFileSync(OUT, out, 'utf8')
console.log('WROTE=' + OUT + ' bytes=' + out.length)