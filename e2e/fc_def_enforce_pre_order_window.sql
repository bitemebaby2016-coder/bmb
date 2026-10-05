CREATE OR REPLACE FUNCTION public.enforce_pre_order_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
