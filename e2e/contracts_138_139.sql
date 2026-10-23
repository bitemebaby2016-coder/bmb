-- ============================================
-- Bite Me Baby — SQL Contract: Migration 138 (payment read authority) + 139 (POD policies)
-- Date: 2026-10-23 · Run on ephemeral PG (apply_all_migrations.sh) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves:
--   G1  get_payment_intents_for_orders = SECURITY DEFINER + grants (auth yes / anon no)
--       และ payment_intents ยังไม่มี table GRANT ให้ authenticated (canonical 034 คงเดิม)
--   G2  scope: owner เห็นเฉพาะออเดอร์ตัวเอง · stranger เห็น 0 · admin เห็นทุกแถว
--   G3  dedupe ฝั่ง server: create ซ้ำ → คืนแถวเดิม (idempotent) · ACTIVE แถวที่สอง
--       โดน unique index (uq_payment_intents_active_order_method)
--   G4  confirm_offline_payment เลือกแถว 'processing' (มีหลักฐาน) ก่อนแถว 'completed'
--       ที่ใหม่กว่า (กับดัก 841/205) → paid ได้จริง + audit_logs payment_processed
--   G5  current_driver_id / pod_path_is_driver = SECURITY DEFINER + grants
--   G6  policy ของ pod-photos ไม่มี scalar subquery ใน definition (บทเรียน 119/132)
--   G7  INSERT storage.objects จริงในฐานะไรเดอร์: โฟลเดอร์ตน (raw/%20) ผ่าน ·
--       โฟลเดอร์คนอื่นโดน RLS · ไม่ใช่ driver → ไม่ผ่าน
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- 0. FIXTURES (admin / owner / stranger / driver-with-space-id)
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', 'c138-admin@bmb.test',    'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'c138-owner@bmb.test',    'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('cccccccc-3333-3333-3333-333333333333', 'c138-stranger@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('dddddddd-4444-4444-4444-444444444444', 'c139-driver@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, created_at, updated_at)
VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', 'admin',    now(), now()),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'customer', now(), now()),
  ('cccccccc-3333-3333-3333-333333333333', 'customer', now(), now()),
  ('dddddddd-4444-4444-4444-444444444444', 'customer', now(), now())
ON CONFLICT (id) DO NOTHING;
-- trigger on_auth_user_created สร้าง profiles (role=customer) ให้ก่อนแล้ว →
-- ต้อง SET role ตาม fixture เสมอ (pattern เดียวกับ contracts_133:36-39)
UPDATE public.profiles SET role = 'admin' WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111';
UPDATE public.profiles SET role = 'customer' WHERE id IN (
  'bbbbbbbb-2222-2222-2222-222222222222',
  'cccccccc-3333-3333-3333-333333333333',
  'dddddddd-4444-4444-4444-444444444444');

-- drivers.id มี space (ของจริง probe 2026-10-23) — ตัวเลข 21 ตัวอักษรเหมือน production
INSERT INTO public.drivers (id, name, phone, status, user_id, created_at, updated_at)
VALUES ('drv- c139-60bc', 'Driver C139', '0899999999', 'available', 'dddddddd-4444-4444-4444-444444444444', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.orders (id, order_number, status, customer_name, customer_phone, total_amount, payment_method, payment_status, customer_ref, created_at, updated_at)
VALUES
  ('ord-BMB-C138-1', 'BMB-C138-1', 'confirmed', 'QA138A', '0990001381', 150, 'promptpay_qr', 'pending', 'bbbbbbbb-2222-2222-2222-222222222222', NOW(), NOW()),
  ('ord-BMB-C138-2', 'BMB-C138-2', 'confirmed', 'QA138B', '0990001382', 250, 'promptpay_qr', 'pending', 'cccccccc-3333-3333-3333-333333333333', NOW(), NOW()),
  ('ord-BMB-C139-1', 'BMB-C139-1', 'confirmed', 'QA139',  '0990001391', 350, 'promptpay_qr', 'pending', 'bbbbbbbb-2222-2222-2222-222222222222', NOW(), NOW())
ON CONFLICT (order_number) DO NOTHING;

-- intents: BMB-C138-1 ×2 (owner), BMB-C138-2 ×1 (stranger)
INSERT INTO public.payment_intents (id, order_number, amount, currency, status, method, provider, metadata, created_at, updated_at)
VALUES
  ('pi-c138-1a', 'BMB-C138-1', 150, 'thb', 'completed',  'promptpay_qr', 'promptpay', '{}', NOW() - interval '2 seconds', NOW()),
  ('pi-c138-1b', 'BMB-C138-1', 150, 'thb', 'processing', 'promptpay_qr', 'promptpay', '{}', NOW() - interval '1 second',  NOW()),
  ('pi-c138-2',  'BMB-C138-2', 250, 'thb', 'processing', 'promptpay_qr', 'promptpay', '{}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
-- (คู่ completed+processing ตั้งใจให้ตรงกับความจริงของ 841/205 และไม่ชน
--  uq_payment_intents_active_order_method ที่คุมเฉพาะแถว ACTIVE)

-- ============================================
-- G1 RPC security + canonical grant model (034 คงเดิม: ไม่มี GRANT SELECT)
-- ============================================
DO $$
BEGIN
  ASSERT (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'get_payment_intents_for_orders') = true,
    'G1 get_payment_intents_for_orders must be SECURITY DEFINER';
  ASSERT has_function_privilege('authenticated', 'public.get_payment_intents_for_orders(text[],text,text,timestamptz,timestamptz)', 'EXECUTE'),
    'G1 authenticated must execute the read RPC';
  ASSERT NOT has_function_privilege('anon', 'public.get_payment_intents_for_orders(text[],text,text,timestamptz,timestamptz)', 'EXECUTE'),
    'G1 anon must NOT execute the read RPC';
  ASSERT NOT has_table_privilege('authenticated', 'public.payment_intents', 'SELECT'),
    'G1 payment_intents must stay REVOKE''d for authenticated (canonical 034 — access via RPC only)';
  ASSERT (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'create_payment_intent_record') = true,
    'G1 create_payment_intent_record must stay SECURITY DEFINER';
  RAISE NOTICE 'G1 OK — read RPC definer + grants; table stays REVOKE''d';
END $$;

-- ============================================
-- G2 read scope — owner / stranger / admin
-- ============================================
DO $$
DECLARE
  v_cnt int;
  v_ids text;
BEGIN
  -- owner: เห็นเฉพาะแถวของออเดอร์ตัวเอง แม้จะขอของคนอื่นด้วย
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"bbbbbbbb-2222-2222-2222-222222222222","role":"authenticated"}', false);
  SELECT count(*), string_agg(id, ',' ORDER BY id) INTO v_cnt, v_ids
    FROM public.get_payment_intents_for_orders(ARRAY['BMB-C138-1', 'BMB-C138-2']);
  RESET ROLE;
  ASSERT v_cnt = 2, 'G2 owner must see exactly own 2 rows, got ' || v_cnt;
  ASSERT v_ids = 'pi-c138-1a,pi-c138-1b', 'G2 owner leaked foreign rows: ' || coalesce(v_ids, '<null>');

  -- stranger: 0 แถว (ไม่ error — แต่ไม่เห็นของใคร)
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"cccccccc-3333-3333-3333-333333333333","role":"authenticated"}', false);
  SELECT count(*) INTO v_cnt
    FROM public.get_payment_intents_for_orders(ARRAY['BMB-C138-1']);
  RESET ROLE;
  ASSERT v_cnt = 0, 'G2 stranger must see 0 rows, got ' || v_cnt;

  -- admin/staff: เห็นทุกแถวที่ขอ
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-1111-1111-111111111111","role":"authenticated"}', false);
  SELECT count(*) INTO v_cnt
    FROM public.get_payment_intents_for_orders(ARRAY['BMB-C138-1', 'BMB-C138-2']);
  RESET ROLE;
  ASSERT v_cnt = 3, 'G2 admin must see all 3 rows, got ' || v_cnt;
  RAISE NOTICE 'G2 OK — owner/stranger/admin scope holds';
END $$;

-- ============================================
-- G3 server-side dedupe + unique index
-- ============================================
DO $$
DECLARE
  v_r1 jsonb;
  v_r2 jsonb;
  v_cnt int;
  v_dup_blocked boolean := false;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"bbbbbbbb-2222-2222-2222-222222222222","role":"authenticated"}', false);
  v_r1 := public.create_payment_intent_record('BMB-C139-1', 350, 'promptpay_qr', 'promptpay', '{}');
  v_r2 := public.create_payment_intent_record('BMB-C139-1', 350, 'promptpay_qr', 'promptpay', '{}');
  RESET ROLE;

  ASSERT v_r1->>'idempotent' = 'false', 'G3 first create must be a new row';
  ASSERT v_r2->>'idempotent' = 'true', 'G3 second create must return the existing ACTIVE intent';
  ASSERT v_r2->>'id' = v_r1->>'id', 'G3 second create must return the SAME id';
  SELECT count(*) INTO v_cnt FROM public.payment_intents WHERE order_number = 'BMB-C139-1';
  ASSERT v_cnt = 1, 'G3 must be exactly 1 ACTIVE intent, got ' || v_cnt;

  -- แถว ACTIVE ที่สอง (manual insert) ต้องโดน unique index
  BEGIN
    INSERT INTO public.payment_intents (id, order_number, amount, currency, status, method, provider, metadata, created_at, updated_at)
    VALUES ('pi-c139-DUP', 'BMB-C139-1', 350, 'thb', 'pending', 'promptpay_qr', 'promptpay', '{}', NOW(), NOW());
  EXCEPTION WHEN unique_violation THEN
    v_dup_blocked := true;
  END;
  ASSERT v_dup_blocked, 'G3 second ACTIVE row must be blocked by uq_payment_intents_active_order_method';
  RAISE NOTICE 'G3 OK — server dedupe + unique index hold';
