-- ============================================================
-- Bite Me Baby — Migration 129: WEB POS — STAFF ROLE + SHIFT/CASH
-- Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
--
-- 1) profiles.role += 'staff' (customer|staff|admin) — CHECK rebuilt
-- 2) is_staff() helper (admin OR staff, active) — is_admin() UNCHANGED
-- 3) staff read policies on operational tables (SELECT only)
-- 4) transition_order_status + confirm_offline_payment: staff allowed
-- 5) shifts + open_shift/close_shift (cash reconciliation, idempotent)
-- 6) pos_closeout_order: one-tap counter sale closeout
--    (legal transition path + cash payment confirm — reuses Order Hub ONLY)
--
-- POS order creation rides the SAME canonical RPC (create_order_with_items_i /
-- create_pickup_order_i) — NO new order engine, NO new payment engine.
-- ============================================================

-- ---------- 1. role CHECK extension ----------
DO $$
DECLARE
  c RECORD;
  v_has_staff boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.profiles'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%role%'
       AND pg_get_constraintdef(oid) ILIKE '%staff%'
  ) INTO v_has_staff;
  IF NOT v_has_staff THEN
    FOR c IN
      SELECT conname FROM pg_constraint
       WHERE conrelid = 'public.profiles'::regclass
         AND contype = 'c'
         AND pg_get_constraintdef(oid) ILIKE '%role%'
         AND pg_get_constraintdef(oid) ILIKE '%customer%'
         AND pg_get_constraintdef(oid) ILIKE '%admin%'
    LOOP
      EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
    END LOOP;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('customer', 'staff', 'admin'));
  END IF;
END $$;

-- ---------- 2. is_staff ----------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND role IN ('admin', 'staff') AND is_active = true
  );
$$;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;

-- ---------- 3. staff SELECT policies (admin keeps its own policies) ----------
DROP POLICY IF EXISTS orders_staff_select ON public.orders;
CREATE POLICY orders_staff_select ON public.orders FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS order_items_staff_select ON public.order_items;
CREATE POLICY order_items_staff_select ON public.order_items FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS products_staff_select ON public.products;
CREATE POLICY products_staff_select ON public.products FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS product_categories_staff_select ON public.product_categories;
CREATE POLICY product_categories_staff_select ON public.product_categories FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS menu_sections_staff_select ON public.menu_sections;
CREATE POLICY menu_sections_staff_select ON public.menu_sections FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS menu_schedule_staff_select ON public.menu_schedule;
CREATE POLICY menu_schedule_staff_select ON public.menu_schedule FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS delivery_rounds_staff_select ON public.delivery_rounds;
CREATE POLICY delivery_rounds_staff_select ON public.delivery_rounds FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS business_settings_staff_select ON public.business_settings;
CREATE POLICY business_settings_staff_select ON public.business_settings FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS inventory_staff_select ON public.inventory;
CREATE POLICY inventory_staff_select ON public.inventory FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS recipes_staff_select ON public.recipes;
CREATE POLICY recipes_staff_select ON public.recipes FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS print_jobs_staff_all ON public.print_jobs;
CREATE POLICY print_jobs_staff_all ON public.print_jobs
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS payment_intents_staff_select ON public.payment_intents;
CREATE POLICY payment_intents_staff_select ON public.payment_intents FOR SELECT USING (public.is_staff());

-- ---------- 4a. transition_order_status: staff allowed (copy of 019 + guard widening ONLY) ----------
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_number text,
  p_new_status public.order_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_old public.order_status;
  v_customer_ref uuid;
  v_is_admin boolean;
  v_is_owner boolean;
  v_inv jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT status, customer_ref INTO v_old, v_customer_ref
    FROM public.orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  -- 129: staff (POS/kitchen counter) may drive the operational state machine
  v_is_admin := public.is_admin() OR public.is_staff();
  v_is_owner := (v_customer_ref IS NOT NULL AND v_customer_ref = v_uid);

  IF NOT public.order_transition_allowed(v_old::text, p_new_status::text, v_is_admin, v_is_owner) THEN
    RAISE EXCEPTION 'ERR_INVALID_TRANSITION: % -> %', v_old::text, p_new_status::text;
  END IF;

  UPDATE public.orders SET status = p_new_status, updated_at = NOW()
   WHERE order_number = p_order_number;

  PERFORM public.append_audit_log(
    p_action := 'order_status_change',
    p_entity_type := 'order',
    p_entity_id := p_order_number,
    p_description := 'order status ' || v_old::text || ' -> ' || p_new_status::text,
    p_metadata := jsonb_build_object('from', v_old::text, 'to', p_new_status::text)
  );

  -- INV-01 (Phase 2): commit raw material at CONFIRM; refund it on CANCEL/FAIL (from non-terminal).
  IF p_new_status = 'confirmed' THEN
    v_inv := public.deduct_inventory_for_order(p_order_number);
  ELSIF p_new_status IN ('cancelled', 'failed') AND v_old IN ('confirmed', 'preparing') THEN
    v_inv := public.restore_inventory_for_order(p_order_number);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_number', p_order_number,
    'from', v_old::text,
    'to', p_new_status::text,
    'inventory', v_inv
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_order_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_order_status TO authenticated;

