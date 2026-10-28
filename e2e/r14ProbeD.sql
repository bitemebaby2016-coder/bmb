-- R14 probe D2: payment intents + status history + audit for PO-20261028-135 (to_jsonb = schema-proof)
SELECT json_build_object(
  'intents', (SELECT COALESCE(json_agg(to_jsonb(i)), '[]'::json) FROM public.payment_intents i WHERE i.order_number = 'PO-20261028-135'),
  'history', (SELECT COALESCE(json_agg(to_jsonb(h)), '[]'::json) FROM public.order_status_history h WHERE h.order_number = 'PO-20261028-135'),
  'audit_135', (SELECT COALESCE(json_agg(to_jsonb(a)), '[]'::json) FROM (
    SELECT * FROM public.audit_logs WHERE entity_id LIKE '%135%' OR description LIKE '%135%' ORDER BY created_at DESC LIMIT 10) a),
  'intents_today', (SELECT COALESCE(json_agg(to_jsonb(x)), '[]'::json) FROM (
    SELECT * FROM public.payment_intents WHERE created_at >= '2026-10-28' ORDER BY created_at DESC LIMIT 10) x)
) AS probe;