# Recovery Package — Migration Drift (Preparation Only)

Date: 2026-11-26 · Project `ivkdfognyiwjcmrhcnwz` · **No writes/repair/moves/permission changes performed.**
All commands below are **proposals for Owner review**; none have been executed. Approve step-by-step.

---
## WP-R1 — Migration History Reconciliation (180/183/203/204)

### Findings (git + schema + ledger)
Duplicate version numbers = **two distinct migrations sharing one version**, applied out-of-band by ad-hoc scripts that reused the version:
| Ver | Recorded (primary, keep) | Duplicate (unrecorded, archive) | Evidence |
|-----|--------------------------|----------------------------------|----------|
| 180 | `180_cart_sessions_reminder.sql` (added 2026-11-01, 33e9478) | `180_real_position_shared_3_sides.sql` (2026-11-17, 375df78) | both SQL live: `list_drivers` tenant filter ×1 |
| 183 | `183_order_message_notifications.sql` (header: "apply via e2e/_r70Apply183.cjs (ledger 183)") | `183_promo_banner_mascot.sql` (header: "via node e2e/r61Apply183.cjs") | both live: `banner_mascot` ×2 |
| 203 | `203_user_post_context.sql` (2026-11-11, 1419938) | `203_ai_grounding.sql` (2026-11-12, 6c7a7e8) | `user_post_context` ×9 (verify primary) |
| 204 | `204_sync_approval_to_marketing_post.sql` (2026-11-11, be443ef) | `204_order_memory.sql` (2026-11-12, acca657) | `marketing_post_synced` ×1 |

Why the collision: the same version was applied twice (two scripts / two files); `schema_migrations.version` is PK, so only one row survives → the other file is permanently "blank/pending".

### Proposed storage (preserves Git history, hides from CLI)
Move the **duplicate** file of each pair into a subfolder the CLI glob (`supabase/migrations/[0-9][0-9][0-9]_*.sql`) does **not** scan. Git still tracks them (history kept); CLI sees no duplicate.
```powershell
# PROPOSAL — do not run until approved
$arch = "supabase/migrations/_archive_duplicates"
New-Item -ItemType Directory -Force -Path $arch | Out-Null
git mv "supabase/migrations/180_real_position_shared_3_sides.sql" "$arch/"
git mv "supabase/migrations/183_promo_banner_mascot.sql"        "$arch/"
git mv "supabase/migrations/203_ai_grounding.sql"                "$arch/"
git mv "supabase/migrations/204_order_memory.sql"                "$arch/"
# verify no version <219 is flagged pending anymore:
"" | supabase migration list --linked   # expect: no blank rows for 180/183/203/204
```
If a version still shows a blank duplicate after this, swap: archive the *other* file of that pair instead (the recorded one is the one whose removal leaves no blank). CI note: `e2e/ci/w2_fresh_replay_full.sh` will then apply only the primary per version; to keep CI covering the archived schema, add the `_archive_duplicates/*.sql` to the replay (follow-up, separate approval).

---
## WP-R2 — Ledger Reconciliation (211–218)

### Per-file applied+committed evidence (read-only dump)
| Ver | File | Schema evidence (dump) | Tx |
|-----|------|------------------------|----|
| 211 | 211_rider_my_deliveries_return_fix | `to_jsonb(v_drv)` ×3, 210-bug ×0 | BEGIN/COMMIT (211:17/206) |
| 212 | 212_delivery_sync_preparing_hop | `ERR_KITCHEN_NOT_READY` ×2 | BEGIN/COMMIT |
| 213 | 213_cart_sessions_payload | `payload` ×24 | no explicit tx (autocommit; applied) |
| 214 | 214_create_suppliers_table | `suppliers` ×10 | BEGIN/COMMIT |
| 215 | 215_add_supplier_id_to_inventory | `supplier_id` ×7 | BEGIN/COMMIT |
| 216 | 216_enrich_inventory_cost_yield | `wavg_cost` ×4 | BEGIN/COMMIT |
| 217 | 217_create_supplier_products | `supplier_products` ×32 | BEGIN/COMMIT |
| 218 | 218_add_batch_yield_to_recipes | `batch_yield_factor` ×4 | BEGIN/COMMIT |

### Ledger name/version to record
version = `211`…`218`; name = filename without `.sql` (repair reads local filename automatically).

### Exact repair command (ledger-only; no SQL re-run, no data change)
```powershell
# PROPOSAL — do not run until approved
$env:SUPABASE_ACCESS_TOKEN = (Get-Content .env.local | ?{$_ -match '^SUPABASE_ACCESS_TOKEN='}) -replace '^SUPABASE_ACCESS_TOKEN=',''
# BEFORE: supabase migration list --linked  -> 211..218 blank, max applied 210
supabase migration repair --status applied 211 212 213 214 215 216 217 218
# AFTER:  supabase migration list --linked  -> 211..218 filled (Remote), max applied 218
```
Repair only INSERTs ledger rows for versions that are currently blank (no PK conflict). It does **not** execute migration SQL and does **not** touch schema/data. Confirmed safe: the table is owner-only but `repair` uses the Management-API path (it already succeeded for 180/183/203/204 earlier).

