# BMB Production Deployment Package — Migrations 219–228

Prepared: 2026-11-26 · **NOT DEPLOYED · NO PRODUCTION WRITES**
Production Project ID: **ivkdfognyiwjcmrhcnwz** (verified = config.toml + app VITE_SUPABASE_URL)
HEAD = origin/main = `6aacfae` · working tree clean · Production migration ledger (last known) = **218**

> Owner applies manually. This package contains no applied changes. Section 6 requires a confirmed, restorable backup BEFORE applying.

---

## 1. Migration files (per-file purpose)

| # | File | Purpose |
|---|------|---------|
| 219 | `219_purchase_orders.sql` | `po_number_seq` sequence + `purchase_orders` + `purchase_order_lines` tables, indexes, updated_at triggers. PO header/lines (draft→approved lifecycle, versioning, totals). |
| 220 | `220_goods_receipts.sql` | `grn_number_seq` + `goods_receipts` + `goods_receipt_lines` tables, indexes, triggers. GRN with idempotency_key/hash, reversal_of linkage, accepted/rejected split, landed-cost fields. |
| 221 | `221_purchase_price_history.sql` | `purchase_price_history` append-only table + `enforce_purchase_price_history_append_only()` trigger fn + trigger + indexes. Stores committed/realized/landed/correction price states. |
| 222 | `222_inventory_transaction_ext.sql` | **ALTER** existing `inventory_transactions`: add **nullable** cols `po_id, grn_id, grn_line_id, unit_cost, conversion_snapshot` + 3 indexes. Links stock txns to PO/GRN. |
| 223 | `223_po_grn_rls.sql` | `has_org_row_scope(tenant,branch)` fn + **ENABLE RLS** on the 5 new tables + 17 policies (admin/creator/finance/inventory/receiver/staff-read). Org/branch isolation. |
| 224 | `224_purchase_order_rpcs.sql` | PO workflow RPCs: `generate_po_number`, `create/update/submit/approve_purchase_order` (SECURITY DEFINER, role+scope gates, optimistic lock, audit). |
| 225 | `225_grn_workflow_rpcs.sql` | GRN workflow RPCs: `generate_grn_number`, `create_grn_draft`, `approve_grn` (partial/multi-receipt, over-receive guard, audit). |
| 226 | `226_wavg_posting_reversal.sql` | WAVG posting + reversal: `calculate_grn_line_landed_cost`, `compute_grn_payload_hash`, `post_goods_receipt_line`, `post_goods_receipt` (idempotent), `reverse_grn` (mirror + correction). |
| 227 | `227_price_history_read_api.sql` | `get_purchase_price_history(...)` — SECURITY **INVOKER** (RLS-enforced) read API. |
| 228 | `228_po_dashboard_read_api.sql` | `get_po_dashboard(...)` — SECURITY **INVOKER** aggregate read API (RLS-scoped). |

---

## 2. Dependencies & correct apply order

Strict order (each depends on prior):
```
219 → 220 → 221 → 222 → 223 → 224 → 225 → 226 → 227 → 228
```
- 220 FK→219 (purchase_orders/_lines); 221 FK→219/220; 222 FK→219/220 (and ALTERs existing itx).
- 223 depends on 219/220/221 tables existing (enables RLS on them).
- 224–226 depend on 219/220/221/222/223 (tables + `has_org_row_scope` + role fns from m146).
- 227/228 depend on 221/219/220 (+ RLS 223 for INVOKER filtering).
- All reference pre-existing prod objects: `suppliers`(214), `supplier_products`(217), `inventory`(001), `tenants`/`branches`(059), `auth.users`, role fns(146), `append_audit_log`(018) — all present at ledger 218.
- No duplicate migration numbers (219–228 unique; 224–228 are new numbers, not reused).

---

## 3. Backward-compatibility with current Production (ledger 218)

**Verified backward-compatible (additive only):**
- 219/220/221: `CREATE TABLE IF NOT EXISTS` — **new tables only**, no change to existing tables/data.
- 222: `ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS` — **nullable** columns only; existing rows get NULL; no NOT NULL, no type change, no drop. Existing order/inventory logic unaffected (new cols unused by old code).
- 223: RLS **enabled only on the 5 new tables**; existing tables' RLS untouched. New `has_org_row_scope` fn is additive.
- 224–228: `CREATE OR REPLACE FUNCTION` — **new functions only** (names did not exist in prod). No existing function replaced.
- **No destructive migration**, no data backfill required, no change to existing schema constraints/indexes.

