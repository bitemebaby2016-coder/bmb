-- ===== ensure_rounds_for_date =====
CREATE OR REPLACE FUNCTION public.ensure_rounds_for_date(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_key text;
  v_tpl public.delivery_rounds%ROWTYPE;
  v_id text;
  v_rounds jsonb;
BEGIN
  IF p_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_DATE'; END IF;
  IF p_date < v_today THEN RAISE EXCEPTION 'ERR_DATE_IN_PAST'; END IF;
  IF p_date > v_today + 30 THEN RAISE EXCEPTION 'ERR_DATE_TOO_FAR'; END IF;

  FOREACH v_key IN ARRAY ARRAY['morning','midday','evening'] LOOP
    -- PHASE 3A hardening: only an ACTIVE round may serve as a template — an
    -- admin-deactivated or closed round must never be re-instantiated as active.
    SELECT * INTO v_tpl
      FROM public.delivery_rounds
     WHERE COALESCE(round_key, name) = v_key
       AND status = 'active'
     ORDER BY scheduled_date DESC NULLS LAST, created_at DESC
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ERR_ROUND_TEMPLATE_MISSING: %', v_key;
    END IF;
    -- validate the template is operationally complete (no stale/degenerate clone)
    IF v_tpl.cutoff_time IS NULL OR v_tpl.max_capacity IS NULL OR v_tpl.max_capacity <= 0
       OR v_tpl.delivery_start IS NULL OR v_tpl.delivery_end IS NULL
       OR v_tpl.delivery_end <= v_tpl.delivery_start THEN
      RAISE EXCEPTION 'ERR_ROUND_TEMPLATE_INVALID: %', v_key;
    END IF;

    v_id := 'round-' || to_char(p_date, 'YYYYMMDD') || '-' || v_key;
    INSERT INTO public.delivery_rounds (
      id, round_key, name, display_name, cutoff_time, delivery_start, delivery_end,
      max_capacity, current_count, date, scheduled_date, status
    ) VALUES (
      v_id, v_key, v_key, v_tpl.display_name, v_tpl.cutoff_time, v_tpl.delivery_start,
      v_tpl.delivery_end, v_tpl.max_capacity, 0, p_date, p_date, 'active'
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'round_key', r.round_key, 'display_name', r.display_name,
           'scheduled_date', r.scheduled_date, 'cutoff_time', r.cutoff_time,
           'delivery_start', r.delivery_start, 'delivery_end', r.delivery_end,
           'max_capacity', r.max_capacity, 'current_count', r.current_count, 'status', r.status
         ) ORDER BY r.delivery_start), '[]'::jsonb)
    INTO v_rounds
    FROM public.delivery_rounds r
   WHERE r.scheduled_date = p_date AND r.status = 'active';

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'rounds', v_rounds);
END;
$function$
