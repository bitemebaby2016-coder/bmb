-- ============================================================
-- Migration 156 — Growth & Rewards STAGE 4 (Engagement & Play)
-- (กติกาทั้งหมด = §2 ข้อ 4/5/7 ของ Owner · handoff §9.2/§10.2 · requirements §3/§3.1 · §5.8 ⑧)
--
-- INSPECT-FIRST RESULT (ตรวจระบบเดิมจริงก่อนสร้าง — §5.2 บังคับ):
--   * Spin & Win เดิม = "สุ่มเมนูล้วน" ทั้ง 2 จุด — ไม่มีระบบรางวัลจริง:
--       - RandomMenuPage: addPoints(3) ฝั่งเครื่อง + toast "+3 แต้ม" + "คูปองลด 15%"
--         ที่สร้างโค้ด RANDOM-xxx ฝั่ง client (ของปลอมทั้งหมด)
--       - ViralPage "ล้อสุ่มแต้ม": สุ่ม [5..100] + addPoints ฝั่งเครื่อง + ข้อความ "5 ครั้ง/วัน"
--         ที่ไม่มี server ตรวจจริง
--   * Creator Affiliate = ไม่มีระบบเลย (มีแค่หัวข้อ "Referral & Affiliate" ใน AdminMarketing)
--   * แคตตาล็อก Rewards = hardcode 4 รายการใน RewardsPage (แอดมินแก้ไม่ได้)
--   ⇒ Stage นี้สร้าง: รางวัล Spin จริงจากเซิร์ฟเวอร์ (เพดานรายวัน · audit) ·
--     Affiliate แต้ม/คูปอง ไม่มีเงินสด (cap รายเดือน · กัน self · idempotent) ·
--     แคตตาล็อกย้ายเป็นตาราง admin
--
-- กติกาที่ห้ามละเมิด (ZERO-GUESS / ZERO-FAKE):
--   * อัตราแต้ม Spin/Affiliate = ค่าเริ่มต้น 0 + enabled=false (§3.1 "ยังไม่กำหนดอัตราจนกว่าจะมี
--     unit economics") → แอดมินเปิดเองใน AI Marketing Center แท็บ Rules — ไม่เดา ไม่ backfill
--   * ไม่มีเงินสดให้ผู้แนะนำ/ครีเอเตอร์เด็ดขาด (§4.1 ข้อ 5) — จ่ายเป็นแต้มเท่านั้น
--   * ทุกการได้แต้ม = audit_logs ทุกครั้ง (§4.2) · points_ledger = append-only ต่อไป
--   * ไม่แตะ signature create_order_with_items/_i/pickup — attribution = claim แยกเหมือน 154
--   * เพดาน: spin = daily_limit ต่อลูกค้า (ค่าเริ่มต้น 1/วัน ต่ำสุด · แอดมินปรับ) ·
--     affiliate = monthly_cap ต่อครีเอเตอร์ (ค่าเริ่มต้น 0 = ยังไม่จ่ายจนกว่าจะเปิด)
--
-- ตารางใหม่: rewards_catalog (RLS deny) · affiliate_codes (RLS deny) · affiliate_attributions (RLS deny)
-- ขยาย points_ledger: entry_type += 'spin' (points>0) · 'affiliate' (มีเครื่องหมาย — หักกลับได้)
-- สัญญาทดสอบ: e2e/contracts_156_engagement_play.sql (CI step แล้ว)
-- Rollback: ลบ 2 triggers + functions + 3 ตาราง + 2 policy rows — ไม่แตะข้อมูลออเดอร์/การเงิน
-- ============================================================

BEGIN;

-- ---- 156a: ขยาย entry types ของ points_ledger (spin/affiliate) ----
--   คงกฎเดิมทุกประการ: purchase>0 · reversal<0 · adjustment มีเครื่องหมายได้ ·
--   spin = ได้อย่างเดียว >0 · affiliate = ได้/หักกลับ (mirror delta-model ของ 155)
ALTER TABLE public.points_ledger DROP CONSTRAINT IF EXISTS points_ledger_entry_type_check;
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_entry_type_check
  CHECK (entry_type IN ('purchase','reversal','adjustment','spin','affiliate'));
ALTER TABLE public.points_ledger DROP CONSTRAINT IF EXISTS points_ledger_sign;
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_sign CHECK (
  (entry_type = 'purchase'  AND points > 0) OR
  (entry_type = 'reversal'  AND points < 0) OR
  (entry_type = 'adjustment') OR
  (entry_type = 'spin'      AND points > 0) OR
  (entry_type = 'affiliate')
);
CREATE INDEX IF NOT EXISTS idx_points_ledger_spin_daily
  ON public.points_ledger (customer_ref, created_at) WHERE entry_type = 'spin';
CREATE INDEX IF NOT EXISTS idx_points_ledger_affiliate
  ON public.points_ledger (customer_ref, created_at) WHERE entry_type = 'affiliate';
CREATE INDEX IF NOT EXISTS idx_points_ledger_affiliate_order
  ON public.points_ledger (order_id, entry_type) WHERE entry_type = 'affiliate';

-- ---- 156b: rewards_catalog — ย้าย hardcode 4 รายการใน RewardsPage → ตาราง admin ----
--   (§2 ข้อ 7: "ย้าย hardcode → ตาราง admin ตั้งเอง") · ห้าม client เขียนตรง (server RPC เท่านั้น)
CREATE TABLE IF NOT EXISTS public.rewards_catalog (
  id           text PRIMARY KEY,
  name         text NOT NULL CHECK (btrim(name) <> ''),
  description  text NOT NULL DEFAULT '',
  points_cost  integer NOT NULL CHECK (points_cost > 0),
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rewards_catalog FROM anon, authenticated;

-- seed = รายการเดิม 4 ชิ้นเป๊ะ (ย้ายมาจาก RewardsPage — ON CONFLICT DO NOTHING
-- เพื่อไม่ทับการแก้ของแอดมินเมื่อรันซ้ำ)
INSERT INTO public.rewards_catalog (id, name, description, points_cost, is_active, sort_order) VALUES
  ('rw-coupon-10',  'คูปองลด 10%',  'ใช้กับออเดอร์ถัดไป',   100, true, 1),
  ('rw-ship-free',  'ส่งฟรี 1 ครั้ง', 'ส่งฟรีภายใน 5 กม.',     150, true, 2),
  ('rw-menu-free',  'เมนูฟรี 1 จาน',  'เลือกเมนูจากเมนูหลัก', 200, true, 3),
  ('rw-coupon-20',  'คูปองลด 20%',  'ใช้กับออเดอร์ ≥฿200',   300, true, 4)
ON CONFLICT (id) DO NOTHING;

-- ---- 156c: policy seeds — ปิดทั้งคู่เป็นค่าเริ่มต้น (ไม่เดาอัตรา §3.1) ----
INSERT INTO public.business_settings (key, value) VALUES
  ('spin_policy',     '{"enabled":false,"daily_limit":1,"points_per_spin":0}'::jsonb),
  ('affiliate_policy','{"enabled":false,"points_per_qualified_order":0,"monthly_cap":0,"qualify_status":"delivered"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---- 156d: spin_policy_state — อ่านแบบ tolerant (ค่าผิด/หาย → ชุดเริ่มต้น ไม่แสร้งว่าเปิด) ----
CREATE OR REPLACE FUNCTION public.spin_policy_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  WITH v AS (
    SELECT COALESCE(value, '{}'::jsonb) AS value
      FROM public.business_settings WHERE key = 'spin_policy'
  )
  SELECT jsonb_build_object(
    'enabled', CASE WHEN jsonb_typeof(v.value -> 'enabled') = 'boolean'
                    THEN v.value -> 'enabled' ELSE 'false'::jsonb END,
    'daily_limit', CASE WHEN jsonb_typeof(v.value -> 'daily_limit') = 'number'
                        THEN v.value -> 'daily_limit' ELSE '1'::jsonb END,
    'points_per_spin', CASE WHEN jsonb_typeof(v.value -> 'points_per_spin') = 'number'
                            THEN v.value -> 'points_per_spin' ELSE '0'::jsonb END
  )
  FROM v;
$fn$;
REVOKE EXECUTE ON FUNCTION public.spin_policy_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_policy_state() TO authenticated, service_role;

-- ---- 156e: affiliate_policy_state (mirror กัน — fallback ไม่แสร้งว่าเปิด) ----
CREATE OR REPLACE FUNCTION public.affiliate_policy_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  WITH v AS (
    SELECT COALESCE(value, '{}'::jsonb) AS value
      FROM public.business_settings WHERE key = 'affiliate_policy'
  )
  SELECT jsonb_build_object(
    'enabled', CASE WHEN jsonb_typeof(v.value -> 'enabled') = 'boolean'
                    THEN v.value -> 'enabled' ELSE 'false'::jsonb END,
    'points_per_qualified_order', CASE WHEN jsonb_typeof(v.value -> 'points_per_qualified_order') = 'number'
                                       THEN v.value -> 'points_per_qualified_order' ELSE '0'::jsonb END,
    'monthly_cap', CASE WHEN jsonb_typeof(v.value -> 'monthly_cap') = 'number'
                        THEN v.value -> 'monthly_cap' ELSE '0'::jsonb END,
    'qualify_status', CASE WHEN jsonb_typeof(v.value -> 'qualify_status') = 'string'
                              AND btrim(COALESCE(v.value ->> 'qualify_status', '')) <> ''
                           THEN to_jsonb(btrim(v.value ->> 'qualify_status'))
                           ELSE '"delivered"'::jsonb END
  )
  FROM v;
$fn$;
REVOKE EXECUTE ON FUNCTION public.affiliate_policy_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_policy_state() TO authenticated, service_role;

-- ---- 156f: spin_status — สถานะที่หน้าล้อสุ่มต้องโชว์ (ZERO-FAKE: ไม่ enabled = ไม่สัญญาแต้ม) ----
CREATE OR REPLACE FUNCTION public.spin_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pol jsonb;
  v_used integer := 0;
  v_bal integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  v_pol := public.spin_policy_state();
  SELECT count(*)::integer INTO v_used
    FROM public.points_ledger l
   WHERE l.entry_type = 'spin' AND l.customer_ref = v_uid
     AND (l.created_at AT TIME ZONE 'Asia/Bangkok')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date;
  SELECT COALESCE(SUM(l.points), 0)::integer INTO v_bal
    FROM public.points_ledger l WHERE l.customer_ref = v_uid;
  RETURN jsonb_build_object(
    'enabled', (v_pol ->> 'enabled')::boolean,
    'daily_limit', (v_pol ->> 'daily_limit')::integer,
    'points_per_spin', (v_pol ->> 'points_per_spin')::integer,
    'used_today', v_used,
    'remaining_today', GREATEST(0, (v_pol ->> 'daily_limit')::integer - v_used),
    'balance', v_bal
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spin_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_status() TO authenticated, service_role;

-- ---- 156g: spin_reward — หมุนรับแต้มจริง (เพดานรายวัน · กันกดซ้ำ · audit ทุกครั้ง) ----
--   กฎ: ต้องล็อกอิน · policy enabled · points_per_spin > 0 · ยังไม่เกิน daily_limit วันนี้
--   (กรุงเทพ = Asia/Bangkok) · advisory lock กันกดพร้อมกันแล้วเกินเพดาน
CREATE OR REPLACE FUNCTION public.spin_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pol jsonb;
  v_rate integer;
  v_limit integer;
  v_used integer := 0;
  v_bal integer := 0;
  v_cust text;
  v_id text;
  v_n integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('spin:' || v_uid::text));

  v_pol := public.spin_policy_state();
  IF NOT (v_pol ->> 'enabled')::boolean THEN RAISE EXCEPTION 'ERR_SPIN_DISABLED'; END IF;
  v_rate := (v_pol ->> 'points_per_spin')::integer;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'ERR_SPIN_NO_RATE'; END IF;
  v_limit := GREATEST(0, (v_pol ->> 'daily_limit')::integer);

  -- identity: mirror 155 (มี customers = ใช้ · ไม่มี = สร้างจาก uid ไม่เดาข้อมูลอื่น)
  SELECT id INTO v_cust FROM public.customers WHERE user_id = v_uid LIMIT 1;
  IF v_cust IS NULL THEN
    INSERT INTO public.customers (id, user_id, full_name)
    VALUES (v_uid::text, v_uid, 'Customer')
    ON CONFLICT (id) DO NOTHING;
    v_cust := v_uid::text;
  END IF;

  SELECT count(*)::integer INTO v_used
    FROM public.points_ledger l
   WHERE l.entry_type = 'spin' AND l.customer_ref = v_uid
     AND (l.created_at AT TIME ZONE 'Asia/Bangkok')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date;
  IF v_used >= v_limit THEN RAISE EXCEPTION 'ERR_SPIN_LIMIT'; END IF;

  v_id := 'spn-' || substr(md5(v_uid::text || ':' || clock_timestamp()::text), 1, 12);
  INSERT INTO public.points_ledger
    (id, customer_id, customer_ref, points, entry_type, order_id, order_number,
     basis_amount, rate_used, reason, created_by)
  VALUES
    (v_id, v_cust, v_uid, v_rate, 'spin', NULL, NULL, 0, 0,
     '(สุ่มรางวัล) ล้อสุ่มแต้ม ' || to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD'), v_uid)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'ERR_SPIN_DUP'; END IF;

  PERFORM public.append_audit_log(
    'spin_reward', 'customer', v_cust,
    'spin +' || v_rate || ' pts (daily_limit ' || v_limit || ')',
    jsonb_build_object('points', v_rate, 'daily_limit', v_limit,
                       'entry_type', 'spin', 'customer_id', v_cust));

  SELECT COALESCE(SUM(l.points), 0)::integer INTO v_bal
    FROM public.points_ledger l WHERE l.customer_ref = v_uid;

  RETURN jsonb_build_object(
    'ok', true, 'points', v_rate,
    'used_today', v_used + 1,
    'remaining_today', GREATEST(0, v_limit - v_used - 1),
    'balance', v_bal);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spin_reward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_reward() TO authenticated, service_role;

-- ---- 156h: ตาราง affiliate (ครีเอเตอร์ · แต้ม/คูปอง ไม่มีเงินสด §4.1 ข้อ 5) ----
CREATE TABLE IF NOT EXISTS public.affiliate_codes (
  customer_id    text PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_ref   uuid NOT NULL,
  code           text NOT NULL UNIQUE,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliate_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_codes FROM anon, authenticated;

-- attribution = แยกจาก order spine (เหมือน 154 — ไม่แตะ signature create_order_with_items)
CREATE TABLE IF NOT EXISTS public.affiliate_attributions (
  id                 text PRIMARY KEY,
  order_id           text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number       text NOT NULL UNIQUE,
  affiliate_ref      uuid NOT NULL,
  affiliate_customer_id text NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  buyer_customer_id  text,
  state              text NOT NULL DEFAULT 'pending'
                     CHECK (state IN ('pending','qualified','reversed')),
  qualified_at       timestamptz,
  reversed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliate_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_attributions FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_affiliate_att_owner
  ON public.affiliate_attributions (affiliate_ref, created_at DESC);

-- ---- 156i: affiliate_normalize_code — trim + upper (mirror referral_normalize_code) ----
CREATE OR REPLACE FUNCTION public.affiliate_normalize_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT upper(regexp_replace(COALESCE(p_code, ''), '\s+', '', 'g'));
$fn$;
REVOKE EXECUTE ON FUNCTION public.affiliate_normalize_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_normalize_code(text) TO authenticated, service_role;

-- ---- 156j: affiliate_my_code — ดึง/สร้างโค้ดครีเอเตอร์ของตัวเอง + สถิติย่อ ----
CREATE OR REPLACE FUNCTION public.affiliate_my_code()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cust text;
  v_code text;
  v_att record;
  v_pts integer := 0;
  v_month integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT id INTO v_cust FROM public.customers WHERE user_id = v_uid LIMIT 1;
  IF v_cust IS NULL THEN
    INSERT INTO public.customers (id, user_id, full_name)
    VALUES (v_uid::text, v_uid, 'Customer')
    ON CONFLICT (id) DO NOTHING;
    v_cust := v_uid::text;
  END IF;

  SELECT code INTO v_code FROM public.affiliate_codes WHERE customer_id = v_cust;
  IF NOT FOUND THEN
    v_code := 'AFF-' || upper(substr(md5(v_uid::text || ':aff'), 1, 6));
    INSERT INTO public.affiliate_codes (customer_id, customer_ref, code)
    VALUES (v_cust, v_uid, v_code)
    ON CONFLICT (customer_id) DO NOTHING;
    SELECT code INTO v_code FROM public.affiliate_codes WHERE customer_id = v_cust;
  END IF;

  SELECT count(*)::integer AS pending,
         (count(*) FILTER (WHERE state = 'qualified'))::integer AS qualified
    INTO v_att
    FROM public.affiliate_attributions WHERE affiliate_ref = v_uid;

  SELECT COALESCE(SUM(points), 0)::integer INTO v_pts
    FROM public.points_ledger
   WHERE entry_type = 'affiliate' AND customer_ref = v_uid;

  SELECT COALESCE(SUM(points), 0)::integer INTO v_month
    FROM public.points_ledger
   WHERE entry_type = 'affiliate' AND customer_ref = v_uid
     AND (created_at AT TIME ZONE 'Asia/Bangkok')::date >= date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok')::date;

  RETURN jsonb_build_object(
    'code', v_code,
    'orders_pending', COALESCE(v_att.pending, 0),
    'orders_qualified', COALESCE(v_att.qualified, 0),
    'points_total', v_pts,
    'points_this_month', v_month,
    'policy', public.affiliate_policy_state());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.affiliate_my_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_my_code() TO authenticated, service_role;

-- idempotency: 1 ออเดอร์ = 1 แถว earn affiliate (mirror idx_points_ledger_order_purchase)
CREATE UNIQUE INDEX IF NOT EXISTS idx_points_ledger_affiliate_earn
  ON public.points_ledger (order_id)
  WHERE entry_type = 'affiliate' AND points > 0;

-- ---- 156k: affiliate_claim — ผู้ซื้อผูกออเดอร์เข้าโค้ดครีเอเตอร์ (client เรียกหลัง order สร้าง)
--   กันโกง §4.2: hard block self-affiliate · ออเดอร์ซ้ำ = unique · ออเดอร์ตาย = ไม่รับ ·
--   เฉพาะผู้ซื้อเจ้าของออเดอร์เท่านั้น · ไม่แตะ order spine (เหมือน referral_claim ของ 154)
CREATE OR REPLACE FUNCTION public.affiliate_claim(p_order_number text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_owner_ref uuid;
  v_owner_cust text;
  v_o public.orders%ROWTYPE;
  v_buyer_cust text;
  v_id text;
  v_n integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  v_code := public.affiliate_normalize_code(p_code);
  IF v_code = '' THEN RAISE EXCEPTION 'ERR_AFFILIATE_CODE_EMPTY'; END IF;
  SELECT ac.customer_ref, ac.customer_id INTO v_owner_ref, v_owner_cust
    FROM public.affiliate_codes ac
   WHERE ac.code = v_code AND ac.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_AFFILIATE_CODE_NOT_FOUND'; END IF;

  SELECT * INTO v_o FROM public.orders WHERE order_number = btrim(p_order_number);
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  -- เฉพาะผู้ซื้อเจ้าของออเดอร์เท่านั้น (identity = auth uid — guest ไม่มีสิทธิ์ผูก)
  IF v_o.customer_ref IS NULL OR v_o.customer_ref <> v_uid THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  -- HARD BLOCK: เจ้าของโค้ด = ผู้ซื้อ (self-affiliate เด็ดขาด §4.2)
  IF v_owner_ref = v_uid THEN RAISE EXCEPTION 'ERR_SELF_AFFILIATE'; END IF;
  IF v_o.status::text IN ('cancelled','failed') THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_ELIGIBLE';
  END IF;

  v_buyer_cust := COALESCE(v_o.customer_ref::text, v_o.customer_id);
  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = v_buyer_cust) THEN
    INSERT INTO public.customers (id, user_id, full_name)
    VALUES (v_o.customer_ref::text, v_o.customer_ref, 'Customer')
    ON CONFLICT (id) DO NOTHING;
    v_buyer_cust := v_o.customer_ref::text;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('aff-order:' || v_o.id));
  v_id := 'aff-' || substr(md5(v_o.id || ':' || v_owner_ref::text), 1, 12);
  INSERT INTO public.affiliate_attributions
    (id, order_id, order_number, affiliate_ref, affiliate_customer_id, buyer_customer_id, state)
  VALUES
    (v_id, v_o.id, v_o.order_number, v_owner_ref, v_owner_cust, v_buyer_cust, 'pending')
  ON CONFLICT (order_number) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'ERR_ALREADY_ATTRIBUTED'; END IF;

  PERFORM public.append_audit_log(
    'affiliate_claim', 'order', v_o.id,
    'affiliate ' || v_code || ' <- order ' || v_o.order_number,
    jsonb_build_object('order_number', v_o.order_number, 'code', v_code,
                       'affiliate_customer_id', v_owner_cust, 'buyer_customer_id', v_buyer_cust));

  -- ออเดอร์อาจผ่าน qualify ไปแล้ว (claim ช้า) → sync ทันที
  PERFORM public.affiliate_sync_order(v_o.id);
  RETURN jsonb_build_object('ok', true, 'state',
    (SELECT state FROM public.affiliate_attributions WHERE order_id = v_o.id));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.affiliate_claim(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_claim(text, text) TO authenticated, service_role;

-- ---- 156l: affiliate_sync_order — จุดเดียวของ trigger (idempotent ทุกการเรียกซ้ำ) ----
--   earn: ผ่าน qualify_status + policy เปิด + rate>0 + cap รายเดือนผ่าน (cap<=0 = ยังไม่จ่าย · fail-closed)
--   reverse: delta-model mirror 155 — ยอดที่ต้องกลับ − ที่บันทึกแล้ว > 0 จึง insert (ไม่หักซ้ำ §4.2)
CREATE OR REPLACE FUNCTION public.affiliate_sync_order(p_order_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  a public.affiliate_attributions%ROWTYPE;
  pol jsonb;
  v_rate integer;
  v_cap integer;
  v_goods numeric;
  v_refunded numeric := 0;
  v_earn integer := 0;
  v_recorded integer := 0;
  v_target integer := 0;
  v_delta integer := 0;
  v_month integer := 0;
  v_id text;
  v_n integer := 0;
  v_ins integer := 0;
  v_reason text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO a FROM public.affiliate_attributions WHERE order_id = o.id;
  IF NOT FOUND THEN RETURN 0; END IF;      -- ไม่มี attribution = ไม่ใช่หน้าที่ของเรา
  IF a.state = 'reversed' THEN RETURN 0; END IF;  -- กลับครบแล้ว = จบ (ไม่กลับซ้ำ)

  PERFORM pg_advisory_xact_lock(hashtext('aff-order:' || o.id));
  pol := public.affiliate_policy_state();
  v_rate := (pol ->> 'points_per_qualified_order')::integer;
  v_cap := (pol ->> 'monthly_cap')::integer;
  v_goods := GREATEST(0::numeric, o.subtotal - o.discount_amount);
  SELECT COALESCE(SUM(COALESCE((pi.metadata ->> 'refunded_total_minor')::numeric, 0)), 0) / 100
    INTO v_refunded
    FROM public.payment_intents pi
   WHERE pi.order_number = o.order_number;

  SELECT COALESCE(l.points, 0) INTO v_earn
    FROM public.points_ledger l
   WHERE l.order_id = o.id AND l.entry_type = 'affiliate' AND l.points > 0;
  SELECT COALESCE(-SUM(l.points), 0) INTO v_recorded
    FROM public.points_ledger l
   WHERE l.order_id = o.id AND l.entry_type = 'affiliate' AND l.points < 0;

  -- ===== 1) reversal (mirror 155) =====
  IF v_earn > 0 THEN
    IF o.status::text IN ('cancelled','failed') THEN
      v_target := v_earn; v_reason := 'order_' || o.status::text;
    ELSIF o.payment_status::text = 'refund' THEN
      v_target := v_earn; v_reason := 'payment_refund';
    ELSIF o.payment_status::text = 'partially_refunded' AND v_goods > 0 THEN
      v_target := LEAST(v_earn, FLOOR(v_earn * LEAST(v_refunded, v_goods) / v_goods)::integer);
      v_reason := 'payment_partial_refund';
    END IF;
    v_delta := v_target - v_recorded;
    IF v_delta > 0 AND v_reason IS NOT NULL THEN
      v_id := 'afv-' || substr(md5(o.id || ':rev:' || v_recorded::text), 1, 12);
      INSERT INTO public.points_ledger
        (id, customer_id, customer_ref, points, entry_type, order_id, order_number,
         basis_amount, rate_used, reason)
      VALUES
        (v_id, a.affiliate_customer_id, a.affiliate_ref, -v_delta, 'affiliate', o.id, o.order_number,
         v_goods, 0, 'ปรับกลับ affiliate ' || v_reason || ' (ออเดอร์ ' || o.order_number || ')')
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN
        IF v_target >= v_earn THEN
          UPDATE public.affiliate_attributions
             SET state = 'reversed', reversed_at = now()
           WHERE id = a.id AND state <> 'reversed';
        END IF;
        PERFORM public.append_audit_log(
          'affiliate_reverse', 'order', o.id,
          'affiliate reverse ' || (-v_delta)::text || ' pts (' || v_reason || ') order ' || o.order_number,
          jsonb_build_object('order_number', o.order_number, 'points', -v_delta,
                             'reason', v_reason, 'affiliate_customer_id', a.affiliate_customer_id));
      END IF;
    END IF;
    RETURN v_n;
  END IF;

  -- ===== 2) earn (ยังไม่เคยได้) =====
  IF a.state = 'pending'
     AND o.status::text = (pol ->> 'qualify_status')::text
     AND o.payment_status::text NOT IN ('refund','partially_refunded') THEN
    IF (pol ->> 'enabled')::boolean AND v_rate > 0 THEN
      IF v_cap IS NULL OR v_cap <= 0 THEN RETURN 0; END IF;  -- fail-closed: ไม่กำหนดเพดาน = ยังไม่จ่าย
      SELECT COALESCE(SUM(l.points), 0)::integer INTO v_month
        FROM public.points_ledger l
       WHERE l.entry_type = 'affiliate' AND l.customer_ref = a.affiliate_ref
         AND (l.created_at AT TIME ZONE 'Asia/Bangkok')::date >= date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok')::date;
      IF v_month + v_rate > v_cap THEN RETURN 0; END IF;   -- ชนเพดานรายเดือน = รอเดือนถัดไป (pending ต่อ)

      v_id := 'afa-' || substr(md5(o.id || ':earn'), 1, 12);
      INSERT INTO public.points_ledger
        (id, customer_id, customer_ref, points, entry_type, order_id, order_number,
         basis_amount, rate_used, reason)
      VALUES
        (v_id, a.affiliate_customer_id, a.affiliate_ref, v_rate, 'affiliate', o.id, o.order_number,
         v_goods, 0, '(ครีเอเตอร์) รางวัลจากออเดอร์ ' || o.order_number)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_ins = ROW_COUNT;
      IF v_ins > 0 THEN
        UPDATE public.affiliate_attributions
           SET state = 'qualified', qualified_at = now()
         WHERE id = a.id AND state = 'pending';
        PERFORM public.append_audit_log(
          'affiliate_earn', 'order', o.id,
          'affiliate +' || v_rate || ' pts order ' || o.order_number,
          jsonb_build_object('order_number', o.order_number, 'points', v_rate,
                             'monthly_cap', v_cap, 'affiliate_customer_id', a.affiliate_customer_id));
        v_n := v_n + 1;
      END IF;
    END IF;
  END IF;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.affiliate_sync_order(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_sync_order(text) TO service_role;

-- ---- 156m: trigger ทุกเส้นทางเปลี่ยน → affiliate_sync_order (ครอบแบบ 155h) ----
CREATE OR REPLACE FUNCTION public.affiliate_order_hook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.affiliate_sync_order(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.affiliate_order_hook() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_affiliate_order_sync ON public.orders;
CREATE TRIGGER trg_affiliate_order_sync
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
        OR OLD.payment_status IS DISTINCT FROM NEW.payment_status
        OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
        OR OLD.discount_amount IS DISTINCT FROM NEW.discount_amount)
  EXECUTE FUNCTION public.affiliate_order_hook();

-- เส้นทางคืนเงินของ EF (metadata ก่อนแล้วค่อยแตะ orders — mirror 155i)
CREATE OR REPLACE FUNCTION public.affiliate_intent_hook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id text;
BEGIN
  SELECT o.id INTO v_order_id FROM public.orders o WHERE o.order_number = NEW.order_number;
  IF v_order_id IS NOT NULL THEN
    PERFORM public.affiliate_sync_order(v_order_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.affiliate_intent_hook() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_affiliate_intent_sync ON public.payment_intents;
CREATE TRIGGER trg_affiliate_intent_sync
  AFTER UPDATE ON public.payment_intents
  FOR EACH ROW
  WHEN (OLD.metadata IS DISTINCT FROM NEW.metadata)
  EXECUTE FUNCTION public.affiliate_intent_hook();

-- ---- 156n: rewards_catalog_list — รายการแลกของลูกค้า (active เท่านั้น · เรียง sort_order) ----
CREATE OR REPLACE FUNCTION public.rewards_catalog_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(x ORDER BY x ->> 'sort_order', (x ->> 'points_cost')::int)
      FROM (
        SELECT jsonb_build_object(
                 'id', rc.id, 'name', rc.name, 'description', rc.description,
                 'points_cost', rc.points_cost, 'sort_order', rc.sort_order) AS x
          FROM public.rewards_catalog rc
         WHERE rc.is_active
      ) s), '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rewards_catalog_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rewards_catalog_list() TO authenticated, service_role;

-- รายการ "ทั้งหมด" สำหรับแอดมิน (รวม is_active=false — ไม่งั้นเปิดกลับไม่ได้)
CREATE OR REPLACE FUNCTION public.rewards_admin_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(x ORDER BY x ->> 'sort_order', (x ->> 'points_cost')::int)
      FROM (
        SELECT jsonb_build_object(
                 'id', rc.id, 'name', rc.name, 'description', rc.description,
                 'points_cost', rc.points_cost, 'is_active', rc.is_active,
                 'sort_order', rc.sort_order) AS x
          FROM public.rewards_catalog rc
      ) s), '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rewards_admin_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rewards_admin_list() TO authenticated, service_role;

-- ---- 156o: rewards_admin_save / rewards_admin_remove — แอดมินจัดการแคตตาล็อก (audit ทุกครั้ง) ----
CREATE OR REPLACE FUNCTION public.rewards_admin_save(
  p_id text, p_name text, p_description text,
  p_points_cost integer, p_is_active boolean, p_sort_order integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_name text;
  v_cost integer;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  v_name := NULLIF(btrim(COALESCE(p_name, '')), '');
  IF v_name IS NULL THEN RAISE EXCEPTION 'ERR_INVALID_NAME'; END IF;
  v_cost := COALESCE(p_points_cost, 0);
  IF v_cost <= 0 OR v_cost > 1000000 THEN RAISE EXCEPTION 'ERR_INVALID_POINTS'; END IF;
  v_id := NULLIF(btrim(COALESCE(p_id, '')), '');
  IF v_id IS NULL THEN
    v_id := 'rw-' || substr(md5(v_name || ':' || clock_timestamp()::text), 1, 10);
  END IF;
  INSERT INTO public.rewards_catalog (id, name, description, points_cost, is_active, sort_order, updated_at)
  VALUES (v_id, v_name, COALESCE(p_description, ''), v_cost,
          COALESCE(p_is_active, true), COALESCE(p_sort_order, 0), now())
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, description = EXCLUDED.description,
        points_cost = EXCLUDED.points_cost, is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order, updated_at = now();
  PERFORM public.append_audit_log(
    'rewards_catalog_save', 'reward', v_id,
    'save reward "' || v_name || '" (' || v_cost || ' pts)',
    jsonb_build_object('id', v_id, 'name', v_name, 'points_cost', v_cost,
                       'is_active', COALESCE(p_is_active, true)));
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rewards_admin_save(text, text, text, integer, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rewards_admin_save(text, text, text, integer, boolean, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rewards_admin_remove(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  SELECT name INTO v_name FROM public.rewards_catalog WHERE id = btrim(p_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_FOUND'; END IF;
  DELETE FROM public.rewards_catalog WHERE id = btrim(p_id);
  PERFORM public.append_audit_log(
    'rewards_catalog_remove', 'reward', btrim(p_id),
    'remove reward "' || v_name || '"', jsonb_build_object('id', btrim(p_id), 'name', v_name));
  RETURN jsonb_build_object('ok', true, 'id', btrim(p_id));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rewards_admin_remove(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rewards_admin_remove(text) TO authenticated, service_role;

-- ---- 156p: spin_admin_stats — สถิติล้อสุ่มสำหรับศูนย์กลางการตลาด (แอดมินเท่านั้น) ----
CREATE OR REPLACE FUNCTION public.spin_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pol jsonb;
  v_today integer := 0;
  v_month integer := 0;
  v_pts integer := 0;
  v_recent jsonb := '[]'::jsonb;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  v_pol := public.spin_policy_state();
  SELECT count(*)::integer,
         count(DISTINCT customer_ref)::integer
    INTO v_today, v_month
    FROM public.points_ledger
   WHERE entry_type = 'spin'
     AND (created_at AT TIME ZONE 'Asia/Bangkok')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date;
  SELECT COALESCE(SUM(points), 0)::integer INTO v_pts
    FROM public.points_ledger
   WHERE entry_type = 'spin'
     AND (created_at AT TIME ZONE 'Asia/Bangkok')::date >= date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok')::date;
  SELECT COALESCE(jsonb_agg(x ORDER BY x ->> 'created_at' DESC), '[]'::jsonb) INTO v_recent
    FROM (
      SELECT jsonb_build_object('customer_id', l.customer_id, 'points', l.points,
                                'created_at', l.created_at) AS x
        FROM public.points_ledger l
       WHERE l.entry_type = 'spin'
       ORDER BY l.created_at DESC
       LIMIT 20
    ) s;
  RETURN jsonb_build_object(
    'policy', v_pol,
    'spins_today', v_today,
    'spinners_today', v_month,
    'points_this_month', v_pts,
    'recent', v_recent);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spin_admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_admin_stats() TO authenticated, service_role;

-- ---- 156q: affiliate_admin_stats — สถิติครีเอเตอร์ + attribution (แอดมินเท่านั้น) ----
CREATE OR REPLACE FUNCTION public.affiliate_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pol jsonb;
  v_codes integer := 0;
  v_att jsonb := '{}'::jsonb;
  v_pts integer := 0;
  v_month integer := 0;
  v_recent jsonb := '[]'::jsonb;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  v_pol := public.affiliate_policy_state();
  SELECT count(*)::integer INTO v_codes FROM public.affiliate_codes WHERE is_active;
  SELECT jsonb_build_object(
           'pending',  count(*) FILTER (WHERE state = 'pending'),
           'qualified', count(*) FILTER (WHERE state = 'qualified'),
           'reversed', count(*) FILTER (WHERE state = 'reversed'))
    INTO v_att
    FROM public.affiliate_attributions;
  SELECT COALESCE(SUM(points), 0)::integer INTO v_pts
    FROM public.points_ledger WHERE entry_type = 'affiliate';
  SELECT COALESCE(SUM(points), 0)::integer INTO v_month
    FROM public.points_ledger
   WHERE entry_type = 'affiliate'
     AND (created_at AT TIME ZONE 'Asia/Bangkok')::date >= date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok')::date;
  SELECT COALESCE(jsonb_agg(x ORDER BY x ->> 'created_at' DESC), '[]'::jsonb) INTO v_recent
    FROM (
      SELECT jsonb_build_object('order_number', aa.order_number, 'state', aa.state,
                                'affiliate_customer_id', aa.affiliate_customer_id,
                                'created_at', aa.created_at) AS x
        FROM public.affiliate_attributions aa
       ORDER BY aa.created_at DESC
       LIMIT 20
    ) s;
  RETURN jsonb_build_object(
    'policy', v_pol,
    'codes_active', v_codes,
    'attributions', v_att,
    'points_total', v_pts,
    'points_this_month', v_month,
    'recent', v_recent);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.affiliate_admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_stats() TO authenticated, service_role;

COMMIT;