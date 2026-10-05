-- ============================================
-- Bite Me Baby — Migration 115: Web Push (W3-D-7 unlock)
-- Date: 2026-10-05 · Baseline: d6c9046 · Owner directive: notification transports
--   = Web Push + SMS (no hardcode — everything admin-configurable)
--
-- WHY:
--   W3-D-7 was STOP (no VAPID keys, no subscription storage). The Owner has now
--   selected Web Push as one of the two customer-facing transports, so the
--   storage + permission + dispatch boundary is added here.
--
-- DESIGN (server-authoritative, matches W3-D precedent):
--   1. push_subscriptions is keyed to public.customers(id) — the SAME canonical
--      recipient id used by notifications (migration 021). No second identity
--      system, no PII beyond an opaque endpoint token.
--   2. The client NEVER supplies a customer id. register_push_subscription
--      resolves auth.uid() -> customers.id server-side (SECURITY DEFINER),
--      so a user can never write a subscription onto someone else's account.
--   3. VAPID public key is admin-configurable (business_settings.push_config)
--      and is PUBLIC by design; the private key NEVER enters the database —
--      it lives only in the push-send Edge Function secret.
--   4. Transport opt-out is separate from the notification CATEGORY contract
--      (Transactional/Marketing/Bite/Operational — frozen in migration 021):
--      new push_enabled / sms_enabled flags, new RPCs. Migration 021 untouched.
--   5. Stale endpoints are pruned by the Edge Function via mark_push_result —
--      dead endpoints must not accumulate.
-- ============================================

-- ============================================
-- 1. push_subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL UNIQUE,           -- opaque push-service URL token
  p256dh          TEXT NOT NULL,                  -- client public key (NOT secret)
  auth_secret     TEXT NOT NULL,                  -- client auth secret (per-device)
  user_agent      TEXT,
  failure_count   INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_customer_idx
  ON public.push_subscriptions (customer_id);

-- Bound an outage: an endpoint that keeps failing stops being retried.
CREATE INDEX IF NOT EXISTS push_subscriptions_active_idx
  ON public.push_subscriptions (customer_id, updated_at DESC)
  WHERE failure_count < 10;

-- ============================================
-- 2. Transport preferences (additive — NOT the 021 category contract)
-- ============================================
ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_enabled  BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================
-- 3. Admin-configurable push settings (VAPID PUBLIC key only)
-- ============================================
INSERT INTO public.business_settings (key, value)
VALUES (
  'push_config',
  '{"enabled": true, "vapid_public_key": "", "vapid_subject": "mailto:admin@biteme-baby.com"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 4. RLS
-- ============================================
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Deny anon entirely: an endpoint must never be enumerable by an unauthenticated caller.
DROP POLICY IF EXISTS push_subs_deny_anon ON public.push_subscriptions;
CREATE POLICY push_subs_deny_anon ON public.push_subscriptions
  FOR ALL TO anon USING (false);

-- Own rows only (resolved through the customers link, same rule as notifications).
DROP POLICY IF EXISTS push_subs_own_read ON public.push_subscriptions;
CREATE POLICY push_subs_own_read ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- No direct INSERT/UPDATE/DELETE policies: writes go through the SECURITY DEFINER
-- RPCs below so that customer_id is always resolved server-side.
DROP POLICY IF EXISTS push_subs_admin_read ON public.push_subscriptions;
CREATE POLICY push_subs_admin_read ON public.push_subscriptions
  FOR SELECT TO authenticated USING (public.is_admin());

-- ============================================
-- 5. RPCs
-- ============================================

-- 5.1 register_push_subscription: resolve recipient server-side, upsert by endpoint.
--     Re-subscribing the same endpoint is idempotent (same device, new keys).
CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint    text,
  p_p256dh      text,
  p_auth_secret text,
  p_user_agent  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid;
  v_customer text;
  v_id       text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  IF p_endpoint IS NULL OR length(trim(p_endpoint)) < 8 THEN
    RAISE EXCEPTION 'ERR_INVALID_ENDPOINT';
  END IF;
  IF p_p256dh IS NULL OR p_auth_secret IS NULL THEN
    RAISE EXCEPTION 'ERR_INVALID_KEYS';
  END IF;

  -- canonical recipient (mirrors notification_dispatch identity resolution)
  SELECT id INTO v_customer FROM public.customers WHERE user_id = v_uid;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'ERR_NO_CUSTOMER_PROFILE'; END IF;

  SELECT id INTO v_id FROM public.push_subscriptions WHERE endpoint = p_endpoint;

  IF v_id IS NULL THEN
    v_id := 'push-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
                 || '-' || substr(md5(random()::text), 1, 6);
    INSERT INTO public.push_subscriptions
      (id, customer_id, endpoint, p256dh, auth_secret, user_agent, failure_count)
    VALUES
      (v_id, v_customer, p_endpoint, p_p256dh, p_auth_secret, left(coalesce(p_user_agent, ''), 300), 0);
  ELSE
    UPDATE public.push_subscriptions
       SET customer_id   = v_customer,
           p256dh        = p_p256dh,
           auth_secret   = p_auth_secret,
           user_agent    = left(coalesce(p_user_agent, ''), 300),
           failure_count = 0,          -- a fresh subscribe proves the endpoint is alive
           last_failure_at = NULL,
           updated_at    = NOW()
     WHERE id = v_id;
  END IF;

  -- Registering an endpoint implies the customer wants push transport.
  UPDATE public.notification_prefs
     SET push_enabled = TRUE, updated_at = NOW()
   WHERE customer_id = v_customer;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'customer_id', v_customer);
END;
$$;

