-- ============================================================
-- Migration 153 — Growth & Rewards STAGE 1 (Promotions): campaign controls
-- Owner command 2026-10-25: "เริ่มพัฒนา G&R ตามกฏ" → Rollout ข้อ ⑧ เริ่มที่ Promotions
-- (คำตอบ/กติกาทั้งหมด = docs/BMB_GROWTH_REWARDS_INVENTORY_2026-10-25.md §1/§5)
--
-- สิ่งที่ stage นี้ปิด (§5.8 ข้อ 1: ต่อยอดคูปอง+ส่วนลดเดิม เป็นฐานให้แคมเปญอื่น):
--   1. ควบคุมงบ      = business_settings.promotion_policy.budget_percent
--                       (Owner ⑥: เริ่มต้น 15% ของยอดขาย · แอดมินปรับได้ · NULL = ไม่จำกัด)
--   2. kill switch    = promotion_policy.promotions_enabled (false = ปิดส่วนลดทุกโค้ดทันที)
--   3. ยอดขั้นต่ำ     = min_order_amount เดิม (114) คงเดิม — เทียบยอดรวมออเดอร์
--   4. สินค้าที่ร่วม  = applies_to ('all_products' | 'specific_products') + promotion_products
--                       (ฐานส่วนลด = ยอดของสินค้าที่อยู่ใน scope เท่านั้น)
--   5. ช่วงเวลา       = start_date/end_date เดิม (114) คงเดิม
--   6. การใช้สิทธิ์ซ้อน= คอลัมน์ stackable (1 โค้ดต่อออเดอร์ = invariant เดิมคงไว้;
--                       การ combine กับสิทธิ์อื่น (แต้ม) จะถูกบังคับจริงตอน Loyalty stage —
--                       stage นี้เก็บกติกาเป็นข้อมูลของแคมเปญ ไม่แสร้งว่าบังคับแล้ว)
--   7. เพดานจำนวนสิทธิ์= usage_limit / usage_count (นับเฉพาะออเดอร์ที่ส่วนลด > 0)
--
-- จุดตัดสินส่วนลดของ server มีที่เดียว: public.promotion_apply_rules(...)
--   ลำดับ: kill switch → min order → คำนวณบนฐานที่เข้า scope → max cap
--          → budget gate → usage cap (atomic UPDATE) → คืนค่า (ROUND 2 = คอลัมน์ numeric(10,2))
--   กติกาเดิม 114 ที่คงไว้: lookup upper(code)+active+date window · percentage/fixed
--   คิดจากฐานส่วนลด · ทั้งคู่ LEAST กับฐาน · โค้ดไม่ผ่านกฎ = discount 0 (silent-ignore
--   เหมือนเดิม — client ตรวจกฎชุดเดียวกันและปฏิเสธการส่งออเดอร์ก่อน ไม่ให้ลูกค้า
--   ถูกคิดเต็มราคาโดยไม่รู้ตัว)
-- งบ = เดือนปฏิทิน (Asia/Bangkok): spent(เดือนนี้) + ส่วนลดใหม่ <= pct% × (sales(เดือนนี้) + ยอดออเดอร์นี้)
--   ยอดขาย = SUM(total_amount) · หักเฉพาะสถานะ 'cancelled' · สร้างโดยฝั่งเซิร์ฟเวอร์เท่านั้น
--
-- ที่มาของ body create_order_with_items: คัดลอกจาก 148_same_day_no_cutoff.sql
--   (ตัวล่าสุดที่ define — 149/150/151/152 ไม่ได้แตะ) แล้วแก้เฉพาะ 4 จุดตาม G&R:
--   (a) DECLARE +ตัวแปร scope (b) ดึงโค้ดก่อนวนลูปสินค้า (c) สะสม base ตาม scope ในลูป
--   (d) แทนบล็อกส่วนลดเดิมด้วย call เดียวไปที่ promotion_apply_rules
--   ส่วนอื่น (auth/channel/branch/round/menu-gate/capacity/order-number/insert) = VERBATIM 148
-- สัญญาทดสอบ: e2e/contracts_153_promotion_campaign_controls.sql
-- Rollback: ลบคอลัมน์+ตาราง+ฟังก์ชัน แล้ว apply 148 ซ้ำ (คืน body เดิม) — ไม่มี data loss
-- ============================================================

BEGIN;

