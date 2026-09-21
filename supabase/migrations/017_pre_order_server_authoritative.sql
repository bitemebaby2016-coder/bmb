-- ============================================
-- Bite Me Baby — Migration 017: Server-Authoritative Pre-Order Pricing (PAY-01 / S-2) + PRE-01
-- Date: 2026-09-21
-- Phase: PHASE 1 (MONEY + ORDER)
--
-- Goal:
--   pre-orders must match the 007 principle for regular orders:
--     client = input layer only — product_id / quantity / round / address / contact.
--     server re-derives unit_price + total_amount from products.price and locks
--     delivery_rounds capacity atomically; client-provided prices are ignored.
--
-- Implements:
--   1. create_pre_order_with_items(...)     — server-authoritative insert
--   2. quote_pre_order(p_product_id, p_quantity) — authoritative price quote for display
--   3. cancel_pre_order(p_order_number)      — owner/admin cancel + capacity refund
--   4. pre_orders RLS: authenticated direct INSERT/UPDATE/DELETE revoked
--      (writes via RPC only); SELECT own kept; admin ALL kept.
--
-- Security: SECURITY DEFINER + SET search_path = public; EXECUTE authenticated only.
-- Idempotent: safe to re-run.
-- ============================================

BEGIN;

-- ============================================
-- 1. RPC: create_pre_order_with_items
--    Input only (no price fields — ignored like 007):
-- ============================================
CREATE OR REPLACE FUNCTION public.create_pre_order_with_items(
  p_product_id text,
  p_quantity integer DEFAULT 1,
  p_delivery_round_id text DEFAULT NULL,
  p_scheduled_date date DEFAULT NULL,
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT '',
  p_delivery_latitude numeric DEFAULT NULL,
  p_delivery_longitude numeric DEFAULT NULL,
  p_delivery_address text DEFAULT '',
  p_special_instructions text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid;
  v_id           text;
  v_order_number text;
  v_prod         public.products%ROWTYPE;
  v_round        public.delivery_rounds%ROWTYPE;
  v_unit_price   numeric;
  v_total        numeric;
  v_exists       boolean;
  v_attempt      integer := 0;
BEGIN
  -- ===== 1. AUTHENTICATION =====
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;

  -- ===== 2. PRODUCT GUARD (authoritative price from DB, FOR UPDATE) =====
  IF p_product_id IS NULL OR trim(p_product_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_PRODUCT';
  END IF;
  SELECT * INTO v_prod
    FROM public.products
   WHERE id = p_product_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND';
  END IF;
  IF NOT COALESCE(v_prod.is_preorder, false) THEN
    RAISE EXCEPTION 'ERR_NOT_PREORDER_PRODUCT';
  END IF;
  IF NOT COALESCE(v_prod.is_available, true) THEN
    RAISE EXCEPTION 'ERR_PRODUCT_UNAVAILABLE';
  END IF;

  -- ===== 3. QUANTITY =====
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'ERR_QUANTITY_INVALID';
  END IF;

  -- ===== 4. ROUND VALIDATION + ATOMIC CAPACITY LOCK =====
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ROUND';
  END IF;
  SELECT * INTO v_round
    FROM public.delivery_rounds
   WHERE id = p_delivery_round_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND';
  END IF;
  IF v_round.status NOT IN ('active', 'open', 'scheduled') THEN
    RAISE EXCEPTION 'ERR_ROUND_CLOSED';
  END IF;
  IF v_round.current_count >= v_round.max_capacity THEN
    RAISE EXCEPTION 'ERR_ROUND_FULL';
  END IF;
  IF p_scheduled_date IS NOT NULL AND v_round.scheduled_date IS NOT NULL
     AND v_round.scheduled_date <> p_scheduled_date THEN
    RAISE EXCEPTION 'ERR_ROUND_DATE_MISMATCH';
  END IF;

  -- ===== 5. CUSTOMER ROW (FK target customers.id, mirroring current app) =====
  INSERT INTO public.customers (id, user_id, full_name, phone, created_at, updated_at)
  VALUES (v_uid::text, v_uid, COALESCE(NULLIF(trim(p_customer_name), ''), 'Guest'),
          NULLIF(trim(p_customer_phone), ''), NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        full_name = COALESCE(NULLIF(trim(p_customer_name), ''), customers.full_name),
        updated_at = NOW();

  -- ===== 6. AUTHORITATIVE TOTALS =====
  v_unit_price := v_prod.price;
  v_total      := round(v_prod.price * p_quantity, 2);

  -- ===== 7. ORDER NUMBER (PO-YYYYMMDD-NNN) =====
  v_id := 'po-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
          || '-' || substr(md5(random()::text), 1, 6);
  LOOP
    v_attempt := v_attempt + 1;
    v_order_number := 'PO-' || to_char(COALESCE(p_scheduled_date, CURRENT_DATE), 'YYYYMMDD') || '-'
                      || lpad((floor(random() * 900) + 100)::text, 3, '0');
    SELECT EXISTS (SELECT 1 FROM public.pre_orders WHERE order_number = v_order_number) INTO v_exists;
    EXIT WHEN NOT v_exists OR v_attempt >= 5;
  END LOOP;
  IF v_exists THEN
    RAISE EXCEPTION 'ERR_ORDER_NUMBER_EXHAUSTED';
  END IF;

  -- ===== 8. INSERT pre_orders (server-authoritative amounts) =====
  INSERT INTO public.pre_orders (
    id, order_number, customer_id, customer_name, customer_phone,
    product_id, product_name, quantity, unit_price, total_amount,
    delivery_round_id, scheduled_date, delivery_latitude, delivery_longitude,
    delivery_address, status, special_instructions, customer_ref, created_at, updated_at
  ) VALUES (
    v_id, v_order_number, v_uid::text,
    COALESCE(NULLIF(trim(p_customer_name), ''), 'Guest'),
    NULLIF(trim(p_customer_phone), ''),
    v_prod.id, v_prod.name, p_quantity, v_unit_price, v_total,
    v_round.id, COALESCE(p_scheduled_date, v_round.scheduled_date),
    p_delivery_latitude, p_delivery_longitude,
    COALESCE(p_delivery_address, ''), 'pending', COALESCE(p_special_instructions, ''),
    v_uid, NOW(), NOW()
  );

  -- ===== 9. CAPACITY INCREMENT (atomic — locked row from step 4) =====
  UPDATE public.delivery_rounds
     SET current_count = current_count + 1, updated_at = NOW()
   WHERE id = v_round.id;

  -- ===== 10. RETURN authoritative result =====
  RETURN jsonb_build_object(
    'id', v_id,
    'order_number', v_order_number,
    'product_id', v_prod.id,
    'product_name', v_prod.name,
    'quantity', p_quantity,
    'unit_price', v_unit_price,
    'total_amount', v_total,
    'delivery_round_id', v_round.id,
    'round_display_name', v_round.display_name,
    'scheduled_date', COALESCE(to_char(p_scheduled_date, 'YYYY-MM-DD'), to_char(v_round.scheduled_date, 'YYYY-MM-DD')),
    'status', 'pending',
    'customer_ref', v_uid::text
  );
END;
$$;

-- ============================================
-- 2. RPC: quote_pre_order — authoritative price quote (display only, no write)
-- ============================================
CREATE OR REPLACE FUNCTION public.quote_pre_order(
  p_product_id text,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod public.products%ROWTYPE;
BEGIN
  IF p_product_id IS NULL OR trim(p_product_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_PRODUCT';
  END IF;
  SELECT * INTO v_prod FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND'; END IF;
  IF NOT COALESCE(v_prod.is_preorder, false) THEN RAISE EXCEPTION 'ERR_NOT_PREORDER_PRODUCT'; END IF;
  
  RETURN jsonb_build_object(
    'product_id', v_prod.id,
    'unit_price', v_prod.price,
    'quantity', GREATEST(COALESCE(p_quantity, 1), 1),
    'total_amount', round(v_prod.price * GREATEST(COALESCE(p_quantity, 1), 1), 2)
  );
END;
$$;

-- ============================================
-- 3. RPC: cancel_pre_order — owner/admin cancel + capacity refund
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_pre_order(
  p_order_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid;
  v_row   public.pre_orders%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT * INTO v_row FROM public.pre_orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  IF NOT (public.is_admin() OR v_row.customer_ref = v_uid) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  IF v_row.status IN ('cancelled', 'expired', 'delivered', 'picked_up') THEN
    RAISE EXCEPTION 'ERR_ORDER_TERMINAL';
  END IF;

  UPDATE public.pre_orders
     SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
   WHERE id = v_row.id;

  -- Refund capacity slot when the round still exists.
  IF v_row.delivery_round_id IS NOT NULL THEN
    UPDATE public.delivery_rounds
       SET current_count = GREATEST(current_count - 1, 0), updated_at = NOW()
     WHERE id = v_row.delivery_round_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', 'cancelled');
END;
$$;

-- ============================================
-- 4. EXECUTE permission — authenticated only
-- ============================================
REVOKE EXECUTE ON FUNCTION public.create_pre_order_with_items FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.quote_pre_order FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_pre_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pre_order_with_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.quote_pre_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pre_order TO authenticated;

-- ============================================
-- 5. pre_orders RLS — write authority via RPC only
--    authenticated: SELECT own kept · INSERT/UPDATE/DELETE revoked
--    admin: ALL kept (operational management)
-- ============================================
DROP POLICY IF EXISTS pre_orders_own ON pre_orders;
CREATE POLICY pre_orders_own_select ON pre_orders
  FOR SELECT TO authenticated
  USING (customer_ref = auth.uid());

DROP POLICY IF EXISTS pre_orders_anon_read ON pre_orders;
CREATE POLICY pre_orders_anon_read ON pre_orders
  FOR SELECT TO anon
  USING (false);

-- ============================================
-- DONE
-- ============================================
COMMIT;

-- ============================================
-- END OF MIGRATION 017
-- ============================================