# Phase 2 Design Report — Purchase Orders + Goods Receiving + Purchase Price History
## BMB Smart Ingredient & Cost Management

**Status:** STAGE 2 IMPLEMENTATION AUTHORIZED  
**Phase 1 Gate:** Pending Owner Acceptance (reported complete, live verification pending)  
**Authorization:** Owner authorized Stage 1 + Stage 2 Implementation per OWNER FINAL AUTHORIZATION 2026-11-25  
**Stage 2 Start:** WP1 Database Schema / Migrations / Contract Tests

---

## 1. EXISTING DATA FLOW ANALYSIS

### 1.1 Current Inventory Flow (Verified from Code)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT INVENTORY FLOW (Phase 1 Complete)           │
└─────────────────────────────────────────────────────────────────────────────┘

ORDER CONFIRM (transition_order_status → 'confirmed')
    │
    ▼
deduct_inventory_for_order(p_order_number)
    │
    ├─► For each order_item → recipes → ingredient
    │     • current_stock = GREATEST(current_stock - qty × qty_per_unit, 0)
    │     • INSERT inventory_transactions (type='out', notes='auto-deduct')
    │
    └─► INV-02: If ingredient < min_stock → products.is_available = false
          INSERT inventory_transactions (type='adjustment', notes='auto sold-out')

ORDER CANCEL/FAIL (transition_order_status → 'cancelled'/'failed')
    │
    ▼
restore_inventory_for_order(p_order_number)
    │
    ├─► Find 'auto-deduct' transactions for order
    │     • current_stock = current_stock + quantity
    │     • DELETE 'auto-deduct' transactions
    │
    └─► If ingredient ≥ min_stock → Recover products.is_available = true
          DELETE 'sold_out_auto' transactions
```

**Key RPCs (Production Verified):**
- `deduct_inventory_for_order` — Idempotent, admin-guarded, SECURITY DEFINER
- `restore_inventory_for_order` — Idempotent, admin-guarded, SECURITY DEFINER
- `transition_order_status` — State machine with guard, hooks INV-01 at confirm/cancel

### 1.2 Phase 1 Schema Additions (Migrations 214-218 Applied)

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `suppliers` | id, name, code, contact_name, phone, email, address, payment_terms_days, lead_time_days, is_active | Supplier Master |
| `inventory` (enriched) | supplier_id FK, prep_yield_factor, prep_waste_pct, purchase_unit, use_unit, conversion_factor, package_size, gross_weight, net_weight, wavg_cost, last_purchase_price, last_approved_price | Ingredient Master |
| `supplier_products` | supplier_id, ingredient_id, supplier_sku, supplier_name, purchase_unit, use_unit, conversion_factor, last_committed_price, last_realized_price, last_approved_price, min_order_qty, lead_time_days, is_preferred, is_active | Supplier ↔ Ingredient Mapping (3 Price States) |
| `recipes` (enriched) | batch_yield_factor, batch_waste_pct, cost_per_unit, last_cost_calculated_at | Recipe/BOM Batch Yield |

### 1.3 Current Gaps for Phase 2

| Gap | Impact |
|-----|--------|
| No PO/GRN tables | Cannot track purchase commitments or receipts |
| No price history append-only | Cannot audit price changes |
| No landed cost calculation | Cannot compute true cost per use unit |
| No WAVG atomic update on GRN | WAVG columns exist but no trigger |
| No PO→GRN→Inventory transaction linkage | Traceability broken |
| No partial/over/under receiving logic | Business rules undefined |

---

## 2. DATABASE SCHEMA PROPOSAL

### 2.1 New Tables

```sql
-- ============================================
-- Phase 2: Purchase Orders
-- ============================================
CREATE TABLE purchase_orders (
  id                    TEXT PRIMARY KEY,           -- po-{timestamp}-{rand}
  po_number             TEXT UNIQUE NOT NULL,       -- PO-YYYYMMDD-{seq}
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
  version               INTEGER NOT NULL DEFAULT 1   -- for optimistic locking
);

