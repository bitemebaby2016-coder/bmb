-- ============================================
-- Bite Me Baby — Migration 043: F-14 channel intake (source_channel + external_ref_id)
-- Owner Decision: RESOLVE F-14 + OMNICHANNEL FOUNDATION (2026-09-27)
--
-- 1) orders.source_channel / orders.external_ref_id — additive, BOTH NULLABLE
--    · historical rows stay NULL (Owner: ไม่ backfill อัตโนมัติ, ห้ามเดา channel)
--    · ไม่มี enum constraint → future channels (LINE/TIKTOK/GOOGLE/QR/DIRECT)
--      ขยายได้โดยไม่แก้ schema (รูปแบบตรวจที่ RPC เท่านั้น)
-- 2) Durable duplicate guard (DB-level, ไม่ใช่ in-memory):
--      UNIQUE (source_channel, external_ref_id) WHERE external_ref_id IS NOT NULL
--    same channel + same external ref = same logical intake (no new order)
-- 3) create_order_with_items — NEW OVERLOAD (additive + backward compatible):
--    legacy 14-param signature stays untouched → existing PWA/MANUAL callers ไม่พัง
--    new 16-param overload adds p_source_channel/p_external_ref_id:
--      · duplicate external event → returns EXISTING canonical order (duplicate:true)
--      · concurrent duplicate → unique_violation → recovers existing (no new order)
-- 4) Trigger stamps source_channel for legacy-path inserts (PWA/MANUAL by actor role),
--    so new orders are never indistinguishable from historical NULL rows.
--
-- Reversible: DROP FUNCTION (16-param), DROP TRIGGER, DROP INDEX, DROP COLUMN.
-- ไม่แตะ business authority เดิม (ราคา/โปร/ความจุ/mode ยังคิดใน RPC เดิมทั้งหมด)
-- ============================================

BEGIN;

-- ===== 1. Columns (nullable — historical semantics preserved) =====
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source_channel TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS external_ref_id TEXT;

-- ===== 2. Durable duplicate guard =====
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_channel_extref
  ON public.orders (source_channel, external_ref_id)
  WHERE external_ref_id IS NOT NULL;

-- ===== 3. Stamp channel for legacy-path inserts (PWA/MANUAL by actor role) =====
CREATE OR REPLACE FUNCTION public.orders_stamp_source_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.source_channel IS NULL THEN
    NEW.source_channel := CASE WHEN public.is_admin() THEN 'MANUAL' ELSE 'PWA' END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orders_stamp_source_channel ON public.orders;
CREATE TRIGGER trg_orders_stamp_source_channel
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_stamp_source_channel();

-- ===== 4. Channel-aware overload (16 params; legacy 14-param version untouched) =====
CREATE OR REPLACE FUNCTION public.create_order_with_items(
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
  p_source_channel text DEFAULT NULL,
  p_external_ref_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result        jsonb;
  v_order_number  text;
  v_order_id      text;
  v_channel       text;
  v_ext_ref       text;
  v_existing      record;
BEGIN
  -- ===== auth =====
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;

  -- ===== normalize / validate channel (no hard enum — future channels OK) =====
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

  -- ===== durable duplicate guard (DB index-backed) =====
  IF v_ext_ref IS NOT NULL THEN
    SELECT order_number, id INTO v_existing
      FROM public.orders
     WHERE source_channel = v_channel
       AND external_ref_id = v_ext_ref
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
      -- ONE logical external event = ONE canonical order (recover existing result)
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'order_number', v_existing.order_number,
        'duplicate', true,
        'source_channel', v_channel,
        'external_ref_id', v_ext_ref
      );
    END IF;
  END IF;


  -- ===== delegate to the canonical (legacy 14-param) implementation =====
  -- business authority (price/promo/capacity/mode/fee/state) ยังอยู่ใน RPC เดิมทั้งหมด
  v_result := public.create_order_with_items(
    p_items := p_items,
    p_delivery_round_id := p_delivery_round_id,
    p_delivery_method := p_delivery_method,
    p_delivery_address := p_delivery_address,
    p_dropoff_latitude := p_dropoff_latitude,
    p_dropoff_longitude := p_dropoff_longitude,
    p_customer_name := p_customer_name,
    p_customer_phone := p_customer_phone,
    p_payment_method := p_payment_method,
    p_special_instructions := p_special_instructions,
    p_promotion_code := p_promotion_code,
    p_distance_km := p_distance_km,
    p_order_mode := p_order_mode,
    p_scheduled_date := p_scheduled_date
  );

  v_order_number := v_result->>'order_number';
  v_order_id     := v_result->>'id';

  -- tag channel + external ref (unique index = concurrent-duplicate guard)
  BEGIN
    UPDATE public.orders
       SET source_channel = v_channel,
           external_ref_id = v_ext_ref
     WHERE order_number = v_order_number;
  EXCEPTION
    WHEN unique_violation THEN
      -- concurrent duplicate external event: recover existing canonical result
      SELECT order_number, id INTO v_existing
        FROM public.orders
       WHERE source_channel = v_channel
         AND external_ref_id = v_ext_ref
       LIMIT 1;
      -- the duplicate row created by this call must not remain (one event = one order)
      DELETE FROM public.orders
       WHERE order_number = v_order_number
         AND customer_ref = auth.uid()
         AND (v_ext_ref IS NULL OR external_ref_id = v_ext_ref);
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'order_number', v_existing.order_number,
        'duplicate', true,
        'source_channel', v_channel,
        'external_ref_id', v_ext_ref
      );
  END;

  PERFORM public.append_audit_log(
    p_action := 'order_created',
    p_entity_type := 'order',
    p_entity_id := v_order_number,
    p_description := 'canonical order created (channel-tagged)',
    p_metadata := jsonb_build_object(
      'source_channel', v_channel,
      'external_ref_id', v_ext_ref,
      'order_mode', v_result->>'order_mode',
      'total', v_result->>'total_amount'
    )
  );

  RETURN v_result || jsonb_build_object(
    'source_channel', v_channel,
    'external_ref_id', v_ext_ref,
    'duplicate', false
  );
END;
$function$;

-- ===== 5. Grants (match existing RPC policy — authenticated callers) =====
GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  jsonb, text, text, text, numeric, numeric, text, text, text, text, text, numeric, text, date, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orders_stamp_source_channel() TO authenticated;

COMMIT;

