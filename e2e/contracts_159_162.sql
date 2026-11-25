-- ============================================================
-- Contract 159 + 160 + 161 + 162 — legacy drops / shop-hours gate /
-- order notifications + address photo / admin reject payment
-- ครอบคลุม:
--   159.1 legacy manual-era functions ทั้ง 6 ไม่มีอยู่ใน chain
--   160.1 trg_shop_hours: SAME_DAY นอกเวลา -> ERR_STORE_CLOSED / PRE_ORDER นอกเวลา -> ผ่าน
--   160.2 ไม่มีแถว hours -> ข้าม (ไม่เดาปิด)
--   161.1 orders.address_photo_url มีจริง
--   161.2 INSERT order -> notification ORDER_CREATED (owner=customer) ครบ 1 แถว
--   161.3 notification_prefs Transactional=false -> ไม่แทรก
--   161.4 UPDATE status -> ORDER_CONFIRMED แถวใหม่
--   161.5 attach_address_photo: เจ้าของได้ / คนอื่น ERR_FORBIDDEN
--   162.1 admin_reject_payment: admin -> payment_status คง pending + audit / delivered -> ERR_ORDER_CLOSED / non-admin ERR_FORBIDDEN
--   162.2 get_address_photo: admin อ่านได้ / non-admin ERR_FORBIDDEN
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin role (ยกก่อนตั้ง JWT ใด ๆ — 014 bootstrap path) ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';

-- ---------- 159.1 legacy functions gone ----------
DO $$
DECLARE v_found int;
BEGIN
  SELECT count(*) INTO v_found FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND (
     (p.proname='auto_approve_order' AND pg_get_function_identity_arguments(p.oid)='')
  OR (p.proname='calculate_loyalty_points' AND pg_get_function_identity_arguments(p.oid)='p_order_total numeric')
  OR (p.proname='check_product_availability' AND pg_get_function_identity_arguments(p.oid)='p_product_id uuid')
  OR (p.proname='mark_payment_failed' AND pg_get_function_identity_arguments(p.oid)='p_order_number text, p_reason text')
  OR (p.proname='update_order_status' AND pg_get_function_identity_arguments(p.oid)='')
  OR (p.proname='validate_order_before_submit' AND pg_get_function_identity_arguments(p.oid)=''));
  IF v_found <> 0 THEN RAISE EXCEPTION '159.1 FAIL: % legacy manual-era function(s) still exist', v_found; END IF;
  RAISE NOTICE '159.1 PASS: all 6 legacy manual-era functions dropped';
END $$;

-- ---------- fixture: customer + helpers ----------
DO $$
BEGIN
  INSERT INTO public.customers (id, user_id, full_name, phone)
  VALUES ('cust-c161', 'dddf4b57-405f-4852-a985-76d8d52b1b72', 'Contract 161 Customer', '0111111111')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.customers (id, user_id, full_name, phone)
  VALUES ('cust-c161-b', NULL, 'Contract 161 B', '0222222222')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ---------- 160/161 order helper: ต้องครบ NOT NULL และผ่าน gate ทั้งหมด ----------
