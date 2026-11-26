# Final Safety Review — Migrations 210–218 (discovered pending on Production)

Reviewer: AI (Kilo) · 2026-11-26 · No deploy, no prod writes
Context: Production ledger is **209** (not 218). 210–228 all pending. 219–228 depend on 214–218. Owner approved "review 210–218 then apply all".
Evidence = `file:line`.

## Verdict: **BLOCKED — 1 blocking defect in 210 (prod data mutation). Do NOT apply as-is.**

| File | Result | Evidence / note |
|------|--------|-----------------|
| 210 rider round fix | **FAIL (blocking)** | Verify `DO` block overwrites prod `business_settings.hours` to `{"open":"00:00","close":"23:59"}` (210:614-616) and cleanup (210:676-681) never restores it → live store hours become 24/7. Also seeds fixtures into prod tables (cleaned except hours). |
| 211 my_deliveries RETURN fix | PASS | CREATE OR REPLACE 5-arg only; verify sets local role/claims (is_local, reset) and only SELECTs (read-only). 211:110-146. |
| 212 delivery sync preparing hop | PASS | 3 CREATE OR REPLACE fns; no data mutation. 212:17/181/310. |
| 213 cart_sessions payload | PASS | `ADD COLUMN IF NOT EXISTS payload` + `DROP POLICY IF EXISTS`/`CREATE` (213:18-25). Additive. |
| 214 suppliers table | PASS | `CREATE TABLE IF NOT EXISTS` + RLS + grants + trigger (214:12/40/64). Additive. |
| 215 supplier_id + backfill | PASS (note) | `ADD COLUMN IF NOT EXISTS` (215:13) + **data backfill**: INSERT suppliers from inventory (215:30-57) + UPDATE inventory.supplier_id (215:60-67). Intended Phase-1 write; not customer data. |
| 216 enrich inventory cost/yield | PASS (note) | `ADD COLUMN IF NOT EXISTS` NOT NULL DEFAULT + CHECK (216:15-45) + backfill UPDATE use_unit/purchase_unit (216:51-58). Defaults valid → safe. |
| 217 supplier_products | PASS | `CREATE TABLE IF NOT EXISTS` + RLS + grants (217:13/59/91). Additive. |
| 218 recipes batch yield | PASS | `ADD COLUMN IF NOT EXISTS` (218:16-25). Additive. |

## Blocking defect detail (210)
- 210:614-616 `INSERT INTO business_settings(key,value) VALUES('hours','{"open":"00:00","close":"23:59"}') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value` — **unconditional overwrite**, no restore.
- 210:676-681 cleanup deletes tenant/branch/driver/round/order/assignment but **not** `business_settings.hours`.
- Impact: storefront open/closed (enforce_shop_hours m160) flips to always-open. Violates Owner "no business-logic/data change out of scope".
- Fix options (need Owner approval, since 210 is a pending migration — editing it is a code change, not an ad-hoc prod fix):
  - (A) Make the verify block non-mutating: remove the `business_settings.hours` upsert (and the tenant upsert), keep only the read-only function exec. OR
  - (B) Snapshot & restore hours around the block (`v_old := value; ... ; UPDATE back to v_old`), and skip fixture writes on prod.
  - Recommended: **(A)** — the runtime verify is a CI concern; on prod it should not write at all.

## Other notes (non-blocking)
- 210:634 fixture uses `CURRENT_DATE` (inside DO block, not a function) — m190 gate not triggered.
- 210:446/517 `admin_cancel_assignment`/`assign_driver` auth condition `v_uid IS NULL AND claims IS NOT NULL` is pre-existing odd logic — not a data-safety risk; out of scope to change.
- 215/216 backfill writes are intended Phase-1 behavior; they do not touch customer/order data.

## Conclusion
**BLOCKED on 210.** 211–218 are safe to apply. Do not run `supabase db push` until 210 is made non-mutating (option A/B) and Owner re-approves. No apply performed.