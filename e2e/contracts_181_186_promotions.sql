-- ============================================================
-- Contract 181+186 — Add-on Margin Rules + Promotion BKK Date Gate
-- ครอบคลุม:
--   181.1 business_settings.addon_margin_policy (enabled, max_discount_pct, min_addon_margin_pct, main_dish_required, cross_sell_enabled)
--   181.2 addon_margin_setting helper (reads from policy, default fallback)
--   181.3 compute_addons_price — ใช้ promo_price เมื่อแอดมินตั้ง > 0 มิฉะนั้น price ปกติ
--   181.4 promotion_apply_rules — เพดานส่วนลดรวมอ่านจาก addon_margin_policy.max_discount_pct (default 15)
--   186.1 promotion_apply_rules — start_date/end_date เทียบ (now() AT TIME ZONE 'Asia/Bangkok')::date
--   186.2 create_order_with_items — v_today = (now() AT TIME ZONE 'Asia/Bangkok')::date ทุกจุด
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin role ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- ---------- 181.1 addon_margin_policy schema ----------
DO $$
DECLARE v_policy jsonb;
BEGIN
  SELECT value INTO v_policy FROM public.business_settings WHERE key = 'addon_margin_policy';
  IF v_policy IS NULL THEN
    RAISE EXCEPTION '181.1 FAIL: addon_margin_policy missing';
  END IF;
  IF (v_policy->>'enabled')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '181.1 FAIL: enabled not true by default';
  END IF;
  IF (v_policy->>'max_discount_pct')::int <> 15 THEN
    RAISE EXCEPTION '181.1 FAIL: max_discount_pct default not 15: %', v_policy->>'max_discount_pct';
  END IF;
  IF (v_policy->>'min_addon_margin_pct')::int <> 0 THEN
    RAISE EXCEPTION '181.1 FAIL: min_addon_margin_pct default not 0: %', v_policy->>'min_addon_margin_pct';
  END IF;
  IF (v_policy->>'main_dish_required')::boolean IS TRUE THEN
    RAISE EXCEPTION '181.1 FAIL: main_dish_required should be false by default';
  END IF;
  IF (v_policy->>'cross_sell_enabled')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '181.1 FAIL: cross_sell_enabled not true by default';
  END IF;
  RAISE NOTICE '181.1 PASS: addon_margin_policy defaults OK';
END $$;

-- ---------- 181.2 addon_margin_setting helper ----------
DO $$
DECLARE v_val numeric;
BEGIN
  -- existing field
  v_val := public.addon_margin_setting('max_discount_pct', 99);
  IF v_val <> 15 THEN
    RAISE EXCEPTION '181.2 FAIL: max_discount_pct = % expected 15', v_val;
  END IF;

  -- non-existing field returns default
  v_val := public.addon_margin_setting('non_existent_field', 42);
  IF v_val <> 42 THEN
    RAISE EXCEPTION '181.2 FAIL: non-existent field should return default 42, got %', v_val;
  END IF;

  -- corrupted value (non-numeric): helper mirrors order_setting (plain cast) — throws 22P02, does NOT fallback
  UPDATE public.business_settings SET value = '{"max_discount_pct": "not-a-number"}'::jsonb WHERE key = 'addon_margin_policy';
  BEGIN
    v_val := public.addon_margin_setting('max_discount_pct', 99);
    RAISE EXCEPTION '181.2 FAIL: corrupted value should throw 22P02, got %', v_val;
  EXCEPTION WHEN invalid_text_representation THEN
    NULL; -- expected: plain cast throws, caller (compute_addons_price) guards with corrupted_settings check
  END;

  -- restore default
  UPDATE public.business_settings SET value = '{"enabled": true, "max_discount_pct": 15, "min_addon_margin_pct": 0, "main_dish_required": false, "cross_sell_enabled": true}'::jsonb WHERE key = 'addon_margin_policy';

  RAISE NOTICE '181.2 PASS: addon_margin_setting helper OK (read + missing-field fallback + corrupted throws 22P02)';
END $$;

-- ---------- 181.3 compute_addons_price uses promo_price ----------
DO $$
DECLARE
  v_prod_id text := 'prod-c181-1';
  v_total numeric;