-- ---- 153a: คอลัมน์ควบคุมแคมเปญบน promotions (idempotent — replay/production ใช้ร่วมกันได้) ----
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS stackable boolean NOT NULL DEFAULT false;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'all_products';
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS max_discount_amount numeric(10, 2);
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS usage_limit integer;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotions_applies_to_check') THEN
    ALTER TABLE public.promotions ADD CONSTRAINT promotions_applies_to_check
      CHECK (applies_to IN ('all_products', 'specific_products'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotions_max_discount_check') THEN
    ALTER TABLE public.promotions ADD CONSTRAINT promotions_max_discount_check
      CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotions_usage_limit_check') THEN
    ALTER TABLE public.promotions ADD CONSTRAINT promotions_usage_limit_check
      CHECK (usage_limit IS NULL OR usage_limit > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotions_usage_count_check') THEN
    ALTER TABLE public.promotions ADD CONSTRAINT promotions_usage_count_check
      CHECK (usage_count >= 0);
  END IF;
END $$;

-- ---- 153b: scope สินค้าที่ร่วมโปรโมชั่น (เฉพาะ applies_to='specific_products') ----
CREATE TABLE IF NOT EXISTS public.promotion_products (
  promotion_id text NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id   text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON public.promotion_products (product_id);

ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;
-- mirror ของ 006 (promotions): public read + admin manage (is_admin = 146/147 matrix)
DROP POLICY IF EXISTS promotion_products_public_read ON public.promotion_products;
CREATE POLICY promotion_products_public_read ON public.promotion_products
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS promotion_products_admin_manage ON public.promotion_products;
CREATE POLICY promotion_products_admin_manage ON public.promotion_products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.promotion_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.promotion_products TO authenticated;

-- ---- 153c: นโยบายแคมเปญกลาง (kill switch + งบ 15% — Owner ⑥ ปรับได้เอง) ----
INSERT INTO public.business_settings (key, value)
VALUES ('promotion_policy', '{"promotions_enabled": true, "budget_percent": 15}'::jsonb)
ON CONFLICT (key) DO NOTHING;
-- ---- 153d: promotions_enabled — kill switch (ค่าเริ่มต้น = true เมื่อไม่มี row/ค่าผิดรูปแบบ) ----
CREATE OR REPLACE FUNCTION public.promotions_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE WHEN jsonb_typeof(bs.value -> 'promotions_enabled') = 'boolean'
                THEN (bs.value ->> 'promotions_enabled')::boolean
           END
      FROM public.business_settings bs
     WHERE bs.key = 'promotion_policy'
       AND bs.branch_id IS NULL
     LIMIT 1
  ), true);
$$;
REVOKE EXECUTE ON FUNCTION public.promotions_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promotions_enabled() TO authenticated, service_role;

-- ---- 153e: promotion_budget_state — ตัวเลขงบของเดือนปัจจุบัน (แหล่งเดียวของทุกจุดตรวจ) ----
--   งบ = pct% × sales(เดือนนี้) · spent = ส่วนลดที่ให้ไปแล้วในเดือนนี้
--   นับเฉพาะออเดอร์ที่ status <> 'cancelled' (รายการคืนเงิน/ปรับยอด = Loyalty stage ตาม ledger)
CREATE OR REPLACE FUNCTION public.promotion_budget_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT (date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok'))::timestamp AT TIME ZONE 'Asia/Bangkok' AS from_ts,
           (date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok') + interval '1 month')::timestamp AT TIME ZONE 'Asia/Bangkok' AS to_ts
  ), agg AS (
    SELECT COALESCE(SUM(o.total_amount), 0)::numeric AS sales,
           COALESCE(SUM(o.discount_amount), 0)::numeric AS spent
      FROM public.orders o, bounds b
     WHERE o.created_at >= b.from_ts
       AND o.created_at <  b.to_ts
       AND o.status <> 'cancelled'
  )
  SELECT jsonb_build_object(
    'from',    (SELECT from_ts FROM bounds),
    'to',      (SELECT to_ts   FROM bounds),
    'sales',   (SELECT sales   FROM agg),
    'spent',   (SELECT spent   FROM agg),
    -- percent: JSON null = ไม่จำกัดงบ (Owner ⑥ ให้แอดมินปรับได้) · key หาย/type ผิด = 15 (ค่าเริ่มต้น)
    --   (ไม่ใช้ promotion_setting ตรง ๆ เพราะ COALESCE(...,15) จะกลืนค่า NULL = unlimited)
    'percent', (
      SELECT CASE
        WHEN bs.value IS NULL THEN 15
        WHEN jsonb_typeof(bs.value -> 'budget_percent') = 'number'
          THEN (bs.value ->> 'budget_percent')::numeric
        WHEN jsonb_typeof(bs.value -> 'budget_percent') = 'null' THEN NULL
        ELSE 15
      END
      FROM (SELECT (SELECT b2.value FROM public.business_settings b2
                     WHERE b2.key = 'promotion_policy' AND b2.branch_id IS NULL LIMIT 1) AS value) bs
    ),
    'enabled', public.promotions_enabled()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.promotion_budget_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promotion_budget_state() TO authenticated, service_role;
-- ---- 153f: promotion_budget_ok — client revalidation ก่อนส่งออเดอร์ (anon ใช้ได้ · คืนแค่ boolean) ----
--   ไม่เปิดเผยตัวเลขยอดขายให้ผู้ไม่มีสิทธิ์ (รายละเอียดอยู่ใน promotion_budget_status ของแอดมิน)
CREATE OR REPLACE FUNCTION public.promotion_budget_ok(p_discount numeric, p_order_subtotal numeric)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(p_discount, 0) <= 0 THEN true
    ELSE (
      SELECT CASE
        WHEN NOT COALESCE((st ->> 'enabled')::boolean, true) THEN false
        WHEN st -> 'percent' IS NULL OR jsonb_typeof(st -> 'percent') = 'null' THEN true
        ELSE (COALESCE((st ->> 'spent')::numeric, 0) + p_discount)
             <= (COALESCE((st ->> 'percent')::numeric, 0) / 100)
                * (COALESCE((st ->> 'sales')::numeric, 0) + COALESCE(p_order_subtotal, 0))
      END
      FROM public.promotion_budget_state() st
    )
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.promotion_budget_ok(numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promotion_budget_ok(numeric, numeric) TO anon, authenticated, service_role;

-- ---- 153g: promotion_budget_status — ตัวเลขครบสำหรับแผงแอดมิน (gate: is_admin) ----
CREATE OR REPLACE FUNCTION public.promotion_budget_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st jsonb;
  v_pct numeric;
  v_budget numeric;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  st := public.promotion_budget_state();
  v_pct := (st ->> 'percent')::numeric;
  IF v_pct IS NULL THEN
    v_budget := NULL;
  ELSE
    v_budget := ROUND(v_pct / 100 * COALESCE((st ->> 'sales')::numeric, 0), 2);
  END IF;
  RETURN st || jsonb_build_object(
    'budget', v_budget,
    'remaining', CASE WHEN v_budget IS NULL THEN NULL
                      ELSE ROUND(v_budget - COALESCE((st ->> 'spent')::numeric, 0), 2) END
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.promotion_budget_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promotion_budget_status() TO authenticated, service_role;
-- ---- 153h: promotion_apply_rules — จุดตัดสินส่วนลดของ server (ที่เดียว) ----
--   เรียกโดย create_order_with_items (153i) · ทดสอบตรง ๆ ได้จาก contract test
--   p_eligible = ยอดของสินค้าที่อยู่ใน scope (ถ้า applies_to='all_products' จะถูกแทนด้วย p_subtotal)
--   คืนค่าส่วนลดที่จะบันทึกลง orders.discount_amount (0 = ไม่ผ่านกฎข้อใดข้อหนึ่ง —
--   คงกติกา silent-ignore ของ 114: client ตรวจชุดกฎเดียวกันและปฏิเสธการส่งก่อน)
CREATE OR REPLACE FUNCTION public.promotion_apply_rules(p_promo_id text, p_subtotal numeric, p_eligible numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo public.promotions%ROWTYPE;
  v_sub numeric := GREATEST(COALESCE(p_subtotal, 0), 0);
  v_elig numeric;
  v_disc numeric := 0;
  v_state jsonb;
  v_pct numeric;
BEGIN
  IF v_sub <= 0 THEN RETURN 0; END IF;
  IF p_promo_id IS NULL OR btrim(p_promo_id) = '' THEN RETURN 0; END IF;

  -- ตรวจซ้ำทุกเงื่อนไข (active + date window เหมือน 114) — กันโค้ดถูกพักหลัง lookup
  SELECT * INTO v_promo
    FROM public.promotions
   WHERE id = p_promo_id
     AND is_active = true
     AND (start_date IS NULL OR start_date <= CURRENT_DATE)
     AND (end_date   IS NULL OR end_date   >= CURRENT_DATE)
   LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- (1) kill switch — Owner ⑥: ปิดได้ทันที ทุกโค้ด
  IF NOT public.promotions_enabled() THEN RETURN 0; END IF;

  -- (2) ยอดขั้นต่ำ — เทียบยอดรวมออเดอร์ (กติกา 114 เดิม ไม่เปลี่ยนความหมาย)
  IF v_sub < COALESCE(v_promo.min_order_amount, 0) THEN RETURN 0; END IF;

  -- (3) ฐานส่วนลดตาม scope สินค้าที่ร่วมรายการ
  v_elig := GREATEST(COALESCE(p_eligible, 0), 0);
  IF COALESCE(v_promo.applies_to, 'all_products') <> 'specific_products' THEN
    v_elig := v_sub;
  END IF;
  v_elig := LEAST(v_elig, v_sub);
  IF v_elig <= 0 THEN RETURN 0; END IF;

  -- (4) คำนวณ — mirror ของ 114 เป๊ะ (percentage/fixed · LEAST กับฐาน)
  IF v_promo.discount_type = 'percentage' THEN
    v_disc := LEAST(v_elig * COALESCE(v_promo.discount_value, 0) / 100, v_elig);
  ELSIF v_promo.discount_type = 'fixed_amount' THEN
    v_disc := LEAST(COALESCE(v_promo.discount_value, 0), v_elig);
  END IF;

  -- (4b) เพดานส่วนลดต่อออเดอร์ของแคมเปญ (max_discount_amount)
  IF v_promo.max_discount_amount IS NOT NULL THEN
    v_disc := LEAST(v_disc, GREATEST(v_promo.max_discount_amount, 0));
  END IF;
  IF v_disc IS NULL OR v_disc <= 0 THEN RETURN 0; END IF;
  v_disc := ROUND(v_disc, 2); -- ตรงกับคอลัมน์ numeric(10,2) ที่จะบันทึก
  IF v_disc <= 0 THEN RETURN 0; END IF;

  -- (5) budget gate — Owner ⑥: งบ = 15% ของยอดขาย (แอดมินปรับ · NULL = ไม่จำกัด)
  v_state := public.promotion_budget_state();
  v_pct := (v_state ->> 'percent')::numeric;
  IF v_pct IS NOT NULL THEN
    IF NOT ((COALESCE((v_state ->> 'spent')::numeric, 0) + v_disc)
            <= (v_pct / 100) * (COALESCE((v_state ->> 'sales')::numeric, 0) + v_sub)) THEN
      RETURN 0;
    END IF;
  END IF;

  -- (6) usage cap — atomic: ใช้ครบ usage_limit แล้วคืน 0 (นับเฉพาะตอนส่วนลด > 0)
  IF v_promo.usage_limit IS NOT NULL THEN
    UPDATE public.promotions
       SET usage_count = usage_count + 1, updated_at = now()
     WHERE id = v_promo.id
       AND usage_count < usage_limit;
    IF NOT FOUND THEN RETURN 0; END IF;
  ELSE
    UPDATE public.promotions
       SET usage_count = usage_count + 1, updated_at = now()
     WHERE id = v_promo.id;
  END IF;

  RETURN v_disc;
END $$;
REVOKE EXECUTE ON FUNCTION public.promotion_apply_rules(text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promotion_apply_rules(text, numeric, numeric) TO authenticated, service_role;
-- ---- 153i: create_order_with_items — re-emit จาก 148_same_day_no_cutoff.sql (body VERBATIM) ----
--     + จุดแก้ G&R 4 จุดเท่านั้น: (a) DECLARE (b) ดึงโค้ดก่อนลูป (c) สะสมฐานตาม scope
--     (d) แทนบล็อกส่วนลดเดิมด้วย call เดียวไป promotion_apply_rules
CREATE OR REPLACE FUNCTION public.create_order_with_items(p_items jsonb, p_delivery_round_id text, p_delivery_method text DEFAULT 'self_delivery'::text, p_delivery_address text DEFAULT ''::text, p_dropoff_latitude numeric DEFAULT NULL::numeric, p_dropoff_longitude numeric DEFAULT NULL::numeric, p_customer_name text DEFAULT ''::text, p_customer_phone text DEFAULT ''::text, p_payment_method text DEFAULT 'promptpay_qr'::text, p_special_instructions text DEFAULT ''::text, p_promotion_code text DEFAULT NULL::text, p_distance_km numeric DEFAULT 0, p_order_mode text DEFAULT 'SAME_DAY'::text, p_scheduled_date date DEFAULT NULL::date, p_branch_id text DEFAULT NULL::text, p_source_channel text DEFAULT NULL::text, p_external_ref_id text DEFAULT NULL::text, p_customer_ref uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid; v_order_id text; v_order_number text; v_order_exists boolean;
  v_attempt integer := 0; v_mode text; v_item_row record; v_pid text;
  v_qty integer; v_unit_price numeric; v_addon_price numeric; v_item_sub numeric;
  v_subtotal numeric := 0; v_discount numeric := 0; v_delivery_fee numeric := 0;
  v_service_fee numeric := 0; v_tax numeric := 0; v_total numeric := 0;
  v_items_total_qty integer := 0; v_round_status text; v_max_cap integer;
  v_cur_count integer; v_round_date date; v_round_cutoff time; v_round_start time;
  v_pre_order_cutoff time;
  v_prod_is_avail boolean; v_prod_same_day boolean; v_prod_preorder boolean;
  v_prod_name text; v_delivery_method text; v_distance numeric;
  v_ing_name text;
  -- [G&R 153] scope โปรโมชั่น — แทน v_promo %ROWTYPE เดิม (lookup ย้ายขึ้นก่อนลูปสินค้า
  -- เพราะต้องรู้ scope ก่อนจะรู้ว่ายอดบรรทัดไหนเข้าฐานส่วนลด)
  v_promo_id text; v_promo_applies text; v_promo_scope text[];
  v_eligible_subtotal numeric := 0;
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_resolved_branch_id text; v_resolved_tenant_id text;
  v_dp_setting jsonb; v_radius numeric; v_radius_override numeric;
  -- channel intake (048 semantics)
  v_channel text; v_ext_ref text; v_existing record;
BEGIN
  -- ===== 1. AUTHENTICATION (048 trusted-channel semantics) =====
  -- service-role trusted intake (channel adapters): explicit customer required;
  -- auth.uid() callers unaffected (p_customer_ref must be NULL or self).
  v_uid := COALESCE(auth.uid(), p_customer_ref);
  IF v_uid IS NULL OR (auth.uid() IS NULL AND NOT COALESCE(public.has_service_role(), false)) THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF auth.uid() IS NOT NULL AND p_customer_ref IS NOT NULL AND p_customer_ref <> auth.uid() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_CUSTOMER_REF';
  END IF;

  -- ===== 2. CHANNEL INPUT VALIDATION (048) =====
  v_channel := NULLIF(trim(COALESCE(p_source_channel, '')), '');
  IF v_channel IS NOT NULL THEN
    v_channel := upper(v_channel);
    IF v_channel !~ '^[A-Z][A-Z0-9_]{2,31}$' THEN
      RAISE EXCEPTION 'ERR_INVALID_SOURCE_CHANNEL';
    END IF;
  END IF;
  v_ext_ref := NULLIF(trim(COALESCE(p_external_ref_id, '')), '');
  IF v_ext_ref IS NOT NULL AND length(v_ext_ref) > 128 THEN
    RAISE EXCEPTION 'ERR_INVALID_EXTERNAL_REF';
  END IF;
  -- ===== 2.5 DURABLE DUPLICATE GUARD — one external event = one canonical order =====
  IF v_ext_ref IS NOT NULL THEN
    SELECT order_number, id INTO v_existing
      FROM public.orders
     WHERE source_channel = v_channel
       AND external_ref_id = v_ext_ref
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'order_number', v_existing.order_number,
        'duplicate', true,
        'source_channel', v_channel,
        'external_ref_id', v_ext_ref
      );
    END IF;
  END IF;

  -- ===== 3. ORDER MODE + INPUT (089 verbatim) =====
  v_mode := COALESCE(p_order_mode, 'SAME_DAY');
  IF v_mode NOT IN ('SAME_DAY', 'PRE_ORDER') THEN RAISE EXCEPTION 'ERR_INVALID_ORDER_MODE'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'ERR_EMPTY_ORDER'; END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN RAISE EXCEPTION 'ERR_MISSING_ROUND'; END IF;
  IF p_payment_method NOT IN ('promptpay_qr', 'cash_on_delivery', 'credit_card') THEN RAISE EXCEPTION 'ERR_INVALID_PAYMENT_METHOD'; END IF;
  IF p_delivery_method NOT IN ('self_delivery', 'grab_rider', 'linemen_rider', 'foodpanda_rider') THEN RAISE EXCEPTION 'ERR_INVALID_DELIVERY_METHOD'; END IF;

  -- ===== TEN-07 BRANCH RESOLUTION (089 verbatim) =====
  IF p_branch_id IS NOT NULL AND trim(p_branch_id) <> '' THEN
    SELECT b.id, b.tenant_id INTO v_resolved_branch_id, v_resolved_tenant_id
      FROM public.branches b WHERE b.id = p_branch_id AND b.status = 'active' LIMIT 1;
    IF v_resolved_branch_id IS NULL THEN RAISE EXCEPTION 'ERR_BRANCH_NOT_FOUND: %', p_branch_id; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds r WHERE r.id = p_delivery_round_id AND r.branch_id = v_resolved_branch_id) THEN
      RAISE EXCEPTION 'ERR_ROUND_BRANCH_MISMATCH: Round % not in branch %', p_delivery_round_id, v_resolved_branch_id;
    END IF;
  ELSE
    SELECT r.branch_id, r.tenant_id INTO v_resolved_branch_id, v_resolved_tenant_id
      FROM public.delivery_rounds r WHERE r.id = p_delivery_round_id LIMIT 1;
  END IF;

  -- ===== FC-1: branch-scoped delivery policy (tenant global default + branch override ผ่าน business_settings.branch_id) =====
  SELECT value INTO v_dp_setting FROM public.business_settings
   WHERE key = 'delivery_policy'
     AND (branch_id IS NULL OR branch_id = v_resolved_branch_id)
   ORDER BY (branch_id IS NULL) ASC
   LIMIT 1;
  IF v_dp_setting IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: business_settings.delivery_policy'; END IF;
  IF v_dp_setting->>'bite_drive_radius_km' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.bite_drive_radius_km'; END IF;
  IF v_dp_setting->>'allow_external_within_radius' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.allow_external_within_radius'; END IF;
  IF v_dp_setting->'external_methods_enabled' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.external_methods_enabled'; END IF;
  v_radius := (v_dp_setting->>'bite_drive_radius_km')::numeric;
  -- ===== FC-3: branch radius canonical = branches.service_radius_km (override เมื่อ > 0) =====
  IF v_resolved_branch_id IS NOT NULL THEN
    SELECT b.service_radius_km INTO v_radius_override FROM public.branches b WHERE b.id = v_resolved_branch_id;
    IF v_radius_override IS NOT NULL AND v_radius_override > 0 THEN v_radius := v_radius_override; END IF;
  END IF;

  SELECT status, max_capacity, current_count, scheduled_date, cutoff_time, delivery_start,
         pre_order_cutoff
    INTO v_round_status, v_max_cap, v_cur_count, v_round_date, v_round_cutoff, v_round_start,
         v_pre_order_cutoff
    FROM public.delivery_rounds WHERE id = p_delivery_round_id FOR UPDATE;
  IF v_round_status IS NULL THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;
  IF v_round_status <> 'active' THEN RAISE EXCEPTION 'ERR_ROUND_CLOSED'; END IF;
  IF v_mode = 'SAME_DAY' THEN
    IF v_round_date IS NULL OR v_round_date <> v_today THEN RAISE EXCEPTION 'ERR_ROUND_DATE'; END IF;
    -- 148 (Owner 2026-10-24): SAME_DAY = ไม่มีคัทออฟใด ๆ — วิ่งปกติตั้งแต่ร้านเปิดถึงปิดร้าน
    --   (ยกเลิก 145: IF v_now > COALESCE(same_day_cutoff, cutoff_time) -> ERR_CUTOFF_PASSED)
    --   ด่านของเซมเดย์เหลือแค่: รอบเปิดอยู่ (status) + วันเดียวกัน (date) + ความจุ (capacity)
    IF p_scheduled_date IS NOT NULL AND p_scheduled_date <> v_round_date THEN RAISE EXCEPTION 'ERR_ROUND_DATE'; END IF;
  ELSE
    IF p_scheduled_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_SCHEDULED_DATE'; END IF;
    IF p_scheduled_date < v_today THEN RAISE EXCEPTION 'ERR_SCHEDULED_DATE_INVALID'; END IF;
    IF p_scheduled_date <> v_round_date THEN RAISE EXCEPTION 'ERR_ROUND_DATE_MISMATCH'; END IF;
    -- 143 (Owner Q1 + 2026-10-24): พรีออเดอร์วันนี้ได้จนถึงคัทออฟ — คัทออฟ = cutoff_hours ชม.
    --   ก่อน delivery_start (mirror ของ enforce_pre_order_window / FC-4 availability)
    --   · ยกเลิก ERR_LEAD_TIME (pre_order_lead_days เดิม) — คัทออฟคุมแทน ตั้งค่าได้จากแอดมิน
    --   · เมนู/ตะกร้า gate 142 ด้านล่างคงเดิมทุกประการ
    -- 145: แอดมินตั้ง pre_order_cutoff ของรอบได้เอง (แยกจากเซมเดย์) — ไม่มีค่า = กฎเดิม
    IF v_pre_order_cutoff IS NOT NULL THEN
      IF (now() at time zone 'Asia/Bangkok') > (p_scheduled_date + v_pre_order_cutoff) THEN
        RAISE EXCEPTION 'ERR_CUTOFF_PASSED';
      END IF;
    ELSE
      IF v_round_start IS NULL AND v_round_cutoff IS NULL THEN
        RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
      END IF;
      IF (now() at time zone 'Asia/Bangkok')
         > ((p_scheduled_date + COALESCE(v_round_start, v_round_cutoff))
            - (COALESCE(public.order_setting('cutoff_hours', 2), 2) * interval '1 hour')) THEN
        RAISE EXCEPTION 'ERR_CUTOFF_PASSED';
      END IF;
    END IF;
    -- R5c/142: PRE_ORDER ต้องมี >=1 เมนูจากปฏิทินของวันนั้น (published, ยังไม่ผ่านรอบจัดส่ง)
    --   · ตะกร้าไม่มีเมนูปฏิทินเลย = ERR_PRE_ORDER_REQUIRES_MENU (ปิดช่องยิง API เลือกวันอิสระ)
    --   · มีเมนูผูกวันแต่คนละวัน = ERR_PRODUCT_NOT_ON_MENU (§5-C เดิม — enforce_menu_gate สำทับรายสินค้า)
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_items) AS x(product_id text, quantity integer, options jsonb, special_request text)
      JOIN public.menu_schedule ms ON ms.product_id = x.product_id
       AND ms.is_published = true
       AND ms.scheduled_date = p_scheduled_date
       AND ms.scheduled_date >= v_today
    ) THEN
      IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_items) AS x(product_id text, quantity integer, options jsonb, special_request text)
        JOIN public.menu_schedule ms ON ms.product_id = x.product_id
         AND ms.is_published = true
         AND ms.scheduled_date >= v_today
      ) THEN
        RAISE EXCEPTION 'ERR_PRODUCT_NOT_ON_MENU: no cart item matches menu date %', p_scheduled_date::text;
      END IF;
      RAISE EXCEPTION 'ERR_PRE_ORDER_REQUIRES_MENU';
    END IF;
  END IF;

  IF (COALESCE(v_cur_count, 0) + 1) > v_max_cap THEN RAISE EXCEPTION 'ERR_CAPACITY_FULL'; END IF;

  -- [G&R 153 edit (b)] ดึงโค้ดโปรโมชั่นก่อนวนลูปสินค้า — กติกา lookup เดิม 114 เป๊ะ
  --   (upper(code) + is_active + date window) + โหลด scope เมื่อแคมเปญจำกัดสินค้า
  v_eligible_subtotal := 0;
  IF p_promotion_code IS NOT NULL AND trim(p_promotion_code) <> '' THEN
    SELECT id, COALESCE(applies_to, 'all_products') INTO v_promo_id, v_promo_applies
      FROM public.promotions
     WHERE upper(code) = upper(trim(p_promotion_code))
       AND is_active = true
       AND (start_date IS NULL OR start_date <= CURRENT_DATE)
       AND (end_date   IS NULL OR end_date >= CURRENT_DATE)
     LIMIT 1;
    IF v_promo_id IS NOT NULL AND v_promo_applies = 'specific_products' THEN
      SELECT array_agg(pp.product_id) INTO v_promo_scope
        FROM public.promotion_products pp
       WHERE pp.promotion_id = v_promo_id;
    END IF;
  END IF;
  FOR v_item_row IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id text, quantity integer, options jsonb, special_request text)
  LOOP
    v_pid := v_item_row.product_id; v_qty := COALESCE(v_item_row.quantity, 0);
    IF v_pid IS NULL OR trim(v_pid) = '' THEN RAISE EXCEPTION 'ERR_MISSING_PRODUCT_ID'; END IF;
    IF v_qty <= 0 OR v_qty > 1000 THEN RAISE EXCEPTION 'ERR_INVALID_QUANTITY'; END IF;
    SELECT price, is_available, available_same_day, available_preorder, name INTO v_unit_price, v_prod_is_avail, v_prod_same_day, v_prod_preorder, v_prod_name FROM public.products WHERE id = v_pid FOR UPDATE;
    IF v_unit_price IS NULL THEN RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND'; END IF;
    IF NOT COALESCE(v_prod_is_avail, false) THEN RAISE EXCEPTION 'ERR_PRODUCT_UNAVAILABLE'; END IF;
    IF v_mode = 'SAME_DAY' AND NOT COALESCE(v_prod_same_day, false) THEN RAISE EXCEPTION 'ERR_PRODUCT_MODE_NOT_ALLOWED'; END IF;
    -- R5/141 C1: ยกเลิก gate PRE_ORDER x available_preorder — สินค้าทั่วไปสั่งพรีออเดอร์/ส่งร่วมรอบเดียวกับเมนูพรีออเดอร์ได้
    v_addon_price := public.compute_addons_price(v_pid, v_item_row.options);
    v_item_sub := v_qty * (v_unit_price + COALESCE(v_addon_price, 0));
    v_subtotal := v_subtotal + v_item_sub; v_items_total_qty := v_items_total_qty + v_qty;
    -- [G&R 153 edit (c)] สะสมฐานส่วนลดเฉพาะสินค้าที่อยู่ใน scope ของแคมเปญ
    IF v_promo_applies = 'specific_products' AND v_promo_scope IS NOT NULL AND v_pid = ANY(v_promo_scope) THEN
      v_eligible_subtotal := v_eligible_subtotal + v_item_sub;
    END IF;
  END LOOP;

  IF v_items_total_qty > public.order_setting('max_items_per_order', 20) THEN RAISE EXCEPTION 'ERR_QTY_LIMIT'; END IF;

  IF v_mode = 'SAME_DAY' THEN
    SELECT i.name INTO v_ing_name FROM (SELECT r.ingredient_id, SUM(v.qty * r.quantity_per_unit) AS req FROM (SELECT j.product_id, COALESCE(j.quantity, 1) AS qty FROM jsonb_to_recordset(p_items) AS j(product_id text, quantity integer) WHERE j.product_id IS NOT NULL) v JOIN public.recipes r ON r.product_id = v.product_id GROUP BY r.ingredient_id) need JOIN public.inventory i ON i.id = need.ingredient_id WHERE i.current_stock < need.req LIMIT 1;
    IF v_ing_name IS NOT NULL THEN RAISE EXCEPTION 'ERR_INSUFFICIENT_INGREDIENT: %', v_ing_name; END IF;
  END IF;

  -- [G&R 153 edit (d)] แทนบล็อกส่วนลด 114 เดิม — ตัดสินที่ promotion_apply_rules ที่เดียว
  --   (kill switch · min order · scope · max cap · budget 15% · usage cap — ดูหัวไฟล์)
  IF v_promo_id IS NOT NULL AND COALESCE(v_promo_applies, 'all_products') <> 'specific_products' THEN
    v_eligible_subtotal := v_subtotal;
  END IF;
  IF v_promo_id IS NOT NULL THEN
    v_discount := public.promotion_apply_rules(v_promo_id, v_subtotal, v_eligible_subtotal);
  END IF;

  v_delivery_method := p_delivery_method;
  v_distance := COALESCE(p_distance_km, 0);
  v_delivery_fee := public.compute_delivery_fee(
    p_dropoff_latitude, p_dropoff_longitude,
    v_delivery_method, v_items_total_qty,
    CASE WHEN p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN v_distance ELSE NULL END,
    v_resolved_branch_id
  );
  IF p_dropoff_latitude IS NULL OR p_dropoff_longitude IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_DELIVERY_COORDS'; END IF;
  DECLARE v_kitchen_loc jsonb; v_dist numeric; BEGIN
    IF v_resolved_branch_id IS NOT NULL THEN
      SELECT jsonb_build_object('latitude', b.kitchen_latitude, 'longitude', b.kitchen_longitude) INTO v_kitchen_loc FROM public.branches b WHERE b.id = v_resolved_branch_id LIMIT 1;
      IF v_kitchen_loc IS NULL OR v_kitchen_loc->>'latitude' IS NULL THEN v_kitchen_loc := public.kitchen_location(); END IF;
    ELSE v_kitchen_loc := public.kitchen_location(); END IF;
    v_dist := public.haversine_km((v_kitchen_loc->>'latitude')::numeric, (v_kitchen_loc->>'longitude')::numeric, p_dropoff_latitude, p_dropoff_longitude);
    IF v_delivery_method = 'self_delivery' AND NOT COALESCE((v_dp_setting->>'bite_drive_enabled')::boolean, true) THEN
      RAISE EXCEPTION 'ERR_BITE_DRIVE_DISABLED';
    END IF;
    IF v_dist > v_radius AND v_delivery_method = 'self_delivery' THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;

    IF v_dist <= v_radius AND v_delivery_method <> 'self_delivery' AND NOT (v_dp_setting->>'allow_external_within_radius')::boolean THEN RAISE EXCEPTION 'ERR_DELIVERY_METHOD_ZONE'; END IF;

    IF v_delivery_method <> 'self_delivery' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_dp_setting->'external_methods_enabled') em WHERE em = v_delivery_method) THEN RAISE EXCEPTION 'ERR_EXTERNAL_METHOD_DISABLED: %', v_delivery_method; END IF;
  END;

  v_service_fee := 0; v_tax := 0;
  v_total := GREATEST(0, v_subtotal - v_discount + v_delivery_fee + v_service_fee + v_tax);

  LOOP
    v_attempt := v_attempt + 1;
    IF v_mode = 'PRE_ORDER' THEN
      v_order_number := 'PO-' || to_char(v_round_date, 'YYYYMMDD') || '-' || lpad((floor(random() * 900) + 100)::text, 3, '0');
    ELSE
      v_order_number := 'BMB-' || to_char(v_round_date, 'YYYYMMDD') || '-' || lpad((floor(random() * 900) + 100)::text, 3, '0');
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_order_number) INTO v_order_exists;
    EXIT WHEN NOT v_order_exists OR v_attempt >= 5;
  END LOOP;
  IF v_order_exists THEN RAISE EXCEPTION 'ERR_ORDER_NUMBER_EXHAUSTED'; END IF;
  v_order_id := 'ord-' || to_char(extract(epoch from clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, customer_ref, delivery_round_id, status, delivery_method, dropoff_detail, dropoff_latitude, dropoff_longitude, subtotal, delivery_fee, service_fee, discount_amount, tax_amount, total_amount, payment_status, payment_method, special_instructions, order_mode, scheduled_date, branch_id)
  VALUES (v_order_id, v_order_number, v_uid::text, p_customer_name, p_customer_phone, v_uid, p_delivery_round_id, 'pending', v_delivery_method::delivery_method, COALESCE(p_delivery_address, ''), p_dropoff_latitude, p_dropoff_longitude, v_subtotal, v_delivery_fee, v_service_fee, v_discount, v_tax, v_total, 'pending', p_payment_method::payment_method, COALESCE(p_special_instructions, ''), v_mode::order_mode, v_round_date, v_resolved_branch_id);

  DECLARE v_item_qty integer; v_item_pid text; v_item_options jsonb; v_item_special text; v_i integer := 0; BEGIN
    FOR v_item_row IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id text, quantity integer, options jsonb, special_request text)
    LOOP
      v_i := v_i + 1; v_item_qty := COALESCE(v_item_row.quantity, 1); v_item_pid := v_item_row.product_id;
      v_item_options := COALESCE(v_item_row.options, '{}'); v_item_special := COALESCE(v_item_row.special_request, '');
      SELECT price, name INTO v_unit_price, v_prod_name FROM public.products WHERE id = v_item_pid FOR UPDATE;
      v_item_options := jsonb_set(v_item_options, '{addOnTotal}', to_jsonb(public.compute_addons_price(v_item_pid, v_item_options)));
      INSERT INTO public.order_items (id, order_id, product_id, product_name, quantity, unit_price, customizations, special_request) VALUES ('oi-' || v_order_id || '-' || v_i, v_order_id, v_item_pid, v_prod_name, v_item_qty, v_unit_price, v_item_options, v_item_special);
    END LOOP;
  END;
  -- ===== 4. CHANNEL TAG (048/045 semantics — never overwrite trigger stamp on legacy calls) =====
  IF v_channel IS NOT NULL OR v_ext_ref IS NOT NULL THEN
    BEGIN
      UPDATE public.orders
         SET source_channel = v_channel,
             external_ref_id = v_ext_ref
       WHERE order_number = v_order_number;
    EXCEPTION
      WHEN unique_violation THEN
        -- concurrent duplicate external event: recover the existing canonical order
        SELECT order_number, id INTO v_existing
          FROM public.orders
         WHERE source_channel = v_channel
           AND external_ref_id = v_ext_ref
         LIMIT 1;
        -- the duplicate row created by this call must not remain (one event = one order)
        DELETE FROM public.orders
         WHERE order_number = v_order_number
           AND customer_ref = v_uid
           AND (v_ext_ref IS NULL OR external_ref_id = v_ext_ref);
        RETURN jsonb_build_object(
          'id', v_existing.id,
          'order_number', v_existing.order_number,
          'duplicate', true,
          'source_channel', v_channel,
          'external_ref_id', v_ext_ref
        );
    END;
  END IF;

  PERFORM public.append_audit_log(p_action := 'order_created', p_entity_type := 'order', p_entity_id := v_order_number,
    p_description := 'canonical order created (' || v_mode || ')' || CASE WHEN v_resolved_branch_id IS NOT NULL THEN ' [branch: ' || v_resolved_branch_id || ']'
      || CASE WHEN v_channel IS NOT NULL THEN ' [channel: ' || v_channel || ']' ELSE '' END ELSE '' END,
    p_metadata := jsonb_build_object('order_mode', v_mode, 'scheduled_date', v_round_date, 'total', v_total, 'branch_id', v_resolved_branch_id,
      'source_channel', v_channel, 'external_ref_id', v_ext_ref));

  RETURN jsonb_build_object(
    'id', v_order_id, 'order_number', v_order_number, 'status', 'pending', 'order_mode', v_mode,
    'scheduled_date', v_round_date, 'subtotal', v_subtotal, 'discount_amount', v_discount,
    'delivery_fee', v_delivery_fee, 'service_fee', v_service_fee, 'tax_amount', v_tax,
    'total_amount', v_total, 'payment_status', 'pending', 'payment_method', p_payment_method,
    'delivery_round_id', p_delivery_round_id, 'customer_ref', v_uid::text, 'branch_id', v_resolved_branch_id,
    'source_channel', v_channel, 'external_ref_id', v_ext_ref, 'duplicate', false
  );
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.create_order_with_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;

COMMIT;