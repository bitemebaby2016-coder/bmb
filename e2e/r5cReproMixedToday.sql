-- ============================================
-- R5c repro probe (Owner 2026-10-24): mixed cart (calendar menu + general product)
-- PRE_ORDER for the menu date = TODAY → "สร้างออเดอร์ล้มเหลว" on production.
-- ONE transaction + ROLLBACK at the end — ZERO persisted data.
-- Results are printed via the final RAISE EXCEPTION (visible in the API response).
-- ============================================

BEGIN;
RESET ROLE;

-- fake auth user for FK (Management API has no real JWT)
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000ce0001', 'repro@example.com');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000ce0001","role":"service_role"}', true);

INSERT INTO public.business_settings (key, value) VALUES
  ('delivery_policy', '{"external_methods_enabled":[],"allow_external_within_radius":false,"bite_drive_radius_km":10,"bite_drive_enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value || business_settings.value;

DO $$
DECLARE
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_now text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS');
  v_menu_pid text; v_gen_pid text; v_evening text; v_noon text; v_branch text;
  v_lat numeric; v_lng numeric;
  v_round_keys text := ''; v_menu_keys text := '';
  v_out text := '';
  v_ok boolean; v_err text;
  r record;
BEGIN
  -- facts: menu rows of today + their round binding
  FOR r IN SELECT product_id, delivery_round_key FROM public.menu_schedule
            WHERE scheduled_date = v_today AND is_published = true ORDER BY product_id LOOP
    v_menu_keys := v_menu_keys || r.product_id || '=' || COALESCE(r.delivery_round_key, 'ANY') || ' ';
  END LOOP;
  -- facts: today's rounds
  FOR r IN SELECT id, round_key, cutoff_time, delivery_start, delivery_end, status
             FROM public.delivery_rounds WHERE scheduled_date = v_today ORDER BY delivery_start LOOP
    v_round_keys := v_round_keys || r.id || '(' || COALESCE(r.round_key,'?') || ' ' || COALESCE(r.delivery_start::text,'?') || '-' ||
                    COALESCE(r.delivery_end::text,'?') || ' cutoff ' || COALESCE(r.cutoff_time::text,'?') || ' ' || r.status || ') ';
  END LOOP;

  SELECT product_id INTO v_menu_pid FROM public.menu_schedule
   WHERE scheduled_date = v_today AND is_published = true ORDER BY product_id LIMIT 1;
  SELECT id INTO v_gen_pid FROM public.products p
   WHERE p.is_available AND COALESCE(p.available_same_day,false)
     AND NOT EXISTS (SELECT 1 FROM public.menu_schedule ms
                      WHERE ms.product_id = p.id AND ms.is_published AND ms.scheduled_date >= v_today)
   ORDER BY p.sort_order LIMIT 1;
  SELECT id INTO v_noon FROM public.delivery_rounds
   WHERE scheduled_date = v_today ORDER BY delivery_start LIMIT 1;
  SELECT id INTO v_evening FROM public.delivery_rounds
   WHERE scheduled_date = v_today ORDER BY delivery_start DESC LIMIT 1;

  SELECT br.branch_id INTO v_branch FROM public.delivery_rounds br WHERE br.id = v_evening;
  SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001,
         COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001
    INTO v_lat, v_lng FROM public.branches b WHERE b.id = v_branch;

  v_out := v_out || format('[now=%s today=%s menu={%s} rounds={%s} pid menu=%s gen=%s noon=%s evening=%s] ',
    v_now, v_today, v_menu_keys, v_round_keys, v_menu_pid, v_gen_pid, v_noon, v_evening);

  -- S1: OWNER SCENARIO — mixed cart (menu + general), PRE_ORDER, date = today, EVENING round
  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := jsonb_build_array(
        jsonb_build_object('product_id', v_menu_pid, 'quantity', 1),
        jsonb_build_object('product_id', v_gen_pid, 'quantity', 1)),
      p_delivery_round_id := v_evening,
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_today,
      p_customer_name := 'repro', p_customer_phone := '0900000000', p_delivery_address := 'repro-addr',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng);
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  v_out := v_out || format('S1(mixed+evening+today) ok=%s err=%s | ', v_ok, v_err);

  -- S2: same cart but NOON round (the one Owner says must already be cutoff-passed)
  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := jsonb_build_array(
        jsonb_build_object('product_id', v_menu_pid, 'quantity', 1),
        jsonb_build_object('product_id', v_gen_pid, 'quantity', 1)),
      p_delivery_round_id := v_noon,
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_today,
      p_customer_name := 'repro', p_customer_phone := '0900000000', p_delivery_address := 'repro-addr',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng);
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  v_out := v_out || format('S2(mixed+noon+today) ok=%s err=%s | ', v_ok, v_err);

  -- S3: pure general cart, PRE_ORDER, today (142 gate regression — expect ERR_PRE_ORDER_REQUIRES_MENU)
  v_ok := false; v_err := '';
  BEGIN
    PERFORM 1 FROM public.create_order_with_items(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_gen_pid, 'quantity', 1)),
      p_delivery_round_id := v_evening,
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_today,
      p_customer_name := 'repro', p_customer_phone := '0900000000', p_delivery_address := 'repro-addr',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng);
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  v_out := v_out || format('S3(general-only+today) ok=%s err=%s', v_ok, v_err);

  RAISE EXCEPTION 'REPRO_RESULTS %', v_out;
END $$;

ROLLBACK;