END $$;

-- ============================================
-- G4 confirm prefers 'processing' over newer 'completed' (841/205 trap) + audit
-- ============================================
DO $$
DECLARE
  v_r jsonb;
BEGIN
  -- retire แถว ACTIVE เดิมจาก G3 (pending) ก่อน — จำลองคู่ซ้ำแบบ production
  UPDATE public.payment_intents SET status = 'failed', failure_reason = 'superseded-by-evidence'
   WHERE order_number = 'BMB-C139-1' AND status = 'pending';
  -- คู่ซ้ำแบบ 841/205: processing (เก่ากว่า) + completed (ใหม่กว่า)
  INSERT INTO public.payment_intents (id, order_number, amount, currency, status, method, provider, metadata, created_at, updated_at)
  VALUES
    ('pi-c139-proc', 'BMB-C139-1', 350, 'thb', 'processing', 'promptpay_qr', 'promptpay', '{}', NOW() - interval '2 seconds', NOW()),
    ('pi-c139-done', 'BMB-C139-1', 350, 'thb', 'completed',  'promptpay_qr', 'promptpay', '{}', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-1111-1111-111111111111","role":"authenticated"}', false);
  v_r := public.confirm_offline_payment('BMB-C139-1');
  RESET ROLE;

  ASSERT v_r->>'ok' = 'true', 'G4 confirm must succeed despite a newer completed duplicate: ' || v_r::text;
  ASSERT (SELECT status FROM public.payment_intents WHERE id = 'pi-c139-proc') = 'completed',
    'G4 the processing (evidence) row must be the one completed';
  ASSERT (SELECT payment_status FROM public.orders WHERE order_number = 'BMB-C139-1') = 'paid',
    'G4 order must become paid';
  ASSERT EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'payment_processed' AND entity_id = 'BMB-C139-1'),
    'G4 payment confirm must write audit_logs (018 behavior restored)';
  -- idempotent: confirm ซ้ำ → ok, idempotent=true
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-1111-1111-111111111111","role":"authenticated"}', false);
  v_r := public.confirm_offline_payment('BMB-C139-1');
  RESET ROLE;
  ASSERT v_r->>'idempotent' = 'true', 'G4 second confirm must be idempotent';
  RAISE NOTICE 'G4 OK — processing-first confirm + audit + idempotent';
