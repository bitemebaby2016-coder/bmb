-- ============================================
-- BMB — READ-ONLY ORDER TRACE TOOLING (PHASE 1)
-- Primary correlation key: order_number / order_id
-- READ-ONLY: SELECT เท่านั้น — ห้าม INSERT/UPDATE/DELETE
-- Usage: run ใน Supabase SQL Editor (owner/admin context) พร้อม :order_number
-- ============================================
\set order_number '''TEST-001'''

-- 1. ORDER CORE
SELECT 'ORDER_CORE' AS check,
       o.id, o.order_number, o.order_mode, o.scheduled_date,
       o.delivery_round_id, o.status AS order_status,
       o.payment_status, o.payment_method, o.total_amount,
       o.dropoff_detail, o.created_at
FROM public.orders o
WHERE o.order_number = :order_number;

-- 2. ORDER ITEMS
SELECT 'ORDER_ITEMS' AS check, oi.order_id, oi.product_name,
       oi.quantity, oi.unit_price
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE o.order_number = :order_number;

-- 3. PAYMENT
SELECT 'PAYMENT' AS check, pi.id, pi.order_id, pi.status,
       pi.amount, pi.provider, pi.created_at
FROM public.payment_intents pi
JOIN public.orders o ON o.id = pi.order_id
WHERE o.order_number = :order_number;

-- 4. INVENTORY TRANSACTIONS (deduct/restore)
SELECT 'INVENTORY_TX' AS check, it.id, it.order_id, it.ingredient_id,
       it.change_type, it.quantity, it.created_at
FROM public.inventory_transactions it
JOIN public.orders o ON o.id = it.order_id
WHERE o.order_number = :order_number
ORDER BY it.created_at;

-- 5. PRODUCTION BATCH + ITEMS
SELECT 'PROD_BATCH' AS check, pb.id AS batch_id, pb.scheduled_date,
       pb.delivery_round_id, pb.status AS batch_status,
       pbi.product_name, pbi.quantity, pbi.status AS item_status,
       pbi.order_mode
FROM public.production_batches pb
JOIN public.production_batch_items pbi ON pbi.batch_id = pb.id
WHERE EXISTS (
  SELECT 1 FROM public.production_batch_items x
  JOIN public.orders o2 ON o2.id = x.order_id
  WHERE x.batch_id = pb.id AND o2.order_number = :order_number);

-- 6. DELIVERY ASSIGNMENT + DRIVER
SELECT 'DELIVERY_ASSIGN' AS check, da.order_number, da.status AS assignment_status,
       da.assigned_at, da.accepted_at, da.picked_up_at, da.in_transit_at, da.delivered_at,
       d.driver_name, d.phone_number, d.status AS driver_status
FROM public.delivery_assignments da
WHERE da.order_number = :order_number;

-- 7. ROUND CAPACITY (reserve evidence)
SELECT 'ROUND_CAPACITY' AS check, dr.id AS round_id, dr.round_date,
       dr.cutoff_time, dr.max_capacity, dr.booked_count
FROM public.delivery_rounds dr
WHERE dr.id IN (
  SELECT o.delivery_round_id FROM public.orders o
  WHERE o.order_number = :order_number);

-- 8. AUDIT TRAIL (ทุก event ของ order นี้)
SELECT 'AUDIT' AS check, al.action, al.entity_id, al.description, al.metadata, al.created_at
FROM public.audit_logs al
WHERE al.entity_id = :order_number OR al.entity_id IN (
  SELECT o.id FROM public.orders o WHERE o.order_number = :order_number)
ORDER BY al.created_at;

-- 9. ANSWER SHEET (ตอบ 15 คำถามของ trace)
SELECT
  'TRACE_ANSWERS' AS check,
  (SELECT o.order_mode FROM public.orders o WHERE o.order_number = :order_number) AS mode,
  (SELECT o.scheduled_date FROM public.orders o WHERE o.order_number = :order_number) AS sched_date,
  (SELECT o.status FROM public.orders o WHERE o.order_number = :order_number) AS final_status,
  (SELECT o.payment_status FROM public.orders o WHERE o.order_number = :order_number) AS payment,
  (SELECT (SELECT COUNT(*) FROM public.inventory_transactions it WHERE it.order_id = o.id)
     FROM public.orders o WHERE o.order_number = :order_number) AS inv_tx_count,
  (SELECT (SELECT COUNT(*) FROM public.production_batch_items pbi WHERE pbi.order_id = o.id)
     FROM public.orders o WHERE o.order_number = :order_number) AS batch_items,
  (SELECT (SELECT COUNT(*) FROM public.delivery_assignments da WHERE da.order_number = o.order_number)
     FROM public.orders o WHERE o.order_number = :order_number) AS assignments;
