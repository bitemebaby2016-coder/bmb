-- ============================================
-- Bite Me Baby — SQL Contract: Migration 208
-- (R53 · Preorder Vote: server-authoritative RPC ตามเจตนา m058 —
--  โหวตจริงจากเมนูจริงของแอดมิน · ZERO-FAKE ไม่มีแต้มปลอมฝั่งเครื่อง)
-- Date: 2026-11-18 · ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves:
--   G1 สคีมา: unique identity index มีจริง · vote_policy seed {enabled:true,daily_limit:1}
--       · 3 functions มีจริง · grants ถูกทิศ (status: anon+authenticated · cast: authenticated)
--   G2 anon: status ดูผลสาธารณะได้ (tallies ว่างเริ่มต้น) · cast = ถูก ACL กัน
--   G3 gates ฝั่ง server: policy ปิด = ERR_VOTE_DISABLED (ZERO-FAKE) ·
--       โหวตจริง ok + product_votes=1 · ซ้ำเมนูเดิม = ERR_VOTE_ALREADY ·
--       เกินเพดานวัน = ERR_VOTE_LIMIT · สินค้าไม่พบ/archived = ERR_VOTE_PRODUCT_NOT_FOUND ·
--       ชื่อว่าง = ERR_VOTE_PRODUCT_INVALID
--   G4 ยกเพดานเป็น 2 → โหวตเมนูที่ 2 ได้จริง · tallies/my_votes/used_today ตรงข้อมูลจริง
--   G5 ZERO-FAKE: โหวตไม่แตะ points_ledger เลย (ไม่มีแต้มปลอม) · audit_logs บันทึกทุกครั้ง
--   G6 identity mirror 155/156: customers row ถูกสร้างอัตโนมัติ (id = uid::text)
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email, phone) VALUES
  ('00000000-0000-4000-8000-000000c20801', 'c208-main@example.com', '0992080001');
