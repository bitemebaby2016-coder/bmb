-- ============================================
-- Phase 2 WP1: Goods Receipts — Header + Lines (SCHEMA ONLY)
-- Migration 220
-- Scope (Owner 2026-11-26): WP1 = Schema เท่านั้น — GRN Workflow RPC = WP4
--   (ดู supabase/staged_workflows/wp4_grn_workflow_rpc.sql)
--   WAVG Posting + Reversal Execution = WP6
--   (ดู supabase/staged_workflows/wp6_wavg_posting_reversal.sql)
--
-- Remediation (Owner 2026-11-26):
--   DEFECT-1: price_variance GENERATED column (subquery) ถูกลบทิ้ง —
--     PostgreSQL ห้ามใช้ subquery ใน generated column; variance คำนวณ
--     ใน read layer (WP7 view) = actual_unit_price - PO line unit_price
--   DEFECT-2: Reversal model = positive-quantity mirrored document +
--     reversal_of linkage (ห้ามใช้ปริมาณ/ราคาติดลบ) — ผลต่อ stock
--     บันทึกผ่าน inventory_transactions type='out' + price history
--     price_type='correction' (ดู WP6) · ทำซ้ำไม่ได้ด้วย unique index
--     บน reversal_of
--   DEFECT-3: idempotency_key + idempotency_payload_hash + UNIQUE —
--     retry key เดิม/ห้ามซ้ำ · key เดิม payload ต่าง = ปฏิเสธที่ function
--     (WP6 เทียบ hash) · unique index กัน insert ซ้ำระดับ DB
-- Dependencies: 219 (purchase_orders, purchase_order_lines)
-- ============================================

BEGIN;

-- ============================================
-- Document number contract (schema object)
-- GRN number format: GRN-YYYYMMDD-{seq 4 digits} — เจเนอเรเตอร์อยู่ใน WP4
-- ============================================
CREATE SEQUENCE IF NOT EXISTS grn_number_seq;
COMMENT ON SEQUENCE grn_number_seq IS
  'GRN number contract: GRN-YYYYMMDD-{seq:04d}. Generator function lives in WP4 (staged_workflows/wp4_grn_workflow_rpc.sql).';

-- Goods Receipts Header
CREATE TABLE IF NOT EXISTS goods_receipts (
  id                    TEXT PRIMARY KEY,
  grn_number            TEXT UNIQUE NOT NULL,
  po_id                 TEXT NOT NULL REFERENCES purchase_orders(id),
  supplier_id           TEXT NOT NULL REFERENCES suppliers(id),
  status                TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'posted', 'rejected', 'cancelled', 'reversed')),
  receipt_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by           UUID REFERENCES auth.users(id),
  approved_by           UUID REFERENCES auth.users(id),
  approved_at           TIMESTAMPTZ,
  posted_by             UUID REFERENCES auth.users(id),
  posted_at             TIMESTAMPTZ,
  -- Reversal linkage (DEFECT-2): reversal GRN = positive-quantity mirrored
  -- document ที่ชี้กลับต้นฉบับ ผลต่อ stock/valuation บันทึกโดย WP6 ผ่าน
  -- inventory_transactions (type='out', positive qty) ไม่ใช่ปริมาณติดลบ
  reversal_of           TEXT REFERENCES goods_receipts(id),
  -- Idempotency (DEFECT-3): key ต้องไม่ซ้ำระดับ DB (unique index ด้านล่าง)
  -- payload_hash กัน "key เดิม payload ต่าง" — เทียบโดย WP6 ก่อน post
  idempotency_key           TEXT,
  idempotency_payload_hash  TEXT,
  notes                 TEXT,
  attachments           JSONB DEFAULT '[]',
  tenant_id             TEXT REFERENCES tenants(id),
  branch_id             TEXT REFERENCES branches(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Reversal rows: ต้องชี้ต้นฉบับเสมอ และห้ามชี้ตัวเอง
  CONSTRAINT grn_reversal_linkage CHECK (reversal_of IS NULL OR reversal_of <> id),
  -- Reversal rows: ต้องมี payload hash เดียวกันต้นฉบับไม่ได้ (reversal ไม่ผ่าน idempotency key)
  CONSTRAINT grn_reversal_no_idem CHECK (reversal_of IS NULL OR idempotency_key IS NULL)
);

COMMENT ON COLUMN goods_receipts.reversal_of IS
  'DEFECT-2 model: reversal document links to the original posted GRN. Reversal lines store POSITIVE quantities (mirror); direction of effect comes from this linkage, not from negative values. One reversal per original (unique index below).';
COMMENT ON COLUMN goods_receipts.idempotency_key IS
  'DEFECT-3 contract: unique across all non-reversal GRNs (partial unique index). Same key + same payload_hash = retry returns existing result (no new stock transactions); same key + different payload = rejected (WP6 compares hash).';