BEGIN
  -- fixture product with addon having promo_price
  INSERT INTO public.products (id, name, price, category_id, is_available, available_same_day, available_preorder, addons)
  VALUES (v_prod_id, 'Contract 181 Product', 100, 'cat-1', true, true, true,
    '[{"id": "addon-1", "name": "Extra Topping", "type": "select", "price": 20, "promo_price": 15}]'::jsonb)
  ON CONFLICT (id) DO UPDATE SET addons = EXCLUDED.addons;

  -- select addon with promo_price > 0 → should use promo_price (15)
  v_total := public.compute_addons_price(v_prod_id, '{"addOns": [{"addonId": "addon-1", "selections": ["opt-1"]}]}'::jsonb);
  IF v_total <> 15 THEN
    RAISE EXCEPTION '181.3 FAIL: compute_addons_price should use promo_price=15, got %', v_total;
  END IF;

  -- promo_price = 0 → should use regular price
  UPDATE public.products SET addons = '[{"id": "addon-1", "name": "Extra Topping", "type": "select", "price": 20, "promo_price": 0}]'::jsonb WHERE id = v_prod_id;
  v_total := public.compute_addons_price(v_prod_id, '{"addOns": [{"addonId": "addon-1", "selections": ["opt-1"]}]}'::jsonb);
  IF v_total <> 20 THEN
    RAISE EXCEPTION '181.3 FAIL: promo_price=0 should fallback to price=20, got %', v_total;
  END IF;

  -- no addon selected → 0
  v_total := public.compute_addons_price(v_prod_id, '{"addOns": []}'::jsonb);
  IF v_total <> 0 THEN
    RAISE EXCEPTION '181.3 FAIL: no addon should return 0, got %', v_total;
  END IF;

  RAISE NOTICE '181.3 PASS: compute_addons_price uses promo_price when > 0';
END $$;

-- ---------- 181.4 promotion_apply_rules global cap from addon_margin_policy ----------
DO $$
DECLARE
  v_promo_id text := 'promo-c181-1';
  v_disc numeric;
