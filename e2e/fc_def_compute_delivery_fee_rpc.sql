CREATE OR REPLACE FUNCTION public.compute_delivery_fee_rpc(p_dropoff_latitude numeric DEFAULT NULL::numeric, p_dropoff_longitude numeric DEFAULT NULL::numeric, p_delivery_method text DEFAULT 'self_delivery'::text, p_items_count integer DEFAULT 1, p_distance_km numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  RETURN jsonb_build_object(
    'delivery_fee', public.compute_delivery_fee(p_dropoff_latitude, p_dropoff_longitude, p_delivery_method, p_items_count, p_distance_km),
    'method', COALESCE(p_delivery_method, 'self_delivery')
  );
END;
$function$
