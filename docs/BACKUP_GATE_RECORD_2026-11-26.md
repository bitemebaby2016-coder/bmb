# BMB — PRODUCTION BACKUP GATE RECORD (2026-11-26)

Project: `ivkdfognyiwjcmrhcnwz` (ap-northeast-2, ACTIVE_HEALTHY) · Policy: Production-First (no staging).
Scope: Owner Directive "Complete Production Backup Gate" — verify/create backup, test restore, prepare migration plan.
**No production writes, no migration executed. No secrets (DB password / access token) are recorded in this file.**

---

## 1. Existing backup found (before this session)
Source: Supabase Management API `GET /v1/projects/{ref}/database/backups` (read-only, token from CLI login).
- `pitr_enabled`: **false** → Point-in-Time Recovery is **OFF**
- `backups`: **[]** (no logical backups)
- `physical_backup_data`: **{}** (no base physical backup listed)
- `walg_enabled`: true (WAL archiving on, but no restorable base backup present)
- On-demand logical backup via API (`POST .../database/backups`): **404 not supported** on this project/plan.

**Conclusion:** Before this session there was **no restorable backup** covering the pre-219 state. The backup gate was **NOT satisfied**.

## 2. Backup created this session
- Command (read-only login role, no DB password needed): `supabase db dump --linked -f backup_pre233.sql`
- Result: **SUCCESS** — "Dumped schema to …".
- Durable copy stored **outside the git repo**: `D:\A PROJECT\backups\backup_pre233_2026-11-26.sql`
- Scope: full `public` schema (schema + data) of production **at pre-219 state** (verified: `purchase_orders`/`goods_receipts`/`ocr_documents` absent; `suppliers`/`supplier_products`/`cart_sessions` present).

## 3. Integrity verification
- Size: **708,421 bytes** (source = durable copy, identical)
- SHA-256: `36209070F15CCD371DC3A6DD8C8AF1B8F124EC7393FAC485003F23E4194FF736`
- `CREATE TABLE` count in dump: 75 · data present (COPY + 76 INSERT) · ends with GRANT/ALTER DEFAULT PRIVILEGES (complete).
- File is readable UTF-8 SQL, restorable (see §4).

## 4. Restore test (non-production, Docker `postgres:16`)
- Restored the dump into a throwaway local container (`bmb_restore_233`, since removed). Standard Supabase roles pre-created.
- Result: **77 public tables restored** (75 tables + 2 views). Key tables present: `suppliers`, `cart_sessions`, `supplier_products`. `purchase_orders`/`goods_receipts`/`ocr_documents` correctly absent.
- Row counts (production is early-stage): suppliers 0 · cart_sessions 0 · supplier_products 0.
- Errors during restore were **environmental only**, not dump corruption:
  - `schema "auth" does not exist` (cross-schema RLS policies referencing `auth.users` — auth schema not part of a public-schema dump)
  - `unrecognized privilege type "maintain"` (PG17 grant; local test used PG16)
  - `publication "supabase_realtime" does not exist`
- **Public schema (the part migrations 219–233 alter) restored cleanly.**

## 5. What the Developer could / could not do
| Item | Done by Dev | Reason |
|------|-------------|--------|
| Read backup/PITR status | ✅ | Management API (CLI login token) |
| Create restorable backup | ✅ | `supabase db dump --linked` (login role, no DB password) |
| Store backup safely (non-repo) | ✅ | `D:\A PROJECT\backups\` |
| Integrity check | ✅ | size + SHA-256 + table/data markers |
| Restore test (non-prod) | ✅ | Docker postgres:16 |
| Enable PITR | ❌ | Billing/plan change = Owner decision (not a dev action) |
| Create backup via Management API | ❌ | endpoint returns 404 on this project |
| Execute production migration | ❌ | Forbidden until Owner approval (directive §5) |

## 6. Owner steps actually required (only these)
1. **Decide backup strategy** (one of):
   - (A) Accept this manual dump as the pre-migration backup — keep `D:\A PROJECT\backups\backup_pre233_2026-11-26.sql` safe (it contains production data, unencrypted), OR
   - (B) Enable **PITR** in Dashboard → Database → Backups (Pro plan) for point-in-time recovery.
2. **Authorize the migration apply** (directive §5) and, at apply time, type the **DB password locally** (postgres role required to write `schema_migrations`; login role is insufficient). The access token alone cannot apply.
   - The Dev already proved the DB is reachable and the ledger is correct (see §7); only the write credential + your go-ahead are missing.

---

## 7. Migration plan (prepared, NOT executed) — target 219–228 + 233 only
Evidence: `supabase migration list --linked` (real remote ledger, this session):
- `001–218` Local = Remote (applied)
- `219–228` Local present, **Remote blank → PENDING**
- `229–232` Local = Remote (**applied → will NOT re-run**)
- `233` Local present, **Remote blank → PENDING**

Dependency/order:
- 219–228 depend on ≤218 (suppliers 214, supplier_products 217, price_history 221, RLS 223, roles 146) — all applied.
- 233 depends on 214/217/221/223/146 — all ≤218 ⇒ applies **after** 219–228.
- Version sort ⇒ apply order `219,220,…,228,233`. `supabase db push --include-all` selects exactly the versions not on remote = **219–228 + 233** (229–232 excluded because already on remote). No second round.

Guardrails at apply time (Owner):
- Stop immediately on any error or schema drift.
- If the CLI ever proposes a version outside {219–228, 233}, STOP (do not apply).
- Post-apply read-only verify: `migration list` = 001–233, no gaps/dups; schema has `purchase_orders`/`goods_receipts`/`get_po_dashboard`/`get_purchase_price_history`/`ocr_documents` + OCR RPCs.

## 8. Status (updated after apply)
- Backup gate: **PASSED** — manual dump CREATED + INTEGRITY-VERIFIED + RESTORE-TESTED (public schema, 77 tables).
- PITR: **DISABLED** (Owner decision; manual dump accepted as pre-migration backup).
- Production migration 219–228 + 233: **APPLIED** (Owner `db push`) + **ledger repaired** (`migration repair --status applied 219…228 233`). `migration list` = **001–233 all applied, no gaps/dups**; schema verified via fresh dump.
- Remaining: live OCR/PO/GRN + regression = LIVE_TEST_PENDING (Owner).