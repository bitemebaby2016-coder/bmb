# BMB — PRODUCTION DEPLOYMENT RECORD (2026-11-26)

Project: `ivkdfognyiwjcmrhcnwz` · Baseline HEAD: `2674019` · Policy: Production-First (no staging).
Scope: close Migration Recovery (ledger reconciliation) + deploy 219–228 + read-only acceptance.

---

## 1. Final Git / Worktree
- HEAD: `2674019` (`267401946d25e8698be9882e598dd03f24e40cec`)
- origin/main: in sync (`## main...origin/main`, clean worktree)
- Migration files: 232 numeric versions (001–232), **no duplicate versions**; 3 non-migration `PROPOSED_*.sql` (not applied).

## 2. Migration Version Map (relevant)
- 001–210: applied (ledger) — pre-existing.
- 211–218: schema-applied out-of-band; **ledger repaired → applied** this session.
- 219–228: **PENDING** (schema absent) — target of this deployment.
- 229–232: renumbered duplicates (was 180/183/203/204); schema-applied; **ledger repaired → applied** this session. 231 made idempotent.

## 3. Ledger Reconciliation — evidence
### 3.1 Proof each 211–218 file's SQL is live on prod (schema dump, not names)
| Ver | Object-level evidence (count in prod dump) |
|-----|---------------------------------------------|
| 211 | `to_jsonb(v_drv)` ×3; bad subquery `to_jsonb((SELECT * FROM public.drivers` = 0; GRANT authenticated |
| 212 | `WHEN 'preparing'` ×4 (3 RPCs); `ERR_KITCHEN_NOT_READY` ×2; driver_update/admin_advance/driver_checkin present |
| 213 | `cart_sessions.payload` column; policy `cart_sessions_select_own` |
| 214 | `suppliers` table; policies `suppliers_admin`+`suppliers_staff_read`; `payment_terms_days`; trigger `suppliers_updated_at`; 4 indexes |
| 215 | `inventory.supplier_id` + FK→suppliers(id) + `idx_inventory_supplier` |
| 216 | `prep_yield_factor/prep_waste_pct/purchase_unit/use_unit/conversion_factor/package_size/gross_weight/net_weight/wavg_cost/last_purchase_price/last_approved_price`; `inventory_units_consistency` CHECK; idx wavg/last_purchase |
| 217 | `supplier_products` table; UNIQUE(supplier_id,ingredient_id); 5 indexes; 2 policies; trigger |
| 218 | `recipes.batch_yield_factor/batch_waste_pct/cost_per_unit/last_cost_calculated_at`; `idx_recipes_cost_per_unit` |
- Repair (ledger-only, no SQL re-run): `supabase migration repair --status applied 211 212 213 214 215 216 217 218` → **Repaired … => applied**.

### 3.2 Proof 229–232 (full-file, incl. 229 DELETE data check)
- 229: `list_drivers()` has `d.tenant_id = v_tenant` + `last_seen_at` (verify block enforces). **DELETE analysis:** deletes drivers whose name ∈ {5 AI-test names} AND no active assignment (accepted/picked_up/in_transit/arrived). **Live data check (read-only Management API):** prod has exactly **1 driver** = "พลอย ไบท์ไดรฟ์" (status available) — **not** any delete target ⇒ re-run deletes 0 rows; original delete already took effect. Safe.
- 230: `promotions.banner_mascot` column present.
- 231: `user_post_context` table + `idx_user_post_context_updated` + RLS policy `service_role_full_access` + grant (idempotent).
- 232: `review_content(...)` contains `marketing_post_synced` (marketing_posts sync on approve).
- Repair: `supabase migration repair --status applied 229 230 231 232` → **Repaired … => applied**.

### 3.3 Ledger before / after (evidence files)
- Before: `migration list` = applied 001–210, pending 211–232 (dup fixed).
- After: **applied 001–218, pending 219–228, applied 229–232**; no duplicates; no unexplained blanks.

## 4. Backup & Restore Verification — **BLOCKED (Owner hard gate)**
- Requirement: restorable backup/PITR covering pre-219 state; restore tested in a **non-production** env.
- Agent cannot self-certify Owner's backup. **Owner must confirm** before any production write. No restore test performed against prod.

## 5. Production Apply 219–228 — **BLOCKED (awaiting Owner)**
- Command (Owner, local; password typed locally, never in chat/git):
  ```powershell
  $env:SUPABASE_ACCESS_TOKEN=(Get-Content .env.local|?{$_ -match '^SUPABASE_ACCESS_TOKEN='}) -replace '^SUPABASE_ACCESS_TOKEN=',''
  supabase db push --include-all      # applies 219–228 only (229–232 already on remote → not re-run)
  ```
  `--include-all` = "include all migrations not found on remote history table" → 219–228 (229–232 excluded).
- Per-version results: PENDING (record after run).

## 6. Final Ledger vs Schema Parity — **BLOCKED** (post-apply)
- Target after push: 001–232 applied, no gaps/dups; schema has purchase_orders/goods_receipts/get_po_dashboard/get_purchase_price_history.

## 7. Read-only Smoke — **BLOCKED** (post-apply)
- `/shop`, `/menu`, legacy orders list; `get_po_dashboard`/`get_purchase_price_history` empty-state (verify no error, not just empty array).

## 8. Regression — Local PASS (CI-green at 2674019); Production regression BLOCKED (post-apply).

## 9. Known Risks / Blockers
- Backup restorability (Owner).
- DB password for `db push` (Owner, local).
- 229–232 idempotency verified; `--include-all` prevents re-run.

## 10. Owner Live Testing Checklist
- Supplier create/edit; Purchase Order create→approve; Goods Receiving (GRN) post; Inventory update; WAVG cost posting/reversal/idempotency; Cost/Profit calc; Price History; PO Dashboard; user permissions + tenant isolation; regression of storefront/orders/recipe/rider/delivery.
- Boundary: no test data / write-path E2E by agent until separately approved.