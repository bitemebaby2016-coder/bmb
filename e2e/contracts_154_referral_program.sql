-- ============================================
-- Bite Me Baby â€” SQL Contract: Migration 154
-- (G&R STAGE 2 Â· Referral: identity Â· 3 à¸£à¸°à¸”à¸±à¸šà¸à¸±à¸™à¹‚à¸à¸‡ Â· à¸£à¸²à¸‡à¸§à¸±à¸¥à¸•à¸­à¸™à¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¸œà¹ˆà¸²à¸™à¸ªà¸–à¸²à¸™à¸° Â· ledger à¸à¸¥à¸±à¸š)
-- Date: 2026-10-25 Â· Owner "à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸•à¸²à¸¡à¸™à¸²à¸¢à¹à¸™à¸°à¸™à¸³" (Rollout â‘¡ = Referral à¸•à¹ˆà¸­à¸ˆà¸²à¸ Promotions)
-- ONE transaction, ROLLBACK at the end â€” zero persisted data.
--
-- Proves:
--   G1  à¸ªà¸„à¸µà¸¡à¸²: à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ customers 2 à¸•à¸±à¸§ Â· 2 à¸•à¸²à¸£à¸²à¸‡ + RLS deny (0 policy) Â· policy seed 30/30 Â·
--       à¸Ÿà¸±à¸‡à¸à¹Œà¸Šà¸±à¸™ server à¸„à¸£à¸š 13 à¸•à¸±à¸§ Â· trigger à¸ªà¸–à¸²à¸™à¸°à¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¸•à¸´à¸”à¸­à¸¢à¸¹à¹ˆ
--   G2  referral_my_code: authenticated à¹„à¸”à¹‰à¹‚à¸„à¹‰à¸” BMB-XXXXXXXX à¸„à¸‡à¸—à¸µà¹ˆ Â· à¹„à¸¡à¹ˆ login = denied
--   G3  referral_preview (anon): à¹‚à¸„à¹‰à¸”à¸ˆà¸£à¸´à¸‡ valid Â· à¹‚à¸„à¹‰à¸”à¹„à¸¡à¹ˆà¸£à¸¹à¹‰à¸ˆà¸±à¸ unknown_code Â· à¸£à¸¹à¸›à¹à¸šà¸šà¸œà¸´à¸” bad_format
--   G4  claim à¸›à¸à¸•à¸´: à¹€à¸žà¸·à¹ˆà¸­à¸™à¹ƒà¸«à¸¡à¹ˆ â†’ held + referred_by à¸–à¸¹à¸à¸œà¸¹à¸ + claim à¸‹à¹‰à¸³ = already_claimed (idempotent)
--   G5  Hard block: self_referral (à¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™) Â· same_phone (à¹€à¸šà¸­à¸£à¹Œà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™) Â·
--       not_new (à¹€à¸žà¸·à¹ˆà¸­à¸™à¹„à¸¡à¹ˆà¹ƒà¸«à¸¡à¹ˆ) Â· claim_window_expired (à¹€à¸à¸´à¸™à¸«à¸™à¹‰à¸²à¸•à¹ˆà¸²à¸‡ 72 à¸Šà¸¡.)
--   G6  qualify: à¹€à¸”à¸´à¸™à¸ªà¸–à¸²à¸™à¸°à¸–à¸¶à¸‡ delivered â†’ qualified + à¸„à¸¹à¸›à¸­à¸‡ 2 à¹ƒà¸š + ledger 2 + notice 2 +
--       à¸„à¸¹à¸›à¸­à¸‡à¹ƒà¸Šà¹‰à¸ˆà¸£à¸´à¸‡ (promotion_apply_rules = 30) + issue à¸‹à¹‰à¸³ = 0 (à¹„à¸¡à¹ˆà¸­à¸­à¸à¸‹à¹‰à¸³)
--   G7  à¸„à¸·à¸™à¹€à¸‡à¸´à¸™ â†’ reversed (ledger 2 + à¸„à¸¹à¸›à¸­à¸‡à¸–à¸¹à¸à¸›à¸´à¸”) Â· à¸¢à¸à¹€à¸¥à¸´à¸à¸•à¸­à¸™ held â†’ void (à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸­à¸­à¸)
--   G8  kill switch: à¸›à¸´à¸” = claim à¸„à¸·à¸™ 'disabled' + à¹„à¸¡à¹ˆà¸¡à¸µà¹à¸–à¸§ attribution à¹ƒà¸«à¸¡à¹ˆ
--   G9  Admin: stats/resolve = ERR_FORBIDDEN à¸à¸±à¸š non-admin Â· à¹€à¸žà¸”à¸²à¸™à¹€à¸à¸´à¸™ â†’ risk=review
--       (à¹„à¸¡à¹ˆà¸­à¸­à¸à¸ˆà¸™à¸à¸§à¹ˆà¸²à¹à¸­à¸”à¸¡à¸´à¸™ approve) Â· approve â†’ à¸­à¸­à¸à¸ˆà¸£à¸´à¸‡ 2 à¹ƒà¸š
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, phone) VALUES
  ('00000000-0000-4000-8000-000000c15401', 'c154-ref@example.com',    '0991540001'),
  ('00000000-0000-4000-8000-000000c15402', 'c154-friend@example.com', '0991540002'),
  ('00000000-0000-4000-8000-000000c15403', 'c154-admin@example.com',  '0991540003'),
  ('00000000-0000-4000-8000-000000c15404', 'c154-twin@example.com',   '0991540004'),
  ('00000000-0000-4000-8000-000000c15405', 'c154-window@example.com', '0991540005'),
  ('00000000-0000-4000-8000-000000c15406', 'c154-review@example.com', '0991540006'),
  ('00000000-0000-4000-8000-000000c15407', 'c154-void@example.com',   '0991540007');
