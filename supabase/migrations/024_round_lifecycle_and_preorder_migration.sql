-- ============================================
-- Bite Me Baby — Migration 024: Round Lifecycle + Legacy PRE_ORDER Migration (PHASE 2)
-- Date: 2026-09-22 · Design: ORDER_SPINE_DESIGN.md @ 6cffbe5 (APPROVED)
--
-- 1) D-2 canonical initial cutoffs (08:00 / 10:30 / 16:00) — business defaults stored in
--    DB rows; runtime authority stays in delivery_rounds (editable via AdminRounds).
-- 2) public.order_setting() — settings reader helper (JSONB business_settings).
-- 3) public.ensure_rounds_for_date(p_date) — deterministic round instantiation:
--    id = 'round-<YYYYMMDD>-<round_key>' (date+key deterministic, NOT timestamp);
--    template = latest row per round_key; validates template; returns existing rows
--    when present; never duplicates on retry.
-- 4) Legacy pre_orders migration: verify-at-migration (no assumptions), preserve the
--    PO- order number, resolve stale-round mismatch via deterministic new round,
--    stamp pre_orders.migrated_order_id, then FREEZE pre_orders to read-only archive.
--
-- Additive · idempotent · transactional · legacy data preserved.
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.ensure_rounds_for_date(date);
--   DROP FUNCTION IF EXISTS public.order_setting(text, numeric);
--   DELETE FROM public.orders WHERE order_number IN (SELECT order_number FROM public.pre_orders WHERE migrated_order_id IS NOT NULL);
--   UPDATE public.pre_orders SET migrated_order_id = NULL;
--   ALTER TABLE public.pre_orders DROP COLUMN IF EXISTS migrated_order_id;
--   (round rows created for target dates: DELETE FROM public.delivery_rounds WHERE id LIKE 'round-%-%' AND scheduled_date >= CURRENT_DATE AND current_count = 0;)
-- ============================================

BEGIN;

-- 1. D-2 canonical initial cutoffs (business defaults in DB, admin-editable afterwards)
UPDATE public.delivery_rounds SET cutoff_time = '08:00', updated_at = NOW()
 WHERE COALESCE(round_key, name) = 'morning' AND cutoff_time <> '08:00';
UPDATE public.delivery_rounds SET cutoff_time = '10:30', updated_at = NOW()
 WHERE COALESCE(round_key, name) = 'midday' AND cutoff_time <> '10:30';
UPDATE public.delivery_rounds SET cutoff_time = '16:00', updated_at = NOW()
 WHERE COALESCE(round_key, name) = 'evening' AND cutoff_time <> '16:00';

-- 2. settings reader (order_policy JSONB)
CREATE OR REPLACE FUNCTION public.order_setting(p_field text, p_default numeric DEFAULT NULL)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (bs.value ->> p_field)::numeric
       FROM public.business_settings bs
      WHERE bs.key = 'order_policy'),
    p_default)
$$;

REVOKE EXECUTE ON FUNCTION public.order_setting(text, numeric) FROM PUBLIC, anon;

-- 3. traceability column on the island table (no hard FK — archive semantics)
ALTER TABLE public.pre_orders ADD COLUMN IF NOT EXISTS migrated_order_id TEXT;

