-- ============================================================
-- Contract 175 + 176 + 177 + 178 + 180 — billing / marketing anon read /
-- publish due / cron bridge / driver list tenant scope
-- ครอบคลุม:
--   175.1 billing_subscriptions table + CHECKs + custom_domain ของ tenant เดิม
--   175.2 RLS: admin INSERT ได้ / role ทั่วไปอ่านไม่ได้
--   176.1 anon เห็นเฉพาะ marketing_posts status='published'
--   177.1 marketing_publish_due() promote scheduled ที่ถึงเวลา (attempts+1)
--   177.2 marketing_feed_posts() promote ก่อนแล้วคืน published
--   178.1 bmb_tick_http(text) มีอยู่ (ไม่เรียกจริง — กันยิง production EF)
--   180.1 list_drivers: non-admin ERR_FORBIDDEN / admin ได้ drivers tenant เดิม + last_seen_at
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- fixture: admin role (ยกก่อนตั้ง JWT — bootstrap path 014) ----------
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- ---------- 175.1 schema ----------
DO $$
DECLARE v_row public.billing_subscriptions%ROWTYPE; v_dom text; v_ok boolean;
BEGIN
  SELECT custom_domain INTO v_dom FROM public.tenants WHERE id='tenant-bmb-001';
  IF v_dom IS DISTINCT FROM 'biteme-baby.com' THEN
    RAISE EXCEPTION '175.1 FAIL: tenant custom_domain = %', v_dom;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brands' AND column_name='ai_prompt') THEN
    RAISE EXCEPTION '175.1 FAIL: brands.ai_prompt missing';
  END IF;
  INSERT INTO public.billing_subscriptions (id, tenant_id, plan, billing_cycle, amount_baht, status,
    current_period_start, current_period_end, remind_days_before)
  VALUES ('sub-c175', 'tenant-bmb-001', 'standard', 'monthly', 999, 'active', NOW(), NOW() + interval '30 days', 3)
  RETURNING * INTO v_row;
  IF v_row.id IS DISTINCT FROM 'sub-c175' THEN RAISE EXCEPTION '175.1 FAIL: insert failed'; END IF;
  DELETE FROM public.billing_subscriptions WHERE id='sub-c175';
  RAISE NOTICE '175.1 PASS: billing table + custom domain + ai_prompt OK';
END $$;

-- ---------- 175.2 RLS shape + behavior ----------
DO $$
DECLARE v_ok boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='billing_subscriptions'
                 AND policyname='billing_admin_manage') THEN
    RAISE EXCEPTION '175.2 FAIL: billing_admin_manage policy missing';
  END IF;
  -- authenticated ทั่วไป (role customer) อ่านไม่ได้ — ตารางการเงิน
  PERFORM set_config('request.jwt.claims',
    '{"sub":"210a1680-0000-4000-8000-000000000002","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  SELECT bool_or(true) INTO v_ok FROM public.billing_subscriptions LIMIT 1;
  RESET ROLE;
  IF v_ok IS TRUE THEN RAISE EXCEPTION '175.2 FAIL: plain authenticated read billing rows'; END IF;
  RAISE NOTICE '175.2 PASS: billing RLS denies non-admin read';
END $$;

-- ---------- 176.1 anon sees published only ----------
DO $$
DECLARE v_seen int;
BEGIN
  INSERT INTO public.marketing_posts (id, title, status)
  VALUES ('mp-c175-pub', 'published post 176', 'published'),
         ('mp-c175-dr', 'draft post 176', 'draft')
  ON CONFLICT (id) DO NOTHING;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_seen FROM public.marketing_posts WHERE id IN ('mp-c175-pub','mp-c175-dr');
  RESET ROLE;
  IF v_seen <> 1 THEN RAISE EXCEPTION '176.1 FAIL: anon sees % of 2 posts', v_seen; END IF;
  RAISE NOTICE '176.1 PASS: anon reads published post only';
END $$;

-- ---------- 177.1/177.2 publish due + feed ----------
DO $$
DECLARE v_n int; v_rows int;
BEGIN
  INSERT INTO public.marketing_posts (id, title, status, scheduled_for)
  VALUES ('mp-c177-due', 'due now 177', 'scheduled', NOW() - interval '1 minute'),
         ('mp-c177-fut', 'future 177', 'scheduled', NOW() + interval '1 hour')
  ON CONFLICT (id) DO NOTHING;
  v_n := public.marketing_publish_due();
  IF NOT EXISTS (SELECT 1 FROM public.marketing_posts WHERE id='mp-c177-due'
                 AND status='published' AND publish_attempts >= 1) THEN
    RAISE EXCEPTION '177.1 FAIL: due post not promoted';
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_posts WHERE id='mp-c177-fut' AND status='published') THEN
    RAISE EXCEPTION '177.1 FAIL: future post promoted early';
  END IF;
  -- 177.2: feed คืนแถว published ตรงชนิด (SETOF marketing_posts) และ promote ก่อนคืนเสมอ
  SELECT count(*) INTO v_rows
    FROM public.marketing_feed_posts(10)
   WHERE id IN ('mp-c175-pub','mp-c177-due');
  IF v_rows < 2 THEN RAISE EXCEPTION '177.2 FAIL: feed returned % expected rows', v_rows; END IF;
  RAISE NOTICE '177 PASS: publish_due promotes on time + feed returns published';
END $$;

-- ---------- 178.1 bridge fn exists (ไม่เรียก — กันยิง production EF) ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='bmb_tick_http'
      AND pg_get_function_identity_arguments(p.oid)='p_token text') THEN
    RAISE EXCEPTION '178.1 FAIL: bmb_tick_http(text) missing';
  END IF;
  RAISE NOTICE '178.1 PASS: bmb_tick_http bridge exists (not invoked)';
END $$;

-- ---------- 180.1 list_drivers guards + tenant scope ----------
DO $$
DECLARE v_out jsonb; v_count int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"210a1680-0000-4000-8000-000000000002","role":"authenticated"}', true);
  BEGIN
    PERFORM public.list_drivers();
    RAISE EXCEPTION '180.1 FAIL: non-admin called list_drivers';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN
      RAISE EXCEPTION '180.1 FAIL: wrong error %', SQLERRM;
    END IF;
  END;

  -- admin: fixture driver ใน tenant ปัจจุบันต้องถูกมองเห็น + last_seen_at ใน payload
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES ('210a1800-0000-4000-8000-000000000001','fixture-driver-180@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.drivers (id, name, phone, status, user_id, tenant_id, current_latitude, current_longitude, last_seen_at)
  VALUES ('drv-c180', 'Contract 180 Rider', '0-180-0000001', 'available',
    '210a1800-0000-4000-8000-000000000001', public.default_tenant_id(), 13.0, 102.0, NOW())
  ON CONFLICT (id) DO NOTHING;

  v_out := public.list_drivers();
  IF (v_out->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION '180.1 FAIL: ok!=true'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_out->'drivers') d
     WHERE d->>'id'='drv-c180' AND d ? 'last_seen_at') THEN
    RAISE EXCEPTION '180.1 FAIL: tenant driver missing or last_seen_at absent';
  END IF;
  RAISE NOTICE '180.1 PASS: list_drivers admin-only + tenant scope + last_seen_at';
END $$;

ROLLBACK;