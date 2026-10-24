-- ============================================
-- Bite Me Baby — SQL Contract: Migration 144
-- (แพทเทิร์นรอบ 3 รอบ/วัน — order_pattern ตั้งจากแอดมิน + ensure_rounds_for_date)
-- Date: 2026-10-24 · ONE transaction, ROLLBACK — zero persisted data.
--
--   G1  สร้างรอบจากแพทเทิร์น order_pattern = 3 แถวตามค่าที่แอดมินตั้ง (id round-YYYYMMDD-<key>)
--   G2  ensure ซ้ำ = idempotent (ยัง 3 แถว ไม่ซ้ำ)
--   G3  แพทเทิร์นขาด key -> fallback เทมเพลตเดิม (แถวรอบล่าสุด) ยังครบ 3 แถว
--   G4  data repair: รอบอนาคตถูกปิดทิ้ง (ยังไม่มีออเดอร์) -> active / รอบที่มีออเดอร์ไม่แตะ
--   G5  guard เดิม: ensure วันย้อนหลัง = ERR_DATE_IN_PAST
-- ============================================

BEGIN;
RESET ROLE;

-- ตั้งแพทเทิร์นทดสอบ (ค่าเฉพาะตัว — เพื่อพิสูจน์ว่ามาจาก order_pattern ไม่ใช่แถวเดิม)
UPDATE public.business_settings
   SET value = jsonb_build_object('rounds', jsonb_build_array(
     jsonb_build_object('round_key','morning','display_name','PAT-morning','cutoff_time','03:30','delivery_start','05:00','delivery_end','08:00','max_capacity',11),
     jsonb_build_object('round_key','midday','display_name','PAT-midday','cutoff_time','07:00','delivery_start','09:00','delivery_end','13:00','max_capacity',42),
     jsonb_build_object('round_key','evening','display_name','PAT-evening','cutoff_time','15:30','delivery_start','17:00','delivery_end','21:00','max_capacity',33)
   ))
 WHERE key = 'order_pattern';

-- G1: สร้างรอบจากแพทเทิร์น = 3 แถวตามค่าที่แอดมินตั้ง
DO $$
DECLARE v_n integer; v_midday text; v_start time; v_cap integer;
BEGIN
  PERFORM public.ensure_rounds_for_date((now() at time zone 'Asia/Bangkok')::date + 5);
  SELECT count(*) INTO v_n FROM public.delivery_rounds
   WHERE scheduled_date = (now() at time zone 'Asia/Bangkok')::date + 5
     AND id ~ '^round-[0-9]{8}-(morning|midday|evening)$';
  IF v_n <> 3 THEN RAISE EXCEPTION 'G1 FAIL: expected 3 pattern rows, got %', v_n; END IF;
  SELECT display_name, delivery_start, max_capacity INTO v_midday, v_start, v_cap
    FROM public.delivery_rounds
   WHERE id = 'round-' || to_char((now() at time zone 'Asia/Bangkok')::date + 5, 'YYYYMMDD') || '-midday';
  IF v_midday <> 'PAT-midday' OR v_start <> time '09:00' OR v_cap <> 42 THEN
    RAISE EXCEPTION 'G1 FAIL: midday row not from pattern (name=%, start=%, cap=%)', v_midday, v_start, v_cap;
  END IF;
  RAISE NOTICE 'G1 PASS';
END $$;

-- G2: ensure ซ้ำ = idempotent
DO $$
DECLARE v_n integer;
BEGIN
  PERFORM public.ensure_rounds_for_date((now() at time zone 'Asia/Bangkok')::date + 5);
  PERFORM public.ensure_rounds_for_date((now() at time zone 'Asia/Bangkok')::date + 5);
  SELECT count(*) INTO v_n FROM public.delivery_rounds
   WHERE scheduled_date = (now() at time zone 'Asia/Bangkok')::date + 5
     AND id ~ '^round-[0-9]{8}-(morning|midday|evening)$';
  IF v_n <> 3 THEN RAISE EXCEPTION 'G2 FAIL: expected 3 rows after re-run, got %', v_n; END IF;
  RAISE NOTICE 'G2 PASS';
END $$;

