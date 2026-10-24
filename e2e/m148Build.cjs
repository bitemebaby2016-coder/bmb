// m148Build.cjs — สร้าง supabase/migrations/148_same_day_no_cutoff.sql (ROUND-14 / P0-1)
// ==============================================================================
// Owner 2026-10-24 (กฎใหม่ มีผลเหนืองานรอบ 13):
//   1) SAME_DAY ห้ามมีคัทออฟ — รอบเซมเดย์วิ่งปกติตั้งแต่ร้านเปิดถึงปิด ไม่มี cutoff ใด ๆ
//   2) คัทออฟมีเฉพาะ PRE_ORDER เท่านั้น — `same_day_cutoff` (migration 145) = ไม่จำเป็น ถอด
//
// ทุกขั้น patch ต้องเจอ anchor ตรงจำนวนที่กำหนด (กัน anchor หาย/ซ้ำ — บทเรียนรอบ 13):
//   148a create_order_with_items (body จาก 145) = SAME_DAY ไม่เช็คเวลาอีกต่อไป
//   148b ensure_rounds_for_date   (body จาก 145) = ไม่เขียน/ไม่ส่งคอลัมน์ same_day_cutoff
//   148c auto_close_expired_rounds (เขียนใหม่)   = ปิดเฉพาะรอบวันที่ผ่านไปแล้ว
//   148d order_pattern            = ลบคีย์ same_day_cutoff ทุกแถว
//   148e DROP COLUMN same_day_cutoff (ท้ายสุด — หลัง replace function ทุกตัว)
//
// วิธีใช้: node e2e/m148Build.cjs   (เขียนไฟล์ใหม่ — ไม่แก้ไฟล์ history เดิม)
// ทดสอบ: Docker replay 001->148 + e2e/contracts_148_same_day_no_cutoff.sql
// ==============================================================================
const fs = require('fs')

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const cut = (src, startMarker, endMarker, label) => {
  const s = src.indexOf(startMarker)
  if (s < 0) throw new Error(`[${label}] START marker not found: ${startMarker.slice(0, 60)}`)
  const e = src.indexOf(endMarker, s)
  if (e < 0) throw new Error(`[${label}] END marker not found: ${endMarker.slice(0, 60)}`)
  return src.slice(s, e + endMarker.length)
}
const patch = (text, from, to, label, expected = 1) => {
  const n = text.split(from).length - 1
  if (n !== expected) throw new Error(`[${label}] expected ${expected} occurrence(s), got ${n}`)
  return text.split(from).join(to)
}

const src145 = read('supabase/migrations/145_two_cutoffs.sql')

// ---------- 148a: create_order_with_items ----------
let createFn = cut(
  src145,
  'CREATE OR REPLACE FUNCTION public.create_order_with_items(',
  'GRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;',
  'create_order_with_items',
)

// (1) ตัวแปร same-day ออก (v_now เหลือใช้ที่ gate เดียว → ออกด้วย)
createFn = patch(createFn, '  v_same_day_cutoff time; v_pre_order_cutoff time;\n',
  '  v_pre_order_cutoff time;\n', 'create/declares')
createFn = patch(createFn, "  v_now time := (now() AT TIME ZONE 'Asia/Bangkok')::time;\n",
  '', 'create/v_now')

// (2) SELECT รอบ: ไม่ดึงคอลัมน์ same_day_cutoff อีกต่อไป
createFn = patch(
  createFn,
  `  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time, delivery_start,
         same_day_cutoff, pre_order_cutoff
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff, v_round_start,
         v_same_day_cutoff, v_pre_order_cutoff
    FROM public.delivery_rounds WHERE id = p_delivery_round_id FOR UPDATE;`,
  `  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time, delivery_start,
         pre_order_cutoff
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff, v_round_start,
         v_pre_order_cutoff
    FROM public.delivery_rounds WHERE id = p_delivery_round_id FOR UPDATE;`,
  'create/select-round',
)

