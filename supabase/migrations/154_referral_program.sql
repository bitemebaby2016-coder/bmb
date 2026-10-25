-- ============================================================
-- Migration 154 — Growth & Rewards STAGE 2 (Referral & Affiliate)
-- Owner command 2026-10-25: "อนุมัติตามนายแนะนำ" → Rollout ข้อ ② (ต่อจาก 153 Promotions)
-- (กติกา/คำตอบทั้งหมด = docs/BMB_GROWTH_REWARDS_INVENTORY_2026-10-25.md §5.3
--  + requirements §4.1/§4.2 — ห้ามข้ามขั้น · ห้ามเดา · inspect-first แล้ว)
--
-- สิ่งที่ stage นี้ปิด (ตาม §5.3 Referral Identity + 3 ระดับป้องกัน):
--   1. unique identity = บัญชีที่ยืนยันตัวตนแล้ว (auth uid) เป็นหลัก + เบอร์ OTP
--      เป็นหลักฐานเสริม (mirror `normalizeOtpPhone`: ตัวเลขล้วน 14 หลัก · 66x → 0x)
--      * ผู้แนะนำ ต้องมีบัญชีระบุตัวตนได้ + มี referral code เฉพาะ (customers.referral_code)
--      * เพื่อนใหม่ = ระบบตรวจได้ว่า "ไม่เคยมีออเดอร์มาก่อน" (นิยาม system-checkable)
--   2. ป้องกัน self-referral 3 ระดับ (§5.3):
--      - Hard block : บัญชีเดียวกัน · เบอร์เดียวกัน (guest checkout = phone-keyed account
--                     โดยออกแบบ → เบอร์เดียวกัน = บัญชีเดียวกัน) · เพื่อนไม่ใหม่ ·
--                     เคยถูกแนะนำโดยผู้อื่นแล้ว · บันทึกซ้ำ (PK order_id)
--                     → status='blocked' + reason (audit trail — ไม่ใช่ error ทำออเดอร์ล้มเหลว)
--      - Review     : เพดานจำนวนครั้ง/เดือนของผู้แนะนำเกิน → risk='review' =
--                     "พักรางวัลเพื่อให้ตรวจสอบ" ห้ามแบนจากสัญญาณเดียว (แอดมิน approve/reject)
--      - Soft signal: IP/อุปกรณ์/เครือข่าย = ไม่เก็บ ไม่เดา ไม่ใช้เป็นเกณฑ์ปฏิเสธ
--                     (กติกา: ครอบครัว/ออฟฟิศใช้เครือข่ายเดียวกันได้)
--   3. รางวัลออกเมื่อออเดอร์ "ผ่านสถานะที่กำหนด" (policy.qualify_status = 'delivered'
--      ค่าเริ่มต้น · แอดมินปรับได้) → ออกคูปอง 2 ใบ (ผู้แนะนำ + เพื่อนใหม่) เป็น
--      `promotions` row (fixed_amount — §4.1: โค้ด = ส่วนลดเท่านั้น ไม่มีเงินสด)
--      + ledger `referral_rewards` + notification (Owner: "แจ้งรางวัลทาง notice")
--      คูปองที่ออกใช้งบ/kill switch ของ Stage 1 อัตโนมัติเวลาถูกใช้ (promotion_apply_rules)
--   4. ยกเลิก/คืนเงิน → ปรับตาม ledger "โดยไม่หักซ้ำ": ยังไม่ออก = void · ออกแล้ว =
--      state='reversed' + ถ้าคูปองยังไม่ถูกใช้ (usage_count=0) = ปิดทันที (is_active=false)
--      · ใช้ไปแล้ว = บันทึก reversal ไว้ ไม่ลบ history (audit trail ครบ §4.2)
--   5. attribution มีหน้าต่างเวลา (policy.claim_window_hours = 72 ชม. ค่าเริ่มต้น) +
--      ตรวจสอบย้อนหลังได้ (อ้าง order เสมอ · ห้ามเปลี่ยนผู้แนะนำย้อนหลัง — claim ซ้ำ
--      คืนค่าเดิมเสมอ)
--
-- จุดเรียกเดียวฝั่งลูกค้า: public.referral_claim(p_order_number, p_referral_code)
--   * เรียกโดย client ทันทีหลัง create_order_with_items(_i)/create_pickup_order_i สำเร็จ
--   * ทุกกติกา validate ฝั่งเซิร์ฟเวอร์ใน RPC นี้ที่เดียว (client mirror =
--     src/lib/referralClient.ts = preview/กันกดล่วงหน้าเท่านั้น — แบบ coupon gate)
--   * เจ้าของออเดอร์เท่านั้น (auth.uid() = orders.customer_ref) · idempotent (PK)
--   * ถ้าออเดอร์ผ่าน qualify_status ไปแล้วตอน claim = ออกรางวัลทันทีในเคสนั้น
--   * kill switch ปิด = ไม่บันทึก attribution ใหม่ (ของออกแล้วไม่ย้อน — §4.1 ข้อ 8)
-- หมายเหตุ: ไม่แตะ signature create_order_with_items / _i / create_pickup_order_i
--   (คง overload pin ของ 124/127 ไว้เป๊ะ — attribution เป็น RPC ของตัวเอง)
-- สัญญาทดสอบ: e2e/contracts_154_referral_program.sql (CI step แล้ว)
-- Rollback: ลบ triggers + functions + 2 ตาราง + คอลัมน์ 2 ตัว — ไม่แตะ
--   ข้อมูลออเดอร์/การเงินเดิม (คูปองที่ออกแล้วเป็น promotions row ปกติ)
-- ============================================================