COMMIT;
-- ============================================
-- Migration 024 (ต่อ) — ensure_rounds_for_date (deterministic round instantiation)
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_rounds_for_date(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_key text;
  v_tpl public.delivery_rounds%ROWTYPE;
  v_id text;
  v_rounds jsonb;
BEGIN
  IF p_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_DATE'; END IF;
  IF p_date < v_today THEN RAISE EXCEPTION 'ERR_DATE_IN_PAST'; END IF;
  IF p_date > v_today + 30 THEN RAISE EXCEPTION 'ERR_DATE_TOO_FAR'; END IF;

  FOREACH v_key IN ARRAY ARRAY['morning','midday','evening'] LOOP
    SELECT * INTO v_tpl
      FROM public.delivery_rounds
     WHERE COALESCE(round_key, name) = v_key
     ORDER BY scheduled_date DESC NULLS LAST, created_at DESC
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ERR_ROUND_TEMPLATE_MISSING: %', v_key;
    END IF;
    IF v_tpl.cutoff_time IS NULL OR v_tpl.max_capacity IS NULL OR v_tpl.max_capacity <= 0 THEN
      RAISE EXCEPTION 'ERR_ROUND_TEMPLATE_INVALID: %', v_key;
    END IF;

    v_id := 'round-' || to_char(p_date, 'YYYYMMDD') || '-' || v_key;
    INSERT INTO public.delivery_rounds (
      id, round_key, name, display_name, cutoff_time, delivery_start, delivery_end,
      max_capacity, current_count, date, scheduled_date, status
    ) VALUES (
      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time, v_tpl.delivery_start,
      v_tpl.delivery_end, v_tpl.max_capacity, 0, p_date, p_date, 'active'
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'round_key', r.round_key, 'display_name', r.display_name,
           'scheduled_date', r.scheduled_date, 'cutoff_time', r.cutoff_time,
           'delivery_start', r.delivery_start, 'delivery_end', r.delivery_end,
           'max_capacity', r.max_capacity, 'current_count', r.current_count, 'status', r.status
         ) ORDER BY r.delivery_start), '[]'::jsonb)
    INTO v_rounds
    FROM public.delivery_rounds r
   WHERE r.scheduled_date = p_date AND r.status = 'active';

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'rounds', v_rounds);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_rounds_for_date(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_rounds_for_date(date) TO authenticated;

COMMIT;
-- ============================================
-- Migration 024 (ต่อ) — legacy PRE_ORDER migration + archive freeze
-- ROLLBACK (ส่วนนี้):
--   UPDATE public.pre_orders SET migrated_order_id = NULL;
--   DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE order_number IN (SELECT order_number FROM public.pre_orders WHERE order_number LIKE 'PO-%'));
--   DELETE FROM public.orders WHERE order_number IN (SELECT order_number FROM public.pre_orders);
--   (capacity ของ round ปลายทางต้องลดกลับด้วยตนเองหลัง rollback ข้างต้น)
-- ============================================

BEGIN;

-- traceability column on the island table (no hard FK — archive semantics)
ALTER TABLE public.pre_orders ADD COLUMN IF NOT EXISTS migrated_order_id TEXT;

-- legacy pre_orders -> canonical orders (verify-at-migration; preserve PO- numbers)
DO $$
DECLARE
  v_po public.pre_orders%ROWTYPE;
  v_ref_round_key text;
  v_rid text;
  v_oid text;
