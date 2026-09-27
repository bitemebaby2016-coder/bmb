-- ============================================
-- Bite Me Baby — Migration 041: DRIVER IDENTITY — SUPABASE AUTH JWT BINDING
-- (F-06 · WAVE 2-B)
-- Date: 2026-09-27 · Baseline: 7341b40 · Scope: Wave 2 (F-06 only)
--
-- WHY (F-06 = BROKEN, Reality Freeze + Owner Decision 06):
--   driver_login (020) self-upserts a driver identity from a client-supplied
--   phone → anyone can impersonate a rider. Phone/name/driver_id from the
--   request body are NOT trusted identity material.
--
-- OWNER DECISION 06 (locked): Supabase Auth is the identity authority.
--   auth.users.id → drivers.user_id → driver-scoped RLS/RPC.
--
-- CHANGE (no destructive DDL):
--   1. drivers.user_id (UNIQUE, FK auth.users, ON DELETE SET NULL)
--   2. RLS: drivers read scoped (own row OR admin) — replaces read-all-for-all;
--      delivery_assignments read scoped to the JWT-bound driver OR admin.
--   3. All driver RPCs resolve identity via auth.uid() → drivers.user_id.
--      Legacy phone parameters are kept for wire compatibility but are IGNORED
--      for identity (JWT WINS — spoof test Case E). A caller with a valid JWT
--      that is NOT linked to a driver row is rejected (ERR_NOT_A_DRIVER).
--   4. driver_login(p_display_name): returns the JWT-bound driver only;
--      self-registration by phone is REMOVED (provisioning = admin links an
--      existing auth user via link_driver_user, or an auth user signs up and
--      admin links the account. SMS OTP infra does not exist — reported gap).
--   5. link_driver_user(p_driver_id, p_user_id): admin-only provisioning RPC.
--
-- GRANTS: unchanged (authenticated only, never PUBLIC) — 033/034 ACL baseline.
-- SAFETY: single transaction, CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS only.
--   Rollback: re-apply 020/036 function bodies + 020 policies + drop column.
-- DEPENDENCIES: 020 (tables/RPCs) · 005/006 (is_admin) · 030 (allow-list) · 036 (sync).
-- ============================================

BEGIN;

-- ============================================
-- 1. drivers.user_id — canonical identity link
-- ============================================
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_drivers_user ON public.drivers (user_id);

