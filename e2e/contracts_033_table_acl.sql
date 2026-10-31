-- ============================================
-- Bite Me Baby — PHASE 3B SQL Contract Suite: TABLE-ACL ALIGNMENT (033 / F-3)
-- Baseline: dc6e7ca · Scope: grants/revokes only — proves the ACL layer now
-- matches the policy layer + the app's direct PostgREST consumption.
-- Run as OWNER in Supabase SQL Editor (or local psql). Read-only impact:
-- the suite runs in ONE transaction and ROLLBACKs at the end.
--
-- Proves (execution-gate §2):
--   G1  anon canonical read set intact + ZERO anon write privileges on
--       every public table/view + no anon SELECT beyond the canonical set
--       (m176 · Owner 2026-10-31 "ดึงเข้าเว็บ": marketing_posts เพิ่มเข้าชุดด้วย —
--        และ G1c บังคับว่า policy ของ anon ต้องจำกัดเฉพาะ status='published' เท่านั้น)
--   G2  authenticated policy-backed grants present (business_settings +
--       content_approvals SELECT; media_assets + mascot_overrides CRUD)
--   G3  SECURITY: public_profiles VIEW write DENIED for authenticated (SELECT
--       kept) + pre_orders archive write DENIED (024 read-only archive)
--   G4  service_role holds SELECT/INSERT/UPDATE/DELETE on every public rel
--   G5  LIVE probes: admin fixture INSERT media_assets works; authenticated
--       customer SELECT business_settings works; authenticated INSERT
--       business_settings denied; authenticated UPDATE via public_profiles
--       view permission-denied; anon SELECT mascot_overrides works
--   G6  regression: canonical anon reads (products/orders/preorder_votes) +
--       authenticated delivery_rounds read + admin inventory read unchanged
-- ============================================

BEGIN;
RESET ROLE;

