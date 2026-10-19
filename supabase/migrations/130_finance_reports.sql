-- ============================================================
-- Bite Me Baby — Migration 130: FINANCE REPORTS + DAILY CLOSING
-- Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
--
-- SEMANTIC DISCIPLINE (Owner rule):
--   * order total is NOT cash received. paid_amount counts ONLY
--     payment_status='paid'; unpaid/cancelled/refunded are separate buckets.
--   * gross_sales = sum(subtotal) non-cancelled (before discount)
--   * net_sales   = sum(total_amount) non-cancelled (after discount+fee)
--   * reconciliation is by payment_method over PAID orders only
--   * estimated profit is NOT computed here (cost data incomplete —
--     never derive profit from data that does not exist)
-- ============================================================

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
  IF NOT (public.is_admin() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

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
REVOKE EXECUTE ON FUNCTION public.get_daily_sales FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_sales TO authenticated;

-- ---------- daily_closings ----------
CREATE TABLE IF NOT EXISTS public.daily_closings (
  business_date   DATE PRIMARY KEY,
  closed_by       TEXT,
  closed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload         JSONB NOT NULL,
  gross_sales     NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_sales       NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  unpaid_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  refunded_amount NUMERIC(14,2) NOT NULL DEFAULT 0
);

ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_closings_staff_select ON public.daily_closings;
CREATE POLICY daily_closings_staff_select ON public.daily_closings FOR SELECT USING (public.is_staff());

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
  IF NOT (public.is_admin() OR public.is_staff()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
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
REVOKE EXECUTE ON FUNCTION public.close_day FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_day TO authenticated;

-- ========== CONTRACT NOTES (130) ==========
-- * get_daily_sales is read-only (STABLE) and role-gated (admin/staff).
-- * close_day is idempotent per date (PK upsert) — re-running re-derives the
--   same numbers from canonical orders; audit trail records every close.
-- * NO cost/profit estimation here on purpose (Owner rule: no invented data).