BEGIN;

-- ---- 154a: คอลัมน์ตัวตนแนะนำบน customers (idempotent — replay/production ใช้ร่วมกันได้) ----
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referred_by text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_referral_code_key') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;

-- backfill: ทุก customers row ได้รหัสเฉพาะตัว (format BMB-XXXXXXXX — deterministic จาก
-- id + retry ถ้าชน · คอลัมน์ว่างภายหลัง = สุ่มตอนเรียก referral_my_code ครั้งแรก)
DO $$
DECLARE
  r record;
  v_code text;
  v_try integer;
BEGIN
  FOR r IN SELECT id FROM public.customers WHERE referral_code IS NULL ORDER BY id LOOP
    v_try := 0;
    LOOP
      v_code := 'BMB-' || upper(substr(md5(r.id || ':' || v_try::text), 1, 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customers WHERE referral_code = v_code);
      v_try := v_try + 1;
      EXIT WHEN v_try > 99;
    END LOOP;
    UPDATE public.customers SET referral_code = v_code
     WHERE id = r.id AND referral_code IS NULL;
  END LOOP;
END $$;

-- ---- 154b: referral_attributions — การผูกออเดอร์กับผู้แนะนำ (ตรวจสอบย้อนหลังได้) ----
CREATE TABLE IF NOT EXISTS public.referral_attributions (
  order_id              text PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number          text NOT NULL,
  referrer_customer_id  text NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  referrer_code         text NOT NULL,
  referred_customer_ref uuid,
  referred_phone        text,
  status                text NOT NULL DEFAULT 'held'
                        CHECK (status IN ('held','qualified','blocked','reversed','void')),
  risk_level            text NOT NULL DEFAULT 'none'
                        CHECK (risk_level IN ('none','review')),
  reason                text,
  signals               jsonb NOT NULL DEFAULT '{}'::jsonb,
  rewarded_at           timestamptz,
  resolved_by           uuid,
  resolved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_attr_referrer ON public.referral_attributions (referrer_customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_attr_referred ON public.referral_attributions (referred_customer_ref);
CREATE INDEX IF NOT EXISTS idx_referral_attr_status ON public.referral_attributions (status, created_at DESC);

-- deny-all สำหรับ anon/authenticated (อ่าน/เขียนผ่าน SECURITY DEFINER เท่านั้น — รูปแบบ 122)
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_attributions FROM anon, authenticated;

-- ---- 154c: referral_rewards — ledger รางวัล (append + state — audit ครบ §4.2) ----
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id                       text PRIMARY KEY,
  order_id                 text NOT NULL REFERENCES public.referral_attributions(order_id) ON DELETE CASCADE,
  beneficiary_role         text NOT NULL CHECK (beneficiary_role IN ('referrer','friend')),
  beneficiary_customer_id  text NOT NULL,
  coupon_promotion_id      text NOT NULL REFERENCES public.promotions(id) ON DELETE RESTRICT,
  coupon_code              text NOT NULL,
  amount                   numeric(10,2) NOT NULL CHECK (amount >= 0),
  state                    text NOT NULL DEFAULT 'issued' CHECK (state IN ('issued','reversed')),
  reversal_reason          text,
  reversed_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- กันออกซ้ำ: 1 ออเดอร์ = 1 รางวัลต่อบุคคล (idempotent ทุกเส้นทาง)
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_order_role
  ON public.referral_rewards (order_id, beneficiary_role);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_beneficiary
  ON public.referral_rewards (beneficiary_customer_id, created_at DESC);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_rewards FROM anon, authenticated;

-- ---- 154d: นโยบายโปรแกรมแนะนำเพื่อน (Owner: ทำสูตรไว้ แอดมินปรับเองได้) ----
--   ฿30/฿30 = ตรงข้อความหน้าแชร์ที่โชว์อยู่แล้ว · qualify = 'delivered' (ออเดอร์สำเร็จ)
--   งบรวมถูกคุมโดย promotion_policy (15%) เวลาคูปองถูกใช้ — ไม่งบซ้ำ
INSERT INTO public.business_settings (key, value)
VALUES ('referral_policy', '{
  "enabled": true,
  "referrer_reward_baht": 30,
  "friend_reward_baht": 30,
  "qualify_status": "delivered",
  "coupon_validity_days": 30,
  "referrer_monthly_cap": 20,
  "min_order_amount": 0,
  "claim_window_hours": 72,
  "share_base_url": ""
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---- 154e: referral_enabled — kill switch ของโปรแกรม (ค่าเริ่มต้น = true) ----
CREATE OR REPLACE FUNCTION public.referral_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE WHEN jsonb_typeof(bs.value -> 'enabled') = 'boolean'
                THEN (bs.value ->> 'enabled')::boolean
           END
      FROM public.business_settings bs
     WHERE bs.key = 'referral_policy'
       AND bs.branch_id IS NULL
     LIMIT 1
  ), true);
$$;
REVOKE EXECUTE ON FUNCTION public.referral_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_enabled() TO authenticated, service_role;

-- ---- 154f: referral_policy_state — แหล่งเดียวของทุกจุดตรวจ (tolerant แบบ promotion_budget_state) ----
--   key หาย/ชนิดผิด = ค่าเริ่มต้น · JSON null (cap) = ไม่จำกัด · ไม่เคยแสร้งว่ามีค่าที่ไม่มี
CREATE OR REPLACE FUNCTION public.referral_policy_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bs AS (
    SELECT (SELECT b2.value FROM public.business_settings b2
             WHERE b2.key = 'referral_policy' AND b2.branch_id IS NULL LIMIT 1) AS v
  )
  SELECT jsonb_build_object(
    'enabled', public.referral_enabled(),
    'referrer_reward_baht',
      CASE WHEN jsonb_typeof(v -> 'referrer_reward_baht') = 'number'
           THEN (v ->> 'referrer_reward_baht')::numeric ELSE 30 END,
    'friend_reward_baht',
      CASE WHEN jsonb_typeof(v -> 'friend_reward_baht') = 'number'
           THEN (v ->> 'friend_reward_baht')::numeric ELSE 30 END,
    'qualify_status',
      CASE WHEN jsonb_typeof(v -> 'qualify_status') = 'string'
             AND (v ->> 'qualify_status') IN ('confirmed','preparing','ready_for_dispatch',
                                              'dispatched','in_transit','arrived','delivered')
           THEN v ->> 'qualify_status' ELSE 'delivered' END,
    'coupon_validity_days',
      CASE WHEN jsonb_typeof(v -> 'coupon_validity_days') = 'number'
           THEN (v ->> 'coupon_validity_days')::numeric ELSE 30 END,
    'referrer_monthly_cap',
      CASE WHEN jsonb_typeof(v -> 'referrer_monthly_cap') = 'number'
             THEN (v ->> 'referrer_monthly_cap')::numeric
           WHEN jsonb_typeof(v -> 'referrer_monthly_cap') = 'null' THEN NULL
           ELSE 20 END,
    'min_order_amount',
      CASE WHEN jsonb_typeof(v -> 'min_order_amount') = 'number'
           THEN (v ->> 'min_order_amount')::numeric ELSE 0 END,
    'claim_window_hours',
      CASE WHEN jsonb_typeof(v -> 'claim_window_hours') = 'number'
           THEN (v ->> 'claim_window_hours')::numeric ELSE 72 END,
    'share_base_url',
      CASE WHEN jsonb_typeof(v -> 'share_base_url') = 'string'
           THEN v ->> 'share_base_url' ELSE '' END
  ) FROM bs;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_policy_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_policy_state() TO authenticated, service_role;

-- ---- 154g: normalizers — mirror ของ src/lib/referralClient.ts (ต้องตรงกันเป๊ะ) ----
CREATE OR REPLACE FUNCTION public.referral_normalize_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(upper(regexp_replace(trim(COALESCE(p_code, '')), '\s+', '', 'g')), '');
$$;

-- mirror otpPolicy.normalizeOtpPhone: ตัวเลขล้วน · right 14 · then 66xxx → 0xxx
CREATE OR REPLACE FUNCTION public.referral_normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH d AS (
    SELECT right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 14) AS x
  )
  SELECT CASE
           WHEN x ~ '^66[0-9]{9}$'  THEN '0' || substr(x, 3)
           WHEN x ~ '^0066[0-9]{9}$' THEN '0' || substr(x, 5)
           ELSE x
         END
    FROM d;
$$;

-- ---- 154h: referral_my_code — ดึง/สร้างรหัสแนะนำของตัวเอง (authenticated · เฉพาะ uid ตัวเอง) ----
CREATE OR REPLACE FUNCTION public.referral_my_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_try integer;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  -- คอลัมน์ convention จาก 131: customers.id = auth uid (text)
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_uid::text) THEN
    SELECT COALESCE(NULLIF(btrim(COALESCE(p.name, '')), ''), 'Customer')
      INTO v_name FROM public.profiles p WHERE p.id = v_uid;
    INSERT INTO public.customers (id, user_id, full_name, phone, email)
    VALUES (v_uid::text, v_uid, COALESCE(v_name, 'Customer'),
            (SELECT NULLIF(btrim(COALESCE(p.phone, '')), '') FROM public.profiles p WHERE p.id = v_uid),
            (SELECT NULLIF(btrim(COALESCE(p.email, '')), '') FROM public.profiles p WHERE p.id = v_uid))
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT referral_code INTO v_code FROM public.customers WHERE id = v_uid::text;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  v_try := 0;
  LOOP
    v_code := 'BMB-' || upper(substr(md5(v_uid::text || ':' || v_try::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customers WHERE referral_code = v_code);
    v_try := v_try + 1;
    IF v_try > 99 THEN RAISE EXCEPTION 'ERR_REFERRAL_CODE_EXHAUSTED'; END IF;
  END LOOP;

  UPDATE public.customers SET referral_code = v_code
   WHERE id = v_uid::text AND referral_code IS NULL;
  RETURN v_code;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_my_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_my_code() TO authenticated;

-- ---- 154i: referral_preview — client precheck (anon ใช้ได้ · คืนแค่ผ่าน/ไม่ผ่าน ไม่เปิดเผยตัวตน) ----
CREATE OR REPLACE FUNCTION public.referral_preview(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT public.referral_enabled() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'disabled');
  END IF;
  v_code := public.referral_normalize_code(p_code);
  IF v_code IS NULL OR v_code !~ '^BMB-[A-Z0-9]{6,16}$' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'bad_format');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE referral_code = v_code) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'unknown_code');
  END IF;
  RETURN jsonb_build_object('valid', true, 'reason', NULL);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_preview(text) TO anon, authenticated;

