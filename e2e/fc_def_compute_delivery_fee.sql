CREATE OR REPLACE FUNCTION public.compute_delivery_fee(p_dropoff_latitude numeric, p_dropoff_longitude numeric, p_delivery_method text DEFAULT 'self_delivery'::text, p_items_count integer DEFAULT 1, p_distance_km numeric DEFAULT NULL::numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dist    numeric;
  v_fee     numeric;
  v_kitchen jsonb;
  v_dp jsonb;
  v_method  text := COALESCE(p_delivery_method, 'self_delivery');
BEGIN
  -- W-1.4: config from DB (no hardcode)
  SELECT value INTO v_dp FROM public.business_settings WHERE key = 'delivery_policy';
  IF v_dp IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: business_settings.delivery_policy'; END IF;
  IF v_dp->>'bite_drive_radius_km' IS NULL THEN RAISE EXCEPTION 'ERR_CONFIG_MISSING: delivery_policy.bite_drive_radius_km'; END IF;

  IF p_distance_km IS NOT NULL AND p_distance_km > 0 THEN
    v_dist := p_distance_km;
  ELSIF p_dropoff_latitude IS NOT NULL AND p_dropoff_longitude IS NOT NULL THEN
    v_kitchen := public.kitchen_location();
    v_dist := public.haversine_km(
      (v_kitchen->>'latitude')::numeric, (v_kitchen->>'longitude')::numeric,
      p_dropoff_latitude, p_dropoff_longitude
    );
  ELSE
    v_dist := 0;
  END IF;

  -- P0 #5: server-side 5km self-delivery gate (035 Part 1 intent, repaired)
  IF v_method = 'self_delivery' AND v_dist > (v_dp->>'bite_drive_radius_km')::numeric THEN
    RAISE EXCEPTION 'SELF_DELIVERY_EXCEEDS_5KM_LIMIT: % km > delivery_policy.bite_drive_radius_km % km', v_dist, (v_dp->>'bite_drive_radius_km')::numeric;
  END IF;

  SELECT fee INTO v_fee
    FROM public.delivery_zones
   WHERE is_active = true
     AND v_dist >= min_distance_km
     AND v_dist <= max_distance_km
   ORDER BY max_distance_km ASC
   LIMIT 1;

  IF v_fee IS NOT NULL THEN
    RETURN v_fee;
  END IF;

  -- W-1.4: no silent hardcode fallback â€” admin must cover distance with an active zone
  RAISE EXCEPTION 'ERR_NO_DELIVERY_ZONE: no active delivery_zone covers % km (admin: adjust delivery_zones)', v_dist;
  END;
$function$
