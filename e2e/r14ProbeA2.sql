-- R14 probe A2: single-statement (API returns only the LAST result set)
SELECT json_build_object(
  'rounds', (SELECT COALESCE(json_agg(r ORDER BY r.delivery_start), '[]'::json) FROM (
    SELECT id, round_key, display_name, scheduled_date, status, current_count, max_capacity, archived, delivery_start
    FROM public.delivery_rounds WHERE scheduled_date = '2026-10-28') r),
  'batches', (SELECT COALESCE(json_agg(b), '[]'::json) FROM (
    SELECT id, delivery_round_id, scheduled_date, status, created_at, created_by
    FROM public.production_batches ORDER BY created_at DESC LIMIT 8) b),
  'orders_pipeline', (SELECT COALESCE(json_agg(o), '[]'::json) FROM (
    SELECT order_number, status, order_mode, scheduled_date, delivery_round_id, payment_status
    FROM public.orders WHERE status IN ('confirmed','preparing','ready_for_dispatch') ORDER BY created_at DESC LIMIT 20) o)
) AS probe;