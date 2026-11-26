-- ============================================
-- Phase 2 WP1: Purchase Orders + PO Lines (SCHEMA ONLY)
-- Migration 219
-- Scope (Owner 2026-11-26): WP1 = Schema, Constraints, Indexes, RLS,
--   Contract Definitions เท่านั้น — ห้ามมี Workflow Functions/RPC ในไฟล์นี้
--   (PO Workflow RPC = WP2 — ดู supabase/staged_workflows/wp2_po_workflow_rpc.sql)
-- Dependencies: 214 (suppliers), 217 (supplier_products)
-- ============================================

BEGIN;

-- ============================================
-- Document number contract (schema object)
-- PO number format: PO-YYYYMMDD-{seq 4 digits} — เจเนอเรเตอร์อยู่ใน WP2
-- ============================================
CREATE SEQUENCE IF NOT EXISTS po_number_seq;
COMMENT ON SEQUENCE po_number_seq IS
  'PO number contract: PO-YYYYMMDD-{seq:04d}. Generator function lives in WP2 (staged_workflows/wp2_po_workflow_rpc.sql).';

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                    TEXT PRIMARY KEY,
  po_number             TEXT UNIQUE NOT NULL,
  supplier_id           TEXT NOT NULL REFERENCES suppliers(id),
  status                TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'ordered',
                       'partially_received', 'completed', 'cancelled', 'rejected', 'closed')),
  order_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date         DATE,
  requested_by          UUID REFERENCES auth.users(id),
  approved_by           UUID REFERENCES auth.users(id),
  approved_at           TIMESTAMPTZ,
  subtotal              NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes                 TEXT,
  attachments           JSONB DEFAULT '[]',
  tenant_id             TEXT REFERENCES tenants(id),
  branch_id             TEXT REFERENCES branches(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version               INTEGER NOT NULL DEFAULT 1,
  parent_po_id          TEXT REFERENCES purchase_orders(id),
  revision_reason       TEXT,
  revision_number       INTEGER DEFAULT 1
);

COMMENT ON COLUMN purchase_orders.po_number IS
  'Document number contract: PO-YYYYMMDD-{seq:04d} from po_number_seq. Unique across the system.';
COMMENT ON COLUMN purchase_orders.tenant_id IS
  'ORG ISOLATION: NULL = tenant-wide (tenant-bmb-001 default). Enforced by RLS (has_org_row_scope).';
COMMENT ON COLUMN purchase_orders.branch_id IS
  'BRANCH ISOLATION: NULL = tenant-wide row. Branch-assigned staff see only their own branch (has_org_row_scope).';

-- Purchase Order Lines
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id                    TEXT PRIMARY KEY,
  po_id                 TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  supplier_product_id   TEXT NOT NULL REFERENCES supplier_products(id),
  ingredient_id         TEXT NOT NULL REFERENCES inventory(id),
  ordered_qty           NUMERIC(10,4) NOT NULL CHECK (ordered_qty > 0),
  received_qty          NUMERIC(10,4) NOT NULL DEFAULT 0
    CHECK (received_qty >= 0),
  purchase_unit         TEXT NOT NULL,
  use_unit              TEXT NOT NULL,
  conversion_factor     NUMERIC(10,4) NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
  unit_price            NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
  line_discount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN purchase_order_lines.received_qty IS
  'Cumulative received (purchase units) across ALL GRN lines of this PO line — supports partial receiving + multiple GRNs per PO line. Increased by WP6 posting, decreased by reversal, never negative.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pol_po ON purchase_order_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_pol_ingredient ON purchase_order_lines(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_pol_supplier_product ON purchase_order_lines(supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_tenant_branch ON purchase_orders(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_po_parent ON purchase_orders(parent_po_id);

-- Updated at triggers (m214 pattern: DROP IF EXISTS first for idempotent apply)
DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_order_lines_updated_at ON purchase_order_lines;
CREATE TRIGGER update_purchase_order_lines_updated_at
  BEFORE UPDATE ON purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions (row access limited by RLS in migration 223)
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_order_lines TO authenticated;

COMMIT;

-- RLS is enabled + policies in migration 223 (has_org_row_scope)
