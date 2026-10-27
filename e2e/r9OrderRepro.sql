-- ============================================
-- R9 order-creation repro probe (Owner defect 2026-10-27):
--   "สั่งพรีออเดอร์อย่างเดียว / พรี+แซมเดย์ / แซมเดย์ = สร้างออเดอร์ล้มเหลว"
-- ONE transaction + ROLLBACK at the end — ZERO persisted data (same harness as
-- r5cReproMixedToday). Calls the CLIENT RPC path `create_order_with_items_i`
-- (with p_client_submit_key) exactly like CheckoutPage does.
-- Results print via final RAISE EXCEPTION (visible in the API response).
-- ============================================

BEGIN;
RESET ROLE;

-- fake auth user for FK (Management API has no real JWT)
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000ce0002', 'repro-r9@example.com');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000ce0002","role":"service_role"}', true);

DO $$
DECLARE
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_now text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS');
  v_menu_date date; v_menu_pid text; v_gen_pid text; v_food_pid text;
  v_round_pre text; v_round_today text;
  v_lat numeric; v_lng numeric;
  v_out text := ''; v_ok boolean; v_err text;
BEGIN
  -- ===== FACTS =====
  SELECT ms.scheduled_date, ms.product_id INTO v_menu_date, v_menu_pid
    FROM public.menu_schedule ms
   WHERE ms.scheduled_date >= v_today AND ms.is_published = true
   ORDER BY ms.scheduled_date, ms.product_id LIMIT 1;

  SELECT id INTO v_gen_pid FROM public.products p
   WHERE p.is_available AND COALESCE(p.available_same_day, false)
     AND NOT EXISTS (SELECT 1 FROM public.menu_schedule ms
                      WHERE ms.product_id = p.id AND ms.is_published AND ms.scheduled_date >= v_today)
   ORDER BY p.sort_order LIMIT 1;

  SELECT id INTO v_food_pid FROM public.products p
   WHERE p.is_available AND NOT COALESCE(p.available_same_day, true)
   ORDER BY p.sort_order LIMIT 1;

  SELECT id INTO v_round_pre FROM public.delivery_rounds
   WHERE scheduled_date = v_menu_date AND status = 'active' AND archived = false
   ORDER BY delivery_start DESC LIMIT 1;
  SELECT id INTO v_round_today FROM public.delivery_rounds
   WHERE scheduled_date = v_today AND status = 'active' AND archived = false
   ORDER BY delivery_start DESC LIMIT 1;

  SELECT COALESCE(b.kitchen_latitude, (public.kitchen_location()->>'latitude')::numeric) + 0.001,
         COALESCE(b.kitchen_longitude, (public.kitchen_location()->>'longitude')::numeric) + 0.001
    INTO v_lat, v_lng FROM public.branches b WHERE b.id = 'branch-tenant-bmb-001-main';

  v_out := v_out || format('[now=%s today=%s menu_date=%s menu_pid=%s gen_pid=%s food_pid=%s round_pre=%s round_today=%s] ',
    v_now, v_today, v_menu_date, v_menu_pid, v_gen_pid, v_food_pid, v_round_pre, v_round_today);

  -- ===== S1: PRE_ORDER ONLY (calendar menu item) =====
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.create_order_with_items_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_menu_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round_pre,
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_menu_date,
      p_customer_name := 'r9repro', p_customer_phone := '0900000000',
      p_delivery_method := 'self_delivery', p_delivery_address := 'r9-repro-addr',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng,
      p_payment_method := 'promptpay_qr',
      p_branch_id := 'branch-tenant-bmb-001-main',
      p_client_submit_key := 'R9-REPRO-S1');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  v_out := v_out || format('S1(pure-preorder) ok=%s err=%s | ', v_ok, v_err);

  -- ===== S2: MIXED PRE_ORDER (calendar menu + general same-day product) =====
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.create_order_with_items_i(
      p_items := jsonb_build_array(
        jsonb_build_object('product_id', v_menu_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', ''),
        jsonb_build_object('product_id', v_gen_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round_pre,
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_menu_date,
      p_customer_name := 'r9repro', p_customer_phone := '0900000000',
      p_delivery_method := 'self_delivery', p_delivery_address := 'r9-repro-addr',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng,
      p_payment_method := 'promptpay_qr',
      p_branch_id := 'branch-tenant-bmb-001-main',
      p_client_submit_key := 'R9-REPRO-S2');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  v_out := v_out || format('S2(mixed-preorder) ok=%s err=%s | ', v_ok, v_err);

  -- ===== S3: SAME_DAY (general product, today round) =====
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.create_order_with_items_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_gen_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round_today,
      p_order_mode := 'SAME_DAY',
      p_customer_name := 'r9repro', p_customer_phone := '0900000000',
      p_delivery_method := 'self_delivery', p_delivery_address := 'r9-repro-addr',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng,
      p_payment_method := 'promptpay_qr',
      p_branch_id := 'branch-tenant-bmb-001-main',
      p_client_submit_key := 'R9-REPRO-S3');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  v_out := v_out || format('S3(sameday-general) ok=%s err=%s | ', v_ok, v_err);

  -- ===== S4: SAME_DAY with a pre-order-only food (available_same_day=false) =====
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.create_order_with_items_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_food_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round_today,
      p_order_mode := 'SAME_DAY',
      p_customer_name := 'r9repro', p_customer_phone := '0900000000',
      p_delivery_method := 'self_delivery', p_delivery_address := 'r9-repro-addr',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng,
      p_payment_method := 'promptpay_qr',
      p_branch_id := 'branch-tenant-bmb-001-main',
      p_client_submit_key := 'R9-REPRO-S4');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  v_out := v_out || format('S4(sameday-food) ok=%s err=%s | ', v_ok, v_err);

  -- ===== S5: SAME_DAY food + general together (mixed same-day) =====
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.create_order_with_items_i(
      p_items := jsonb_build_array(
        jsonb_build_object('product_id', v_food_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', ''),
        jsonb_build_object('product_id', v_gen_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round_today,
      p_order_mode := 'SAME_DAY',
      p_customer_name := 'r9repro', p_customer_phone := '0900000000',
      p_delivery_method := 'self_delivery', p_delivery_address := 'r9-repro-addr',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng,
      p_payment_method := 'promptpay_qr',
      p_branch_id := 'branch-tenant-bmb-001-main',
      p_client_submit_key := 'R9-REPRO-S5');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  v_out := v_out || format('S5(sameday-mixed) ok=%s err=%s', v_ok, v_err);

  -- ===== S6: PRE_ORDER with EMPTY delivery address (Owner defect 2026-10-27 root cause) =====
  v_ok := false; v_err := '';
  BEGIN
    PERFORM public.create_order_with_items_i(
      p_items := jsonb_build_array(jsonb_build_object('product_id', v_menu_pid, 'quantity', 1, 'options', '{}'::jsonb, 'special_request', '')),
      p_delivery_round_id := v_round_pre,
      p_order_mode := 'PRE_ORDER',
      p_scheduled_date := v_menu_date,
      p_customer_name := 'r9repro', p_customer_phone := '0900000000',
      p_delivery_method := 'self_delivery', p_delivery_address := '',
      p_dropoff_latitude := v_lat, p_dropoff_longitude := v_lng,
      p_payment_method := 'promptpay_qr',
      p_branch_id := 'branch-tenant-bmb-001-main',
      p_client_submit_key := 'R9-REPRO-S6');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  v_out := v_out || format(' | S6(preorder-empty-addr) ok=%s err=%s', v_ok, v_err);

  RAISE EXCEPTION 'R9_RESULTS %', v_out;
END $$;

ROLLBACK;
