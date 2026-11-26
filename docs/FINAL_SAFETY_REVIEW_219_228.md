# Final Production Safety Review — Migrations 219–228

Reviewer: AI (Kilo) · Date: 2026-11-26 · **No deploy, no prod writes**
Production Project: `ivkdfognyiwjcmrhcnwz` (verified) · HEAD `0b3ace6` · ledger 218
Method: read actual SQL of all 10 files (not the summary). Evidence = `file:line`.

## Verdict: **PASS (with 1 fixed defect + 2 minor RISK notes)**

---

## A. Per-file SQL review (actual files)

| File | Result | Evidence / note |
|------|--------|-----------------|
| 219 purchase_orders | PASS | `CREATE TABLE IF NOT EXISTS` x2 (219:21,58); seq (219:16); indexes IF NOT EXISTS (219:81-88); triggers DROP+CREATE idempotent (219:91-99); GRANT to authenticated (219:102-103). `CURRENT_DATE` only as **column default** (219:28) — not a function → m190 gate not triggered. |
| 220 goods_receipts | PASS | tables IF NOT EXISTS (220:35,80); unique partial indexes for reversal/idempotency (220:130-135); CHECK grl_acceptance_balance (220:109); triggers idempotent (220:139-147). `CURRENT_DATE` column default only (220:42). |
| 221 price_history | PASS | table IF NOT EXISTS (221:27); append-only fn+trigger (221:80-100); generated col price_per_use_unit (221:44); GRANT SELECT,INSERT only (221:103). `CURRENT_DATE` column default only (221:49). |
| 222 itx ext | PASS | `ADD COLUMN IF NOT EXISTS` **nullable** x5 (222:24-28); indexes IF NOT EXISTS (222:42-44); no NOT NULL / no type change / no drop. Additive. |
| 223 RLS | PASS | `has_org_row_scope` SECURITY DEFINER (223:37-80); ENABLE RLS on 5 new tables only (223:88-92); 17 policies all `DROP POLICY IF EXISTS`+CREATE (idempotent) (223:99-301). No existing table touched. |
| 224 PO RPCs | PASS | 5 `CREATE OR REPLACE FUNCTION` (new names); SECURITY DEFINER + role + has_org_row_scope in-body; Asia/Bangkok date (no CURRENT_DATE). |
| 225 GRN RPCs | PASS | 3 new fns; create gate is_staff OR is_inventory; over-receive guard cumulative; audit. |
| 226 WAVG | PASS | 5 new fns; FOR UPDATE lock order; idempotency key+hash; reversal mirror+correction; audit. |
| 227 read | PASS | SECURITY **INVOKER** (227:*) — RLS enforced. |
| 228 dashboard | PASS | SECURITY **INVOKER**; jsonb_agg wrapped subqueries. |

## B. Dependency / order
- Order 219→220→221→222→223→224→225→226→227→228. FKs only to pre-existing prod tables (suppliers 214, supplier_products 217, inventory 001, tenants/branches 059, auth.users) + new tables. Verified `update_updated_at_column` (m214) and role fns (m146) exist at 218. No duplicate numbers. **PASS.**

## C. RLS / RPC / Trigger / Index
- RLS enabled on 5 new tables only; existing tables untouched (223:88-92). Policies idempotent (DROP+CREATE). RPCs SECURITY DEFINER with in-body role+scope (Owner C) or INVOKER (227/228). Triggers idempotent (DROP+CREATE). Indexes all IF NOT EXISTS. **PASS.**

## D. Impact on existing Inventory/WAVG + new PO/GRN
- 222 adds nullable cols to inventory_transactions — old order/inventory code ignores them. WAVG (226) writes inventory.current_stock/wavg_cost/last_purchase_price only on GRN post; same column semantics as m216. Order deduct/cancel-restore unchanged (regression green in replay 001→228). No existing behavior altered. **PASS.**

## E. Apply method & ledger integrity (Supabase workflow)
- Use `supabase db push` (or `supabase migration up`) so the `supabase_migrations.schema_migrations` ledger matches files exactly. **Do NOT** paste raw SQL in the SQL Editor for tracked migrations — that applies DDL without recording the version, causing ledger/file drift. If Owner must use SQL Editor, after each file run `supabase migration repair --status applied <version>` to align the ledger. **PASS (procedure defined).**

## F. Backup / Restore
- Restorable backup is a hard gate (Owner confirms daily/PITR or `pg_dump` verified on scratch). Restore = full-DB restore from that backup. Owner must verify backup timestamp + non-empty dump. **PASS (gated on Owner).**

## G. Rollback per migration + conditions
- Reverse-order SQL in package §7. **Conditions:** per-migration rollback valid ONLY before any prod business data is written (after data entry, `DROP TABLE`/`DROP COLUMN` destroys data → use backup restore). 221 append-only trigger does not block DROP TABLE (DDL). **PASS (limits stated).**

## H. Apply checklist + per-step verify
- Package §8: one file at a time + per-step `\dt`/`\d+`/`\df` verification. **PASS.**

## I. Smoke tests (read-only vs write-path)
- Read-only (safe now): counts=0, get_po_dashboard/get_purchase_price_history return empty, storefront `/shop` `/menu` render, legacy orders list loads. Write-path (needs Owner test-data auth): PO→GRN→post→WAVG→price→dashboard, idempotent repost, reverse. No real money / no customer impact. **PASS.**

## J. Damage risk to existing system / data behavior change
- No existing table dropped/renamed; no existing column type/constraint changed; 222 additive nullable only; RLS only on new tables. **No behavior change to legacy.** **PASS.**

---

## Defects found & fixed this review
1. **FIXED — cleanup DELETE blocked by append-only trigger.** Package §10 cleanup `DELETE FROM purchase_price_history` would be rejected by `trg_purchase_price_history_append_only` (221:97-100). Fixed: cleanup now `ALTER TABLE ... DISABLE TRIGGER` → delete → `ENABLE TRIGGER` (package §10 updated).

## Minor RISK (no code change; Owner awareness)
- **RISK-1 (low):** 219:28 / 220:42 / 221:49 use `CURRENT_DATE` as **column default** (UTC). Not a gate violation (m190 scans functions only) and not used by workflow logic (RPCs use Asia/Bangkok). Cosmetic only.
- **RISK-2 (low):** 221:40 `conversion_factor` has no `>0` CHECK (unlike 219/220). Safe in practice because all inserts come from GRN lines (which enforce >0). No action unless Owner wants defense-in-depth.

## Conclusion
**PASS** — all 10 files reviewed at SQL level; additive/backward-compatible; deps satisfied at 218; rollback + backup + apply + smoke defined. One cleanup defect fixed. Two low risks noted (no change required). **STOP — awaiting Owner approval to apply.**