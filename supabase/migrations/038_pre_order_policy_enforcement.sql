-- ============================================
-- Bite Me Baby â€” Migration 038: PRE_ORDER policy enforcement (PRE-04)
-- Date: 2026-09-24 Â· Baseline: b8c1c21 Â· Source: docs/BMB_PRE01_OWNER_DECISION_GATE_2026-09-24.md
-- Owner decisions (2026-09-24):
--   Q1 window   : future days allowed, max_preorder_days = 40 (configurable via
--                 business_settings 'preorder_max_days'; owner note: pre-order menu is
--                 published weekly, 2 menus/day â€” menu scheduling is a separate workstream)
--   Q1 cutoff   : order for a scheduled date closes 2 HOURS BEFORE that round's
--                 delivery_start (rounds: 07:00-09:00 / 11:00-13:00 / 18:00-20:00)
--   Q2 cancel   : cancel allowed ONLY before that cutoff; after â†’ ERR_CANCEL_AFTER_CUTOFF
--   Q2 refund   : NO refund on cancellation (option 2C) â€” payment_status untouched,
--                 no next-round transfer (no refund path added)
--   Q3 deduct   : at order CONFIRMED â€” existing canonical mechanism (019/028: aggregated
--                 deduct at confirm + restore on cancel/failed, 026 atomicity) ALREADY
--                 covers canonical PRE_ORDER rows â†’ no new deduct logic
--
-- WHY triggers, not rewriting 025 bodies:
--   one enforcement point covering BOTH creation paths (canonical RPC + future channel
--   intake) and cancellation, without touching the proven 025 function bodies.
--
-- AFFECTED TABLES: none (trigger functions + 1 settings row only).
-- SECURITY IMPACT: none â€” server-side triggers, no grants, no RLS change.
-- ROLLBACK: drop 2 triggers + 2 functions + settings row; re-run safe.
-- DEPENDENCIES: 025 (canonical RPC + order_setting), 024 (rounds templates).
-- VERIFICATION: e2e/contracts_038_pre_order_policy.sql (BEGIN...ROLLBACK on production).
-- ============================================

BEGIN;

-- ============================================
-- Part 1. Settings â€” preorder_max_days (owner value: 40)
-- Convention: policy fields live in business_settings key='order_policy'
-- (read via public.order_setting). Merge JSONB so existing keys are preserved.
-- Guarded by NOT value?'preorder_max_days' â†’ never overwrites owner's manual edits.
-- ============================================
UPDATE public.business_settings
   SET value = value || '{"preorder_max_days": 40}'::jsonb,
       updated_at = NOW()
 WHERE key = 'order_policy'
   AND NOT (value ? 'preorder_max_days');

INSERT INTO public.business_settings (key, value)
SELECT 'order_policy', '{"preorder_max_days": 40}'::jsonb
 WHERE NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'order_policy');


-- ============================================
-- Part 2. Creation window + 2h pre-delivery cutoff (PRE_ORDER only)
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_pre_order_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today     date;
  v_now_ts    timestamp;
  v_max_days  integer;
  v_start     time;
  v_cutoff_ts timestamp;
BEGIN
  IF NEW.order_mode::text <> 'PRE_ORDER' THEN
    RETURN NEW;
  END IF;

  v_today  := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now_ts := (now() AT TIME ZONE 'Asia/Bangkok')::timestamp;

  -- scheduled_date must be strictly future (today/past pre-orders rejected)
  IF NEW.scheduled_date IS NULL OR NEW.scheduled_date <= v_today THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_DATE_INVALID';
  END IF;

  -- owner decision Q1: max window (business_settings, default 40)
  v_max_days := COALESCE(public.order_setting('preorder_max_days', 40), 40);
  IF (NEW.scheduled_date - v_today) > v_max_days THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_DATE_TOO_FAR: max % days ahead', v_max_days;
  END IF;

  -- owner decision Q1 cutoff: closes 2h before the round's delivery_start
  SELECT COALESCE(delivery_start, cutoff_time) INTO v_start
    FROM public.delivery_rounds
   WHERE id = NEW.delivery_round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;
  IF v_start IS NULL THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
  END IF;

  v_cutoff_ts := NEW.scheduled_date::timestamp + (v_start - interval '2 hours');
  IF v_now_ts > v_cutoff_ts THEN
    RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_PASSED: closes %', v_cutoff_ts;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_pre_order_window() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pre_order_window ON public.orders;
CREATE TRIGGER trg_pre_order_window
  BEFORE INSERT OR UPDATE OF order_mode, scheduled_date, delivery_round_id ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pre_order_window();


-- ============================================
-- Part 3. Cancel-after-cutoff (owner decision Q2/A â€” flat rule, both roles)
-- capacity release + inventory restore + assignment cancel are handled by the
-- existing cancel_order flow / release_round_capacity_on_terminal trigger.
-- Payment is NOT refunded (2C) â€” no refund path added.
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_pre_order_cancel_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start     time;
  v_cutoff_ts timestamp;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
     AND OLD.order_mode::text = 'PRE_ORDER' THEN

    SELECT COALESCE(delivery_start, cutoff_time) INTO v_start
      FROM public.delivery_rounds
     WHERE id = OLD.delivery_round_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'; END IF;

    IF v_start IS NULL THEN
      RAISE EXCEPTION 'ERR_PRE_ORDER_CUTOFF_UNKNOWN';
    END IF;

    v_cutoff_ts := OLD.scheduled_date::timestamp + (v_start - interval '2 hours');
    IF (now() AT TIME ZONE 'Asia/Bangkok')::timestamp > v_cutoff_ts THEN
      RAISE EXCEPTION 'ERR_CANCEL_AFTER_CUTOFF: closed at %', v_cutoff_ts;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_pre_order_cancel_window() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pre_order_cancel_window ON public.orders;
CREATE TRIGGER trg_pre_order_cancel_window
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pre_order_cancel_window();

COMMIT;

-- ============================================
-- END OF MIGRATION 038
-- ============================================

