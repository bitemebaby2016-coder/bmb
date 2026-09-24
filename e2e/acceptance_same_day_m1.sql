-- ============================================
-- BMB — SAME_DAY ACCEPTANCE SCRIPT (PHASE 2 PREP) — MODE A
-- READ-ONLY evidence collection + expected/actual matrix
-- รันบน production หลัง Owner place real order (ตาม plan M1-02)
-- correlation key: order_number
-- ห้าม mutate production data
-- ============================================
-- จุดที่ยังต้องมี Owner เป็นผู้กระทำ: สั่งจริงบน PWA, ชำระเงินจริง,
-- กด confirm/batch/dispatch จาก Admin, rider กดผ่าน RiderPWA
-- AI DEV ใช้ trace_order_evidence.sql ตรวจหลักฐานทุกขั้น
-- ============================================

-- CASE MATRIX (expected) — เต็มอยู่ใน docs/BMB_MASTER_EXECUTION_PLAN_2026-09-24.md Section 10
-- S1  valid order          → order_mode='SAME_DAY', status เดินถึง 'delivered'
-- S2  หลัง cutoff          → RPC reject ERR_CUTOFF_PASSED (ไม่มี order row)
-- S3  capacity full        → reject ERR_CAPACITY_FULL
-- S4  insufficient stock   → reject ERR_INSUFFICIENT_INGREDIENT (atomic ไม่ deduct บางส่วน)
-- S5  invalid distance     → reject ตาม 5km gate (Migr 035)
-- S6  payment failure      → order ไม่ confirm, payment_status ชัดเจน
-- S7  duplicate payment    → idempotent ไม่มี bill ซ้ำ (payment_intents unique)
-- S8  cancel               → status='cancelled' + restore inventory + restore capacity
-- S9  restore evidence     → inventory_transactions มี restore row, round booked_count ลด

-- READ-ONLY VERIFICATION QUERIES (หลัง Owner ทำแต่ละ case — เปลี่ยน :order_number)

-- S1/S6: final state ของ same-day order
SELECT o.order_number, o.order_mode, o.status, o.payment_status,
       (SELECT COUNT(*) FROM public.inventory_transactions it WHERE it.order_id = o.id) AS inv_tx,
       (SELECT COUNT(*) FROM public.production_batch_items pbi WHERE pbi.order_id = o.id) AS batch_items,
       (SELECT COUNT(*) FROM public.delivery_assignments da WHERE da.order_number = o.order_number) AS assignments
FROM public.orders o
WHERE o.order_number = :order_number AND o.order_mode = 'SAME_DAY';

-- S8: cancel/restore evidence (transaction ต้องมีทั้ง deduct และ restore)
SELECT it.change_type, COUNT(*) AS n, SUM(it.quantity) AS total
FROM public.inventory_transactions it
JOIN public.orders o ON o.id = it.order_id
WHERE o.order_number = :order_number
GROUP BY it.change_type;

-- S3/S8: capacity evidence ก่อน/หลัง (booked_count ต้องคืนค่าหลัง cancel)
SELECT dr.id, dr.round_date, dr.max_capacity, dr.booked_count,
       (SELECT COUNT(*) FROM public.orders o
         WHERE o.delivery_round_id = dr.id AND o.status NOT IN ('cancelled')) AS live_orders
FROM public.delivery_rounds dr
WHERE dr.id IN (SELECT o.delivery_round_id FROM public.orders o
                WHERE o.order_number = :order_number);

-- PASS/FAIL RULE: PASS เฉพาะเมื่อ DB evidence ตรง expected — ห้าม PASS เพราะ UI return สำเร็จ
-- สถานะรวมของ Phase 2 ปัจจุบัน: SCRIPTS READY / PRODUCTION RUN = OWNER-ONLY
