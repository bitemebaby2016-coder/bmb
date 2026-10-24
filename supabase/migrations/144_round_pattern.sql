-- ============================================================
-- Migration 144 — แพทเทิร์นรอบจัดส่ง 3 รอบ/วัน (ตั้งจากฝั่งแอดมินได้)
-- Owner directive 2026-10-24:
--   "รอบจัดส่งในหน้าแอดมินมั่วมากซ้ำหลายอย่างหลายวัน ทุกวันของพรีออเดอร์มีแค่ 3 รอบ
--    เหมือนเดิมควรเป็นแพทเทิร์นเดียวกัน ส่วนของเซมเดย์ปกติต้องส่งได้ตลอดอยู่แล้ว"
-- Contract changes (ตั้งใจ — ไม่ใช่ refactor):
--   144a) business_settings.order_pattern = แพทเทิร์นรอบ {rounds:[morning,midday,evening]}
--         (แอดมินแก้ได้จากหน้า AdminRounds — คือ template ของทุกวัน)
--   144b) ensure_rounds_for_date: template หลัก = order_pattern (fallback = แถวรอบล่าสุดต่อ key
--         เดิม 024/113) — id `round-YYYYMMDD-<key>` / idempotent / ไม่เกิน 30 วัน เหมือนเดิม
--   144c) data repair: รอบอนาคต (ยังไม่มีออเดอร์) ที่ถูกปิดทิ้งโดยไม่ตั้งใจ -> active
--         (คืนสภาพ "3 รอบ/วัน เหมือนกันทุกวัน" — แอดมินปิดเองได้ใหม่ตามต้องการ)
-- สัญญาทดสอบ: e2e/contracts_144.sql
-- Rollback: apply ใหม่ supabase/migrations/143_pre_order_cutoff_settings.sql
-- ============================================================

BEGIN;

-- ---- 144a: seed order_pattern จากแถวเทมเพลตปัจจุบัน (ครั้งแรกครั้งเดียว) ----
INSERT INTO public.business_settings (key, value)
SELECT 'order_pattern', jsonb_build_object('rounds', (
  SELECT jsonb_agg(jsonb_build_object(
           'round_key', k,
           'display_name', COALESCE(t.display_name, k),
           'cutoff_time', to_char(t.cutoff_time, 'HH24:MI'),
           'delivery_start', to_char(t.delivery_start, 'HH24:MI'),
           'delivery_end', to_char(t.delivery_end, 'HH24:MI'),
           'max_capacity', COALESCE(t.max_capacity, 100)
         ) ORDER BY CASE k WHEN 'morning' THEN 1 WHEN 'midday' THEN 2 ELSE 3 END)
  FROM (VALUES ('morning'),('midday'),('evening')) AS keys(k)
  LEFT JOIN LATERAL (
    SELECT * FROM public.delivery_rounds
     WHERE COALESCE(round_key, name) = k
     ORDER BY scheduled_date DESC NULLS LAST, created_at DESC
     LIMIT 1
  ) t ON true))
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'order_pattern');

