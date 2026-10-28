-- R15 probe A: state of PO-20261028-135 (auto-close supposed to have fired) + related
SELECT json_build_object(
  'orders', (SELECT COALESCE(json_agg(to_jsonb(o)), '[]'::json) FROM public.orders o WHERE o.order_number IN ('PO-20261028-135','PO-20261028-942')),
  'assignments', (SELECT COALESCE(json_agg(to_jsonb(a)), '[]'::json) FROM public.delivery_assignments a WHERE a.order_number IN ('PO-20261028-135','PO-20261028-942')),
  'drivers', (SELECT COALESCE(json_agg(to_jsonb(d)), '[]'::json) FROM public.drivers d),
  'status_history_135', (SELECT COALESCE(json_agg(to_jsonb(h)), '[]'::json) FROM public.order_status_history h WHERE h.order_number = 'PO-20261028-135'),
  'pod_check', (SELECT COALESCE(json_agg(to_jsonb(p)), '[]'::json) FROM (
    SELECT count(*) AS pod_objects FROM storage.objects WHERE bucket_id = 'pod-photos') p)
) AS probe;