-- ============================================
-- BMB — PRE_ORDER ACCEPTANCE SCRIPT (PHASE 3 PREP) — MODE B
-- SCHEDULED PRODUCTION + SCHEDULED DELIVERY lifecycle
-- READ-ONLY evidence collection — ห้าม mutate production data
-- ============================================
-- ⚠️ 3 OWNER DECISIONS ยังไม่ได้ตัดสิน — cases ที่ขึ้นกับ decisions mark BLOCKED:
--   P5  pre-order window          → BLOCKED — OWNER DECISION (ไม่มี enforce ฝั่ง server)
--   P11 cancel หลัง cutoff        → BLOCKED — OWNER DECISION (policy ไม่ได้กำหนด)
--   P11b จุด deduct สต๊อกของ pre-order → BLOCKED — OWNER DECISION (deduct ตอน confirm หรือตอนผลิต)
-- ห้ามสร้าง expected behavior เองสำหรับ 3 ข้อนี้
-- ============================================

-- CASE MATRIX (expected) — เต็มใน docs/BMB_MASTER_EXECUTION_PLAN_2026-09-24.md Section 10
-- P1  valid future date      → สร้างได้ order_mode='PRE_ORDER'
-- P2  today rejected         → reject
-- P3  past date rejected     → reject
-- P4  invalid round          → reject
-- P5  outside window        → BLOCKED — OWNER DECISION
-- P6  after cutoff           → reject
-- P7  capacity full (date+round) → reject ERR_CAPACITY_FULL
-- P8  insufficient stock    → reject
-- P9  invalid address       → trigger validate_pre_order_delivery reject
-- P10 cancel ก่อน cutoff     → restore capacity + inventory
-- P11 cancel หลัง cutoff     → BLOCKED — OWNER DECISION
-- P12-13 restore evidence   → inventory_transactions + booked_count คืน
-- P14 refund                → ตาม payment state + bill จริง (OWNER)
-- P15 batch generation      → production_batch ตาม scheduled_date + delivery_round
-- P16 scheduled production + scheduled dispatch → prepare วันผลิต, dispatch ตามรอบ

-- V1: pre-order creation evidence
SELECT o.order_number, o.order_mode, o.scheduled_date, o.delivery_round_id,
       o.status, o.payment_status, o.dropoff_detail,
       (SELECT COUNT(*) FROM public.inventory_transactions it WHERE it.order_id = o.id) AS inv_tx
FROM public.orders o
WHERE o.order_number = :order_number AND o.order_mode = 'PRE_ORDER';

-- V2: capacity ของ date+round ที่จอง (ต้อง reserve และไม่ oversell)
SELECT dr.id AS round_id, dr.round_date, dr.cutoff_time,
       dr.max_capacity, dr.booked_count,
       (SELECT COUNT(*) FROM public.orders o
         WHERE o.delivery_round_id = dr.id
           AND o.scheduled_date = dr.round_date
           AND o.status NOT IN ('cancelled')) AS live_orders
FROM public.delivery_rounds dr
WHERE dr.round_date >= CURRENT_DATE + 1
ORDER BY dr.round_date;

-- V3: scheduled batch evidence (batch ต้องผูก scheduled_date + delivery_round)
SELECT pb.id AS batch_id, pb.scheduled_date, pb.delivery_round_id, pb.status,
       pbi.product_name, pbi.quantity, pbi.order_mode
FROM public.production_batches pb
JOIN public.production_batch_items pbi ON pbi.batch_id = pb.id
WHERE EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.order_number = :order_number
    AND o.scheduled_date = pb.scheduled_date
    AND o.delivery_round_id = pb.delivery_round_id
    AND pbi.order_id = o.id);

-- V4: address validation evidence (trigger 035)
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname LIKE '%pre_order%delivery%' OR conname LIKE '%validate_pre%';

-- PASS/FAIL RULE: PASS เฉพาะ DB evidence ตรง expected
-- สถานะ Phase 3: SCRIPTS READY / cases P5,P11,P11b BLOCKED — OWNER DECISION
