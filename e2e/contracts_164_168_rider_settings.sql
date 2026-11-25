-- ============================================================
-- Contract 164 + 165 + 166 + 168 — settings read-open / seo seed /
-- rider POD path layer / multi-job rider status flow
-- ครอบคลุม:
--   164.1 policy business_settings_public_read = TO anon, authenticated USING(true)
--   164.2 anon SELECT business_settings ได้จริง
--   165.1 seed key 'seo' มี description/tagline ตรงค่าที่กำหนด
--   166.1 delivery_assignments_status_check รับ 'arrived'
--   166.2 driver_path_folder: sanitize + decode %XX ก่อน strip (169 regression fix)
--   166.3 current_driver_id() helper มีอยู่ (trusted, SECURITY DEFINER)
--   168.1 สถานะนอกชุด -> ERR_INVALID_DELIVERY_STATUS
--   168.2 delivered โดยไม่มี POD -> ERR_POD_REQUIRED
--   168.3 วงจรเต็ม: picked_up -> attach POD -> delivered (hop walk) ·
--         multi-job: delivered ใบแรก = ยัง busy (งานค้าง) · ใบสุดท้าย = available
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- 164.1 policy shape ----------
DO $$
DECLARE v_roles text;
BEGIN
  SELECT array_to_string(roles, ',') INTO v_roles FROM pg_policies
   WHERE schemaname='public' AND tablename='business_settings' AND policyname='business_settings_public_read';
  IF v_roles IS NULL THEN RAISE EXCEPTION '164.1 FAIL: business_settings_public_read missing'; END IF;
  IF v_roles NOT LIKE '%anon%' OR v_roles NOT LIKE '%authenticated%' THEN
    RAISE EXCEPTION '164.1 FAIL: policy roles = % (expected anon + authenticated)', v_roles;
  END IF;
  RAISE NOTICE '164.1 PASS: public_read policy covers anon + authenticated';
END $$;

-- ---------- 164.2 anon can SELECT all settings ----------
DO $$
DECLARE v_cnt int;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_cnt FROM public.business_settings;
  RESET ROLE;
  IF v_cnt < 5 THEN RAISE EXCEPTION '164.2 FAIL: anon sees only % settings rows', v_cnt; END IF;
  RAISE NOTICE '164.2 PASS: anon reads all business settings rows (%)', v_cnt;
END $$;

-- ---------- 165.1 seo seed ----------
DO $$
DECLARE v_seo jsonb;
BEGIN
  SELECT value INTO v_seo FROM public.business_settings WHERE key='seo';
  IF v_seo IS NULL THEN RAISE EXCEPTION '165.1 FAIL: seo key missing'; END IF;
  IF COALESCE(v_seo->>'description','') = '' OR COALESCE(v_seo->>'tagline','') = '' THEN
    RAISE EXCEPTION '165.1 FAIL: seo incomplete %', v_seo;
  END IF;
  IF v_seo->>'tagline' NOT LIKE '%จันทบุรี%' THEN
    RAISE EXCEPTION '165.1 FAIL: seo tagline unexpected %', v_seo->>'tagline';
  END IF;
  RAISE NOTICE '165.1 PASS: seo seed present with real copy';
END $$;

-- ---------- 166.1 assignment CHECK includes arrived ----------
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.delivery_assignments'::regclass AND conname='delivery_assignments_status_check';
  IF v_def IS NULL THEN RAISE EXCEPTION '166.1 FAIL: status check constraint missing'; END IF;
  IF v_def NOT LIKE '%arrived%' THEN RAISE EXCEPTION '166.1 FAIL: arrived not allowed (%s)', v_def; END IF;
  RAISE NOTICE '166.1 PASS: assignment status check accepts arrived';
END $$;

-- ---------- 166.2 path folder sanitize (166 + 169 regression) ----------
DO $$
DECLARE v_plain text; v_pct text; v_dirty text;
BEGIN
  v_plain := public.driver_path_folder('drv- c168-60bc');
  IF v_plain <> 'drv-c168-60bc' THEN RAISE EXCEPTION '166.2 FAIL: plain strip got %', v_plain; END IF;
  -- 169: %XX run ต้องถูกตัดก่อน strip — folder encoded กับ id สกปรกต้องเทียบเท่ากัน
  v_pct  := public.driver_path_folder('drv-%20c168-60bc');
  IF v_pct <> v_plain THEN
    RAISE EXCEPTION '166.2 FAIL: %%XX run not dropped first (% vs %)', v_pct, v_plain;
  END IF;
  v_dirty := public.driver_path_folder('drv-%23abc');
  IF v_dirty <> 'drv-abc' THEN RAISE EXCEPTION '166.2 FAIL: percent-hash got %', v_dirty; END IF;
  RAISE NOTICE '166.2 PASS: driver_path_folder sanitizes + drops %%XX runs';
END $$;

-- ---------- 166.3 trusted helper exists ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='current_driver_id') THEN
    RAISE EXCEPTION '166.3 FAIL: current_driver_id missing';
  END IF;
  RAISE NOTICE '166.3 PASS: current_driver_id helper exists';
END $$;

