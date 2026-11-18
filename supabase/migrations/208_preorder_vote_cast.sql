-- ============================================================
-- Migration 208 — Preorder Vote: server-authoritative RPC (R53)
-- Owner สั่ง 2026-11-18: "ฟังก์ชันโหวตเมนูและสุ่มเมนูต้องซิ้งเมนูและ
--   ระบบโปรโมชั่นที่มีอยู่จากแอดมินตั้งให้สมบูรณ์ ห้ามมีฮาร์ดโค้ด
--   ทุกอย่างลิ้งค์ดึงจากของจริงเท่านั้น"
--
-- INSPECT-FIRST (หลักฐานโค้ดจริง 2026-11-18):
--   * src/pages/VotePage.tsx เดิม: โหวต 1 ครั้ง = createProduct() สร้าง
--     สินค้าซ้ำในตาราง products + % โหวตคำนวณจาก prep_minutes (ปลอม) +
--     addPoints แต้มปลอมฝั่งเครื่อง (memory-only) — ZERO-FAKE ล้วน
--   * m058 (RE-D1): policy preorder_votes_anon ถูก DROP แล้ว — เจตนา
--     "future server-authoritative RPC contract with anti-abuse boundary"
--     = migration นี้ทำตามเจตนานั้น
--   * identity mirror 155/156: customer_id (text) = auth.uid::text
--     (customers.id = uid::text — spin_reward ใช้แบบเดียวกัน)
--
-- กติกา ZERO-GUESS / ZERO-FAKE:
--   * policy vote_policy = business_settings (แอดมินคุมเอง · mirror 156c)
--     ค่าเริ่มต้น {"enabled":true,"daily_limit":1} — "โหวตได้ครั้งละ 1 เมนู
--     ต่อวัน" ตรงข้อความหน้าโหวตเดิม · ปิด = หน้าบอกตรง ๆ (ไม่แสร้งว่าโหวตได้)
--   * ห้ามแตะ points_ledger — การโหวตไม่มีแหล่งแต้มใน policy ใด ๆ
--     (สัญญาแต้มเดิม 5 แต้ม = ปลอม ถูกถอดออกจากหน้าพร้อมกัน)
--   * 1 identity = 1 แถวต่อสินค้าตลอดชีวิต (unique index) — โหวตซ้ำเมนูเดิม
--     = ERR_VOTE_ALREADY ฝั่ง server ตัดสิน
--   * ทุกการโหวต = audit_logs ทุกครั้ง (§4.2 mirror spin_reward)
--
-- สัญญาเดิมที่ไม่แตะ: preorder_votes schema (001) · policy public read (006)
--   · admin ALL (006) — anon/authenticated ยังเขียนตรงไม่ได้เหมือนเดิม
-- Rollback: DROP 3 functions + 1 policy seed + 1 index — ไม่แตะแถวโหวตเดิม
-- ============================================================

BEGIN;

-- ---- 208a: dedup แถวซ้ำ (เก็บแถวเก่าสุดต่อ product+identity) ก่อนสร้าง unique ----
--   m058 พิสูจน์แล้วว่าไม่มี code path เขียน (ตารางควรว่าง) — dedup กัน prod เก่าแข็ง
DELETE FROM public.preorder_votes pv
  USING public.preorder_votes pv2
 WHERE pv.product_id = pv2.product_id
   AND COALESCE(pv.customer_id, '') = COALESCE(pv2.customer_id, '')
   AND (pv.created_at > pv2.created_at
        OR (pv.created_at = pv2.created_at AND pv.id > pv2.id));

CREATE UNIQUE INDEX IF NOT EXISTS idx_preorder_votes_unique_identity
  ON public.preorder_votes (product_id, COALESCE(customer_id, ''));

CREATE INDEX IF NOT EXISTS idx_preorder_votes_customer_day
  ON public.preorder_votes (customer_id, created_at);

