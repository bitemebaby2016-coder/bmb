-- ============================================================
-- Migration 147 — Role RLS matrix (ทำ partial ให้สมบูรณ์: #3 #4 #5 #6 #9 #10 #8 #11)
-- Owner sign-off 2026-10-24 (P1-P3 + "งาน missing ทำให้หมด · partial ให้สมบูรณ์")
-- หลักการ: policy ใหม่ = permissive UNION กับของเดิม (ไม่แตะ/ไม่อ่อน policy admin เดิม)
--   KITCHEN (#3) · INVENTORY (#4) · FINANCE (#5) · MARKETING (#9)
--   SUPPORT (#8) · AUDITOR/DEV (#10/#11) · RIDER (#6/P3)
-- สัญญาทดสอบ: e2e/contracts_147.sql
-- Rollback: DROP policy ใหม่ + apply 019/130/137/041 ทับ (guards กลับ is_admin เดิม)
-- ============================================================

BEGIN;

-- ---- grants parity: ตารางที่สร้างหลัง migration 006 ----
--   production มี grant อยู่แล้วผ่าน Supabase default privileges (probe ยืนยัน) แต่
--   CI (bare postgres:16) ไม่มี → explicit GRANT = idempotent + ตรงกันทั้งสองฝั่ง ----
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batches,
  public.production_batch_items, public.recipes, public.daily_closings,
  public.marketing_posts, public.marketing_rules, public.drivers,
  public.delivery_assignments TO authenticated;
GRANT SELECT ON public.system_errors, public.menu_schedule, public.audit_logs TO authenticated;

-- ============================================
-- KITCHEN (#3) — table writes (recipes/batches/batch_items)
-- ============================================
DROP POLICY IF EXISTS recipes_role_manage ON public.recipes;
CREATE POLICY recipes_role_manage ON public.recipes
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_kitchen())
  WITH CHECK (public.is_admin() OR public.is_kitchen());

DROP POLICY IF EXISTS batches_role_manage ON public.production_batches;
CREATE POLICY batches_role_manage ON public.production_batches
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_kitchen())
  WITH CHECK (public.is_admin() OR public.is_kitchen());

DROP POLICY IF EXISTS batch_items_role_manage ON public.production_batch_items;
CREATE POLICY batch_items_role_manage ON public.production_batch_items
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_kitchen())
  WITH CHECK (public.is_admin() OR public.is_kitchen());

-- ---- recreate create_production_batch — canonical 3-arg (027/028 body, guard +is_kitchen) ----
CREATE OR REPLACE FUNCTION public.create_production_batch(
  p_delivery_round_id text,
  p_scheduled_date date DEFAULT CURRENT_DATE,
  p_order_mode text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_batch_id text;
  v_items integer;
  v_row record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT (public.is_admin() OR public.is_kitchen()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_delivery_round_id IS NULL OR trim(p_delivery_round_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_ROUND';
  END IF;
  IF p_order_mode IS NOT NULL AND p_order_mode NOT IN ('SAME_DAY', 'PRE_ORDER') THEN
    RAISE EXCEPTION 'ERR_INVALID_ORDER_MODE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = p_delivery_round_id) THEN
    RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND';
  END IF;

  v_batch_id := 'batch-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
                || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.production_batches (id, delivery_round_id, scheduled_date, status, created_by, created_at, updated_at)
  VALUES (v_batch_id, p_delivery_round_id, p_scheduled_date, 'open', v_uid, NOW(), NOW());

  v_items := 0;
  FOR v_row IN
    SELECT o.id AS order_id, o.order_number, o.order_mode,
           oi.product_id, oi.product_name, SUM(oi.quantity) AS qty
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
     WHERE o.delivery_round_id = p_delivery_round_id
       AND o.scheduled_date = p_scheduled_date
       AND (p_order_mode IS NULL OR o.order_mode::text = p_order_mode)
       AND o.status IN ('confirmed', 'preparing')
       AND NOT EXISTS (
         SELECT 1 FROM public.production_batch_items pbi
          JOIN public.production_batches pb2 ON pb2.id = pbi.batch_id
          WHERE pbi.order_id = o.id
            AND pb2.delivery_round_id = p_delivery_round_id
            AND pb2.scheduled_date = p_scheduled_date
       )
     GROUP BY o.id, o.order_number, o.order_mode, oi.product_id, oi.product_name
  LOOP
    INSERT INTO public.production_batch_items (
      id, batch_id, order_id, order_number, product_id, product_name, quantity, order_mode, status, created_at
    ) VALUES (
      'pbi-' || v_batch_id || '-' || v_items,
      v_batch_id, v_row.order_id, v_row.order_number,
      v_row.product_id, v_row.product_name, v_row.qty, v_row.order_mode, 'queued', NOW()
    );
    v_items := v_items + 1;
  END LOOP;

  PERFORM public.append_audit_log(
    p_action := 'batch_created',
    p_entity_type := 'production_batch',
    p_entity_id := v_batch_id,
    p_description := 'production batch created (round ' || p_delivery_round_id || ', ' || v_items || ' items)',
    p_metadata := jsonb_build_object('scheduled_date', p_scheduled_date, 'order_mode', p_order_mode, 'items_count', v_items)
  );

  RETURN jsonb_build_object('ok', true, 'batch_id', v_batch_id, 'delivery_round_id', p_delivery_round_id, 'items_count', v_items);
END;
$$;

-- ---- recreate kitchen_queue (guard: is_admin OR is_kitchen) ----
CREATE OR REPLACE FUNCTION public.kitchen_queue(
  p_delivery_round_id text DEFAULT NULL,
  p_scheduled_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT (public.is_admin() OR public.is_kitchen()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT jsonb_agg(b) INTO v_result FROM (
    SELECT pb.id AS batch_id, pb.delivery_round_id, pb.scheduled_date, pb.status,
           COALESCE(jsonb_agg(jsonb_build_object(
             'item_id', pbi.id, 'order_number', pbi.order_number,
             'product_name', pbi.product_name, 'quantity', pbi.quantity, 'status', pbi.status
           )) FILTER (WHERE pbi.id IS NOT NULL), '[]'::jsonb) AS items
      FROM public.production_batches pb
      LEFT JOIN public.production_batch_items pbi ON pbi.batch_id = pb.id
     WHERE pb.scheduled_date = COALESCE(p_scheduled_date, CURRENT_DATE)
       AND (p_delivery_round_id IS NULL OR pb.delivery_round_id = p_delivery_round_id)
     GROUP BY pb.id, pb.delivery_round_id, pb.scheduled_date, pb.status, pb.created_at
     ORDER BY pb.created_at ASC
  ) b;

  RETURN jsonb_build_object('ok', true, 'batches', COALESCE(v_result, '[]'::jsonb));
END;
$$;

-- ============================================
-- INVENTORY (#4) — คืน grant ที่ 034 revoke (แอดมิน insert/delete พังแฝง) + write policy
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_transactions TO authenticated;

DROP POLICY IF EXISTS inventory_role_write ON public.inventory;
CREATE POLICY inventory_role_write ON public.inventory
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_inventory())
  WITH CHECK (public.is_admin() OR public.is_inventory());

DROP POLICY IF EXISTS inventory_transactions_role_write ON public.inventory_transactions;
CREATE POLICY inventory_transactions_role_write ON public.inventory_transactions
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_inventory())
  WITH CHECK (public.is_admin() OR public.is_inventory());

-- ============================================
-- FINANCE (#5) — daily_closings write policy + close_day อนุญาต is_finance()
-- ============================================
DROP POLICY IF EXISTS daily_closings_finance_write ON public.daily_closings;
CREATE POLICY daily_closings_finance_write ON public.daily_closings
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_finance())
  WITH CHECK (public.is_admin() OR public.is_finance());

CREATE OR REPLACE FUNCTION public.close_day(p_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_day date := COALESCE(p_date, (now() AT TIME ZONE 'Asia/Bangkok')::date);
  v jsonb;
BEGIN
  IF NOT (public.is_admin() OR public.is_finance() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF v_day > (now() AT TIME ZONE 'Asia/Bangkok')::date THEN
    RAISE EXCEPTION 'ERR_FUTURE_DATE';
  END IF;

  v := public.get_daily_sales(v_day);

  INSERT INTO public.daily_closings
    (business_date, closed_by, payload, gross_sales, net_sales, paid_amount, unpaid_amount, refunded_amount)
  VALUES
    (v_day, v_uid::text, v,
     (v->>'gross_sales')::numeric, (v->>'net_sales')::numeric,
     (v->>'paid_amount')::numeric, (v->>'unpaid_amount')::numeric,
     (v->>'refunded_amount')::numeric)
  ON CONFLICT (business_date) DO UPDATE
    SET closed_by = v_uid::text,
        closed_at = NOW(),
        payload = EXCLUDED.payload,
        gross_sales = EXCLUDED.gross_sales,
        net_sales = EXCLUDED.net_sales,
        paid_amount = EXCLUDED.paid_amount,
        unpaid_amount = EXCLUDED.unpaid_amount,
        refunded_amount = EXCLUDED.refunded_amount;

  PERFORM public.append_audit_log(
    p_action := 'daily_close', p_entity_type := 'daily_closing', p_entity_id := v_day::text,
    p_description := 'daily closing recorded for ' || v_day::text,
    p_metadata := v);

  RETURN jsonb_build_object('ok', true, 'business_date', v_day, 'payload', v);
END;
$$;

-- ============================================
-- MARKETING (#9) — posts/rules write + RPC guards 2 ตัว
-- ============================================
DROP POLICY IF EXISTS marketing_posts_role_write ON public.marketing_posts;
CREATE POLICY marketing_posts_role_write ON public.marketing_posts
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_marketing())
  WITH CHECK (public.is_admin() OR public.is_marketing());

DROP POLICY IF EXISTS marketing_rules_role_write ON public.marketing_rules;
CREATE POLICY marketing_rules_role_write ON public.marketing_rules
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_marketing())
  WITH CHECK (public.is_admin() OR public.is_marketing());

CREATE OR REPLACE FUNCTION public.marketing_schedule_post(
  p_post_id text,
  p_when timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_status text;
  v_approval_status text;
  v_approval_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NOT NULL AND NOT (public.is_admin() OR public.is_marketing()) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF p_when IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_ASSIGNMENT'; END IF;

  SELECT status, approval_id INTO v_status, v_approval_id
    FROM public.marketing_posts WHERE id = p_post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  SELECT status INTO v_approval_status FROM public.content_approvals WHERE id = v_approval_id;

  IF v_approval_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'ERR_APPROVAL_REQUIRED';
  END IF;
  IF v_status = 'published' THEN
    RAISE EXCEPTION 'ERR_ASSIGNMENT_CLOSED';
  END IF;

  UPDATE public.marketing_posts
     SET status = 'scheduled', scheduled_for = p_when, error = NULL, updated_at = NOW()
   WHERE id = p_post_id;

  PERFORM public.append_audit_log('marketing_scheduled', 'marketing', p_post_id,
    'marketing post scheduled', jsonb_build_object('scheduled_for', p_when, 'approval_id', v_approval_id));
  RETURN jsonb_build_object('ok', true, 'id', p_post_id, 'status', 'scheduled', 'scheduled_for', p_when);
END;
$$;

CREATE OR REPLACE FUNCTION public.marketing_save_rules(
  p_rules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_out jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NOT NULL AND NOT (public.is_admin() OR public.is_marketing()) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF p_rules IS NULL OR p_rules = '{}'::jsonb THEN
    RAISE EXCEPTION 'ERR_MISSING_ASSIGNMENT';
  END IF;

  UPDATE public.marketing_rules
     SET frequency_per_week = COALESCE((p_rules->>'frequency_per_week')::int, frequency_per_week),
         publishing_window  = COALESCE(p_rules->'publishing_window', publishing_window),
         content_mix        = COALESCE(p_rules->'content_mix', content_mix),
         menu_rules         = COALESCE(p_rules->'menu_rules', menu_rules),
         cooldown_hours     = COALESCE((p_rules->>'cooldown_hours')::int, cooldown_hours),
         stop_conditions    = COALESCE(p_rules->'stop_conditions', stop_conditions),
         updated_by         = v_uid,
         updated_at         = NOW()
   WHERE id = 'default';

  PERFORM public.append_audit_log('marketing_rules_saved', 'marketing', 'default',
    'marketing rules updated', jsonb_build_object('rules', p_rules));
  SELECT to_jsonb(r) INTO v_out FROM public.marketing_rules r WHERE r.id = 'default';
  RETURN v_out;
END;
$$;

-- ---- recreate get_daily_sales (gate: +is_finance — ไม่งั้น close_day ของ finance โดนบล็อกข้างใน) ----
CREATE OR REPLACE FUNCTION public.get_daily_sales(p_date date DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := COALESCE(p_date, (now() AT TIME ZONE 'Asia/Bangkok')::date);
  v_start timestamptz := (v_day::timestamp AT TIME ZONE 'Asia/Bangkok');
  v_end   timestamptz := ((v_day + 1)::timestamp AT TIME ZONE 'Asia/Bangkok');
  v jsonb;
BEGIN
  IF NOT (public.is_admin() OR public.is_finance() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT jsonb_build_object(
    'date', v_day,
    'orders_count',       COALESCE(SUM(1) FILTER (WHERE o.status NOT IN ('cancelled','failed')), 0),
    'cancelled_count',    COALESCE(SUM(1) FILTER (WHERE o.status IN ('cancelled','failed')), 0),
    'gross_sales',        COALESCE(SUM(o.subtotal) FILTER (WHERE o.status NOT IN ('cancelled','failed')), 0),
    'discount_total',     COALESCE(SUM(o.discount_amount) FILTER (WHERE o.status NOT IN ('cancelled','failed')), 0),
    'delivery_fee_total', COALESCE(SUM(o.delivery_fee) FILTER (WHERE o.status NOT IN ('cancelled','failed')), 0),
    'tax_total',          COALESCE(SUM(o.tax_amount) FILTER (WHERE o.status NOT IN ('cancelled','failed')), 0),
    'net_sales',          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status NOT IN ('cancelled','failed')), 0),
    'paid_amount',        COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status = 'paid' AND o.status NOT IN ('cancelled','failed')), 0),
    'unpaid_amount',      COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status = 'pending' AND o.status NOT IN ('cancelled','failed')), 0),
    'refunded_amount',    COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status IN ('refund','partially_refunded')), 0),
    'paid_by_cash',       COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status = 'paid' AND o.payment_method = 'cash_on_delivery'), 0),
    'paid_by_promptpay',  COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status = 'paid' AND o.payment_method = 'promptpay_qr'), 0),
    'paid_by_card',       COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status = 'paid' AND o.payment_method = 'credit_card'), 0),
    'sameday_count',      COALESCE(SUM(1) FILTER (WHERE o.order_mode = 'SAME_DAY' AND o.status NOT IN ('cancelled','failed')), 0),
    'preorder_count',     COALESCE(SUM(1) FILTER (WHERE o.order_mode = 'PRE_ORDER' AND o.status NOT IN ('cancelled','failed')), 0),
    'pickup_count',       COALESCE(SUM(1) FILTER (WHERE o.delivery_method = 'pickup' AND o.status NOT IN ('cancelled','failed')), 0),
    'pickup_paid_amount', COALESCE(SUM(o.total_amount) FILTER (WHERE o.delivery_method = 'pickup' AND o.payment_status = 'paid'), 0)
  ) INTO v
  FROM public.orders o
  WHERE o.created_at >= v_start AND o.created_at < v_end;

  RETURN v;
