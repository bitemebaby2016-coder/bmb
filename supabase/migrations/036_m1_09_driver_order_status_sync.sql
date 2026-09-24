-- ============================================
-- Bite Me Baby — Migration 036: M1-09 driver delivery status → canonical orders.status sync
-- Date: 2026-09-24 · Baseline: e118c47 · Approved: Owner (M1-09 DEFECT RESOLUTION COMMAND)
--
-- WHY (evidence):
--   driver_update_delivery_status (020 L709-761) updates delivery_assignments +
--   drivers + audit_log but NEVER orders.status. Delivery lifecycle
--   (picked_up/in_transit/delivered) therefore never advances the canonical
--   order state machine — orders can never reach 'delivered' from the rider path.
--
-- AFFECTED TABLES: orders (status only), delivery_assignments (unchanged semantics),
--   drivers (unchanged), audit_logs (+ rows).
--
-- DESIGN (no second state machine):
--   assignment status → explicit mapping → canonical allow-list (Migr 030) → orders.status
--     picked_up  → dispatched   (hop ready_for_dispatch → dispatched)
--     in_transit → in_transit   (hop dispatched → in_transit)
--     delivered  → delivered    (canonical chain: in_transit → arrived → delivered)
--   Every hop is validated with public.order_transition_allowed(p_from,p_to,true,false)
--   — the SAME allow-list used by transition_order_status and the 008 guard trigger.
--
-- GUARD COEXISTENCE:
--   guard_order_status_transition (008) recomputes is_admin() from the CALLER's JWT.
--   A driver is not admin, so even a SECURITY DEFINER sync would be rejected.
--   Fix: the sync sets transaction-local GUC 'app.delivery_sync_order' = order_number
--   (set_config ..., true = transaction-local, auto-cleared). The guard now accepts a
--   transition ONLY when that GUC matches the row AND order_transition_allowed(...)
--   (canonical rules, unchanged) passes. The allow-list remains the single source of
--   truth — this changes WHO may transition (trusted definer sync), never WHAT may
--   transition. Spoof safety: non-admin callers have NO RLS UPDATE policy on orders
--   (005/014 verified), so a hand-set GUC cannot be used to mutate orders directly.
--
-- SECURITY IMPACT: none — no new grants, no RLS change, function stays SECURITY
--   DEFINER with SET search_path = public, EXECUTE remains authenticated-only.
--
-- ROLLBACK / SAFETY: single transaction; CREATE OR REPLACE only; re-run safe.
--   Rollback = re-apply 020 body of driver_update_delivery_status + 008 guard body
--   (pre-036), then this migration is a no-op.
--
-- DEPENDENCIES: 020 (function/tables), 008 (guard), 030 (allow-list ELSE).
-- PRODUCTION VERIFICATION: e2e/contracts_036_driver_status_sync.sql (BEGIN...ROLLBACK).
-- ============================================

BEGIN;

-- ============================================
-- 1. Guard: recognize the trusted delivery-sync context (rules unchanged)
-- ============================================
CREATE OR REPLACE FUNCTION public.guard_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_owner boolean;
  v_delivery_sync text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- M1-09: trusted server-side delivery sync (set ONLY by
    -- driver_update_delivery_status, transaction-local). The transition itself
    -- is still validated against the canonical allow-list below — same rules
    -- as the admin branch. No bypass of order_transition_allowed.
    v_delivery_sync := NULLIF(current_setting('app.delivery_sync_order', true), '');
    IF v_delivery_sync IS NOT NULL AND v_delivery_sync = OLD.order_number::text THEN
      IF public.order_transition_allowed(OLD.status::text, NEW.status::text, true, false) THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'FORBIDDEN: delivery sync transition % -> % not allowed by canonical state machine',
        OLD.status::text, NEW.status::text;
    END IF;

    v_is_admin := public.is_admin();
    v_is_owner := (OLD.customer_ref IS NOT NULL AND OLD.customer_ref = auth.uid());
    IF NOT public.order_transition_allowed(OLD.status::text, NEW.status::text, v_is_admin, v_is_owner) THEN
      RAISE EXCEPTION 'FORBIDDEN: invalid order status transition % -> %',
        OLD.status::text,
        NEW.status::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. driver_update_delivery_status — preserve existing behavior + sync orders.status
