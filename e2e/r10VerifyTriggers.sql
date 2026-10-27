BEGIN;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- payment branch (161) — enum-safe text compare
UPDATE public.orders SET payment_status = 'refund' WHERE order_number = 'BMB-20261027-543';
UPDATE public.orders SET payment_status = 'paid' WHERE order_number = 'BMB-20261027-543';

-- admin_reject_payment (162) — sets payment back to pending + audit
SELECT public.admin_reject_payment('BMB-20261027-543', 'R10 probe') AS reject_result;

SELECT (SELECT count(*) FROM public.notifications
         WHERE created_at >= now() - interval '1 minute' AND notification_type = 'PAYMENT_CONFIRMED') AS payment_notifs,
       (SELECT payment_status::text FROM public.orders WHERE order_number = 'BMB-20261027-543') AS pay_after_reject;
ROLLBACK;
