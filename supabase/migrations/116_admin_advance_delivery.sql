-- ============================================
-- Bite Me Baby — Migration 116: admin close-the-loop on delivery (GAP A-1)
-- Date: 2026-10-05 · Baseline: 4e3f92e
--
-- WHY (acceptance bar item 5 — "Admin คุมทุกขั้นตอน"):
--   The ONLY path that advances in_transit -> arrived -> delivered is
--   driver_update_delivery_status (migration 041), which is driver-identity
--   gated (drivers.user_id = auth.uid()). If the rider never taps, the order is
--   stranded in in_transit forever and the ADMIN UI cannot close the loop —
--   the admin can only watch it. This RPC gives the admin the same authority,
--   under the same forward-only hop rules and with an audit trail.
--
-- DESIGN (mirrors migration 041, no new authority semantics):
--   1. is_admin() gated — never callable by anon/customer.
--   2. Same allow-list: picked_up | in_transit | delivered.
--   3. Resolves the ACTIVE assignment for the order (any driver — the admin is
--      not identity-bound like the driver RPC).
--   4. Same forward-only hop chain through order_transition_allowed, so no
--      business rule can be bypassed (identical to 041).
--   5. Same audit trail via append_audit_log, source-tagged so an admin action
--      is distinguishable from a rider action in every report.
--   6. DELIVERED releases the driver back to 'available' (same as 041).
--
-- NOT in scope: geolocation/POD enforcement. The rider PWA keeps its stricter
-- gate; this path is the admin override and is audit-labelled as such.
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_advance_delivery_status(
  p_order_number text,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_cur text;            -- assignment status
  v_drv_id text;
  v_order_status text;
  v_target text;
  v_hop_from text;
  v_hop_to text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  IF p_status NOT IN ('picked_up', 'in_transit', 'delivered') THEN
    RAISE EXCEPTION 'ERR_INVALID_DELIVERY_STATUS';
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_INVALID_ORDER';
  END IF;

  -- The admin is identity-free here: resolve the CURRENT assignment for this
  -- order (latest non-terminal one), not one bound to auth.uid().
  SELECT a.driver_id, a.status
    INTO v_drv_id, v_cur
    FROM public.delivery_assignments a
   WHERE a.order_number = p_order_number
     AND a.status <> 'cancelled'
   ORDER BY a.updated_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_FOUND: no active assignment for %', p_order_number;
  END IF;
  IF v_cur = 'delivered' THEN RAISE EXCEPTION 'ERR_ALREADY_DELIVERED'; END IF;

  -- Order-status targets are the same mapping used by the driver RPC (041).
  v_target := CASE p_status
                WHEN 'picked_up'  THEN 'dispatched'
                WHEN 'in_transit' THEN 'in_transit'
                WHEN 'delivered'  THEN 'delivered'
              END;

SELECT status INTO v_order_status FROM public.orders
   WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  IF v_order_status NOT IN ('cancelled', 'failed', 'delivered') THEN
    PERFORM set_config('app.delivery_sync_order', p_order_number, true);

    v_hop_from := v_order_status;
    WHILE v_hop_from <> v_target LOOP
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
        p_description := 'admin delivery sync ' || v_hop_from || ' -> ' || v_hop_to,
        p_metadata := jsonb_build_object('from', v_hop_from, 'to', v_hop_to,
          'assignment_driver_id', v_drv_id, 'source', 'admin_advance_delivery_status',
          'admin_user_id', v_uid::text)
      );

      v_hop_from := v_hop_to;
    END LOOP;
  END IF;

  UPDATE public.delivery_assignments
     SET status = p_status,
         picked_up_at  = CASE WHEN p_status = 'picked_up'  THEN COALESCE(picked_up_at, NOW())  ELSE picked_up_at END,
         in_transit_at = CASE WHEN p_status = 'in_transit' THEN COALESCE(in_transit_at, NOW()) ELSE in_transit_at END,
         delivered_at  = CASE WHEN p_status = 'delivered'  THEN COALESCE(delivered_at, NOW())  ELSE delivered_at END,
         updated_at = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv_id;

  UPDATE public.drivers
     SET last_seen_at = NOW(), updated_at = NOW(),
         status = CASE WHEN p_status = 'delivered' THEN 'available' ELSE 'busy' END
   WHERE id = v_drv_id;

  RETURN jsonb_build_object(
    'ok', true,
    'order_number', p_order_number,
    'assignment_status', p_status,
    'order_status', v_target,
    'driver_id', v_drv_id,
    'driver_released', (p_status = 'delivered')
  );
END;
$$;

-- Admin-only surface (client calls through the authenticated JWT).
GRANT EXECUTE ON FUNCTION public.admin_advance_delivery_status(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_advance_delivery_status(text, text) FROM anon;