**Conclusion:** Applying 219–228 to prod 218 is a clean forward step; the storefront, order, inventory, recipe systems are not modified and continue to function with or without these objects present.

---

## 4. Objects added / changed

- **Tables (new):** purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, purchase_price_history.
- **Sequences (new):** po_number_seq, grn_number_seq.
- **Columns (added, nullable) on existing:** inventory_transactions.{po_id, grn_id, grn_line_id, unit_cost, conversion_snapshot}.
- **Functions (new):** has_org_row_scope; enforce_purchase_price_history_append_only; generate_po_number; create/update/submit/approve_purchase_order; generate_grn_number; create_grn_draft; approve_grn; calculate_grn_line_landed_cost; compute_grn_payload_hash; post_goods_receipt_line; post_goods_receipt; reverse_grn; get_purchase_price_history; get_po_dashboard.
- **Triggers (new):** update_purchase_orders_updated_at; update_purchase_order_lines_updated_at; update_goods_receipts_updated_at; update_goods_receipt_lines_updated_at; trg_purchase_price_history_append_only.
- **RLS:** ENABLE on 5 new tables + **17 policies** (po_admin, po_creator_rw, po_finance_rw, po_inventory_rw, po_receiver_r, pol_admin, pol_creator_rw, pol_finance_rw, pol_inventory_rw, grn_admin, grn_creator_rw, grn_inventory_rw, grl_admin, grl_inventory_rw, grl_receiver_r, pph_admin, pph_staff_read).
- **Indexes (new):** ~30 indexes across the 5 new tables + 3 on inventory_transactions (all `IF NOT EXISTS`).

---

## 5. Impact on storefront / order / inventory / recipe / legacy

- **Storefront / customer order flow:** No impact — no existing table/column/function altered (222 only adds unused nullable cols to inventory_transactions; order RPCs unchanged).
- **Inventory:** Existing stock logic unchanged. New WAVG posting (226) only runs when Owner/UI calls `post_goods_receipt` for a GRN; it updates `inventory.current_stock/wavg_cost/last_purchase_price` **only** for accepted GRN lines. Order deduct/cancel-restore regression already green in replay.
- **Recipe / costing:** No change. `inventory.wavg_cost` (216) is read by recipe costing; WAVG now also fed by GRN posting — backward-compatible (same column semantics).
- **Legacy (124–213, 214–218):** Untouched; full Docker replay 001→228 = 232 migrations OK/0 FAIL confirms no regression.

---

## 6. Backup / Recovery Plan (MANDATORY before apply)

1. **Confirm a restorable backup exists** (Owner action — do NOT apply until verified):
   - Supabase Dashboard → Database → Backups: confirm latest **daily/PITR** backup timestamp; or run `supabase db dump` / `pg_dump` to a safe location and verify the dump file is non-empty and restorable on a scratch DB.
   - Record backup ID/timestamp in the apply log.
2. **Rollback = restore from that backup** (whole-DB) is the safe recovery if any step fails mid-apply. Because all changes are additive, a per-migration SQL rollback (Section 7) is also available for clean forward-only reversal.
3. **Post-apply verification** per Section 8/9 before declaring success.

> I cannot verify a backup exists from here (no prod access). Owner must confirm a restorable backup as the first gate.

---

## 7. Rollback scripts (per migration) + limits

All rollbacks are **forward-only** (drop what was added). Run in **reverse order** (228→219). Each is safe only if no production data has been written into the new tables.