END $$;

-- ============================================
-- G5 POD helpers — SECURITY DEFINER + grants
-- ============================================
DO $$
BEGIN
  ASSERT (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'current_driver_id') = true,
    'G5 current_driver_id must be SECURITY DEFINER';
  ASSERT (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'pod_path_is_driver') = true,
    'G5 pod_path_is_driver must be SECURITY DEFINER';
  ASSERT has_function_privilege('authenticated', 'public.current_driver_id()', 'EXECUTE'),
    'G5 authenticated must execute current_driver_id';
  ASSERT has_function_privilege('authenticated', 'public.pod_path_is_driver(text)', 'EXECUTE'),
    'G5 authenticated must execute pod_path_is_driver';
  ASSERT NOT has_function_privilege('anon', 'public.pod_path_is_driver(text)', 'EXECUTE'),
    'G5 anon must NOT execute pod_path_is_driver';
  RAISE NOTICE 'G5 OK — trusted helpers definer + grants';
END $$;

-- ============================================
-- G6 pod-photos policies: helper-based, NO scalar subquery (lesson 119/132)
-- ============================================
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT coalesce(qual, '') || ' | ' || coalesce(with_check, '') INTO v_def
    FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'pod_photos_driver_upload';
  ASSERT v_def IS NOT NULL, 'G6 pod_photos_driver_upload missing';
  ASSERT v_def LIKE '%pod_path_is_driver%', 'G6 upload policy must use the trusted helper: ' || v_def;
  ASSERT v_def NOT LIKE '%(SELECT%', 'G6 upload policy must NOT contain scalar subqueries: ' || v_def;

  SELECT coalesce(qual, '') INTO v_def
    FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'pod_photos_admin_or_owner_read';
  ASSERT v_def LIKE '%is_admin()%' AND v_def LIKE '%pod_path_is_driver%', 'G6 read policy must use is_admin()/pod_path_is_driver';
  ASSERT v_def NOT LIKE '%(SELECT%', 'G6 read policy must NOT contain scalar subqueries: ' || v_def;

  SELECT coalesce(qual, '') INTO v_def
    FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'pod_photos_admin_delete';
  ASSERT v_def LIKE '%is_admin()%', 'G6 delete policy must be admin-only via is_admin()';
  RAISE NOTICE 'G6 OK — pod-photos policies helper-based, zero subqueries';