BEGIN
  FOR v_po IN SELECT * FROM public.pre_orders WHERE migrated_order_id IS NULL ORDER BY created_at FOR UPDATE LOOP
    -- validate product
    IF v_po.product_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_po.product_id) THEN
      RAISE EXCEPTION 'ERR_MIGRATION_PRODUCT_MISSING: %', v_po.order_number;
    END IF;
    -- validate totals
    IF COALESCE(v_po.total_amount, 0) <> ROUND(COALESCE(v_po.unit_price, 0) * COALESCE(v_po.quantity, 1), 2) THEN
      RAISE EXCEPTION 'ERR_MIGRATION_TOTAL_MISMATCH: %', v_po.order_number;
    END IF;
    -- validate scheduled date
    IF v_po.scheduled_date IS NULL THEN
      RAISE EXCEPTION 'ERR_MIGRATION_DATE_MISSING: %', v_po.order_number;
    END IF;
    -- resolve stale-round mismatch: instantiate deterministic round for the target date
    PERFORM public.ensure_rounds_for_date(v_po.scheduled_date);
    SELECT COALESCE(round_key, name) INTO v_ref_round_key
      FROM public.delivery_rounds WHERE id = v_po.delivery_round_id;
    SELECT r.id INTO v_rid
      FROM public.delivery_rounds r
     WHERE r.scheduled_date = v_po.scheduled_date AND r.status = 'active'
       AND r.round_key = COALESCE(v_ref_round_key, 'midday')
     ORDER BY r.delivery_start LIMIT 1;
    IF v_rid IS NULL THEN
      SELECT r.id INTO v_rid FROM public.delivery_rounds r
       WHERE r.scheduled_date = v_po.scheduled_date AND r.status = 'active'
       ORDER BY r.delivery_start LIMIT 1;
    END IF;
    IF v_rid IS NULL THEN
      RAISE EXCEPTION 'ERR_MIGRATION_ROUND_MISSING: %', v_po.order_number;
    END IF;
    v_oid := 'ord-mig-' || lower(replace(v_po.order_number, 'PO-', ''));

    -- create canonical order (idempotent on order_number; preserve PO- number)
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_po.order_number) THEN
      INSERT INTO public.orders (
        id, order_number, customer_id, customer_name, customer_phone, customer_ref,
        delivery_round_id, status, delivery_method, dropoff_detail, dropoff_latitude, dropoff_longitude,
        subtotal, delivery_fee, service_fee, discount_amount, tax_amount, total_amount,
        payment_status, payment_method, special_instructions, order_mode, scheduled_date, created_at
      ) VALUES (
        'ord-mig-' || lower(replace(v_po.order_number, 'PO-', '')), v_po.order_number,
        COALESCE(v_po.customer_id, v_po.customer_ref::text), COALESCE(v_po.customer_name, 'Guest'),
        COALESCE(v_po.customer_phone, ''), v_po.customer_ref,
        v_rid, 'pending', 'self_delivery', COALESCE(v_po.delivery_address, ''),
        v_po.delivery_latitude, v_po.delivery_longitude,
        ROUND(COALESCE(v_po.unit_price, 0) * COALESCE(v_po.quantity, 1), 2), 0, 0, 0, 0, v_po.total_amount,
        'pending', 'promptpay_qr', COALESCE(v_po.special_instructions, ''),
        'PRE_ORDER', v_po.scheduled_date, v_po.created_at
      );
      -- capacity: the INSERT fires trigger orders_increment_round (+1) — do NOT
      -- increment manually here (would double-count; caught on production data).

      INSERT INTO public.order_items (
        id, order_id, product_id, product_name, quantity, unit_price,
        customizations, special_request, item_total, created_at
      )
      SELECT 'oi-' || o.id || '-1', o.id, v_po.product_id, v_po.product_name,
             v_po.quantity, v_po.unit_price, '{}', '', v_po.total_amount, v_po.created_at
        FROM public.orders o
       WHERE o.order_number = v_po.order_number;

      PERFORM public.append_audit_log(
        p_action := 'preorder_migrated',
        p_entity_type := 'pre_order',
        p_entity_id := v_po.order_number,
        p_description := 'legacy pre_order migrated to canonical order (PHASE 2)',
        p_metadata := jsonb_build_object('order_id', 'ord-mig-' || lower(replace(v_po.order_number, 'PO-', '')), 'round_id', v_rid)
      );
    END IF;

    -- stamp traceability
    UPDATE public.pre_orders
       SET migrated_order_id = (SELECT id FROM public.orders WHERE order_number = v_po.order_number)
     WHERE id = v_po.id AND migrated_order_id IS NULL;
  END LOOP;
END $$;

COMMIT;
-- ============================================
-- Migration 024 (ต่อ) — FREEZE pre_orders เป็น read-only archive
-- ROLLBACK (ส่วนนี้): คืน policies ชุด 017 (own select / anon deny) + pre_orders_policy (004) ตามต้องการ
-- ============================================

BEGIN;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'pre_orders' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pre_orders', r.policyname);
  END LOOP;
END $$;

CREATE POLICY pre_orders_archive_anon ON public.pre_orders
  FOR SELECT TO anon USING (false);
CREATE POLICY pre_orders_archive_own ON public.pre_orders
  FOR SELECT TO authenticated USING (customer_ref = auth.uid());
CREATE POLICY pre_orders_archive_admin ON public.pre_orders
  FOR SELECT TO authenticated USING (public.is_admin());

COMMENT ON TABLE public.pre_orders IS
  'ARCHIVE (PHASE 2): legacy pre-order island — read-only after canonical migration. Operational pre-orders live in orders (order_mode=PRE_ORDER). Writes: canonical RPCs only.';

COMMIT;
-- ============================================
-- END OF MIGRATION 024
-- ============================================