-- G3: แพทเทิร์นขาด key -> fallback เทมเพลตเดิม (ยังครบ 3 แถว)
DO $$
DECLARE v_n integer; v_evening text;
BEGIN
  UPDATE public.business_settings
     SET value = jsonb_build_object('rounds', jsonb_build_array(
       jsonb_build_object('round_key','morning','display_name','PAT-morning','cutoff_time','03:30','delivery_start','05:00','delivery_end','08:00','max_capacity',11),
       jsonb_build_object('round_key','midday','display_name','PAT-midday','cutoff_time','07:00','delivery_start','09:00','delivery_end','13:00','max_capacity',42)
     ))
   WHERE key = 'order_pattern';
  PERFORM public.ensure_rounds_for_date((now() at time zone 'Asia/Bangkok')::date + 6);
  SELECT count(*) INTO v_n FROM public.delivery_rounds
   WHERE scheduled_date = (now() at time zone 'Asia/Bangkok')::date + 6
     AND id ~ '^round-[0-9]{8}-(morning|midday|evening)$';
  IF v_n <> 3 THEN RAISE EXCEPTION 'G3 FAIL: expected 3 rows (fallback), got %', v_n; END IF;
  SELECT display_name INTO v_evening FROM public.delivery_rounds
   WHERE id = 'round-' || to_char((now() at time zone 'Asia/Bangkok')::date + 6, 'YYYYMMDD') || '-evening';
  IF v_evening IS NULL OR v_evening = '' THEN
    RAISE EXCEPTION 'G3 FAIL: evening row missing after legacy fallback';
  END IF;
  RAISE NOTICE 'G3 PASS (fallback cloned latest evening template: %)', v_evening;
END $$;

-- G4: data repair — รอบอนาคตถูกปิดทิ้ง (ยังไม่มีออเดอร์) -> active / รอบที่มีออเดอร์ไม่แตะ
DO $$
DECLARE v_status text; v_kept text;
BEGIN
  INSERT INTO public.delivery_rounds
    (id, round_key, display_name, cutoff_time, delivery_start, delivery_end,
     max_capacity, current_count, date, scheduled_date, name, status, created_at, updated_at, branch_id)
  VALUES
    ('round-' || to_char((now() at time zone 'Asia/Bangkok')::date + 9, 'YYYYMMDD') || '-evening',
     'evening', 'G4-closed', '16:00', '17:00', '20:00', 10, 0,
     (now() at time zone 'Asia/Bangkok')::date + 9, (now() at time zone 'Asia/Bangkok')::date + 9,
     'evening', 'closed', now(), now(), 'branch-tenant-bmb-001-main'),
    ('round-' || to_char((now() at time zone 'Asia/Bangkok')::date + 9, 'YYYYMMDD') || '-morning',
     'morning', 'G4-kept', '08:00', '06:00', '09:00', 10, 5,
     (now() at time zone 'Asia/Bangkok')::date + 9, (now() at time zone 'Asia/Bangkok')::date + 9,
     'morning', 'closed', now(), now(), 'branch-tenant-bmb-001-main');

  UPDATE public.delivery_rounds
     SET status = 'active', updated_at = now()
   WHERE scheduled_date > (now() AT TIME ZONE 'Asia/Bangkok')::date
     AND id ~ '^round-[0-9]{8}-(morning|midday|evening)$'
     AND current_count = 0
     AND status = 'closed';

  SELECT status INTO v_status FROM public.delivery_rounds
   WHERE id = 'round-' || to_char((now() at time zone 'Asia/Bangkok')::date + 9, 'YYYYMMDD') || '-evening';
  SELECT status INTO v_kept FROM public.delivery_rounds
   WHERE id = 'round-' || to_char((now() at time zone 'Asia/Bangkok')::date + 9, 'YYYYMMDD') || '-morning';
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'G4 FAIL: empty future round should be re-opened, got %', v_status;
  END IF;
  IF v_kept <> 'closed' THEN
    RAISE EXCEPTION 'G4 FAIL: round with orders must stay closed, got %', v_kept;
  END IF;
  RAISE NOTICE 'G4 PASS';
END $$;

-- G5: guard เดิม — ensure วันย้อนหลัง = ERR_DATE_IN_PAST
DO $$
DECLARE v_ok boolean := false; v_err text := '';
BEGIN
  BEGIN
    PERFORM public.ensure_rounds_for_date((now() at time zone 'Asia/Bangkok')::date - 1);
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_ok OR v_err NOT LIKE 'ERR_DATE_IN_PAST%' THEN
    RAISE EXCEPTION 'G5 FAIL: expected ERR_DATE_IN_PAST, got ok=% err=%', v_ok, v_err;
  END IF;
  RAISE NOTICE 'G5 PASS';
END $$;

ROLLBACK;