-- ---- 154j: referral_issue_rewards — ออกรางวัล (คูปอง 2 ใบ + ledger + notice) · idempotent ----
--   เรียกจาก trigger เมื่อออเดอร์ผ่าน qualify_status · จาก claim ถ้าเลยสถานะไปแล้ว
--   · และจากแอดมิน approve (p_force = ปลดล็อก risk='review' — ไม่ข้ามเงื่อนไขสถานะ)
CREATE OR REPLACE FUNCTION public.referral_issue_rewards(p_order_id text, p_force boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.referral_attributions%ROWTYPE;
  o public.orders%ROWTYPE;
  pol jsonb;
  v_issued integer := 0;
  v_n integer;
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_end date;
  v_role text;
  v_amount numeric;
  v_benef text;
  v_promo_id text;
  v_code text;
  v_rid text;
  v_label text;
BEGIN
  IF NOT public.referral_enabled() THEN RETURN 0; END IF; -- kill switch: หยุดออกของใหม่
  SELECT * INTO a FROM public.referral_attributions WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR a.status <> 'held' THEN RETURN 0; END IF;
  IF a.risk_level = 'review' AND NOT COALESCE(p_force, false) THEN RETURN 0; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  pol := public.referral_policy_state();
  -- §4.2: ให้รางวัล "เมื่อออเดอร์ผ่านสถานะที่กำหนด" เท่านั้น
  IF o.status::text <> (pol ->> 'qualify_status') THEN RETURN 0; END IF;
  IF o.payment_status::text IN ('refund', 'partially_refunded') THEN RETURN 0; END IF;
  v_end := v_today + ((pol ->> 'coupon_validity_days')::numeric)::integer;

  FOREACH v_role IN ARRAY ARRAY['referrer', 'friend'] LOOP
    v_amount := CASE WHEN v_role = 'referrer'
                     THEN (pol ->> 'referrer_reward_baht')::numeric
                     ELSE (pol ->> 'friend_reward_baht')::numeric END;
    CONTINUE WHEN v_amount IS NULL OR v_amount <= 0;
    v_benef := CASE WHEN v_role = 'referrer' THEN a.referrer_customer_id
                    ELSE COALESCE(o.customer_ref::text, o.customer_id) END;
    CONTINUE WHEN v_benef IS NULL;

    v_promo_id := 'refp-' || substr(md5(p_order_id || ':' || v_role), 1, 12);
    v_code := 'RF' || upper(substr(md5(p_order_id || ':' || v_role || ':c'), 1, 10));
    v_label := CASE WHEN v_role = 'referrer' THEN 'รางวัลแนะนำเพื่อน (ผู้แนะนำ)'
                    ELSE 'รางวัลแนะนำเพื่อน (เพื่อนใหม่)' END;

    -- คูปอง = promotions row จริง (fixed_amount · usage_limit 1 · ใช้งบ 15% ของ 153 ตอนถูกใช้)
    INSERT INTO public.promotions
      (id, name, description, code, discount_type, discount_value,
       min_order_amount, start_date, end_date, is_active)
    VALUES
      (v_promo_id, v_label,
       'ออกจากรายการแนะนำเพื่อน — ออเดอร์ ' || o.order_number,
       v_code, 'fixed_amount', v_amount,
       (pol ->> 'min_order_amount')::numeric, v_today, v_end, true)
    ON CONFLICT (id) DO NOTHING;

    v_rid := 'refr-' || substr(md5(p_order_id || ':' || v_role || ':r'), 1, 12);
    INSERT INTO public.referral_rewards
      (id, order_id, beneficiary_role, beneficiary_customer_id,
       coupon_promotion_id, coupon_code, amount, state)
    VALUES
      (v_rid, p_order_id, v_role, v_benef, v_promo_id, v_code, v_amount, 'issued')
    ON CONFLICT (order_id, beneficiary_role) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_issued := v_issued + v_n;

    -- Owner: "แจ้งรางวัลทาง notice และเก็บไว้ในโปรไฟล์"
    IF v_n > 0 AND EXISTS (SELECT 1 FROM public.customers WHERE id = v_benef) THEN
      INSERT INTO public.notifications (id, customer_id, title, message, notification_type)
      VALUES
        ('ntf-' || v_rid, v_benef, '🎉 ได้รับรางวัลแนะนำเพื่อน',
         'คูปอง ' || v_code || ' มูลค่า ' || trim(to_char(v_amount, 'FM999999990.00'))
           || ' บาท ใช้ได้ถึง ' || to_char(v_end, 'DD/MM/YYYY')
           || ' — ดูโค้ดได้ที่หน้า "ชวนเพื่อน" และในโปรไฟล์ของคุณ',
         'referral')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

  UPDATE public.referral_attributions
     SET status = 'qualified',
         rewarded_at = COALESCE(rewarded_at, now()),
         updated_at = now()
   WHERE order_id = p_order_id AND status = 'held';
  RETURN v_issued;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_issue_rewards(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_issue_rewards(text, boolean) TO service_role;

-- ---- 154k: referral_reverse_rewards — ยกเลิก/คืนเงิน → ปรับกลับตาม ledger (ไม่หักซ้ำ) ----
CREATE OR REPLACE FUNCTION public.referral_reverse_rewards(p_order_id text, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.referral_attributions%ROWTYPE;
  v_n integer := 0;
BEGIN
  SELECT * INTO a FROM public.referral_attributions WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF a.status = 'held' THEN
    -- ยังไม่ออก = ยกเลิกเงียบ (void) — เหตุผลเก็บใน signals (audit ครบ)
    UPDATE public.referral_attributions
       SET status = 'void',
           signals = signals || jsonb_build_object('void_reason', p_reason),
           updated_at = now()
     WHERE order_id = p_order_id AND status = 'held';
    RETURN 0;
  END IF;
  IF a.status <> 'qualified' THEN RETURN 0; END IF; -- blocked/reversed/void = ไม่ทำซ้ำเด็ดขาด

  -- คูปองยังไม่ถูกใช้ = ปิดทันที · ใช้ไปแล้ว = คงสิทธิ์ (ไม่ย้อนสิทธิ์ที่ใช้ไปแล้ว — §4.1 ข้อ 8)
  UPDATE public.promotions p
     SET is_active = false, updated_at = now()
    FROM public.referral_rewards r
   WHERE r.order_id = p_order_id AND r.state = 'issued'
     AND r.coupon_promotion_id = p.id
     AND p.usage_count = 0 AND p.is_active = true;

  UPDATE public.referral_rewards
     SET state = 'reversed', reversal_reason = p_reason, reversed_at = now(), updated_at = now()
   WHERE order_id = p_order_id AND state = 'issued';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.referral_attributions
     SET status = 'reversed',
         signals = signals || jsonb_build_object('reversal_reason', p_reason),
         updated_at = now()
   WHERE order_id = p_order_id AND status = 'qualified';
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_reverse_rewards(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_reverse_rewards(text, text) TO service_role;

-- ---- 154l: trigger สถานะออเดอร์ — ผ่าน qualify → ออกรางวัล · ยกเลิก/คืนเงิน → ปรับกลับ ----
--   ครอบทุกเส้นทางการเปลี่ยนสถานะ (transition_order_status / admin_advance / payment)
CREATE OR REPLACE FUNCTION public.referral_order_status_hook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pol jsonb;
BEGIN
  -- ยกเลิก/คืนเงิน = ปรับตามต้นทางก่อนเสมอ (§4.2 — ปรับกลับตาม ledger ไม่หักซ้ำ)
  IF NEW.status IN ('cancelled', 'failed')
     OR NEW.payment_status IN ('refund', 'partially_refunded') THEN
    PERFORM public.referral_reverse_rewards(
      NEW.id,
      CASE WHEN NEW.status IN ('cancelled', 'failed')
           THEN 'order_' || NEW.status::text
           ELSE 'payment_' || NEW.payment_status::text END
    );
    RETURN NEW;
  END IF;

  pol := public.referral_policy_state();
  IF NEW.status::text = (pol ->> 'qualify_status')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.referral_issue_rewards(NEW.id, false);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_order_status_hook() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_referral_order_status ON public.orders;
CREATE TRIGGER trg_referral_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
        OR OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  EXECUTE FUNCTION public.referral_order_status_hook();

-- ---- 154m: referral_claim — จุดเดียวฝั่งลูกค้า: ผูกโค้ดแนะนำกับออเดอร์ของตัวเอง ----
--   * เรียกโดย client ทันทีหลังสร้างออเดอร์สำเร็จ (delivery/pickup เหมือนกัน)
--   * ทุกกติกา validate ที่นี่ (server-authoritative) — client mirror มีไว้กันกดล่วงหน้า
--   * เจ้าของออเดอร์เท่านั้น · idempotent (PK order_id — claim ซ้ำ = ค่าเดิม ห้ามเปลี่ยน
--     ผู้แนะนำย้อนหลัง §5.3) · โค้ดผิด/ระบบปิด = คืนสถานะให้ client บอกลูกค้าตรง ๆ
--     ไม่บันทึกแถวขยะ · โค้ดถูกแต่เข้าข่ายกันโกง = บันทึก status='blocked' + reason (audit)
CREATE OR REPLACE FUNCTION public.referral_claim(p_order_number text, p_referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  o public.orders%ROWTYPE;
  a public.referral_attributions%ROWTYPE;
  v_ref public.customers%ROWTYPE;
  v_code text;
  v_status text := NULL;
  v_reason text := NULL;
  v_risk text := 'none';
  v_signals jsonb;
  v_prior integer;
  v_month integer;
  v_cap numeric;
  v_window numeric;
  v_order_phone text := '';
  v_ref_phone text;
  v_issued integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR btrim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND';
  END IF;
  SELECT * INTO o FROM public.orders WHERE order_number = btrim(p_order_number);
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  -- เจ้าของออเดอร์เท่านั้น (customer_ref = auth.uid · customer_id = uid text — แบบ 025)
  IF o.customer_ref IS DISTINCT FROM v_uid AND o.customer_id IS DISTINCT FROM v_uid::text THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  -- idempotent: claim ซ้ำ = คืนค่าเดิมเสมอ
  SELECT * INTO a FROM public.referral_attributions WHERE order_id = o.id;
  IF FOUND THEN
    RETURN jsonb_build_object('status', a.status, 'reason', a.reason, 'risk', a.risk_level,
                              'already_claimed', true, 'order_number', o.order_number);
  END IF;

  -- เงื่อนไขของออเดอร์
  IF o.status::text IN ('cancelled','failed')
     OR o.payment_status::text IN ('refund','partially_refunded') THEN
    RETURN jsonb_build_object('status', 'ineligible', 'reason', 'order_not_eligible',
                              'risk', 'none', 'already_claimed', false, 'order_number', o.order_number);
  END IF;
  IF NOT public.referral_enabled() THEN
    RETURN jsonb_build_object('status', 'disabled', 'reason', 'disabled',
                              'risk', 'none', 'already_claimed', false, 'order_number', o.order_number);
  END IF;

  v_code := public.referral_normalize_code(p_referral_code);
  IF v_code IS NULL OR v_code !~ '^BMB-[A-Z0-9]{6,16}$' THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'bad_format',
                              'risk', 'none', 'already_claimed', false, 'order_number', o.order_number);
  END IF;
  SELECT * INTO v_ref FROM public.customers WHERE referral_code = v_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'unknown_code',
                              'risk', 'none', 'already_claimed', false, 'order_number', o.order_number);
  END IF;

  -- หน้าต่างเวลาระบุผู้แนะนำ (policy.claim_window_hours — กำหนดช่วงเวลาให้ชัด §5.3)
  v_window := (public.referral_policy_state() ->> 'claim_window_hours')::numeric;
  IF v_window IS NOT NULL
     AND o.created_at < now() - make_interval(hours => v_window::integer) THEN
    v_status := 'blocked'; v_reason := 'claim_window_expired';
  END IF;

  v_order_phone := public.referral_normalize_phone(o.customer_phone);
  v_ref_phone := public.referral_normalize_phone(v_ref.phone);

  IF v_status IS NULL THEN
    -- ===== Hard block (ระดับ 1): บัญชีเดียวกัน / เบอร์เดียวกัน =====
    IF (v_ref.user_id IS NOT NULL AND v_ref.user_id = v_uid) OR v_ref.id = o.customer_id THEN
      v_status := 'blocked'; v_reason := 'self_referral';
    ELSIF v_ref_phone <> '' AND v_order_phone <> '' AND v_ref_phone = v_order_phone THEN
      v_status := 'blocked'; v_reason := 'same_phone';
    ELSE
      -- เพื่อนใหม่ = ไม่เคยมีออเดอร์ก่อนหน้า (นิยามที่ระบบตรวจได้ §5.3)
      SELECT count(*) INTO v_prior FROM public.orders o2
       WHERE o2.id <> o.id
         AND ((o2.customer_ref = v_uid)
              OR (v_order_phone <> '' AND public.referral_normalize_phone(o2.customer_phone) = v_order_phone));
      IF v_prior > 0 THEN
        v_status := 'blocked'; v_reason := 'not_new';
      ELSIF EXISTS (
        SELECT 1 FROM public.referral_attributions a2
         WHERE a2.referred_customer_ref = v_uid
           AND a2.status NOT IN ('blocked','void')
           AND a2.referrer_customer_id <> v_ref.id
      ) THEN
        v_status := 'blocked'; v_reason := 'already_referred';
      ELSE
        v_status := 'held';
        -- ===== Review (ระดับ 2): เพดานครั้ง/เดือนของผู้แนะนำ — พักรางวัลไม่แบน =====
        v_cap := (public.referral_policy_state() ->> 'referrer_monthly_cap')::numeric;
        IF v_cap IS NOT NULL THEN
          SELECT count(*) INTO v_month FROM public.referral_attributions a3
           WHERE a3.referrer_customer_id = v_ref.id
             AND a3.status IN ('held','qualified')
             AND a3.created_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok'))
                                    AT TIME ZONE 'Asia/Bangkok';
          IF v_month >= v_cap THEN
            v_risk := 'review'; v_reason := 'referrer_cap_exceeded';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- ===== Soft signal (ระดับ 3): ไม่เก็บ ไม่เดา ไม่ใช้เป็นเกณฑ์ปฏิเสธ =====
  v_signals := jsonb_build_object(
    'policy_version', 1,
    'claim_window_hours', v_window,
    'order_status_at_claim', o.status::text,
    'soft_signals', jsonb_build_object(
      'ip', NULL, 'device', NULL, 'network', NULL,
      'note', 'ไม่เก็บ IP/อุปกรณ์ ไม่ใช้เป็นเกณฑ์เดียว — ใช้ประกอบประเมินเมื่อมีสัญญาณอื่นร่วมเท่านั้น (§5.3)'
    )
  );

  INSERT INTO public.referral_attributions
    (order_id, order_number, referrer_customer_id, referrer_code,
     referred_customer_ref, referred_phone, status, risk_level, reason, signals)
  VALUES
    (o.id, o.order_number, v_ref.id, v_code, v_uid, v_order_phone,
     v_status, v_risk, v_reason, v_signals)
  ON CONFLICT (order_id) DO NOTHING; -- race: แถวแรกชนะ — ไม่ raise ไม่ทำออเดอร์พัง

  IF v_status = 'held' THEN
    -- ลิงก์ความเชื่อมโยงบัญชี (ครั้งแรกเท่านั้น — ห้ามเขียนทับของเดิม)
    UPDATE public.customers
       SET referred_by = COALESCE(referred_by, v_ref.id), updated_at = now()
     WHERE user_id = v_uid AND id <> v_ref.id AND referred_by IS NULL;
    -- claim ย้อนหลัง (ออเดอร์ผ่าน qualify ไปแล้ว) = ออกรางวัลทันทีในเคสนี้
    v_issued := public.referral_issue_rewards(o.id, false);
  END IF;

  RETURN jsonb_build_object('status', v_status, 'reason', v_reason, 'risk', v_risk,
                            'already_claimed', false, 'order_number', o.order_number);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_claim(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_claim(text, text) TO authenticated, service_role;

-- ---- 154n: referral_my_status — โค้ดของฉัน + รางวัลที่ได้ + นโยบาย (สำหรับหน้าแชร์/โปรไฟล์) ----
CREATE OR REPLACE FUNCTION public.referral_my_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  pol jsonb;
  v_rewards jsonb;
  v_stats jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  pol := public.referral_policy_state();
  v_code := public.referral_my_code(); -- สร้าง/ดึงรหัสตัวเอง (ปลอดภัยใน definer เดียวกัน)

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'coupon_code', r.coupon_code,
             'amount', r.amount,
             'state', r.state,
             'role', r.beneficiary_role,
             'reversal_reason', r.reversal_reason,
             'created_at', r.created_at
           ) ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_rewards
    FROM public.referral_rewards r
   WHERE r.beneficiary_customer_id IN (
     SELECT c.id FROM public.customers c WHERE c.user_id = v_uid OR c.id = v_uid::text
   );

  SELECT jsonb_build_object(
           'attributed_orders', count(*),
           'qualified', count(*) FILTER (WHERE a.status = 'qualified'),
           'held', count(*) FILTER (WHERE a.status = 'held')
         )
    INTO v_stats
    FROM public.referral_attributions a
   WHERE a.referred_customer_ref = v_uid
      OR a.referrer_customer_id IN (
        SELECT c.id FROM public.customers c WHERE c.user_id = v_uid OR c.id = v_uid::text
      );

  RETURN jsonb_build_object(
    'code', v_code,
    'enabled', (pol ->> 'enabled')::boolean,
    'share_base_url', pol ->> 'share_base_url',
    'referrer_reward_baht', (pol ->> 'referrer_reward_baht')::numeric,
    'friend_reward_baht', (pol ->> 'friend_reward_baht')::numeric,
    'rewards', v_rewards,
    'stats', v_stats
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_my_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_my_status() TO authenticated;

-- ---- 154o: referral_admin_stats — แผงแอดมิน (gate: is_admin) ----
CREATE OR REPLACE FUNCTION public.referral_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pol jsonb;
  v_totals jsonb;
  v_recent jsonb;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  pol := public.referral_policy_state();

  SELECT jsonb_build_object(
           'held', count(*) FILTER (WHERE a.status = 'held'),
           'review_pending', count(*) FILTER (WHERE a.status = 'held' AND a.risk_level = 'review'),
           'qualified', count(*) FILTER (WHERE a.status = 'qualified'),
           'blocked', count(*) FILTER (WHERE a.status = 'blocked'),
           'reversed', count(*) FILTER (WHERE a.status = 'reversed'),
           'void', count(*) FILTER (WHERE a.status = 'void'),
           'rewards_issued', COALESCE((SELECT sum(r.amount) FROM public.referral_rewards r
                                        WHERE r.state = 'issued'), 0)
         )
    INTO v_totals
    FROM public.referral_attributions a;

  SELECT COALESCE(jsonb_agg(x ORDER BY x ->> 'created_at' DESC), '[]'::jsonb)
    INTO v_recent
    FROM (
      SELECT jsonb_build_object(
               'order_number', a.order_number,
               'status', a.status,
               'risk', a.risk_level,
               'reason', a.reason,
               'referrer_code', a.referrer_code,
               'created_at', a.created_at,
               'rewarded_at', a.rewarded_at
             ) AS x
      FROM public.referral_attributions a
      ORDER BY a.created_at DESC
      LIMIT 50
    ) s;

  RETURN jsonb_build_object('policy', pol, 'totals', v_totals, 'recent', v_recent);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_admin_stats() TO authenticated, service_role;

-- ---- 154p: referral_resolve_attribution — แอดมินอนุมัติ/ปฏิเสธ การพักรางวัล (risk=review) ----
CREATE OR REPLACE FUNCTION public.referral_resolve_attribution(p_order_number text, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.referral_attributions%ROWTYPE;
  v_issued integer := 0;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_decision NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'ERR_INVALID_DECISION'; END IF;

  SELECT a2.* INTO a FROM public.referral_attributions a2
   WHERE a2.order_number = btrim(p_order_number);
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ATTRIBUTION_NOT_FOUND'; END IF;

  IF p_decision = 'approve' THEN
    IF a.status <> 'held' THEN RAISE EXCEPTION 'ERR_NOT_HELD'; END IF;
    -- ปลดล็อก review (ยังคงบังคับเงื่อนไขสถานะออเดอร์ใน issue — ไม่ข้ามขั้น)
    UPDATE public.referral_attributions
       SET risk_level = 'none',
           reason = CASE WHEN reason = 'referrer_cap_exceeded' THEN 'referrer_cap_approved' ELSE reason END,
           resolved_by = auth.uid(), resolved_at = now(), updated_at = now()
     WHERE order_id = a.order_id AND status = 'held';
    v_issued := public.referral_issue_rewards(a.order_id, true);
    RETURN jsonb_build_object('status', 'approved', 'issued', v_issued, 'order_number', a.order_number);
  END IF;

  UPDATE public.referral_attributions
     SET status = 'blocked', reason = 'admin_rejected',
         resolved_by = auth.uid(), resolved_at = now(), updated_at = now()
   WHERE order_id = a.order_id AND status = 'held';
  RETURN jsonb_build_object('status', 'rejected', 'issued', 0, 'order_number', a.order_number);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_resolve_attribution(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_resolve_attribution(text, text) TO authenticated, service_role;

COMMIT;