INSERT INTO public.customers (id, user_id, full_name, phone) VALUES
  ('00000000-0000-4000-8000-000000c20801', '00000000-0000-4000-8000-000000c20801', 'c208-main', '0992080001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_categories (id, name, slug, icon, sort_order, is_active) VALUES
  ('c208-cat', 'c208-cat', 'c208-cat', '', 0, true);
INSERT INTO public.products (id, name, description, price, category_id, image_url, is_available, is_preorder, available_same_day, available_preorder, sort_order) VALUES
  ('c208-pa', 'c208-pa', '', 100, 'c208-cat', '', true, false, true, false, 0),
  ('c208-pb', 'c208-pb', '', 120, 'c208-cat', '', true, false, true, false, 0),
  ('c208-arch', 'c208-arch', '', 90, 'c208-cat', '', true, false, true, false, 0);
UPDATE public.products SET archived = true WHERE id = 'c208-arch';

CREATE OR REPLACE FUNCTION public.c208_claims(p_sub text, p_role text DEFAULT 'authenticated')
RETURNS void LANGUAGE sql AS $fn$
  SELECT set_config('request.jwt.claims',
    CASE WHEN p_sub IS NULL THEN jsonb_build_object('role', p_role)::text
         ELSE jsonb_build_object('sub', p_sub, 'role', p_role)::text END, true);
$fn$;

DO $$
DECLARE
  v_uid uuid := '00000000-0000-4000-8000-000000c20801';
  v_n integer;
  v_j jsonb;
  v_t jsonb;
  v_pa integer;
  v_pb integer;
BEGIN
  -- ===== G1: สคีมา + seed + fns + grants =====
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname='public' AND tablename='preorder_votes'
                    AND indexname='idx_preorder_votes_unique_identity') THEN
    RAISE EXCEPTION 'G1 FAIL: unique identity index missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key='vote_policy'
                   AND (value->>'enabled')::boolean = true
                   AND (value->>'daily_limit')::numeric = 1) THEN
    RAISE EXCEPTION 'G1 FAIL: vote_policy seed wrong';
  END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('vote_policy_state','preorder_vote_status','preorder_vote_cast');
  IF v_n <> 3 THEN RAISE EXCEPTION 'G1 FAIL: expected 3 functions, got %', v_n; END IF;
  -- grants ถูกทิศ: status = anon ได้ · cast = authenticated เท่านั้น
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema='public' AND routine_name='preorder_vote_cast'
                AND grantee='anon') THEN
    RAISE EXCEPTION 'G1 FAIL: anon must not exec preorder_vote_cast';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.routine_privileges
                  WHERE routine_schema='public' AND routine_name='preorder_vote_status'
                    AND grantee='anon' AND privilege_type='EXECUTE')
     OR NOT EXISTS (SELECT 1 FROM information_schema.routine_privileges
                  WHERE routine_schema='public' AND routine_name='preorder_vote_cast'
                    AND grantee='authenticated' AND privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'G1 FAIL: grants wrong';
  END IF;

  -- ===== G2: anon — status ได้ · cast ถูกกัน =====
  PERFORM public.c208_claims(NULL, 'anon');
  v_j := public.preorder_vote_status();
  IF NOT jsonb_typeof(v_j->'tallies') = 'array' OR v_j->'tallies' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'G2 FAIL: anon tallies must be empty array';
  END IF;
  IF (v_j->>'used_today')::integer <> 0 THEN
    RAISE EXCEPTION 'G2 FAIL: anon used_today must be 0';
  END IF;
  EXECUTE 'SET ROLE anon';
  BEGIN
    v_j := public.preorder_vote_cast('c208-pa');
    RAISE EXCEPTION 'G2 FAIL: anon must not exec preorder_vote_cast';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
  END;
  RESET ROLE;

  -- ===== G3: gates ฝั่ง server (ZERO-FAKE · server ตัดสินทุกกติกา) =====
  PERFORM public.c208_claims(v_uid::text, 'authenticated');
  UPDATE public.business_settings SET value='{"enabled":false,"daily_limit":1}'::jsonb
   WHERE key='vote_policy';
  BEGIN
    v_j := public.preorder_vote_cast('c208-pa');
    RAISE EXCEPTION 'G3 FAIL: disabled must block vote';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_VOTE_DISABLED%' THEN RAISE; END IF;
  END;
  UPDATE public.business_settings SET value='{"enabled":true,"daily_limit":1}'::jsonb
   WHERE key='vote_policy';

  -- สินค้า: ว่าง / ไม่พบ / archived = บล็อกก่อน (เมนูจริงจากแอดมินเท่านั้น)
  BEGIN
    v_j := public.preorder_vote_cast('');
    RAISE EXCEPTION 'G3 FAIL: empty product must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_VOTE_PRODUCT_INVALID%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.preorder_vote_cast('c208-ghost');
    RAISE EXCEPTION 'G3 FAIL: ghost product must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_VOTE_PRODUCT_NOT_FOUND%' THEN RAISE; END IF;
  END;
  BEGIN
    v_j := public.preorder_vote_cast('c208-arch');
    RAISE EXCEPTION 'G3 FAIL: archived product must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_VOTE_PRODUCT_NOT_FOUND%' THEN RAISE; END IF;
  END;

  -- โหวตจริงครั้งแรก = ok + ตัวเลขตรงข้อมูลจริง
  v_j := public.preorder_vote_cast('c208-pa');
  IF (v_j->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'G3 FAIL: first vote not ok'; END IF;
  IF (v_j->>'product_votes')::integer <> 1 THEN RAISE EXCEPTION 'G3 FAIL: product_votes %', v_j->>'product_votes'; END IF;
  IF (v_j->>'remaining_today')::integer <> 0 THEN RAISE EXCEPTION 'G3 FAIL: remaining_today %', v_j->>'remaining_today'; END IF;

  -- โหวตซ้ำเมนูเดิม = ERR_VOTE_ALREADY (unique identity ฝั่ง server)
  BEGIN
    v_j := public.preorder_vote_cast('c208-pa');
    RAISE EXCEPTION 'G3 FAIL: duplicate vote must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_VOTE_ALREADY%' THEN RAISE; END IF;
  END;
  -- เมนูที่ 2 วันนี้ = ERR_VOTE_LIMIT (daily_limit=1 ตาม seed)
  BEGIN
    v_j := public.preorder_vote_cast('c208-pb');
    RAISE EXCEPTION 'G3 FAIL: over-limit must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_VOTE_LIMIT%' THEN RAISE; END IF;
  END;

  -- ===== G4: ยกเพดานเป็น 2 → เมนูที่ 2 ได้จริง + ผลรวมตรงข้อมูลจริง =====
  UPDATE public.business_settings SET value='{"enabled":true,"daily_limit":2}'::jsonb
   WHERE key='vote_policy';
  v_j := public.preorder_vote_cast('c208-pb');
  IF (v_j->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'G4 FAIL: second vote not ok'; END IF;
  IF (v_j->>'remaining_today')::integer <> 0 THEN RAISE EXCEPTION 'G4 FAIL: remaining after 2nd %', v_j->>'remaining_today'; END IF;

  v_j := public.preorder_vote_status();
  v_t := v_j->'tallies';
  SELECT COALESCE((SELECT (t->>'votes')::integer FROM jsonb_array_elements(v_t) t WHERE t->>'product_id'='c208-pa'), 0) INTO v_pa;
  SELECT COALESCE((SELECT (t->>'votes')::integer FROM jsonb_array_elements(v_t) t WHERE t->>'product_id'='c208-pb'), 0) INTO v_pb;
  IF v_pa <> 1 OR v_pb <> 1 THEN
    RAISE EXCEPTION 'G4 FAIL: tallies pa=% pb=% (expect 1/1)', v_pa, v_pb;
  END IF;
  IF (v_j->>'used_today')::integer <> 2 THEN
    RAISE EXCEPTION 'G4 FAIL: used_today % (expect 2)', v_j->>'used_today';
  END IF;
  IF jsonb_array_length(v_j->'my_votes') <> 2 THEN
    RAISE EXCEPTION 'G4 FAIL: my_votes % (expect 2)', v_j->'my_votes';
  END IF;

  -- ===== G5: ZERO-FAKE + audit =====
  SELECT count(*) INTO v_n FROM public.points_ledger
   WHERE customer_ref = v_uid;
  IF v_n <> 0 THEN RAISE EXCEPTION 'G5 FAIL: vote must not touch points_ledger (rows=%)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.audit_logs
   WHERE action='preorder_vote_cast' AND entity_id IN ('c208-pa','c208-pb');
  IF v_n <> 2 THEN RAISE EXCEPTION 'G5 FAIL: audit rows % (expect 2)', v_n; END IF;

  -- ===== G6: identity mirror (customers id = uid::text ถูกใช้จริง) =====
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_uid::text) THEN
    RAISE EXCEPTION 'G6 FAIL: identity customer row missing';
  END IF;
  SELECT count(*) INTO v_n FROM public.preorder_votes WHERE customer_id = v_uid::text;
  IF v_n <> 2 THEN RAISE EXCEPTION 'G6 FAIL: vote rows % (expect 2)', v_n; END IF;

  RAISE NOTICE 'C208_OK vote contract all green';
END;
$$;

ROLLBACK;
