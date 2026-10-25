-- ============================================================
-- Migration 155 — Growth & Rewards STAGE 3 (Loyalty Tiers + Points Ledger)
-- (กติกาทั้งหมด = handoff §9.2 ข้อ 1 · inventory §5.2 · requirements §4.1/§4.2)
--
-- INSPECT-FIRST RESULT (ตรวจระบบบันทึกยอดสุทธิเดิมจริงก่อน — §5.2 บังคับ):
--   * `customers.loyalty_points` (001:130) = คอลัมน์ตัวเลขเปล่า — ไม่มีโค้ดเซิร์ฟเวอร์
--     เขียน/อ่านที่ไหนเลย (probe: INSERT/UPDATE loyalty_points ใน migrations = 0 จุด)
--   * `loyalty_points` table (001:261) + RLS (006) = มีตารางแต่ไม่มี RPC/trigger ไหนแตะ
--     → ระบบแต้มฝั่งเซิร์ฟเวอร์ "ไม่มีอยู่จริง" (มีเฉพาะ rewardsStore ฝั่งเครื่องลูกค้า)
--   * `aiMemory.total_spent` = ความจำ AI ฝั่ง client (ไม่ใช่แหล่งข้อมูลจริง)
--   * `daily_sales.net_sales` (130/147) = ยอดรวมต่อวันทำการ ไม่ใช่ต่อลูกค้า
--   ⇒ ยังไม่มีระบบสะสม "ยอดสุทธิของลูกค้า" ที่เชื่อถือได้ → stage นี้สร้างแบบ
--     ledger-based + server-authoritative (ไม่แตะ signature create_order_with_items)
--
-- สิ่งที่ stage นี้ปิด:
--   1. `points_ledger` = append-only (ห้าม UPDATE — trigger guard · revoke ทุกบทบาท):
--      purchase/reversal/adjustment · idempotent ต่อออเดอร์ (PK deterministic +
--      unique partial index) · audit ทุกแถวผ่าน `append_audit_log` (แบบแผน 018/124)
--   2. คืนเงิน/ยกเลิก → ปรับกลับ "ตามต้นทาง ไม่หักซ้ำ" (§4.2): delta-model —
--      คำนวณยอดที่ต้อง reverse ณ ตอนนี้ − ที่บันทึกแล้ว > 0 จึง insert แถวใหม่
--      (partial refund หักตามสัดส่วน `payment_intents.metadata.refunded_total_minor`)
--   3. 4 ระดับ Member / Silver(≥฿1,500) / Gold(≥฿4,000) / Platinum(≥฿8,000)
--      rolling 12 เดือน · เกณฑ์ = ยอดสุทธิ = subtotal − ส่วนลด − คืนเงิน
--      "ไม่รวมค่าส่ง" (ไม่รวม delivery_fee/service_fee) · ไม่นับออเดอร์ยกเลิก/คืนเงินเต็ม
--   4. อัตราแต้ม `points_per_baht` = **ค่าเริ่มต้น 0 + points_enabled=false**
--      (requirements: "ยังไม่กำหนดอัตราแต้มจนกว่าจะมี unit economics" — ห้ามเดา
--      → แอดมิน/Owner เปิดเองใน AI Marketing Center แท็บ Rules เมื่อพร้อม · ไม่มี backfill)
--
-- จุดเรียก: trigger บน `orders` (status/payment/money เปลี่ยน) + `payment_intents`
--   (metadata.refunded_total_minor เปลี่ยน — ครอบเส้นทาง stripe-refund/omise-refund EF)
--   → ทุกเส้นทางเข้า `loyalty_sync_order` ที่เดียว (idempotent ทุกการเรียกซ้ำ)
-- สัญญาทดสอบ: e2e/contracts_155_loyalty_tiers.sql (CI step แล้ว)
-- Rollback: ลบ triggers + functions + 1 ตาราง + policy row — ไม่แตะข้อมูลออเดอร์/การเงิน
-- ============================================================

BEGIN;

