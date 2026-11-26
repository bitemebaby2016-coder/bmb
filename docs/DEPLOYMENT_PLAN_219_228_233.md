# Combined Deployment Plan — Migrations 219–228 + 233 (2026-11-26)

Project `ivkdfognyiwjcmrhcnwz` · Baseline HEAD `8418c73` · Production-First (no staging).
One plan, one apply round, correct dependency order — no repeat deployments.

## 0. Dependency & order analysis
- 219–228 depend on ≤218 (suppliers 214, supplier_products 217, price_history 221, RLS 223) — all already applied.
- **233 depends on 214/217/221/223/146** — all ≤218 ⇒ 233 must apply AFTER 219–228 (version order guarantees it).
- Current ledger: applied 001–218 + 229–232; **pending 219–228 + 233**.
- Version sort ⇒ apply order 219,220,…,228,233. A single `db push --include-all` applies all pending in that order (233 last). No second round needed.

## 1. Backup Gate (Owner — hard)
- Restorable backup/PITR covering pre-219 state; restore tested in a non-prod env. Do NOT start writes until confirmed.

## 2. Apply (Owner, local; password typed locally)
```powershell
$env:SUPABASE_ACCESS_TOKEN=(Get-Content .env.local|?{$_ -match '^SUPABASE_ACCESS_TOKEN='}) -replace '^SUPABASE_ACCESS_TOKEN=',''
supabase db push --include-all   # applies 219–228 then 233, in version order
```
- `--include-all` = migrations not on remote (219–228 + 233); 229–232 already applied ⇒ not re-run.
- Stop immediately on any error/drift.

## 3. Post-apply verify (read-only)
- `migration list` = 001–233 applied, no gaps/dups.
- Schema: purchase_orders/goods_receipts/get_po_dashboard/get_purchase_price_history + ocr_documents + ocr RPCs.

## 4. Live Owner tests (in order)
1. OCR: upload a real receipt → review fields (image beside) → approve → verify price history row + supplier last_approved_price; confirm inventory/WAVG unchanged.
2. CSV/Excel import → review → approve.
3. Manual entry → add lines → approve.
4. Duplicate: upload same image/file twice → second flagged duplicate; approving duplicate blocked.
5. Validation: doc with wrong totals → approve blocked.
6. Tenant/RLS isolation + unauthorized access.
7. Regression: storefront/orders/recipe/rider/delivery.

## 5. Completion criteria
Phase 2 Cost Intelligence = COMPLETE only after 1–7 pass on production with evidence.

## 6. Rollback
- Migrations are additive; rollback = restore backup (Owner). App is forward-compatible (feature hidden until 233 present).

## 7. Parity verification (this session — evidence)
All three intake paths (OCR / CSV-Excel / Manual) share the SAME `ocr_create_document` RPC and the SAME `ocr_approve_document` gate:

| Aspect | OCR | CSV/Excel | Manual | Enforced where |
|--------|-----|-----------|--------|----------------|
| Duplicate | sha256 image → duplicate_of | sha256 file bytes → duplicate_of | null hash (no source doc) | DB unique index (approved) + approve guard |
| Validation | UI + server totals/line | UI + server totals/line | UI + server totals/line | `ocr_approve_document` ERR_TOTALS_INVALID / ERR_LINE_INVALID |
| Audit | created+approved | created+approved | created+approved | `audit_logs` via append_audit_log |
| Approval | same RPC | same RPC | same RPC | role + org scope + status + duplicate + validation |
| Price write | price_history(approved)+supplier approved | same | same | `ocr_approve_document` only |
| Inventory/WAVG | untouched | untouched | untouched | no inventory write in RPC |

Fixes applied this session:
- Unique index narrowed to `status='approved'` (pending duplicates no longer error; double-approve still blocked).
- Approve blocks flagged duplicates (ERR_DUPLICATE_NEEDS_REVIEW) and invalid totals/lines (server-side).
- CSV/Excel now compute content hash (duplicate parity); Manual uses same create RPC (audit/validation/approval parity).
- Proof: `e2e/contracts_233_ocr.sql` 233.1–233.7 PASS (duplicate flagged, duplicate-approve blocked, invalid-totals blocked, price +1 & WAVG untouched, double-approve blocked, audit present, manual same RPC). Full replay 001→233 ALL GREEN.

## 8. Remaining
- Deploy 233 with 219–228 (Owner, after backup gate).
- Makro Official API/Partner feed = separate (needs Owner credentials).
- Declare Complete only after §4 live tests.