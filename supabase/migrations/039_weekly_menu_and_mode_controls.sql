-- ============================================
-- Bite Me Baby — Migration 039: PRE-05 weekly PRE_ORDER menu + mode/round controls
-- Date: 2026-09-25 · Baseline: 2865036 · Source: MASTER EXECUTION COMMAND 2026-09-25 §5-6
--
-- OWNER BUSINESS INTENT (PRE-01 answer):
--   PRE_ORDER menu is published WEEKLY; 2 menus/day on pre-assigned dates;
--   customers order only what is open for that date; open/close controllable
--   per mode (SAME_DAY/PRE_ORDER), per day, per round — like Grab.
--   Cutoff = 2h before delivery (already enforced by Migr 038 for PRE_ORDER).
--
-- DESIGN (source-of-truth first — extends, never replaces):
--   menu_schedule(date, product_id) = canonical "what is sellable on a future date"
--   - Admin publishes via set_menu_schedule RPC (auth: is_admin) with audit log
--   - Server-side enforcement trigger on orders: for PRE_ORDER rows, if the
--     scheduled_date HAS a published schedule, every product_id must be in it
--     (ERR_PRODUCT_NOT_ON_MENU). Days WITHOUT a schedule keep the existing
--     products.available_preorder gate — zero disruption, additive gate.
--   - Mode/round/day open-close: business_settings key='operating_hours' —
--     {"same_day_open":true,"pre_order_open":true,"round_open":{"morning":true,...}}
--     enforced in create path via trigger (server authority, not UI hiding)
--
-- AFFECTED TABLES: +menu_schedule (new), orders (gated by trigger only)
-- SECURITY: menu_schedule RLS = admin write / authenticated read;
--   RPCs SECURITY DEFINER + is_admin; trigger functions DEFINER + revoked EXECUTE.
-- ROLLBACK: drop trigger/functions/table; re-run safe.
-- DEPENDENCIES: 025 (canonical RPC), 038 (pre-order policy triggers).
-- VERIFICATION: e2e/contracts_039_menu_schedule.sql (BEGIN...ROLLBACK).
-- ============================================

BEGIN;

-- ============================================
-- 1. menu_schedule — canonical weekly pre-order menu
-- ============================================
CREATE TABLE IF NOT EXISTS public.menu_schedule (
  id            text PRIMARY KEY DEFAULT 'ms-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 6),
  scheduled_date date NOT NULL,
  product_id    text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  delivery_round_key text DEFAULT NULL, -- NULL = ทั้งวันทุกรอบ
  is_published  boolean NOT NULL DEFAULT false,
  note          text DEFAULT '',
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (scheduled_date, product_id)
);
CREATE INDEX IF NOT EXISTS idx_menu_schedule_date ON public.menu_schedule (scheduled_date);

ALTER TABLE public.menu_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS menu_schedule_read ON public.menu_schedule;
CREATE POLICY menu_schedule_read ON public.menu_schedule
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS menu_schedule_admin ON public.menu_schedule;
CREATE POLICY menu_schedule_admin ON public.menu_schedule
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================
-- 2. Admin RPC — set weekly schedule for a date (replace-all semantics)
-- items: [{"product_id":"prod-6","delivery_round_key":null,"note":""}, ...]
-- ============================================
CREATE OR REPLACE FUNCTION public.set_menu_schedule(
  p_scheduled_date date,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_count integer;
  v_item record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_scheduled_date IS NULL OR p_scheduled_date < (now() AT TIME ZONE 'Asia/Bangkok')::date THEN
    RAISE EXCEPTION 'ERR_INVALID_MENU_DATE';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'ERR_INVALID_MENU_ITEMS';
  END IF;

  DELETE FROM public.menu_schedule WHERE scheduled_date = p_scheduled_date;
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items)
      AS x(product_id text, delivery_round_key text, note text)
  LOOP
    IF v_item.product_id IS NULL OR NOT EXISTS
       (SELECT 1 FROM public.products WHERE id = v_item.product_id) THEN
      RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND: %', v_item.product_id;
    END IF;
    INSERT INTO public.menu_schedule
      (scheduled_date, product_id, delivery_round_key, is_published, note, created_by)
    VALUES
      (p_scheduled_date, v_item.product_id, NULLIF(v_item.delivery_round_key, ''),
       false, COALESCE(v_item.note, ''), v_uid)
    ON CONFLICT (scheduled_date, product_id) DO UPDATE
      SET delivery_round_key = EXCLUDED.delivery_round_key,
          note = COALESCE(v_item.note, ''),
          updated_at = NOW();
  END LOOP;

  SELECT COUNT(*) INTO v_count FROM public.menu_schedule WHERE scheduled_date = p_scheduled_date;
  PERFORM public.append_audit_log(
    p_action := 'menu_schedule_set',
    p_entity_type := 'menu_schedule',
    p_entity_id := p_scheduled_date::text,
    p_description := 'weekly menu set for ' || p_scheduled_date::text,
    p_metadata := jsonb_build_object('items', v_count, 'published', false)
  );
  RETURN jsonb_build_object('ok', true, 'date', p_scheduled_date::text, 'items', v_count, 'published', false);
END;
$$;