-- ---- 155a: points_ledger — append-only (ห้ามแก้ไขย้อนหลัง §4.2/§2 ข้อ 8) ----
--   customer_id = customers.id (text convention 131: id=uid หรือ cust-xxx ของ guest)
--   customer_ref = auth.uid() สำหรับค้นหาของลูกค้าเอง (identity = uid เหมือน 154)
--   points มีเครื่องหมาย: purchase > 0 · reversal < 0 · adjustment ได้ทั้งสองฝั่ง
--   DELETE: app ทุกบทบาทถูก revoke อยู่แล้ว — เหลือเฉพาะ cascade ตอนลบบัญชีลูกค้า
--   (การลบลูกค้าเป็นการกระทำของแอดมินที่มี audit ของมันเอง — คงไว้ให้ลบได้)
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id            text PRIMARY KEY,
  customer_id   text NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_ref  uuid,
  points        integer NOT NULL CHECK (points <> 0),
  entry_type    text NOT NULL CHECK (entry_type IN ('purchase','reversal','adjustment')),
  order_id      text REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number  text,
  basis_amount  numeric(10,2) NOT NULL DEFAULT 0,
  rate_used     numeric(10,4) NOT NULL DEFAULT 0,
  reason        text NOT NULL DEFAULT '',
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT points_ledger_sign CHECK (
    (entry_type = 'purchase'  AND points > 0) OR
    (entry_type = 'reversal'  AND points < 0) OR
    (entry_type = 'adjustment')
  )
);