CREATE TABLE purchase_order_lines (
  id                    TEXT PRIMARY KEY,
  po_id                 TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  supplier_product_id   TEXT NOT NULL REFERENCES supplier_products(id),
  ingredient_id         TEXT NOT NULL REFERENCES inventory(id),  -- denormalized for speed
  ordered_qty           NUMERIC(10,4) NOT NULL CHECK (ordered_qty > 0),
  received_qty          NUMERIC(10,4) NOT NULL DEFAULT 0,
  purchase_unit         TEXT NOT NULL,
  use_unit              TEXT NOT NULL,
  conversion_factor     NUMERIC(10,4) NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
  unit_price            NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),  -- per purchase_unit
  line_discount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total            NUMERIC(12,2) NOT NULL DEFAULT 0,  -- (ordered_qty × unit_price) - discount
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pol_po ON purchase_order_lines(po_id);
CREATE INDEX idx_pol_ingredient ON purchase_order_lines(ingredient_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_number ON purchase_orders(po_number);

-- ============================================
-- Phase 2: Goods Receipt Notes (GRN) — Header + Lines
-- ============================================
CREATE TABLE goods_receipts (
  id                    TEXT PRIMARY KEY,           -- grn-{timestamp}-{rand}
  grn_number            TEXT UNIQUE NOT NULL,       -- GRN-YYYYMMDD-{seq}
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
  reversal_of           TEXT REFERENCES goods_receipts(id),  -- for reversals
  notes                 TEXT,
  attachments           JSONB DEFAULT '[]',
  tenant_id             TEXT REFERENCES tenants(id),
  branch_id             TEXT REFERENCES branches(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE goods_receipt_lines (
  id                    TEXT PRIMARY KEY,
  grn_id                TEXT NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  po_line_id            TEXT NOT NULL REFERENCES purchase_order_lines(id),
  supplier_product_id   TEXT NOT NULL REFERENCES supplier_products(id),
  ingredient_id         TEXT NOT NULL REFERENCES inventory(id),  -- denormalized for speed
  received_qty          NUMERIC(10,4) NOT NULL CHECK (received_qty > 0),
  accepted_qty          NUMERIC(10,4) NOT NULL DEFAULT 0,
  rejected_qty          NUMERIC(10,4) NOT NULL DEFAULT 0,
  purchase_unit         TEXT NOT NULL,
  use_unit              TEXT NOT NULL,
  conversion_factor     NUMERIC(10,4) NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
  actual_unit_price     NUMERIC(12,4) NOT NULL CHECK (actual_unit_price >= 0),  -- per purchase_unit
  line_discount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_allocated    NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_treatment         TEXT CHECK (tax_treatment IN ('recoverable', 'non_recoverable', 'exempt')),
  tax_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  lot_number            TEXT,
  expiry_date           DATE,
  price_variance        NUMERIC(12,4) GENERATED ALWAYS AS (
    actual_unit_price - (SELECT unit_price FROM purchase_order_lines WHERE id = goods_receipt_lines.po_line_id)
  ) STORED,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grl_grn ON goods_receipt_lines(grn_id);
CREATE INDEX idx_grl_po_line ON goods_receipt_lines(po_line_id);
CREATE INDEX idx_grl_ingredient ON goods_receipt_lines(ingredient_id);
CREATE INDEX idx_grn_po ON goods_receipts(po_id);
CREATE INDEX idx_grn_supplier ON goods_receipts(supplier_id);
CREATE INDEX idx_grn_status ON goods_receipts(status);
CREATE INDEX idx_grn_date ON goods_receipts(receipt_date);

-- ============================================
-- Phase 2: Purchase Price History (Append-Only)
-- ============================================
CREATE TABLE purchase_price_history (
  id                    BIGSERIAL PRIMARY KEY,
  supplier_id           TEXT NOT NULL REFERENCES suppliers(id),
  supplier_product_id   TEXT NOT NULL REFERENCES supplier_products(id),
  ingredient_id         TEXT NOT NULL REFERENCES inventory(id),
  po_id                 TEXT REFERENCES purchase_orders(id),
  po_line_id            TEXT REFERENCES purchase_order_lines(id),
  grn_id                TEXT REFERENCES goods_receipts(id),
  grn_line_id           TEXT REFERENCES goods_receipt_lines(id),
  price_type            TEXT NOT NULL 
    CHECK (price_type IN ('quoted', 'committed', 'realized', 'landed', 'approved')),
  purchase_unit         TEXT NOT NULL,
  use_unit              TEXT NOT NULL,
  conversion_factor     NUMERIC(10,4) NOT NULL,
  package_size          NUMERIC(10,2),
  ordered_qty           NUMERIC(10,4),
  received_qty          NUMERIC(10,4),
  unit_price            NUMERIC(12,4) NOT NULL,  -- per purchase_unit
  price_per_use_unit    NUMERIC(12,4) GENERATED ALWAYS AS (unit_price / conversion_factor) STORED,
  discount_allocated    NUMERIC(12,2) DEFAULT 0,
  shipping_allocated    NUMERIC(12,2) DEFAULT 0,
  tax_treatment         TEXT CHECK (tax_treatment IN ('recoverable', 'non_recoverable', 'exempt')),
  landed_cost           NUMERIC(12,4),
  effective_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  approval_status       TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  source_user           UUID REFERENCES auth.users(id),
  source_document       TEXT,  -- 'PO', 'GRN', 'PRICE_APPROVAL', 'MANUAL'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pph_supplier ON purchase_price_history(supplier_id, effective_date DESC);
CREATE INDEX idx_pph_ingredient ON purchase_price_history(ingredient_id, effective_date DESC);
CREATE INDEX idx_pph_grn ON purchase_price_history(grn_id);
CREATE INDEX idx_pph_grn_line ON purchase_price_history(grn_line_id);
CREATE INDEX idx_pph_type ON purchase_price_history(price_type, effective_date DESC);

-- ============================================
-- Phase 2: Inventory Transaction Extension
-- ============================================
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS po_id TEXT REFERENCES purchase_orders(id),
  ADD COLUMN IF NOT EXISTS grn_id TEXT REFERENCES goods_receipts(id),
  ADD COLUMN IF NOT EXISTS grn_line_id TEXT REFERENCES goods_receipt_lines(id),
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,4),  -- per use_unit for WAVG
  ADD COLUMN IF NOT EXISTS conversion_snapshot NUMERIC(10,4);
```

### 2.2 Modified Existing Tables

```sql
-- Purchase Orders: add revision tracking
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS parent_po_id TEXT REFERENCES purchase_orders(id),  -- for revisions
  ADD COLUMN IF NOT EXISTS revision_reason TEXT,
  ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 1;

-- Supplier Products: add price state timestamps (already in migration 217)
-- Ensure indexes exist for price lookups
CREATE INDEX IF NOT EXISTS idx_sp_committed ON supplier_products(last_committed_price) WHERE last_committed_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sp_realized ON supplier_products(last_realized_price) WHERE last_realized_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sp_approved ON supplier_products(last_approved_price) WHERE last_approved_price IS NOT NULL;
```

---

## 3. PO / GRN STATE MACHINE

### 3.1 Purchase Order States

```
DRAFT ──(submit)──► SUBMITTED ──(approve)──► APPROVED ──(send to supplier)──► ORDERED
                                                                     │
                                                                     ▼
                                                          PARTIALLY_RECEIVED ──(full receipt)──► COMPLETED
                                                                     │
                                                                     ├─(cancel outstanding)──► CLOSED
                                                                     │
                                                                     └─(reject)──► REJECTED
                                                                   
DRAFT ──(cancel)──► CANCELLED
SUBMITTED ──(reject)──► REJECTED
APPROVED ──(cancel)──► CANCELLED
ORDERED ──(cancel)──► CANCELLED (if no receipts)
```

### 3.2 GRN States

```
DRAFT ──(submit)──► SUBMITTED ──(approve)──► APPROVED ──(post)──► POSTED
                                                              │
                                                              ├─(reverse)──► REVERSED
                                                              │
                                                              └─(reject)──► REJECTED

DRAFT ──(cancel)──► CANCELLED
SUBMITTED ──(reject)──► REJECTED
APPROVED ──(cancel)──► CANCELLED
```

### 3.3 State Transition Rules

| From → To | Actor | Conditions | Side Effects |
|-----------|-------|------------|--------------|
| draft → submitted | Creator | All lines have qty > 0, supplier active | Audit log |
| submitted → approved | Approver (finance/inventory role) | Budget check, supplier terms | PO number assigned, notify supplier |
| approved → ordered | Inventory/Procurement | Supplier confirmation | Status change only |
| ordered → partially_received | Receiver | GRN posted with qty < ordered | Stock +WAVG update |
| partially_received → completed | Receiver | All lines fully received | PO closed |
| partially_received → closed | Manager | Business decision, outstanding qty > 0 | Outstanding recorded |
| posted → reversed | Finance/Inventory | Within 30 days, qty ≤ received | Stock -WAVG reversal |

### 3.4 Role Permissions Matrix

| Action | Creator | Approver (finance) | Inventory Staff | Receiver | Admin |
|--------|---------|-------------------|-----------------|----------|-------|
| Create PO (draft) | ✅ | ✅ | ✅ | ❌ | ✅ |
| Submit PO | ✅ | ✅ | ✅ | ❌ | ✅ |
| Approve PO | ❌ | ✅ | ❌ | ❌ | ✅ |
| Create GRN (draft) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve GRN | ❌ | ✅ | ✅ | ❌ | ✅ |
| Post GRN | ❌ | ❌ | ✅ | ✅ | ✅ |
| Reverse GRN | ❌ | ✅ | ❌ | ❌ | ✅ |
| Cancel PO/GRN | ✅ (own) | ✅ | ✅ | ❌ | ✅ |

**RLS Policies Required:**
- `po_admin_all` — admin full access
- `po_creator_rw` — creator can read/write own drafts
- `po_approver_rw` — finance role can read/write submitted/approved
- `po_inventory_rw` — inventory role can read/write ordered/receiving
- `po_receiver_r` — receiver can read ordered POs
- `grn_admin_all` — admin full access
- `grn_creator_rw` — creator can read/write own drafts
- `grn_approver_rw` — approver can read/write submitted/approved
- `grn_inventory_rw` — inventory can read/write posted
- `grn_receiver_rw` — receiver can read/write drafts/posted

---

## 4. COST CALCULATION SPECIFICATION

### 4.1 Price Definitions (Owner Decision B4)

| Price Type | Source | Description | When Set |
|------------|--------|-------------|----------|
| **Quoted** | Supplier quote | Informational only | PO draft |
| **Committed** | PO approved | Contractual price per purchase_unit | PO approved |
| **Realized** | GRN posted | Actual price paid per purchase_unit | GRN posted |
| **Landed** | GRN + allocations | True cost per purchase_unit incl. shipping/tax | GRN posted + allocation |
| **Approved** | Admin policy | Price used for costing per purchase_unit | Admin approval |

### 4.2 Unit Conversion (Owner Decision B2)

```
purchase_unit → use_unit conversion:
  conversion_factor = use_units per 1 purchase_unit
  
Examples:
  carton (24 bottles) → bottle: conversion_factor = 24
  kg → g: conversion_factor = 1000
  pack (10 pieces) → piece: conversion_factor = 10

Formula:
  use_qty = purchase_qty × conversion_factor
  price_per_use_unit = price_per_purchase_unit / conversion_factor
```

### 4.3 Landed Cost Calculation

```
Landed Cost per Purchase Unit =
  (Line Subtotal + Line Discount + Order Discount Allocation 
   + Shipping Allocation + Non-recoverable Tax Allocation)
  / Received Quantity

Allocation Methods:
  • Shipping: by value (line_subtotal / po_subtotal × total_shipping)
  • Order Discount: by value (line_subtotal / po_subtotal × order_discount)
  • Non-recoverable Tax: by value or by quantity (configurable per tax type)

Recoverable Tax (VAT): EXCLUDED from landed cost, tracked separately
```

### 4.4 Price Per Use Unit (Critical for Comparison)

```
For Supplier Product Mapping comparison:
  price_per_use_unit = unit_price / conversion_factor
  
Where:
  • unit_price = last_approved_price (for costing) OR last_realized_price (for actuals)
  • conversion_factor from supplier_products table
  
This enables apples-to-apples comparison across suppliers with different package sizes.
```

---

## 5. UNIT CONVERSION SPECIFICATION

### 5.1 Conversion Rules

| Rule | Enforcement |
|------|-------------|
| conversion_factor > 0 | CHECK constraint |
| purchase_unit and use_unit both required if either set | CHECK constraint (inventory_units_consistency) |
| Conversion snapshot at GRN time | Stored in inventory_transactions.conversion_snapshot |
| Supplier Product conversion must match Ingredient conversion | Application validation on GRN post |
| Changes to conversion_factor require new GRN (no retroactive) | Business rule |

### 5.2 Conversion at GRN Post

```
GRN Input (purchase_unit):
  received_qty_purchase = received_qty (user input)
  
Convert to Use Unit for Inventory:
  received_qty_use = received_qty_purchase × conversion_factor_snapshot
  
Update Inventory:
  inventory.current_stock += received_qty_use
  
WAVG Calculation:
  new_wavg = (old_stock × old_wavg + received_qty_use × landed_cost_per_use_unit) 
             / (old_stock + received_qty_use)
```

### 5.3 Edge Cases

| Scenario | Handling |
|----------|----------|
| conversion_factor changes after PO but before GRN | Use GRN-time snapshot (stored in GRN line) |
| Supplier Product conversion ≠ Ingredient conversion | Block GRN post, require alignment |
| conversion_factor = 0 or NULL | Block (CHECK constraint) |
| Package size ≠ conversion_factor | Package size is informational; conversion_factor is authoritative |

---

## 6. STOCK VALUATION IMPACT (WAVG)

### 6.1 WAVG Formula (Owner Direction: Perpetual Moving Weighted Average)

```
New WAVG = (Old_Stock_Qty × Old_WAVG + Received_Qty_Use_Unit × Landed_Cost_Per_Use_Unit)
           / (Old_Stock_Qty + Received_Qty_Use_Unit)

Where:
  • Old_Stock_Qty = inventory.current_stock BEFORE GRN post (in use_unit)
  • Received_Qty_Use_Unit = grn.received_qty × conversion_factor (in use_unit)
  • Landed_Cost_Per_Use_Unit = grn.landed_cost / conversion_factor
```

### 6.2 Atomic GRN Post Transaction

```sql
CREATE OR REPLACE FUNCTION post_goods_receipt(p_grn_id text, p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grn goods_receipts%ROWTYPE;
  v_po_line purchase_order_lines%ROWTYPE;
  v_ingredient inventory%ROWTYPE;
  v_old_stock numeric;
  v_old_wavg numeric;
  v_received_use numeric;
  v_landed_use numeric;
  v_new_wavg numeric;
  v_new_stock numeric;
BEGIN
  -- 1. Lock GRN row
  SELECT * INTO v_grn FROM goods_receipts WHERE id = p_grn_id FOR UPDATE;
  IF v_grn.status != 'approved' THEN RAISE EXCEPTION 'GRN not approved'; END IF;
  IF v_grn.idempotency_key IS NOT NULL AND v_grn.idempotency_key != p_idempotency_key THEN
    RAISE EXCEPTION 'Idempotency key mismatch';
  END IF;

  -- 2. Lock PO line
  SELECT * INTO v_po_line FROM purchase_order_lines WHERE id = v_grn.po_line_id FOR UPDATE;

  -- 3. Lock ingredient
  SELECT * INTO v_ingredient FROM inventory WHERE id = v_po_line.ingredient_id FOR UPDATE;
  v_old_stock := v_ingredient.current_stock;
  v_old_wavg := v_ingredient.wavg_cost;

  -- 4. Compute received in use_unit
  v_received_use := v_grn.received_qty * v_grn.conversion_factor;
  v_landed_use := v_grn.landed_cost / v_grn.conversion_factor;

  -- 5. Compute new WAVG
  IF v_old_stock + v_received_use > 0 THEN
    v_new_wavg := (v_old_stock * COALESCE(v_old_wavg, 0) + v_received_use * v_landed_use) 
                  / (v_old_stock + v_received_use);
  ELSE
    v_new_wavg := v_landed_use;
  END IF;
  v_new_stock := v_old_stock + v_received_use;

  -- 6. Update inventory (atomic)
  UPDATE inventory SET
    current_stock = v_new_stock,
    wavg_cost = v_new_wavg,
    last_purchase_price = v_grn.actual_unit_price / v_grn.conversion_factor,
    last_approved_price = v_grn.actual_unit_price / v_grn.conversion_factor,  -- or keep separate
    updated_at = NOW()
  WHERE id = v_ingredient.id;

  -- 7. Insert inventory_transaction (audit trail)
  INSERT INTO inventory_transactions (
    id, inventory_id, type, quantity, unit_cost, conversion_snapshot,
    reference_type, reference_id, notes, created_by, created_at
  ) VALUES (
    'itx-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 6),
    v_ingredient.id, 'in', v_received_use, v_landed_use, v_grn.conversion_factor,
    'grn', v_grn.id, 'GRN post: ' || v_grn.grn_number, auth.uid()::text, NOW()
  );

  -- 8. Update PO line received_qty
  UPDATE purchase_order_lines SET
    received_qty = received_qty + v_grn.received_qty,
    updated_at = NOW()
  WHERE id = v_po_line.id;

  -- 9. Check PO completion
  IF (SELECT bool_and(received_qty >= ordered_qty) FROM purchase_order_lines WHERE po_id = v_grn.po_id) THEN
    UPDATE purchase_orders SET status = 'completed', updated_at = NOW() WHERE id = v_grn.po_id;
  ELSIF (SELECT bool_or(received_qty > 0) FROM purchase_order_lines WHERE po_id = v_grn.po_id) THEN
    UPDATE purchase_orders SET status = 'partially_received', updated_at = NOW() WHERE id = v_grn.po_id;
  END IF;

  -- 10. Append to price history (all 3 states)
  INSERT INTO purchase_price_history (
    supplier_id, supplier_product_id, ingredient_id, po_id, po_line_id, grn_id,
    price_type, purchase_unit, use_unit, conversion_factor, package_size,
    ordered_qty, received_qty, unit_price, discount_allocated, shipping_allocated,
    tax_treatment, landed_cost, effective_date, approval_status, source_user, source_document
  ) VALUES
    -- Committed (from PO)
    (v_grn.supplier_id, v_grn.supplier_product_id, v_grn.ingredient_id, v_grn.po_id, v_grn.po_line_id, v_grn.id,
     'committed', v_po_line.purchase_unit, v_po_line.use_unit, v_po_line.conversion_factor, v_po_line.package_size,
     v_po_line.ordered_qty, 0, v_po_line.unit_price, 0, 0, 'exempt', NULL, v_grn.receipt_date, 'approved', auth.uid(), 'PO'),
    -- Realized (from GRN)
    (v_grn.supplier_id, v_grn.supplier_product_id, v_grn.ingredient_id, v_grn.po_id, v_grn.po_line_id, v_grn.id,
     'realized', v_grn.purchase_unit, v_grn.use_unit, v_grn.conversion_factor, v_grn.package_size,
     v_po_line.ordered_qty, v_grn.received_qty, v_grn.actual_unit_price, 
     v_grn.discount_allocated, v_grn.shipping_allocated, v_grn.tax_treatment, v_grn.landed_cost, 
     v_grn.receipt_date, 'approved', auth.uid(), 'GRN'),
    -- Landed
    (v_grn.supplier_id, v_grn.supplier_product_id, v_grn.ingredient_id, v_grn.po_id, v_grn.po_line_id, v_grn.id,
     'landed', v_grn.purchase_unit, v_grn.use_unit, v_grn.conversion_factor, v_grn.package_size,
     v_po_line.ordered_qty, v_grn.received_qty, v_grn.landed_cost, 
     v_grn.discount_allocated, v_grn.shipping_allocated, v_grn.tax_treatment, v_grn.landed_cost,
     v_grn.receipt_date, 'approved', auth.uid(), 'GRN');

  -- 11. Update supplier_products price states
  UPDATE supplier_products SET
    last_realized_price = v_grn.actual_unit_price,
    last_realized_at = NOW(),
    last_approved_price = v_grn.actual_unit_price,  -- or separate approval flow
    last_approved_at = NOW(),
    last_purchase_date = v_grn.receipt_date
  WHERE id = v_grn.supplier_product_id;

  -- 12. Mark GRN posted
  UPDATE goods_receipts SET
    status = 'posted',
    posted_by = auth.uid(),
    posted_at = NOW(),
    accepted_qty = v_grn.received_qty - v_grn.rejected_qty
  WHERE id = p_grn_id;

  RETURN jsonb_build_object('ok', true, 'new_stock', v_new_stock, 'new_wavg', v_new_wavg);
END;
$$;
```

### 6.3 Race Condition Prevention

| Mechanism | Implementation |
|-----------|----------------|
| Row-level locks | `FOR UPDATE` on GRN, PO line, ingredient |
| Idempotency key | Unique `idempotency_key` on GRN, checked before post |
| Transaction atomicity | Single DB transaction for stock + WAVG + history |
| Version check | `purchase_orders.version` for optimistic locking on PO edits |

---

## 7. API / RPC DESIGN

### 7.1 New RPCs

| RPC | Purpose | Parameters | Returns |
|-----|---------|------------|---------|
| `create_purchase_order` | Create PO draft | supplier_id, lines[], dates, amounts | po_id, po_number |
| `update_purchase_order` | Edit PO draft | po_id, fields, version | updated PO |
| `submit_purchase_order` | Draft → Submitted | po_id | status |
| `approve_purchase_order` | Submitted → Approved | po_id, approver_id | po_number, status |
| `create_grn_draft` | Create GRN draft (header + lines) | po_id, lines[{po_line_id, received_qty, accepted_qty, rejected_qty, actual_unit_price, lot_number, expiry_date, line_discount, shipping_allocated, tax_treatment, tax_amount}], receipt_date, received_by | grn_id |
| `approve_grn` | Draft → Approved | grn_id, approver_id | status |
| `post_goods_receipt` | Approved → Posted (atomic, per GRN line) | grn_id, idempotency_key | {posted_lines: [{grn_line_id, new_stock, new_wavg}]} |
| `reverse_grn` | Posted → Reversed | grn_id, reason | reversal_grn_id |
| `get_purchase_price_history` | Query price history | ingredient_id, supplier_id?, date_range | price_history[] |
| `get_po_dashboard` | Dashboard data | date_range, supplier_id? | aggregated metrics |
| `calculate_landed_cost` | Compute landed cost per GRN line | po_id, grn_lines[] | allocations[] |

### 7.2 Frontend API Layer (TypeScript)

```typescript
// src/lib/bmbAdminApi_purchaseOrders.ts
export interface PurchaseOrderForm {
  supplier_id: string;
  expected_date: string;
  lines: {
    supplier_product_id: string;
    ordered_qty: number;
    unit_price: number;
    line_discount?: number;
  }[];
  shipping_amount?: number;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string;
}

export async function createPurchaseOrder(data: PurchaseOrderForm): Promise<string | null>
export async function updatePurchaseOrder(id: string, data: Partial<PurchaseOrderForm>, version: number): Promise<boolean>
export async function submitPurchaseOrder(id: string): Promise<boolean>
export async function approvePurchaseOrder(id: string): Promise<{ po_number: string } | null>
export async function getPurchaseOrders(filters?: POFilters): Promise<PurchaseOrder[]>

// src/lib/bmbAdminApi_goodsReceipts.ts
export interface GRNLineForm {
  po_line_id: string;
  supplier_product_id: string;
  received_qty: number;
  accepted_qty?: number;
  rejected_qty?: number;
  actual_unit_price: number;
  line_discount?: number;
  shipping_allocated?: number;
  tax_treatment?: 'recoverable' | 'non_recoverable' | 'exempt';
  tax_amount?: number;
  lot_number?: string;
  expiry_date?: string;
  notes?: string;
}

export interface GRNForm {
  po_id: string;
  receipt_date: string;
  lines: GRNLineForm[];
  received_by?: string;
  notes?: string;
}

export async function createGRNDraft(data: GRNForm): Promise<string | null>
export async function approveGRN(id: string): Promise<boolean>
export async function postGoodsReceipt(id: string, idempotencyKey: string): Promise<{ posted_lines: { grn_line_id: string; new_stock: number; new_wavg: number }[] } | null>
export async function reverseGRN(id: string, reason: string): Promise<string | null>

// src/lib/bmbAdminApi_purchasePriceHistory.ts
export async function getPurchasePriceHistory(filters: {
  ingredient_id?: string;
  supplier_id?: string;
  price_type?: 'quoted' | 'committed' | 'realized' | 'landed' | 'approved';
  date_from?: string;
  date_to?: string;
}): Promise<PriceHistoryEntry[]>
```

---

## 8. RLS / PERMISSION MATRIX

### 8.1 New Table Policies

```sql
-- Purchase Orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY po_admin ON purchase_orders
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Creator read/write own drafts
CREATE POLICY po_creator_rw ON purchase_orders
  FOR ALL TO authenticated USING (
    requested_by = auth.uid() AND status IN ('draft', 'submitted')
  ) WITH CHECK (requested_by = auth.uid());

-- Finance approver read/write submitted/approved
CREATE POLICY po_finance_rw ON purchase_orders
  FOR ALL TO authenticated USING (
    public.is_finance() AND status IN ('submitted', 'approved', 'ordered')
  ) WITH CHECK (public.is_finance());

-- Inventory/Procurement read/write ordered/receiving
CREATE POLICY po_inventory_rw ON purchase_orders
  FOR ALL TO authenticated USING (
    public.is_inventory() AND status IN ('approved', 'ordered', 'partially_received', 'completed')
  ) WITH CHECK (public.is_inventory());

-- Receiver read ordered POs
CREATE POLICY po_receiver_r ON purchase_orders
  FOR SELECT TO authenticated USING (
    public.is_inventory() AND status IN ('ordered', 'partially_received')
  );

-- Goods Receipts (Header)
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY grn_admin ON goods_receipts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY grn_creator_rw ON goods_receipts
  FOR ALL TO authenticated USING (
    received_by = auth.uid() AND status IN ('draft', 'submitted')
  ) WITH CHECK (received_by = auth.uid());

CREATE POLICY grn_approver_rw ON goods_receipts
  FOR ALL TO authenticated USING (
    public.is_inventory() AND status IN ('submitted', 'approved', 'posted')
  ) WITH CHECK (public.is_inventory());

-- Goods Receipt Lines
ALTER TABLE goods_receipt_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY grl_admin ON goods_receipt_lines
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY grl_inventory_rw ON goods_receipt_lines
  FOR ALL TO authenticated USING (
    public.is_inventory()
  ) WITH CHECK (public.is_inventory());

CREATE POLICY grl_receiver_r ON goods_receipt_lines
  FOR SELECT TO authenticated USING (
    public.is_inventory()
  );

-- Purchase Price History (read-only for staff, admin full)
ALTER TABLE purchase_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY pph_admin ON purchase_price_history FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY pph_staff_read ON purchase_price_history FOR SELECT TO authenticated USING (
  public.is_inventory() OR public.is_finance() OR public.is_kitchen() OR public.is_pos()
);
```

### 8.2 Role Function Dependencies

Requires `public.is_inventory()`, `public.is_finance()`, `public.is_kitchen()`, `public.is_pos()` from Migration 146 (Role Foundation) — already deployed.

---

## 9. UI SCREEN / WORKFLOW SPECIFICATION

### 9.1 PurchaseHub Tabs (Extend Existing)

```
/admin/purchase
├── /dashboard          → Purchase Dashboard (B1)
├── /suppliers          → Supplier Master (existing)
├── /mappings           → Supplier Product Mapping (existing)
├── /purchase-orders    → PO List + Create/Edit (B2, B3)
├── /goods-receipts     → GRN List + Create/Edit (D1)
└── /price-history      → Purchase Price History (F)
```

### 9.2 Screen Specifications

#### B1. Purchase Dashboard
- **Cards**: Total POs by status, Total GRNs pending, Total spend (period), Outstanding qty
- **Tables**: POs needing action, GRNs awaiting approval, Top suppliers by spend
- **Filters**: Date range, Supplier, Status
- **Data Source**: `get_po_dashboard` RPC + real-time counts

#### B2. Supplier Selection (PO Create)
- **Supplier Picker**: Searchable dropdown (active suppliers only)
- **Product Grid**: From `supplier_products` where supplier_id = selected
- **Columns**: SKU, Supplier Name, Ingredient (linked), Purchase Unit, Use Unit, Conversion, 3 Prices
- **Actions**: Checkbox select → "Add to PO"
- **Warnings**: Highlight mappings missing conversion_factor or prices

#### B3. Create/Edit PO
- **Header**: Supplier (locked after submit), Dates, Notes, Attachments
- **Lines Table**: 
  - Ingredient (from mapping, read-only)
  - SKU/Supplier Name (read-only)
  - Purchase Unit / Use Unit / Conversion (read-only from mapping)
  - Ordered Qty (editable)
  - Unit Price (editable, defaults from mapping.last_approved_price)
  - Line Discount (editable)
  - Line Total (computed: qty × price - discount)
- **Footer**: Subtotal, Discount Total, Shipping, Tax, Grand Total (all computed)
- **Actions**: Save Draft, Submit for Approval

#### D1. Create GRN (from PO)
- **PO Context**: PO Number, Supplier, Status, Expected Date
- **Header**: Receipt Date, Receiver, Notes, Attachments
- **Lines** (only PO lines with outstanding qty > 0):
  - Ordered / Previously Received / Remaining (computed)
  - Received Qty (input, max = remaining)
  - Accepted / Rejected Qty (split)
  - Purchase Unit / Use Unit / Conversion (read-only from mapping)
  - PO Price / Actual Price / Variance (computed)
  - Line Discount, Shipping Allocation, Tax Treatment, Tax Amount
  - Lot Number, Expiry Date (optional)
- **Footer**: Totals (Qty, Amount)
- **Actions**: Save Draft, Submit, Approve & Post

#### F. Price History
- **Table**: Date, Supplier, Ingredient, PO/GRN, Price Type, Purchase Unit, Use Unit, Price/Purchase, Price/Use Unit, Landed Cost
- **Filters**: Ingredient, Supplier, Price Type, Date Range
- **Comparison View**: Group by Ingredient → show all suppliers' approved prices per use unit

---

## 10. TEST MATRIX

### 10.1 J1: Database / API / Contract Tests

| Test ID | Scenario | Expected |
|---------|----------|----------|
| DB-PO-01 | Create PO draft with valid lines | PO created, version=1 |
| DB-PO-02 | Submit PO → status=submitted | Status changed, audit log |
| DB-PO-03 | Approve PO → status=approved, po_number assigned | PO number unique, notified |
| DB-PO-04 | Duplicate PO number rejected | Unique constraint |
| DB-PO-05 | Edit approved PO blocked | RLS/Business rule |
| DB-PO-06 | PO revision creates new version | parent_po_id set, revision_number++ |
| DB-GRN-01 | Create GRN draft (header + multiple lines) from approved PO | GRN linked to PO, lines linked to PO lines |
| DB-GRN-02 | Partial receive (qty < ordered) on one line | PO status=partially_received |
| DB-GRN-03 | Full receive (all lines qty = ordered) | PO status=completed |
| DB-GRN-04 | Over-receive blocked | Validation error |
| DB-GRN-05 | GRN post atomic per line: stock + WAVG + history | All or nothing per line |
| DB-GRN-06 | Idempotent GRN post (same key) | Returns same result, no duplicate |
| DB-GRN-07 | Concurrent GRN posts serialized | Row locks prevent race |
| DB-GRN-08 | GRN reversal restores stock/WAVG per line | Stock -qty, WAVG recalculated |
| DB-GRN-09 | Reversal blocked if qty > received | Validation error |
| DB-GRN-10 | Multiple lines in one GRN post independently | Each line updates own ingredient |
| DB-GRN-11 | Rejected/Damaged qty not added to stock | accepted_qty only affects stock |
| DB-PRICE-01 | Price history append-only (no UPDATE) | Trigger blocks UPDATE |
| DB-PRICE-02 | 3 price states recorded per GRN line | committed, realized, landed |
| DB-CONV-01 | Conversion factor snapshot at GRN line | Stored in inventory_tx |
| DB-CONV-02 | Supplier product conv ≠ ingredient conv → block | Validation error |
| DB-WAVG-01 | WAVG formula correct (zero stock edge) | new_wavg = landed_cost |
| DB-WAVG-02 | WAVG formula correct (existing stock) | Weighted average |
| DB-WAVG-03 | Return/reversal recalculates WAVG | Reverse formula |
| DB-INT-01 | Inventory transaction links GRN line | grn_line_id populated |

### 10.2 J2: UI / E2E Tests

| Test ID | Workflow | Pass Criteria |
|---------|----------|---------------|
| E2E-01 | Open PurchaseHub → navigate all tabs | No 404, all load |
| E2E-02 | Create PO: select supplier → add lines → save draft | Draft persists, reload shows data |
| E2E-03 | Submit PO → approve → verify status | Approved, PO number assigned |
| E2E-04 | Create GRN from PO → partial receive | Outstanding qty correct |
| E2E-05 | Second GRN for same PO → complete | PO status=completed |
| E2E-06 | GRN post → verify stock increased | Inventory.current_stock += qty×conv |
| E2E-07 | GRN post → verify WAVG updated | WAVG = weighted average |
| E2E-08 | GRN post → verify price history | 3 rows appended |
| E2E-09 | Duplicate GRN post (same idempotency) | No duplicate stock/history |
| E2E-10 | Reject goods in GRN → rejected_qty recorded | Rejected tracked, not stocked |
| E2E-11 | GRN reversal → stock restored | Stock -= qty, WAVG recalculated |
| E2E-12 | Price history comparison view | All suppliers per ingredient per use unit |
| E2E-13 | Permission: non-approver cannot approve | 403/RLS block |
| E2E-14 | Responsive: mobile PO create works | Form usable on 375px |
| E2E-15 | Validation: negative qty blocked | Toast error in Thai |
| E2E-16 | Validation: price variance warning | Toast warning if >5% |
| E2E-17 | Attachments upload → linked to PO/GRN | Files accessible |
| E2E-18 | Audit trail visible on PO/GRN detail | All transitions logged |

### 10.3 J3: Integration / Regression Tests

| Test ID | Scenario | Must Not Break |
|---------|----------|----------------|
| REG-01 | Existing order flow (cart→checkout→confirm) | Stock deduction works |
| REG-02 | Order cancel → restore_inventory | Stock restored correctly |
| REG-03 | Recipe cost calculation | Uses wavg_cost |
| REG-04 | Inventory CRUD (Phase 1) | All fields work |
| REG-05 | Supplier Master CRUD | All fields work |
| REG-06 | Supplier Mapping CRUD | Price states work |
| REG-07 | Admin navigation | PurchaseHub accessible |
| REG-08 | RLS: inventory role sees POs | Correct filtering |
| REG-09 | Cart sync (I-1/I-2) | Unaffected |
| REG-10 | Background music / Mascot | Unaffected |

---

## 11. MIGRATION PLAN

### 11.1 Migration Sequence

| Order | Migration | Description | Dependencies |
|-------|-----------|-------------|--------------|
| 1 | `219_purchase_orders.sql` | PO + PO lines tables | 214, 217 (suppliers, supplier_products) |
| 2 | `220_goods_receipts.sql` | GRN header + lines tables | 219 |
| 3 | `221_purchase_price_history.sql` | Price history table | 219, 220 |
| 4 | `222_inventory_transaction_ext.sql` | Extend inventory_transactions | 216, 220 |
| 5 | `223_wavg_trigger.sql` | WAVG atomic update function | 216, 222 |
| 6 | `224_po_grn_rls.sql` | RLS policies for new tables | 146 (roles) |
| 7 | `225_po_grn_rpcs.sql` | RPCs for PO/GRN workflow | 219-224 |

### 11.2 Migration Safety

- **All migrations**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
- **RLS**: Enable after table creation, policies use existing role functions
- **Data migration**: None required (new tables empty)
- **Backward compatibility**: No existing tables modified destructively
- **Rollback**: Each migration has `DROP TABLE IF EXISTS` in reverse order

---

## 12. ROLLBACK / RECOVERY PLAN

### 12.1 Rollback Procedure

| Failure Point | Rollback Action |
|---------------|-----------------|
| Migration 223 (WAVG function) fails | Drop function, tables intact |
| Migration 224 (RLS) blocks access | `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` temporarily |
| Migration 225 (RPCs) has bugs | `DROP FUNCTION` new RPCs, old RPCs unchanged |
| GRN post corrupts WAVG | Manual correction: `UPDATE inventory SET wavg_cost = correct_value` |
| Duplicate GRN posts | Idempotency key prevents; if bypassed, delete duplicate inventory_tx |

### 12.2 Recovery Scripts

```sql
-- Emergency WAVG Recalculation (run as admin)
SELECT recalculate_all_wavg();  -- Function to recompute from inventory_transactions

-- Emergency GRN Reversal (if posted in error)
SELECT reverse_grn('grn-id', 'Emergency reversal');

-- Verify Price History Integrity
SELECT * FROM verify_price_history_integrity();
```

---

## 13. PHASE GATE CHECKLIST

### Stage 1: Design & Dependency Audit ✅ COMPLETE
- [x] Existing Data Flow documented
- [x] Database Schema Proposal complete (GRN Header + Lines corrected)
- [x] PO/GRN State Machine defined
- [x] Cost Calculation Specification complete
- [x] Unit Conversion Specification complete
- [x] Stock Valuation Impact analyzed
- [x] API/RPC Design complete (updated for GRN lines)
- [x] RLS/Permission Matrix complete (added goods_receipt_lines)
- [x] UI Screen/Workflow Specification complete
- [x] Test Matrix defined (J1, J2, J3)
- [x] Migration Plan defined
- [x] Rollback/Recovery Plan defined

### Stage 2: Implementation ✅ AUTHORIZED (Owner 2026-11-25)
- [x] Phase 1 Dependency Verification PASSED
- [x] Owner approves Design Report (with GRN Header+Lines correction)
- [x] Migration Plan reviewed for production safety
- [x] Test environment provisioned
- [ ] WP1: Database Schema / Migrations / Contract Tests
- [ ] WP2: Purchase Order Database / RPC / API
- [ ] WP3: Purchase Order UI / E2E
- [ ] WP4: Goods Receipt Database / RPC / API
- [ ] WP5: Goods Receipt UI / E2E
- [ ] WP6: Inventory Integration / WAVG / Idempotency
- [ ] WP7: Price History / Landed Cost
- [ ] WP8: PurchaseHub Integration / UX
- [ ] WP9: Regression / Security / Performance
- [ ] WP10: Documentation / Handoff

### Stage 3: Verification
- [ ] All J1 contract tests pass (CI)
- [ ] All J2 E2E tests pass (Playwright)
- [ ] All J3 regression tests pass
- [ ] Production smoke test (read-only)

### Stage 4: Owner Acceptance
- [ ] Owner live test PO→GRN→Stock→Price History workflow
- [ ] Evidence documented
- [ ] Phase 2 Gate PASSED

---

## 14. OWNER DECISIONS — 7 OPEN QUESTIONS RESOLVED

| # | Question | Owner Decision | Implementation Impact |
|---|----------|----------------|----------------------|
| 1 | PO Number format | `PO-YYYYMMDD-{seq}` global, branch in metadata, sequence via DB atomic counter | Use `nextval('po_number_seq')` in RPC |
| 2 | GRN approval workflow | Single approval by Inventory role; Finance audit trail only | RLS: inventory role can approve; finance read-only |
| 3 | Price variance tolerance | Warning >5%, Block auto-approve >15%; both configurable in settings | Check in `approve_grn` RPC; read from `business_settings` |
| 4 | Landed cost allocation | Shipping: by value; Tax: per tax_treatment; Recoverable tax excluded | Implement in `calculate_landed_cost` RPC |
| 5 | Historical correction | Append-only correction entry; no retroactive rewrite | New `price_type='correction'` or separate correction table |
| 6 | GRN reversal time limit | 30 days default, configurable by Owner; special permission beyond | Check `receipt_date` + interval in `reverse_grn` |
| 7 | Partial PO close / backorder | Allow close with outstanding; create backorder PO linked to parent; confirm required | New status `closed`; `parent_po_id` on backorder |

---

**Report Status:** DESIGN COMPLETE + OWNER DECISIONS RESOLVED — **STAGE 2 IMPLEMENTATION AUTHORIZED**  
**Next Action:** Begin WP1 — Database Schema / Migrations / Contract Tests (Migration 219)


---

## 15. WP1 REMEDIATION RECORD (Owner Review Round — 2026-11-26)

> สถานะเอกสารส่วนนี้: ผลการแก้ไข WP1 ตามคำสั่ง Owner "WP1 REMEDIATION &
> SCOPE CORRECTION" ครบทุกข้อ A-G รอ Owner ตรวจรับ

### 15.1 Defect Matrix — ก่อนแก้ / หลังแก้

| # | Defect (ก่อนแก้) | หลักฐานก่อนแก้ | การแก้ (หลัง) | หลักฐานหลังแก้ |
|---|---|---|---|---|
| 1 | `goods_receipt_lines.price_variance` เป็น GENERATED column ที่มี subquery → PostgreSQL ห้าม → apply ตารางพัง | 220 เดิม บรรทัด 50-52 | ลบ column ทิ้ง — variance คำนวณใน read layer (WP7 view/RPC): `actual_unit_price − po_line.unit_price` | m220 ใหม่ไม่มี token price_variance/GENERATED ใน DDL · integration test 220.2 PASS บน DB จริง |
| 2 | `reverse_grn` insert ปริมาณ/ราคาติดลบลง `goods_receipt_lines` → ชน CHECK received_qty>0 / price>=0 → reversal พังทุกครั้ง | 223 เดิม บรรทัด 392-406 | Reversal model ใหม่: positive-quantity mirror + reversal_of linkage + partial UNIQUE uq_grn_reversal_once (ทำซ้ำไม่ได้) + stock ย้อนด้วย itx type='out' qty บวก (convention m019/m026) + WAVG ย้อนด้วย landed cost ที่เก็บไว้ | m220 CHECK เดิมคงอยู่ (ไม่ลดความเข้มงวด) · integration 220.5/220.7/220.8 PASS · staged WP6 ไม่มีค่าลบลง lines |
| 3 | อ่าน/เขียน `goods_receipts.idempotency_key` ทั้งที่ 220 เดิมไม่มีคอลัมน์ → post ครั้งแรก error | 223 เดิม บรรทัด 78, 253 | เพิ่ม idempotency_key + idempotency_payload_hash ใน m220 + partial UNIQUE uq_grn_idempotency_key + CHECK reversal ไม่มี key + WP6: same key+hash → คืนผลเดิม / hash ต่าง → ERR_IDEMPOTENCY_CONFLICT / line double-post guard | integration 220.6 PASS (unique ระดับ DB) · staged WP6 ตรวจ hash ก่อน post |
| 4 | อ่าน `goods_receipt_lines.landed_cost` ที่ไม่มีใน schema → reversal error | 223 เดิม บรรทัด 339, 362 | นิยาม landed cost ชัดใน m221 COMMENT: ต่อ line ต่อหน่วยซื้อ = (received×price − discount + shipping + ภาษี non_recoverable)/received · จุดจัดเก็บ: purchase_price_history.landed_cost (append-only) + inventory_transactions.unit_cost (ต่อ use_unit) + inventory.wavg_cost — reversal อ่านจาก pph row price_type='landed' | integration 221.2 PASS · staged WP6 อ่านจาก pph (ไม่มี v_grl.landed_cost) |
| 5 | อ่าน `supplier_products.package_size` ที่ไม่มี (m217) → post error | 223 เดิม บรรทัด 161/168/176/386 | ลบ package_size ออกจาก 221 — ข้อมูลหน่วยครอบคลุมด้วย purchase_unit + use_unit + conversion_factor + price_per_use_unit (generated) ที่มีอยู่แล้ว · ไฟล์ WP ทุกไฟล์ไม่อ้าง package_size | integration 221.1 PASS · static test กัน regression ทุก staged ไฟล์ |

### 15.2 โครงสร้างไฟล์หลังจัดขอบเขต (Owner §D)

| ไฟล์ | ประเภท | สถานะ |
|---|---|---|
| `supabase/migrations/219_purchase_orders.sql` | Migration — Schema + po_number_seq contract | ✅ แก้ (เพิ่ม sequence/comment) |
| `supabase/migrations/220_goods_receipts.sql` | Migration — Schema + idempotency + reversal linkage | ✅ รีเขียน |
| `supabase/migrations/221_purchase_price_history.sql` | Migration — Schema append-only + tenant/branch | ✅ รีเขียน |
| `supabase/migrations/222_inventory_transaction_ext.sql` | Migration — additive columns + COMMENT | ✅ เพิ่ม COMMENT |
| `supabase/migrations/223_po_grn_rls.sql` | Migration — RLS org/branch (renumbered จาก 224) | ✅ รีเขียน |
| `supabase/staged_workflows/wp2_po_workflow_rpc.sql` | REFERENCE — WP2 เจ้าของ | ใหม่ (ย้ายจาก 225) |
| `supabase/staged_workflows/wp4_grn_workflow_rpc.sql` | REFERENCE — WP4 เจ้าของ | ใหม่ (ย้ายจาก 225) |
| `supabase/staged_workflows/wp6_wavg_posting_reversal.sql` | REFERENCE — WP6 เจ้าของ | ใหม่ (ย้าย+แก้จาก 223 เดิม) |
| `supabase/staged_workflows/wp7_price_history_read_api.sql` | REFERENCE — WP7 เจ้าของ | ใหม่ (SECURITY INVOKER) |
| `supabase/staged_workflows/wp8_po_dashboard_read_api.sql` | REFERENCE — WP8 เจ้าของ | ใหม่ (SECURITY INVOKER) |
| 223_wavg_trigger.sql / 224_po_grn_rls.sql / 225_po_grn_rpcs.sql (เดิม) | — | ลบ/แทนที่ตาม scope ใหม่ |

เหตุผลที่เก็บ schema-object บางส่วนไว้ใน WP1 (ตามข้อ "Referential Integrity" ของ Owner §D):
- po_number_seq / grn_number_seq = schema objects + contract definitions ของเลขเอกสาร (UNIQUE + format) — generators (functions) อยู่ WP2/WP4
- enforce_purchase_price_history_append_only trigger = referential integrity ของ ledger — ต้องอยู่กับ schema

### 15.3 Branch Isolation (Owner §C) — สรุปการออกแบบ

- ตรวจ pattern เดิมแล้ว: m065/m071 (tenant + is_platform), m088/m090 (profiles.branch_id + is_branch_admin), m146 (role predicates) — Phase 1 ตาราง suppliers/supplier_products ยังไม่มี branch predicate ใด ๆ
- แก้: helper เดียว has_org_row_scope(tenant, branch) ครอบ platform bypass + tenant match (COALESCE 'tenant-bmb-001') + admin/owner cross-branch + staff ตาม assignment — รวมกับ role predicate ของ m146 ทุก policy
- เพิ่ม tenant_id/branch_id ให้ purchase_price_history (row สืบทอดจาก PO/GRN เขียนโดย WP6) — lines tables ใช้ EXISTS parent scope
- ทดสอบ: integration T223 11 เคส — cross-branch read/write deny ทั้งสองทิศ, WITH CHECK deny, admin/owner ตาม model เดิม, platform bypass, GRN/PPH cross-branch — ALL PASS บน DB จริง

### 15.4 Test Evidence หลังแก้

| ประเภท | ชุด | ผล |
|---|---|---|
| PostgreSQL จริง (Docker replay, fresh DB) | migrations 001→223 apply | 227 OK / 0 FAIL |
| PostgreSQL จริง | Phase 1 contracts (214-218) | ALL PASS |
| PostgreSQL จริง | Regression suite 124-213 (รวม Order Deduct / Cancel Restore) | ALL GREEN |
| PostgreSQL จริง | Phase 2 contracts e2e/contracts_phase2_219_223.sql (36 เคส) | ALL PASS |
| Static source-contract | 6 test files (219/220/221/222/223-RLS/staged) | 132 tests PASS |
| Gates | lint + brandNameGuard + languageSanity + tsc | PASS / 0 errors |

สิ่งที่ยัง UNVERIFIED โดยตั้งใจ (ตามขอบเขต §D): runtime ของ posting/reversal/idempotency-retry/concurrent (WP6), workflow RPC (WP2/WP4), read API (WP7/WP8) — SQL ออกแบบ+แก้แล้วใน staged_workflows แต่จะพิสูจน์ด้วย integration test ของ WP เจ้าของก่อน merge

**Report Status:** WP1 REMEDIATED PER OWNER DIRECTIVE — **PENDING OWNER ACCEPTANCE (WP2 NOT STARTED)**

