-- ============================================
-- 184 — pickup: ไม่ผูกกับรอบ · ผูกกับเวลาเปิดร้าน · นอกเวลา = notice ของลูกค้า
-- ============================================
-- Owner directive (R65, 2026-11-03) — verbatim:
--   "การรับที่ร้านไม่ต้องผูกกับรอบ เช้า กลางวัน เย็น ให้ผูกกับเวลาเปิดปิดของร้าน
--    รับได้ตลอดเวลาเปิดร้านเป็นกฏ รับนอกเวลาได้เป็นกรณีพิเศษให้ลูกค้าแจ้งเป็น
--    notice ตอนสั่ง ให้รอบเป็นเวลาปัจจุบันดีฟอลต์เวลาพิมพ์สติกเกอร์"
--
-- ปัญหาจริง (e2e/r65Rounds-result.json + r65b/r65g probes 2026-11-03):
--   ลูกค้าสั่ง PICKUP แล้ว "ไม่มีรอบให้เลือกในเช็คเอาท์" — client auto-select ใช้
--   roundBookability ที่คืน shop_closed นอกเวลาเปิดร้าน → selectedRoundId=''
--   → ปุ่มสั่งถูก disable. server trg_shop_hours (160) ยังโยน ERR_STORE_CLOSED
--   กับ pickup SAME_DAY นอกเวลาอีก (INSERT เกิดก่อนที่ delivery_method จะถูก
--   PATCH เป็น 'pickup' — จึงแยก pickup ไม่ได้ด้วยคอลัมน์)
--
-- สิ่งที่ 184 เปลี่ยน (ทั้งหมด = CREATE OR REPLACE · signature เดิมเป๊ะ):
--   1) create_pickup_order_i — ตั้ง GUC ธุรกรรม 'app.pickup_order'='1'
--      (set_config is_local=true → ล้างอัตโนมัติเมื่อจบ RPC transaction · ลูกค้า
--       เรียก create_order_with_items_i ตรง ๆ ตั้ง GUC นี้เองไม่ได้)
--   2) enforce_shop_hours (160) — ข้ามเมื่อ GUC = pickup → นอกเวลาเปิดร้าน
--      รับได้เป็นกรณีพิเศษ (client บังคับ notice ก่อนส่ง · พิมพ์ลง special_instructions
--      = ช่อง Notice บนสติกเกอร์ + คิวครัว)
--   3) enforce_operating_hours (039) — ข้ามเฉพาะ "round-key toggle"
--      (morning_open/midday_open/evening_open) เมื่อ GUC = pickup — รอบไม่ผูกการรับ
--      · "same_day_open/pre_order_open" (mode-level) ยังบังคับกับ pickup เหมือนเดิม
--
-- ไม่แตะ (คงเดิมทุกตัวอักษร):
--   - engine create_order_with_items(_i): round status/date/capacity · mode gates ·
--     menu gate · pre-order window — ทุก contract 023/124/141/142/143/148/153 คงเขียว
--   - enforce_shop_hours/operating_hours = default path เดิมเมื่อไม่มี GUC
--     (delivery นอกเวลายังโดน ERR_STORE_CLOSED เหมือนเดิม — contract 184 G1 พิสูจน์)
--   - signature create_pickup_order_i (overload pin 127/124) — เปลี่ยนเฉพาะ body
--
-- ZERO-FAKE: ไม่มีแถว hours / ค่าว่าง / parse ไม่ได้ = ข้าม (คง semantics ของ 160)
--
-- ROLE: Owner applies via `__apply 184__` (Supabase SQL Editor) — ยังไม่ได้ apply production
-- IDEMPOTENT: CREATE OR REPLACE รันซ้ำได้
-- สัญญาทดสอบ: e2e/contracts_184_pickup_outside_hours.sql (CI step แล้ว)
-- ROLLBACK (เผื่อเปลี่ยนใจ): re-apply bodies เดิมจาก 127/160/039 (ดูหัวข้อ
--   "VERBATIM จาก" ในแต่ละฟังก์ชันด้านล่าง) — ไม่มี data/schema loss
-- ============================================

BEGIN;


