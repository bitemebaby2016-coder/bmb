-- ============================================================
-- 124_order_submit_idempotency.sql — WAVE 5A (Owner-approved)
-- [RECONCILED 2026-10-24 — header ข้อ 3-4 เดิม (limitations "ISOLATED/CI only,
--  ห้าม apply Production จนกว่า Owner อนุมัติ") = STALE] · ตรวจสอบ read-only
--  จาก production: supabase_migrations.schema_migrations มี 118..144 ครบ → 124
--  ถูก apply แล้วจริง · function create_order_with_items_i มีอยู่ (count=1) ·
--  table order_submissions มีอยู่ · CI ที่โชว์ "skipped" คือ step ก่อนหน้าล้ม
--  ไม่ใช่ 124 หาย · ห้าม rewrite history — แก้เฉพาะคอมเมนต์แถวนี้เท่านั้น
--  (W5C R1-R15 policies ด้านล่างยังบันทึกตามเดิม = Owner-approved 2026-10-14)
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
--   * key เดิม → owner+fingerprint ตรง → คืน identity เดิม + สถานะปัจจุบัน
--     จาก orders + replay:true [W5C R3] (ไม่มี order/intent ใหม่ ไม่ mutate
--     อะไรเลย) · ไม่ตรง → ERR_IDEMPOTENCY_CONFLICT (ไม่ leak 任何)
--   * unique_violation ที่ PK → แข่งจริง → ตรวจแล้วคืนของเดิม / RAISE
--   * RLS ENABLE (ไม่มี policy, ไม่ FORCE) + REVOKE ALL → ภายนอกอ่านตรง ๆ
--     ไม่ได้ · SECURITY DEFINER (owner=postgres) เท่านั้น
-- Downgrade: DROP FUNCTION create_order_with_items_i(…) + DROP TABLE
--   order_submissions → schema กลับเดิมทันที (ไม่แตะตัวเดิม) · ข้อจำกัด:
--   key ที่บันทึกหลัง apply จะหาย → replay หลัง downgrade = สร้างใหม่ได้
--   (แนะนำคง table ไว้)
-- [W5C 2026-10-14] ปิด R1-R3 + failed-result guard (Owner-approved policies):
--   R1 fingerprint = md5(canonical(args)) — numbers trim_scale ก่อน hash
--      (13.7563 ≡ 13.75630, 0 ≡ 0.0, 1 ≡ 1.000) · string/array order/object
--      keys ไม่แตะ = ข้อมูลธุรกิจคนละชุดยัง conflict ตามสัญญา (qty/price input/
--      round/date/dist เปลี่ยน = conflict)
--   R2 key = btrim + cap 128 + ห้าม control chars → fail closed
--      ERR_IDEMPOTENCY_KEY_INVALID ก่อนสร้างออเดอร์ · คง case (opaque id) ·
--      NULL = legacy path (ไม่ระบุ key)
--   R3 replay คืน identity เดิม + status/payment_status ปัจจุบันจาก orders
--      + replay:true (ไม่ snapshot ตอน submit · ไม่ mutate สถานะใด ๆ)
--   guard: result ไม่มี order_number → ERR_IDEMPOTENCY_BAD_RESULT ก่อน persist
--      + CHECK os_result_has_order
--   [remediation 2026-10-14] CHECK เข้มงวดชนิด (object + JSON string + trim ไม่ว่าง
--      + ครอบ IS TRUE กัน NULL) · guard align กับ CHECK · unique_violation branch =
--      defense-in-depth (ใต้ advisory lock ยั่ว deterministic ไม่ได้ — ไม่มี runtime coverage)
--   owner_key ยังคง composite auth.uid()|p_customer_ref ตามเดิม (T17/T18 ตรึง
--      สัญญา) — ต่างจาก 118:49 COALESCE · ข้าม shape = conflict (option ข)
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.order_submissions (
  client_submit_key   text PRIMARY KEY,
  owner_key           text NOT NULL,   -- composite: auth.uid()::text || '|' || p_customer_ref::text (คู่มิติ — ต่างจาก 118:49 COALESCE)
  payload_fingerprint text NOT NULL,   -- md5 ของ args ทั้ง 18 (canonicalized — W5C R1: numbers trim_scale แล้ว)
  result              jsonb NOT NULL,  -- ผล jsonb ต้นฉบับฉบับเต็ม (replay: identity เดิม + สถานะปัจจุบัน [W5C R3])
  order_number        text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- [W5C remediation 2026-10-14] เข้มงวดชนิด + กัน NULL-ผ่าน:
  --   ของเดิม `result ? 'order_number' AND btrim(result->>'order_number') <> ''`
  --   ยอมรับ {"order_number": null} เพราะ btrim(NULL) <> '' = NULL และ CHECK
  --   ถือ NULL = ผ่าน → ต้องให้ expression เป็น TRUE ชัด ๆ (IS TRUE)
  CONSTRAINT os_result_has_order CHECK (
    (jsonb_typeof(result) = 'object'
     AND result ? 'order_number'
     AND jsonb_typeof(result->'order_number') = 'string'
     AND btrim(result->>'order_number') <> '') IS TRUE)
);

COMMENT ON TABLE public.order_submissions IS
  'WAVE 5A idempotency (ISOLATED ONLY until separately approved): one row per client_submit_key; replay returns stored result without creating a second order. RLS enabled with NO policies — access only via SECURITY DEFINER wrapper.';
COMMENT ON COLUMN public.order_submissions.owner_key IS
  'Ownership binding = composite auth.uid()::text || ''|'' || p_customer_ref::text (two-dimensional; NOT identical to create_order_with_items 118:49 COALESCE(auth.uid(), p_customer_ref) — STRICTER). Mismatch => ERR_IDEMPOTENCY_CONFLICT, never another user''s data. Cross-shape calls that 118 treats as the same owner (auth.uid()+cref vs service-role+cref) map to DIFFERENT owner_keys here: option ข pinned by T17/T18. If Owner adopts option (ก) (COALESCE mapping), update this comment and flip T17/T18.';

ALTER TABLE public.order_submissions ENABLE ROW LEVEL SECURITY; -- ไม่มี policy → ทุก role ถูกบล็อก
REVOKE ALL ON public.order_submissions FROM PUBLIC, anon, authenticated, service_role;

-- [W5C R1] canonicalization ก่อน fingerprint: ตัวเลขที่ค่าเท่ากันแต่ต่าง scale
-- (13.7563 vs 13.75630, 0 vs 0.0, 1 vs 1.000) → เลข canonical เดียวกัน ·
-- string / null / boolean / array order / object keys ไม่แตะ = payload ที่ต่างกัน
-- เชิงธุรกิจ (จำนวนสินค้า ราคา รอบส่ง วันที่ ลำดับรายการ) ยัง conflict ตามสัญญา
CREATE OR REPLACE FUNCTION public.order_submit_canonical_jsonb(p_value jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT
AS $function$
  SELECT CASE jsonb_typeof(p_value)
    WHEN 'number' THEN to_jsonb(trim_scale((p_value #>> '{}')::numeric))
    WHEN 'array'  THEN COALESCE((
      SELECT jsonb_agg(public.order_submit_canonical_jsonb(v) ORDER BY ord)
      FROM jsonb_array_elements(p_value) WITH ORDINALITY AS t(v, ord)), '[]'::jsonb)
    WHEN 'object' THEN COALESCE((
      SELECT jsonb_object_agg(k, public.order_submit_canonical_jsonb(v))
      FROM jsonb_each(p_value) AS t(k, v)), '{}'::jsonb)
    ELSE p_value
  END;
$function$;
COMMENT ON FUNCTION public.order_submit_canonical_jsonb(jsonb) IS
  'Internal (W5C R1): recursively canonicalizes jsonb numbers via trim_scale before fingerprinting. Strings, null, booleans and array order preserved untouched.';
-- helper ภายใน: ปิดทุก role ภายนอก (เรียกได้เฉพาะจาก SECURITY DEFINER wrapper)
REVOKE ALL ON FUNCTION public.order_submit_canonical_jsonb(jsonb) FROM PUBLIC, anon, authenticated, service_role;

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
  v_key   text;
  v_cur   public.orders%ROWTYPE;
  v_row   public.order_submissions%ROWTYPE;
  v_res   jsonb;
BEGIN
  v_owner := coalesce(auth.uid()::text, '') || '|' || coalesce(p_customer_ref::text, '');
  v_fp := md5(public.order_submit_canonical_jsonb(jsonb_build_object(
    'items', p_items, 'round', p_delivery_round_id, 'method', p_delivery_method,
    'address', p_delivery_address, 'lat', p_dropoff_latitude, 'lon', p_dropoff_longitude,
    'name', p_customer_name, 'phone', p_customer_phone, 'payment', p_payment_method,
    'special', p_special_instructions, 'promo', p_promotion_code, 'dist', p_distance_km,
    'mode', p_order_mode, 'date', p_scheduled_date, 'branch', p_branch_id,
    'channel', p_source_channel, 'extref', p_external_ref_id, 'cref', p_customer_ref))::text);

  -- (4) Legacy contract: key = NULL (ไม่ระบุ key) ⇒ original function ตามเดิม
  IF p_client_submit_key IS NULL THEN
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

  -- (4b) [W5C R2] normalize + validate key ก่อนสร้างออเดอร์ (fail closed):
  --   * btrim รอบ key — คง case เดิม (opaque identifier ห้าม lowercase อัตโนมัติ)
  --   * ยาวสุด 128 (caller จริง: CK-* ≤ 11, UUID 36, 'cev-'+UUID 40, channel event
  --     id opaque → 128 ≈ 3x ของจริง + ตรงเพดาน extref ของ 118:66) · ไม่บังคับ
  --     รูปแบบ UUID (หลักฐาน mixed formats)
  --   * ห้าม control chars · ว่างหลัง trim = ใช้ไม่ได้ (ไม่ fallback เป็น no-key)
  v_key := btrim(p_client_submit_key);
  IF v_key = '' OR length(v_key) > 128 OR v_key ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'ERR_IDEMPOTENCY_KEY_INVALID';
  END IF;

  -- (5) Serialize same-key requests across sessions (at most one order per key).
  PERFORM pg_advisory_xact_lock(hashtextextended('bmb_order_submit:' || v_key, 42));

  SELECT * INTO v_row FROM public.order_submissions WHERE client_submit_key = v_key;
  IF FOUND THEN
    IF v_row.owner_key IS DISTINCT FROM v_owner OR v_row.payload_fingerprint IS DISTINCT FROM v_fp THEN
      RAISE EXCEPTION 'ERR_IDEMPOTENCY_CONFLICT'; -- (2)/(10) ไม่เปิดเผยข้อมูลคู่กรณี
    END IF;
    -- (1) [W5C R3] replay: identity เดิม (id/order_number) + สถานะ 'ปัจจุบัน' จาก
    -- canonical order record (ไม่ใช่ snapshot ตอน submit) + replay:true · ไม่สร้าง
    -- order/intent ใหม่ และไม่ mutate สถานะใด ๆ (SELECT อย่างเดียว) · แถว order
    -- หายไปแล้ว (R13 ghost) → คืน result เดิม + replay:true (ไม่พัง)
    v_res := v_row.result || jsonb_build_object('replay', true);
    SELECT * INTO v_cur FROM public.orders WHERE order_number = v_row.order_number;
    IF FOUND THEN
      v_res := v_res || jsonb_build_object('status', v_cur.status::text, 'payment_status', v_cur.payment_status::text);
    END IF;
    RETURN v_res;
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
    -- [W5C guard / T14-T16] failed result ห้ามเข้าตาราง: 118 ทุก failure path =
    -- RAISE (37 จุด) → result ไม่มี order_number = ผิดสัญญา schema → fail closed
    -- ก่อน persist (same-tx rollback = ไม่มี partial row/order)
    -- [remediation 2026-10-14] guard เข้มงวดเท่ากับ CHECK: object + JSON string +
    -- ไม่ว่างหลัง trim (ของเดิม non-string เช่น number หลุด guard ไปโดน CHECK ตรง ๆ)
    IF v_res IS NULL OR jsonb_typeof(v_res) <> 'object'
       OR NOT (v_res ? 'order_number')
       OR jsonb_typeof(v_res->'order_number') <> 'string'
       OR btrim(v_res->>'order_number') = '' THEN
      RAISE EXCEPTION 'ERR_IDEMPOTENCY_BAD_RESULT';
    END IF;
    INSERT INTO public.order_submissions (client_submit_key, owner_key, payload_fingerprint, result, order_number)
    VALUES (v_key, v_owner, v_fp, v_res, v_res->>'order_number');
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_row FROM public.order_submissions WHERE client_submit_key = v_key;
    IF FOUND THEN
      IF v_row.owner_key IS DISTINCT FROM v_owner OR v_row.payload_fingerprint IS DISTINCT FROM v_fp THEN
        RAISE EXCEPTION 'ERR_IDEMPOTENCY_CONFLICT';
      END IF;
      -- [W5C R3] race-loser path (timeout/ambiguous outcome): replay แบบเดียวกับ
      -- ด้านบน — identity เดิม + สถานะปัจจุบัน + replay:true
      -- [remediation 2026-10-14] หมายเหตุตามจริง: branch นี้ = defense-in-depth —
      -- advisory xact lock ข้อ (5) serialize same-key tx ทั้งหมดก่อนถึง SELECT/INSERT
      -- จึงยั่ว unique_violation แบบ deterministic ไม่ได้ (ต้องมี direct INSERT ใน
      -- หน้าต่าง SELECT→INSERT เท่านั้น) → **ยังไม่มี runtime coverage** · มีเพียง
      -- code inspection + ตรรกะเดียวกับ path (1) (ห้ามอ้างว่าทดสอบแล้ว)
      v_res := v_row.result || jsonb_build_object('replay', true);
      SELECT * INTO v_cur FROM public.orders WHERE order_number = v_row.order_number;
      IF FOUND THEN
        v_res := v_res || jsonb_build_object('status', v_cur.status::text, 'payment_status', v_cur.payment_status::text);
      END IF;
      RETURN v_res;
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