-- idempotency: 1 ออเดอร์ = 1 แถว purchase (trigger insert ด้วย id deterministic + ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_points_ledger_order_purchase
  ON public.points_ledger (order_id)
  WHERE entry_type = 'purchase' AND order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_points_ledger_customer
  ON public.points_ledger (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_ledger_order
  ON public.points_ledger (order_id, entry_type);

ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.points_ledger FROM anon, authenticated;

-- append-only guard: ห้าม UPDATE เด็ดขาด (audit trail ไม่ย้อนเปลี่ยน §4.2)
CREATE OR REPLACE FUNCTION public.points_ledger_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ERR_LEDGER_APPEND_ONLY';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.points_ledger_guard() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_points_ledger_append_only ON public.points_ledger;
CREATE TRIGGER trg_points_ledger_append_only
  BEFORE UPDATE ON public.points_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.points_ledger_guard();

-- ---- 155b: นโยบาย Loyalty (Owner §5.2 กำหนดเกณฑ์เอง · อัตราแต้ม = ยังไม่กำหนด) ----
INSERT INTO public.business_settings (key, value)
VALUES ('loyalty_policy', '{
  "tiers_enabled": true,
  "window_months": 12,
  "tier_silver_min": 1500,
  "tier_gold_min": 4000,
  "tier_platinum_min": 8000,
  "points_enabled": false,
  "points_per_baht": 0,
  "earn_qualify_status": "delivered"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---- 155c: loyalty_policy_state — แหล่งเดียวของทุกจุดตรวจ (tolerant แบบ 154f) ----
--   key หาย/ชนิดผิด = ค่าเริ่มต้น · threshold ไม่เรียงตรง (gold ≤ silver) = ใช้ชุดเริ่มต้น
--   (ไม่แสร้งว่ามีค่าที่ใช้การไม่ได้) · earn_qualify_status ผ่าน allow-list เหมือน 154
CREATE OR REPLACE FUNCTION public.loyalty_policy_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH raw AS (
    SELECT
      CASE WHEN jsonb_typeof(v -> 'tiers_enabled') = 'boolean'
           THEN (v ->> 'tiers_enabled')::boolean ELSE true END AS tiers_enabled,
      CASE WHEN jsonb_typeof(v -> 'window_months') = 'number'
             AND (v ->> 'window_months')::numeric BETWEEN 1 AND 36
           THEN (v ->> 'window_months')::numeric ELSE 12 END AS window_months,
      CASE WHEN jsonb_typeof(v -> 'tier_silver_min') = 'number'
             AND (v ->> 'tier_silver_min')::numeric >= 0
           THEN (v ->> 'tier_silver_min')::numeric ELSE 1500 END AS silver_min,
      CASE WHEN jsonb_typeof(v -> 'tier_gold_min') = 'number'
             AND (v ->> 'tier_gold_min')::numeric >= 0
           THEN (v ->> 'tier_gold_min')::numeric ELSE 4000 END AS gold_min,
      CASE WHEN jsonb_typeof(v -> 'tier_platinum_min') = 'number'
             AND (v ->> 'tier_platinum_min')::numeric >= 0
           THEN (v ->> 'tier_platinum_min')::numeric ELSE 8000 END AS platinum_min,
      CASE WHEN jsonb_typeof(v -> 'points_enabled') = 'boolean'
           THEN (v ->> 'points_enabled')::boolean ELSE false END AS points_enabled,
      CASE WHEN jsonb_typeof(v -> 'points_per_baht') = 'number'
             AND (v ->> 'points_per_baht')::numeric >= 0
           THEN (v ->> 'points_per_baht')::numeric ELSE 0 END AS points_per_baht,
      CASE WHEN jsonb_typeof(v -> 'earn_qualify_status') = 'string'
             AND (v ->> 'earn_qualify_status') IN ('confirmed','preparing','ready_for_dispatch',
                                                   'dispatched','in_transit','arrived','delivered')
           THEN v ->> 'earn_qualify_status' ELSE 'delivered' END AS earn_qualify_status
    FROM (
      SELECT (SELECT b2.value FROM public.business_settings b2
               WHERE b2.key = 'loyalty_policy' AND b2.branch_id IS NULL LIMIT 1) AS v
    ) src
  ),
  cand AS (
    SELECT jsonb_build_object(
             'tiers_enabled', tiers_enabled,
             'window_months', window_months,
             'tier_silver_min', silver_min,
             'tier_gold_min', gold_min,
             'tier_platinum_min', platinum_min,
             'points_enabled', points_enabled,
             'points_per_baht', points_per_baht,
             'earn_qualify_status', earn_qualify_status
           ) AS j,
           silver_min AS s, gold_min AS g, platinum_min AS p
    FROM raw
  )
  SELECT CASE
    WHEN s > 0 AND s < g AND g < p THEN j
    ELSE jsonb_build_object(
           'tiers_enabled', true, 'window_months', 12,
           'tier_silver_min', 1500, 'tier_gold_min', 4000, 'tier_platinum_min', 8000,
           'points_enabled', false, 'points_per_baht', 0,
           'earn_qualify_status', 'delivered')
  END
  FROM cand;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_policy_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.loyalty_policy_state() TO authenticated, service_role;

-- ---- 155d: loyalty_tier_of — ระดับจากยอดสุทธิ (mirror ที่ client เทียบได้) ----
CREATE OR REPLACE FUNCTION public.loyalty_tier_of(p_net numeric)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT (j ->> 'tiers_enabled')::boolean THEN 'member'
    WHEN COALESCE(p_net, 0) <= 0 THEN 'member'
    WHEN p_net >= (j ->> 'tier_platinum_min')::numeric THEN 'platinum'
    WHEN p_net >= (j ->> 'tier_gold_min')::numeric THEN 'gold'
    WHEN p_net >= (j ->> 'tier_silver_min')::numeric THEN 'silver'
    ELSE 'member'
  END
  FROM (SELECT public.loyalty_policy_state() AS j) x;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_tier_of(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_tier_of(numeric) TO authenticated, service_role;

-- ---- 155e: loyalty_order_net — มูลค่าสุทธิของออเดอร์เดียว (ไม่รวมค่าส่ง) ----
--   = subtotal − ส่วนลด − คืนเงินแล้ว (payment_intents.metadata.refunded_total_minor)
--   ยกเลิก/failed หรือคืนเงินเต็ม = 0 · ออเดอร์ที่ยังไม่ถูกหัก = ค่าเต็ม
--   (ไม่นับ delivery_fee/service_fee — เกณฑ์ §5.2 "ไม่รวมค่าส่ง")
CREATE OR REPLACE FUNCTION public.loyalty_order_net(p_order_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN o.status::text IN ('cancelled','failed') THEN 0::numeric
    WHEN o.payment_status::text = 'refund' THEN 0::numeric
    ELSE GREATEST(0::numeric, o.subtotal - o.discount_amount)
         - LEAST(
             GREATEST(0::numeric, o.subtotal - o.discount_amount),
             COALESCE((
               SELECT SUM(COALESCE((pi.metadata ->> 'refunded_total_minor')::numeric, 0))
               FROM public.payment_intents pi
               WHERE pi.order_number = o.order_number
             ), 0) / 100
           )
  END
  FROM public.orders o
  WHERE o.id = p_order_id;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_order_net(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_order_net(text) TO authenticated, service_role;

-- ---- 155f: loyalty_net_sales — ยอดสุทธิ rolling ของลูกค้าคนเดียว (identity = auth uid) ----
CREATE OR REPLACE FUNCTION public.loyalty_net_sales(p_uid uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(public.loyalty_order_net(o.id)), 0)::numeric
  FROM public.orders o
  WHERE p_uid IS NOT NULL
    AND (o.customer_ref = p_uid OR o.customer_id = p_uid::text)
    AND o.created_at >= now() - make_interval(
          months => (public.loyalty_policy_state() ->> 'window_months')::integer);
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_net_sales(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_net_sales(uuid) TO authenticated, service_role;

-- ---- 155g: loyalty_sync_order — จุดเดียวของการออก/ปรับแต้ม (idempotent ทุกการเรียกซ้ำ) ----
--   เรียกจาก trigger บน orders + payment_intents · 1) คืนเงิน/ยกเลิก → delta reversal
--   (บันทึกแล้วเท่าไร ขาดเท่านั้น = "ไม่หักซ้ำ" §4.2) · 2) ผ่าน qualify → ออกแต้มครั้งเดียว
--   (PK deterministic + unique partial index กันซ้ำสองชั้น) · audit_logs ทุกครั้ง
CREATE OR REPLACE FUNCTION public.loyalty_sync_order(p_order_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  pol jsonb;
  v_cust text;
  v_goods numeric := 0;
  v_refunded numeric := 0;
  v_purchase integer := 0;
  v_recorded integer := 0;
  v_target integer := 0;
  v_delta integer := 0;
  v_rate numeric;
  v_pts integer;
  v_id text;
  v_n integer := 0;
  v_ins integer := 0;
  v_reason text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- identity: auth uid เป็นหลัก (ลูกค้าทุกคนมี customer_ref) · guest = cust-xxx (มีอยู่จริง)
  v_cust := COALESCE(o.customer_ref::text, o.customer_id);
  IF v_cust IS NULL THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = v_cust) THEN
    IF o.customer_ref IS NULL THEN RETURN 0; END IF; -- ไม่มีแถว = ไม่เดา ไม่สร้างของปลอม
    INSERT INTO public.customers (id, user_id, full_name, phone)
    VALUES (o.customer_ref::text, o.customer_ref,
            COALESCE(NULLIF(btrim(o.customer_name), ''), 'Customer'),
            NULLIF(btrim(o.customer_phone), ''))
    ON CONFLICT (id) DO NOTHING;
  END IF;

  pol := public.loyalty_policy_state();
  v_goods := GREATEST(0::numeric, o.subtotal - o.discount_amount);
  SELECT COALESCE(SUM(COALESCE((pi.metadata ->> 'refunded_total_minor')::numeric, 0)), 0) / 100
    INTO v_refunded
    FROM public.payment_intents pi
   WHERE pi.order_number = o.order_number;

  -- ===== 1) reversal: ยอดที่ต้องปรับกลับตอนนี้ − ที่บันทึกไปแล้ว =====
  SELECT COALESCE(l.points, 0) INTO v_purchase
    FROM public.points_ledger l
   WHERE l.order_id = o.id AND l.entry_type = 'purchase';
  SELECT COALESCE(-SUM(l.points), 0) INTO v_recorded
    FROM public.points_ledger l
   WHERE l.order_id = o.id AND l.entry_type = 'reversal';

  IF v_purchase > 0 THEN
    IF o.status::text IN ('cancelled','failed') THEN
      v_target := v_purchase; v_reason := 'order_' || o.status::text;
    ELSIF o.payment_status::text = 'refund' THEN
      v_target := v_purchase; v_reason := 'payment_refund';
    ELSIF o.payment_status::text = 'partially_refunded' AND v_goods > 0 THEN
      v_target := LEAST(v_purchase,
                        FLOOR(v_purchase * LEAST(v_refunded, v_goods) / v_goods)::integer);
      v_reason := 'payment_partial_refund';
    END IF;
    v_delta := v_target - v_recorded;
    IF v_delta > 0 AND v_reason IS NOT NULL THEN
      v_id := 'plt-' || substr(md5(o.id || ':rev:' || v_recorded::text), 1, 12);
      INSERT INTO public.points_ledger
        (id, customer_id, customer_ref, points, entry_type, order_id, order_number,
         basis_amount, rate_used, reason)
      VALUES
        (v_id, v_cust, o.customer_ref, -v_delta, 'reversal', o.id, o.order_number,
         v_goods, COALESCE((pol ->> 'points_per_baht')::numeric, 0),
         'ปรับกลับ ' || v_reason || ' (ออเดอร์ ' || o.order_number || ')')
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN
        PERFORM public.append_audit_log(
          'loyalty_points_reverse', 'customer', v_cust,
          'reverse ' || (-v_delta)::text || ' pts (' || v_reason || ') order ' || o.order_number,
          jsonb_build_object('order_number', o.order_number, 'points', -v_delta,
                             'reason', v_reason, 'entry_type', 'reversal'));
      END IF;
    END IF;
  END IF;

  -- ===== 2) earn: ผ่าน qualify (mirror 154: ห้ามให้เมื่อออเดอร์โดนคืนเงิน) =====
  IF (pol ->> 'points_enabled')::boolean
     AND COALESCE((pol ->> 'points_per_baht')::numeric, 0) > 0
     AND o.status::text = (pol ->> 'earn_qualify_status')::text
     AND o.payment_status::text NOT IN ('refund','partially_refunded') THEN
    v_rate := (pol ->> 'points_per_baht')::numeric;
    v_pts := FLOOR(v_goods * v_rate)::integer;
    IF v_pts > 0 THEN
      v_id := 'plt-' || substr(md5(o.id || ':earn'), 1, 12);
      INSERT INTO public.points_ledger
        (id, customer_id, customer_ref, points, entry_type, order_id, order_number,
         basis_amount, rate_used, reason)
      VALUES
        (v_id, v_cust, o.customer_ref, v_pts, 'purchase', o.id, o.order_number,
         v_goods, v_rate, 'แต้มจากการสั่งซื้อออเดอร์ ' || o.order_number)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_ins = ROW_COUNT;
      IF v_ins > 0 THEN
        PERFORM public.append_audit_log(
          'loyalty_points_earn', 'customer', v_cust,
          'earn ' || v_pts || ' pts order ' || o.order_number,
          jsonb_build_object('order_number', o.order_number, 'points', v_pts,
                             'basis', v_goods, 'rate', v_rate, 'entry_type', 'purchase'));
        INSERT INTO public.notifications (id, customer_id, title, message, notification_type)
        VALUES ('ntf-' || v_id, v_cust, '⭐ ได้รับแต้มสะสม',
                '+' || v_pts || ' แต้ม จากออเดอร์ ' || o.order_number
                || ' — ดูแต้มและระดับสมาชิกได้ที่หน้า "รางวัลและแต้ม"',
                'loyalty_points_earned')
        ON CONFLICT (id) DO NOTHING;
        v_n := v_n + 1;
      END IF;
    END IF;
  END IF;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_sync_order(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_sync_order(text) TO service_role;

-- ---- 155h: trigger ทุกเส้นทางเปลี่ยน → loyalty_sync_order (ครอบแบบ 154l) ----
CREATE OR REPLACE FUNCTION public.loyalty_order_hook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.loyalty_sync_order(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_order_hook() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_loyalty_order_sync ON public.orders;
CREATE TRIGGER trg_loyalty_order_sync
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
        OR OLD.payment_status IS DISTINCT FROM NEW.payment_status
        OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
        OR OLD.discount_amount IS DISTINCT FROM NEW.discount_amount)
  EXECUTE FUNCTION public.loyalty_order_hook();

-- เส้นทางคืนเงินของ EF (stripe-refund/omise-refund เขียน metadata ก่อนแล้วค่อยแตะ orders)
CREATE OR REPLACE FUNCTION public.loyalty_payment_intent_hook()
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
    PERFORM public.loyalty_sync_order(v_order_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_payment_intent_hook() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_loyalty_intent_sync ON public.payment_intents;
CREATE TRIGGER trg_loyalty_intent_sync
  AFTER UPDATE ON public.payment_intents
  FOR EACH ROW
  WHEN (OLD.metadata IS DISTINCT FROM NEW.metadata)
  EXECUTE FUNCTION public.loyalty_payment_intent_hook();

-- ---- 155i: loyalty_my_status — ระดับสมาชิก + ยอดสุทธิ + แต้มของตัวเอง (authenticated) ----
CREATE OR REPLACE FUNCTION public.loyalty_my_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  pol jsonb;
  v_net numeric := 0;
  v_tier text := 'member';
  v_bal integer := 0;
  v_next text := NULL;
  v_next_min numeric := NULL;
  v_progress numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  pol := public.loyalty_policy_state();
  v_net := public.loyalty_net_sales(v_uid);
  v_tier := public.loyalty_tier_of(v_net);
  SELECT COALESCE(SUM(l.points), 0)::integer INTO v_bal
    FROM public.points_ledger l
   WHERE l.customer_ref = v_uid OR l.customer_id = v_uid::text;

  IF v_tier = 'member' THEN
    v_next := 'silver'; v_next_min := (pol ->> 'tier_silver_min')::numeric;
  ELSIF v_tier = 'silver' THEN
    v_next := 'gold'; v_next_min := (pol ->> 'tier_gold_min')::numeric;
  ELSIF v_tier = 'gold' THEN
    v_next := 'platinum'; v_next_min := (pol ->> 'tier_platinum_min')::numeric;
  END IF; -- platinum = ไม่มีระดับถัดไป

  IF v_tier = 'platinum' THEN
    v_progress := 1;
  ELSIF v_next_min IS NULL OR v_next_min <= 0 THEN
    v_progress := 0;
  ELSE
    v_progress := LEAST(1, GREATEST(0, v_net / v_next_min));
  END IF;

  RETURN jsonb_build_object(
    'tier', v_tier,
    'tier_label', CASE v_tier WHEN 'silver' THEN 'Silver'
                              WHEN 'gold' THEN 'Gold'
                              WHEN 'platinum' THEN 'Platinum'
                              ELSE 'Member' END,
    'tiers_enabled', (pol ->> 'tiers_enabled')::boolean,
    'window_months', (pol ->> 'window_months')::numeric,
    'net_sales', v_net,
    'thresholds', jsonb_build_object(
      'silver', (pol ->> 'tier_silver_min')::numeric,
      'gold', (pol ->> 'tier_gold_min')::numeric,
      'platinum', (pol ->> 'tier_platinum_min')::numeric),
    'next_tier', v_next,
    'next_threshold', v_next_min,
    'remaining', CASE WHEN v_next_min IS NULL THEN 0
                      ELSE GREATEST(0, v_next_min - v_net) END,
    'progress', round(v_progress, 4),
    'points_balance', v_bal,
    'points_enabled', (pol ->> 'points_enabled')::boolean,
    'points_per_baht', (pol ->> 'points_per_baht')::numeric,
    'earn_qualify_status', pol ->> 'earn_qualify_status',
    'as_of', now()
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_my_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_my_status() TO authenticated;

-- ---- 155j: loyalty_my_history — ประวัติแต้มของตัวเองจาก ledger (append-only อ่านได้) ----
CREATE OR REPLACE FUNCTION public.loyalty_my_history(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lim integer;
  v_rows jsonb;
  v_bal integer := 0;
  pol jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  v_lim := LEAST(100, GREATEST(1, COALESCE(p_limit, 50)));
  pol := public.loyalty_policy_state();
  SELECT COALESCE(SUM(l.points), 0)::integer INTO v_bal
    FROM public.points_ledger l
   WHERE l.customer_ref = v_uid OR l.customer_id = v_uid::text;
  SELECT COALESCE(jsonb_agg(x ORDER BY x ->> 'created_at' DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
               'id', l.id,
               'points', l.points,
               'entry_type', l.entry_type,
               'order_number', l.order_number,
               'basis_amount', l.basis_amount,
               'rate_used', l.rate_used,
               'reason', l.reason,
               'created_at', l.created_at
             ) AS x
      FROM public.points_ledger l
      WHERE l.customer_ref = v_uid OR l.customer_id = v_uid::text
      ORDER BY l.created_at DESC
      LIMIT v_lim
    ) s;
  RETURN jsonb_build_object(
    'entries', v_rows,
    'balance', v_bal,
    'points_enabled', (pol ->> 'points_enabled')::boolean,
    'window_months', (pol ->> 'window_months')::numeric
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_my_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_my_history(integer) TO authenticated;

-- ---- 155k: loyalty_admin_stats — สถิติระดับ/แต้มสำหรับแอดมิน (gate is_admin แบบ 154) ----
CREATE OR REPLACE FUNCTION public.loyalty_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pol jsonb;
  v_window integer;
  v_tiers jsonb;
  v_points jsonb;
  v_recent jsonb;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  pol := public.loyalty_policy_state();
  v_window := (pol ->> 'window_months')::integer;

  WITH nets AS (
    SELECT COALESCE(o.customer_ref::text, o.customer_id) AS cid,
           COALESCE(SUM(public.loyalty_order_net(o.id)), 0) AS net
    FROM public.orders o
    WHERE o.created_at >= now() - make_interval(months => v_window)
    GROUP BY 1
  ),
  per_cust AS (
    SELECT public.loyalty_tier_of(COALESCE(n.net, 0)) AS tier
    FROM public.customers c
    LEFT JOIN nets n ON n.cid = c.id
  )
  SELECT jsonb_build_object(
           'member',   count(*) FILTER (WHERE tier = 'member'),
           'silver',   count(*) FILTER (WHERE tier = 'silver'),
           'gold',     count(*) FILTER (WHERE tier = 'gold'),
           'platinum', count(*) FILTER (WHERE tier = 'platinum')
         )
    INTO v_tiers
    FROM per_cust;

  SELECT jsonb_build_object(
           'earned',   COALESCE(SUM(l.points) FILTER (WHERE l.entry_type = 'purchase'), 0),
           'reversed', COALESCE(SUM(-l.points) FILTER (WHERE l.entry_type = 'reversal'), 0),
           'adjusted', COALESCE(SUM(l.points) FILTER (WHERE l.entry_type = 'adjustment'), 0),
           'balance',  COALESCE(SUM(l.points), 0),
           'entries',  count(*)
         )
    INTO v_points
    FROM public.points_ledger l;

  SELECT COALESCE(jsonb_agg(x ORDER BY x ->> 'created_at' DESC), '[]'::jsonb) INTO v_recent
    FROM (
      SELECT jsonb_build_object(
               'customer_id', l.customer_id,
               'customer_name', COALESCE(c.full_name, ''),
               'points', l.points,
               'entry_type', l.entry_type,
               'order_number', l.order_number,
               'reason', l.reason,
               'created_at', l.created_at
             ) AS x
      FROM public.points_ledger l
      LEFT JOIN public.customers c ON c.id = l.customer_id
      ORDER BY l.created_at DESC
      LIMIT 50
    ) s;

  RETURN jsonb_build_object(
    'policy', pol,
    'window_months', v_window,
    'tiers', v_tiers,
    'points', v_points,
    'recent', v_recent
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_admin_stats() TO authenticated, service_role;

-- ---- 155l: loyalty_admin_adjust — ปรับแต้มกรณีพิเศษ (แอดมินเท่านั้น · audit ทุกครั้ง) ----
CREATE OR REPLACE FUNCTION public.loyalty_admin_adjust(
  p_customer_id text, p_points integer, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_bal integer;
  v_id text;
  v_reason text;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_points IS NULL OR p_points = 0 THEN RAISE EXCEPTION 'ERR_INVALID_POINTS'; END IF;
  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_REASON'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = btrim(p_customer_id)) THEN
    RAISE EXCEPTION 'ERR_CUSTOMER_NOT_FOUND';
  END IF;

  v_id := 'plt-' || substr(md5(btrim(p_customer_id) || ':' || p_points::text
                               || ':' || clock_timestamp()::text), 1, 12);
  INSERT INTO public.points_ledger
    (id, customer_id, customer_ref, points, entry_type, order_id, order_number,
     basis_amount, rate_used, reason, created_by)
  VALUES
    (v_id, btrim(p_customer_id),
     (SELECT user_id FROM public.customers c WHERE c.id = btrim(p_customer_id)),
     p_points, 'adjustment', NULL, NULL, 0, 0,
     '(แอดมิน) ' || v_reason, v_uid)
  ON CONFLICT DO NOTHING;

  PERFORM public.append_audit_log(
    'loyalty_adjust', 'customer', btrim(p_customer_id),
    'adjust ' || p_points || ' pts — ' || v_reason,
    jsonb_build_object('points', p_points, 'reason', v_reason,
                       'customer_id', btrim(p_customer_id)));

  SELECT COALESCE(SUM(l.points), 0)::integer INTO v_bal
    FROM public.points_ledger l
   WHERE l.customer_id = btrim(p_customer_id);
  RETURN jsonb_build_object('ok', true, 'balance', v_bal, 'points', p_points);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_admin_adjust(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_admin_adjust(text, integer, text) TO authenticated, service_role;

COMMIT;