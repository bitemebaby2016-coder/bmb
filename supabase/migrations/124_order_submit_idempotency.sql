-- ============================================================
-- 124_order_submit_idempotency.sql — WAVE 5A (Owner-approved)
-- อนุมัติสำหรับ ISOLATED/CI database เท่านั้น — ห้าม apply ใน Production
-- จนกว่า Owner จะตรวจ diff + isolated evidence แล้วอนุมัติแยกต่างหาก
--
-- ตรวจจาก source จริง: ตัวเดิมปัจจุบัน (118) = 18 parameters
-- (…p_branch_id, p_source_channel, p_external_ref_id, p_customer_ref) ·
-- ownership จริง: COALESCE(auth.uid(), p_customer_ref) (118:49) ·
-- grants จริง (025): REVOKE FROM PUBLIC · GRANT TO authenticated
-- Design:
--   * ไม่แก้ body ของ create_order_with_items (คง 18-arg ไว้ครบ)
--   * wrapper _i เพิ่ม p_client_submit_key (DEFAULT NULL) = 19 params
--   * key = NULL → เรียกตัวเดิมด้วย named args ครบ 18 (pin overload ที่ถูก
--     ต้อง ไม่กำกวมกับ 15-arg ของ 089) = backward-compatible เดิม
--   * key ใหม่ → advisory xact lock ต่อ key → ตรวจซ้ำ → สร้างออเดอร์ตาม
--     กติกาเดิมเป๊ะ → เก็บ result jsonb ฉบับเต็ม
--   * key เดิม → owner+fingerprint ตรง → คืน result เดิม (ไม่มี order/
--     intent ใหม่) · ไม่ตรง → ERR_IDEMPOTENCY_CONFLICT (ไม่ leak 任何)
--   * unique_violation ที่ PK → แข่งจริง → ตรวจแล้วคืนของเดิม / RAISE
--   * RLS ENABLE (ไม่มี policy, ไม่ FORCE) + REVOKE ALL → ภายนอกอ่านตรง ๆ
--     ไม่ได้ · SECURITY DEFINER (owner=postgres) เท่านั้น
-- Downgrade: DROP FUNCTION create_order_with_items_i(…) + DROP TABLE
--   order_submissions → schema กลับเดิมทันที (ไม่แตะตัวเดิม) · ข้อจำกัด:
--   key ที่บันทึกหลัง apply จะหาย → replay หลัง downgrade = สร้างใหม่ได้
--   (แนะนำคง table ไว้)
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.order_submissions (
  client_submit_key   text PRIMARY KEY,
  owner_key           text NOT NULL,   -- COALESCE(auth.uid(), p_customer_ref)::text (ตรง 118:49)
  payload_fingerprint text NOT NULL,   -- md5 ของ args ทั้ง 18 (jsonb canonical)
  result              jsonb NOT NULL,  -- ผล jsonb ต้นฉบับฉบับเต็ม ( replay แบบเป๊ะ )
  order_number        text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_submissions IS
  'WAVE 5A idempotency (ISOLATED ONLY until separately approved): one row per client_submit_key; replay returns stored result without creating a second order. RLS enabled with NO policies — access only via SECURITY DEFINER wrapper.';
COMMENT ON COLUMN public.order_submissions.owner_key IS
  'Ownership binding identical to create_order_with_items (118:49): COALESCE(auth.uid(), p_customer_ref). Mismatch => ERR_IDEMPOTENCY_CONFLICT, never another user''s data.';

ALTER TABLE public.order_submissions ENABLE ROW LEVEL SECURITY; -- ไม่มี policy → ทุก role ถูกบล็อก
REVOKE ALL ON public.order_submissions FROM PUBLIC, anon, authenticated, service_role;

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
  p_branch_id text DEFAULT NULL,
  p_source_channel text DEFAULT NULL,
  p_external_ref_id text DEFAULT NULL,
  p_customer_ref uuid DEFAULT NULL,
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
  v_owner := coalesce(auth.uid()::text, '') || '|' || coalesce(p_customer_ref::text, '');
  v_fp := md5(jsonb_build_object(
    'items', p_items, 'round', p_delivery_round_id, 'method', p_delivery_method,
    'address', p_delivery_address, 'lat', p_dropoff_latitude, 'lon', p_dropoff_longitude,
    'name', p_customer_name, 'phone', p_customer_phone, 'payment', p_payment_method,
    'special', p_special_instructions, 'promo', p_promotion_code, 'dist', p_distance_km,
    'mode', p_order_mode, 'date', p_scheduled_date, 'branch', p_branch_id,
    'channel', p_source_channel, 'extref', p_external_ref_id, 'cref', p_customer_ref)::text);

  -- (4) Legacy contract: no key ⇒ original function, byte-for-byte semantics.
  IF p_client_submit_key IS NULL OR btrim(p_client_submit_key) = '' THEN
    RETURN public.create_order_with_items(
      p_items => p_items, p_delivery_round_id => p_delivery_round_id,
      p_delivery_method => p_delivery_method, p_delivery_address => p_delivery_address,
      p_dropoff_latitude => p_dropoff_latitude, p_dropoff_longitude => p_dropoff_longitude,
      p_customer_name => p_customer_name, p_customer_phone => p_customer_phone,
      p_payment_method => p_payment_method, p_special_instructions => p_special_instructions,
      p_promotion_code => p_promotion_code, p_distance_km => p_distance_km,
      p_order_mode => p_order_mode, p_scheduled_date => p_scheduled_date,
      p_branch_id => p_branch_id, p_source_channel => p_source_channel,
      p_external_ref_id => p_external_ref_id, p_customer_ref => p_customer_ref);
  END IF;

  -- (5) Serialize same-key requests across sessions (at most one order per key).
  PERFORM pg_advisory_xact_lock(hashtextextended('bmb_order_submit:' || p_client_submit_key, 42));

  SELECT * INTO v_row FROM public.order_submissions WHERE client_submit_key = p_client_submit_key;
  IF FOUND THEN
    IF v_row.owner_key IS DISTINCT FROM v_owner OR v_row.payload_fingerprint IS DISTINCT FROM v_fp THEN
      RAISE EXCEPTION 'ERR_IDEMPOTENCY_CONFLICT'; -- (2)/(10) ไม่เปิดเผยข้อมูลคู่กรณี
    END IF;
    RETURN v_row.result; -- (1) replay: order เดิม ไม่มี order/intent ใหม่
  END IF;

  -- (3) key ใหม่ → สร้างตามกติกาเดิมทุกประการ (named args ครบ 18 = pin overload)
  v_res := public.create_order_with_items(
    p_items => p_items, p_delivery_round_id => p_delivery_round_id,
    p_delivery_method => p_delivery_method, p_delivery_address => p_delivery_address,
    p_dropoff_latitude => p_dropoff_latitude, p_dropoff_longitude => p_dropoff_longitude,
    p_customer_name => p_customer_name, p_customer_phone => p_customer_phone,
    p_payment_method => p_payment_method, p_special_instructions => p_special_instructions,
    p_promotion_code => p_promotion_code, p_distance_km => p_distance_km,
    p_order_mode => p_order_mode, p_scheduled_date => p_scheduled_date,
    p_branch_id => p_branch_id, p_source_channel => p_source_channel,
    p_external_ref_id => p_external_ref_id, p_customer_ref => p_customer_ref);

  BEGIN
    INSERT INTO public.order_submissions (client_submit_key, owner_key, payload_fingerprint, result, order_number)
    VALUES (p_client_submit_key, v_owner, v_fp, v_res, coalesce(v_res->>'order_number', ''));
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_row FROM public.order_submissions WHERE client_submit_key = p_client_submit_key;
    IF FOUND THEN
      IF v_row.owner_key IS DISTINCT FROM v_owner OR v_row.payload_fingerprint IS DISTINCT FROM v_fp THEN
        RAISE EXCEPTION 'ERR_IDEMPOTENCY_CONFLICT';
      END IF;
      RETURN v_row.result;
    END IF;
    RAISE; -- ไม่ใช่การแข่งของเรา → error เดิมเด้งขึ้นมาตามจริง
  END;

  RETURN v_res;
END;
$$;

-- grants ตรงกับตัวเดิม (025): REVOKE PUBLIC · GRANT authenticated
REVOKE EXECUTE ON FUNCTION public.create_order_with_items_i FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items_i TO authenticated;

COMMIT;