-- ---------- 4b. confirm_offline_payment: staff allowed (copy of 008 + guard widening ONLY) ----------
CREATE OR REPLACE FUNCTION public.confirm_offline_payment(
  p_order_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_method text;
  v_order_status public.order_status;
  v_intent_status text;
  v_intent_id text;
  v_paid_status public.payment_status;
BEGIN
  IF NOT (public.is_admin() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ORDER';
  END IF;

  SELECT payment_status INTO v_paid_status
    FROM public.orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;
  IF v_paid_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order_number', p_order_number);
  END IF;

  SELECT payment_method, status INTO v_payment_method, v_order_status
    FROM public.orders WHERE order_number = p_order_number;

  IF v_payment_method = 'cash_on_delivery' THEN
    IF v_order_status <> 'delivered' THEN
      RAISE EXCEPTION 'ERR_COD_NOT_DELIVERED';
    END IF;
    UPDATE public.payment_intents
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE order_number = p_order_number AND method = 'cash_on_delivery';
  ELSE
    SELECT status, id INTO v_intent_status, v_intent_id
      FROM public.payment_intents
     WHERE order_number = p_order_number AND method = v_payment_method
     ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NO_PAYMENT_INTENT'; END IF;
    IF v_intent_status <> 'processing' THEN
      RAISE EXCEPTION 'ERR_INTENT_NOT_PROCESSING';
    END IF;
    UPDATE public.payment_intents
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE id = v_intent_id;
  END IF;

  UPDATE public.orders
     SET payment_status = 'paid', updated_at = NOW()
   WHERE order_number = p_order_number;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'order_number', p_order_number, 'payment_status', 'paid');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_offline_payment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_offline_payment TO authenticated;

-- ---------- 5. shifts + cash reconciliation ----------
CREATE TABLE IF NOT EXISTS public.shifts (
  id             TEXT PRIMARY KEY,
  branch_id      TEXT,
  opened_by      TEXT NOT NULL,
  closed_by      TEXT,
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at      TIMESTAMPTZ,
  opening_cash   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  counted_cash   NUMERIC(12,2),
  expected_cash  NUMERIC(12,2),
  difference     NUMERIC(12,2),
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_one_open
  ON public.shifts (COALESCE(branch_id, '')) WHERE status = 'open';

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shifts_staff_select ON public.shifts;
CREATE POLICY shifts_staff_select ON public.shifts FOR SELECT USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.open_shift(
  p_opening_cash numeric DEFAULT 0,
  p_branch_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.shifts%ROWTYPE;
  v_id text;
BEGIN
  IF NOT (public.is_admin() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_opening_cash < 0 THEN RAISE EXCEPTION 'ERR_INVALID_OPENING_CASH'; END IF;

  SELECT * INTO v_row FROM public.shifts
   WHERE status = 'open' AND COALESCE(branch_id, '') = COALESCE(p_branch_id, '') LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'shift_id', v_row.id,
                              'opening_cash', v_row.opening_cash, 'opened_at', v_row.opened_at);
  END IF;

  v_id := 'sh-' || to_char(NOW() AT TIME ZONE 'Asia/Bangkok', 'YYYYMMDD-HH24MISS') || '-' || substr(md5(random()::text), 1, 6);
  INSERT INTO public.shifts (id, branch_id, opened_by, opening_cash, status)
  VALUES (v_id, NULLIF(trim(COALESCE(p_branch_id, '')), ''), v_uid::text, p_opening_cash, 'open');

  PERFORM public.append_audit_log(
    p_action := 'shift_open', p_entity_type := 'shift', p_entity_id := v_id,
    p_description := 'shift opened with cash drawer ' || p_opening_cash,
    p_metadata := jsonb_build_object('opening_cash', p_opening_cash, 'branch_id', p_branch_id));

  SELECT * INTO v_row FROM public.shifts WHERE id = v_id;
  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'shift_id', v_row.id,
                            'opening_cash', v_row.opening_cash, 'opened_at', v_row.opened_at);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.open_shift FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_shift TO authenticated;

CREATE OR REPLACE FUNCTION public.close_shift(
  p_shift_id text,
  p_counted_cash numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.shifts%ROWTYPE;
  v_expected numeric;
BEGIN
  IF NOT (public.is_admin() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT * INTO v_row FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_SHIFT_NOT_FOUND'; END IF;
  IF v_row.status = 'closed' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'shift_id', p_shift_id,
                              'expected_cash', v_row.expected_cash,
                              'counted_cash', v_row.counted_cash,
                              'difference', v_row.difference);
  END IF;

  -- expected = opening + cash collected in window (cash_on_delivery PAID orders;
  -- order total is NOT cash received unless payment_status='paid')
  SELECT v_row.opening_cash + COALESCE(SUM(o.total_amount), 0) INTO v_expected
    FROM public.orders o
   WHERE o.payment_method = 'cash_on_delivery'
     AND o.payment_status = 'paid'
     AND o.updated_at >= v_row.opened_at
     AND o.updated_at <= NOW();

  UPDATE public.shifts
     SET status = 'closed', closed_by = v_uid::text, closed_at = NOW(),
         counted_cash = p_counted_cash, expected_cash = v_expected,
         difference = p_counted_cash - v_expected,
         notes = COALESCE(p_notes, notes)
   WHERE id = p_shift_id;

  PERFORM public.append_audit_log(
    p_action := 'shift_close', p_entity_type := 'shift', p_entity_id := p_shift_id,
    p_description := 'shift closed: counted ' || p_counted_cash || ' vs expected ' || v_expected,
    p_metadata := jsonb_build_object('opening_cash', v_row.opening_cash,
                                     'expected_cash', v_expected,
                                     'counted_cash', p_counted_cash,
                                     'difference', p_counted_cash - v_expected));

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'shift_id', p_shift_id,
                            'expected_cash', v_expected, 'counted_cash', p_counted_cash,
                            'difference', p_counted_cash - v_expected);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.close_shift FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_shift TO authenticated;

-- ---------- 6. POS closeout: legal transition path + cash confirm ----------
CREATE OR REPLACE FUNCTION public.pos_closeout_order(
  p_order_number text,
  p_mark_paid boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.order_status;
  v_res jsonb;
  v_pay jsonb;
BEGIN
  IF NOT (public.is_admin() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT status INTO v_status FROM public.orders WHERE order_number = p_order_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  -- walk the ALLOWED path only (each step audited by transition_order_status)
  IF v_status = 'pending' THEN
    v_res := public.transition_order_status(p_order_number, 'confirmed');
    v_status := 'confirmed';
  END IF;
  IF v_status = 'confirmed' THEN
    v_res := public.transition_order_status(p_order_number, 'preparing');
    v_status := 'preparing';
  END IF;
  IF v_status = 'preparing' THEN
    v_res := public.transition_order_status(p_order_number, 'ready_for_dispatch');
    v_status := 'ready_for_dispatch';
  END IF;
  IF v_status = 'ready_for_dispatch' THEN
    v_res := public.transition_order_status(p_order_number, 'delivered');
    v_status := 'delivered';
  END IF;

  v_pay := NULL;
  IF p_mark_paid AND v_status = 'delivered' THEN
    v_pay := public.confirm_offline_payment(p_order_number);
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number,
                            'status', v_status::text, 'payment', v_pay, 'last_transition', v_res);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pos_closeout_order FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_closeout_order TO authenticated;

-- ========== CONTRACT NOTES (129) ==========
-- * is_admin() UNCHANGED — admin RLS surface identical; staff = read + RPC-only.
-- * pos_closeout_order drives ONLY the legal transition matrix (030/127) —
--   inventory deduct/restore + audit trail fire exactly as in the PWA flow.
-- * close_shift.expected_cash counts ONLY payment_status='paid' cash orders —
--   order totals of unpaid orders are never treated as cash received.
