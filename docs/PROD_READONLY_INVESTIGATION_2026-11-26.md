# Production Read-Only Investigation — 2026-11-26

Scope: READ-ONLY. No writes, no repair, no ledger edits, no file moves, no SQL, no password.
Project: `ivkdfognyiwjcmrhcnwz` (confirmed: `supabase/config.toml` project_id + `.temp/project-ref`).
Evidence sources: live `supabase migration list --linked` (ledger), `supabase db dump` (schema, read-only), `git ls-files` (repo).

---
## 1. Actual Production Schema State (from `db dump -s public`, 696 KB)
Schema is **ahead of the ledger**. Applied in schema: **001–218**. Not applied: **219–228**.
- 210 applied: `ERR_DRIVER_OFFLINE` ×4, `list_drivers` tenant filter `d.tenant_id = v_tenant` ×1, `claim_dispatch_offer` present.
- 211 applied: `to_jsonb(v_drv)` ×3, 210-bug `to_jsonb((SELECT * FROM public.drivers` ×0.
- 212 applied: `ERR_KITCHEN_NOT_READY` ×2. 213 applied: `cart_sessions.payload` ×24.
- 214 applied: `suppliers` table ×10. 215 applied: `supplier_id` ×7. 216 applied: `wavg_cost` ×4.
- 217 applied: `supplier_products` ×32. 218 applied: `batch_yield_factor` ×4.
- 219 absent: `purchase_orders` ×0. 220 absent: `goods_receipts` ×0. 224 absent: `create_purchase_order` ×0.

## 2. Actual Migration Ledger State (from `migration list`, 252-line capture)
- Max applied (Remote filled) = **210**. Applied: 001–210.
- Name-mismatch duplicates (applied + blank): **180, 183, 203, 204** (each appears twice: one Remote-filled, one blank).
- Blank-only (no Remote row): **211–228**.
- Ledger table `supabase_migrations.schema_migrations`: OWNER = `postgres`; PK(version); **no GRANTs to any non-owner role**.

## 3. Git Migration File State (`git ls-files`, 237 files)
- **Duplicate version numbers** (root cause) — two distinct files share each version:
  - 180: `180_cart_sessions_reminder.sql` + `180_real_position_shared_3_sides.sql`
  - 183: `183_order_message_notifications.sql` + `183_promo_banner_mascot.sql`
  - 203: `203_ai_grounding.sql` + `203_user_post_context.sql`
  - 204: `204_order_memory.sql` + `204_sync_approval_to_marketing_post.sql`
- 210/211 files present. Highest numbered = 228 (+ 4 `PROPOSED_*.sql`, non-numbered, skipped by CLI).

## 4. Was 211 applied or rolled back?
**Applied (schema), ledger missing.** 211 file has its own `BEGIN;` (211:17) … `COMMIT;` (211:206), so its SQL committed independently; the subsequent ledger INSERT (outside that tx) was denied. Dump confirms the 211 fix is live (`to_jsonb(v_drv)` present, 210 bug absent).

## 5. Impact of 210 & 211 on Production
- 210: replaced rider RPCs (`my_deliveries` 5-arg, `driver_accept_assignment`, `claim_dispatch_offer`, `close_assignments_on_order_terminal`, `driver_decline_assignment`, `admin_cancel_assignment`, `assign_driver`), added offline gate + `arrived` handling + tenant-scoped `list_drivers`; deleted Owner-confirmed AI test drivers (guarded). Bug-fix scope; no customer/order data touched.
- 211: `my_deliveries` RETURN fix (`to_jsonb(v_drv)`). Read-only function; no data change.
- Net: rider assignment flow fixed; low risk. No real customer/payment data affected.

## 6. Why 210 recorded but 211 denied
`schema_migrations` is owner-only (`postgres`), no grants to the CLI's temporary login role → INSERT denied (42501). 210's row is present (insert succeeded in that invocation); 211's insert was denied in the same run — the access-token login role lacks a stable INSERT grant on `supabase_migrations`. A `postgres`-role connection (DB password) is required for reliable ledger writes. (Observed inconsistency; grant evidence above.)

## 7. "Ledger 218" (earlier reports) vs "210" (now)
The "218" in prior docs (handoff r16 / MASTER_STATUS r14 / summaries) was an **assumption about schema/intent**, never verified against the live ledger. Reality: **schema = 218 applied, ledger = 210 recorded**. Both are "correct" for different layers: Phase-1 (214–218) and 212/213 were applied out-of-band without ledger rows; the ledger only ever recorded to 210. So the doc over-stated the *ledger* by 8.

## 8. Root Cause
1. **Duplicate version numbers** in repo (180/183/203/204) → the second file of each pair is permanently flagged "pending" (version PK already taken by the primary file), even though its SQL is applied.
2. **Ledger not maintained for out-of-band applies** → 211–218 schema-applied but unrecorded.
3. **CLI login role lacks ledger INSERT** → `db push` cannot record migrations reliably.

---
## Recovery Plan (preserves data + history; NO file-move hack)
1. **Deduplicate repo (git-only):** move the 4 redundant second-files out of the scanned path into `supabase/migrations/_duplicates/` (content preserved, no longer scanned). Their SQL is already live and the version is recorded by the primary file. [Owner approval]
2. **Record already-applied schema (ledger-only):** `supabase migration repair --status applied 211 212 213 214 215 216 217 218` (schema already has them; no SQL re-run). [Owner approval]
3. **Apply the only genuinely-missing (219–228)** via a `postgres`-role connection: `SUPABASE_DB_PASSWORD=… supabase db push` (full ledger perms), one-by-one, verify ledger after each, stop on error. [Owner approval + DB password]
4. **Verify:** `migration list` shows 001–228 applied, no blank/duplicate; read-only smoke (counts=0, storefront renders, legacy orders list). No test data / write-path E2E until separately approved.

## Risks / Impact
- Current partial state is **low risk**: 210/211 are rider bug-fixes; 212–218 already live; no customer/payment data touched. Storefront/orders unaffected.
- The 4 duplicate-version files are a **repo hygiene** issue, not a live-data risk.
- Recovery steps 1–2 are git/ledger-only (no schema/data change); step 3 is the real schema apply (219–228, additive).
- Until fixed, `db push` will keep failing (duplicates + ledger perms); do not retry blindly.

STOP — awaiting Owner decision.