-- W-2 (B-2) 2026-10-26: fixture แอดมินให้ is_admin() ของ policy ใช้ได้ภายใน txn นี้
-- (profiles ใน DB ใหม่มีแค่ customer · production มี owner/admin จริง) · ROLLBACK ท้ายไฟล์
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('55555555-5555-5555-5555-555555555555', 'contract-033-admin@bmb.test', 'x',
        now(), now(), '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, is_platform)
VALUES ('55555555-5555-5555-5555-555555555555', 'admin', true)
ON CONFLICT (id) DO UPDATE SET role = 'admin', is_platform = true;

-- ============================================
-- G1. ANON: canonical read set + no write anywhere
-- ============================================
-- W-2: expected set ปรับตาม grants จริง (migration ที่อนุมัติหลัง 033 เพิ่ม storefront reads
--   8 ตัว = admin_portfolio_items/branches/brands/business_settings/delivery_zones/media_assets/
--   menu_schedule/menu_sections/promotion_products · และ 050 ปิด anon อ่าน orders)
DO $$ DECLARE ok int := 0; BEGIN
  IF NOT has_table_privilege('anon', 'public.products', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.product_categories', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.delivery_rounds', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.reviews', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.promotions', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.preorder_votes', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.mascot_overrides', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.admin_portfolio_items', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.branches', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.brands', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.business_settings', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.delivery_zones', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.media_assets', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.menu_schedule', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.menu_sections', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('anon', 'public.promotion_products', 'SELECT') THEN ok := ok + 1; END IF;
  -- m176 (Owner 2026-10-31): feed หน้าแรกอ่านโพสต์ published — grant นี้ต้องอยู่ (revoke = feed ตาย)
  IF NOT has_table_privilege('anon', 'public.marketing_posts', 'SELECT') THEN ok := ok + 1; END IF;
  -- 050 (w5_h1_close_anon_orders): anon ต้อง "ไม่มี" สิทธิ์อ่าน orders อีกต่อไป
  IF has_table_privilege('anon', 'public.orders', 'SELECT') THEN ok := ok + 1; END IF;
  IF ok <> 0 THEN RAISE EXCEPTION 'FAIL G1a anon canonical SELECT set broken (missing=%)', ok; END IF;
  RAISE NOTICE 'PASS G1a anon canonical SELECT set intact (16 storefront rels + marketing_posts feed + orders read closed)';
END $$;

DO $$
DECLARE r record; leaks int := 0; extra int := 0;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v')
  LOOP
    IF has_table_privilege('anon', 'public.' || r.relname, 'INSERT')
       OR has_table_privilege('anon', 'public.' || r.relname, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || r.relname, 'DELETE')
       OR has_table_privilege('anon', 'public.' || r.relname, 'TRUNCATE')
       OR has_table_privilege('anon', 'public.' || r.relname, 'REFERENCES')
       OR has_table_privilege('anon', 'public.' || r.relname, 'TRIGGER') THEN
      leaks := leaks + 1;
      RAISE NOTICE 'G1b anon write-residue on %', r.relname;
    END IF;
    IF has_table_privilege('anon', 'public.' || r.relname, 'SELECT')
       AND r.relname NOT IN ('products','product_categories','delivery_rounds',
                             'reviews','promotions','preorder_votes','mascot_overrides',
                             'admin_portfolio_items','branches','brands','business_settings',
                             'delivery_zones','media_assets','menu_schedule','menu_sections',
                             'promotion_products','marketing_posts') THEN
      extra := extra + 1;
      RAISE NOTICE 'G1b anon unexpected SELECT on %', r.relname;
    END IF;
  END LOOP;
  IF leaks <> 0 OR extra <> 0 THEN
    RAISE EXCEPTION 'FAIL G1b anon ACL drift (write-residue=%, unexpected-SELECT=%)', leaks, extra;
  END IF;
  RAISE NOTICE 'PASS G1b anon holds ZERO write privileges and exactly the canonical read set';
END $$;

-- m176 G1c (ใหม่ · เสริมไม่ให้อ่อนกว่าเดิม): anon อ่าน marketing_posts ได้ "เฉพาะ published" —
-- policy ต้องมีจริง + qual ชี้ published (กัน grant ถูกใช้กว้าง / policy ถูกถอด →
-- draft/pending หลุดออกเว็บโดยไม่ตั้งใจ)
DO $$
DECLARE q text;
BEGIN
  SELECT qual INTO q FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'marketing_posts'
     AND policyname = 'marketing_posts_anon_published'
     AND roles @> ARRAY['anon']::name[];
  IF q IS NULL THEN
    RAISE EXCEPTION 'FAIL G1c marketing_posts_anon_published policy missing';
  END IF;
  IF q NOT LIKE '%published%' THEN
    RAISE EXCEPTION 'FAIL G1c anon marketing_posts policy not scoped to published (qual=%)', q;
  END IF;
  RAISE NOTICE 'PASS G1c anon marketing_posts read is scoped to status=published only';
END $$;

-- ============================================
-- G2. AUTHENTICATED: policy-backed, app-consumed grants present
-- ============================================
DO $$ DECLARE ok int := 0; BEGIN
  IF NOT has_table_privilege('authenticated', 'public.business_settings', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.content_approvals', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.media_assets', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.media_assets', 'INSERT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.media_assets', 'UPDATE') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.media_assets', 'DELETE') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.mascot_overrides', 'SELECT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.mascot_overrides', 'INSERT') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.mascot_overrides', 'UPDATE') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.mascot_overrides', 'DELETE') THEN ok := ok + 1; END IF;
  IF ok <> 0 THEN RAISE EXCEPTION 'FAIL G2 authenticated policy-backed grants missing (% faults)', ok; END IF;
  RAISE NOTICE 'PASS G2 authenticated grants: business_settings+content_approvals SELECT, media_assets+mascot_overrides CRUD';
END $$;

-- ============================================
-- G3. SECURITY: view write path + archive write path closed
-- ============================================
DO $$ DECLARE ok int := 0; BEGIN
  IF has_table_privilege('authenticated', 'public.public_profiles', 'INSERT') THEN ok := ok + 1; END IF;
  IF has_table_privilege('authenticated', 'public.public_profiles', 'UPDATE') THEN ok := ok + 1; END IF;
  IF has_table_privilege('authenticated', 'public.public_profiles', 'DELETE') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.public_profiles', 'SELECT') THEN ok := ok + 1; END IF;
  IF has_table_privilege('authenticated', 'public.pre_orders', 'INSERT') THEN ok := ok + 1; END IF;
  IF has_table_privilege('authenticated', 'public.pre_orders', 'UPDATE') THEN ok := ok + 1; END IF;
  IF has_table_privilege('authenticated', 'public.pre_orders', 'DELETE') THEN ok := ok + 1; END IF;
  IF NOT has_table_privilege('authenticated', 'public.pre_orders', 'SELECT') THEN ok := ok + 1; END IF;
  IF ok <> 0 THEN RAISE EXCEPTION 'FAIL G3 view/archive write path open (% faults)', ok; END IF;
  RAISE NOTICE 'PASS G3 public_profiles read-only for authenticated + pre_orders archive (write grants revoked)';
END $$;

-- ============================================
-- G4. SERVICE_ROLE: full CRUD on every public rel (platform canonical)
-- ============================================
DO $$
DECLARE r record; miss int := 0;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v')
  LOOP
    -- W-2: `order_submissions` ไม่มี grant ให้ service_role โดยเจตนา (124: เขียนผ่าน RPC
    -- SECURITY DEFINER เท่านั้น — idempotency table ห้ามเขียนตรง) → ยกเว้นพร้อมบันทึก
    IF r.relname <> 'order_submissions' THEN
      IF NOT has_table_privilege('service_role', 'public.' || r.relname, 'SELECT') THEN miss := miss + 1; END IF;
      IF NOT has_table_privilege('service_role', 'public.' || r.relname, 'INSERT') THEN miss := miss + 1; END IF;
      IF NOT has_table_privilege('service_role', 'public.' || r.relname, 'UPDATE') THEN miss := miss + 1; END IF;
      IF NOT has_table_privilege('service_role', 'public.' || r.relname, 'DELETE') THEN miss := miss + 1; END IF;
    ELSE
      RAISE NOTICE 'G4 known exception: order_submissions has no service_role grant (124 design)';
    END IF;
  END LOOP;
  IF miss <> 0 THEN RAISE EXCEPTION 'FAIL G4 service_role missing grants on % privileges', miss; END IF;
  RAISE NOTICE 'PASS G4 service_role full SELECT/INSERT/UPDATE/DELETE on every public rel';
END $$;

-- ============================================
-- Fixtures (rolled back) — customer 4444…, admin 5555… (029-style)
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('44444444-4444-4444-4444-444444444444', 'contract-033-cust@bmb.test', 'x', now(), now(), now(),
        '{}', '{}', 'authenticated', 'authenticated'),
       ('55555555-5555-5555-5555-555555555555', 'contract-033-admin@bmb.test', 'x', now(), now(), now(),
        '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
-- the auth trigger seeds profiles rows; elevate the admin fixture
UPDATE public.profiles SET role = 'admin' WHERE id = '55555555-5555-5555-5555-555555555555';

-- ============================================
-- G5. LIVE probes (impersonation — execution-gate §2)
-- ============================================
-- G5a: admin fixture INSERT into media_assets (grant + admin policy) and DELETE (CRUD both ways)
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false);
DO $$ DECLARE v_id text; BEGIN
  -- W-2: policy `media_assets_platform_global` ต้องการ tenant_id IS NULL + category='global'
  -- + is_platform_admin() (profiles.is_platform ของ fixture ด้านบน)
  INSERT INTO public.media_assets (id, url, alt, kind, category, tenant_id, created_by)
  VALUES ('media-033-contract', 'https://contract.bmb/033/probe.png', 'contract probe', 'image',
          'global', NULL, '55555555-5555-5555-5555-555555555555')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'FAIL G5a admin INSERT media_assets returned no id'; END IF;
  DELETE FROM public.media_assets WHERE id = v_id;
  RAISE NOTICE 'PASS G5a admin INSERT+DELETE media_assets works (grant + admin policy)';
END $$;

-- G5b: authenticated CUSTOMER — business_settings read works, INSERT denied, media read works
SELECT set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', false);
DO $$ DECLARE n int; blocked boolean := false; BEGIN
  SELECT count(*) INTO n FROM public.business_settings;  -- grant + auth_read policy
  RAISE NOTICE 'PASS G5b authenticated SELECT business_settings works (rows=%)', n;
  BEGIN
    INSERT INTO public.business_settings (key) VALUES ('contract_033_probe');
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%violates row-level%' THEN blocked := true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'FAIL G5b authenticated INSERT business_settings was NOT blocked'; END IF;
  RAISE NOTICE 'PASS G5b authenticated INSERT business_settings DENIED (no grant)';
  SELECT count(*) INTO n FROM public.media_assets;      -- grant + public_read policy
  RAISE NOTICE 'PASS G5b authenticated SELECT media_assets works (rows=%, policy public_read)', n;
END $$;

-- G5c: SECURITY regression — cross-user profile write through the public_profiles VIEW must fail
DO $$ DECLARE blocked boolean := false; BEGIN
  BEGIN
    UPDATE public.public_profiles SET name = '033-bypass-attempt'
      WHERE id <> '44444444-4444-4444-4444-444444444444';
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%violates row-level%' THEN blocked := true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'FAIL G5c authenticated wrote through public_profiles view (RLS bypass open)'; END IF;
  RAISE NOTICE 'PASS G5c authenticated UPDATE via public_profiles view DENIED (view write path closed)';
END $$;

-- G5d: anon — storefront mascot read now works; canonical reads intact
SELECT set_config('role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.mascot_overrides;
  RAISE NOTICE 'PASS G5d anon SELECT mascot_overrides works (storefront, rows=%)', n;
  SELECT count(*) INTO n FROM public.products;
  RAISE NOTICE 'PASS G5d anon SELECT products works (canonical, rows=%)', n;
  -- W-2: 050 (w5_h1_close_anon_orders) ปิด anon อ่าน orders แล้ว → เปลี่ยนจาก "อ่านได้"
  -- เป็น "ต้องถูกปฏิเสธ" (assertion เข้มขึ้น ตรงสิ่งที่อนุมัติจริง)
  BEGIN
    SELECT count(*) INTO n FROM public.orders;
    RAISE EXCEPTION 'FAIL G5d anon can still SELECT orders (050 gate open)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS G5d anon SELECT orders DENIED (050 close-anon-orders gate holds)';
  END;
END $$;

-- G6: authenticated round read + admin inventory read unchanged (029/028 regression)
SELECT set_config('role', 'authenticated', false);
SELECT set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false);
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.delivery_rounds;
  RAISE NOTICE 'PASS G6 authenticated (admin) SELECT delivery_rounds works (rows=%)', n;
  SELECT count(*) INTO n FROM public.inventory;
  RAISE NOTICE 'PASS G6 authenticated (admin) SELECT inventory works (rows=%)', n;
END $$;

ROLLBACK;
-- ============================================
-- END contracts_033_table_acl.sql — suite passed iff no FAIL was raised
-- ============================================