BEGIN
  -- fixture promotion 100% off, min order 100 (100% so the cap is the binding constraint)
  INSERT INTO public.promotions (id, code, name, discount_type, discount_value, min_order_amount, is_active, start_date, end_date, applies_to)
  VALUES (v_promo_id, 'TEST100', 'Test 100%', 'percentage', 100, 100, true, CURRENT_DATE - 1, CURRENT_DATE + 30, 'all_products')
  ON CONFLICT (id) DO UPDATE SET discount_value = EXCLUDED.discount_value, min_order_amount = EXCLUDED.min_order_amount;

  -- neutralize monthly budget cap (promotion_policy.budget_percent = null = unlimited) so only the addon cap binds
  INSERT INTO public.business_settings (key, value) VALUES ('promotion_policy', '{"budget_percent": null, "promotions_enabled": true}'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  -- subtotal 1000, eligible 1000, 100% = 1000, cap = 15% of 1000 = 150
  v_disc := public.promotion_apply_rules(v_promo_id, 1000, 1000);
  IF v_disc <> 150 THEN
    RAISE EXCEPTION '181.4 FAIL: discount should be capped at 15%% (150), got %', v_disc;
  END IF;

  -- change policy to 25%
  UPDATE public.business_settings SET value = '{"enabled": true, "max_discount_pct": 25, "min_addon_margin_pct": 0, "main_dish_required": false, "cross_sell_enabled": true}'::jsonb WHERE key = 'addon_margin_policy';
  v_disc := public.promotion_apply_rules(v_promo_id, 1000, 1000);
  IF v_disc <> 250 THEN
    RAISE EXCEPTION '181.4 FAIL: with 25%% cap discount should be 250, got %', v_disc;
  END IF;

  -- cap at 90% max
  UPDATE public.business_settings SET value = '{"enabled": true, "max_discount_pct": 95, "min_addon_margin_pct": 0, "main_dish_required": false, "cross_sell_enabled": true}'::jsonb WHERE key = 'addon_margin_policy';
  v_disc := public.promotion_apply_rules(v_promo_id, 1000, 1000);
  IF v_disc <> 900 THEN
    RAISE EXCEPTION '181.4 FAIL: cap should be max 90%% (900), got %', v_disc;
  END IF;

  -- restore default addon_margin_policy + promotion_policy
  UPDATE public.business_settings SET value = '{"enabled": true, "max_discount_pct": 15, "min_addon_margin_pct": 0, "main_dish_required": false, "cross_sell_enabled": true}'::jsonb WHERE key = 'addon_margin_policy';
  UPDATE public.business_settings SET value = '{"budget_percent": 15, "promotions_enabled": true}'::jsonb WHERE key = 'promotion_policy';

  RAISE NOTICE '181.4 PASS: promotion_apply_rules global cap reads from addon_margin_policy';
END $$;

-- ---------- 186.1 promotion_apply_rules uses BKK date ----------
DO $$
DECLARE
  v_promo_id text := 'promo-c186-1';
  v_disc numeric;
BEGIN
  -- fixture promotion active only for tomorrow BKK date
  INSERT INTO public.promotions (id, code, name, discount_type, discount_value, min_order_amount, is_active, start_date, end_date, applies_to)
  VALUES (v_promo_id, 'BKKTOM', 'Tomorrow Only', 'percentage', 10, 0, true, (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, 'all_products')
  ON CONFLICT (id) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date;

  -- today BKK: should NOT apply (start_date is tomorrow)
  v_disc := public.promotion_apply_rules(v_promo_id, 1000, 1000);
  IF v_disc <> 0 THEN
    RAISE EXCEPTION '186.1 FAIL: promotion for tomorrow BKK should not apply today, got %', v_disc;
  END IF;

  -- fixture promotion active today BKK
  INSERT INTO public.promotions (id, code, name, discount_type, discount_value, min_order_amount, is_active, start_date, end_date, applies_to)
  VALUES ('promo-c186-2', 'BKKTODAY', 'Today BKK', 'percentage', 10, 0, true, (now() AT TIME ZONE 'Asia/Bangkok')::date, (now() AT TIME ZONE 'Asia/Bangkok')::date, 'all_products')
  ON CONFLICT (id) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date;

  v_disc := public.promotion_apply_rules('promo-c186-2', 1000, 1000);
  IF v_disc <> 100 THEN
    RAISE EXCEPTION '186.1 FAIL: promotion active today BKK should apply (10%% of 1000 = 100), got %', v_disc;
  END IF;

  RAISE NOTICE '186.1 PASS: promotion_apply_rules uses BKK date for start/end';
END $$;

-- ---------- 186.2 create_order_with_items uses v_today = BKK date ----------
DO $$
DECLARE
  v_uid uuid := '210a1680-0000-4000-8000-000000000002';
  v_result jsonb;
  v_round_id text;
  v_branch_id text;
  v_lat numeric;
  v_lon numeric;
BEGIN
  -- dropoff near kitchen_location (same pattern as contracts_124) — self_delivery 5km gate
  v_lat := (public.kitchen_location()->>'latitude')::numeric + 0.002;
  v_lon := (public.kitchen_location()->>'longitude')::numeric + 0.002;

  -- fixture: branch, round, product, delivery round
  INSERT INTO public.branches (id, code, slug, name, tenant_id, address_line1, latitude, longitude, kitchen_latitude, kitchen_longitude, status)
  VALUES ('br-c186', 'c186', 'c186', 'Contract 186 Branch', 'tenant-bmb-001', '186 Test Road', v_lat, v_lon, v_lat, v_lon, 'active')
  ON CONFLICT (id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, kitchen_latitude = EXCLUDED.kitchen_latitude, kitchen_longitude = EXCLUDED.kitchen_longitude;

  INSERT INTO public.delivery_rounds (id, branch_id, tenant_id, name, display_name, scheduled_date, cutoff_time, delivery_start, delivery_end, status, max_capacity, current_count)
  VALUES ('round-c186-today', 'br-c186', 'tenant-bmb-001', 'Today Round', 'Today Round', (now() AT TIME ZONE 'Asia/Bangkok')::date, '22:00', '10:00', '12:00', 'active', 50, 0)
  ON CONFLICT (id) DO UPDATE SET scheduled_date = EXCLUDED.scheduled_date, status = EXCLUDED.status;

  INSERT INTO public.delivery_rounds (id, branch_id, tenant_id, name, display_name, scheduled_date, cutoff_time, delivery_start, delivery_end, status, max_capacity, current_count)
  VALUES ('round-c186-tomorrow', 'br-c186', 'tenant-bmb-001', 'Tomorrow Round', 'Tomorrow Round', (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, '22:00', '10:00', '12:00', 'active', 50, 0)
  ON CONFLICT (id) DO UPDATE SET scheduled_date = EXCLUDED.scheduled_date, status = EXCLUDED.status;

  INSERT INTO public.products (id, name, price, category_id, is_available, available_same_day, available_preorder)
  VALUES ('prod-c186-1', 'Contract 186 Product', 100, 'cat-1', true, true, true)
  ON CONFLICT (id) DO NOTHING;

  -- delivery zone for br-c186 (fee lookup needs a zone covering the dropoff distance)
  INSERT INTO public.delivery_zones (id, name, min_distance_km, max_distance_km, fee, is_active, tenant_id, branch_id)
  VALUES ('zone-c186', 'Contract 186 Zone', 0.00, 5.00, 25.00, true, 'tenant-bmb-001', 'br-c186')
  ON CONFLICT (id) DO NOTHING;

  -- fixture customer
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_uid,'fixture-c186@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name) VALUES ('cust-c186', v_uid, 'Contract 186 Customer')
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);

  -- SAME_DAY order with today's round (should work)
  v_result := public.create_order_with_items(
    '[{"product_id": "prod-c186-1", "quantity": 1, "options": {}}]'::jsonb,
    'round-c186-today',
    'self_delivery',
    'Test Address',
    v_lat, v_lon,
    'Test Customer', '0812345678',
    'promptpay_qr', '', NULL, 2.0, 'SAME_DAY', NULL, 'br-c186', NULL, NULL, v_uid
  );
  IF v_result ? 'error' THEN
    RAISE EXCEPTION '186.2 FAIL: SAME_DAY today round failed: %', v_result;
  END IF;

  -- SAME_DAY order with tomorrow's round (should raise ERR_ROUND_DATE — function raises, not returns)
  BEGIN
    v_result := public.create_order_with_items(
      '[{"product_id": "prod-c186-1", "quantity": 1, "options": {}}]'::jsonb,
      'round-c186-tomorrow',
      'self_delivery',
      'Test Address',
      v_lat, v_lon,
      'Test Customer', '0812345678',
      'promptpay_qr', '', NULL, 2.0, 'SAME_DAY', NULL, 'br-c186', NULL, NULL, v_uid
    );
    -- if we get here, the order was created — FAIL
    RAISE EXCEPTION '186.2 FAIL: SAME_DAY tomorrow round should fail ERR_ROUND_DATE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ROUND_DATE%' THEN
      RAISE EXCEPTION '186.2 FAIL: expected ERR_ROUND_DATE, got: %', SQLERRM;
    END IF;
  END;

  -- PRE_ORDER for today (should work if before cutoff; cutoff/setting errors are acceptable)
  BEGIN
    v_result := public.create_order_with_items(
      '[{"product_id": "prod-c186-1", "quantity": 1, "options": {}}]'::jsonb,
      'round-c186-today',
      'self_delivery',
      'Test Address',
      v_lat, v_lon,
      'Test Customer', '0812345678',
      'promptpay_qr', '', NULL, 2.0, 'PRE_ORDER', (now() AT TIME ZONE 'Asia/Bangkok')::date, 'br-c186', NULL, NULL, v_uid
    );
    -- success is acceptable
  EXCEPTION WHEN OTHERS THEN
    -- might fail if past cutoff, that's OK
    IF SQLERRM NOT LIKE '%ERR_CUTOFF_PASSED%' AND SQLERRM NOT LIKE '%ERR_PRE_ORDER_REQUIRES_MENU%' THEN
      RAISE EXCEPTION '186.2 FAIL: PRE_ORDER today unexpected error: %', SQLERRM;
    END IF;
  END;

  RAISE NOTICE '186.2 PASS: create_order_with_items uses BKK date for round/scheduled_date';
END $$;

ROLLBACK;