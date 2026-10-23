-- ============================================
-- Bite Me Baby â€” SQL Contract: Migration 140 (auto-close expired rounds)
-- Date: 2026-10-23 Â· Run on ephemeral PG (apply_all_migrations.sh) or SQL Editor
-- ONE transaction, ROLLBACK at the end â€” zero persisted data.
--
-- Proves (Owner policy 2026-10-23: auto-close à¸•à¸²à¸¡ cutoff + admin-only + audit):
--   G1  auto_close_expired_rounds = SECURITY DEFINER + grants
--   G2  à¸›à¸´à¸”à¹€à¸‰à¸žà¸²à¸° round à¸—à¸µà¹ˆ cutoff à¸œà¹ˆà¸²à¸™ Â· à¸­à¸™à¸²à¸„à¸•/à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸¥à¸¢ cutoff/à¸›à¸´à¸”à¹à¸¥à¹‰à¸§ = à¹„à¸¡à¹ˆà¸–à¸¹à¸à¹à¸•à¸°
--   G3  à¸—à¸¸à¸à¸£à¸­à¸šà¸—à¸µà¹ˆà¸–à¸¹à¸à¸›à¸´à¸”à¸¡à¸µ audit_logs (settings_change, 'auto-close%')
--   G4  idempotent: à¸£à¸±à¸™à¸‹à¹‰à¸³ = à¸›à¸´à¸” 0 + à¹„à¸¡à¹ˆà¸ªà¸£à¹‰à¸²à¸‡ audit à¹ƒà¸«à¸¡à¹ˆ
--   G5  à¹„à¸¡à¹ˆà¹à¸•à¸° current_count / à¸­à¸­à¹€à¸”à¸­à¸£à¹Œ (bookkeeping à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™)
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO public.delivery_rounds
  (id, round_key, display_name, cutoff_time, delivery_start, delivery_end,
   max_capacity, current_count, date, scheduled_date, name, status, created_at, updated_at, branch_id)
VALUES
  ('c140-yesterday', 'evening', 'c140-yesterday', '08:00:00', '17:00:00', '20:00:00',
   50, 3, ((now() at time zone 'Asia/Bangkok')::date - 1), ((now() at time zone 'Asia/Bangkok')::date - 1),
   'evening', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c140-today-past', 'morning', 'c140-today-past',
   ((now() at time zone 'Asia/Bangkok') - interval '1 minute')::time, '06:00:00', '09:00:00',
   50, 0, (now() at time zone 'Asia/Bangkok')::date, (now() at time zone 'Asia/Bangkok')::date,
   'morning', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c140-today-open', 'evening', 'c140-today-open',
   CASE WHEN extract(hour from (now() at time zone 'Asia/Bangkok')) >= 22
        THEN time '23:59:00'
        ELSE ((now() at time zone 'Asia/Bangkok') + interval '2 hours')::time END,
   '17:00:00', '20:00:00',
   50, 1, (now() at time zone 'Asia/Bangkok')::date, (now() at time zone 'Asia/Bangkok')::date,
   'evening', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c140-tomorrow', 'midday', 'c140-tomorrow', '10:30:00', '11:00:00', '14:00:00',
   50, 0, ((now() at time zone 'Asia/Bangkok')::date + 1), ((now() at time zone 'Asia/Bangkok')::date + 1),
   'midday', 'active', now(), now(), 'branch-tenant-bmb-001-main'),
  ('c140-yesterday-closed', 'midday', 'c140-yesterday-closed', '10:30:00', '11:00:00', '14:00:00',
   50, 2, ((now() at time zone 'Asia/Bangkok')::date - 1), ((now() at time zone 'Asia/Bangkok')::date - 1),
   'midday', 'closed', now(), now(), 'branch-tenant-bmb-001-main');

DO $$
BEGIN
  ASSERT (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'auto_close_expired_rounds'),
    'G1 auto_close_expired_rounds must be SECURITY DEFINER';
  ASSERT has_function_privilege('authenticated', 'public.auto_close_expired_rounds()', 'EXECUTE'),
    'G1 authenticated must EXECUTE auto_close_expired_rounds';
  ASSERT has_function_privilege('service_role', 'public.auto_close_expired_rounds()', 'EXECUTE'),
    'G1 service_role must EXECUTE auto_close_expired_rounds';
  ASSERT NOT has_function_privilege('anon', 'public.auto_close_expired_rounds()', 'EXECUTE'),
    'G1 anon must NOT EXECUTE auto_close_expired_rounds';
END $$;

DO $$
DECLARE
  v_closed integer;
  v_status text;
  v_cnt integer;
BEGIN
  SELECT public.auto_close_expired_rounds() INTO v_closed;
  -- >= 2: replay DB มีรอบ seed จาก migration ที่หมดอายุจริงด้วย — assert ที่เข้มงวด
  -- อยู่ที่สถานะราย fixture ด้านล่าง (exact) + audit ที่ scope แล้ว
  ASSERT v_closed >= 2, 'G2 must close at least the 2 expired fixture rounds, got ' || v_closed;

  SELECT status INTO v_status FROM public.delivery_rounds WHERE id = 'c140-yesterday';
  ASSERT v_status = 'closed', 'G2 yesterday round must be closed, got ' || v_status;
  SELECT status INTO v_status FROM public.delivery_rounds WHERE id = 'c140-today-past';
  ASSERT v_status = 'closed', 'G2 today-past-cutoff round must be closed, got ' || v_status;
  SELECT status INTO v_status FROM public.delivery_rounds WHERE id = 'c140-today-open';
  ASSERT v_status = 'active', 'G2 today-before-cutoff round must stay active, got ' || v_status;
  SELECT status INTO v_status FROM public.delivery_rounds WHERE id = 'c140-tomorrow';
  ASSERT v_status = 'active', 'G2 tomorrow round must stay active, got ' || v_status;
  SELECT status INTO v_status FROM public.delivery_rounds WHERE id = 'c140-yesterday-closed';
  ASSERT v_status = 'closed', 'G2 already-closed round must stay closed';

  SELECT current_count INTO v_cnt FROM public.delivery_rounds WHERE id = 'c140-yesterday';
  ASSERT v_cnt = 3, 'G5 current_count must be untouched, got ' || v_cnt;

  SELECT count(*) INTO v_cnt FROM public.audit_logs
  WHERE entity_type = 'delivery_round' AND action = 'settings_change'
    AND entity_id IN ('c140-yesterday', 'c140-today-past')
    AND description LIKE 'auto-close%';
  ASSERT v_cnt = 2, 'G3 exactly 2 auto-close audit rows expected, got ' || v_cnt;
END $$;

DO $$
DECLARE
  v_closed integer;
  v_audit integer;
BEGIN
  SELECT public.auto_close_expired_rounds() INTO v_closed;
  ASSERT v_closed = 0, 'G4 second run must close 0 rounds, got ' || v_closed;
  SELECT count(*) INTO v_audit FROM public.audit_logs
  WHERE entity_type = 'delivery_round' AND description LIKE 'auto-close%'
    AND entity_id IN ('c140-yesterday', 'c140-today-past', 'c140-today-open', 'c140-tomorrow', 'c140-yesterday-closed');
  ASSERT v_audit = 2, 'G4 second run must not add audit rows, total must stay 2, got ' || v_audit;
END $$;

DO $$ BEGIN RAISE NOTICE 'CONTRACT 140: PASS'; END $$;
ROLLBACK;