-- --------------------------------------------
-- 1) create_pickup_order_i — VERBATIM จาก 127_pickup_fulfillment.sql
--    + เพิ่ม 1 บรรทัด: set_config GUC ธุรกรรม (after BEGIN)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.create_pickup_order_i(
  p_items jsonb,
  p_delivery_round_id text,
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT '',
  p_payment_method text DEFAULT 'cash_on_delivery',
  p_special_instructions text DEFAULT '',
  p_promotion_code text DEFAULT NULL,
  p_order_mode text DEFAULT 'SAME_DAY',
  p_scheduled_date date DEFAULT NULL,
  p_branch_id text DEFAULT NULL,
  p_source_channel text DEFAULT 'WEB',
  p_client_submit_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
  v_order_number text;
  v_row public.orders%ROWTYPE;
  v_lat numeric; v_lon numeric;
  v_kitchen jsonb;
BEGIN
  -- 184 (Owner R65): ทำเครื่องหมายธุรกรรมนี้ว่าเป็น pickup — trigger 160/039
  -- (ส่วน round-key) จะข้ามการตรวจ · transaction-local (is_local=true) → ล้างเอง
  -- เมื่อจบ RPC call · ไม่สามารถตั้งจาก client ตรง ๆ ได้ (PostgREST ไม่ expose set_config)
  PERFORM set_config('app.pickup_order', '1', true);

  IF p_payment_method NOT IN ('promptpay_qr', 'cash_on_delivery', 'credit_card') THEN
    RAISE EXCEPTION 'ERR_INVALID_PAYMENT_METHOD';
  END IF;

  -- pickup point = branch kitchen when branch given, else canonical kitchen
  IF p_branch_id IS NOT NULL AND trim(p_branch_id) <> '' THEN
    SELECT kitchen_latitude, kitchen_longitude INTO v_lat, v_lon
      FROM public.branches WHERE id = p_branch_id AND status = 'active' LIMIT 1;
    IF v_lat IS NULL OR v_lon IS NULL THEN
      v_kitchen := public.kitchen_location();
      v_lat := (v_kitchen->>'latitude')::numeric;
      v_lon := (v_kitchen->>'longitude')::numeric;
    END IF;
  ELSE
    v_kitchen := public.kitchen_location();
    v_lat := (v_kitchen->>'latitude')::numeric;
    v_lon := (v_kitchen->>'longitude')::numeric;
  END IF;

  -- DELEGATE to the idempotent canonical creation (124 wrapper -> 118 engine).
  -- Pickup is staged as 'self_delivery' + kitchen coords so the untouched inner
  -- gates pass unchanged; the UPDATE below is the single pickup normalizer.
  v_res := public.create_order_with_items_i(
    p_items => p_items,
    p_delivery_round_id => p_delivery_round_id,
    p_delivery_method => 'self_delivery',
    p_delivery_address => 'รับที่ร้าน (Pickup)',
    p_dropoff_latitude => v_lat,
    p_dropoff_longitude => v_lon,
    p_customer_name => p_customer_name,
    p_customer_phone => p_customer_phone,
    p_payment_method => p_payment_method,
    p_special_instructions => p_special_instructions,
    p_promotion_code => p_promotion_code,
    p_distance_km => 0,
    p_order_mode => p_order_mode,
    p_scheduled_date => p_scheduled_date,
    p_branch_id => p_branch_id,
    p_source_channel => p_source_channel,
    p_external_ref_id => NULL,
    p_customer_ref => NULL,
    p_client_submit_key => p_client_submit_key
  );

  -- channel-dedupe duplicate answer: nothing to patch (order already canonical)
  IF (v_res->>'duplicate')::boolean IS TRUE THEN
    RETURN v_res;
  END IF;

  v_order_number := v_res->>'order_number';

  -- IDEMPOTENT NORMALIZER: re-running (replay) keeps values stable —
  -- pickup_code generated only when NULL (trigger), fee stays 0.
  UPDATE public.orders
     SET delivery_method = 'pickup'::public.delivery_method,
         delivery_fee = 0,
         total_amount = GREATEST(0, subtotal - discount_amount + service_fee + tax_amount),
         updated_at = NOW()
   WHERE order_number = v_order_number;

  SELECT * INTO v_row FROM public.orders WHERE order_number = v_order_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_PICKUP_PATCH_ORDER_MISSING';
  END IF;

  RETURN v_res || jsonb_build_object(
    'delivery_method', 'pickup',
    'delivery_fee', 0,
    'total_amount', v_row.total_amount,
    'pickup_code', v_row.pickup_code,
    'status', v_row.status::text,
    'payment_status', v_row.payment_status::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_pickup_order_i FROM PUBLIC, anon;

-- --------------------------------------------
-- 2) enforce_shop_hours — VERBATIM จาก 160_enforce_shop_hours.sql
--    + เพิ่ม 1 เกท: GUC pickup = ข้าม (ก่อน check SAME_DAY/เวลา)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_shop_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_h     jsonb;
  v_open  text;
  v_close text;
  v_o     int;
  v_c     int;
  v_now   int;
  v_in    boolean;
BEGIN
  -- 184 (Owner R65): pickup ผูกกับเวลาเปิดร้านที่ client ตัดสินใจแล้ว
  -- (ลูกค้าแจ้ง "รับนอกเวลาเปิดร้าน" เป็น notice) → ข้าม gate นี้เฉพาะ pickup
  IF COALESCE(current_setting('app.pickup_order', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  -- เฉพาะสายส่งวันนี้ (พรีออเดอร์วันล่วงหน้า = ยังสั่งได้นอกเวลาเปิดร้าน)
  IF NEW.order_mode::text <> 'SAME_DAY' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(value, '{}'::jsonb) INTO v_h
    FROM public.business_settings WHERE key = 'hours';
  v_open  := v_h->>'open';
  v_close := v_h->>'close';
  IF v_open IS NULL OR v_close IS NULL THEN RETURN NEW; END IF;
  IF v_open  !~ '^[0-9]{1,2}:[0-9]{2}' THEN RETURN NEW; END IF;
  IF v_close !~ '^[0-9]{1,2}:[0-9]{2}' THEN RETURN NEW; END IF;

  v_o := split_part(v_open, ':', 1)::int * 60 + left(split_part(v_open, ':', 2), 2)::int;
  v_c := split_part(v_close, ':', 1)::int * 60 + left(split_part(v_close, ':', 2), 2)::int;
  IF v_o > 1439 OR v_c > 1439 THEN RETURN NEW; END IF; -- ค่าเพี้ยน = ห้ามเดา

  v_now := EXTRACT(HOUR  FROM (now() AT TIME ZONE 'Asia/Bangkok'))::int * 60
         + EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Asia/Bangkok'))::int;

  IF v_c > v_o THEN
    v_in := (v_now >= v_o AND v_now < v_c);
  ELSE
    -- ข้ามเที่ยงคืน (เปิด 22:00 ปิด 02:00)
    v_in := (v_now >= v_o OR v_now < v_c);
  END IF;

  IF NOT v_in THEN
    RAISE EXCEPTION 'ERR_STORE_CLOSED: ร้านปิดแล้วตามเวลาที่แอดมินตั้ง (%–%) น.', v_open, v_close;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_hours ON public.orders;
CREATE TRIGGER trg_shop_hours
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_shop_hours();

REVOKE EXECUTE ON FUNCTION public.enforce_shop_hours() FROM PUBLIC, anon, authenticated;


-- --------------------------------------------
-- 3) enforce_operating_hours — VERBATIM จาก 039_weekly_menu_and_mode_controls.sql
--    + เพิ่ม 1 เกท: GUC pickup = ข้ามเฉพาะ "round-key toggle"
--      (mode-level same_day_open/pre_order_open ยังบังคับเหมือนเดิม)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_operating_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open      jsonb;
  v_mode_open boolean;
  v_round_key text;
BEGIN
  SELECT COALESCE(value, '{}'::jsonb) INTO v_open
    FROM public.business_settings WHERE key = 'operating_hours';

  -- mode-level switches: SAME for delivery AND pickup (184 ไม่ยกเว้นส่วนนี้)
  IF v_open ? 'same_day_open' OR v_open ? 'pre_order_open' THEN
    v_mode_open := CASE WHEN NEW.order_mode::text = 'PRE_ORDER'
                        THEN COALESCE((v_open->>'pre_order_open')::boolean, true)
                        ELSE COALESCE((v_open->>'same_day_open')::boolean, true) END;
    IF NOT v_mode_open THEN
      RAISE EXCEPTION 'ERR_ORDER_MODE_CLOSED: % is currently closed', NEW.order_mode::text;
    END IF;
  END IF;

  -- 184 (Owner R65): pickup ไม่ผูกกับรอบ → ข้าม round-key toggle
  -- (morning_open/midday_open/evening_open) เฉพาะธุรกรรม pickup
  IF COALESCE(current_setting('app.pickup_order', true), '') <> '1' THEN
    SELECT COALESCE(round_key, name) INTO v_round_key
      FROM public.delivery_rounds WHERE id = NEW.delivery_round_id;
    IF v_round_key IS NOT NULL AND v_open ? (v_round_key || '_open') THEN
      IF COALESCE((v_open->>((v_round_key) || '_open'))::boolean, true) = false THEN
        RAISE EXCEPTION 'ERR_ROUND_CLOSED: % round is currently closed', v_round_key;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operating_hours ON public.orders;
CREATE TRIGGER trg_operating_hours
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_operating_hours();

REVOKE EXECUTE ON FUNCTION public.enforce_operating_hours() FROM PUBLIC, anon, authenticated;

COMMIT;
-- ============================================
-- END OF MIGRATION 184
-- ============================================

GRANT EXECUTE ON FUNCTION public.create_pickup_order_i TO authenticated, service_role;