-- ============================================
-- 3. publish + customer read RPCs
-- ============================================
CREATE OR REPLACE FUNCTION public.publish_menu_schedule(
  p_scheduled_date date,
  p_publish boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid; v_n integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  UPDATE public.menu_schedule
     SET is_published = p_publish, updated_at = NOW()
   WHERE scheduled_date = p_scheduled_date;

  SELECT COUNT(*) INTO v_n FROM public.menu_schedule
   WHERE scheduled_date = p_scheduled_date AND is_published = p_publish;

  PERFORM public.append_audit_log(
    p_action := 'menu_schedule_publish',
    p_entity_type := 'menu_schedule',
    p_entity_id := p_scheduled_date::text,
    p_description := CASE WHEN p_publish THEN 'menu published' ELSE 'menu unpublished' END,
    p_metadata := jsonb_build_object('rows', v_n)
  );
  RETURN jsonb_build_object('ok', true, 'date', p_scheduled_date::text, 'rows', v_n);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_menu_for_date(p_scheduled_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT ms.product_id, p.name AS product_name, p.price,
             ms.delivery_round_key
        FROM public.menu_schedule ms
        JOIN public.products p ON p.id = ms.product_id
       WHERE ms.scheduled_date = p_scheduled_date
         AND ms.is_published = true
         AND COALESCE(p.is_available, false) = true
       ORDER BY ms.delivery_round_key NULLS FIRST, p.name
    ) r;
  RETURN jsonb_build_object('ok', true, 'date', p_scheduled_date::text, 'menu', v_result);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_menu_for_date(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_menu_for_date(date) TO authenticated;


-- ============================================
-- ============================================
-- 4A. weekly menu gate — AFTER INSERT on order_items (parent order must be
-- a published-menu PRE_ORDER day; product must be on that day's menu)
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_menu_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode      text;
  v_scheduled date;
  v_round_id  text;
BEGIN
  SELECT o.order_mode::text, o.scheduled_date, o.delivery_round_id
    INTO v_mode, v_scheduled, v_round_id
    FROM public.orders o WHERE o.id = NEW.order_id;

  IF v_mode <> 'PRE_ORDER' OR v_scheduled IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.menu_schedule
              WHERE scheduled_date = v_scheduled
                AND is_published = true) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.menu_schedule ms
       WHERE ms.scheduled_date = v_scheduled
         AND ms.is_published = true
         AND ms.product_id = NEW.product_id
         AND (ms.delivery_round_key IS NULL
              OR ms.delivery_round_key = (SELECT COALESCE(round_key, name)
                    FROM public.delivery_rounds WHERE id = v_round_id))
    ) THEN
      RAISE EXCEPTION 'ERR_PRODUCT_NOT_ON_MENU: % not on menu for %', NEW.product_id, v_scheduled::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_menu_gate ON public.order_items;
CREATE TRIGGER trg_menu_gate
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_menu_gate();

REVOKE EXECUTE ON FUNCTION public.enforce_menu_gate() FROM PUBLIC, anon, authenticated;
-- ============================================
-- 4B. mode / round open-close — BEFORE INSERT on orders (server authority,
-- not UI hiding). business_settings key='operating_hours':
-- {"same_day_open":true,"pre_order_open":true,"morning_open":true,...}
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_operating_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open      jsonb;
  v_mode_open boolean;
  v_round_key text;
BEGIN
  SELECT COALESCE(value, '{}'::jsonb) INTO v_open
    FROM public.business_settings WHERE key = 'operating_hours';

  IF v_open ? 'same_day_open' OR v_open ? 'pre_order_open' THEN
    v_mode_open := CASE WHEN NEW.order_mode::text = 'PRE_ORDER'
                        THEN COALESCE((v_open->>'pre_order_open')::boolean, true)
                        ELSE COALESCE((v_open->>'same_day_open')::boolean, true) END;
    IF NOT v_mode_open THEN
      RAISE EXCEPTION 'ERR_ORDER_MODE_CLOSED: % is currently closed', NEW.order_mode::text;
    END IF;
  END IF;

  SELECT COALESCE(round_key, name) INTO v_round_key
    FROM public.delivery_rounds WHERE id = NEW.delivery_round_id;
  IF v_round_key IS NOT NULL AND v_open ? (v_round_key || '_open') THEN
    IF COALESCE((v_open->>((v_round_key) || '_open'))::boolean, true) = false THEN
      RAISE EXCEPTION 'ERR_ROUND_CLOSED: % round is currently closed', v_round_key;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operating_hours ON public.orders;
CREATE TRIGGER trg_operating_hours
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_operating_hours();

REVOKE EXECUTE ON FUNCTION public.enforce_operating_hours() FROM PUBLIC, anon, authenticated;

-- settings defaults (merge, never overwrite existing keys)
UPDATE public.business_settings
   SET value = value
             || CASE WHEN NOT (value ? 'same_day_open') THEN '{"same_day_open": true}'::jsonb ELSE '{}'::jsonb END
             || CASE WHEN NOT (value ? 'pre_order_open') THEN '{"pre_order_open": true}'::jsonb ELSE '{}'::jsonb END
             || CASE WHEN NOT (value ? 'morning_open') THEN '{"morning_open": true}'::jsonb ELSE '{}'::jsonb END
             || CASE WHEN NOT (value ? 'midday_open') THEN '{"midday_open": true}'::jsonb ELSE '{}'::jsonb END
             || CASE WHEN NOT (value ? 'evening_open') THEN '{"evening_open": true}'::jsonb ELSE '{}'::jsonb END,
       updated_at = NOW()
 WHERE key = 'operating_hours';

INSERT INTO public.business_settings (key, value)
SELECT 'operating_hours',
       '{"same_day_open": true, "pre_order_open": true, "morning_open": true, "midday_open": true, "evening_open": true}'::jsonb
 WHERE NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'operating_hours');

COMMIT;

-- ============================================
-- END OF MIGRATION 039
-- ============================================