END;
$$;

-- ============================================
-- SUPPORT (#8) — read-only: orders / order_items / customers / notifications
-- ============================================
DROP POLICY IF EXISTS orders_support_read ON public.orders;
CREATE POLICY orders_support_read ON public.orders FOR SELECT TO authenticated USING (public.is_support());
DROP POLICY IF EXISTS order_items_support_read ON public.order_items;
CREATE POLICY order_items_support_read ON public.order_items FOR SELECT TO authenticated USING (public.is_support());
DROP POLICY IF EXISTS customers_support_read ON public.customers;
CREATE POLICY customers_support_read ON public.customers FOR SELECT TO authenticated USING (public.is_support());
DROP POLICY IF EXISTS notifications_support_read ON public.notifications;
CREATE POLICY notifications_support_read ON public.notifications FOR SELECT TO authenticated USING (public.is_support());

-- ============================================
-- AUDITOR (#10) + DEVELOPER (#11) — read-only ชุดเดียวกัน
-- ============================================
GRANT SELECT ON public.audit_logs TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orders', 'order_items', 'products', 'product_categories', 'delivery_rounds',
    'menu_schedule', 'promotions', 'inventory', 'recipes', 'system_errors',
    'audit_logs', 'daily_closings', 'production_batches', 'production_batch_items',
    'marketing_posts', 'business_settings'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_audit_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_auditor() OR public.is_developer())',
      t || '_audit_read', t);
  END LOOP;
END $$;

-- ============================================
-- RIDER (#6/P3) — policies อ้าง is_rider() + possession (ค่าจาก backfill/trigger 146)
-- ============================================
DROP POLICY IF EXISTS drivers_scoped_read ON public.drivers;
CREATE POLICY drivers_scoped_read ON public.drivers
  FOR SELECT TO authenticated
  USING (public.is_admin() OR (public.is_rider() AND user_id = auth.uid()));

DROP POLICY IF EXISTS assignments_scoped_read ON public.delivery_assignments;
CREATE POLICY assignments_scoped_read ON public.delivery_assignments
  FOR SELECT TO authenticated
  USING (public.is_admin() OR (public.is_rider() AND driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS drivers_self_update ON public.drivers;
CREATE POLICY drivers_self_update ON public.drivers
  FOR UPDATE TO authenticated
  USING (public.is_rider() AND user_id = auth.uid())
  WITH CHECK (public.is_rider() AND user_id = auth.uid());

COMMIT;