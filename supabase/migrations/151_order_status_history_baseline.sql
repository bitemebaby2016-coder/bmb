-- ============================================================
-- 151_order_status_history_baseline.sql — WAVE 2 / F-05 (D7 2026-10-25)
-- ============================================================
-- ที่มา: ยกระดับจาก PROPOSED_wave2_history_backfill.sql — กลยุทธ์ = HISTORICAL_BASELINE
-- (ตัวที่เสนอไว้เดิมในไฟล์นั้น: ไม่เดาสถานะย้อนหลัง สร้างเฉพาะ baseline ที่ระบุตรงไปตรงมา)
--
-- ปัญหา: existing orders บน production ไม่มี lifecycle history (ตารางสร้างทีหลัง)
-- กลยุทธ์ HISTORICAL_BASELINE: 1 แถว baseline ต่อออเดอร์ที่ยังไม่มี history —
--   from_status = NULL, to_status = orders.status (สถานะปัจจุบัน ไม่เดา),
--   actor_type = 'SYSTEM', reason = 'HISTORICAL_BASELINE (...)',
--   metadata = { backfill: true, strategy: 'HISTORICAL_BASELINE' }
-- ข้อจำกัดที่ยอมรับ: ประวัติแบบ step-by-step ย้อนหลังหาไม่ได้จริง (audit_logs ไม่ครบ/
--   ไม่ authoritative) — แถว baseline ทำให้ "ทุกออเดอร์มีอย่างน้อย 1 event" โดยไม่แต่งเรื่อง
--
-- Idempotent: WHERE NOT EXISTS (มี history แล้วไม่แตะ) · รันซ้ำได้
-- Data impact: เฉพาะ INSERT แถวใหม่ — ไม่แก้/ลบ แถวเดิมใด ๆ
-- Rollback: DELETE แถว baseline (metadata->>'backfill' = true) ได้ทั้งหมด
-- Production apply = ขั้นตอนแยก authorize เสมอ (backup ก่อน + ตรวจแถวหลังรัน)
--   ถ้า Owner เลือก BACKFILL_UNKNOWN (ไม่ backfill) = ทิ้งไฟล์นี้ก่อน apply
-- ============================================================

BEGIN;

INSERT INTO public.order_status_history (id, order_number, from_status, to_status, changed_at, actor_type, reason, metadata)
SELECT
  'osh-baseline-' || o.order_number,
  o.order_number,
  NULL,
  o.status,
  o.updated_at,
  'SYSTEM',
  'HISTORICAL_BASELINE (pre-W2 order, no recorded lifecycle)',
  jsonb_build_object('backfill', true, 'strategy', 'HISTORICAL_BASELINE')
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_status_history h WHERE h.order_number = o.order_number
);

COMMIT;