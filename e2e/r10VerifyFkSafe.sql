BEGIN;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

-- (1) Contract 019/020 pattern: order ของ fixture ที่ไม่มีแถว customers จริง
--     → INSERT ต้องสำเร็จ + ไม่มี notification (ห้าม FK ระเบิดใส่ order)
INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone, total_amount, status)
VALUES ('ord-r10fk-probe', 'R10-FK-0001', 'fixture-customer-not-exists', 'fixture', '0900000000', 100, 'pending');
UPDATE public.orders SET status = 'confirmed' WHERE order_number = 'R10-FK-0001';

-- (2) ลูกค้าจริง (543) → PAYMENT_CONFIRMED ต้องโผล่เหมือนเดิม (best-effort ไม่ทำของจริงหาย)
UPDATE public.orders SET payment_status = 'refund' WHERE order_number = 'BMB-20261027-543';
UPDATE public.orders SET payment_status = 'paid' WHERE order_number = 'BMB-20261027-543';

SELECT (SELECT count(*) FROM public.orders WHERE order_number = 'R10-FK-0001') AS fixture_order_ok,
       (SELECT count(*) FROM public.notifications
         WHERE created_at >= now() - interval '1 minute'
           AND (customer_id = 'fixture-customer-not-exists' OR message LIKE '%R10-FK-0001%')) AS fixture_notifs,
       (SELECT count(*) FROM public.notifications
         WHERE created_at >= now() - interval '1 minute' AND notification_type = 'PAYMENT_CONFIRMED') AS real_payment_notifs;
ROLLBACK;