--    (full body re-declared: identical logic to 020 plus the sync block)
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_update_delivery_status(
  p_order_number text,
  p_driver_phone text,
  p_status text,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
  v_cur text;
  v_order_status text;
  v_target text;
  v_hop_from text;
  v_hop_to text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF p_status NOT IN ('picked_up', 'in_transit', 'delivered') THEN
    RAISE EXCEPTION 'ERR_INVALID_DELIVERY_STATUS';
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' OR p_driver_phone IS NULL OR trim(p_driver_phone) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;
  SELECT * INTO v_drv FROM public.drivers WHERE phone = trim(p_driver_phone);
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_DRIVER_NOT_FOUND'; END IF;

  SELECT status INTO v_cur FROM public.delivery_assignments
   WHERE order_number = p_order_number AND driver_id = v_drv.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_FOUND'; END IF;
  IF v_cur = 'delivered' THEN RAISE EXCEPTION 'ERR_ALREADY_DELIVERED'; END IF;

  -- ============================================
  -- M1-09: sync canonical orders.status (forward-only, allow-list validated)
  -- ============================================
  v_target := CASE p_status
                WHEN 'picked_up'  THEN 'dispatched'
                WHEN 'in_transit' THEN 'in_transit'
                WHEN 'delivered'  THEN 'delivered'
              END;

  SELECT status INTO v_order_status FROM public.orders
   WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  IF v_order_status NOT IN ('cancelled', 'failed', 'delivered') THEN
    -- transaction-local trusted context (auto-cleared at txn end)
    PERFORM set_config('app.delivery_sync_order', p_order_number, true);

    v_hop_from := v_order_status;
    WHILE v_hop_from <> v_target LOOP
      -- forward-only walk along the canonical delivery tail
      v_hop_to := CASE v_hop_from
                    WHEN 'ready_for_dispatch' THEN 'dispatched'
                    WHEN 'dispatched'         THEN 'in_transit'
                    WHEN 'in_transit'         THEN 'arrived'
                    WHEN 'arrived'            THEN 'delivered'
                  END;
      IF v_hop_to IS NULL
         OR NOT public.order_transition_allowed(v_hop_from, v_hop_to, true, false) THEN
        RAISE EXCEPTION 'ERR_DELIVERY_SYNC_BLOCKED: order % cannot advance % -> % (target %)',
          p_order_number, v_hop_from, v_hop_to, v_target;
      END IF;

      UPDATE public.orders SET status = v_hop_to::public.order_status, updated_at = NOW()
       WHERE order_number = p_order_number;

      PERFORM public.append_audit_log(
        p_action := 'order_status_change',
        p_entity_type := 'order',
        p_entity_id := p_order_number,
        p_description := 'delivery sync ' || v_hop_from || ' -> ' || v_hop_to || ' (driver ' || v_drv.id || ')',
        p_metadata := jsonb_build_object('from', v_hop_from, 'to', v_hop_to,
                                         'driver_id', v_drv.id, 'source', 'driver_update_delivery_status')
      );

      v_hop_from := v_hop_to;
    END LOOP;
  END IF;
  -- terminal (cancelled/failed/delivered) orders: skip sync — no backward move,
  -- no state corruption; assignment behavior below preserved exactly as in 020.


  -- ============================================
  -- EXISTING BEHAVIOR (020, preserved verbatim)
  -- ============================================
  UPDATE public.delivery_assignments
     SET status = p_status,
         picked_up_at  = CASE WHEN p_status = 'picked_up'  THEN COALESCE(picked_up_at, NOW())  ELSE picked_up_at END,
         in_transit_at = CASE WHEN p_status = 'in_transit' THEN COALESCE(in_transit_at, NOW()) ELSE in_transit_at END,
         delivered_at  = CASE WHEN p_status = 'delivered'  THEN COALESCE(delivered_at, NOW())  ELSE delivered_at END,
         updated_at = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv.id;

  UPDATE public.drivers
     SET current_latitude = COALESCE(p_latitude, current_latitude),
         current_longitude = COALESCE(p_longitude, current_longitude),
         last_seen_at = NOW(), updated_at = NOW(),
         status = CASE WHEN p_status = 'delivered' THEN 'available' ELSE 'busy' END
    WHERE id = v_drv.id;

  PERFORM public.append_audit_log('delivery_status_change', 'delivery', p_order_number, 'rider set ' || p_status, jsonb_build_object('status', p_status, 'driver', v_drv.id));
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', p_status);
END;
$$;

-- Grants preserved explicitly (033/034 ACL baseline: authenticated only, never PUBLIC)
REVOKE EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) TO authenticated;

COMMIT;

-- ============================================
-- END OF MIGRATION 036
-- ============================================