-- ---- 144b: ensure_rounds_for_date — template หลัก = order_pattern (fallback เดิม 024/113) ----
CREATE OR REPLACE FUNCTION public.ensure_rounds_for_date(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_key text;
  v_tpl public.delivery_rounds%ROWTYPE;
  v_pat jsonb;
  v_p jsonb;
  v_id text;
  v_branch text;
  v_rounds jsonb;
BEGIN
  IF p_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_DATE'; END IF;
  IF p_date < v_today THEN RAISE EXCEPTION 'ERR_DATE_IN_PAST'; END IF;
  IF p_date > v_today + 30 THEN RAISE EXCEPTION 'ERR_DATE_TOO_FAR'; END IF;

  SELECT bs.value INTO v_pat FROM public.business_settings bs WHERE bs.key = 'order_pattern';

  FOREACH v_key IN ARRAY ARRAY['morning','midday','evening'] LOOP
    v_id := 'round-' || to_char(p_date, 'YYYYMMDD') || '-' || v_key;
    v_p := NULL;
    IF v_pat IS NOT NULL AND jsonb_typeof(v_pat->'rounds') = 'array' THEN
      SELECT t.val INTO v_p
        FROM jsonb_array_elements(v_pat->'rounds') AS t(val)
       WHERE t.val->>'round_key' = v_key
       LIMIT 1;
    END IF;

    IF v_p IS NOT NULL
       AND COALESCE(v_p->>'display_name','') <> ''
       AND COALESCE(v_p->>'cutoff_time','') ~ '^[0-9]{2}:[0-9]{2}'
       AND COALESCE(v_p->>'delivery_start','') ~ '^[0-9]{2}:[0-9]{2}'
       AND COALESCE(v_p->>'delivery_end','') ~ '^[0-9]{2}:[0-9]{2}'
       AND COALESCE(v_p->>'max_capacity','0') ~ '^[0-9]+$'
       AND (v_p->>'max_capacity')::integer > 0 THEN
      -- 144: template จากแพทเทิร์นที่แอดมินตั้ง (order_pattern)
      SELECT r.branch_id INTO v_branch FROM public.delivery_rounds r
       WHERE COALESCE(r.round_key, r.name) = v_key
       ORDER BY r.scheduled_date DESC NULLS LAST, r.created_at DESC LIMIT 1;
      IF v_branch IS NULL THEN
        SELECT b.id INTO v_branch FROM public.branches b WHERE b.is_default = true LIMIT 1;
      END IF;
      IF v_branch IS NULL THEN
        SELECT b.id INTO v_branch FROM public.branches b ORDER BY b.created_at LIMIT 1;
      END IF;
      INSERT INTO public.delivery_rounds (
        id, round_key, name, display_name, cutoff_time, delivery_start, delivery_end,
        max_capacity, current_count, date, scheduled_date, status, branch_id
      ) VALUES (
        v_id, v_key, v_key, v_p->>'display_name',
        (v_p->>'cutoff_time')::time, (v_p->>'delivery_start')::time, (v_p->>'delivery_end')::time,
        (v_p->>'max_capacity')::integer, 0, p_date, p_date, 'active', v_branch
      )
      ON CONFLICT (id) DO NOTHING;
      CONTINUE;
    END IF;

    -- fallback: legacy template = latest row per round_key (024/113 — เดิมทุกตัวอักษร)
    SELECT * INTO v_tpl
      FROM public.delivery_rounds
     WHERE COALESCE(round_key, name) = v_key
     ORDER BY scheduled_date DESC NULLS LAST, created_at DESC
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ERR_ROUND_TEMPLATE_MISSING: %', v_key;
    END IF;
    IF v_tpl.cutoff_time IS NULL OR v_tpl.max_capacity IS NULL OR v_tpl.max_capacity <= 0 THEN
      RAISE EXCEPTION 'ERR_ROUND_TEMPLATE_INVALID: %', v_key;
    END IF;
    INSERT INTO public.delivery_rounds (
      id, round_key, name, display_name, cutoff_time, delivery_start, delivery_end,
      max_capacity, current_count, date, scheduled_date, status, branch_id
    ) VALUES (
      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time, v_tpl.delivery_start,
      v_tpl.delivery_end, v_tpl.max_capacity, 0, p_date, p_date, 'active', v_tpl.branch_id
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'round_key', r.round_key, 'display_name', r.display_name,
           'scheduled_date', r.scheduled_date, 'cutoff_time', r.cutoff_time,
           'delivery_start', r.delivery_start, 'delivery_end', r.delivery_end,
           'max_capacity', r.max_capacity, 'current_count', r.current_count, 'status', r.status
         ) ORDER BY r.delivery_start), '[]'::jsonb)
    INTO v_rounds
    FROM public.delivery_rounds r
   WHERE r.scheduled_date = p_date AND r.status = 'active';

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'rounds', v_rounds);
END $$;

-- ---- 144c: data repair — รอบอนาคตที่ยังไม่มีออเดอร์และถูกปิดทิ้ง -> active ----
UPDATE public.delivery_rounds
   SET status = 'active', updated_at = now()
 WHERE scheduled_date > (now() AT TIME ZONE 'Asia/Bangkok')::date
   AND id ~ '^round-[0-9]{8}-(morning|midday|evening)$'
   AND current_count = 0
   AND status = 'closed';

COMMIT;