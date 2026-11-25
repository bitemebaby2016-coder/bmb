-- ============================================================
-- Contract 134 + 145 + 150 + 151 + 152 — kitchen fee sync / two cutoffs /
-- schema parity / history baseline / menu-schedule execute revoke
-- ครอบคลุม:
--   134.1 business_settings.kitchen_location = พิกัดครัวจริง (12.615659, 102.098063)
--   134.2 kitchen_location(): มีค่าใน settings → คืนค่านั้น / ไม่มี → fallback ครัวจริงเดิม
--   145.1 delivery_rounds มี same_day_cutoff + pre_order_cutoff
--   145.2 order_setting(): ค่าพัง (ไม่ใช่ตัวเลข) → default ไม่ crash
--   145.3 ensure_rounds_for_date: รอบใหม่มี same_day_cutoff = cutoff_time (จาก pattern)
--   150.1 orders.delivery_address มีจริง (TEXT DEFAULT '')
--   151.1 baseline history: ออเดอร์ที่ไม่มี history ได้ 1 แถว to_status=สถานะจริง
--   152.1 set/publish_menu_schedule: anon ไม่มีสิทธิ์ EXECUTE, authenticated มี
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- 134.1/134.2 kitchen fee sync ----------
DO $$
DECLARE v_loc jsonb; v_out jsonb;
BEGIN
  SELECT value INTO v_loc FROM public.business_settings WHERE key='kitchen_location';
  IF v_loc IS NULL THEN RAISE EXCEPTION '134.1 FAIL: kitchen_location setting missing'; END IF;
  IF (v_loc->>'latitude')::numeric <> 12.615659 OR (v_loc->>'longitude')::numeric <> 102.098063 THEN
    RAISE EXCEPTION '134.1 FAIL: kitchen_location = %', v_loc;
  END IF;
  v_out := public.kitchen_location();
  IF (v_out->>'latitude')::numeric <> 12.615659 THEN RAISE EXCEPTION '134.2 FAIL: fallback wrong %', v_out; END IF;
  RAISE NOTICE '134 PASS: kitchen_location setting + function fallback = real kitchen';
END $$;

-- ---------- 145.1 pre_order_cutoff exists / same_day_cutoff superseded by 148 ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='delivery_rounds' AND column_name='pre_order_cutoff') THEN
    RAISE EXCEPTION '145.1 FAIL: pre_order_cutoff column missing';
  END IF;
  -- 148 (Owner 2026-10-24): SAME_DAY ไม่มีคัทออฟ -> same_day_cutoff (145) ถูกถอด
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='delivery_rounds' AND column_name='same_day_cutoff') THEN
    RAISE EXCEPTION '145.1 FAIL: same_day_cutoff still present (148 superseded it — must be dropped)';
  END IF;
  RAISE NOTICE '145.1 PASS: pre_order_cutoff exists / same_day_cutoff dropped (per 148)';
END $$;

-- ---------- 145.2 order_setting hardening: ค่าพัง -> default ไม่ crash ----------
DO $$
DECLARE v_orig jsonb; v numeric;
BEGIN
  SELECT value INTO v_orig FROM public.business_settings WHERE key='order_policy';
  -- ตั้ง cutoff_hours เป็นข้อความที่ cast ไม่ได้ (แบบ "มี7" ที่เคยทำให้ทุกพรีออเดอร์พัง 22P02)
  IF v_orig IS NULL THEN
    INSERT INTO public.business_settings (key, value)
    VALUES ('order_policy', '{"cutoff_hours":"สี่"}'::jsonb);
  ELSE
    UPDATE public.business_settings
       SET value = jsonb_set(v_orig, '{cutoff_hours}', '"สี่"'::jsonb, true)
     WHERE key = 'order_policy';
  END IF;
  v := public.order_setting('cutoff_hours', 2);
  IF v IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION '145.2 FAIL: broken value returned % instead of default 2', v;
  END IF;
  -- คืนค่าเดิม (ROLLBACK ปิดท้ายจะคืนทั้งเทรนแลกชั่นอยู่แล้ว — คืนเพิ่มเพื่อกันกรณีรันนอก rollback)
  IF v_orig IS NULL THEN
    DELETE FROM public.business_settings WHERE key='order_policy';
  ELSE
    UPDATE public.business_settings SET value = v_orig WHERE key='order_policy';
  END IF;
  RAISE NOTICE '145.2 PASS: broken cutoff_hours -> default 2 (no 22P02 crash)';
END $$;