COMMENT ON COLUMN goods_receipts.idempotency_payload_hash IS
  'SHA-256/hash of the posting payload captured at first post. WP6 rejects key reuse with a different hash (ERR_IDEMPOTENCY_CONFLICT).';
COMMENT ON COLUMN goods_receipts.tenant_id IS
  'ORG ISOLATION: NULL = tenant-wide (tenant-bmb-001 default). Enforced by RLS (has_org_row_scope).';
COMMENT ON COLUMN goods_receipts.branch_id IS
  'BRANCH ISOLATION: NULL = tenant-wide row. Branch-assigned staff see only their own branch (has_org_row_scope).';

-- Goods Receipt Lines
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id                    TEXT PRIMARY KEY,
  grn_id                TEXT NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  po_line_id            TEXT NOT NULL REFERENCES purchase_order_lines(id),
  supplier_product_id   TEXT NOT NULL REFERENCES supplier_products(id),
  ingredient_id         TEXT NOT NULL REFERENCES inventory(id),
  received_qty          NUMERIC(10,4) NOT NULL CHECK (received_qty > 0),
  accepted_qty          NUMERIC(10,4) NOT NULL DEFAULT 0
    CHECK (accepted_qty >= 0),
  rejected_qty          NUMERIC(10,4) NOT NULL DEFAULT 0
    CHECK (rejected_qty >= 0),
  purchase_unit         TEXT NOT NULL,
  use_unit              TEXT NOT NULL,
  conversion_factor     NUMERIC(10,4) NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
  actual_unit_price     NUMERIC(12,4) NOT NULL CHECK (actual_unit_price >= 0),
  line_discount         NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (line_discount >= 0),
  shipping_allocated    NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (shipping_allocated >= 0),
  tax_treatment         TEXT CHECK (tax_treatment IN ('recoverable', 'non_recoverable', 'exempt')),
  tax_amount            NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (tax_amount >= 0),
  lot_number            TEXT,
  expiry_date           DATE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- บัญชีรับของ: ยอมรับ + ปฏิเสธ ต้องเท่ากับที่รับจริงเสมอ (รองรับ
  -- รับบางส่วน/ของเสียหาย/ปฏิเสธ — ตัวเลขเป็นบวกเท่านั้น)
  CONSTRAINT grl_acceptance_balance CHECK (accepted_qty + rejected_qty = received_qty)
);

COMMENT ON TABLE goods_receipt_lines IS
  'DEFECT-2: reversal lines are POSITIVE-quantity mirrors of the original line (same qty/price values) on a GRN header with reversal_of set. Stock effect direction comes from the linkage + inventory_transactions type, never from negative quantities. Multiple GRN lines may reference the same PO line (partial receiving).';
COMMENT ON COLUMN goods_receipt_lines.accepted_qty IS
  'Damage/rejection support: accepted + rejected = received (CHECK). Only accepted_qty enters stock and WAVG (WP6).';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grl_grn ON goods_receipt_lines(grn_id);
CREATE INDEX IF NOT EXISTS idx_grl_po_line ON goods_receipt_lines(po_line_id);
CREATE INDEX IF NOT EXISTS idx_grl_ingredient ON goods_receipt_lines(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_grl_supplier_product ON goods_receipt_lines(supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_grn_supplier ON goods_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_status ON goods_receipts(status);
CREATE INDEX IF NOT EXISTS idx_grn_date ON goods_receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_grn_tenant_branch ON goods_receipts(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_grn_reversal ON goods_receipts(reversal_of);

-- DEFECT-2: reversal ทำซ้ำไม่ได้ — ต้นฉบับ 1 ใบ มี reversal ได้แค่ใบเดียว
CREATE UNIQUE INDEX IF NOT EXISTS uq_grn_reversal_once
  ON goods_receipts(reversal_of) WHERE reversal_of IS NOT NULL;

-- DEFECT-3: idempotency key ไม่ซ้ำระดับ DB (เฉพาะ GRN ปกติ — reversal ไม่ใช้ key)
CREATE UNIQUE INDEX IF NOT EXISTS uq_grn_idempotency_key
  ON goods_receipts(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grn_idem_hash ON goods_receipts(idempotency_payload_hash);

-- Updated at triggers (idempotent apply)
DROP TRIGGER IF EXISTS update_goods_receipts_updated_at ON goods_receipts;
CREATE TRIGGER update_goods_receipts_updated_at
  BEFORE UPDATE ON goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_goods_receipt_lines_updated_at ON goods_receipt_lines;
CREATE TRIGGER update_goods_receipt_lines_updated_at
  BEFORE UPDATE ON goods_receipt_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grants (row access limited by RLS in migration 223)
GRANT SELECT, INSERT, UPDATE, DELETE ON goods_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON goods_receipt_lines TO authenticated;

COMMIT;