END $$;

-- ============================================
-- G7 real storage INSERT as the rider (raw + %20 encoded folder OK · foreign folder blocked)
-- ============================================
DO $$
DECLARE
  v_ok int;
  v_blocked boolean := false;
  v_not_driver boolean := false;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"dddddddd-4444-4444-4444-444444444444","role":"authenticated"}', false);

  -- decoded folder (drivers.id มี space จริง)
  INSERT INTO storage.objects (bucket_id, name) VALUES ('pod-photos', 'drv- c139-60bc/BMB-C139-1-1.jpg');
  -- URL-encoded folder (%20 จาก storage-js encodeURIComponent)
  INSERT INTO storage.objects (bucket_id, name) VALUES ('pod-photos', 'drv-%20c139-60bc/BMB-C139-1-2.jpg');
  GET DIAGNOSTICS v_ok = ROW_COUNT;
  ASSERT v_ok = 1, 'G7 encoded-folder insert must succeed';

  -- โฟลเดอร์คนอื่น → RLS block
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('pod-photos', 'someone-else/BMB-C139-1-3.jpg');
  EXCEPTION WHEN OTHERS THEN
    v_blocked := SQLERRM LIKE '%row-level security%';
  END;
  ASSERT v_blocked, 'G7 foreign-folder insert must be rejected by RLS';

  RESET ROLE;

  -- ไม่ใช่ไรเดอร์ (owner ที่ไม่มี drivers row) → ไม่ผ่าน
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"bbbbbbbb-2222-2222-2222-222222222222","role":"authenticated"}', false);
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('pod-photos', 'drv- c139-60bc/BMB-C139-1-4.jpg');
  EXCEPTION WHEN OTHERS THEN
    v_not_driver := SQLERRM LIKE '%row-level security%';
  END;
  ASSERT v_not_driver, 'G7 non-driver must not upload into a driver folder';
  RESET ROLE;

  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'pod-photos') = 2,
    'G7 exactly 2 objects must exist (raw + encoded)';
  RAISE NOTICE 'G7 OK — rider folder ownership enforced (raw + %%20 tolerated)';
END $$;

ROLLBACK;