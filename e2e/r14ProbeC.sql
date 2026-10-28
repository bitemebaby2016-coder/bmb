-- R14 probe C: today's orders status picture + batch items reality
SELECT json_build_object(
  'orders', (SELECT COALESCE(json_agg(o ORDER BY o.created_at), '[]'::json) FROM (
    SELECT order_number, status, payment_status, payment_method, order_mode,
           scheduled_date, delivery_round_id, created_at
    FROM public.orders
    WHERE created_at >= '2026-10-27' OR scheduled_date >= '2026-10-27'
    ORDER BY created_at DESC LIMIT 40) o),
  'batch_items', (SELECT count(*) FROM public.production_batch_items),
  'items_today', (SELECT COALESCE(json_agg(i), '[]'::json) FROM (
    SELECT pbi.batch_id, pbi.order_number, pbi.product_name, pbi.quantity, pbi.status
    FROM public.production_batch_items pbi
    JOIN public.production_batches pb ON pb.id = pbi.batch_id
    WHERE pb.scheduled_date = '2026-10-28' LIMIT 20) i),
  'status_counts_today', (SELECT COALESCE(json_agg(s), '[]'::json) FROM (
    SELECT status, count(*) AS n FROM public.orders
    WHERE created_at >= '2026-10-28' GROUP BY status) s)
) AS probe;