-- ---------- 145.3 ensure_rounds_for_date carries pre_order_cutoff (no same_day key) ----------
DO $$
DECLARE v_out jsonb; v_round jsonb; v_date date := (now() AT TIME ZONE 'Asia/Bangkok')::date + 5;
BEGIN
  -- seed order_pattern ของเทส (ลบเดิมก่อน — 144a template จากแถวเก่าไม่มี pre_order_cutoff)
  DELETE FROM public.business_settings WHERE key='order_pattern';
  INSERT INTO public.business_settings (key, value)
  VALUES ('order_pattern', jsonb_build_object('rounds', '[
    {"round_key":"morning","display_name":"Morning","cutoff_time":"06:00","delivery_start":"09:00","delivery_end":"12:00","max_capacity":50},
    {"round_key":"midday","display_name":"Midday","cutoff_time":"11:00","delivery_start":"14:00","delivery_end":"17:00","max_capacity":50},
    {"round_key":"evening","display_name":"Evening","cutoff_time":"16:00","delivery_start":"18:30","delivery_end":"21:00","max_capacity":50,"pre_order_cutoff":"15:00"}
  ]'::jsonb));

  v_out := public.ensure_rounds_for_date(v_date);
  IF (v_out->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION '145.3 FAIL: ensure_rounds_for_date not ok'; END IF;
  SELECT val INTO v_round FROM jsonb_array_elements(v_out->'rounds') AS t(val)
   WHERE val->>'round_key'='evening' LIMIT 1;
  IF v_round IS NULL THEN RAISE EXCEPTION '145.3 FAIL: evening round missing'; END IF;
  IF COALESCE(v_round->>'pre_order_cutoff','') NOT LIKE '15:00%' THEN
    RAISE EXCEPTION '145.3 FAIL: pre_order_cutoff not carried from pattern (%s)', v_round->>'pre_order_cutoff';
  END IF;
  IF v_round ? 'same_day_cutoff' THEN
    RAISE EXCEPTION '145.3 FAIL: same_day_cutoff leaked into round payload (148 dropped it)';
  END IF;
  DELETE FROM public.delivery_rounds WHERE scheduled_date = v_date AND id LIKE 'round-%';
  RAISE NOTICE '145.3 PASS: ensure_rounds_for_date carries pre_order_cutoff only';
END $$;

-- ---------- 150.1 orders.delivery_address parity ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_address') THEN
    RAISE EXCEPTION '150.1 FAIL: orders.delivery_address missing';
  END IF;
  RAISE NOTICE '150.1 PASS: orders.delivery_address exists';
END $$;

-- ---------- 151.1 history baseline (เทส logic เดิมบนออเดอร์ fixture) ----------
DO $$
DECLARE v_order text; v_hist int;
BEGIN
  v_order := 'BMB-' || to_char(now(),'YYYYMMDD') || '-999';
  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, status,
    order_mode, subtotal, delivery_fee, total_amount, payment_status)
  VALUES ('ord-c151-baseline', v_order, '00000000-0000-0000-0000-000000000000', 'Contract 151', '0000000000',
    'pending', 'SAME_DAY', 10, 0, 10, 'pending');
  -- logic เดิมของ 151 (idempotent baseline ต่อออเดอร์ที่ยังไม่มี history)
  INSERT INTO public.order_status_history (id, order_number, from_status, to_status, changed_at, actor_type, reason, metadata)
  SELECT 'osh-baseline-' || o.order_number, o.order_number, NULL, o.status, o.updated_at, 'SYSTEM',
         'HISTORICAL_BASELINE (pre-W2 order, no recorded lifecycle)',
         jsonb_build_object('backfill', true, 'strategy', 'HISTORICAL_BASELINE')
  FROM public.orders o WHERE o.order_number = v_order
    AND NOT EXISTS (SELECT 1 FROM public.order_status_history h WHERE h.order_number = o.order_number);
  SELECT count(*) INTO v_hist FROM public.order_status_history WHERE order_number = v_order;
  IF v_hist <> 1 THEN RAISE EXCEPTION '151.1 FAIL: expected 1 baseline row, got %', v_hist; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_status_history WHERE order_number = v_order
                 AND to_status='pending' AND from_status IS NULL AND actor_type='SYSTEM') THEN
    RAISE EXCEPTION '151.1 FAIL: baseline row shape wrong';
  END IF;
  RAISE NOTICE '151.1 PASS: baseline history row created with real status';
END $$;

-- ---------- 152.1 menu_schedule execute revoke ----------
DO $$
DECLARE v_anon_ok boolean; v_auth_ok boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT has_function_privilege('anon','public.set_menu_schedule(date,jsonb)','EXECUTE') INTO v_anon_ok;
  IF v_anon_ok THEN RAISE EXCEPTION '152.1 FAIL: anon still has EXECUTE on set_menu_schedule'; END IF;
  SELECT has_function_privilege('authenticated','public.set_menu_schedule(date,jsonb)','EXECUTE') INTO v_auth_ok;
  IF NOT v_auth_ok THEN RAISE EXCEPTION '152.1 FAIL: authenticated lost EXECUTE on set_menu_schedule'; END IF;
  SELECT has_function_privilege('anon','public.publish_menu_schedule(date,boolean)','EXECUTE') INTO v_anon_ok;
  IF v_anon_ok THEN RAISE EXCEPTION '152.1 FAIL: anon still has EXECUTE on publish_menu_schedule'; END IF;
  RAISE NOTICE '152.1 PASS: execute revoked from PUBLIC/anon, granted to authenticated';
END $$;

ROLLBACK;