-- 5.2 unregister_push_subscription: own endpoint only.
CREATE OR REPLACE FUNCTION public.unregister_push_subscription(
  p_subscription_id text DEFAULT NULL,
  p_endpoint        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid;
  v_customer  text;
  v_removed   integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT id INTO v_customer FROM public.customers WHERE user_id = v_uid;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'ERR_NO_CUSTOMER_PROFILE'; END IF;

  DELETE FROM public.push_subscriptions
   WHERE customer_id = v_customer
     AND ( (p_subscription_id IS NOT NULL AND id = p_subscription_id)
        OR (p_endpoint        IS NOT NULL AND endpoint = p_endpoint) );

  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- Last endpoint gone -> the customer no longer wants push.
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE customer_id = v_customer) THEN
    UPDATE public.notification_prefs
       SET push_enabled = FALSE, updated_at = NOW()
     WHERE customer_id = v_customer;
  END IF;

  RETURN jsonb_build_object('ok', true, 'removed', v_removed);
END;
$$;

-- 5.3 set_push_transport_pref (sibling of set_notification_pref — transport, not category).
CREATE OR REPLACE FUNCTION public.set_push_transport_pref(
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid;
  v_customer text;
  v_has_sub  boolean;
  v_enabled  boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT id INTO v_customer FROM public.customers WHERE user_id = v_uid;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'ERR_NO_CUSTOMER_PROFILE'; END IF;

  -- Cannot enable a transport with no registered device endpoint.
  SELECT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE customer_id = v_customer)
    INTO v_has_sub;
  IF p_enabled AND NOT v_has_sub THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ERR_NO_SUBSCRIPTION', 'push_enabled', false);
  END IF;

  v_enabled := COALESCE(p_enabled, false);

  INSERT INTO public.notification_prefs (customer_id, channels, push_enabled, updated_at)
  VALUES (v_customer,
          '{"Transactional":true,"Marketing":true,"Bite":true,"Operational":true}'::jsonb,
          v_enabled, NOW())
  ON CONFLICT (customer_id) DO UPDATE
    SET push_enabled = EXCLUDED.push_enabled, updated_at = NOW();

  RETURN jsonb_build_object('ok', true, 'push_enabled', v_enabled);
END;
$$;

-- 5.4 list_my_push_subscriptions — own devices only (no endpoint tokens returned).
CREATE OR REPLACE FUNCTION public.list_my_push_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid;
  v_customer text;
  v_rows     jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  SELECT id INTO v_customer FROM public.customers WHERE user_id = v_uid;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'ERR_NO_CUSTOMER_PROFILE'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', id,
           'created_at', created_at,
           'last_success_at', last_success_at,
           'user_agent', user_agent
         ) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM public.push_subscriptions
   WHERE customer_id = v_customer;

  RETURN jsonb_build_object('ok', true, 'subscriptions', v_rows);
END;
$$;

-- 5.5 claim_push_targets — service_role ONLY. Returns full endpoints for the
--     Edge Function (the endpoint token IS the addressing mechanism; it must
--     never be exposed to a non-service-role caller).
CREATE OR REPLACE FUNCTION public.claim_push_targets(
  p_customer_id text,
  p_limit       integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'ERR_INVALID_CUSTOMER';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', id, 'endpoint', endpoint,
           'p256dh', p256dh, 'auth_secret', auth_secret
         )), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT id, endpoint, p256dh, auth_secret
        FROM public.push_subscriptions
       WHERE customer_id = p_customer_id
         AND failure_count < 10
       ORDER BY updated_at DESC
       LIMIT GREATEST(1, LEAST(50, p_limit))
    ) s;

  RETURN jsonb_build_object('ok', true, 'targets', v_rows);
END;
$$;

-- 5.6 mark_push_result — service_role ONLY. Terminal statuses prune the endpoint.
CREATE OR REPLACE FUNCTION public.mark_push_result(
  p_subscription_id text,
  p_success         boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pruned boolean := false;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  IF p_success THEN
    UPDATE public.push_subscriptions
       SET failure_count = 0,
           last_success_at = NOW(),
           last_failure_at = NULL,
           updated_at = NOW()
     WHERE id = p_subscription_id;
  ELSE
    UPDATE public.push_subscriptions
       SET failure_count = failure_count + 1,
           last_failure_at = NOW(),
           updated_at = NOW()
     WHERE id = p_subscription_id;

    -- A dead endpoint is dead: stop retrying and stop storing it.
    IF (SELECT failure_count FROM public.push_subscriptions WHERE id = p_subscription_id) >= 5 THEN
      DELETE FROM public.push_subscriptions WHERE id = p_subscription_id;
      v_pruned := true;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'pruned', v_pruned);
END;
$$;

-- 5.7 get_push_config — PUBLIC read of the admin-configured settings.
--     Only non-secret fields are exposed (the private key is never stored here).
CREATE OR REPLACE FUNCTION public.get_push_config()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'enabled',          COALESCE((value->>'enabled')::boolean, false),
      'vapid_public_key', COALESCE(value->>'vapid_public_key', ''),
      'vapid_subject',    COALESCE(value->>'vapid_subject', '')
    )
    FROM public.business_settings WHERE key = 'push_config'
  ), jsonb_build_object('enabled', false, 'vapid_public_key', '', 'vapid_subject', ''));
$$;

-- Grants: customer-facing RPCs to authenticated; service-role-only RPCs stay closed.
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_subscription(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_push_transport_pref(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_push_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_config() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_targets(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_push_result(text, boolean) TO service_role;

-- read own table rows (writes are RPC-only by design)
GRANT SELECT ON public.push_subscriptions TO authenticated;