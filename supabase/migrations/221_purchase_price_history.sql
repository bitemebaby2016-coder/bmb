-- ============================================
-- Phase 2 WP1: Purchase Price History — Append-Only Ledger (SCHEMA ONLY)
-- Migration 221
-- Scope (Owner 2026-11-26): WP1 = Schema เท่านั้น
--   Price History Read API = WP7 (staged_workflows/wp7_price_history_read_api.sql)
--
-- Remediation (Owner 2026-11-26):
--   DEFECT-5: package_size ถูกลบ — supplier_products (m217) ไม่มีคอลัมน์นี้
--     ข้อมูลหน่วยครอบคลุมด้วย purchase_unit + use_unit + conversion_factor
--     + price_per_use_unit (generated) ที่มีอยู่แล้ว ไม่ต้องเพิ่มข้อมูลใหม่
--   DEFECT-4: landed_cost นิยามชัดเจน (ดู COMMENT คอลัมน์):
--     "ยอดต่อ GRN line ต่อหนึ่งหน่วยซื้อ (purchase unit)" จากสูตร
--     ((received_qty × actual_unit_price) − line_discount
--       + shipping_allocated + ภาษี non_recoverable) / received_qty
--     จุดจัดเก็บ: 1) purchase_price_history.landed_cost (ค่าต่อหน่วยซื้อ
--     ต่อ line — append-only) 2) inventory_transactions.unit_cost
--     (ค่าต่อ use_unit = landed_cost / conversion_factor)
--     3) inventory.wavg_cost (WAVG สะสมต่อ use_unit)
--   ORG/BRANCH ISOLATION (Owner C): เพิ่ม tenant_id + branch_id — row
--     เกิดจากเอกสาร PO/GRN ที่มีขอบเขตองค์กร จึงต้องเก็บขอบเขตลง row
--     เพื่อให้ RLS ตรวจได้โดยไม่ต้อง join (pattern เดียวกับ suppliers 214)
-- Dependencies: 219 (purchase_orders), 220 (goods_receipts)
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS purchase_price_history (
  id                    BIGSERIAL PRIMARY KEY,
  supplier_id           TEXT NOT NULL REFERENCES suppliers(id),
  supplier_product_id   TEXT NOT NULL REFERENCES supplier_products(id),
  ingredient_id         TEXT NOT NULL REFERENCES inventory(id),
  po_id                 TEXT REFERENCES purchase_orders(id),
  po_line_id            TEXT REFERENCES purchase_order_lines(id),
  grn_id                TEXT REFERENCES goods_receipts(id),
  grn_line_id           TEXT REFERENCES goods_receipt_lines(id),
  price_type            TEXT NOT NULL
    CHECK (price_type IN ('quoted', 'committed', 'realized', 'landed', 'approved', 'correction')),
  purchase_unit         TEXT NOT NULL,
  use_unit              TEXT NOT NULL,
  conversion_factor     NUMERIC(10,4) NOT NULL,
  ordered_qty           NUMERIC(10,4),
  received_qty          NUMERIC(10,4),
  unit_price            NUMERIC(12,4) NOT NULL,
  price_per_use_unit    NUMERIC(12,4) GENERATED ALWAYS AS (unit_price / conversion_factor) STORED,
  discount_allocated    NUMERIC(12,2) DEFAULT 0,
  shipping_allocated    NUMERIC(12,2) DEFAULT 0,
  tax_treatment         TEXT CHECK (tax_treatment IN ('recoverable', 'non_recoverable', 'exempt')),
  landed_cost           NUMERIC(12,4),
  effective_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  approval_status       TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  source_user           UUID REFERENCES auth.users(id),
  source_document       TEXT,
  tenant_id             TEXT REFERENCES tenants(id),
  branch_id             TEXT REFERENCES branches(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN purchase_price_history.landed_cost IS
  'DEFECT-4 contract: landed cost PER GRN LINE PER PURCHASE UNIT = ((received_qty × actual_unit_price) − line_discount + shipping_allocated + non_recoverable tax_amount) / received_qty. Per-use-unit value = landed_cost / conversion_factor, stored in inventory_transactions.unit_cost and rolled into inventory.wavg_cost. Correction entries (price_type=correction) store NEGATIVE mirrors of the original row for append-only reversal.';
COMMENT ON COLUMN purchase_price_history.price_per_use_unit IS
  'Generated: unit_price / conversion_factor — price normalized to the internal use unit.';
COMMENT ON COLUMN purchase_price_history.grn_line_id IS
  'Linkage to the exact GRN line that produced this price entry (realized/landed/correction).';
COMMENT ON COLUMN purchase_price_history.tenant_id IS
  'ORG ISOLATION: copied from the source PO/GRN header at insert (WP6). NULL = tenant-wide. RLS: has_org_row_scope.';
COMMENT ON COLUMN purchase_price_history.branch_id IS
  'BRANCH ISOLATION: copied from the source GRN header at insert (WP6). NULL = tenant-wide row.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pph_supplier ON purchase_price_history(supplier_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_pph_ingredient ON purchase_price_history(ingredient_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_pph_grn ON purchase_price_history(grn_id);
CREATE INDEX IF NOT EXISTS idx_pph_grn_line ON purchase_price_history(grn_line_id);
CREATE INDEX IF NOT EXISTS idx_pph_type ON purchase_price_history(price_type, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_pph_po ON purchase_price_history(po_id);
CREATE INDEX IF NOT EXISTS idx_pph_po_line ON purchase_price_history(po_line_id);
CREATE INDEX IF NOT EXISTS idx_pph_tenant_branch ON purchase_price_history(tenant_id, branch_id);

-- Append-only enforcement: block UPDATE and DELETE
CREATE OR REPLACE FUNCTION enforce_purchase_price_history_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'purchase_price_history is append-only: UPDATE not allowed';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'purchase_price_history is append-only: DELETE not allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_price_history_append_only ON purchase_price_history;
CREATE TRIGGER trg_purchase_price_history_append_only
  BEFORE UPDATE OR DELETE ON purchase_price_history
  FOR EACH ROW EXECUTE FUNCTION enforce_purchase_price_history_append_only();

-- Grants — append-only: ไม่มี UPDATE/DELETE (ถูกบล็อกซ้ำอีกชั้นด้วย trigger)
GRANT SELECT, INSERT ON purchase_price_history TO authenticated;

COMMIT;

-- RLS is enabled + policies in migration 223 (has_org_row_scope)
