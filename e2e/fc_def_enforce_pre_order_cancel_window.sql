CREATE OR REPLACE FUNCTION public.enforce_pre_order_cancel_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
