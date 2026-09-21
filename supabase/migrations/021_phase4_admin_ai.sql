-- ============================================
-- Bite Me Baby — Migration 021: Phase 4 (PWA + Admin + AI gate)
-- Date: 2026-09-21
-- Phase: PHASE 4
--
-- NOT-01  notifications.category (Transaction/Marketing/Bite/Operational)
--         + notification_prefs (per-customer channel on/off)
-- ADM-01  system_errors feed (client/EF record -> admin sees < 5 min)
-- ADM-07  mascot_overrides (admin swaps mascot art per role without code)
-- AI-03   ai_customer_memory (server memory per auth user, cross-device)
--
-- Security: SECURITY DEFINER + SET search_path = public; EXECUTE authenticated.
-- Idempotent: safe to re-run.
-- ============================================

BEGIN;

-- ============================================
-- 1. NOT-01: notifications.category + prefs
-- ============================================
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Transactional'
  CHECK (category IN ('Transactional', 'Marketing', 'Bite', 'Operational'));
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.notification_prefs (
  customer_id TEXT PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  channels    JSONB NOT NULL DEFAULT '{"Transactional":true,"Marketing":true,"Bite":true,"Operational":true}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. ADM-01: system_errors feed
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_errors (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL DEFAULT 'client',
  level       TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('info','warning','error','critical')),
  message     TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}',
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_errors_created ON public.system_errors (created_at DESC);

-- ============================================
-- 3. ADM-07: mascot_overrides (admin self-service art)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mascot_overrides (
  role_name    TEXT PRIMARY KEY,
  media_url    TEXT NOT NULL DEFAULT '',
  alt          TEXT NOT NULL DEFAULT '',
  updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. AI-03: ai_customer_memory (server memory per auth user)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_customer_memory (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  memory      JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Enablement
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mascot_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_customer_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS system_errors_deny_anon ON public.system_errors;
CREATE POLICY system_errors_deny_anon ON public.system_errors FOR ALL TO anon USING (false);
DROP POLICY IF EXISTS system_errors_admin_read ON public.system_errors;
CREATE POLICY system_errors_admin_read ON public.system_errors
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS mascot_overrides_anon_read ON public.mascot_overrides;
CREATE POLICY mascot_overrides_anon_read ON public.mascot_overrides FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS mascot_overrides_admin ON public.mascot_overrides;
CREATE POLICY mascot_overrides_admin ON public.mascot_overrides
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS ai_memory_deny_anon ON public.ai_customer_memory;
CREATE POLICY ai_memory_deny_anon ON public.ai_customer_memory FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS ai_memory_own_read ON public.ai_customer_memory;
CREATE POLICY ai_memory_own_read ON public.ai_customer_memory
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS ai_memory_admin_read ON public.ai_customer_memory;
CREATE POLICY ai_memory_admin_read ON public.ai_customer_memory
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS notif_prefs_deny_anon ON public.notification_prefs;
CREATE POLICY notif_prefs_deny_anon ON public.notification_prefs FOR ALL TO anon USING (false);
DROP POLICY IF EXISTS notif_prefs_own ON public.notification_prefs;
CREATE POLICY notif_prefs_own ON public.notification_prefs
  FOR ALL TO authenticated USING (customer_id = auth.uid()::text) WITH CHECK (customer_id = auth.uid()::text);
DROP POLICY IF EXISTS notif_prefs_admin ON public.notification_prefs;
CREATE POLICY notif_prefs_admin ON public.notification_prefs
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS notifications_deny_anon ON public.notifications;
CREATE POLICY notifications_deny_anon ON public.notifications FOR ALL TO anon USING (false);
DROP POLICY IF EXISTS notifications_own_read ON public.notifications;
CREATE POLICY notifications_own_read ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()) OR public.is_admin());
DROP POLICY IF EXISTS notifications_admin ON public.notifications;
CREATE POLICY notifications_admin ON public.notifications
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================
-- 5. RPCs
-- ============================================

-- NOT-01: create a notification (actor resolves target server-side; channel pref respected).
CREATE OR REPLACE FUNCTION public.create_notification(
  p_title text,
  p_message text,
  p_category text DEFAULT 'Transactional',
  p_customer_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_cust text;
  v_id text;
  v_enabled boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_category NOT IN ('Transactional','Marketing','Bite','Operational') THEN
    RAISE EXCEPTION 'ERR_INVALID_CATEGORY';
  END IF;

  IF p_customer_id IS NOT NULL AND public.is_admin() THEN
    v_cust := p_customer_id;
  ELSE
    v_cust := v_uid::text;
  END IF;

  SELECT COALESCE((channels->>p_category)::boolean, true) INTO v_enabled
    FROM public.notification_prefs WHERE customer_id = v_cust;
  IF NOT COALESCE(v_enabled, true) THEN
    RETURN jsonb_build_object('ok', true, 'id', NULL, 'suppressed', true, 'category', p_category);
  END IF;

  v_id := 'notif-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 5);
  INSERT INTO public.notifications (id, customer_id, user_id, title, message, is_read, notification_type, category, created_at)
  VALUES (v_id, v_cust, v_uid, p_title, p_message, false, p_category, p_category, NOW());

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'suppressed', false, 'category', p_category);
END;
$$;