-- ---------- 168 fixtures: driver + 2 orders + assignments ----------
DO $$
DECLARE v_uid uuid := '210a1680-0000-4000-8000-000000000001'; v_v2 uuid := '210a1680-0000-4000-8000-000000000002';
        v_branch text; v_tomorrow date := (now() AT TIME ZONE 'Asia/Bangkok')::date + 1;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_uid,'fixture-driver-168@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated'),
         (v_v2,'fixture-cust-168@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.drivers (id, name, phone, vehicle_label, status, user_id)
  VALUES ('drv-c168', 'Contract 168 Rider', '0-168-0000001', 'Bite #1', 'busy', v_uid)
  ON CONFLICT (id) DO NOTHING;
  -- round fixture สำหรับวันพรีออเดอร์ (enforce_pre_order_window ต้องเจอ round ตาม id)
  SELECT id INTO v_branch FROM public.branches ORDER BY created_at LIMIT 1;
  INSERT INTO public.delivery_rounds (id, round_key, name, display_name, cutoff_time, delivery_start,
    delivery_end, pre_order_cutoff, max_capacity, current_count, date, scheduled_date, status, branch_id)
  VALUES ('round-c168-pre', 'evening', 'evening', 'Contract 168 Pre', '23:00', '23:30', '23:59',
    '23:59', 100, 0, v_tomorrow, v_tomorrow, 'active', v_branch)
  ON CONFLICT (id) DO NOTHING;
  -- สองออเดอร์ (พรีออเดอร์รอบเดียวส่งหลายที่) — ready_for_dispatch เพื่อให้ hop walk ไปถึง delivered
  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, customer_ref, status,
    delivery_method, dropoff_detail, dropoff_latitude, dropoff_longitude, subtotal, delivery_fee, total_amount,
    payment_status, order_mode, scheduled_date, delivery_round_id)
  VALUES ('ord-c168-a', 'PO-C168-A', 'cust-168', 'Rider Test A', '0333333331', v_v2, 'ready_for_dispatch',
    'self_delivery', 'จุดส่ง A', 13.0, 102.0, 50, 0, 50, 'pending', 'PRE_ORDER',
    v_tomorrow, 'round-c168-pre'),
         ('ord-c168-b', 'PO-C168-B', 'cust-168', 'Rider Test B', '0333333331', v_v2, 'ready_for_dispatch',
    'self_delivery', 'จุดส่ง B', 13.0, 102.0, 50, 0, 50, 'pending', 'PRE_ORDER',
    v_tomorrow, 'round-c168-pre');
  INSERT INTO public.delivery_assignments (id, order_number, driver_id, status)
  VALUES ('da-c168-a', 'PO-C168-A', 'drv-c168', 'accepted'),
         ('da-c168-b', 'PO-C168-B', 'drv-c168', 'accepted');
END $$;

SELECT set_config('request.jwt.claims',
  '{"sub":"210a1680-0000-4000-8000-000000000001","role":"authenticated"}', true);

DO $$
BEGIN
  -- ---------- 168.1 invalid status ----------
  BEGIN
    PERFORM public.driver_update_delivery_status('PO-C168-A','0-168-0000001','arrived');
    RAISE EXCEPTION '168.1 FAIL: invalid status accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_INVALID_DELIVERY_STATUS%' THEN
      RAISE EXCEPTION '168.1 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '168.1 PASS: invalid status rejected';

  -- ---------- 168.2 delivered without POD ----------
  BEGIN
    PERFORM public.driver_update_delivery_status('PO-C168-A','0-168-0000001','delivered', 13.0, 102.0);
    RAISE EXCEPTION '168.2 FAIL: delivered without POD accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_POD_REQUIRED%' THEN
      RAISE EXCEPTION '168.2 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '168.2 PASS: POD required before delivered';

  -- ---------- 168.3 full flow + multi-job availability ----------
  PERFORM public.driver_update_delivery_status('PO-C168-A','0-168-0000001','picked_up');
  IF NOT EXISTS (SELECT 1 FROM public.delivery_assignments WHERE order_number='PO-C168-A' AND status='picked_up') THEN
    RAISE EXCEPTION '168.3 FAIL: assignment not picked_up';
  END IF;

  PERFORM public.driver_attach_pod('PO-C168-A', 'drv-c168/pod-a.jpg');
  PERFORM public.driver_update_delivery_status('PO-C168-A','0-168-0000001','delivered', 13.0, 102.0);
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number='PO-C168-A' AND status='delivered') THEN
    RAISE EXCEPTION '168.3 FAIL: order A not delivered after hop walk';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id='drv-c168' AND status='busy') THEN
    RAISE EXCEPTION '168.3 FAIL: multi-job rule broken — rider must stay busy while B is pending';
  END IF;

  PERFORM public.driver_attach_pod('PO-C168-B', 'drv-c168/pod-b.jpg');
  PERFORM public.driver_update_delivery_status('PO-C168-B','0-168-0000001','delivered', 13.0, 102.0);
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id='drv-c168' AND status='available') THEN
    RAISE EXCEPTION '168.3 FAIL: rider with no pending jobs must be available';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_assignments WHERE order_number='PO-C168-B'
                 AND status='delivered' AND proof_of_delivery_path IS NOT NULL) THEN
    RAISE EXCEPTION '168.3 FAIL: POD path not persisted on B';
  END IF;
  RAISE NOTICE '168.3 PASS: full rider flow + multi-job availability rule';
END $$;

ROLLBACK;