-- à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸ fixture: à¹€à¸šà¸­à¸£à¹Œà¹ƒà¸Šà¹‰à¸Šà¹ˆà¸§à¸‡ 09915400xx à¹€à¸‰à¸žà¸²à¸° contract à¸™à¸µà¹‰ â€” à¸«à¹‰à¸²à¸¡à¹ƒà¸Šà¹‰à¹€à¸šà¸­à¸£à¹Œà¸—à¸µà¹ˆ contract
-- à¸­à¸·à¹ˆà¸™/à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸•à¸à¸„à¹‰à¸²à¸‡ (concurrency 124) à¹€à¸„à¸¢à¹ƒà¸Šà¹‰ à¹€à¸Šà¹ˆà¸™ 0922222222 (à¸šà¸—à¹€à¸£à¸µà¸¢à¸™ 153 G4: à¸«à¹‰à¸²à¸¡à¸žà¸¶à¹ˆà¸‡ ambient data)
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000c15403';

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c154-cat', 'c154-cat', 'c154-cat', '', 0, true);

INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c154-pa', 'c154-pa', '', 100, 'c154-cat', '', true, false, true, false, 0);

INSERT INTO public.delivery_rounds
  (id, round_key, name, display_name, cutoff_time, pre_order_cutoff,
   delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, status, branch_id)
VALUES
  ('c154-round', 'midday', 'midday', 'c154-round', '00:00', '23:59',
   ((now() at time zone 'Asia/Bangkok')::time + interval '3 hours'),
   ((now() at time zone 'Asia/Bangkok')::time + interval '6 hours'),
   99, 0, (now() AT TIME ZONE 'Asia/Bangkok')::date, (now() AT TIME ZONE 'Asia/Bangkok')::date,
   'active', 'branch-tenant-bmb-001-main');

-- helpers (à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸«à¸²à¸¢à¹„à¸›à¸•à¸­à¸™ ROLLBACK)
CREATE OR REPLACE FUNCTION public.c154_claims(p_sub text, p_role text DEFAULT 'authenticated')
RETURNS void LANGUAGE sql AS $fn$
  SELECT set_config('request.jwt.claims',
    CASE WHEN p_sub IS NULL THEN jsonb_build_object('role', p_role)::text
         ELSE jsonb_build_object('sub', p_sub, 'role', p_role)::text END, true);
$fn$;