-- NOT-01: per-channel on/off
CREATE OR REPLACE FUNCTION public.set_notification_pref(
  p_channel text,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_channels jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_channel NOT IN ('Transactional','Marketing','Bite','Operational') THEN
    RAISE EXCEPTION 'ERR_INVALID_CATEGORY';
  END IF;

  SELECT COALESCE(channels, '{"Transactional":true,"Marketing":true,"Bite":true,"Operational":true}'::jsonb)
    INTO v_channels FROM public.notification_prefs WHERE customer_id = v_uid::text;
  IF v_channels IS NULL THEN
    v_channels := '{"Transactional":true,"Marketing":true,"Bite":true,"Operational":true}'::jsonb;
  END IF;

  v_channels := jsonb_set(v_channels, ARRAY[p_channel], to_jsonb(COALESCE(p_enabled, true)));

  INSERT INTO public.notification_prefs (customer_id, channels, updated_at)
  VALUES (v_uid::text, v_channels, NOW())
  ON CONFLICT (customer_id) DO UPDATE SET channels = EXCLUDED.channels, updated_at = NOW();

  RETURN jsonb_build_object('ok', true, 'channels', v_channels);
END;
$$;

-- ADM-01: record a system error (authenticated; used by client reporter/EFs).
CREATE OR REPLACE FUNCTION public.record_system_error(
  p_message text,
  p_source text DEFAULT 'client',
  p_level text DEFAULT 'error',
  p_details jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'ERR_MISSING_MESSAGE';
  END IF;

  v_id := 'err-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 5);
  INSERT INTO public.system_errors (id, source, level, message, details, user_id, created_at)
  VALUES (v_id, COALESCE(p_source, 'client'), COALESCE(p_level, 'error'),
          left(trim(p_message), 1000), COALESCE(p_details, '{}'), v_uid, NOW());

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- ADM-01: admin reads the error feed (latest first).
CREATE OR REPLACE FUNCTION public.list_system_errors(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_rows jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  SELECT jsonb_agg(x) INTO v_rows FROM (
    SELECT id, source, level, message, details, created_at
      FROM public.system_errors ORDER BY created_at DESC LIMIT GREATEST(LEAST(p_limit, 200), 1)
  ) x;
  RETURN jsonb_build_object('ok', true, 'errors', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

-- AI-03: save server memory for the current user (merge).
CREATE OR REPLACE FUNCTION public.save_ai_memory(p_memory jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  INSERT INTO public.ai_customer_memory (user_id, memory, updated_at)
  VALUES (v_uid, COALESCE(p_memory, '{}'), NOW())
  ON CONFLICT (user_id) DO UPDATE SET memory = COALESCE(p_memory, '{}'), updated_at = NOW();

  RETURN jsonb_build_object('ok', true, 'user_id', v_uid::text);
END;
$$;

-- AI-03: load server memory for the current user.
CREATE OR REPLACE FUNCTION public.get_ai_memory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_memory jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  SELECT memory INTO v_memory FROM public.ai_customer_memory WHERE user_id = v_uid;
  RETURN jsonb_build_object('ok', true, 'memory', COALESCE(v_memory, '{}'::jsonb));
END;
$$;

-- ADM-07: upsert a mascot override.
CREATE OR REPLACE FUNCTION public.upsert_mascot_override(
  p_role_name text,
  p_media_url text,
  p_alt text DEFAULT ''
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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  INSERT INTO public.mascot_overrides (role_name, media_url, alt, updated_by, updated_at)
  VALUES (p_role_name, COALESCE(p_media_url, ''), COALESCE(p_alt, ''), v_uid, NOW())
  ON CONFLICT (role_name) DO UPDATE SET media_url = EXCLUDED.media_url, alt = EXCLUDED.alt, updated_by = EXCLUDED.updated_by, updated_at = NOW();
  RETURN jsonb_build_object('ok', true, 'role_name', p_role_name);
END;
$$;

-- ============================================
-- 6. EXECUTE permission
-- ============================================
REVOKE EXECUTE ON FUNCTION public.create_notification FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_notification_pref FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_system_error FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_system_errors FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_ai_memory FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ai_memory FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_mascot_override FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_notification_pref TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_system_error TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_system_errors TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_memory TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_memory TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_mascot_override TO authenticated;

-- ============================================
-- DONE
-- ============================================
COMMIT;

-- ============================================
-- END OF MIGRATION 021
-- ============================================