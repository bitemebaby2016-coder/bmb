-- ============================================================
-- 124_order_submit_idempotency.sql — WAVE 5A (Owner-approved)
-- อนุมัติสำหรับ ISOLATED/CI database เท่านั้น — ห้าม apply ใน Production
-- จนกว่า Owner จะตรวจ diff + isolated evidence แล้วอนุมัติแยกต่างหาก
--
-- Design (ตรวจจาก source จริง — 025 signature มี 14 พารามิเตอร์, RETURNS jsonb,
-- SECURITY DEFINER, SET search_path = public; ownership model จริงของคำสั่งซื้อ
-- = auth.uid() (เมื่อมี session) + customer_phone (guest OTP = OD-2)):
--   * ไม่แก้ body ของ create_order_with_items เดิมเลย (ตัวเดิมยังคงอยู่ครบ)
--   * wrapper create_order_with_items_i เพิ่ม p_client_submit_key (DEFAULT NULL)
--   * key = NULL → เรียกตัวเดิมทุกประการ = backward-compatible contract เดิม
--   * key ใหม่ → advisory xact lock ( serialize คำขอ key เดียวกันข้าม session )
--                → ตรวจซ้ำ → สร้างออเดอร์ → เก็บ result jsonb ฉบับเต็ม
--   * key เดิม → ตรง owner+fingerprint → คืน result เดิมเป๊ะ (ไม่สร้างออเดอร์
--                ใหม่ ไม่มีคำสั่งจ่าย/intent ใหม่) · ไม่ตรง → ERR_IDEMPOTENCY_CONFLICT
--                  (ไม่คืนข้อมูลใด ๆ ของอีกฝ่าย)
--   * unique_violation บน PK → แข่งกันจริง → ตรวจ owner+fp แล้วคืนของเดิม/raise
--   * ทุกอย่างอยู่ใน transaction เดียวกับการสร้างออเดอร์ = failure ไม่ทิ้งข้อมูลครึ่ง ๆ
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.order_submissions (
  client_submit_key   text PRIMARY KEY,
  owner_key           text NOT NULL,   -- coalesce(auth.uid,'') || '|' || coalesce(phone,'')
  payload_fingerprint text NOT NULL,   -- md5 ของ payload คงที่ (items/round/mode/date/payment)
  result              jsonb NOT NULL,  -- ผล jsonb ต้นฉบับฉบับเต็ม (คืน replay แบบเป๊ะ)
  order_number        text NOT NULL,   -- สะดวกต่อตรวจสอบ/กู้คืน (ไม่ใช่แหล่งความจริง)
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_submissions IS
  'WAVE 5A idempotency (ISOLATED ONLY until separately approved): one row per client_submit_key; replay returns stored result without creating a second order.';
COMMENT ON COLUMN public.order_submissions.owner_key IS
  'Ownership binding: auth.uid + customer_phone (guest OTP). Mismatch => ERR_IDEMPOTENCY_CONFLICT, never another user''s data.';

GRANT SELECT ON public.order_submissions TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_order_with_items_i(
  p_items jsonb,
  p_delivery_round_id text,
  p_delivery_method text DEFAULT 'self_delivery',
  p_delivery_address text DEFAULT '',
  p_dropoff_latitude numeric DEFAULT NULL,
  p_dropoff_longitude numeric DEFAULT NULL,
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT '',
  p_payment_method text DEFAULT 'promptpay_qr',
  p_special_instructions text DEFAULT '',
  p_promotion_code text DEFAULT NULL,
  p_distance_km numeric DEFAULT 0,
  p_order_mode text DEFAULT 'SAME_DAY',
  p_scheduled_date date DEFAULT NULL,
  p_client_submit_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_fp    text;
  v_row   public.order_submissions%ROWTYPE;
  v_res   jsonb;
BEGIN
  -- (4) Legacy contract: no key ⇒ byte-for-byte the original path.
  IF p_client_submit_key IS NULL OR btrim(p_client_submit_key) = '' THEN
    RETURN public.create_order_with_items(
      p_items, p_delivery_round_id, p_delivery_method, p_delivery_address,
      p_dropoff_latitude, p_dropoff_longitude, p_customer_name, p_customer_phone,
      p_payment_method, p_special_instructions, p_promotion_code, p_distance_km,
      p_order_mode, p_scheduled_date);
  END IF;

  v_owner := coalesce(auth.uid()::text, '') || '|' || coalesce(p_customer_phone, '');
  v_fp := md5(jsonb_build_object(
    'items', p_items, 'round', p_delivery_round_id, 'method', p_delivery_method,
    'mode', p_order_mode, 'date', p_scheduled_date, 'payment', p_payment_method)::text);

  -- (5) Serialize same-key requests across sessions (at most one order per key).
  PERFORM pg_advisory_xact_lock(hashtextextended('bmb_order_submit:' || p_client_submit_key, 42));

  SELECT * INTO v_row FROM public.order_submissions WHERE client_submit_key = p_client_submit_key;
  IF FOUND THEN
    IF v_row.owner_key IS DISTINCT FROM v_owner OR v_row.payload_fingerprint IS DISTINCT FROM v_fp THEN
      RAISE EXCEPTION 'ERR_IDEMPOTENCY_CONFLICT'; -- (2)/(10) ไม่เปิดเผยข้อมูลคู่กรณี
    END IF;
    RETURN v_row.result; -- (1) replay: order เดิม, ไม่มี order/intent ใหม่
  END IF;

  -- (3) key ใหม่ = สร้างออเดอร์ใหม่ตามกติกาเดิมทุกประการ (ราคา/stock/capacity/
  --     eligibility/cancellation/state machine = คงเดิม เพราะเรียกตัวเดิมเป๊ะ)
  v_res := public.create_order_with_items(
    p_items, p_delivery_round_id, p_delivery_method, p_delivery_address,
    p_dropoff_latitude, p_dropoff_longitude, p_customer_name, p_customer_phone,
    p_payment_method, p_special_instructions, p_promotion_code, p_distance_km,
    p_order_mode, p_scheduled_date);

  BEGIN
    INSERT INTO public.order_submissions (client_submit_key, owner_key, payload_fingerprint, result, order_number)
    VALUES (p_client_submit_key, v_owner, v_fp, v_res, coalesce(v_res->>'order_number', ''));
  EXCEPTION WHEN unique_violation THEN
    -- PK race ที่ advisory ไม่ครอบ (หรือ unique อื่นจาก inner call):
    SELECT * INTO v_row FROM public.order_submissions WHERE client_submit_key = p_client_submit_key;
    IF FOUND THEN
      IF v_row.owner_key IS DISTINCT FROM v_owner OR v_row.payload_fingerprint IS DISTINCT FROM v_fp THEN
        RAISE EXCEPTION 'ERR_IDEMPOTENCY_CONFLICT';
      END IF;
      RETURN v_row.result;
    END IF;
    RAISE; -- ไม่ใช่การแข่งของเรา → ปล่อย error เดิม (ไม่กลบเกลื่อน)
  END;

  RETURN v_res;
END;
$$;

COMMIT;