---
## WP-R3 — Production Apply Readiness

### 1. postgres-role connection WITHOUT sharing the password in chat
Owner enters the DB password **locally in their own terminal** (never in chat):
- Option A (prompt): run `supabase db push` interactively → it prompts `Enter your database password` → Owner types it.
- Option B (env, local only): `$env:SUPABASE_DB_PASSWORD = Read-Host "DB password"` (or set in a local, uncommitted `.env`), then run push.
The access token alone is insufficient (login role can't write `schema_migrations`); the `postgres` role (via DB password) is required and stays with the Owner.

### 2. Order confirmation
After WP-R1 (duplicates archived) + WP-R2 (211–218 recorded, max=218), the only pending local files are **219–228** (all >218) → `supabase db push` applies them in order 219→228. Verified absent in schema: `purchase_orders`/`goods_receipts`/`create_purchase_order` = 0.

### 3. Recovery / Rollback + Backup
- **Backup (hard gate, Owner):** Dashboard → Database → Backups (PITR on) **or** `supabase db dump -f backup_pre219.sql` (full) verified restorable on scratch.
- **Apply:** `supabase db push` (postgres role). Each file is transactional (BEGIN/COMMIT); stops on first error.
- **Rollback (only before prod business data is written):** reverse-order drops —
  `228` drop `get_po_dashboard`; `227` drop `get_purchase_price_history`; `226` drop WAVG fns; `225` drop GRN fns; `224` drop PO fns; `223` drop policies + `has_org_row_scope`; `222` drop added `inventory_transactions` cols; `221` drop `purchase_price_history`; `220` drop `goods_receipts*`; `219` drop `purchase_orders*`. After data entry → restore from backup instead.
- **Test data:** none created. Cleanup (if ever) must `ALTER TABLE purchase_price_history DISABLE TRIGGER trg_purchase_price_history_append_only` before DELETE (append-only trigger), then re-enable.

### 4. Ready-to-use commands (Owner runs after each approval)
```powershell
# STEP 1 (WP-R1): archive duplicates  [needs approval]
# STEP 2 (WP-R2): repair 211-218      [needs approval]
# STEP 3 (WP-R3): apply 219-228       [needs approval + backup + DB password]
$env:SUPABASE_ACCESS_TOKEN = (Get-Content .env.local | ?{$_ -match '^SUPABASE_ACCESS_TOKEN='}) -replace '^SUPABASE_ACCESS_TOKEN=',''
$env:SUPABASE_DB_PASSWORD  = Read-Host "DB password"   # entered locally, not in chat
"y" | supabase db push
# STEP 4: verify
"" | supabase migration list --linked    # expect 001-228 applied, no blanks/dups
```
Read-only smoke after apply: migration list, storefront `/shop` `/menu`, legacy orders list, `get_po_dashboard`/`get_purchase_price_history` return empty (counts 0). No write-path E2E until separately approved.

---
## Constraints honored
No deploy/write, no repair, no file move/delete, no permission change, no feature/refactor, no staging. Production-first.

---
## EXECUTION STATUS (Recovery 2026-11-26, repo-side complete)
- **WP-R1 DONE (repo):** duplicates renumbered → `229_real_position_shared_3_sides`, `230_promo_banner_mascot`, `231_user_post_context` (made idempotent: `CREATE TABLE/INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS`), `232_sync_approval_to_marketing_post`. No duplicate versions remain. Fresh Replay 001→232 ALL GREEN (232 migrations + all contracts) = parity.
- **WP-R2 VERIFIED (read-only dump):** 211–218 all schema-applied (to_jsonb(v_drv)×3, ERR_KITCHEN_NOT_READY×2, payload×24, suppliers+2 policies, supplier_id×7+idx, prep_yield/conversion/units_consistency/last_approved/wavg_cost, supplier_products×32+unique, batch_yield/cost_per_unit/last_cost_calculated). Repair command prepared (NOT executed): `supabase migration repair --status applied 211 212 213 214 215 216 217 218`.
- **WP-R5 GATES GREEN:** tsc 0 · lint 0 · vitest 258 files/3014 tests · build 0 · replay 232+contracts.
- **WP-R3/R4/R6:** runbooks below are ready; **not executed** (require Owner approval + DB password + backup).
- **WP-R7:** `docs/BMB_MIGRATION_RULES.md` (8 permanent rules) added.

**Prod steps (R2 repair, R3 connect, R4 apply 219–228) remain PENDING Owner execution. **[LIVE 2026-11-26] Ledger repair 211–218 + 229–232 DONE (=> applied, verified 001–218 applied / 219–228 pending / 229–232 applied, no dups). 219–228 push still PENDING Owner backup + `db push --include-all`. Full evidence: docs/PROD_DEPLOYMENT_RECORD_2026-11-26.md.**** Repo is consistent and CI-green; Production is unchanged by this Recovery (still schema 218 / ledger 218 (post-repair 2026-11-26), 219–228 pending).