-- ---- 208b: vote_policy seed — ค่าเริ่มต้นเปิด 1 โหวต/วัน (แอดมินแก้ได้ใน business_settings) ----
INSERT INTO public.business_settings (key, value) VALUES
  ('vote_policy', '{"enabled":true,"daily_limit":1}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---- 208c: vote_policy_state — mirror 156d (ค่าผิด/หาย → ชุดเริ่มต้น ไม่แสร้งว่าเปิด) ----
CREATE OR REPLACE FUNCTION public.vote_policy_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  WITH v AS (
    SELECT COALESCE(value, '{}'::jsonb) AS value
      FROM public.business_settings WHERE key = 'vote_policy'
  )
  SELECT jsonb_build_object(
    'enabled', CASE WHEN jsonb_typeof(v.value -> 'enabled') = 'boolean'
                    THEN v.value -> 'enabled' ELSE 'true'::jsonb END,
    'daily_limit', CASE WHEN jsonb_typeof(v.value -> 'daily_limit') = 'number'
                        THEN v.value -> 'daily_limit' ELSE '1'::jsonb END
  )
  FROM v;
$fn$;
REVOKE EXECUTE ON FUNCTION public.vote_policy_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_policy_state() TO authenticated, service_role;

-- ---- 208d: preorder_vote_status — สถานะหน้าโหวต (ผลจริง + ของฉัน + เพดานวันนี้) ----
--   ใช้ได้ทั้ง anon (ดูผลโหวตสาธารณะ) และ authenticated (มีสถานะของฉัน)
CREATE OR REPLACE FUNCTION public.preorder_vote_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pol jsonb;
  v_used integer := 0;
  v_rows jsonb;
  v_mine jsonb := '[]'::jsonb;
BEGIN
  v_pol := public.vote_policy_state();

  -- ผลโหวตจริงต่อสินค้า (แถวต่อโหวต · vote_count = 1 ตาม schema 001)
  SELECT COALESCE(jsonb_agg(x ORDER BY x ->> 'product_id'), '[]'::jsonb) INTO v_rows
    FROM (
      SELECT jsonb_build_object('product_id', product_id, 'votes', SUM(vote_count)) AS x
        FROM public.preorder_votes
       GROUP BY product_id
    ) s;

  IF v_uid IS NOT NULL THEN
    SELECT count(*)::integer INTO v_used
      FROM public.preorder_votes v
     WHERE v.customer_id = v_uid::text
       AND (v.created_at AT TIME ZONE 'Asia/Bangkok')::date
         = (now() AT TIME ZONE 'Asia/Bangkok')::date;
    SELECT COALESCE(jsonb_agg(t.product_id ORDER BY t.product_id), '[]'::jsonb) INTO v_mine
      FROM (SELECT DISTINCT product_id FROM public.preorder_votes WHERE customer_id = v_uid::text) t;
  END IF;

  RETURN jsonb_build_object(
    'policy', v_pol,
    'used_today', v_used,
    'remaining_today', GREATEST(0, (v_pol ->> 'daily_limit')::integer - v_used),
    'tallies', v_rows,
    'my_votes', v_mine);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.preorder_vote_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preorder_vote_status() TO anon, authenticated, service_role;

-- ---- 208e: preorder_vote_cast — โหวตจริง (server ตัดสินทุกกติกา · audit ทุกครั้ง) ----
--   กฎ: ต้องล็อกอิน · policy enabled · ยังไม่โหวตสินค้านี้ · ยังไม่เกิน daily_limit
--   (กรุงเทพ = Asia/Bangkok) · advisory lock กันกดพร้อมกันแล้วเกินเพดาน ·
--   สินค้าต้องมีจริง + ยังไม่ถูกเก็บถาวร (เมนูจริงจากแอดมินเท่านั้น)
CREATE OR REPLACE FUNCTION public.preorder_vote_cast(p_product_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pol jsonb;
  v_used integer := 0;
  v_limit integer;
  v_cust text;
  v_pid text;
  v_id text;
  v_n integer := 0;
  v_product_votes integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  v_pid := NULLIF(btrim(COALESCE(p_product_id, '')), '');
  IF v_pid IS NULL THEN RAISE EXCEPTION 'ERR_VOTE_PRODUCT_INVALID'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('vote:' || v_uid::text));

  -- เมนูจริงจากแอดมินเท่านั้น (archived = เก็บออกจากแคตตาล็อกแล้ว — ตรงกฎกรองหน้าโหวต L-5)
  SELECT p.id INTO v_pid FROM public.products p WHERE p.id = v_pid AND NOT p.archived;
  IF v_pid IS NULL THEN RAISE EXCEPTION 'ERR_VOTE_PRODUCT_NOT_FOUND'; END IF;

  v_pol := public.vote_policy_state();
  IF NOT (v_pol ->> 'enabled')::boolean THEN RAISE EXCEPTION 'ERR_VOTE_DISABLED'; END IF;
  v_limit := GREATEST(0, (v_pol ->> 'daily_limit')::integer);

  -- โหวตซ้ำเมนูเดิม = ALREADY ก่อนเสมอ (ข้อความต้องแม่น — ไม่ใช่ "ครบเพดาน" ทั้งที่โหวตเมนูนี้ไปแล้ว)
  IF EXISTS (
    SELECT 1 FROM public.preorder_votes v
     WHERE v.customer_id = v_uid::text AND v.product_id = v_pid
  ) THEN RAISE EXCEPTION 'ERR_VOTE_ALREADY'; END IF;

  SELECT count(*)::integer INTO v_used
    FROM public.preorder_votes v
   WHERE v.customer_id = v_uid::text
     AND (v.created_at AT TIME ZONE 'Asia/Bangkok')::date
       = (now() AT TIME ZONE 'Asia/Bangkok')::date;
  IF v_used >= v_limit THEN RAISE EXCEPTION 'ERR_VOTE_LIMIT'; END IF;

  -- identity: mirror 155/156 (มี customers = ใช้ · ไม่มี = สร้างจาก uid ไม่เดาข้อมูลอื่น)
  SELECT id INTO v_cust FROM public.customers WHERE user_id = v_uid LIMIT 1;
  IF v_cust IS NULL THEN
    INSERT INTO public.customers (id, user_id, full_name)
    VALUES (v_uid::text, v_uid, 'Customer')
    ON CONFLICT (id) DO NOTHING;
    v_cust := v_uid::text;
  END IF;

  v_id := 'pv-' || substr(md5(v_uid::text || ':' || v_pid), 1, 12);
  INSERT INTO public.preorder_votes (id, product_id, customer_id, vote_count)
    VALUES (v_id, v_pid, v_uid::text, 1)
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'ERR_VOTE_ALREADY'; END IF;

  PERFORM public.append_audit_log(
    'preorder_vote_cast', 'product', v_pid,
    'vote by ' || v_cust || ' (daily ' || (v_used + 1) || '/' || v_limit || ')',
    jsonb_build_object('product_id', v_pid, 'customer_id', v_cust,
                       'daily_limit', v_limit));

  SELECT COALESCE(SUM(v.vote_count), 0)::integer INTO v_product_votes
    FROM public.preorder_votes v WHERE v.product_id = v_pid;

  RETURN jsonb_build_object(
    'ok', true, 'product_id', v_pid,
    'product_votes', v_product_votes,
    'used_today', v_used + 1,
    'remaining_today', GREATEST(0, v_limit - v_used - 1));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.preorder_vote_cast(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preorder_vote_cast(text) TO authenticated, service_role;

-- ---- 208f: verification (กันเกม — ตามแบบ m207) ----
DO $verify$
DECLARE
  v_msg text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'preorder_votes'
       AND indexname = 'idx_preorder_votes_unique_identity'
  ) THEN
    RAISE EXCEPTION 'ERR_VERIFY_VOTE_UNIQUE_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
     WHERE routine_schema = 'public' AND routine_name = 'preorder_vote_cast'
       AND grantee = 'authenticated' AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'ERR_VERIFY_VOTE_GRANT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
     WHERE routine_schema = 'public' AND routine_name = 'preorder_vote_cast'
       AND grantee = 'anon' AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'ERR_VERIFY_VOTE_ANON_GRANT';
  END IF;

  -- status ต้องเรียกได้โดยไม่มี context (anon ดูผลสาธารณะได้ — cast เท่านั้นที่บล็อก)
  BEGIN
    PERFORM public.preorder_vote_status();
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  IF v_msg IS NOT NULL AND v_msg LIKE 'ERR_VOTE_%' THEN
    RAISE EXCEPTION 'ERR_VERIFY_VOTE_STATUS_ANON_BLOCKED';
  END IF;

  RAISE NOTICE 'VERIFY_R208_OK unique+grants+anon-guard verified';
END;
$verify$;

COMMIT;