DO $$
DECLARE v_order text;
BEGIN
  -- 160.1: ตั้ง hours ช่วงแคบที่ "อนาคต 2-3 นาที" — เวลาปัจจุบัน (BKK) อยู่นอกช่วงเสมอ
  --        (dynamic กันผลแปรตามเวลา runner — ไม่ hardcode ช่วงตายตัว)
  INSERT INTO public.business_settings (key, value)
  VALUES ('hours', jsonb_build_object(
    'open',  to_char((now() AT TIME ZONE 'Asia/Bangkok')::time + interval '2 minutes', 'HH24:MI'),
    'close', to_char((now() AT TIME ZONE 'Asia/Bangkok')::time + interval '3 minutes', 'HH24:MI')))
  ON CONFLICT (key) DO UPDATE
    SET value = jsonb_build_object(
      'open',  to_char((now() AT TIME ZONE 'Asia/Bangkok')::time + interval '2 minutes', 'HH24:MI'),
      'close', to_char((now() AT TIME ZONE 'Asia/Bangkok')::time + interval '3 minutes', 'HH24:MI'));

  -- SAME_DAY นอกเวลา -> ERR_STORE_CLOSED
  BEGIN
    INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, status,
      order_mode, subtotal, delivery_fee, total_amount, payment_status)
    VALUES ('ord-c160-closed', 'BMB-C160-CLOSED', 'cust-c161', 'C160', '0111111111',
      'pending', 'SAME_DAY', 10, 0, 10, 'pending');
    RAISE EXCEPTION '160.1 FAIL: SAME_DAY outside hours accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_STORE_CLOSED%' THEN
      RAISE EXCEPTION '160.1 FAIL: wrong error %', SQLERRM;
    END IF;
  END;

  -- PRE_ORDER นอกเวลา -> ผ่าน (hook กรองเฉพาะ SAME_DAY) · 037: ต้องมี dropoff_detail
  --   · 145: enforce_pre_order_window ต้องเจอ delivery_round_id (ERR_ROUND_NOT_FOUND ถ้าไม่มี)
  --   → สร้าง round fixture สำหรับวันพรีออเดอร์ (branch = แถวแรกที่ seed มี)
  DECLARE
    v_branch text;
    v_tomorrow date := (now() AT TIME ZONE 'Asia/Bangkok')::date + 1;
  BEGIN
    SELECT id INTO v_branch FROM public.branches ORDER BY created_at LIMIT 1;
    INSERT INTO public.delivery_rounds (id, round_key, name, display_name, cutoff_time, delivery_start,
      delivery_end, pre_order_cutoff, max_capacity, current_count, date, scheduled_date, status, branch_id)
    VALUES ('round-c161-pre', 'evening', 'evening', 'Contract 161 Pre', '23:00', '23:30', '23:59',
      '23:59', 100, 0, v_tomorrow, v_tomorrow, 'active', v_branch)
    ON CONFLICT (id) DO NOTHING;
  END;
  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, status,
    order_mode, scheduled_date, dropoff_detail, delivery_round_id, subtotal, delivery_fee, total_amount, payment_status)
  VALUES ('ord-c160-pre', 'PO-C160-PRE', 'cust-c161', 'C160', '0111111111',
    'delivered', 'PRE_ORDER', (now() AT TIME ZONE 'Asia/Bangkok')::date + 1, 'ที่อยู่ทดสอบ 162',
    'round-c161-pre', 10, 0, 10, 'pending');
  RAISE NOTICE '160.1 PASS: SAME_DAY gated outside hours / PRE_ORDER unaffected';

  -- 160.2: ลบ hours -> ข้าม (SAME_DAY ผ่าน — ไม่เดาปิด)
  DELETE FROM public.business_settings WHERE key='hours';
  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, status,
    order_mode, subtotal, delivery_fee, total_amount, payment_status)
  VALUES ('ord-c160-nohours', 'BMB-C160-NOH', 'cust-c161', 'C160', '0111111111',
    'pending', 'SAME_DAY', 10, 0, 10, 'pending');
  RAISE NOTICE '160.2 PASS: missing hours row = not blocked (no fake closure)';
END $$;