-- ============================================
-- 2. RLS — Driver Scoped / Admin Only (Owner intent, F-18)
-- ============================================
DROP POLICY IF EXISTS drivers_auth_read ON public.drivers;
CREATE POLICY drivers_scoped_read ON public.drivers
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS assignments_auth_read ON public.delivery_assignments;
CREATE POLICY assignments_scoped_read ON public.delivery_assignments
  FOR SELECT TO authenticated
  USING (public.is_admin() OR driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- ============================================
-- 3. driver_login — JWT-bound only (self-upsert by phone REMOVED)
--    Old signature driver_login(text, text) is dropped.
-- ============================================
DROP FUNCTION IF EXISTS public.driver_login(text, text);
CREATE OR REPLACE FUNCTION public.driver_login(
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;

  -- Identity = JWT ONLY. Phone/name/driver_id from the client are NOT trusted.
  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERR_NOT_A_DRIVER: no driver record is linked to this account (admin provisioning required)';
  END IF;

  UPDATE public.drivers
     SET status = CASE WHEN status = 'busy' THEN 'busy' ELSE 'available' END,
         last_seen_at = NOW(), updated_at = NOW()
   WHERE id = v_drv.id
   RETURNING * INTO v_drv;

  RETURN jsonb_build_object('ok', true, 'driver', to_jsonb(v_drv));
END;
$$;

-- ============================================
-- 4. link_driver_user — admin provisioning (Owner Decision 06)
--    Admin creates the Supabase Auth user (Dashboard/Admin API), then links it.
--    p_user_id NULL = unlink.
-- ============================================
CREATE OR REPLACE FUNCTION public.link_driver_user(
  p_driver_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF p_driver_id IS NULL OR trim(p_driver_id) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;
  IF p_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'ERR_USER_NOT_FOUND';
  END IF;
  IF p_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.drivers WHERE user_id = p_user_id AND id <> p_driver_id) THEN
      RAISE EXCEPTION 'ERR_USER_ALREADY_LINKED';
    END IF;
  END IF;

  UPDATE public.drivers SET user_id = p_user_id, updated_at = NOW()
   WHERE id = p_driver_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_DRIVER_NOT_FOUND'; END IF;

  RETURN jsonb_build_object('ok', true, 'driver_id', p_driver_id, 'user_id', p_user_id);
END;
$$;


-- ============================================
-- 5. Driver operation RPCs — identity resolved via auth.uid() → drivers.user_id
--    Legacy p_driver_phone params kept for wire compatibility but IGNORED
--    (JWT WINS — spoof test Case E). Server-side contexts (no JWT) keep the
--    020/036 allowance for SQL Editor / db push QA only.
-- ============================================
CREATE OR REPLACE FUNCTION public.driver_accept_assignment(
  p_order_number text,
  p_driver_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_drv public.drivers%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  UPDATE public.delivery_assignments
     SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW()), updated_at = NOW()
   WHERE order_number = p_order_number AND driver_id = v_drv.id AND status = 'assigned';
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_ACCEPTABLE'; END IF;

  UPDATE public.drivers SET status = 'busy', last_seen_at = NOW(), updated_at = NOW() WHERE id = v_drv.id;
  RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'status', 'accepted');
END;
$$;

CREATE OR REPLACE FUNCTION public.my_deliveries(
  p_driver_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid;
  v_drv  public.drivers%ROWTYPE;
  v_rows jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  SELECT jsonb_agg(x) INTO v_rows FROM (
    SELECT da.order_number, da.status AS assignment_status, da.assigned_at, da.accepted_at,
           o.dropoff_detail, o.dropoff_latitude, o.dropoff_longitude,
           o.status AS order_status, o.total_amount, o.payment_status,
           o.payment_method,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity)), '[]'::jsonb)
              FROM public.order_items oi WHERE oi.order_id = o.id) AS items
      FROM public.delivery_assignments da
      JOIN public.orders o ON o.order_number = da.order_number
     WHERE da.driver_id = v_drv.id
       AND da.status <> 'cancelled'
     ORDER BY da.assigned_at DESC
  ) x;

  RETURN jsonb_build_object('ok', true, 'driver', to_jsonb(v_drv), 'assignments', COALESCE(v_rows, '[]'::jsonb));
END;
$$;


-- ============================================
-- 6. driver_update_delivery_status — 036 body preserved verbatim EXCEPT the
--    identity resolution (JWT-bound instead of client-supplied phone).
--    The delivery-sync GUC (app.delivery_sync_order) and canonical hop
--    validation are unchanged → F-05 history trigger records DRIVER actor.
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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  IF p_status NOT IN ('picked_up', 'in_transit', 'delivered') THEN
    RAISE EXCEPTION 'ERR_INVALID_DELIVERY_STATUS';
  END IF;
  IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO';
  END IF;

  -- F-06: identity = JWT ONLY (p_driver_phone is ignored — spoof-safe)
  SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'; END IF;

  SELECT status INTO v_cur FROM public.delivery_assignments
   WHERE order_number = p_order_number AND driver_id = v_drv.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_FOUND'; END IF;
  IF v_cur = 'delivered' THEN RAISE EXCEPTION 'ERR_ALREADY_DELIVERED'; END IF;

  -- M1-09: sync canonical orders.status (forward-only, allow-list validated)
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
        p_description := 'delivery sync ' || v_hop_from || ' -> ' || v_hop_to || ' (driver ' || v_drv.id || ')',
        p_metadata := jsonb_build_object('from', v_hop_from, 'to', v_hop_to,
                                         'driver_id', v_drv.id, 'source', 'driver_update_delivery_status')
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

-- ============================================
-- 7. Grants — unchanged ACL baseline (authenticated only, never PUBLIC)
-- ============================================
REVOKE EXECUTE ON FUNCTION public.driver_login(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_login(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.link_driver_user(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_driver_user(text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_accept_assignment(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_accept_assignment(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_deliveries(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_deliveries(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) TO authenticated;

COMMIT;

-- ============================================
-- END OF MIGRATION 041
-- ============================================