// (3) SAME_DAY time gate = ถอดทิ้ง (Owner: ไม่มีคัทออฟใด ๆ — เปิดร้านถึงปิดร้าน)
createFn = patch(
  createFn,
  `    -- 145: เซมเดย์ใช้ same_day_cutoff ของรอบ (แยกจากพรีออเดอร์) — ไม่มีค่า = cutoff_time เดิม
    IF v_now > COALESCE(v_same_day_cutoff, v_round_cutoff) THEN RAISE EXCEPTION 'ERR_CUTOFF_PASSED'; END IF;`,
  `    -- 148 (Owner 2026-10-24): SAME_DAY = ไม่มีคัทออฟใด ๆ — วิ่งปกติตั้งแต่ร้านเปิดถึงปิดร้าน
    --   (ยกเลิก 145: IF v_now > COALESCE(same_day_cutoff, cutoff_time) -> ERR_CUTOFF_PASSED)
    --   ด่านของเซมเดย์เหลือแค่: รอบเปิดอยู่ (status) + วันเดียวกัน (date) + ความจุ (capacity)`,
  'create/same-day-gate',
)
const codeOnly = (t) => t.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
if (/v_same_day_cutoff|\bv_now\b/.test(codeOnly(createFn))) {
  throw new Error('[create] leftover same_day/v_now reference after patch')
}

// ---------- 148b: ensure_rounds_for_date ----------
let ensureFn = cut(
  src145,
  'CREATE OR REPLACE FUNCTION public.ensure_rounds_for_date(p_date date)',
  `  RETURN jsonb_build_object('ok', true, 'date', p_date, 'rounds', v_rounds);
END $$;`,
  'ensure_rounds_for_date',
)
ensureFn = patch(ensureFn,
  'id, round_key, name, display_name, cutoff_time, same_day_cutoff, pre_order_cutoff,',
  'id, round_key, name, display_name, cutoff_time, pre_order_cutoff,',
  'ensure/insert-cols', 2)
ensureFn = patch(
  ensureFn,
  `        (v_p->>'cutoff_time')::time,
        COALESCE(NULLIF(v_p->>'same_day_cutoff', '')::time, (v_p->>'cutoff_time')::time),
        NULLIF(v_p->>'pre_order_cutoff', '')::time,`,
  `        (v_p->>'cutoff_time')::time,
        NULLIF(v_p->>'pre_order_cutoff', '')::time,`,
  'ensure/values-pattern',
)
ensureFn = patch(
  ensureFn,
  `      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time,
      COALESCE(v_tpl.same_day_cutoff, v_tpl.cutoff_time), v_tpl.pre_order_cutoff,`,
  `      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time,
      v_tpl.pre_order_cutoff,`,
  'ensure/values-legacy',
)
ensureFn = patch(
  ensureFn,
  `'cutoff_time', r.cutoff_time,
           'same_day_cutoff', r.same_day_cutoff, 'pre_order_cutoff', r.pre_order_cutoff,`,
  `'cutoff_time', r.cutoff_time,
           'pre_order_cutoff', r.pre_order_cutoff,`,
  'ensure/return-json',
)
if (/same_day_cutoff/.test(ensureFn)) throw new Error('[ensure] leftover same_day reference after patch')

// ---------- 148c: auto_close_expired_rounds (เขียนใหม่ — ไม่ปิดด้วย cutoff) ----------
const autoClose = `create or replace function public.auto_close_expired_rounds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_closed integer := 0;
  r record;
begin
  for r in
    select id, display_name, scheduled_date, cutoff_time
      from public.delivery_rounds
     where status = 'active'
       -- 148 (Owner 2026-10-24): SAME_DAY = ไม่มีคัทออฟ -> ห้ามปิดรอบวันนี้ด้วยเวลา cutoff
       --   อีกต่อไป (เดิม 140: ปิดเมื่อเลย cutoff_time ของวัน) — ปิดเฉพาะวันที่ผ่านไปแล้ว
       and scheduled_date < v_today
  loop
    update public.delivery_rounds
       set status = 'closed', updated_at = now()
     where id = r.id and status = 'active';
    begin
      perform public.append_audit_log(
        p_action := 'settings_change',
        p_entity_type := 'delivery_round',
        p_entity_id := r.id,
        p_description := format('auto-close ปิดรอบ "%s" (%s) : active -> closed (วันจัดส่งผ่านไปแล้ว)', r.display_name, r.scheduled_date),
        p_metadata := jsonb_build_object('from', 'active', 'to', 'closed', 'reason', 'auto-close-day-ended', 'scheduled_date', r.scheduled_date),
        p_user_email := null
      );
    exception when others then
      raise notice 'auto_close_expired_rounds: audit write failed for % (%)', r.id, sqlerrm;
    end;
    v_closed := v_closed + 1;
  end loop;
  return v_closed;
end;
$$;
revoke all on function public.auto_close_expired_rounds() from public, anon;
grant execute on function public.auto_close_expired_rounds() to authenticated, service_role;`

