-- ============================================
-- Phase 2 WP1: Inventory Transactions Extension (SCHEMA ONLY)
-- Migration 222
-- Scope (Owner 2026-11-26): WP1 = Schema เท่านั้น — WAVG Posting = WP6
-- Dependencies: 216 (inventory enriched), 220 (goods_receipts, goods_receipt_lines)
--
-- Field meanings (Owner B — ตรวจสอบแล้วว่าสอดคล้อง 001/019/026):
--   po_id               เอกสาร PO ต้นทาง (audit linkage)
--   grn_id              เอกสาร GRN ต้นทาง (audit linkage)
--   grn_line_id         บรรทัด GRN ต้นทาง — ระบุ line ที่ทำให้เกิดธุรกรรม
--   unit_cost           ต้นทุนต่อ use_unit ที่ใช้บันทึกครั้งนั้น
--                       (GRN post = landed_cost / conversion_factor,
--                        reversal = ค่าเดียวกันเพื่อย้อน WAVG)
--   conversion_snapshot conversion_factor ณ เวลาทำธุรกรรม (กันการแก้
--                       factor ย้อนหลังทำให้ audit คลาดเคลื่อน)
-- Sign convention (ตามระบบเดิม 001/019/026): quantity เป็นบวกเสมอ —
--   ทิศทางกำหนดด้วย type ('in' เพิ่ม / 'out' ลด) ห้ามใช้ปริมาณติดลบ
-- ============================================

BEGIN;

-- Extend inventory_transactions with PO/GRN linkage and WAVG support
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS po_id TEXT REFERENCES purchase_orders(id),
  ADD COLUMN IF NOT EXISTS grn_id TEXT REFERENCES goods_receipts(id),
  ADD COLUMN IF NOT EXISTS grn_line_id TEXT REFERENCES goods_receipt_lines(id),
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS conversion_snapshot NUMERIC(10,4);

COMMENT ON COLUMN inventory_transactions.po_id IS
  'GRN linkage: source PO (nullable — legacy rows have no PO).';
COMMENT ON COLUMN inventory_transactions.grn_id IS
  'GRN linkage: source GRN header (or reversal GRN) that produced this transaction.';
COMMENT ON COLUMN inventory_transactions.grn_line_id IS
  'GRN linkage: exact GRN line. Reversal transactions reference the ORIGINAL line id for traceability.';
COMMENT ON COLUMN inventory_transactions.unit_cost IS
  'Cost per use_unit at transaction time. GRN post: landed_cost / conversion_factor. Reversal: same value to unwind WAVG.';
COMMENT ON COLUMN inventory_transactions.conversion_snapshot IS
  'Conversion factor captured at posting time — immutable audit copy.';

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_itx_po ON inventory_transactions(po_id);
CREATE INDEX IF NOT EXISTS idx_itx_grn ON inventory_transactions(grn_id);
CREATE INDEX IF NOT EXISTS idx_itx_grn_line ON inventory_transactions(grn_line_id);

-- Grants (existing grants already cover these columns)
-- No new GRANT needed as columns are additive to existing table

-- RLS: inherits existing inventory_transactions RLS (new columns are covered
-- by the table-level policies — no new policies needed)

COMMIT;