```sql
-- 228
DROP FUNCTION IF EXISTS public.get_po_dashboard(DATE, DATE, TEXT);
-- 227
DROP FUNCTION IF EXISTS public.get_purchase_price_history(TEXT, TEXT, TEXT, DATE, DATE, INT, INT);
-- 226
DROP FUNCTION IF EXISTS public.reverse_grn(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.post_goods_receipt(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.post_goods_receipt_line(TEXT);
DROP FUNCTION IF EXISTS public.compute_grn_payload_hash(TEXT);
DROP FUNCTION IF EXISTS public.calculate_grn_line_landed_cost(TEXT, NUMERIC, NUMERIC);
-- 225
DROP FUNCTION IF EXISTS public.approve_grn(TEXT);
DROP FUNCTION IF EXISTS public.create_grn_draft(TEXT, JSONB, DATE, UUID, TEXT);
DROP FUNCTION IF EXISTS public.generate_grn_number();
-- 224
DROP FUNCTION IF EXISTS public.approve_purchase_order(TEXT);
DROP FUNCTION IF EXISTS public.submit_purchase_order(TEXT);
DROP FUNCTION IF EXISTS public.update_purchase_order(TEXT, JSONB, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT, INT);
DROP FUNCTION IF EXISTS public.create_purchase_order(TEXT, JSONB, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.generate_po_number();
-- 223 (drop policies + disable RLS + drop fn)
DROP POLICY IF EXISTS po_admin ON purchase_orders; DROP POLICY IF EXISTS po_creator_rw ON purchase_orders;
DROP POLICY IF EXISTS po_finance_rw ON purchase_orders; DROP POLICY IF EXISTS po_inventory_rw ON purchase_orders;
DROP POLICY IF EXISTS po_receiver_r ON purchase_orders;
DROP POLICY IF EXISTS pol_admin ON purchase_order_lines; DROP POLICY IF EXISTS pol_creator_rw ON purchase_order_lines;
DROP POLICY IF EXISTS pol_finance_rw ON purchase_order_lines; DROP POLICY IF EXISTS pol_inventory_rw ON purchase_order_lines;
DROP POLICY IF EXISTS grn_admin ON goods_receipts; DROP POLICY IF EXISTS grn_creator_rw ON goods_receipts;
DROP POLICY IF EXISTS grn_inventory_rw ON goods_receipts;
DROP POLICY IF EXISTS grl_admin ON goods_receipt_lines; DROP POLICY IF EXISTS grl_inventory_rw ON goods_receipt_lines;
DROP POLICY IF EXISTS grl_receiver_r ON goods_receipt_lines;
DROP POLICY IF EXISTS pph_admin ON purchase_price_history; DROP POLICY IF EXISTS pph_staff_read ON purchase_price_history;
ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_price_history DISABLE ROW LEVEL SECURITY;
DROP FUNCTION IF EXISTS public.has_org_row_scope(TEXT, TEXT);
-- 222 (drop added columns + indexes)
DROP INDEX IF EXISTS idx_itx_po; DROP INDEX IF EXISTS idx_itx_grn; DROP INDEX IF EXISTS idx_itx_grn_line;
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS po_id;
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS grn_id;
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS grn_line_id;
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS unit_cost;
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS conversion_snapshot;
-- 221
DROP TRIGGER IF EXISTS trg_purchase_price_history_append_only ON purchase_price_history;
DROP FUNCTION IF EXISTS public.enforce_purchase_price_history_append_only();
DROP TABLE IF EXISTS purchase_price_history;
-- 220
DROP TABLE IF EXISTS goods_receipt_lines; DROP TABLE IF EXISTS goods_receipts; DROP SEQUENCE IF EXISTS grn_number_seq;
-- 219
DROP TABLE IF EXISTS purchase_order_lines; DROP TABLE IF EXISTS purchase_orders; DROP SEQUENCE IF EXISTS po_number_seq;
```

**Rollback limits / when NOT to roll back:**
- Once production PO/GRN/price-history rows exist, `DROP TABLE` **destroys that data** — do NOT use these rollbacks after real data is entered; use **backup restore** instead.
- `DROP COLUMN` on inventory_transactions is safe only while the columns are unused/NULL (pre-first-posting).
- If 226 posted stock already, rolling back 219/220/222 leaves inventory/wavg mutated — **restore from backup**, do not per-migration rollback.
- Rule: per-migration rollback is valid **only before any production business data is written**.

---

## 8. Apply procedure (per set) + post-apply verification

Apply **one file at a time**, in order, via Supabase SQL Editor or `supabase db push`. After each, verify:

| Step | Verify |
|------|--------|
| 219 | `\dt purchase_orders` etc. exist; `SELECT * FROM po_number_seq` errors w/o nextval (ok); indexes present. |
| 220 | goods_receipts/_lines exist; grn_number_seq exists. |
| 221 | purchase_price_history exists + trigger `trg_purchase_price_history_append_only` present. |
| 222 | `\d inventory_transactions` shows 5 new nullable cols; existing order flow still works (place a test order). |
| 223 | `\d+ purchase_orders` shows "Row Level Security: enabled" + 5 policies; `has_org_row_scope` exists. |
| 224 | `\df create_purchase_order` etc. exist (5 fns). |
| 225 | 3 GRN fns exist. |
| 226 | 5 WAVG fns exist. |
| 227 | `get_purchase_price_history` exists, prosecdef=false (INVOKER). |
| 228 | `get_po_dashboard` exists, prosecdef=false (INVOKER). |

After all: run Section 9 smoke tests. **Do not declare success until smoke passes.**

---

## 9. Post-deploy Smoke Tests (production, read-mostly + minimal writes)

> Requires Owner authorization for test accounts/data (Section 10). Until then, only **read-only** checks are allowed.

**Read-only (safe immediately):**
- `SELECT count(*) FROM purchase_orders;` → 0 (no data leak).
- `SELECT public.get_po_dashboard(NULL,NULL,NULL);` as admin → returns JSON with zeroed counters.
- `SELECT * FROM public.get_purchase_price_history(NULL,NULL,NULL,NULL,NULL,10,0);` → empty.
- Storefront smoke: load `/shop`, `/menu`, place a **read** of menu (no order) — page renders, no console errors.
- Legacy order regression (read): admin orders list loads.

**Write-path (needs Owner test-data authorization):** PO create→submit→approve → GRN create→approve → post (WAVG) → price history → dashboard reflects; duplicate post (idempotent) no double stock; reverse → stock/cost restored. (These are the WP3/WP5/full-workflow E2E; run only after auth.)

---

## 10. Test accounts & test data + cleanup (no real customer data)

**Test accounts (create in prod auth only after Owner approval):**
- `po-tester@…` (role staff, branch A), `grn-tester@…` (role inventory, branch A), `po-approver@…` (role finance/admin). Use clearly-labelled emails (e.g. `bmb-test-po@example.com`).
- Mark profiles with a recognizable tenant/branch test id; never reuse real customer ids.

**Test data:** supplier `TEST-SUP`, inventory `TEST-ING`, supplier_product `TEST-SP` — all prefixed `TEST-`/`bmb-test-` for easy cleanup.

**Cleanup plan (after verification):**
```sql
-- delete test business data (only TEST- prefixed), then test auth users
DELETE FROM purchase_price_history WHERE supplier_id LIKE 'TEST-%';
DELETE FROM goods_receipt_lines WHERE ingredient_id LIKE 'TEST-%';
DELETE FROM goods_receipts      WHERE supplier_id  LIKE 'TEST-%';
DELETE FROM purchase_order_lines WHERE ingredient_id LIKE 'TEST-%';
DELETE FROM purchase_orders      WHERE supplier_id  LIKE 'TEST-%';
DELETE FROM supplier_products    WHERE id LIKE 'TEST-%';
DELETE FROM inventory            WHERE id LIKE 'TEST-%';
DELETE FROM suppliers            WHERE id LIKE 'TEST-%';
-- test auth users (cascade profiles via existing FK/on delete)
DELETE FROM auth.users WHERE email LIKE 'bmb-test-%@example.com';
```
Never delete non-`TEST-` rows. Confirm counts are 0 before/after.

---

## Definition of Done (Phase 2 → level 7)
1. Owner confirms restorable backup (Section 6). 2. Owner applies 219–228 in order (Section 8). 3. Post-apply verify (Section 8). 4. Owner authorizes test data → run smoke + E2E (Section 9). 5. Cleanup (Section 10). 6. Owner Acceptance.
Until steps 1–6 are confirmed by Owner, Phase 2 remains at **level 3 (Migration Ready)** — NOT deployed/smoke/accepted.