// ---------- 148d/148e: strip pattern key + DROP COLUMN ----------
const dataSteps = `-- ---- 148d: order_pattern ลบคีย์ same_day_cutoff ทุกแถว (pre_order_cutoff คงเดิม) ----
UPDATE public.business_settings bs
   SET value = jsonb_set(bs.value, '{rounds}', (
         SELECT COALESCE(jsonb_agg(elem - 'same_day_cutoff' ORDER BY ord), '[]'::jsonb)
           FROM jsonb_array_elements(bs.value->'rounds') WITH ORDINALITY AS r(elem, ord)
       ), true),
       updated_at = now()
 WHERE bs.key = 'order_pattern'
   AND jsonb_typeof(bs.value->'rounds') = 'array';

-- ---- 148e: ถอดคอลัมน์ออกจาก schema จริง (ท้ายสุด — หลัง replace function ทุกตัวแล้ว) ----
ALTER TABLE public.delivery_rounds DROP COLUMN IF EXISTS same_day_cutoff;`

const header = `-- ============================================================
-- Migration 148 — SAME_DAY = เปิด–ปิดไม่มีคัทออฟ (ถอด same_day_cutoff)
-- Owner directive 2026-10-24 (ปิดเซสชันรอบ 13 — กฎใหม่ มีผลเหนืองานรอบ 13):
--   1) "รอบจัดส่งเซมเดย์ต้องวิ่งปกติตั้งแต่ร้านเปิด–ปิด ไม่มี cutoff ใด ๆ"
--      (ไม่ใช่ "คัทออฟเลยร้านปิด" — คือไม่มีคัทออฟเลย)
--   2) "คัทออฟมีเฉพาะ PRE_ORDER เท่านั้น" — same_day_cutoff (145) = ไม่จำเป็น สั่งถอด
--   ยังอยู่: pre_order_cutoff + กฎ cutoff_hours (ของจริง เฉพาะพรีออเดอร์)
--   ถูกรื้อตามคำสั่ง: contract 145, roundsTwoCutoffs.test, คอลัมน์ same_day_cutoff,
--   ช่องคัทออฟเซมเดย์ใน AdminRounds, fixture pairing 12 คอนแทรคต์, ขั้น #6 ใน acceptance
--
-- ผลต่อพฤติกรรม (ตั้งใจ — requirement ใหม่ของ Owner ไม่ใช่การอ่อนกฎ):
--   · create_order_with_items SAME_DAY = ไม่มี ERR_CUTOFF_PASSED (ด่านเดิม 145 ถูกถอด)
--   · auto_close_expired_rounds = ไม่ปิดรอบวันนี้เมื่อเลย cutoff_time (ปิดเฉพาะวันที่ผ่านไปแล้ว)
--   · PRE_ORDER ทุกด่านคงเดิม: pre_order_cutoff ตั้งตรง / fallback delivery_start − cutoff_hours
--     + gate 142 เมนูปฏิทิน + enforce_pre_order_window (เช็คเฉพาะ PRE_ORDER เหมือนเดิม)
--
-- สร้างโดย e2e/m148Build.cjs (anchor-guarded จาก body 145 + auto-close เขียนใหม่)
-- สัญญาทดสอบ: e2e/contracts_148_same_day_no_cutoff.sql (แทน contracts_145 ที่ถูกรื้อ)
-- Regression: contracts_143/144 (pre-order cutoff + pattern) · contracts_140 (ปรับ G2 ตามกติกาใหม่)
-- Rollback: apply ใหม่ 145_two_cutoffs.sql (คืนคอลัมน์ + gate เดิม) — ไม่มี data loss
-- ============================================================

BEGIN;

-- ---- 148a: order gate — SAME_DAY ไม่มีเวลาปิดรับ ----
${createFn}

-- ---- 148b: ensure_rounds_for_date — สร้างรอบโดยไม่แตะคอลัมน์ที่ถูกถอด ----
${ensureFn}

-- ---- 148c: auto-close — เฉพาะวันที่ผ่านไปแล้ว ----
${autoClose}

${dataSteps}

COMMIT;
`

fs.writeFileSync('supabase/migrations/148_same_day_no_cutoff.sql', header)
console.log('WROTE supabase/migrations/148_same_day_no_cutoff.sql =', header.length, 'bytes')
console.log('leftover same_day_cutoff refs (must be 0 in fn bodies):',
  'create=', (createFn.match(/same_day_cutoff/g) || []).length,
  'ensure=', (ensureFn.match(/same_day_cutoff/g) || []).length)
console.log('same-day gate removed:', !createFn.includes("RAISE EXCEPTION 'ERR_CUTOFF_PASSED'; END IF;"))