-- ---------- 161 notifications ----------
DO $$
DECLARE v_notifs int;
BEGIN
  -- 161 block ต้องการผู้ใช้ admin (transition RPC + attach_address_photo) — ตั้งตรงนี้ คงถึงท้ายไฟล์
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  -- 161.1 address_photo_url column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='address_photo_url') THEN
    RAISE EXCEPTION '161.1 FAIL: orders.address_photo_url missing';
  END IF;
  RAISE NOTICE '161.1 PASS: orders.address_photo_url exists';

  -- 161.2 INSERT order -> ORDER_CREATED notification (customer-owned)
  SELECT count(*) INTO v_notifs FROM public.notifications
   WHERE customer_id='cust-c161' AND notification_type='ORDER_CREATED'
     AND message LIKE '%BMB-C160-NOH%';
  IF v_notifs <> 1 THEN RAISE EXCEPTION '161.2 FAIL: expected 1 ORDER_CREATED notification, got %', v_notifs; END IF;
  RAISE NOTICE '161.2 PASS: ORDER_CREATED notification on insert';

  -- 161.3 prefs Transactional=false -> no insert
  INSERT INTO public.notification_prefs (customer_id, channels)
  VALUES ('cust-c161-b', '{"Transactional":false}'::jsonb)
  ON CONFLICT (customer_id) DO UPDATE SET channels='{"Transactional":false}'::jsonb;
  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, status,
    order_mode, subtotal, delivery_fee, total_amount, payment_status)
  VALUES ('ord-c161-muted', 'BMB-C161-MUT', 'cust-c161-b', 'C161', '0222222222',
    'pending', 'SAME_DAY', 10, 0, 10, 'pending');
  SELECT count(*) INTO v_notifs FROM public.notifications
   WHERE customer_id='cust-c161-b' AND notification_type='ORDER_CREATED';
  IF v_notifs <> 0 THEN RAISE EXCEPTION '161.3 FAIL: muted customer got % notification(s)', v_notifs; END IF;
  RAISE NOTICE '161.3 PASS: Transactional=false suppresses notifications';

  -- 161.4 status change -> ORDER_CONFIRMED (transition ต้องผ่าน canonical RPC 019 —
  --   UPDATE ตรงถูก validate_order_status_transition บล็อก)
  PERFORM public.transition_order_status('BMB-C160-NOH', 'confirmed');
  SELECT count(*) INTO v_notifs FROM public.notifications
   WHERE customer_id='cust-c161' AND notification_type='ORDER_CONFIRMED'
     AND message LIKE '%BMB-C160-NOH%';
  IF v_notifs <> 1 THEN RAISE EXCEPTION '161.4 FAIL: expected ORDER_CONFIRMED notification, got %', v_notifs; END IF;
  RAISE NOTICE '161.4 PASS: status change notification fired';

  -- 161.5 attach_address_photo: owner OK / other user FORBIDDEN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  PERFORM public.attach_address_photo('BMB-C160-NOH', 'https://example.invalid/161.jpg');
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number='BMB-C160-NOH'
                 AND address_photo_url='https://example.invalid/161.jpg') THEN
    RAISE EXCEPTION '161.5 FAIL: url not persisted';
  END IF;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    PERFORM public.attach_address_photo('BMB-C160-NOH', 'https://example.invalid/161b.jpg');
    RAISE EXCEPTION '161.5 FAIL: non-owner accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN
      RAISE EXCEPTION '161.5 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '161.5 PASS: owner attaches, non-owner rejected';
END $$;

-- ---------- 162 admin reject payment ----------
DO $$
DECLARE v_out jsonb;
BEGIN
  -- 162.1 admin: reject -> payment_status pending + audit
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  v_out := public.admin_reject_payment('BMB-C160-NOH', 'slip unclear');
  IF (v_out->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION '162.1 FAIL: ok!=true'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number='BMB-C160-NOH' AND payment_status='pending') THEN
    RAISE EXCEPTION '162.1 FAIL: payment_status not pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE action='payment_rejected' AND entity_id='BMB-C160-NOH') THEN
    RAISE EXCEPTION '162.1 FAIL: audit log missing';
  END IF;

  -- closed order -> ERR_ORDER_CLOSED
  UPDATE public.orders SET status='delivered' WHERE order_number='PO-C160-PRE';
  BEGIN
    PERFORM public.admin_reject_payment('PO-C160-PRE', 'late');
    RAISE EXCEPTION '162.1 FAIL: closed order accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ORDER_CLOSED%' THEN
      RAISE EXCEPTION '162.1 FAIL: wrong error %', SQLERRM;
    END IF;
  END;

  -- non-admin -> ERR_FORBIDDEN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    PERFORM public.admin_reject_payment('BMB-C160-NOH', 'x');
    RAISE EXCEPTION '162.1 FAIL: non-admin accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN
      RAISE EXCEPTION '162.1 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '162.1 PASS: reject payment + audit + closed guard + role guard';

  -- 162.2 get_address_photo: admin read OK / non-admin FORBIDDEN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  IF COALESCE(public.get_address_photo('BMB-C160-NOH'), '') <> 'https://example.invalid/161.jpg' THEN
    RAISE EXCEPTION '162.2 FAIL: admin got wrong value';
  END IF;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    PERFORM public.get_address_photo('BMB-C160-NOH');
    RAISE EXCEPTION '162.2 FAIL: non-admin accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN
      RAISE EXCEPTION '162.2 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '162.2 PASS: address photo read guards OK';
END $$;

ROLLBACK;