CREATE OR REPLACE FUNCTION public.c154_make_order(p_uid uuid, p_phone text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v jsonb;
BEGIN
  SELECT public.create_order_with_items(
    p_items := '[{"product_id":"c154-pa","quantity":1}]'::jsonb,
    p_delivery_round_id := 'c154-round', p_order_mode := 'SAME_DAY',
    p_customer_name := 'c154', p_customer_phone := p_phone,
    p_delivery_address := 'c154-addr',
    p_dropoff_latitude := (SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_dropoff_longitude := (SELECT COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001 FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main'),
    p_customer_ref := p_uid
  ) INTO v;
  RETURN v->>'order_number';
END;
$fn$;

-- à¹€à¸”à¸´à¸™à¸ªà¸–à¸²à¸™à¸°à¸•à¸²à¸¡ allow-list 030 (guard trigger 008 à¸ˆà¸°à¸•à¸£à¸§à¸ˆà¸—à¸¸à¸ hop â€” claims à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ admin)
CREATE OR REPLACE FUNCTION public.c154_walk(p_order_number text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.orders SET status = 'confirmed'          WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'preparing'          WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'ready_for_dispatch' WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'dispatched'         WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'in_transit'         WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'arrived'            WHERE order_number = p_order_number;
  UPDATE public.orders SET status = 'delivered'          WHERE order_number = p_order_number;
END;
$fn$;

DO $$
DECLARE
  v_user_claims text := COALESCE(current_setting('request.jwt.claims', true), '');
  v_n integer;
  v_j jsonb;
  v_b boolean;
  v_code text;
  v_code2 text;
  v_ref_code text;
  v_on_friend text := NULL;
  v_on_friend2 text := NULL;
  v_on_self text := NULL;
  v_on_twin text := NULL;
  v_on_window text := NULL;
  v_on_review text := NULL;
  v_on_void text := NULL;
  v_on_kill text := NULL;
  v_uid_ref  uuid := '00000000-0000-4000-8000-000000c15401';
  v_uid_frn  uuid := '00000000-0000-4000-8000-000000c15402';
  v_uid_adm  uuid := '00000000-0000-4000-8000-000000c15403';
  v_uid_twn  uuid := '00000000-0000-4000-8000-000000c15404';
  v_uid_win  uuid := '00000000-0000-4000-8000-000000c15405';
  v_uid_rev  uuid := '00000000-0000-4000-8000-000000c15406';
  v_uid_vod  uuid := '00000000-0000-4000-8000-000000c15407';
  v_res jsonb;
  v_promo_pid text;
  v_status text;
  v_txt text;
BEGIN
  -- ===== G1: à¸ªà¸„à¸µà¸¡à¸² + policy seed + trigger + deny-all =====
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='referral_code')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='referred_by') THEN
    RAISE EXCEPTION 'G1 FAIL: customers referral columns missing';
  END IF;
  IF to_regclass('public.referral_attributions') IS NULL OR to_regclass('public.referral_rewards') IS NULL THEN
    RAISE EXCEPTION 'G1 FAIL: referral tables missing';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies WHERE tablename IN ('referral_attributions','referral_rewards');
  IF v_n <> 0 THEN RAISE EXCEPTION 'G1 FAIL: expected 0 RLS policies (deny-all), got %', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN (
     'referral_enabled','referral_policy_state','referral_normalize_code','referral_normalize_phone',
     'referral_my_code','referral_preview','referral_issue_rewards','referral_reverse_rewards',
     'referral_order_status_hook','referral_claim','referral_my_status','referral_admin_stats',
     'referral_resolve_attribution');
  IF v_n <> 13 THEN RAISE EXCEPTION 'G1 FAIL: expected 13 referral functions, got %', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_referral_order_status' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'G1 FAIL: order-status trigger missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'referral_policy'
                   AND (value->>'enabled')::boolean = true
                   AND (value->>'referrer_reward_baht')::numeric = 30
                   AND (value->>'friend_reward_baht')::numeric = 30
                   AND value->>'qualify_status' = 'delivered'
                   AND (value->>'referrer_monthly_cap')::numeric = 20
                   AND (value->>'claim_window_hours')::numeric = 72) THEN
    RAISE EXCEPTION 'G1 FAIL: referral_policy seed wrong';
  END IF;
  v_j := public.referral_policy_state();
  FOREACH v_txt IN ARRAY ARRAY['enabled','referrer_reward_baht','friend_reward_baht','qualify_status',
                               'coupon_validity_days','referrer_monthly_cap','min_order_amount',
                               'claim_window_hours','share_base_url'] LOOP
    IF NOT (v_j ? v_txt) THEN RAISE EXCEPTION 'G1 FAIL: policy_state missing key %', v_txt; END IF;
  END LOOP;
  IF public.referral_normalize_phone('+66 81 234 5678') <> '0812345678'
     OR public.referral_normalize_phone('081-234-5678') <> '0812345678'
     OR public.referral_normalize_code('  bmb-abc1234 ') <> 'BMB-ABC1234' THEN
    RAISE EXCEPTION 'G1 FAIL: normalizers mismatch (phone=%/%)',
      public.referral_normalize_phone('+66 81 234 5678'), public.referral_normalize_code('  bmb-abc1234 ');
  END IF;
  EXECUTE 'SET ROLE anon';
  BEGIN
    SELECT count(*) INTO v_n FROM public.referral_attributions;
    RAISE EXCEPTION 'G1 FAIL: anon must not read referral_attributions';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'G1 PASS (schema + 13 fns + trigger + policy seed + normalizers + anon deny)';

  -- ===== G2: referral_my_code (authenticated) + my_status =====
  PERFORM public.c154_claims(v_uid_ref::text);
  v_code := public.referral_my_code();
  IF v_code IS NULL OR v_code !~ '^BMB-[A-Z0-9]{8}$' THEN
    RAISE EXCEPTION 'G2 FAIL: bad code %', v_code;
  END IF;
  v_code2 := public.referral_my_code();
  IF v_code2 IS DISTINCT FROM v_code THEN RAISE EXCEPTION 'G2 FAIL: code not stable'; END IF;
  v_ref_code := v_code; -- à¹€à¸à¹‡à¸šà¹„à¸§à¹‰à¹ƒà¸Šà¹‰à¸—à¸¸à¸ G à¸–à¸±à¸”à¹„à¸›
  v_j := public.referral_my_status();
  IF (v_j->>'code') IS DISTINCT FROM v_code OR jsonb_typeof(v_j->'rewards') <> 'array'
     OR (v_j->>'referrer_reward_baht')::numeric IS DISTINCT FROM 30 THEN
    RAISE EXCEPTION 'G2 FAIL: my_status incomplete: %', v_j;
  END IF;
  EXECUTE 'SET ROLE anon';
  BEGIN
    PERFORM public.referral_my_code();
    RAISE EXCEPTION 'G2 FAIL: anon must not execute referral_my_code';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'G2 PASS (code stable % Â· my_status Â· anon denied)', v_code;

  -- ===== G3: referral_preview (anon à¹ƒà¸Šà¹‰à¹„à¸”à¹‰ Â· à¹„à¸¡à¹ˆà¹€à¸›à¸´à¸”à¹€à¸œà¸¢à¸•à¸±à¸§à¸•à¸™) =====
  EXECUTE 'SET ROLE anon';
  v_res := public.referral_preview(v_ref_code);
  IF NOT (v_res->>'valid')::boolean THEN
    RAISE EXCEPTION 'G3 FAIL: real code should be valid: %', v_res;
  END IF;
  v_res := public.referral_preview('BMB-NOSUCH99');
  IF COALESCE((v_res->>'valid')::boolean, false) OR v_res->>'reason' <> 'unknown_code' THEN
    RAISE EXCEPTION 'G3 FAIL: unknown_code expected: %', v_res;
  END IF;
  v_res := public.referral_preview('XX');
  IF COALESCE((v_res->>'valid')::boolean, false) OR v_res->>'reason' <> 'bad_format' THEN
    RAISE EXCEPTION 'G3 FAIL: bad_format expected: %', v_res;
  END IF;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'G3 PASS (anon preview: valid/unknown_code/bad_format)';

  -- ===== G4: claim à¸›à¸à¸•à¸´ â€” à¹€à¸žà¸·à¹ˆà¸­à¸™à¹ƒà¸«à¸¡à¹ˆ â†’ held + idempotent =====
  PERFORM public.c154_claims(v_uid_frn::text);
  v_on_friend := public.c154_make_order(v_uid_frn, '0991540002');
  IF v_on_friend IS NULL THEN RAISE EXCEPTION 'G4 FAIL: friend order not created'; END IF;
  v_res := public.referral_claim(v_on_friend, v_ref_code);
  IF v_res->>'status' <> 'held' OR COALESCE((v_res->>'already_claimed')::boolean, false) THEN
    RAISE EXCEPTION 'G4 FAIL: claim should be held: %', v_res;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.referral_attributions
     WHERE order_number = v_on_friend AND status = 'held' AND risk_level = 'none'
       AND referrer_code = v_ref_code AND referred_customer_ref = v_uid_frn
  ) THEN RAISE EXCEPTION 'G4 FAIL: attribution row missing/wrong'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = v_uid_frn AND referred_by IS NOT NULL) THEN
    RAISE EXCEPTION 'G4 FAIL: referred_by not linked';
  END IF;
  v_res := public.referral_claim(v_on_friend, v_ref_code);
  IF NOT COALESCE((v_res->>'already_claimed')::boolean, false) OR v_res->>'status' <> 'held' THEN
    RAISE EXCEPTION 'G4 FAIL: re-claim must be idempotent: %', v_res;
  END IF;
  RAISE NOTICE 'G4 PASS (held + referred_by + claim à¸‹à¹‰à¸³ = already_claimed)';

  -- ===== G5: Hard block à¸—à¸¸à¸à¸à¸£à¸“à¸µ =====
  -- (à¸) à¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™à¹ƒà¸Šà¹‰à¹‚à¸„à¹‰à¸”à¸•à¸±à¸§à¹€à¸­à¸‡
  PERFORM public.c154_claims(v_uid_ref::text);
  v_on_self := public.c154_make_order(v_uid_ref, '0991540001');
  v_res := public.referral_claim(v_on_self, v_ref_code);
  IF v_res->>'status' <> 'blocked' OR v_res->>'reason' <> 'self_referral' THEN
    RAISE EXCEPTION 'G5 FAIL: self_referral expected: %', v_res;
  END IF;
  -- (à¸‚) à¸šà¸±à¸à¸Šà¸µà¸­à¸·à¹ˆà¸™à¸ªà¸±à¹ˆà¸‡à¸”à¹‰à¸§à¸¢à¹€à¸šà¸­à¸£à¹Œà¸‚à¸­à¸‡à¸œà¸¹à¹‰à¹à¸™à¸°à¸™à¸³ (guest = phone-keyed â†’ à¹€à¸šà¸­à¸£à¹Œà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™)
  PERFORM public.c154_claims(v_uid_twn::text);
  v_on_twin := public.c154_make_order(v_uid_twn, '0991540001');
  v_res := public.referral_claim(v_on_twin, v_ref_code);
  IF v_res->>'status' <> 'blocked' OR v_res->>'reason' <> 'same_phone' THEN
    RAISE EXCEPTION 'G5 FAIL: same_phone expected: %', v_res;
  END IF;
  -- (à¸„) à¹€à¸žà¸·à¹ˆà¸­à¸™à¹„à¸¡à¹ˆà¹ƒà¸«à¸¡à¹ˆ â€” à¹€à¸žà¸·à¹ˆà¸­à¸™à¸„à¸™à¹€à¸”à¸´à¸¡à¸ªà¸±à¹ˆà¸‡à¸£à¸­à¸šà¸ªà¸­à¸‡ (à¸¡à¸µà¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²à¹à¸¥à¹‰à¸§)
  PERFORM public.c154_claims(v_uid_frn::text);
  v_on_friend2 := public.c154_make_order(v_uid_frn, '0991540002');
  v_res := public.referral_claim(v_on_friend2, v_ref_code);
  IF v_res->>'status' <> 'blocked' OR v_res->>'reason' <> 'not_new' THEN
    RAISE EXCEPTION 'G5 FAIL: not_new expected: %', v_res;
  END IF;
  -- (à¸‡) à¹€à¸à¸´à¸™à¸«à¸™à¹‰à¸²à¸•à¹ˆà¸²à¸‡à¹€à¸§à¸¥à¸²à¸£à¸°à¸šà¸¸à¸œà¸¹à¹‰à¹à¸™à¸°à¸™à¸³ (72 à¸Šà¸¡.)
  PERFORM public.c154_claims(v_uid_win::text);
  v_on_window := public.c154_make_order(v_uid_win, '0991540005');
  UPDATE public.orders SET created_at = now() - interval '100 hours' WHERE order_number = v_on_window;
  v_res := public.referral_claim(v_on_window, v_ref_code);
  IF v_res->>'status' <> 'blocked' OR v_res->>'reason' <> 'claim_window_expired' THEN
    RAISE EXCEPTION 'G5 FAIL: claim_window_expired expected: %', v_res;
  END IF;
  -- blocked = à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸‡à¸§à¸±à¸¥/à¹„à¸¡à¹ˆà¸œà¸¹à¸ referred_by à¹€à¸žà¸´à¹ˆà¸¡
  IF EXISTS (SELECT 1 FROM public.referral_attributions
              WHERE order_number IN (v_on_self, v_on_twin, v_on_friend2, v_on_window)
                AND status <> 'blocked') THEN
    RAISE EXCEPTION 'G5 FAIL: blocked rows must stay blocked';
  END IF;
  RAISE NOTICE 'G5 PASS (self_referral Â· same_phone Â· not_new Â· claim_window_expired)';

  -- ===== G6: à¸œà¹ˆà¸²à¸™à¸ªà¸–à¸²à¸™à¸°à¸–à¸¶à¸‡ delivered â†’ à¸£à¸²à¸‡à¸§à¸±à¸¥à¸­à¸­à¸à¸„à¸£à¸š =====
  PERFORM public.c154_claims(v_uid_adm::text); -- is_admin à¸ªà¸³à¸«à¸£à¸±à¸š guard 008 + deduct 026
  PERFORM public.c154_walk(v_on_friend);
  SELECT a.status INTO v_status FROM public.referral_attributions a
   WHERE a.order_number = v_on_friend;
  IF v_status <> 'qualified' THEN RAISE EXCEPTION 'G6 FAIL: expected qualified, got %', v_status; END IF;
  SELECT count(*) INTO v_n FROM public.referral_rewards r
   JOIN public.orders o ON o.id = r.order_id WHERE o.order_number = v_on_friend;
  IF v_n <> 2 THEN RAISE EXCEPTION 'G6 FAIL: expected 2 rewards, got %', v_n; END IF;
  IF EXISTS (
    SELECT 1 FROM public.referral_rewards r JOIN public.orders o ON o.id = r.order_id
     WHERE o.order_number = v_on_friend AND (r.amount <> 30 OR r.state <> 'issued')
  ) THEN RAISE EXCEPTION 'G6 FAIL: rewards must be issued at 30 each'; END IF;
  SELECT count(*) INTO v_n FROM public.notifications
   WHERE notification_type = 'referral'
     AND customer_id IN (v_uid_frn::text, v_uid_ref::text);
  IF v_n <> 2 THEN RAISE EXCEPTION 'G6 FAIL: expected 2 notifications, got %', v_n; END IF;
  -- à¸„à¸¹à¸›à¸­à¸‡à¸—à¸µà¹ˆà¸­à¸­à¸à¹ƒà¸Šà¹‰à¹„à¸”à¹‰à¸ˆà¸£à¸´à¸‡ (promotion_apply_rules = fixed 30 Â· à¸™à¸±à¸šà¹€à¸›à¹‡à¸™à¸à¸²à¸£à¹ƒà¸Šà¹‰ 1 à¸„à¸£à¸±à¹‰à¸‡)
  SELECT r.coupon_promotion_id INTO v_promo_pid
    FROM public.referral_rewards r JOIN public.orders o ON o.id = r.order_id
   WHERE o.order_number = v_on_friend AND r.beneficiary_role = 'referrer';
  IF public.promotion_apply_rules(v_promo_pid, 100, 100) <> 30 THEN
    RAISE EXCEPTION 'G6 FAIL: issued coupon should discount 30';
  END IF;
  -- issue à¸‹à¹‰à¸³ = 0 (à¹„à¸¡à¹ˆà¸­à¸­à¸à¸‹à¹‰à¸³à¹à¸¡à¹‰à¹€à¸£à¸µà¸¢à¸à¸•à¸£à¸‡ à¹†)
  IF public.referral_issue_rewards((SELECT o.id FROM public.orders o WHERE o.order_number = v_on_friend), false) <> 0 THEN
    RAISE EXCEPTION 'G6 FAIL: re-issue must return 0';
  END IF;
  SELECT count(*) INTO v_n FROM public.referral_rewards r
   JOIN public.orders o ON o.id = r.order_id WHERE o.order_number = v_on_friend;
  IF v_n <> 2 THEN RAISE EXCEPTION 'G6 FAIL: re-issue duplicated rows (% )', v_n; END IF;
  RAISE NOTICE 'G6 PASS (qualified + 2 coupons 30 + 2 notices + coupon à¹ƒà¸Šà¹‰à¹„à¸”à¹‰à¸ˆà¸£à¸´à¸‡ + à¹„à¸¡à¹ˆà¸­à¸­à¸à¸‹à¹‰à¸³)';

  -- ===== G7: à¸„à¸·à¸™à¹€à¸‡à¸´à¸™ â†’ reversed Â· à¸¢à¸à¹€à¸¥à¸´à¸à¸•à¸­à¸™ held â†’ void =====
  PERFORM public.c154_claims(v_uid_adm::text);
  UPDATE public.orders SET payment_status = 'paid'   WHERE order_number = v_on_friend;
  UPDATE public.orders SET payment_status = 'refund' WHERE order_number = v_on_friend;
  SELECT a.status INTO v_status FROM public.referral_attributions a WHERE a.order_number = v_on_friend;
  IF v_status <> 'reversed' THEN RAISE EXCEPTION 'G7 FAIL: expected reversed, got %', v_status; END IF;
  SELECT count(*) INTO v_n FROM public.referral_rewards r
   JOIN public.orders o ON o.id = r.order_id
   WHERE o.order_number = v_on_friend AND r.state = 'reversed';
  IF v_n <> 2 THEN RAISE EXCEPTION 'G7 FAIL: expected 2 reversed ledger rows, got %', v_n; END IF;
  -- à¸„à¸¹à¸›à¸­à¸‡à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹ƒà¸Šà¹‰ (friend Â· usage=0) = à¸–à¸¹à¸à¸›à¸´à¸” Â· à¸„à¸¹à¸›à¸­à¸‡à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¹„à¸›à¹à¸¥à¹‰à¸§ (referrer Â· usage=1) = à¸„à¸‡à¹„à¸§à¹‰
  IF EXISTS (
    SELECT 1 FROM public.referral_rewards r JOIN public.orders o ON o.id = r.order_id
     JOIN public.promotions p ON p.id = r.coupon_promotion_id
   WHERE o.order_number = v_on_friend AND r.beneficiary_role = 'friend'
     AND (p.is_active <> false OR p.usage_count <> 0)
  ) THEN RAISE EXCEPTION 'G7 FAIL: unused coupon should be deactivated'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.referral_rewards r JOIN public.orders o ON o.id = r.order_id
     JOIN public.promotions p ON p.id = r.coupon_promotion_id
   WHERE o.order_number = v_on_friend AND r.beneficiary_role = 'referrer'
     AND (p.is_active <> true OR p.usage_count <> 1)
  ) THEN RAISE EXCEPTION 'G7 FAIL: already-used coupon must be preserved (usage kept)'; END IF;
  -- à¹€à¸£à¸µà¸¢à¸ reverse à¸‹à¹‰à¸³ = 0 (à¹„à¸¡à¹ˆà¸«à¸±à¸à¸‹à¹‰à¸³)
  IF public.referral_reverse_rewards((SELECT o.id FROM public.orders o WHERE o.order_number = v_on_friend), 'again') <> 0 THEN
    RAISE EXCEPTION 'G7 FAIL: repeated reverse must return 0';
  END IF;
  -- à¸¢à¸à¹€à¸¥à¸´à¸à¸•à¸­à¸™à¸¢à¸±à¸‡ held = void (à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸­à¸­à¸ â†’ à¹„à¸¡à¹ˆà¸¡à¸µ ledger)
  PERFORM public.c154_claims(v_uid_vod::text);
  v_on_void := public.c154_make_order(v_uid_vod, '0991540007');
  v_res := public.referral_claim(v_on_void, v_ref_code);
  IF v_res->>'status' <> 'held' THEN RAISE EXCEPTION 'G7 FAIL: void-scenario claim: %', v_res; END IF;
  PERFORM public.c154_claims(v_uid_adm::text);
  UPDATE public.orders SET status = 'cancelled' WHERE order_number = v_on_void;
  SELECT a.status INTO v_status FROM public.referral_attributions a WHERE a.order_number = v_on_void;
  IF v_status <> 'void' THEN RAISE EXCEPTION 'G7 FAIL: expected void, got %', v_status; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_rewards r JOIN public.orders o ON o.id = r.order_id
              WHERE o.order_number = v_on_void) THEN
    RAISE EXCEPTION 'G7 FAIL: void must have zero rewards';
  END IF;
  RAISE NOTICE 'G7 PASS (refund â†’ reversed Â· unused coupon à¸›à¸´à¸”/used à¸„à¸‡à¹„à¸§à¹‰ Â· cancel à¸•à¸­à¸™ held â†’ void)';

  -- ===== G8: kill switch â€” à¸›à¸´à¸” = à¹„à¸¡à¹ˆà¸šà¸±à¸™à¸—à¸¶à¸ attribution à¹ƒà¸«à¸¡à¹ˆ =====
  UPDATE public.business_settings
     SET value = jsonb_set(value, '{enabled}', 'false'::jsonb, true)
   WHERE key = 'referral_policy';
  PERFORM public.c154_claims(v_uid_frn::text);
  v_on_kill := public.c154_make_order(v_uid_frn, '0991540002');
  v_res := public.referral_claim(v_on_kill, v_ref_code);
  IF v_res->>'status' <> 'disabled' THEN RAISE EXCEPTION 'G8 FAIL: expected disabled: %', v_res; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_attributions WHERE order_number = v_on_kill) THEN
    RAISE EXCEPTION 'G8 FAIL: kill switch must not record attribution';
  END IF;
  UPDATE public.business_settings
     SET value = jsonb_set(value, '{enabled}', 'true'::jsonb, true)
   WHERE key = 'referral_policy';
  RAISE NOTICE 'G8 PASS (kill switch: disabled + à¹„à¸¡à¹ˆà¸šà¸±à¸™à¸—à¸¶à¸à¹à¸–à¸§à¹ƒà¸«à¸¡à¹ˆ)';

  -- ===== G9: admin gates + Review (à¹€à¸žà¸”à¸²à¸™à¹€à¸à¸´à¸™) + approve =====
  PERFORM public.c154_claims(v_uid_frn::text); -- non-admin
  BEGIN
    PERFORM public.referral_admin_stats();
    RAISE EXCEPTION 'G9 FAIL: non-admin must not read stats';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.referral_resolve_attribution(v_on_friend, 'approve');
    RAISE EXCEPTION 'G9 FAIL: non-admin must not resolve';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN RAISE; END IF;
  END;
  -- à¹€à¸žà¸”à¸²à¸™ 0 = à¸—à¸¸à¸ claim à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸ªà¸–à¸²à¸™à¸°à¸žà¸±à¸à¸£à¸²à¸‡à¸§à¸±à¸¥ (Review â€” à¹„à¸¡à¹ˆà¹à¸šà¸™ à¹„à¸¡à¹ˆà¸­à¸­à¸à¸ˆà¸™à¸à¸§à¹ˆà¸²à¸ˆà¸°à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´)
  UPDATE public.business_settings
     SET value = jsonb_set(value, '{referrer_monthly_cap}', '0'::jsonb, true)
   WHERE key = 'referral_policy';
  PERFORM public.c154_claims(v_uid_rev::text);
  v_on_review := public.c154_make_order(v_uid_rev, '0991540006');
  v_res := public.referral_claim(v_on_review, v_ref_code);
  IF v_res->>'status' <> 'held' OR v_res->>'risk' <> 'review'
     OR v_res->>'reason' <> 'referrer_cap_exceeded' THEN
    RAISE EXCEPTION 'G9 FAIL: expected held/review: %', v_res;
  END IF;
  -- à¹€à¸”à¸´à¸™à¸–à¸¶à¸‡ delivered à¹à¸¥à¹‰à¸§à¸¢à¸±à¸‡ "à¸•à¹‰à¸­à¸‡à¹„à¸¡à¹ˆ" à¸­à¸­à¸ (à¸žà¸±à¸à¸£à¸²à¸‡à¸§à¸±à¸¥à¸£à¸­à¹à¸­à¸”à¸¡à¸´à¸™)
  PERFORM public.c154_claims(v_uid_adm::text);
  PERFORM public.c154_walk(v_on_review);
  SELECT a.status INTO v_status FROM public.referral_attributions a WHERE a.order_number = v_on_review;
  IF v_status <> 'held' THEN RAISE EXCEPTION 'G9 FAIL: review hold must persist, got %', v_status; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_rewards r JOIN public.orders o ON o.id = r.order_id
              WHERE o.order_number = v_on_review) THEN
    RAISE EXCEPTION 'G9 FAIL: rewards must not issue while risk=review';
  END IF;
  -- à¹à¸­à¸”à¸¡à¸´à¸™à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ â†’ à¸­à¸­à¸à¸•à¸­à¸™à¸™à¸µà¹‰ (à¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¸œà¹ˆà¸²à¸™ qualify à¹à¸¥à¹‰à¸§)
  v_res := public.referral_resolve_attribution(v_on_review, 'approve');
  IF COALESCE((v_res->>'issued')::integer, -1) <> 2 THEN
    RAISE EXCEPTION 'G9 FAIL: approve should issue 2, got %', v_res;
  END IF;
  SELECT count(*) INTO v_n FROM public.referral_rewards r
   JOIN public.orders o ON o.id = r.order_id WHERE o.order_number = v_on_review;
  IF v_n <> 2 THEN RAISE EXCEPTION 'G9 FAIL: approved rewards missing (% )', v_n; END IF;
  -- à¹à¸­à¸”à¸¡à¸´à¸™à¸­à¹ˆà¸²à¸™ stats à¹„à¸”à¹‰ (totals + recent à¸„à¸£à¸š)
  v_j := public.referral_admin_stats();
  IF jsonb_typeof(v_j) <> 'object' OR NOT (v_j ? 'policy') OR NOT (v_j ? 'totals') OR NOT (v_j ? 'recent')
     OR jsonb_typeof(v_j->'totals') <> 'object' OR jsonb_typeof(v_j->'recent') <> 'array' THEN
    RAISE EXCEPTION 'G9 FAIL: admin stats incomplete: %', v_j;
  END IF;
  -- à¸„à¸·à¸™à¸„à¹ˆà¸²à¹€à¸žà¸”à¸²à¸™ (à¸à¸±à¸™ step à¸–à¸±à¸”à¹„à¸›à¹ƒà¸™à¸ªà¸„à¸£à¸´à¸›à¸•à¹Œà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™à¹€à¸«à¹‡à¸™à¸„à¹ˆà¸²à¹à¸›à¸¥à¸ â€” tx à¸™à¸µà¹‰ rollback à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§)
  UPDATE public.business_settings
     SET value = jsonb_set(value, '{referrer_monthly_cap}', '20'::jsonb, true)
   WHERE key = 'referral_policy';
  RAISE NOTICE 'G9 PASS (admin-only gates Â· risk=review à¸„à¹‰à¸²à¸‡à¸ˆà¸™ approve Â· à¸­à¸­à¸ 2 à¹ƒà¸š Â· stats à¸„à¸£à¸š)';

  PERFORM set_config('request.jwt.claims', v_user_claims, true);
  RAISE NOTICE 'CONTRACT 154: PASS';
END $$;

ROLLBACK;